# Technical Architecture Document
# Untrace - LLM Trace Forwarding Service

**Version:** 1.0
**Date:** January 2025
**Status:** Draft

---

## 1. System Overview

Untrace is a high-performance, distributed system designed to capture, process, and route LLM trace data to multiple observability platforms. The system is built with scalability, reliability, and low latency as core principles.

### 1.1 Key Design Principles
- **Minimal Latency**: <50ms P95 overhead on LLM calls
- **High Availability**: 99.95% uptime with multi-region deployment
- **Horizontal Scalability**: Handle 100K+ traces/second
- **Data Integrity**: Zero data loss with at-least-once delivery
- **Platform Agnostic**: Support any LLM provider and observability platform

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Client Applications                              │
├─────────────────────┬───────────────────┬───────────────────────────────────┤
│   OpenAI Proxy      │   Native SDKs     │        Webhook Ingestion          │
└──────────┬──────────┴─────────┬─────────┴──────────────┬────────────────────┘
           │                    │                         │
           ▼                    ▼                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Ingestion Layer (ALB)                              │
│  • Rate Limiting  • Authentication  • Request Validation  • Load Balancing   │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          API Gateway Services                                │
├─────────────────────┬───────────────────┬───────────────────────────────────┤
│   Proxy Service     │  Ingestion Service │      Management API               │
└──────────┬──────────┴─────────┬─────────┴──────────────┬────────────────────┘
           │                    │                         │
           ▼                    ▼                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Message Queue (Kafka/Kinesis)                        │
│         • Partitioned by Customer  • 7-day retention  • Multi-AZ             │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Processing Pipeline                                 │
├──────────────┬──────────────┬──────────────┬────────────────────────────────┤
│   Router     │ Transformer  │   Enricher   │        Sampler                 │
└──────┬───────┴──────┬───────┴──────┬───────┴─────────┬──────────────────────┘
       │              │              │                  │
       ▼              ▼              ▼                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Delivery Pipeline                                    │
├──────────────┬──────────────┬──────────────┬────────────────────────────────┤
│  Destination │   Retry      │  Dead Letter │     Monitoring                 │
│  Connectors  │   Manager    │    Queue     │      & Alerts                  │
└──────────────┴──────────────┴──────────────┴────────────────────────────────┘
```

---

## 3. Component Architecture

### 3.1 Ingestion Components

#### 3.1.1 OpenAI Proxy Service
```typescript
interface ProxyConfig {
  upstreamUrl: string;
  timeout: Duration;
  retries: number;
  circuitBreaker: CircuitBreakerConfig;
}

class OpenAIProxy {
  // Transparent proxy with trace capture
  async handleRequest(req: Request): Promise<Response> {
    const traceId = generateTraceId();
    const startTime = Date.now();

    try {
      // Forward to OpenAI
      const response = await this.forwardRequest(req);

      // Async trace capture (non-blocking)
      this.captureTrace({
        traceId,
        request: sanitizeRequest(req),
        response: sanitizeResponse(response),
        latency: Date.now() - startTime,
        metadata: extractMetadata(req)
      });

      return response;
    } catch (error) {
      this.captureError(traceId, error);
      throw error;
    }
  }
}
```

#### 3.1.2 SDK Architecture
```python
# Python SDK Example
class Untrace:
    def __init__(self, api_key: str, config: Config = None):
        self.api_key = api_key
        self.config = config or Config()
        self.queue = AsyncQueue(max_size=1000)
        self.worker = BackgroundWorker(self.queue)

    def trace(self, event: TraceEvent):
        """Non-blocking trace submission"""
        if self.queue.full():
            # Apply backpressure
            self.queue.evict_oldest()

        self.queue.put_nowait(event)

    @contextmanager
    def span(self, name: str, **kwargs):
        """Context manager for automatic tracing"""
        span = Span(name, **kwargs)
        span.start()
        try:
            yield span
        finally:
            span.end()
            self.trace(span.to_event())
```

### 3.2 Message Queue Architecture

#### 3.2.1 Kafka Configuration
```yaml
kafka:
  topics:
    traces:
      partitions: 100
      replication_factor: 3
      retention_ms: 604800000  # 7 days
      compression_type: snappy
      max_message_bytes: 1048576  # 1MB

  producers:
    acks: 1  # Leader acknowledgment
    compression_type: snappy
    batch_size: 16384
    linger_ms: 10

  consumers:
    group_id: trace-processor-${region}
    enable_auto_commit: false
    max_poll_records: 500
    session_timeout_ms: 30000
```

#### 3.2.2 Partitioning Strategy
```typescript
function getPartition(trace: Trace): number {
  // Partition by customer for ordering guarantees
  const customerId = trace.metadata.customerId;
  return hashCode(customerId) % NUM_PARTITIONS;
}
```

### 3.3 Processing Pipeline

#### 3.3.1 Router Engine
```typescript
interface RoutingRule {
  id: string;
  priority: number;
  conditions: Condition[];
  destinations: Destination[];
  sampling?: SamplingConfig;
}

class RouterEngine {
  private rules: RoutingRule[];
  private ruleEngine: RuleEngine;

  async route(trace: Trace): Promise<RoutingDecision[]> {
    // Evaluate rules in priority order
    const applicableRules = await this.ruleEngine.evaluate(trace, this.rules);

    const decisions: RoutingDecision[] = [];
    for (const rule of applicableRules) {
      // Apply sampling if configured
      if (rule.sampling && !this.shouldSample(trace, rule.sampling)) {
        continue;
      }

      decisions.push({
        destinations: rule.destinations,
        transformations: rule.transformations,
        priority: rule.priority
      });
    }

    return decisions;
  }
}
```

#### 3.3.2 Transformation Pipeline
```typescript
interface Transformer {
  name: string;
  transform(trace: Trace): Promise<Trace>;
}

class TransformationPipeline {
  private transformers: Map<string, Transformer>;

  async execute(trace: Trace, transformations: string[]): Promise<Trace> {
    let result = trace;

    for (const name of transformations) {
      const transformer = this.transformers.get(name);
      if (!transformer) {
        throw new Error(`Unknown transformer: ${name}`);
      }

      result = await transformer.transform(result);
    }

    return result;
  }
}

// Example transformers
class PIIRedactionTransformer implements Transformer {
  async transform(trace: Trace): Promise<Trace> {
    return {
      ...trace,
      request: redactPII(trace.request),
      response: redactPII(trace.response)
    };
  }
}
```

### 3.4 Destination Connectors

#### 3.4.1 Connector Interface
```typescript
interface DestinationConnector {
  name: string;

  // Validate configuration
  validateConfig(config: any): Promise<void>;

  // Send single trace
  send(trace: Trace, config: any): Promise<void>;

  // Batch send for efficiency
  sendBatch(traces: Trace[], config: any): Promise<BatchResult>;

  // Health check
  healthCheck(config: any): Promise<HealthStatus>;
}
```

#### 3.4.2 Example: LangSmith Connector
```typescript
class LangSmithConnector implements DestinationConnector {
  name = 'langsmith';

  async send(trace: Trace, config: LangSmithConfig): Promise<void> {
    const langsmithFormat = this.transformToLangSmithFormat(trace);

    const response = await fetch(`${config.apiUrl}/runs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(langsmithFormat)
    });

    if (!response.ok) {
      throw new DestinationError(
        `LangSmith error: ${response.status}`,
        response.status >= 500 // Retryable
      );
    }
  }

  private transformToLangSmithFormat(trace: Trace): LangSmithRun {
    return {
      id: trace.id,
      name: trace.name,
      run_type: 'llm',
      inputs: trace.request,
      outputs: trace.response,
      start_time: trace.startTime,
      end_time: trace.endTime,
      extra: {
        metadata: trace.metadata,
        metrics: trace.metrics
      }
    };
  }
}
```

### 3.5 Delivery & Reliability

#### 3.5.1 Retry Strategy
```typescript
class RetryManager {
  private retryQueue: PriorityQueue<RetryItem>;

  async scheduleRetry(
    trace: Trace,
    destination: Destination,
    attempt: number,
    error: Error
  ): Promise<void> {
    const delay = this.calculateBackoff(attempt);
    const priority = this.calculatePriority(trace, attempt);

    await this.retryQueue.push({
      trace,
      destination,
      attempt: attempt + 1,
      scheduledTime: Date.now() + delay,
      priority,
      error
    });
  }

  private calculateBackoff(attempt: number): number {
    // Exponential backoff with jitter
    const base = Math.min(1000 * Math.pow(2, attempt), 300000); // Max 5 min
    const jitter = Math.random() * base * 0.1;
    return base + jitter;
  }
}
```

#### 3.5.2 Circuit Breaker
```typescript
class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failures: number = 0;
  private lastFailureTime: number = 0;

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.config.resetTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new CircuitOpenError();
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
}
```

---

## 4. Data Models

### 4.1 Core Trace Schema
```typescript
interface Trace {
  // Identifiers
  id: string;                    // Unique trace ID
  parentId?: string;            // For nested traces
  sessionId?: string;           // Group related traces

  // Timing
  startTime: number;            // Unix timestamp ms
  endTime: number;

  // LLM Details
  provider: string;             // 'openai', 'anthropic', etc.
  model: string;                // 'gpt-4', 'claude-2', etc.

  // Request/Response
  request: {
    messages?: Message[];       // Chat format
    prompt?: string;           // Completion format
    parameters: {
      temperature?: number;
      max_tokens?: number;
      [key: string]: any;
    };
  };

  response: {
    content?: string;
    messages?: Message[];
    usage?: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
    finish_reason?: string;
  };

  // Metadata
  metadata: {
    customerId: string;
    applicationId: string;
    environment: string;
    version: string;
    tags: Record<string, string>;
    [key: string]: any;
  };

  // Metrics
  metrics: {
    latency_ms: number;
    time_to_first_token_ms?: number;
    tokens_per_second?: number;
    estimated_cost?: number;
  };

  // Error handling
  error?: {
    type: string;
    message: string;
    stack?: string;
  };
}
```

### 4.2 Routing Configuration
```typescript
interface RoutingConfig {
  version: string;
  rules: RoutingRule[];
  defaultDestinations: Destination[];
  samplingConfig?: GlobalSamplingConfig;
}

interface RoutingRule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  priority: number;

  conditions: {
    all?: Condition[];     // AND
    any?: Condition[];     // OR
    not?: Condition;       // NOT
  };

  actions: {
    destinations: Destination[];
    transformations?: string[];
    sampling?: SamplingConfig;
    metadata?: Record<string, any>;
  };
}

interface Condition {
  field: string;           // JSONPath to field
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'contains' | 'regex';
  value: any;
}
```

---

## 5. Scalability & Performance

### 5.1 Horizontal Scaling Strategy

```yaml
# Kubernetes HPA Configuration
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: untrace-api
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: untrace-api
  minReplicas: 3
  maxReplicas: 100
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  - type: Pods
    pods:
      metric:
        name: kafka_consumer_lag
      target:
        type: AverageValue
        averageValue: "1000"
```

### 5.2 Performance Optimizations

#### 5.2.1 Connection Pooling
```go
// Go implementation for high-performance HTTP
var httpClient = &http.Client{
    Transport: &http.Transport{
        MaxIdleConns:        100,
        MaxIdleConnsPerHost: 10,
        MaxConnsPerHost:     100,
        IdleConnTimeout:     90 * time.Second,
        DisableCompression:  false,
        DisableKeepAlives:   false,
    },
    Timeout: 30 * time.Second,
}
```

#### 5.2.2 Batch Processing
```typescript
class BatchProcessor {
  private batch: Trace[] = [];
  private timer: NodeJS.Timeout;

  async add(trace: Trace): Promise<void> {
    this.batch.push(trace);

    if (this.batch.length >= this.config.maxBatchSize) {
      await this.flush();
    } else if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.config.maxWaitTime);
    }
  }

  private async flush(): Promise<void> {
    if (this.batch.length === 0) return;

    const traces = this.batch.splice(0);
    clearTimeout(this.timer);
    this.timer = null;

    await this.processBatch(traces);
  }
}
```

---

## 6. Security Architecture

### 6.1 Authentication & Authorization

```typescript
// API Key Structure
interface APIKey {
  id: string;
  key: string;                  // Hashed
  customerId: string;
  permissions: Permission[];
  rateLimit: RateLimit;
  ipWhitelist?: string[];
  expiresAt?: Date;
  metadata: Record<string, any>;
}

// JWT Token for internal services
interface ServiceToken {
  iss: string;                  // Issuer
  sub: string;                  // Service ID
  aud: string[];               // Allowed services
  exp: number;                 // Expiration
  iat: number;                 // Issued at
  permissions: string[];
}
```

### 6.2 Encryption

```yaml
# Encryption Configuration
encryption:
  transit:
    protocol: TLS
    version: "1.3"
    ciphers:
      - TLS_AES_256_GCM_SHA384
      - TLS_CHACHA20_POLY1305_SHA256

  at_rest:
    algorithm: AES-256-GCM
    key_management: AWS_KMS
    key_rotation: 90_days

  field_level:
    sensitive_fields:
      - "request.api_key"
      - "response.api_key"
      - "metadata.user_email"
```

---

## 7. Monitoring & Observability

### 7.1 Metrics

```yaml
# Prometheus Metrics
metrics:
  # API Metrics
  - name: untrace_api_requests_total
    type: counter
    labels: [method, endpoint, status]

  - name: untrace_api_latency_seconds
    type: histogram
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0]
    labels: [method, endpoint]

  # Processing Metrics
  - name: untrace_traces_processed_total
    type: counter
    labels: [customer_id, destination, status]

  - name: untrace_processing_latency_seconds
    type: histogram
    labels: [stage]

  # Destination Metrics
  - name: untrace_destination_requests_total
    type: counter
    labels: [destination, status]

  - name: untrace_destination_latency_seconds
    type: histogram
    labels: [destination]
```

### 7.2 Distributed Tracing

```typescript
// OpenTelemetry Integration
import { trace, context, SpanStatusCode } from '@opentelemetry/api';

const tracer = trace.getTracer('untrace', '1.0.0');

async function processTrace(traceData: Trace): Promise<void> {
  const span = tracer.startSpan('process_trace', {
    attributes: {
      'trace.id': traceData.id,
      'customer.id': traceData.metadata.customerId,
      'llm.model': traceData.model,
      'llm.provider': traceData.provider
    }
  });

  try {
    await context.with(trace.setSpan(context.active(), span), async () => {
      await this.validate(traceData);
      await this.enrich(traceData);
      await this.route(traceData);
    });

    span.setStatus({ code: SpanStatusCode.OK });
  } catch (error) {
    span.recordException(error);
    span.setStatus({ code: SpanStatusCode.ERROR });
    throw error;
  } finally {
    span.end();
  }
}
```

---

## 8. Deployment Architecture

### 8.1 Multi-Region Deployment

```
┌─────────────────────────────────────────────────────────────────┐
│                        Global Load Balancer                       │
│                      (Route 53 + CloudFront)                      │
└───────────────┬─────────────────────┬─────────────────┬─────────┘
                │                     │                 │
    ┌───────────▼──────────┐ ┌───────▼──────────┐ ┌───▼───────────┐
    │    US-EAST-1         │ │    EU-WEST-1     │ │  AP-SOUTH-1   │
    ├──────────────────────┤ ├──────────────────┤ ├───────────────┤
    │ • API Cluster        │ │ • API Cluster    │ │ • API Cluster │
    │ • Kafka Cluster      │ │ • Kafka Cluster  │ │ • Kafka       │
    │ • Processing Pool    │ │ • Processing     │ │ • Processing  │
    │ • RDS Multi-AZ       │ │ • RDS Multi-AZ   │ │ • RDS Multi-AZ│
    └──────────────────────┘ └──────────────────┘ └───────────────┘
```

### 8.2 Kubernetes Configuration

```yaml
# Example Deployment Configuration
apiVersion: apps/v1
kind: Deployment
metadata:
  name: untrace-api
  labels:
    app: untrace
    component: api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: untrace
      component: api
  template:
    metadata:
      labels:
        app: untrace
        component: api
    spec:
      affinity:
        podAntiAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
          - labelSelector:
              matchExpressions:
              - key: app
                operator: In
                values:
                - untrace
            topologyKey: kubernetes.io/hostname
      containers:
      - name: api
        image: untrace/api:v1.0.0
        ports:
        - containerPort: 8080
        env:
        - name: KAFKA_BROKERS
          valueFrom:
            configMapKeyRef:
              name: untrace-config
              key: kafka.brokers
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
```

---

## 9. Disaster Recovery

### 9.1 Backup Strategy

```yaml
backup:
  databases:
    frequency: hourly
    retention: 30_days
    type: incremental
    encryption: true

  kafka_topics:
    frequency: daily
    retention: 7_days
    destination: s3://untrace-backups/kafka/

  configuration:
    frequency: on_change
    versioning: enabled
    destination: s3://untrace-backups/config/
```

### 9.2 Recovery Procedures

```bash
#!/bin/bash
# Disaster Recovery Runbook

# 1. Failover to standby region
aws route53 change-resource-record-sets \
  --hosted-zone-id $ZONE_ID \
  --change-batch file://failover-to-standby.json

# 2. Scale up standby region
kubectl scale deployment untrace-api --replicas=10 -n production

# 3. Restore from backup if needed
./restore-from-backup.sh --timestamp $BACKUP_TIMESTAMP

# 4. Verify health
./health-check-all-services.sh

# 5. Update status page
./update-status-page.sh --status "operational" --message "Failover complete"
```

---

## 10. Development & Testing

### 10.1 Local Development Setup

```yaml
# docker-compose.yml
version: '3.8'
services:
  api:
    build: ./services/api
    ports:
      - "8080:8080"
    environment:
      - KAFKA_BROKERS=kafka:9092
      - REDIS_URL=redis://redis:6379
    depends_on:
      - kafka
      - redis
      - postgres

  kafka:
    image: confluentinc/cp-kafka:latest
    environment:
      - KAFKA_ZOOKEEPER_CONNECT=zookeeper:2181
      - KAFKA_ADVERTISED_LISTENERS=PLAINTEXT://kafka:9092

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  postgres:
    image: postgres:15
    environment:
      - POSTGRES_DB=untrace
      - POSTGRES_USER=untrace
      - POSTGRES_PASSWORD=localdev
    ports:
      - "5432:5432"
```

### 10.2 Testing Strategy

```typescript
// Integration Test Example
describe('Untrace E2E Tests', () => {
  let client: UntraceClient;

  beforeAll(async () => {
    client = new UntraceClient({
      apiKey: process.env.TEST_API_KEY,
      baseUrl: process.env.TEST_API_URL
    });
  });

  test('should route trace to multiple destinations', async () => {
    // Arrange
    const trace = createTestTrace();
    const destinations = ['langsmith', 'langfuse'];

    // Act
    const result = await client.submitTrace(trace);

    // Assert
    expect(result.status).toBe('accepted');

    // Verify delivery to destinations
    for (const dest of destinations) {
      const delivered = await waitForDelivery(trace.id, dest);
      expect(delivered).toBe(true);
    }
  });
});
```

---

## 11. Future Considerations

### 11.1 Planned Enhancements
1. **AI-Powered Routing**: Use ML to optimize routing decisions
2. **Edge Computing**: Deploy trace capture at edge locations
3. **Real-time Analytics**: Stream processing for instant insights
4. **GraphQL API**: Flexible querying for trace data
5. **Plugin System**: Allow custom transformers and destinations

### 11.2 Scaling Projections
- **Year 1**: 1B traces/month, 100 customers
- **Year 2**: 50B traces/month, 1,000 customers
- **Year 3**: 500B traces/month, 10,000 customers

---

**Document Control:**
- Architecture Review Board: Monthly
- Last Updated: January 2025
- Next Review: February 2025