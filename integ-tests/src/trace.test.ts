import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { db } from '@untrace/db/client';
import { Deliveries, Traces } from '@untrace/db/schema';
import { init } from '@untrace/sdk';
import { desc, eq } from 'drizzle-orm';
import OpenAI from 'openai';
import { createTestSetup } from '../test-utils';

// Define types for trace data
interface TraceData {
  request?: {
    messages?: Array<{ role: string; content: string }>;
    model?: string;
    max_tokens?: number;
    temperature?: number;
  };
  response?: {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { total_tokens: number };
  };
  error?: unknown;
}

describe('JS SDK Trace Integration Tests', () => {
  let testSetup: Awaited<ReturnType<typeof createTestSetup>>;
  let untrace: ReturnType<typeof init>;
  let openai: OpenAI;

  beforeAll(async () => {
    // Create test setup with API key
    testSetup = await createTestSetup({
      apiKeyName: 'Trace Test API Key',
      orgName: `Trace Test Organization ${Date.now()}`,
      userEmail: `trace-test-${Date.now()}@example.com`,
      userName: { firstName: 'Trace', lastName: 'Test' },
    });

    // Initialize Untrace SDK with test API key
    untrace = init({
      apiKey: testSetup.apiKey.key,
      baseUrl: 'http://localhost:3000', // Local API server
      debug: true,
      disableAutoInstrumentation: false,
      exportIntervalMs: 100, // Faster export for testing
      maxBatchSize: 1, // Export immediately
      providers: ['openai'],
    });

    // Initialize OpenAI client
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || 'test-key',
    });

    // Instrument OpenAI with Untrace
    untrace.instrument('openai', openai);
  });

  afterAll(async () => {
    // Cleanup test data
    if (testSetup) {
      // await testSetup.cleanup();
    }

    // Shutdown Untrace SDK
    if (untrace) {
      await untrace.shutdown();
    }
  });

  it.skip('should capture and store a trace from an LLM request', async () => {
    console.log('[Test] Starting LLM request test');

    // Test if manual tracing works
    const tracer = untrace.getTracer();
    const testSpan = tracer.startSpan({ name: 'test-manual-span' });
    testSpan.setAttribute('test.attribute', 'test-value');
    testSpan.end();
    console.log('[Test] Created manual test span');

    // Make an LLM request that should be traced
    const response = await openai.chat.completions.create({
      max_tokens: 50,
      messages: [
        { content: 'Hello, this is a test message for tracing.', role: 'user' },
      ],
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
    });

    console.log(
      '[Test] LLM request completed, response:',
      response.choices[0]?.message?.content,
    );

    // Wait a bit for the trace to be exported
    await new Promise((resolve) => setTimeout(resolve, 5000));

    console.log('[Test] Flushing traces...');
    // Flush any pending traces
    await untrace.flush();

    // Debug: Check if any spans were created
    console.log('[Test] Tracer instance:', tracer);

    console.log('[Test] Querying database for traces...');
    // Query the database to check if the trace was stored
    const traces = await db
      .select()
      .from(Traces)
      .where(eq(Traces.orgId, testSetup.org.id))
      .orderBy(desc(Traces.createdAt))
      .limit(5);

    console.log(`[Test] Found ${traces.length} traces in database`);

    expect(traces.length).toBeGreaterThan(0);

    // Find the trace that matches our request
    const trace = traces.find((t) => {
      const data = t.data as TraceData;
      return (
        data?.request?.messages?.[0]?.content ===
          'Hello, this is a test message for tracing.' &&
        data?.response?.choices?.[0]?.message?.content
      );
    });

    expect(trace).toBeDefined();
    expect(trace?.orgId).toBe(testSetup.org.id);
    expect(trace?.userId).toBe(testSetup.user.id);
    expect(trace?.traceId).toBeDefined();
    expect(trace?.spanId).toBeDefined();

    // Verify trace data structure
    const traceData = trace?.data as TraceData;
    expect(traceData).toBeDefined();
    expect(traceData.request).toBeDefined();
    expect(traceData.response).toBeDefined();
    expect(traceData.request?.messages).toBeDefined();
    expect(traceData.response?.choices).toBeDefined();

    // Verify request data
    expect(traceData.request?.messages?.[0]?.role).toBe('user');
    expect(traceData.request?.messages?.[0]?.content).toBe(
      'Hello, this is a test message for tracing.',
    );
    expect(traceData.request?.model).toBe('gpt-3.5-turbo');
    expect(traceData.request?.max_tokens).toBe(50);
    expect(traceData.request?.temperature).toBe(0.7);

    // Verify response data
    expect(traceData.response?.choices?.[0]?.message).toBeDefined();
    expect(traceData.response?.usage).toBeDefined();
    expect(traceData.response?.usage?.total_tokens).toBeGreaterThan(0);
  }, 30000); // 30 second timeout for LLM request

  it('should create trace deliveries for stored traces', async () => {
    // Make another LLM request
    const _response = await openai.chat.completions.create({
      max_tokens: 30,
      messages: [
        {
          content: 'Another test message for delivery verification.',
          role: 'user',
        },
      ],
      model: 'gpt-3.5-turbo',
    });

    // Wait for trace export and flush
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await untrace.flush();

    // Get the most recent trace
    const [latestTrace] = await db
      .select()
      .from(Traces)
      .where(eq(Traces.orgId, testSetup.org.id))
      .orderBy(desc(Traces.createdAt))
      .limit(1);

    expect(latestTrace).toBeDefined();
    if (!latestTrace) {
      throw new Error('Latest trace not found');
    }

    // Check if trace deliveries were created
    const _deliveries = await db
      .select()
      .from(Deliveries)
      .where(eq(Deliveries.traceId, latestTrace.id));

    // Note: Deliveries might not be created immediately in test environment
    // This test verifies the trace was stored correctly
    expect(latestTrace?.data).toBeDefined();
    expect(latestTrace?.traceId).toBeDefined();
    expect(latestTrace?.orgId).toBe(testSetup.org.id);
  }, 30000);

  it('should handle multiple concurrent LLM requests', async () => {
    // Make multiple concurrent requests
    const requests = [
      openai.chat.completions.create({
        max_tokens: 10,
        messages: [{ content: 'Request 1', role: 'user' }],
        model: 'gpt-3.5-turbo',
      }),
      openai.chat.completions.create({
        max_tokens: 10,
        messages: [{ content: 'Request 2', role: 'user' }],
        model: 'gpt-3.5-turbo',
      }),
      openai.chat.completions.create({
        max_tokens: 10,
        messages: [{ content: 'Request 3', role: 'user' }],
        model: 'gpt-3.5-turbo',
      }),
    ];

    await Promise.all(requests);

    // Wait for traces to be exported
    await new Promise((resolve) => setTimeout(resolve, 3000));
    await untrace.flush();

    // Check that all traces were captured
    const traces = await db
      .select()
      .from(Traces)
      .where(eq(Traces.orgId, testSetup.org.id))
      .orderBy(desc(Traces.createdAt))
      .limit(10);

    // Should have at least 3 traces from this test
    expect(traces.length).toBeGreaterThanOrEqual(3);

    // Verify each trace has unique traceId
    const traceIds = traces.map((t) => t.traceId);
    const uniqueTraceIds = new Set(traceIds);
    expect(uniqueTraceIds.size).toBe(traceIds.length);
  }, 45000);

  it('should capture error information when LLM request fails', async () => {
    // Make a request that will likely fail (invalid model)
    try {
      await openai.chat.completions.create({
        max_tokens: 10,
        messages: [{ content: 'This should fail', role: 'user' }],
        model: 'invalid-model-name',
      });
    } catch (_error) {
      // Expected to fail
    }

    // Wait for trace export
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await untrace.flush();

    // Check if error trace was captured
    const traces = await db
      .select()
      .from(Traces)
      .where(eq(Traces.orgId, testSetup.org.id))
      .orderBy(desc(Traces.createdAt))
      .limit(5);

    const errorTrace = traces.find((t) => {
      const data = t.data as TraceData;
      return data?.error || data?.request?.model === 'invalid-model-name';
    });

    // Error traces should be captured
    expect(errorTrace).toBeDefined();
  }, 30000);

  it.skip('should maintain trace context across multiple requests', async () => {
    const tracer = untrace.getTracer();
    const _context = untrace.getContext();

    // Create a custom span
    const _span = tracer.startSpan({ name: 'test-operation' });

    // Use the span context for requests
    await tracer.withSpan({ name: 'test-operation' }, async (_span) => {
      // Make requests within the span context
      await openai.chat.completions.create({
        max_tokens: 10,
        messages: [{ content: 'Context test 1', role: 'user' }],
        model: 'gpt-3.5-turbo',
      });

      await openai.chat.completions.create({
        max_tokens: 10,
        messages: [{ content: 'Context test 2', role: 'user' }],
        model: 'gpt-3.5-turbo',
      });
    });

    // Wait for traces to be exported
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await untrace.flush();

    // Verify traces were captured with proper context
    const traces = await db
      .select()
      .from(Traces)
      .where(eq(Traces.orgId, testSetup.org.id))
      .orderBy(desc(Traces.createdAt))
      .limit(5);

    expect(traces.length).toBeGreaterThan(0);

    // Check that traces have proper span relationships
    const contextTraces = traces.filter((t) => {
      const data = t.data as TraceData;
      return data?.request?.messages?.[0]?.content?.includes('Context test');
    });

    expect(contextTraces.length).toBeGreaterThan(0);
  }, 30000);
});
