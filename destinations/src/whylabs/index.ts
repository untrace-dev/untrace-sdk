import { z } from 'zod';
import {
  BaseIntegrationProvider,
  type ProviderConfig,
  type ProviderFactory,
  registerProvider,
  type TraceContext,
  type TraceData,
} from '../providers';
import {
  BaseDestinationTestRunner,
  registerDestinationTestRunner,
  type TestResult,
} from '../testing';

// WhyLabs provider configuration schema
const WhyLabsConfigSchema = z.object({
  apiKey: z.string().min(1, 'API key is required'),
  enabled: z.boolean().default(true),
  endpoint: z.string().optional(),
  options: z
    .object({
      baseUrl: z.string().url().default('https://api.whylabs.ai'),
      batchSize: z.number().min(1).max(1000).default(100),
      datasetId: z.string().optional(),
      flushInterval: z.number().min(60000).max(3600000).default(300000), // 5 minutes
      modelId: z.string().min(1, 'Model ID is required'),
      orgId: z.string().min(1, 'Organization ID is required'),
      retryAttempts: z.number().min(0).max(5).default(3),
      retryDelay: z.number().min(1000).max(10000).default(2000), // 2 seconds
      timeout: z.number().min(5000).max(60000).default(30000), // 30 seconds
    })
    .optional(),
});

export class WhyLabsProvider extends BaseIntegrationProvider {
  readonly name = 'WhyLabs';
  readonly destinationId = 'whylabs';

  private baseUrl: string;
  private orgId: string;
  private modelId: string;
  private datasetId: string;
  private batchSize: number;
  private flushInterval: number;
  private timeout: number;
  private retryAttempts: number;
  private retryDelay: number;
  private dataBuffer: Array<{
    trace: TraceData;
    context: TraceContext;
    timestamp: string;
  }> = [];
  private flushTimer?: NodeJS.Timeout;

  constructor(config: ProviderConfig, destinationId: string) {
    super(config, destinationId);
    this.baseUrl =
      (config.options?.baseUrl as string) || 'https://api.whylabs.ai';
    this.orgId = (config.options?.orgId as string) || '';
    this.modelId = (config.options?.modelId as string) || '';
    this.datasetId = (config.options?.datasetId as string) || this.modelId;
    this.batchSize = (config.options?.batchSize as number) || 100;
    this.flushInterval = (config.options?.flushInterval as number) || 300000; // 5 minutes
    this.timeout = (config.options?.timeout as number) || 30000; // 30 seconds
    this.retryAttempts = (config.options?.retryAttempts as number) || 3;
    this.retryDelay = (config.options?.retryDelay as number) || 2000; // 2 seconds

    if (!this.orgId) {
      throw new Error('WhyLabs organization ID is required');
    }

    if (!this.modelId) {
      throw new Error('WhyLabs model ID is required');
    }

    // Set up automatic flushing
    this.setupAutoFlush();
  }

  async sendTrace(trace: TraceData, context: TraceContext): Promise<void> {
    // Add trace to buffer
    this.addTraceToBuffer(trace, context);
  }

  async sendBatch(traces: TraceData[], context: TraceContext): Promise<void> {
    // Add traces to buffer
    for (const trace of traces) {
      this.addTraceToBuffer(trace, context);
    }
  }

  async validateConfig(
    config: ProviderConfig,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      WhyLabsConfigSchema.parse(config);
      return { success: true };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Invalid configuration',
        success: false,
      };
    }
  }

  getConfigSchema(): z.ZodSchema {
    return WhyLabsConfigSchema;
  }

  private addTraceToBuffer(trace: TraceData, context: TraceContext): void {
    this.dataBuffer.push({
      context,
      timestamp: new Date().toISOString(),
      trace,
    });

    // Flush if buffer is full
    if (this.dataBuffer.length >= this.batchSize) {
      this.flushToWhyLabs();
    }
  }

  private async flushToWhyLabs(): Promise<void> {
    if (this.dataBuffer.length === 0) {
      return;
    }

    const dataToFlush = [...this.dataBuffer];
    this.dataBuffer = [];

    try {
      await this.sendBatchToWhyLabs(dataToFlush);
    } catch (error) {
      console.error(
        '[WhyLabsProvider] Failed to flush data to WhyLabs:',
        error,
      );
      // Re-add data to buffer for retry
      this.dataBuffer.unshift(...dataToFlush);
    }
  }

  private async sendBatchToWhyLabs(
    data: Array<{
      trace: TraceData;
      context: TraceContext;
      timestamp: string;
    }>,
  ): Promise<void> {
    // Transform data to WhyLabs format (profile data)
    const profileData = data.map((item) => ({
      dataset_id: this.datasetId,
      events:
        item.trace.events?.map((event) => ({
          attributes: event.attributes || {},
          name: event.name,
          timestamp: new Date(event.timestamp).getTime(),
        })) || [],
      features: {
        completion_tokens:
          item.trace.attributes?.['llm.completion_tokens'] || 0,
        // Performance features
        duration: item.trace.duration || 0,
        max_tokens: item.trace.attributes?.['llm.max_tokens'] || 1000,
        // LLM-specific features
        model: item.trace.attributes?.['llm.model'] || 'unknown',
        prompt_tokens: item.trace.attributes?.['llm.prompt_tokens'] || 0,
        status: item.trace.status || 'unknown',
        temperature: item.trace.attributes?.['llm.temperature'] || 0.7,
        total_tokens: item.trace.attributes?.['llm.total_tokens'] || 0,
        // Additional attributes as features
        ...Object.fromEntries(
          Object.entries(item.trace.attributes || {}).map(([key, value]) => [
            key.replace(/[^a-zA-Z0-9_]/g, '_'),
            typeof value === 'number' ? value : String(value),
          ]),
        ),
      },
      metadata: {
        api_key_id: item.context.apiKeyId,
        ingestion_timestamp: item.timestamp,
        org_id: item.context.orgId,
        project_id: item.context.projectId,
        source: 'untrace-sdk',
        trace_duration: item.trace.duration,
        trace_id: item.trace.id,
        trace_name: item.trace.name,
        trace_status: item.trace.status,
        user_id: item.context.userId,
      },
      model_id: this.modelId,
      org_id: this.orgId,
      spans:
        item.trace.spans?.map((span) => ({
          attributes: span.attributes || {},
          duration: span.duration || 0,
          name: span.name || 'untrace-span',
          span_id: span.id,
          timestamp: new Date(span.timestamp).getTime(),
        })) || [],
      timestamp: new Date(item.trace.timestamp).getTime(),
    }));

    const endpoint = this.buildEndpoint(
      `/v0/organizations/${this.orgId}/models/${this.modelId}/profiles`,
    );
    await this.makeRequestWithRetry(endpoint, {
      body: JSON.stringify({
        profiles: profileData,
      }),
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Untrace-SDK/1.0',
      },
    });
  }

  private buildEndpoint(path: string): string {
    const url = this.config.endpoint || this.baseUrl;
    return `${url}${path}`;
  }

  private async makeRequestWithRetry(
    url: string,
    options: {
      method?: string;
      headers?: Record<string, string>;
      body?: string;
    } = {},
  ): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.retryAttempts; attempt++) {
      try {
        const response = await this.makeRequest(url, {
          ...options,
          timeout: this.timeout,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `WhyLabs API error: ${response.status} ${response.statusText} - ${errorText}`,
          );
        }

        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');

        // Don't retry on client errors (4xx)
        if (error instanceof Error && error.message.includes('4')) {
          throw error;
        }

        // Don't retry on last attempt
        if (attempt === this.retryAttempts) {
          break;
        }

        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, this.retryDelay));
      }
    }

    throw lastError || new Error('Request failed after all retry attempts');
  }

  private setupAutoFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flushToWhyLabs();
    }, this.flushInterval);
  }

  async destroy(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
    await this.flushToWhyLabs();
  }
}

// WhyLabs provider factory
export class WhyLabsProviderFactory implements ProviderFactory {
  createProvider(
    config: ProviderConfig,
    destinationId: string,
  ): WhyLabsProvider {
    return new WhyLabsProvider(config, destinationId);
  }

  getDestinationId(): string {
    return 'whylabs';
  }

  getConfigSchema(): z.ZodSchema {
    return WhyLabsConfigSchema;
  }
}

// WhyLabs test runner
export class WhyLabsTestRunner extends BaseDestinationTestRunner {
  async testConnection(config: Record<string, unknown>): Promise<TestResult> {
    try {
      const apiKey = config.apiKey as string;
      const baseUrl = (config.baseUrl as string) || 'https://api.whylabs.ai';
      const orgId = config.orgId as string;
      const modelId = config.modelId as string;

      if (!apiKey) {
        return {
          details: {
            destination: this.destinationId,
            metadata: { config },
            testType: 'connection',
          },
          error: 'Missing required field: apiKey',
          message: 'API key is required for WhyLabs destinations',
          success: false,
        };
      }

      if (!orgId) {
        return {
          details: {
            destination: this.destinationId,
            metadata: { config },
            testType: 'connection',
          },
          error: 'Missing required field: orgId',
          message: 'Organization ID is required for WhyLabs destinations',
          success: false,
        };
      }

      if (!modelId) {
        return {
          details: {
            destination: this.destinationId,
            metadata: { config },
            testType: 'connection',
          },
          error: 'Missing required field: modelId',
          message: 'Model ID is required for WhyLabs destinations',
          success: false,
        };
      }

      // Test connection by making a request to WhyLabs's API
      const testEndpoint = `${baseUrl}/v0/organizations/${orgId}/models/${modelId}`;
      const response = await fetch(testEndpoint, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Untrace-SDK/1.0',
        },
        method: 'GET',
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        return {
          details: {
            destination: this.destinationId,
            metadata: {
              config,
              status: response.status,
              statusText: response.statusText,
            },
            testType: 'connection',
          },
          error: `HTTP ${response.status}: ${response.statusText}`,
          message: `WhyLabs connection test failed: ${response.status} ${response.statusText}`,
          success: false,
        };
      }

      return {
        details: {
          destination: this.destinationId,
          metadata: {
            config,
            status: response.status,
            statusText: response.statusText,
          },
          testType: 'connection',
        },
        message: `WhyLabs connection test to ${baseUrl} successful`,
        success: true,
      };
    } catch (error) {
      return {
        details: {
          destination: this.destinationId,
          metadata: { config },
          testType: 'connection',
        },
        error: error instanceof Error ? error.message : 'Unknown error',
        message: `WhyLabs connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        success: false,
      };
    }
  }

  async testDelivery(
    config: Record<string, unknown>,
    trace: Record<string, unknown>,
  ): Promise<TestResult> {
    try {
      const apiKey = config.apiKey as string;
      const baseUrl = (config.baseUrl as string) || 'https://api.whylabs.ai';
      const orgId = config.orgId as string;
      const modelId = config.modelId as string;
      const datasetId = (config.datasetId as string) || modelId;

      if (!apiKey || !orgId || !modelId) {
        return {
          details: {
            destination: this.destinationId,
            metadata: { config, trace },
            testType: 'delivery',
          },
          error: 'Missing required fields for delivery test',
          message:
            'API key, organization ID, and model ID are required for WhyLabs destinations',
          success: false,
        };
      }

      // Test delivery by sending a sample profile
      const testEndpoint = `${baseUrl}/v0/organizations/${orgId}/models/${modelId}/profiles`;
      const response = await fetch(testEndpoint, {
        body: JSON.stringify({
          profiles: [
            {
              dataset_id: datasetId,
              events: [],
              features: {
                completion_tokens: 5,
                duration: 100,
                max_tokens: 100,
                model: 'gpt-4',
                prompt_tokens: 10,
                status: 'ok',
                temperature: 0.7,
                test: true,
                total_tokens: 15,
              },
              metadata: {
                api_key_id: 'test-api-key',
                ingestion_timestamp: new Date().toISOString(),
                org_id: 'test-org',
                project_id: 'test-project',
                source: 'untrace-sdk',
                test: true,
                trace_duration: 100,
                trace_id: trace.id || 'test-trace-delivery',
                trace_name: 'test-trace',
                trace_status: 'ok',
                user_id: 'test-user',
                ...trace,
              },
              model_id: modelId,
              org_id: orgId,
              spans: [],
              timestamp: Date.now(),
            },
          ],
        }),
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Untrace-SDK/1.0',
        },
        method: 'POST',
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        return {
          details: {
            destination: this.destinationId,
            metadata: {
              config,
              status: response.status,
              statusText: response.statusText,
              trace,
            },
            testType: 'delivery',
          },
          error: `HTTP ${response.status}: ${response.statusText}`,
          message: `WhyLabs delivery test failed: ${response.status} ${response.statusText}`,
          success: false,
        };
      }

      return {
        details: {
          destination: this.destinationId,
          metadata: {
            config,
            status: response.status,
            statusText: response.statusText,
            trace,
          },
          testType: 'delivery',
        },
        message: `WhyLabs delivery test to ${baseUrl} successful`,
        success: true,
      };
    } catch (error) {
      return {
        details: {
          destination: this.destinationId,
          metadata: { config, trace },
          testType: 'delivery',
        },
        error: error instanceof Error ? error.message : 'Unknown error',
        message: `WhyLabs delivery test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        success: false,
      };
    }
  }

  async validateConfig(config: Record<string, unknown>): Promise<TestResult> {
    try {
      const apiKey = config.apiKey as string;
      const baseUrl = config.baseUrl as string;
      const orgId = config.orgId as string;
      const modelId = config.modelId as string;
      const batchSize = config.batchSize as number;
      const flushInterval = config.flushInterval as number;
      const timeout = config.timeout as number;
      const retryAttempts = config.retryAttempts as number;
      const retryDelay = config.retryDelay as number;

      if (!apiKey) {
        return {
          details: {
            destination: this.destinationId,
            metadata: { config },
            testType: 'validation',
          },
          error: 'Missing required field: apiKey',
          message: 'API key is required for WhyLabs destinations',
          success: false,
        };
      }

      if (!orgId) {
        return {
          details: {
            destination: this.destinationId,
            metadata: { config },
            testType: 'validation',
          },
          error: 'Missing required field: orgId',
          message: 'Organization ID is required for WhyLabs destinations',
          success: false,
        };
      }

      if (!modelId) {
        return {
          details: {
            destination: this.destinationId,
            metadata: { config },
            testType: 'validation',
          },
          error: 'Missing required field: modelId',
          message: 'Model ID is required for WhyLabs destinations',
          success: false,
        };
      }

      // Validate base URL if provided
      if (baseUrl) {
        try {
          new URL(baseUrl);
        } catch {
          return {
            details: {
              destination: this.destinationId,
              metadata: { config },
              testType: 'validation',
            },
            error: 'Invalid baseUrl format',
            message: 'Base URL must be a valid URL',
            success: false,
          };
        }
      }

      // Validate batch size if provided
      if (batchSize && (batchSize < 1 || batchSize > 1000)) {
        return {
          details: {
            destination: this.destinationId,
            metadata: { config },
            testType: 'validation',
          },
          error: 'Invalid batch size',
          message: 'Batch size must be between 1 and 1000',
          success: false,
        };
      }

      // Validate flush interval if provided
      if (flushInterval && (flushInterval < 60000 || flushInterval > 3600000)) {
        return {
          details: {
            destination: this.destinationId,
            metadata: { config },
            testType: 'validation',
          },
          error: 'Invalid flush interval',
          message:
            'Flush interval must be between 60000 and 3600000 milliseconds',
          success: false,
        };
      }

      // Validate timeout if provided
      if (timeout && (timeout < 5000 || timeout > 60000)) {
        return {
          details: {
            destination: this.destinationId,
            metadata: { config },
            testType: 'validation',
          },
          error: 'Invalid timeout',
          message: 'Timeout must be between 5000 and 60000 milliseconds',
          success: false,
        };
      }

      // Validate retry attempts if provided
      if (retryAttempts && (retryAttempts < 0 || retryAttempts > 5)) {
        return {
          details: {
            destination: this.destinationId,
            metadata: { config },
            testType: 'validation',
          },
          error: 'Invalid retry attempts',
          message: 'Retry attempts must be between 0 and 5',
          success: false,
        };
      }

      // Validate retry delay if provided
      if (retryDelay && (retryDelay < 1000 || retryDelay > 10000)) {
        return {
          details: {
            destination: this.destinationId,
            metadata: { config },
            testType: 'validation',
          },
          error: 'Invalid retry delay',
          message: 'Retry delay must be between 1000 and 10000 milliseconds',
          success: false,
        };
      }

      return {
        details: {
          destination: this.destinationId,
          metadata: { config },
          testType: 'validation',
        },
        message: 'WhyLabs destination configuration is valid',
        success: true,
      };
    } catch (error) {
      return {
        details: {
          destination: this.destinationId,
          metadata: { config },
          testType: 'validation',
        },
        error: error instanceof Error ? error.message : 'Unknown error',
        message: `Configuration validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        success: false,
      };
    }
  }
}

// Register the WhyLabs provider and test runner
registerProvider(new WhyLabsProviderFactory());
registerDestinationTestRunner('whylabs', WhyLabsTestRunner);
