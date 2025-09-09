import type { TraceType } from '../db-types';
import type { IntegrationConfig, IntegrationProvider } from '../types';
import { extractLLMDataFromTrace } from '../utils/llm-data-extractor';

export class PostHogIntegration implements IntegrationProvider {
  private config: IntegrationConfig;
  private endpoint: string;

  constructor(config: IntegrationConfig) {
    this.config = config;
    this.endpoint = this.buildEndpoint();
    this.initialize();
  }

  private buildEndpoint(): string {
    const capturePath = '/i/v0/e/';

    if (this.config.endpoint) {
      const endpoint = `${this.config.endpoint}${capturePath}`;
      console.log('[PostHog] Using provided endpoint:', endpoint);
      return endpoint;
    }

    const baseUrl =
      (this.config.options?.baseUrl as string) || 'https://us.i.posthog.com';
    const endpoint = `${baseUrl}${capturePath}`;
    console.log('[PostHog] Constructed endpoint from baseUrl:', {
      baseUrl,
      endpoint,
      options: this.config.options,
    });
    return endpoint;
  }

  get name(): string {
    return 'posthog';
  }

  isEnabled(): boolean {
    return this.config.enabled && !!this.config.apiKey;
  }

  private async initialize(): Promise<void> {
    console.log('[PostHog] Initializing with config:', {
      enabled: this.config.enabled,
      endpoint: this.endpoint,
      hasApiKey: !!this.config.apiKey,
    });

    if (!this.config.enabled || !this.config.apiKey) {
      console.log('[PostHog] Skipping initialization - disabled or no API key');
      return;
    }

    console.log('[PostHog] Initialization successful');
  }

  async captureTrace(trace: TraceType): Promise<void> {
    console.log('[PostHog] captureTrace called:', {
      enabled: this.isEnabled(),
      endpoint: this.endpoint,
      spanId: trace.spanId,
      traceId: trace.traceId,
    });

    if (!this.isEnabled()) {
      console.log('[PostHog] Skipping capture - not enabled');
      return;
    }

    try {
      // Transform trace data to PostHog LLM analytics format
      const generationEvent = this.transformTraceToPostHogFormat(trace);
      console.log('[PostHog] Transformed payload:', {
        inputTokens: generationEvent.inputTokens,
        model: generationEvent.model,
        outputTokens: generationEvent.outputTokens,
        provider: generationEvent.provider,
      });

      // Send to PostHog capture endpoint
      console.log('[PostHog] Sending request to:', this.endpoint);
      const properties: Record<string, unknown> = {
        $ai_base_url: generationEvent.baseUrl,
        $ai_cache_creation_input_tokens:
          generationEvent.cacheCreationInputTokens,
        $ai_cache_read_input_tokens: generationEvent.cacheReadInputTokens,
        $ai_http_status: generationEvent.httpStatus,
        $ai_input: generationEvent.input,
        $ai_input_cost_usd: generationEvent.inputCostUsd,
        $ai_input_tokens: generationEvent.inputTokens,
        $ai_is_error: generationEvent.isError || false,
        $ai_latency: generationEvent.latency,
        $ai_max_tokens: generationEvent.maxTokens,
        $ai_model: generationEvent.model,
        $ai_output_choices: generationEvent.outputChoices,
        $ai_output_cost_usd: generationEvent.outputCostUsd,
        $ai_output_tokens: generationEvent.outputTokens,
        $ai_parent_id: generationEvent.parentId,
        $ai_provider: generationEvent.provider,
        $ai_request_url: generationEvent.requestUrl,
        $ai_span_id: generationEvent.spanId,
        $ai_span_name: generationEvent.spanName,
        $ai_stream: generationEvent.stream,
        $ai_temperature: generationEvent.temperature,
        $ai_tools: generationEvent.tools,
        $ai_total_cost_usd: generationEvent.totalCostUsd,
        $ai_trace_id: generationEvent.traceId,
        distinct_id: generationEvent.distinctId || 'anonymous',
        ...generationEvent.properties,
      };

      // Only include $ai_error if there's an actual error
      if (generationEvent.error && generationEvent.isError) {
        properties.$ai_error = generationEvent.error;
      }
      const response = await fetch(this.endpoint, {
        body: JSON.stringify({
          api_key: this.config.apiKey,
          event: '$ai_generation',
          properties,
          timestamp: new Date().toISOString(),
        }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      });

      console.log('[PostHog] Response received:', {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[PostHog] Error response body:', errorText);
        throw new Error(
          `PostHog API error: ${response.status} ${response.statusText}`,
        );
      }

      console.log('[PostHog] Trace captured successfully');
    } catch (error) {
      console.error('[PostHog] Failed to capture trace:', error);
    }
  }

  async captureError(error: Error, trace: TraceType): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }

    try {
      // Create error trace with error status
      const errorTrace: TraceType = {
        ...trace,
        data: {
          ...((trace.data as Record<string, unknown>) || {}),
          error: {
            message: error.message,
            name: error.name,
            stack: error.stack,
          },
        },
      };

      await this.captureTrace(errorTrace);
    } catch (captureError) {
      console.error('Failed to capture PostHog error:', captureError);
    }
  }

  async identifyUser(
    _distinctId: string,
    _properties: Record<string, unknown>,
  ): Promise<void> {
    // PostHog user identification is handled through the $identify event
    // This is typically done separately from LLM analytics
    console.log(
      'PostHog: User identification should be handled via $identify event',
    );
  }

  async flush(): Promise<void> {
    // PostHog capture endpoint processes events immediately
    // No batching/flushing needed
  }

  /**
   * Transform trace data to PostHog LLM analytics format
   */
  private transformTraceToPostHogFormat(trace: TraceType): {
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
  } {
    // Extract LLM-specific data from trace
    const llmData = extractLLMDataFromTrace(
      trace.data as Record<string, unknown>,
    );

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
