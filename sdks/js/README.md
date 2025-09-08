# Untrace LLM Observability SDK

A powerful, zero-latency observability SDK for JavaScript/TypeScript that allows you to instrument once and capture traces across all major LLM providers. Built on OpenTelemetry standards and inspired by AWS Powertools.

## Features

- 🚀 **Zero-latency instrumentation** - Minimal performance overhead
- 🔌 **Auto-instrumentation** for all major LLM providers
- 📊 **Comprehensive metrics** - Token usage, costs, latency, and errors
- 🔍 **OpenTelemetry compliant** - Industry-standard observability
- 🎯 **Provider-agnostic** - Works with OpenAI, Anthropic, AI SDK, Cohere, LangChain, and more
- 🛠️ **Flexible instrumentation** - Both automatic and manual options
- 🔄 **Workflow tracking** - Track complex LLM workflows and chains
- 💰 **Cost tracking** - Automatic cost calculation for supported models
- 🎨 **Decorator support** - Clean, declarative instrumentation with TypeScript decorators

## Decorator Support

The SDK provides powerful decorators for clean, declarative instrumentation:

### @trace
Automatically creates spans for methods:

```typescript
class MyService {
  @trace({ name: 'fetchUserData', attributes: { 'user.type': 'admin' } })
  async getUser(id: string) {
    // Method implementation
  }
}
```

### @metric
Records metrics like latency automatically:

```typescript
class APIService {
  @metric({ recordDuration: true })
  async processRequest(data: any) {
    // Method implementation
  }
}
```

### @llmOperation
Specialized decorator for LLM operations with automatic token and cost tracking:

```typescript
class OpenAIService {
  @llmOperation({
    type: 'chat',
    model: 'gpt-4',
    provider: 'openai',
    extractTokenUsage: (result) => ({
      promptTokens: result.usage.prompt_tokens,
      completionTokens: result.usage.completion_tokens,
      totalTokens: result.usage.total_tokens,
    })
  })
  async chat(messages: Message[]) {
    // OpenAI API call
  }
}
```

### @errorHandler
Automatically records errors:

```typescript
class DataService {
  @errorHandler({ rethrow: true })
  async riskyOperation() {
    // Method that might throw
  }
}
```

### @cached
Cache method results with TTL:

```typescript
class ComputationService {
  @cached({ ttl: 60000 }) // Cache for 1 minute
  async expensiveComputation(input: string) {
    // Expensive operation
  }
}
```

### @timed
Simple timing decorator for debugging:

```typescript
class DebugService {
  @timed('MyOperation')
  async slowOperation() {
    // Method implementation
  }
}
```

To enable decorators, ensure your `tsconfig.json` has:
```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

## Installation

```bash
npm install @untrace/sdk
# or
yarn add @untrace/sdk
# or
pnpm add @untrace/sdk
# or
bun add @untrace/sdk
```

## Quick Start

### Basic Setup

```typescript
import { init } from '@untrace/sdk';

// Initialize the SDK
const untrace = init({
  apiKey: 'your-api-key',
  serviceName: 'my-llm-app',
  environment: 'production',
});

// Your LLM code is automatically instrumented!
import OpenAI from 'openai';

const openai = new OpenAI();
const response = await openai.chat.completions.create({
  model: 'gpt-3.5-turbo',
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

### Manual Instrumentation

```typescript
// For providers loaded before SDK initialization
import OpenAI from 'openai';
import { init } from '@untrace/sdk';

const openai = new OpenAI();
const untrace = init({ apiKey: 'your-api-key' });

// Manually instrument the client
const instrumentedOpenAI = untrace.instrument('openai', openai);
```

## Supported Providers

### AI/LLM Providers
- ✅ OpenAI
- ✅ Anthropic (Claude)
- ✅ Vercel AI SDK
- ✅ Cohere
- ✅ Mistral
- ✅ AWS Bedrock
- ✅ Google Vertex AI
- ✅ Azure OpenAI
- ✅ Together.ai
- ✅ Fireworks
- ✅ DeepInfra
- ✅ DeepSeek
- ✅ Cerebras
- ✅ Groq
- ✅ Perplexity

### Audio Providers
- ✅ ElevenLabs
- ✅ LMNT
- ✅ Hume
- ✅ Rev.ai
- ✅ Deepgram
- ✅ Gladia
- ✅ AssemblyAI

### Framework Support
- ✅ LangChain
- ✅ LlamaIndex

## Advanced Usage

### Custom Span Creation

```typescript
const tracer = untrace.getTracer();

// Create custom spans for your LLM workflows
const span = tracer.startLLMSpan('my-rag-pipeline', {
  provider: 'custom',
  model: 'my-model',
  operation: 'chat',
});

try {
  // Your custom LLM logic here
  const result = await myCustomLLMCall();

  // Add custom attributes
  span.setAttribute('custom.metric', 42);
  span.setAttribute('llm.prompt.tokens', 100);

  span.end();
} catch (error) {
  span.recordException(error);
  span.end();
  throw error;
}
```

### Workflow Tracking

```typescript
const context = untrace.getContext();

// Start a workflow
context.startWorkflow('customer-support-chat', {
  userId: 'user-123',
  sessionId: 'session-456',
  metadata: { tier: 'premium' },
});

// Your LLM calls are automatically associated with this workflow
await openai.chat.completions.create({
  model: 'gpt-4',
  messages: messages,
});

// End the workflow
context.endWorkflow();
```

### Metrics Collection

```typescript
const metrics = untrace.getMetrics();

// Record custom metrics
metrics.recordTokenUsage({
  promptTokens: 150,
  completionTokens: 50,
  totalTokens: 200,
  model: 'gpt-3.5-turbo',
  provider: 'openai',
});

metrics.recordLatency(1234, {
  provider: 'openai',
  operation: 'chat',
});

metrics.recordCost({
  prompt: 0.0015,
  completion: 0.002,
  total: 0.0035,
  model: 'gpt-4',
  provider: 'openai',
});
```

## Configuration Options

```typescript
interface UntraceConfig {
  // Required
  apiKey: string;                    // Your Untrace API key

  // Optional
  serviceName?: string;              // Default: 'untrace-app'
  environment?: string;              // Default: 'production'
  version?: string;                  // Your app version
  baseUrl?: string;                  // Custom ingestion endpoint

  // Behavior
  debug?: boolean;                   // Enable debug logging
  disableAutoInstrumentation?: boolean; // Disable auto-instrumentation
  captureBody?: boolean;             // Capture request/response bodies
  captureErrors?: boolean;           // Capture and report errors

  // Performance
  samplingRate?: number;             // 0.0 to 1.0 (default: 1.0)
  maxBatchSize?: number;             // Max spans per batch (default: 512)
  exportIntervalMs?: number;         // Export interval (default: 5000ms)

  // Providers
  providers?: string[];              // Specific providers to instrument
                                    // Use ['all'] to instrument everything

  // Advanced
  headers?: Record<string, string>;  // Custom headers for requests
  resourceAttributes?: Attributes;   // Additional resource attributes
  spanProcessors?: SpanProcessor[];  // Custom span processors
}
```

## Manual Provider Instrumentation

If you need more control over instrumentation:

```typescript
// Selectively instrument providers
const untrace = init({
  apiKey: 'your-api-key',
  providers: ['openai', 'anthropic'], // Only these will be auto-instrumented
});

// Or disable auto-instrumentation completely
const untrace = init({
  apiKey: 'your-api-key',
  disableAutoInstrumentation: true,
});

// Then manually instrument as needed
const openai = untrace.instrument('openai', new OpenAI());
const anthropic = untrace.instrument('anthropic', new Anthropic());
```

## Best Practices

1. **Initialize early**: Call `init()` as early as possible in your application lifecycle
2. **Use workflows**: Group related LLM calls using workflow tracking
3. **Add metadata**: Include relevant metadata for better observability
4. **Handle errors**: The SDK automatically captures errors, but add context when possible
5. **Monitor costs**: Use the cost tracking features to monitor spending
6. **Sample wisely**: Adjust sampling rate for high-volume production apps

## Environment Variables

The SDK respects these environment variables:

- `UNTRACE_API_KEY` - API key (overrides config)
- `UNTRACE_BASE_URL` - Base URL for ingestion
- `UNTRACE_DEBUG` - Enable debug mode
- `OTEL_SERVICE_NAME` - Service name (OpenTelemetry standard)
- `OTEL_RESOURCE_ATTRIBUTES` - Additional resource attributes

## Examples

### Next.js App Router

```typescript
// app/providers.tsx
import { init } from '@untrace/sdk';

export function initObservability() {
  if (typeof window === 'undefined') {
    // Server-side only
    init({
      apiKey: process.env.UNTRACE_API_KEY!,
      serviceName: 'my-nextjs-app',
      environment: process.env.NODE_ENV,
    });
  }
}

// Call in your root layout
initObservability();
```

### Express.js API

```typescript
import express from 'express';
import { init } from '@untrace/sdk';

// Initialize before other imports
const untrace = init({
  apiKey: process.env.UNTRACE_API_KEY!,
  serviceName: 'my-api',
});

import OpenAI from 'openai'; // Auto-instrumented

const app = express();
const openai = new OpenAI();

app.post('/chat', async (req, res) => {
  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: req.body.messages,
  });

  res.json(response);
});
```

### LangChain Integration

```typescript
import { init } from '@untrace/sdk';
import { ChatOpenAI } from 'langchain/chat_models/openai';
import { ConversationChain } from 'langchain/chains';

const untrace = init({ apiKey: 'your-api-key' });

// LangChain is automatically instrumented
const chat = new ChatOpenAI({ temperature: 0 });
const chain = new ConversationChain({ llm: chat });

const response = await chain.invoke({
  input: 'What is the meaning of life?',
});
```

## Troubleshooting

### No traces appearing?

1. Check your API key is correct
2. Ensure SDK is initialized before importing LLM libraries
3. Check `debug: true` mode for any errors
4. Verify network connectivity to Untrace servers

### High latency?

1. Adjust `maxBatchSize` and `exportIntervalMs`
2. Use sampling for high-volume applications
3. Check network latency to ingestion endpoint

### Missing provider instrumentation?

1. Ensure the provider is in the supported list
2. Try manual instrumentation
3. Check that the provider module structure matches expected format

## License

MIT

## Contributing

Contributions are welcome! Please see our [Contributing Guide](../../CONTRIBUTING.md) for details.

## Support

- Documentation: [https://docs.untrace.dev](https://docs.untrace.dev)
- Issues: [GitHub Issues](https://github.com/untrace-dev/untrace/issues)
- Discord: [Join our community](https://discord.gg/untrace)