# Observability Guide for Untrace

## Overview

This guide provides comprehensive information on implementing observability in the Untrace project using OpenTelemetry (OTel) and OpenLLMetry. As our platform deals with LLM observability routing, it's crucial that we practice what we preach by implementing robust observability in our own services.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [OpenTelemetry Setup](#opentelemetry-setup)
3. [OpenLLMetry Integration](#openllmetry-integration)
4. [Instrumentation Patterns](#instrumentation-patterns)
5. [Data Collection Strategy](#data-collection-strategy)
6. [Privacy and Security](#privacy-and-security)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting](#troubleshooting)

## Architecture Overview

Our observability stack consists of:

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Application   │────▶│  OTel Collector  │────▶│   Backends      │
│  (w/ OTel SDK)  │     │                  │     │ (Prometheus,    │
└─────────────────┘     └──────────────────┘     │  Jaeger, etc.)  │
                                                  └─────────────────┘
```

### Components

1. **OpenTelemetry SDK**: Embedded in each service for instrumentation
2. **OpenLLMetry**: Auto-instrumentation for LLM-specific operations
3. **OTel Collector**: Central processing and routing of telemetry data
4. **Storage Backends**: Your choice of observability platforms

## OpenTelemetry Setup

### 1. Collector Configuration

Create `otel-collector-config.yaml`:

```yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  batch:
    timeout: 1s
    send_batch_size: 1024

  memory_limiter:
    check_interval: 1s
    limit_mib: 512

  # Filter sensitive data
  attributes:
    actions:
      - key: http.request.body
        action: delete
      - key: http.response.body
        action: delete
      - key: llm.prompt
        action: hash
      - key: llm.completion
        action: hash

exporters:
  # Development
  logging:
    loglevel: debug

  # Production
  otlp/jaeger:
    endpoint: jaeger:4317
    tls:
      insecure: true

  prometheusremotewrite:
    endpoint: "http://prometheus:9090/api/v1/write"

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, attributes, batch]
      exporters: [logging, otlp/jaeger]

    metrics:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [prometheusremotewrite]

    logs:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [logging]
```

### 2. SDK Configuration

#### TypeScript/Node.js Setup

```typescript
// telemetry.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';

export function initTelemetry(serviceName: string) {
  const resource = new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
    [SemanticResourceAttributes.SERVICE_VERSION]: process.env.SERVICE_VERSION || '1.0.0',
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
  });

  const traceExporter = new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4317',
  });

  const metricExporter = new OTLPMetricExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4317',
  });

  const sdk = new NodeSDK({
    resource,
    traceExporter,
    metricReader: new PeriodicExportingMetricReader({
      exporter: metricExporter,
      exportIntervalMillis: 1000,
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': {
          enabled: false, // Disable noisy fs instrumentation
        },
      }),
    ],
  });

  sdk.start();

  // Graceful shutdown
  process.on('SIGTERM', () => {
    sdk.shutdown()
      .then(() => console.log('Telemetry terminated'))
      .catch((error) => console.error('Error terminating telemetry', error))
      .finally(() => process.exit(0));
  });
}
```

#### Python Setup

```python
# telemetry.py
from opentelemetry import trace, metrics
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.instrumentation.auto_instrumentation import sitecustomize
import os

def init_telemetry(service_name: str):
    # Create resource
    resource = Resource.create({
        "service.name": service_name,
        "service.version": os.getenv("SERVICE_VERSION", "1.0.0"),
        "deployment.environment": os.getenv("ENVIRONMENT", "development")
    })

    # Setup tracing
    trace_provider = TracerProvider(resource=resource)
    trace_exporter = OTLPSpanExporter(
        endpoint=os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "localhost:4317"),
        insecure=True
    )
    trace_provider.add_span_processor(BatchSpanProcessor(trace_exporter))
    trace.set_tracer_provider(trace_provider)

    # Setup metrics
    metric_reader = PeriodicExportingMetricReader(
        exporter=OTLPMetricExporter(
            endpoint=os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "localhost:4317"),
            insecure=True
        ),
        export_interval_millis=1000
    )
    meter_provider = MeterProvider(resource=resource, metric_readers=[metric_reader])
    metrics.set_meter_provider(meter_provider)
```

## OpenLLMetry Integration

### Why OpenLLMetry?

OpenLLMetry provides specialized instrumentation for LLM applications:

1. **Automatic instrumentation** for LLM providers (OpenAI, Anthropic, Cohere, etc.)
2. **Framework support** (LangChain, LlamaIndex, etc.)
3. **Cost tracking** and token usage metrics
4. **Prompt/response capture** with privacy controls
5. **Evaluation metrics** integration

### Implementation

#### For Python Services

```python
# llm_telemetry.py
from traceloop.sdk import Traceloop
from traceloop.sdk.decorators import workflow, task, agent
import os

# Initialize OpenLLMetry
Traceloop.init(
    app_name="untrace-llm-service",
    api_endpoint=os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4318"),
    headers={
        "x-traceloop-api-key": os.getenv("TRACELOOP_API_KEY"),
        "x-traceloop-pii-detection": "true"  # Enable PII detection
    }
)

# Use decorators for custom workflows
@workflow(name="document_processing")
def process_document(doc_id: str):
    # Your LLM workflow here
    pass

@task(name="embedding_generation")
def generate_embeddings(text: str):
    # Embedding logic
    pass

@agent(name="research_agent")
def research_agent(query: str):
    # Agent logic
    pass
```

#### For TypeScript Services

```typescript
// llm-telemetry.ts
import * as traceloop from "@traceloop/node-server-sdk";

// Initialize OpenLLMetry
traceloop.initialize({
  appName: "untrace-llm-service",
  apiEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://localhost:4318",
  disableBatch: false,
  headers: {
    "x-traceloop-api-key": process.env.TRACELOOP_API_KEY,
    "x-traceloop-pii-detection": "true"
  }
});

// Use decorators for workflows
class DocumentProcessor {
  @traceloop.workflow("document_processing")
  async processDocument(docId: string) {
    // Your LLM workflow here
  }

  @traceloop.task("embedding_generation")
  async generateEmbeddings(text: string) {
    // Embedding logic
  }
}
```

## Instrumentation Patterns

### 1. Service-Level Instrumentation

```typescript
// Instrument HTTP endpoints
import { trace, SpanStatusCode } from '@opentelemetry/api';

const tracer = trace.getTracer('untrace-api', '1.0.0');

app.post('/api/trace', async (req, res) => {
  const span = tracer.startSpan('handle_trace_ingestion', {
    attributes: {
      'http.method': req.method,
      'http.url': req.url,
      'trace.source': req.headers['x-trace-source'],
    }
  });

  try {
    const result = await processTrace(req.body);
    span.setStatus({ code: SpanStatusCode.OK });
    res.json(result);
  } catch (error) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message
    });
    span.recordException(error);
    res.status(500).json({ error: error.message });
  } finally {
    span.end();
  }
});
```

### 2. Database Operations

```typescript
// Instrument database queries
async function queryTraces(filters: TraceFilters) {
  const span = tracer.startSpan('db.query_traces', {
    attributes: {
      'db.system': 'postgresql',
      'db.operation': 'SELECT',
      'db.table': 'traces',
    }
  });

  try {
    const result = await db.query('SELECT * FROM traces WHERE ...', filters);
    span.setAttribute('db.rows_affected', result.rowCount);
    return result;
  } finally {
    span.end();
  }
}
```

### 3. LLM Operations

```python
# Instrument LLM calls with detailed attributes
from opentelemetry import trace

tracer = trace.get_tracer("llm_operations")

def analyze_trace_quality(trace_data):
    with tracer.start_as_current_span("analyze_trace_quality") as span:
        span.set_attributes({
            "llm.model": "gpt-4",
            "llm.task": "quality_analysis",
            "trace.id": trace_data["id"],
            "trace.size": len(str(trace_data))
        })

        # LLM call here
        response = llm_client.analyze(trace_data)

        span.set_attributes({
            "llm.prompt_tokens": response.usage.prompt_tokens,
            "llm.completion_tokens": response.usage.completion_tokens,
            "llm.total_tokens": response.usage.total_tokens,
            "llm.estimated_cost": calculate_cost(response.usage)
        })

        return response
```

## Data Collection Strategy

### 1. Sampling Configuration

```yaml
# For high-volume services
processors:
  probabilistic_sampler:
    sampling_percentage: 10  # Sample 10% of traces

  tail_sampling:
    policies:
      - name: errors-policy
        type: status_code
        status_code: {status_codes: [ERROR]}

      - name: slow-traces-policy
        type: latency
        latency: {threshold_ms: 5000}

      - name: llm-traces-policy
        type: string_attribute
        string_attribute: {key: "service.name", values: ["llm-*"]}
```

### 2. Metrics Aggregation

```typescript
// Custom metrics for business logic
const meter = metrics.getMeter('untrace-metrics', '1.0.0');

const traceCounter = meter.createCounter('traces_processed', {
  description: 'Number of traces processed',
  unit: 'traces',
});

const tokenHistogram = meter.createHistogram('llm_tokens_used', {
  description: 'Distribution of tokens used per request',
  unit: 'tokens',
});

// Usage
traceCounter.add(1, {
  'destination': 'langfuse',
  'status': 'success'
});

tokenHistogram.record(usage.total_tokens, {
  'model': 'gpt-4',
  'operation': 'analysis'
});
```

## Privacy and Security

### 1. Data Sanitization

```typescript
// Sanitize sensitive data before sending
class PrivacyProcessor implements SpanProcessor {
  onStart(span: Span): void {
    // Remove sensitive attributes at span creation
  }

  onEnd(span: ReadableSpan): void {
    const attributes = span.attributes;

    // Remove or hash sensitive fields
    if (attributes['user.email']) {
      span.setAttribute('user.email', hash(attributes['user.email']));
    }

    if (attributes['llm.prompt']) {
      span.setAttribute('llm.prompt', '[REDACTED]');
    }
  }
}
```

### 2. Compliance Configuration

```yaml
# GDPR/HIPAA compliant configuration
processors:
  redaction:
    # Remove personally identifiable information
    blocked_values:
      - "\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b"  # Email
      - "\\b(?:\\+?1[-.]?)?\\(?[0-9]{3}\\)?[-.]?[0-9]{3}[-.]?[0-9]{4}\\b"  # Phone
      - "\\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})\\b"  # Credit Card
```

## Performance Considerations

### 1. Overhead Management

- Keep instrumentation lightweight
- Use sampling for high-volume endpoints
- Batch exports to reduce network calls
- Monitor collector resource usage

### 2. Best Practices

```typescript
// DO: Use attributes efficiently
span.setAttributes({
  'user.id': userId,
  'request.size': size,
  'request.type': type
});

// DON'T: Add large payloads as attributes
// span.setAttribute('request.body', largeJsonPayload);

// DO: Use events for large data
span.addEvent('request_received', {
  'summary': 'Large request processed',
  'size_bytes': payload.length
});
```

## Troubleshooting

### Common Issues

1. **No traces appearing**
   - Check collector is running: `curl http://localhost:4318/v1/traces`
   - Verify endpoint configuration
   - Check for network/firewall issues

2. **High memory usage**
   - Reduce batch size
   - Implement sampling
   - Check for span leaks (unclosed spans)

3. **Missing LLM instrumentation**
   - Ensure OpenLLMetry is initialized before LLM libraries
   - Check library compatibility
   - Verify API keys are set

### Debug Mode

```bash
# Enable debug logging
export OTEL_LOG_LEVEL=debug
export TRACELOOP_DEBUG=true

# Use console exporter for testing
export OTEL_TRACES_EXPORTER=console
export OTEL_METRICS_EXPORTER=console
```

### Validation Tools

```bash
# Validate collector config
otelcol validate --config=otel-collector-config.yaml

# Test trace export
curl -X POST http://localhost:4318/v1/traces \
  -H "Content-Type: application/json" \
  -d @sample-trace.json
```

## Next Steps

1. Review the [OpenTelemetry documentation](https://opentelemetry.io/docs/)
2. Explore [OpenLLMetry examples](https://github.com/traceloop/openllmetry)
3. Set up dashboards in your observability platform
4. Configure alerts based on key metrics
5. Implement custom instrumentation for business logic

Remember: Good observability is not just about collecting data, but about collecting the _right_ data that helps you understand and improve your system.