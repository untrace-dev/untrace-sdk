# Untrace Destinations

This package provides integrations for sending trace data to various observability and analytics platforms.

## Supported Destinations

### Langfuse

Langfuse is an open-source LLM engineering platform for observability, metrics, and testing. The integration sends traces to Langfuse's OpenTelemetry endpoint.

#### Configuration

```typescript
import { IntegrationsManager } from '@untrace/destinations';

const manager = new IntegrationsManager({
  langfuse: {
    enabled: true,
    apiKey: 'pk-lf-xxx:sk-lf-xxx', // Your Langfuse API keys
    endpoint: 'https://us.cloud.langfuse.com/api/public/otel', // Optional, defaults to cloud
  },
});
```

#### API Key Format

Langfuse expects API keys in the format `pk-lf-xxx:sk-lf-xxx`. You can get these from your Langfuse dashboard.

#### Endpoints

- **Cloud (EU)**: `https://cloud.langfuse.com/api/public/otel/v1/traces`
- **Cloud (US)**: `https://us.cloud.langfuse.com/api/public/otel/v1/traces`
- **Self-hosted**: `http://localhost:3000/api/public/otel/v1/traces` (Langfuse v3.22.0+)

#### Trace Data Mapping

The integration automatically maps trace data to Langfuse's observation format:

- **Model information**: Extracted from `llm_generation.model` or `openai.model`
- **Input/Output**: Mapped to `langfuse.observation.input` and `langfuse.observation.output`
- **Token usage**: Mapped to `langfuse.observation.usage_details`
- **Model parameters**: Mapped to `langfuse.observation.model.parameters`
- **User context**: Mapped to `langfuse.user.id`
- **Metadata**: Mapped to `langfuse.trace.metadata.*`

### PostHog

PostHog is a product analytics platform. The integration sends LLM generation events to PostHog's LLM analytics feature.

#### Configuration

```typescript
const manager = new IntegrationsManager({
  posthog: {
    enabled: true,
    apiKey: 'your-posthog-api-key',
    host: 'https://app.posthog.com', // Optional, defaults to cloud
  },
});
```

### Webhook

Send traces to any custom webhook endpoint.

#### Configuration

```typescript
const manager = new IntegrationsManager({
  webhook: {
    enabled: true,
    url: 'https://your-webhook-endpoint.com/traces',
    method: 'POST', // Optional, defaults to POST
    headers: { // Optional
      'Authorization': 'Bearer your-token',
    },
    timeout: 30000, // Optional, defaults to 30 seconds
  },
});
```

## Usage

### Basic Usage

```typescript
import { IntegrationsManager } from '@untrace/destinations';

// Initialize with your configuration
const manager = new IntegrationsManager({
  langfuse: {
    enabled: true,
    apiKey: 'pk-lf-xxx:sk-lf-xxx',
  },
  posthog: {
    enabled: true,
    apiKey: 'your-posthog-key',
  },
});

// Capture a trace
await manager.captureTrace({
  traceId: 'trace-123',
  spanId: 'span-456',
  data: {
    llm_generation: {
      model: 'gpt-4',
      provider: 'openai',
      input: [{ role: 'user', content: 'Hello' }],
      output_choices: [{ role: 'assistant', content: 'Hi there!' }],
      input_tokens: 10,
      output_tokens: 5,
      latency: 1.5,
    },
  },
  userId: 'user-123',
  orgId: 'org-456',
  metadata: {
    environment: 'production',
    version: '1.0.0',
  },
  createdAt: new Date(),
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
});

// Capture an error
await manager.captureError(new Error('Something went wrong'), traceData);

// Identify a user
await manager.identifyUser('user-123', {
  name: 'John Doe',
  email: 'john@example.com',
});

// Flush pending events
await manager.flush();
```

### Integration with Untrace API

The destinations are automatically used by the Untrace API when traces are ingested through the `/traces/otlp` endpoint. The API will forward traces to all enabled destinations using the fanout service.

### Fanout Service

The fanout service provides a portable way to process traces through multiple destinations. It can be easily moved to a queue or separate service.

#### Basic Usage

```typescript
import { createTraceFanoutService } from '@untrace/destinations';

const fanoutService = createTraceFanoutService();

// Process a single trace
const result = await fanoutService.processTrace(traceData, {
  orgId: 'org-123',
  projectId: 'project-456',
  userId: 'user-789',
});

// Process multiple traces
const result = await fanoutService.processTraces(traceDataArray, context);
```

#### Queue-Based Processing

The fanout service can be used with various queue systems:

```typescript
import { TraceQueueProcessor } from '@untrace/destinations';

const processor = new TraceQueueProcessor();

// Process a job from the queue
await processor.processJob({
  traceId: 'trace-123',
  orgId: 'org-123',
  projectId: 'project-456',
  apiKeyId: 'api-key-789',
  userId: 'user-123',
});
```

#### AWS SQS Example

```typescript
import { SQSTraceProcessor } from '@untrace/destinations';

const processor = new SQSTraceProcessor();

// Process SQS message
await processor.processSQSMessage({
  Body: JSON.stringify({
    traceId: 'trace-123',
    orgId: 'org-123',
    projectId: 'project-456',
  }),
});
```

#### Worker Pool Example

```typescript
import { WorkerPoolTraceProcessor } from '@untrace/destinations';

const processor = new WorkerPoolTraceProcessor();

// Process jobs with multiple workers
await processor.processWithWorkers(jobs);
```

## Development

### Running Tests

```bash
bun test
```

### Adding a New Destination

1. Create a new file `src/your-destination.ts`
2. Implement the `IntegrationProvider` interface
3. Add the destination to `src/manager.ts`
4. Add configuration type to `src/types.ts`
5. Export from `src/index.ts`
6. Add tests in `src/your-destination.test.ts`

### IntegrationProvider Interface

```typescript
interface IntegrationProvider {
  name: string;
  isEnabled(): boolean;
  captureTrace(trace: TraceData): Promise<void>;
  captureError(error: Error, trace: TraceData): Promise<void>;
  identifyUser(distinctId: string, properties: Record<string, unknown>): Promise<void>;
  flush?(): Promise<void>;
}
```

## License

MIT
