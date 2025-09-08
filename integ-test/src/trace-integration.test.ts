import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { init } from '@untrace/sdk';

describe('JS SDK Full Integration Tests', () => {
  let untrace: ReturnType<typeof init>;

  beforeAll(async () => {
    // Initialize Untrace SDK with test configuration
    untrace = init({
      apiKey: 'test-api-key',
      baseUrl: 'http://localhost:3000/api',
      debug: true,
      disableAutoInstrumentation: false,
      exportIntervalMs: 1000, // Faster export for testing
      providers: ['openai'],
    });
  });

  afterAll(async () => {
    // Shutdown Untrace SDK
    if (untrace) {
      await untrace.shutdown();
    }
  });

  it('should initialize SDK with all components', () => {
    expect(untrace).toBeDefined();
    expect(untrace.getTracer()).toBeDefined();
    expect(untrace.getContext()).toBeDefined();
    expect(untrace.getMetrics()).toBeDefined();
  });

  it('should create and manage spans correctly', async () => {
    const tracer = untrace.getTracer();

    // Test basic span creation
    const span = tracer.startSpan({ name: 'test-span' });
    expect(span).toBeDefined();
    span.end();

    // Test withSpan functionality
    let spanExecuted = false;
    await tracer.withSpan({ name: 'test-with-span' }, async (span) => {
      spanExecuted = true;
      expect(span).toBeDefined();
    });
    expect(spanExecuted).toBe(true);
  });

  it('should handle context management', () => {
    const context = untrace.getContext();

    // Test workflow context
    const workflowCtx = context.setWorkflow('test-workflow', 'Test Workflow');
    expect(workflowCtx).toBeDefined();

    // Test user context
    const userCtx = context.setUser('test-user', { name: 'Test User' });
    expect(userCtx).toBeDefined();

    // Test session context
    const sessionCtx = context.setSession('test-session', { type: 'test' });
    expect(sessionCtx).toBeDefined();

    // Test metadata
    const metadataCtx = context.setMetadata({ test: 'value' });
    expect(metadataCtx).toBeDefined();
  });

  it('should handle multiple concurrent spans', async () => {
    const tracer = untrace.getTracer();

    // Create multiple spans concurrently
    const spanPromises = Array.from({ length: 5 }, (_, i) =>
      tracer.withSpan({ name: `concurrent-span-${i}` }, async (span) => {
        expect(span).toBeDefined();
        return i;
      }),
    );

    const results = await Promise.all(spanPromises);
    expect(results).toEqual([0, 1, 2, 3, 4]);
  });

  it('should handle nested spans', async () => {
    const tracer = untrace.getTracer();

    await tracer.withSpan({ name: 'parent-span' }, async (parentSpan) => {
      expect(parentSpan).toBeDefined();

      await tracer.withSpan(
        { name: 'child-span', parent: parentSpan },
        async (childSpan) => {
          expect(childSpan).toBeDefined();
        },
      );
    });
  });

  it('should flush traces correctly', async () => {
    const tracer = untrace.getTracer();

    // Create some spans
    await tracer.withSpan({ name: 'flush-test-1' }, async () => {
      // Do nothing, just create span
    });

    await tracer.withSpan({ name: 'flush-test-2' }, async () => {
      // Do nothing, just create span
    });

    // Flush should not throw
    await expect(async () => {
      await untrace.flush();
    }).not.toThrow();
  });

  it('should handle different span types', () => {
    const tracer = untrace.getTracer();

    // Test LLM span
    const llmSpan = tracer.startLLMSpan('test-llm', {
      'llm.model': 'gpt-3.5-turbo',
      'llm.provider': 'openai',
    });
    expect(llmSpan).toBeDefined();
    llmSpan.end();

    // Test workflow span
    const workflowSpan = tracer.startWorkflowSpan('test-workflow');
    expect(workflowSpan).toBeDefined();
    workflowSpan.end();

    // Test tool span
    const toolSpan = tracer.startToolSpan('test-tool');
    expect(toolSpan).toBeDefined();
    toolSpan.end();
  });

  it('should handle metrics', () => {
    const metrics = untrace.getMetrics();
    expect(metrics).toBeDefined();

    // Test basic metrics functionality
    expect(metrics.recordTokenUsage).toBeDefined();
    expect(metrics.recordLatency).toBeDefined();
    expect(metrics.recordError).toBeDefined();
    expect(metrics.recordCost).toBeDefined();
  });

  it('should shutdown gracefully', async () => {
    // Shutdown should not throw
    await expect(async () => {
      await untrace.shutdown();
    }).not.toThrow();
  });
});
