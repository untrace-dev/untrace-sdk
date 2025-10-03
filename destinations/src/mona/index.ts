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

// Mona AI provider configuration schema
const MonaConfigSchema = z.object({
  apiKey: z.string().min(1, 'API key is required'),
  enabled: z.boolean().default(true),
  endpoint: z.string().optional(),
  options: z
    .object({
      baseUrl: z.string().url().default('https://api.monalabs.io'),
      batchSize: z.number().min(1).max(1000).default(100),
      contextId: z.string().min(1, 'Context ID is required'),
      environment: z.string().default('production'),
      flushInterval: z.number().min(60000).max(3600000).default(300000), // 5 minutes
      modelId: z.string().min(1, 'Model ID is required'),
      retryAttempts: z.number().min(0).max(5).default(3),
      retryDelay: z.number().min(1000).max(10000).default(2000), // 2 seconds
      timeout: z.number().min(5000).max(60000).default(30000), // 30 seconds
    })
    .optional(),
});

export class MonaProvider extends BaseIntegrationProvider {
  readonly name = 'Mona AI';
  readonly destinationId = 'mona';

  private baseUrl: string;
  private contextId: string;
  private modelId: string;
  private environment: string;
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
      (config.options?.baseUrl as string) || 'https://api.monalabs.io';
    this.contextId = (config.options?.contextId as string) || '';
    this.modelId = (config.options?.modelId as string) || '';
    this.environment = (config.options?.environment as string) || 'production';
    this.batchSize = (config.options?.batchSize as number) || 100;
    this.flushInterval = (config.options?.flushInterval as number) || 300000; // 5 minutes
    this.timeout = (config.options?.timeout as number) || 30000; // 30 seconds
    this.retryAttempts = (config.options?.retryAttempts as number) || 3;
    this.retryDelay = (config.options?.retryDelay as number) || 2000; // 2 seconds

    if (!this.contextId) {
      throw new Error('Mona AI context ID is required');
    }

    if (!this.modelId) {
      throw new Error('Mona AI model ID is required');
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
      MonaConfigSchema.parse(config);
      return { success: true };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Invalid configuration',
        success: false,
      };
    }
  }

  getConfigSchema(): z.ZodSchema {
    return MonaConfigSchema;
  }

  private addTraceToBuffer(trace: TraceData, context: TraceContext): void {
    this.dataBuffer.push({
      context,
      timestamp: new Date().toISOString(),
      trace,
    });

    // Flush if buffer is full
    if (this.dataBuffer.length >= this.batchSize) {
      this.flushToMona();
    }
  }

  private async flushToMona(): Promise<void> {
    if (this.dataBuffer.length === 0) {
      return;
    }

    const dataToFlush = [...this.dataBuffer];
    this.dataBuffer = [];

    try {
      await this.sendBatchToMona(dataToFlush);
    } catch (error) {
      console.error('[MonaProvider] Failed to flush data to Mona:', error);
      // Re-add data to buffer for retry
      this.dataBuffer.unshift(...dataToFlush);
    }
  }

  private async sendBatchToMona(
    data: Array<{
      trace: TraceData;
      context: TraceContext;
      timestamp: string;
    }>,
  ): Promise<void> {
    // Transform data to Mona AI format
    const monaData = data.map((item) => ({
      context_id: this.contextId,
      environment: this.environment,
      events:
        item.trace.events?.map((event) => ({
          attributes: event.attributes || {},
          name: event.name,
          timestamp: new Date(event.timestamp).getTime(),
        })) || [],
      inputs: {
        max_tokens: item.trace.attributes?.['llm.max_tokens'] || 1000,
        messages: item.trace.attributes?.['llm.messages'] || [],
        // LLM input features
        model: item.trace.attributes?.['llm.model'] || 'unknown',
        temperature: item.trace.attributes?.['llm.temperature'] || 0.7,
        // Additional input attributes
        ...Object.fromEntries(
          Object.entries(item.trace.attributes || {})
            .filter(
              ([key]) => key.startsWith('input.') || key.startsWith('llm.'),
            )
            .map(([key, value]) => [key, value]),
        ),
      },
      labels: {
        // Performance labels
        performance_score: item.trace.attributes?.['performance.score'] || 0,
        quality_score: item.trace.attributes?.['quality.score'] || 0,
        // Additional label attributes
        ...Object.fromEntries(
          Object.entries(item.trace.attributes || {})
            .filter(
              ([key]) => key.startsWith('label.') || key.startsWith('score.'),
            )
            .map(([key, value]) => [key, value]),
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
      outputs: {
        completion_tokens:
          item.trace.attributes?.['llm.completion_tokens'] || 0,
        // Performance outputs
        duration: item.trace.duration || 0,
        prompt_tokens: item.trace.attributes?.['llm.prompt_tokens'] || 0,
        // LLM output features
        response: item.trace.attributes?.['llm.response'] || '',
        status: item.trace.status || 'unknown',
        total_tokens: item.trace.attributes?.['llm.total_tokens'] || 0,
        // Additional output attributes
        ...Object.fromEntries(
          Object.entries(item.trace.attributes || {})
            .filter(
              ([key]) =>
                key.startsWith('output.') || key.startsWith('response.'),
            )
            .map(([key, value]) => [key, value]),
        ),
      },
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

    const endpoint = this.buildEndpoint('/v1/data');
    await this.makeRequestWithRetry(endpoint, {
      body: JSON.stringify({
        data: monaData,
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
            `Mona AI API error: ${response.status} ${response.statusText} - ${errorText}`,
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
      this.flushToMona();
    }, this.flushInterval);
  }

  async destroy(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
    await this.flushToMona();
  }
}

// Mona AI provider factory
export class MonaProviderFactory implements ProviderFactory {
  createProvider(config: ProviderConfig, destinationId: string): MonaProvider {
    return new MonaProvider(config, destinationId);
  }

  getDestinationId(): string {
    return 'mona';
  }

  getConfigSchema(): z.ZodSchema {
    return MonaConfigSchema;
  }
}

// Mona AI test runner
export class MonaTestRunner extends BaseDestinationTestRunner {
  async testConnection(config: Record<string, unknown>): Promise<TestResult> {
    try {
      const apiKey = config.apiKey as string;
      const baseUrl = (config.baseUrl as string) || 'https://api.monalabs.io';
      const contextId = config.contextId as string;
      const modelId = config.modelId as string;

      if (!apiKey) {
        return {
          details: {
            destination: this.destinationId,
            metadata: { config },
            testType: 'connection',
          },
          error: 'Missing required field: apiKey',
          message: 'API key is required for Mona AI destinations',
          success: false,
        };
      }

      if (!contextId) {
        return {
          details: {
            destination: this.destinationId,
            metadata: { config },
            testType: 'connection',
          },
          error: 'Missing required field: contextId',
          message: 'Context ID is required for Mona AI destinations',
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
          message: 'Model ID is required for Mona AI destinations',
          success: false,
        };
      }

      // Test connection by making a request to Mona's API
      const testEndpoint = `${baseUrl}/v1/data`;
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
          message: `Mona AI connection test failed: ${response.status} ${response.statusText}`,
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
        message: `Mona AI connection test to ${baseUrl} successful`,
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
        message: `Mona AI connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
      const baseUrl = (config.baseUrl as string) || 'https://api.monalabs.io';
      const contextId = config.contextId as string;
      const modelId = config.modelId as string;
      const environment = (config.environment as string) || 'production';

      if (!apiKey || !contextId || !modelId) {
        return {
          details: {
            destination: this.destinationId,
            metadata: { config, trace },
            testType: 'delivery',
          },
          error: 'Missing required fields for delivery test',
          message:
            'API key, context ID, and model ID are required for Mona AI destinations',
          success: false,
        };
      }

      // Test delivery by sending a sample data point
      const testEndpoint = `${baseUrl}/v1/data`;
      const response = await fetch(testEndpoint, {
        body: JSON.stringify({
          data: [
            {
              context_id: contextId,
              environment: environment,
              events: [],
              inputs: {
                max_tokens: 100,
                messages: [{ content: 'Hello, world!', role: 'user' }],
                model: 'gpt-4',
                temperature: 0.7,
                test: true,
              },
              labels: {
                performance_score: 0.95,
                quality_score: 0.9,
                test: true,
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
              outputs: {
                completion_tokens: 5,
                duration: 100,
                prompt_tokens: 10,
                response: 'Hello! How can I help you today?',
                status: 'ok',
                test: true,
                total_tokens: 15,
              },
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
          message: `Mona AI delivery test failed: ${response.status} ${response.statusText}`,
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
        message: `Mona AI delivery test to ${baseUrl} successful`,
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
        message: `Mona AI delivery test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        success: false,
      };
    }
  }

  async validateConfig(config: Record<string, unknown>): Promise<TestResult> {
    try {
      const apiKey = config.apiKey as string;
      const baseUrl = config.baseUrl as string;
      const contextId = config.contextId as string;
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
          message: 'API key is required for Mona AI destinations',
          success: false,
        };
      }

      if (!contextId) {
        return {
          details: {
            destination: this.destinationId,
            metadata: { config },
            testType: 'validation',
          },
          error: 'Missing required field: contextId',
          message: 'Context ID is required for Mona AI destinations',
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
          message: 'Model ID is required for Mona AI destinations',
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
        message: 'Mona AI destination configuration is valid',
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

// Register the Mona AI provider and test runner
registerProvider(new MonaProviderFactory());
registerDestinationTestRunner('mona', MonaTestRunner);
