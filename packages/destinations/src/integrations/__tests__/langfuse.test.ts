import { beforeEach, describe, expect, it } from 'bun:test';
import type { TraceType } from '@untrace/db/schema';
import { LangfuseIntegration } from '../langfuse';

describe('LangfuseIntegration', () => {
  let integration: LangfuseIntegration;

  beforeEach(() => {
    integration = new LangfuseIntegration({
      apiKey: 'pk-lf-test:sk-lf-test',
      enabled: true,
      endpoint: 'https://us.cloud.langfuse.com/api/public/otel',
    });
  });

  describe('constructor', () => {
    it('should initialize with correct name', () => {
      expect(integration.name).toBe('langfuse');
    });

    it('should be enabled when config is valid', () => {
      expect(integration.isEnabled()).toBe(true);
    });

    it('should be disabled when apiKey is missing', () => {
      const disabledIntegration = new LangfuseIntegration({
        enabled: true,
        endpoint: 'https://us.cloud.langfuse.com/api/public/otel',
      });
      expect(disabledIntegration.isEnabled()).toBe(false);
    });

    it('should be disabled when enabled is false', () => {
      const disabledIntegration = new LangfuseIntegration({
        apiKey: 'pk-lf-test:sk-lf-test',
        enabled: false,
        endpoint: 'https://us.cloud.langfuse.com/api/public/otel',
      });
      expect(disabledIntegration.isEnabled()).toBe(false);
    });
  });

  describe('captureTrace', () => {
    it('should not throw when processing trace data', async () => {
      const mockTrace: TraceType = {
        apiKeyId: null,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        data: {
          llm_generation: {
            input: [{ content: 'Hello', role: 'user' }],
            input_tokens: 10,
            latency: 1.5,
            max_tokens: 100,
            model: 'gpt-4',
            output_choices: [{ content: 'Hi there!', role: 'assistant' }],
            output_tokens: 5,
            provider: 'openai',
            span_name: 'test_generation',
            temperature: 0.7,
          },
        },
        expiresAt: new Date('2024-02-01T00:00:00Z'),
        id: 'test-trace-id',
        metadata: {
          environment: 'test',
          version: '1.0.0',
        },
        orgId: 'test-org',
        parentSpanId: 'test-parent-span-id',
        projectId: 'test-project',
        spanId: 'test-span-id',
        traceId: 'test-trace-id',
        updatedAt: null,
        userId: 'test-user',
      };

      // Should not throw
      await expect(
        integration.captureTrace(mockTrace),
      ).resolves.toBeUndefined();
    });

    it('should handle errors gracefully', async () => {
      const mockTrace: TraceType = {
        apiKeyId: null,
        createdAt: new Date(),
        data: {},
        expiresAt: new Date(),
        id: 'test-trace-id',
        metadata: {},
        orgId: 'test-org',
        parentSpanId: null,
        projectId: 'test-project',
        spanId: null,
        traceId: 'test-trace-id',
        updatedAt: null,
        userId: null,
      };

      // Should not throw even with network errors
      await expect(
        integration.captureTrace(mockTrace),
      ).resolves.toBeUndefined();
    });
  });

  describe('captureError', () => {
    it('should not throw when processing error', async () => {
      const error = new Error('Test error');
      const mockTrace: TraceType = {
        apiKeyId: null,
        createdAt: new Date(),
        data: {},
        expiresAt: new Date(),
        id: 'test-trace-id',
        metadata: {},
        orgId: 'test-org',
        parentSpanId: null,
        projectId: 'test-project',
        spanId: null,
        traceId: 'test-trace-id',
        updatedAt: null,
        userId: null,
      };

      // Should not throw
      await expect(
        integration.captureError(error, mockTrace),
      ).resolves.toBeUndefined();
    });
  });

  describe('identifyUser', () => {
    it('should not throw when identifying user', async () => {
      // Should not throw
      await expect(
        integration.identifyUser('test-user', { name: 'Test User' }),
      ).resolves.toBeUndefined();
    });
  });

  describe('flush', () => {
    it('should complete without error', async () => {
      await expect(integration.flush()).resolves.toBeUndefined();
    });
  });
});
