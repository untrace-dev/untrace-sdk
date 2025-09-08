import type { TraceType } from '@untrace/db/schema';
import type { IntegrationConfig, IntegrationProvider } from '../types';
import { extractLLMDataFromTrace } from '../utils/llm-data-extractor';

interface LLMGenerationData {
  distinctId?: string;
  traceId: string;
  spanId?: string;
  spanName?: string;
  parentId?: string;
  model: string;
  provider: string;
  input: Array<{
    role: string;
    content: Array<{
      type: string;
      text?: string;
      image?: string;
      function?: {
        name: string;
        arguments: Record<string, unknown>;
      };
    }>;
  }>;
  inputTokens: number;
  outputChoices: Array<{
    role: string;
    content: Array<{
      type: string;
      text?: string;
      function?: {
        name: string;
        arguments: Record<string, unknown>;
      };
    }>;
  }>;
  outputTokens: number;
  latency?: number;
  httpStatus?: number;
  baseUrl?: string;
  requestUrl?: string;
  isError?: boolean;
  error?: string | Record<string, unknown>;
  inputCostUsd?: number;
  outputCostUsd?: number;
  totalCostUsd?: number;
  cacheReadInputTokens?: number;
  cacheCreationInputTokens?: number;
  temperature?: number;
  stream?: boolean;
  maxTokens?: number;
  tools?: Array<{
    type: string;
    function: {
      name: string;
      description?: string;
      parameters?: Record<string, unknown>;
    };
  }>;
  properties?: Record<string, unknown>;
}

export class WebhookIntegration implements IntegrationProvider {
  private config: IntegrationConfig;

  constructor(config: IntegrationConfig) {
    this.config = config;
  }

  get name(): string {
    return 'webhook';
  }

  isEnabled(): boolean {
    return this.config.enabled && !!this.config.endpoint;
  }

  async captureTrace(trace: TraceType): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }

    try {
      // Transform trace data to webhook format
      const eventData = this.transformTraceToWebhookFormat(trace);

      const payload = {
        data: eventData,
        event_type: 'llm_generation',
        timestamp: new Date().toISOString(),
        ...this.config.options,
      };

      if (!this.config.endpoint) {
        console.error('Webhook endpoint is not configured');
        return;
      }

      await fetch(this.config.endpoint, {
        body: JSON.stringify(payload),
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey && {
            Authorization: `Bearer ${this.config.apiKey}`,
          }),
          ...(this.config.options?.headers as Record<string, string>),
        },
        method: 'POST',
      });
    } catch (error) {
      console.error('Failed to send webhook trace:', error);
    }
  }

  async captureError(error: Error, trace: TraceType): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }

    try {
      // Create error event with trace context
      const errorEvent = {
        distinctId: trace.userId || undefined,
        error: error.message,
        input: [],
        inputTokens: 0,
        isError: true,
        model: 'unknown',
        outputChoices: [],
        outputTokens: 0,
        parentId: trace.parentSpanId || undefined,
        properties: {
          ...((trace.metadata as Record<string, unknown>) || {}),
          error_name: error.name,
          error_stack: error.stack,
          org_id: trace.orgId,
        },
        provider: 'unknown',
        spanId: trace.spanId || undefined,
        spanName: 'error',
        traceId: trace.traceId,
      };

      const payload = {
        data: errorEvent,
        error: {
          message: error.message,
          name: error.name,
          stack: error.stack,
        },
        event_type: 'llm_error',
        timestamp: new Date().toISOString(),
        ...this.config.options,
      };

      if (!this.config.endpoint) {
        console.error('Webhook endpoint is not configured');
        return;
      }

      await fetch(this.config.endpoint, {
        body: JSON.stringify(payload),
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey && {
            Authorization: `Bearer ${this.config.apiKey}`,
          }),
          ...(this.config.options?.headers as Record<string, string>),
        },
        method: 'POST',
      });
    } catch (webhookError) {
      console.error('Failed to send webhook error:', webhookError);
    }
  }

  async identifyUser(
    distinctId: string,
    properties: Record<string, unknown>,
  ): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }

    try {
      const payload = {
        distinct_id: distinctId,
        event_type: 'user_identify',
        properties,
        timestamp: new Date().toISOString(),
        ...this.config.options,
      };

      if (!this.config.endpoint) {
        console.error('Webhook endpoint is not configured');
        return;
      }

      await fetch(this.config.endpoint, {
        body: JSON.stringify(payload),
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey && {
            Authorization: `Bearer ${this.config.apiKey}`,
          }),
          ...(this.config.options?.headers as Record<string, string>),
        },
        method: 'POST',
      });
    } catch (error) {
      console.error('Failed to send webhook identify event:', error);
    }
  }

  /**
   * Transform trace data to webhook format
   */
  private transformTraceToWebhookFormat(trace: TraceType): LLMGenerationData {
    const traceData = trace.data as Record<string, unknown>;

    // If already in LLM generation format, extract it
    if (traceData.llm_generation) {
      const llmGen = traceData.llm_generation as LLMGenerationData;
      return {
        ...llmGen,
        distinctId: trace.userId || undefined,
        properties: {
          ...llmGen.properties,
          created_at: trace.createdAt,
          expires_at: trace.expiresAt,
          org_id: trace.orgId,
        },
      };
    }

    // Try to extract LLM-specific data from various formats
    const llmData = extractLLMDataFromTrace(traceData);

    return {
      baseUrl: llmData.baseUrl,
      cacheCreationInputTokens: llmData.cacheCreationInputTokens,
      cacheReadInputTokens: llmData.cacheReadInputTokens,
      distinctId: trace.userId || undefined,
      error: llmData.error,
      httpStatus: llmData.httpStatus,
      input: llmData.input || [],
      inputCostUsd: llmData.inputCostUsd,
      inputTokens: llmData.inputTokens || 0,
      isError: llmData.isError || false,
      latency: llmData.latency,
      maxTokens: llmData.maxTokens,
      model: llmData.model || 'unknown',
      outputChoices: llmData.outputChoices || [],
      outputCostUsd: llmData.outputCostUsd,
      outputTokens: llmData.outputTokens || 0,
      parentId: trace.parentSpanId || undefined,
      properties: {
        ...((trace.metadata as Record<string, unknown>) || {}),
        created_at: trace.createdAt,
        expires_at: trace.expiresAt,
        org_id: trace.orgId,
      },
      provider: llmData.provider || 'unknown',
      requestUrl: llmData.requestUrl,
      spanId: trace.spanId || undefined,
      spanName: llmData.spanName || 'llm_generation',
      stream: llmData.stream,
      temperature: llmData.temperature,
      tools: llmData.tools,
      totalCostUsd: llmData.totalCostUsd,
      traceId: trace.traceId,
    };
  }
}
