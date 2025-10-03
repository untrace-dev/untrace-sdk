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

// Arize AI provider configuration schema
const ArizeConfigSchema = z.object({
  apiKey: z.string().min(1, 'API key is required'),
  enabled: z.boolean().default(true),
  endpoint: z.string().optional(),
  options: z
    .object({
      baseUrl: z.string().url().default('https://phoenix.arize.com'),
      batchSize: z.number().min(1).max(1000).default(100),
      datasetId: z.string().optional(),
      flushInterval: z.number().min(60000).max(3600000).default(300000), // 5 minutes
      modelId: z.string().min(1, 'Model ID is required'),
      retryAttempts: z.number().min(0).max(5).default(3),
      retryDelay: z.number().min(1000).max(10000).default(2000), // 2 seconds
      spaceKey: z.string().min(1, 'Space key is required'),
      timeout: z.number().min(5000).max(60000).default(30000), // 30 seconds
    })
    .optional(),
});

export class ArizeProvider extends BaseIntegrationProvider {
  readonly name = 'Arize AI';
  readonly destinationId = 'arize';

  private baseUrl: string;
  private spaceKey: string;
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
      (config.options?.baseUrl as string) || 'https://phoenix.arize.com';
    this.spaceKey = (config.options?.spaceKey as string) || '';
    this.modelId = (config.options?.modelId as string) || '';
    this.datasetId = (config.options?.datasetId as string) || this.modelId;
    this.batchSize = (config.options?.batchSize as number) || 100;
    this.flushInterval = (config.options?.flushInterval as number) || 300000; // 5 minutes
    this.timeout = (config.options?.timeout as number) || 30000; // 30 seconds
    this.retryAttempts = (config.options?.retryAttempts as number) || 3;
    this.retryDelay = (config.options?.retryDelay as number) || 2000; // 2 seconds

    if (!this.spaceKey) {
      throw new Error('Arize AI space key is required');
    }

    if (!this.modelId) {
      throw new Error('Arize AI model ID is required');
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
      ArizeConfigSchema.parse(config);
      return { success: true };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Invalid configuration',
        success: false,
      };
    }
  }

  getConfigSchema(): z.ZodSchema {
    return ArizeConfigSchema;
  }

  private addTraceToBuffer(trace: TraceData, context: TraceContext): void {
    this.dataBuffer.push({
      context,
      timestamp: new Date().toISOString(),
      trace,
    });

    // Flush if buffer is full
    if (this.dataBuffer.length >= this.batchSize) {
      this.flushToArize();
    }
  }

  private async flushToArize(): Promise<void> {
    if (this.dataBuffer.length === 0) {
      return;
    }

    const dataToFlush = [...this.dataBuffer];
    this.dataBuffer = [];

    try {
      await this.sendBatchToArize(dataToFlush);
    } catch (error) {
      console.error('[ArizeProvider] Failed to flush data to Arize:', error);
      // Re-add data to buffer for retry
      this.dataBuffer.unshift(...dataToFlush);
    }
  }

  private async sendBatchToArize(
    data: Array<{
      trace: TraceData;
      context: TraceContext;
      timestamp: string;
    }>,
  ): Promise<void> {
    // Transform data to Arize Phoenix format
    const arizeTraces = data.map((item) => ({
      attributes: {
        'api.key.id': item.context.apiKeyId,
        'ingestion.timestamp': item.timestamp,
        'llm.completion_tokens':
          item.trace.attributes?.['llm.completion_tokens'] || 0,
        'llm.max_tokens': item.trace.attributes?.['llm.max_tokens'] || 1000,
        // LLM attributes
        'llm.model': item.trace.attributes?.['llm.model'] || 'unknown',
        'llm.prompt_tokens': item.trace.attributes?.['llm.prompt_tokens'] || 0,
        'llm.temperature': item.trace.attributes?.['llm.temperature'] || 0.7,
        'llm.total_tokens': item.trace.attributes?.['llm.total_tokens'] || 0,
        // Context attributes
        'org.id': item.context.orgId,
        'project.id': item.context.projectId,
        source: 'untrace-sdk',
        // Performance attributes
        'trace.duration': item.trace.duration || 0,
        'trace.status': item.trace.status || 'unknown',
        'user.id': item.context.userId,
        // Additional attributes
        ...item.trace.attributes,
      },
      duration: item.trace.duration || 0,
      end_time:
        new Date(item.trace.timestamp).getTime() + (item.trace.duration || 0),
      events:
        item.trace.events?.map((event) => ({
          attributes: event.attributes || {},
          name: event.name,
          timestamp: new Date(event.timestamp).getTime(),
        })) || [],
      id: item.trace.id,
      name: item.trace.name || 'untrace-trace',
      spans:
        item.trace.spans?.map((span) => ({
          attributes: span.attributes || {},
          duration: span.duration || 0,
          end_time: new Date(span.timestamp).getTime() + (span.duration || 0),
          id: span.id,
          name: span.name || 'untrace-span',
          start_time: new Date(span.timestamp).getTime(),
        })) || [],
      start_time: new Date(item.trace.timestamp).getTime(),
      status: item.trace.status || 'unknown',
    }));

    const endpoint = this.buildEndpoint('/v1/spans');
    await this.makeRequestWithRetry(endpoint, {
      body: JSON.stringify({
        spans: arizeTraces,
      }),
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Untrace-SDK/1.0',
        'X-Space-Key': this.spaceKey,
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
            `Arize API error: ${response.status} ${response.statusText} - ${errorText}`,
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
      this.flushToArize();
    }, this.flushInterval);
  }

  async destroy(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
    await this.flushToArize();
  }
}

// Arize AI provider factory
export class ArizeProviderFactory implements ProviderFactory {
  createProvider(config: ProviderConfig, destinationId: string): ArizeProvider {
    return new ArizeProvider(config, destinationId);
  }

  getDestinationId(): string {
    return 'arize';
  }

  getConfigSchema(): z.ZodSchema {
    return ArizeConfigSchema;
  }
}

// Arize AI test runner
export class ArizeTestRunner extends BaseDestinationTestRunner {
  async testConnection(config: Record<string, unknown>): Promise<TestResult> {
    try {
      const apiKey = config.apiKey as string;
      const baseUrl = (config.baseUrl as string) || 'https://phoenix.arize.com';
      const spaceKey = config.spaceKey as string;
      const modelId = config.modelId as string;

      if (!apiKey) {
        return {
          details: {
            destination: this.destinationId,
            metadata: { config },
            testType: 'connection',
          },
          error: 'Missing required field: apiKey',
          message: 'API key is required for Arize AI destinations',
          success: false,
        };
      }

      if (!spaceKey) {
        return {
          details: {
            destination: this.destinationId,
            metadata: { config },
            testType: 'connection',
          },
          error: 'Missing required field: spaceKey',
          message: 'Space key is required for Arize AI destinations',
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
          message: 'Model ID is required for Arize AI destinations',
          success: false,
        };
      }

      // Test connection by making a request to Arize's API
      const testEndpoint = `${baseUrl}/v1/spans`;
      const response = await fetch(testEndpoint, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Untrace-SDK/1.0',
          'X-Space-Key': spaceKey,
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
          message: `Arize AI connection test failed: ${response.status} ${response.statusText}`,
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
        message: `Arize AI connection test to ${baseUrl} successful`,
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
        message: `Arize AI connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
      const baseUrl = (config.baseUrl as string) || 'https://phoenix.arize.com';
      const spaceKey = config.spaceKey as string;
      const modelId = config.modelId as string;

      if (!apiKey || !spaceKey || !modelId) {
        return {
          details: {
            destination: this.destinationId,
            metadata: { config, trace },
            testType: 'delivery',
          },
          error: 'Missing required fields for delivery test',
          message:
            'API key, space key, and model ID are required for Arize AI destinations',
          success: false,
        };
      }

      // Test delivery by sending a sample span
      const testEndpoint = `${baseUrl}/v1/spans`;
      const response = await fetch(testEndpoint, {
        body: JSON.stringify({
          spans: [
            {
              attributes: {
                'api.key.id': 'test-api-key',
                'ingestion.timestamp': new Date().toISOString(),
                'llm.completion_tokens': 5,
                'llm.max_tokens': 100,
                'llm.model': 'gpt-4',
                'llm.prompt_tokens': 10,
                'llm.temperature': 0.7,
                'llm.total_tokens': 15,
                'org.id': 'test-org',
                'project.id': 'test-project',
                source: 'untrace-sdk',
                test: true,
                'trace.duration': 100,
                'trace.status': 'ok',
                'user.id': 'test-user',
                ...trace,
              },
              duration: 100,
              end_time: Date.now() + 100,
              events: [],
              id: trace.id || 'test-trace-delivery',
              name: 'test-trace',
              spans: [],
              start_time: Date.now(),
              status: 'ok',
            },
          ],
        }),
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Untrace-SDK/1.0',
          'X-Space-Key': spaceKey,
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
          message: `Arize AI delivery test failed: ${response.status} ${response.statusText}`,
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
        message: `Arize AI delivery test to ${baseUrl} successful`,
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
        message: `Arize AI delivery test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        success: false,
      };
    }
  }

  async validateConfig(config: Record<string, unknown>): Promise<TestResult> {
    try {
      const apiKey = config.apiKey as string;
      const baseUrl = config.baseUrl as string;
      const spaceKey = config.spaceKey as string;
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
          message: 'API key is required for Arize AI destinations',
          success: false,
        };
      }

      if (!spaceKey) {
        return {
          details: {
            destination: this.destinationId,
            metadata: { config },
            testType: 'validation',
          },
          error: 'Missing required field: spaceKey',
          message: 'Space key is required for Arize AI destinations',
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
          message: 'Model ID is required for Arize AI destinations',
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
        message: 'Arize AI destination configuration is valid',
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

// Register the Arize AI provider and test runner
registerProvider(new ArizeProviderFactory());
registerDestinationTestRunner('arize', ArizeTestRunner);
