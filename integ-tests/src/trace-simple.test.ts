import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { init } from '@untrace/sdk';
import OpenAI from 'openai';

describe('JS SDK Simple Trace Tests', () => {
  let untrace: ReturnType<typeof init>;
  let openai: OpenAI;

  beforeAll(async () => {
    // Initialize Untrace SDK with test configuration
    untrace = init({
      // biome-ignore lint/style/noNonNullAssertion: This is a valid use of any
      apiKey: process.env.UNTRACE_API_KEY!,
      baseUrl: 'http://localhost:3000',
      debug: true,
      providers: ['openai'],
    });

    // Initialize OpenAI client
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Instrument OpenAI with Untrace
    untrace.instrument('openai', openai);
  });

  afterAll(async () => {
    // Shutdown Untrace SDK
    if (untrace) {
      await untrace.shutdown();
    }
  });

  it('should initialize the SDK correctly', () => {
    expect(untrace).toBeDefined();
    expect(untrace.getTracer()).toBeDefined();
    expect(untrace.getContext()).toBeDefined();
    expect(untrace.getMetrics()).toBeDefined();
  });

  it('should create spans correctly', () => {
    const tracer = untrace.getTracer();
    const span = tracer.startSpan({ name: 'test-span' });

    expect(span).toBeDefined();
    expect(span).toBeInstanceOf(Object);

    span.end();
  });

  it('should use withSpan correctly', async () => {
    const tracer = untrace.getTracer();

    let spanCreated = false;

    await tracer.withSpan({ name: 'test-with-span' }, async (span) => {
      spanCreated = true;
      expect(span).toBeDefined();
      expect(span).toBeInstanceOf(Object);
    });

    expect(spanCreated).toBe(true);
  });

  it('should handle context management', () => {
    const context = untrace.getContext();

    // Test setting and getting workflow context
    const workflowCtx = context.setWorkflow('test-workflow', 'Test Workflow');
    expect(workflowCtx).toBeDefined();

    // Test setting and getting user context
    const userCtx = context.setUser('test-user', { name: 'Test User' });
    expect(userCtx).toBeDefined();

    // Test setting and getting session context
    const sessionCtx = context.setSession('test-session', { type: 'test' });
    expect(sessionCtx).toBeDefined();
  });

  it('should flush traces correctly', async () => {
    const tracer = untrace.getTracer();

    // Create a span
    const span = tracer.startSpan({ name: 'flush-test' });
    span.end();

    // Flush should not throw
    await expect(async () => {
      await untrace.flush();
    }).not.toThrow();
  });

  it('should shutdown correctly', async () => {
    // Shutdown should not throw
    await expect(async () => {
      await untrace.shutdown();
    }).not.toThrow();
  });
});
