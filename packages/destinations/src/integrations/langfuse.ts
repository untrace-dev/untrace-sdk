import type { TraceType } from '../db-types';
import type { IntegrationConfig, IntegrationProvider } from '../types';
import { extractLLMDataFromTrace } from '../utils/llm-data-extractor';

interface LangfuseOTLPSpan {
  attributes: Array<{
    key: string;
    value: {
      stringValue?: string;
      boolValue?: boolean;
      intValue?: number;
      doubleValue?: number;
      arrayValue?: {
        values: Array<{
          stringValue?: string;
          boolValue?: boolean;
          intValue?: number;
          doubleValue?: number;
        }>;
      };
      kvlistValue?: {
        values: Array<{
          key: string;
          value: {
            stringValue?: string;
            boolValue?: boolean;
            intValue?: number;
            doubleValue?: number;
          };
        }>;
      };
    };
  }>;
  endTimeUnixNano: string;
  events: Array<{
    attributes: Array<{
      key: string;
      value: {
        stringValue?: string;
        boolValue?: boolean;
        intValue?: number;
        doubleValue?: number;
      };
    }>;
    name: string;
    timeUnixNano: string;
  }>;
  kind: number;
  links: Array<{
    attributes: Array<{
      key: string;
      value: {
        stringValue?: string;
        boolValue?: boolean;
        intValue?: number;
        doubleValue?: number;
      };
    }>;
    spanId: string;
    traceId: string;
  }>;
  name: string;
  parentSpanId?: string;
  spanId: string;
  startTimeUnixNano: string;
  status: {
    code: number;
    message?: string;
  };
  traceId: string;
}

interface LangfuseOTLPResource {
  attributes: Array<{
    key: string;
    value: {
      stringValue?: string;
      boolValue?: boolean;
      intValue?: number;
      doubleValue?: number;
    };
  }>;
}

interface LangfuseOTLPScope {
  name: string;
  version?: string;
}

interface LangfuseOTLPScopeSpans {
  scope: LangfuseOTLPScope;
  spans: LangfuseOTLPSpan[];
}

interface LangfuseOTLPResourceSpans {
  resource: LangfuseOTLPResource;
  scopeSpans: LangfuseOTLPScopeSpans[];
}

interface LangfuseOTLPPayload {
  resourceSpans: LangfuseOTLPResourceSpans[];
}

export class LangfuseIntegration implements IntegrationProvider {
  private config: IntegrationConfig;
  private endpoint: string;
  private authString: string;

  constructor(config: IntegrationConfig) {
    this.config = config;

    // Construct the OTLP endpoint from baseUrl or use default
    if (this.config.endpoint) {
      // If endpoint is provided, use it as-is
      this.endpoint = this.config.endpoint;
      console.log('[Langfuse] Using provided endpoint:', this.endpoint);
    } else {
      // If baseUrl is provided, append the OTLP path
      const baseUrl =
        (this.config.options?.baseUrl as string) ||
        'https://us.cloud.langfuse.com';
      this.endpoint = `${baseUrl}/api/public/otel/v1/traces`;
      console.log('[Langfuse] Constructed endpoint from baseUrl:', {
        baseUrl,
        endpoint: this.endpoint,
        options: this.config.options,
      });
    }

    this.authString = '';
    this.initialize();
  }

  get name(): string {
    return 'langfuse';
  }

  isEnabled(): boolean {
    return this.config.enabled && !!this.config.apiKey;
  }

  private async initialize(): Promise<void> {
    console.log('[Langfuse] Initializing with config:', {
      enabled: this.config.enabled,
      endpoint: this.endpoint,
      hasApiKey: !!this.config.apiKey,
    });

    if (!this.config.enabled || !this.config.apiKey) {
      console.log(
        '[Langfuse] Skipping initialization - disabled or no API key',
      );
      return;
    }

    try {
      // Create auth string from API key
      // Langfuse expects format: "pk-lf-xxx:sk-lf-xxx"
      const apiKey = this.config.apiKey;
      console.log('[Langfuse] API key:', apiKey);
      if (apiKey.includes(':')) {
        // Already in correct format
        this.authString = Buffer.from(apiKey).toString('base64');
        console.log(
          '[Langfuse] Using provided API key format',
          this.authString,
        );
      } else {
        // Assume it's a single key, create dummy secret key
        this.authString = Buffer.from(`${apiKey}:sk-lf-dummy`).toString(
          'base64',
        );
        console.log('[Langfuse] Created auth string with dummy secret key');
      }
      console.log('[Langfuse] Initialization successful');
    } catch (error) {
      console.error('[Langfuse] Failed to initialize:', error);
    }
  }

  async captureTrace(trace: TraceType): Promise<void> {
    console.log('[Langfuse] captureTrace called:', {
      enabled: this.isEnabled(),
      endpoint: this.endpoint,
      spanId: trace.spanId,
      traceId: trace.traceId,
    });

    if (!this.isEnabled()) {
      console.log('[Langfuse] Skipping capture - not enabled');
      return;
    }

    try {
      // Transform trace data to Langfuse OTLP format
      const otlpPayload = this.transformTraceToLangfuseFormat(trace);
      console.log('[Langfuse] Transformed payload:', {
        firstSpanName:
          otlpPayload.resourceSpans[0]?.scopeSpans[0]?.spans[0]?.name,
        resourceSpansCount: otlpPayload.resourceSpans.length,
      });

      // Send to Langfuse OTLP endpoint
      console.log(
        '[Langfuse] Sending request to:',
        this.endpoint,
        this.authString,
      );
      const response = await fetch(this.endpoint, {
        body: this.serializeOTLPPayload(otlpPayload),
        headers: {
          Authorization: `Basic ${this.authString}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
      });

      console.log('[Langfuse] Response received:', {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Langfuse] Error response body:', errorText);
        throw new Error(
          `Langfuse API error: ${response.status} ${response.statusText}`,
        );
      }

      console.log('[Langfuse] Trace captured successfully');
    } catch (error) {
      console.error('[Langfuse] Failed to capture trace:', error);
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
      console.error('Failed to capture Langfuse error:', captureError);
    }
  }

  async identifyUser(
    _distinctId: string,
    _properties: Record<string, unknown>,
  ): Promise<void> {
    // Langfuse doesn't have a separate user identification endpoint
    // User properties are typically included in trace attributes
    console.log(
      'Langfuse: User identification not supported, properties will be included in traces',
    );
  }

  async flush(): Promise<void> {
    // Langfuse OTLP endpoint processes traces immediately
    // No batching/flushing needed
  }

  /**
   * Transform trace data to Langfuse OTLP format
   */
  private transformTraceToLangfuseFormat(
    trace: TraceType,
  ): LangfuseOTLPPayload {
    const now = Date.now();
    const nowNano = now * 1000000; // Convert to nanoseconds

    // Extract LLM-specific data from trace
    const llmData = extractLLMDataFromTrace(
      trace.data as Record<string, unknown>,
    );

    // Create span attributes following Langfuse conventions
    const attributes: Array<{
      key: string;
      value: {
        stringValue?: string;
        boolValue?: boolean;
        intValue?: number;
        doubleValue?: number;
      };
    }> = [];

    // Add trace-level attributes
    if (trace.userId) {
      attributes.push({
        key: 'langfuse.user.id',
        value: { stringValue: trace.userId },
      });
    }

    if (trace.metadata) {
      Object.entries(trace.metadata).forEach(([key, value]) => {
        if (typeof value === 'string') {
          attributes.push({
            key: `langfuse.trace.metadata.${key}`,
            value: { stringValue: value },
          });
        } else if (typeof value === 'number') {
          attributes.push({
            key: `langfuse.trace.metadata.${key}`,
            value: { doubleValue: value },
          });
        } else if (typeof value === 'boolean') {
          attributes.push({
            key: `langfuse.trace.metadata.${key}`,
            value: { boolValue: value },
          });
        }
      });
    }

    // Add LLM-specific attributes
    if (llmData.model) {
      attributes.push({
        key: 'langfuse.observation.model.name',
        value: { stringValue: llmData.model },
      });
    }

    if (llmData.provider) {
      attributes.push({
        key: 'langfuse.observation.provider',
        value: { stringValue: llmData.provider },
      });
    }

    if (llmData.input) {
      attributes.push({
        key: 'langfuse.observation.input',
        value: { stringValue: JSON.stringify(llmData.input) },
      });
    }

    if (llmData.outputChoices) {
      attributes.push({
        key: 'langfuse.observation.output',
        value: { stringValue: JSON.stringify(llmData.outputChoices) },
      });
    }

    if (llmData.inputTokens) {
      attributes.push({
        key: 'langfuse.observation.usage_details',
        value: {
          stringValue: JSON.stringify({ prompt_tokens: llmData.inputTokens }),
        },
      });
    }

    if (llmData.outputTokens) {
      const usageDetails = llmData.inputTokens
        ? JSON.stringify({
            completion_tokens: llmData.outputTokens,
            prompt_tokens: llmData.inputTokens,
            total_tokens: llmData.inputTokens + llmData.outputTokens,
          })
        : JSON.stringify({ completion_tokens: llmData.outputTokens });

      attributes.push({
        key: 'langfuse.observation.usage_details',
        value: { stringValue: usageDetails },
      });
    }

    if (llmData.temperature !== undefined) {
      attributes.push({
        key: 'langfuse.observation.model.parameters',
        value: {
          stringValue: JSON.stringify({ temperature: llmData.temperature }),
        },
      });
    }

    if (llmData.maxTokens) {
      const modelParams =
        llmData.temperature !== undefined
          ? { max_tokens: llmData.maxTokens, temperature: llmData.temperature }
          : { max_tokens: llmData.maxTokens };

      attributes.push({
        key: 'langfuse.observation.model.parameters',
        value: { stringValue: JSON.stringify(modelParams) },
      });
    }

    // Set observation type
    attributes.push({
      key: 'langfuse.observation.type',
      value: { stringValue: 'generation' },
    });

    // Set status
    const status = llmData.error ? 1 : 0; // 0 = OK, 1 = ERROR
    const statusMessage = llmData.error
      ? typeof llmData.error === 'string'
        ? llmData.error
        : JSON.stringify(llmData.error)
      : undefined;

    const span: LangfuseOTLPSpan = {
      attributes,
      endTimeUnixNano: nowNano.toString(),
      events: [],
      kind: 1, // SPAN_KIND_INTERNAL
      links: [],
      name: llmData.spanName || 'llm_generation',
      parentSpanId: trace.parentSpanId || '',
      spanId: trace.spanId || this.generateSpanId(),
      startTimeUnixNano: (
        nowNano -
        (llmData.latency || 0) * 1000000
      ).toString(),
      status: {
        code: status,
        message: statusMessage,
      },
      traceId: trace.traceId,
    };

    const resourceSpans: LangfuseOTLPResourceSpans = {
      resource: {
        attributes: [
          {
            key: 'service.name',
            value: { stringValue: 'untrace' },
          },
          {
            key: 'service.version',
            value: { stringValue: '1.0.0' },
          },
        ],
      },
      scopeSpans: [
        {
          scope: {
            name: 'untrace-langfuse',
            version: '1.0.0',
          },
          spans: [span],
        },
      ],
    };

    return {
      resourceSpans: [resourceSpans],
    };
  }

  /**
   * Serialize OTLP payload to protobuf format
   * Note: This is a simplified implementation. In production, you'd want to use
   * a proper protobuf library like protobufjs or the official OpenTelemetry SDK
   */
  private serializeOTLPPayload(payload: LangfuseOTLPPayload): ArrayBuffer {
    // This is a placeholder implementation
    // In a real implementation, you would use a protobuf library to serialize
    // the OTLP payload according to the OpenTelemetry protocol specification

    // For now, we'll convert to JSON and let the server handle it
    // Note: Langfuse's OTLP endpoint might accept JSON format as well
    const jsonString = JSON.stringify(payload);
    const encoder = new TextEncoder();
    return encoder.encode(jsonString).buffer as ArrayBuffer;
  }

  private generateSpanId(): string {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }
}
