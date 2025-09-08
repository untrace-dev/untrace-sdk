# Untrace SDK Examples

This directory contains examples demonstrating how to use the Untrace LLM Observability SDK with TypeScript decorators.

## Examples

- **basic-decorators.ts** - Simple examples of all available decorators
- **decorators.ts** - Full example with OpenAI integration

## Running the Examples

```bash
# Install dependencies
bun install

# Run basic examples
bun run examples/basic-decorators.ts

# Run OpenAI example (requires OPENAI_API_KEY and UNTRACE_API_KEY)
OPENAI_API_KEY=your-key UNTRACE_API_KEY=your-key bun run examples/decorators.ts
```

## TypeScript Configuration

To use decorators, ensure your `tsconfig.json` includes:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "target": "ES2022",
    "module": "commonjs"
  }
}
```

## Available Decorators

### @trace
Automatically creates OpenTelemetry spans for methods:

```typescript
@trace({ name: 'customName', attributes: { key: 'value' } })
async myMethod() {
  // Your code
}
```

### @metric
Records metrics like latency:

```typescript
@metric({ recordDuration: true })
async processData() {
  // Your code
}
```

### @llmOperation
Specialized for LLM operations with automatic token and cost tracking:

```typescript
@llmOperation({
  type: 'chat',
  model: 'gpt-4',
  provider: 'openai',
  extractTokenUsage: (result) => ({
    promptTokens: result.usage.prompt_tokens,
    completionTokens: result.usage.completion_tokens,
    totalTokens: result.usage.total_tokens,
    model: 'gpt-4',
    provider: 'openai'
  })
})
async chat(messages: Message[]) {
  // LLM API call
}
```

### @errorHandler
Automatically records errors:

```typescript
@errorHandler({ rethrow: true })
async riskyOperation() {
  // Code that might throw
}
```

### @cached
Cache method results:

```typescript
@cached({ ttl: 60000 }) // Cache for 1 minute
async expensiveOperation() {
  // Expensive computation
}
```

### @timed
Simple timing for debugging:

```typescript
@timed('OperationName')
async slowOperation() {
  // Code to time
}
```

## Multiple Decorators

You can stack multiple decorators:

```typescript
@metric({ recordDuration: true })
@trace({ name: 'processRequest' })
@cached({ ttl: 10000 })
async processRequest(data: any) {
  // Your code
}
```

## Known Issues

Some TypeScript configurations may show linting warnings for decorators. These can typically be ignored as the decorators will work correctly at runtime. If you encounter issues:

1. Ensure you're using TypeScript 5.0+
2. Try using `"module": "commonjs"` in your tsconfig
3. Use `// @ts-ignore` above problematic decorators if needed

## Custom Decorators

You can create your own decorators by using the Untrace SDK API:

```typescript
function myCustomDecorator() {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const untrace = getUntrace();
      const tracer = untrace.getTracer();

      return tracer.withSpan(
        { name: `custom.${propertyKey}` },
        async () => {
          return await originalMethod.apply(this, args);
        }
      );
    };

    return descriptor;
  };
}
```