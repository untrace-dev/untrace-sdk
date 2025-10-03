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

// HoneyHive provider configuration schema
const HoneyHiveConfigSchema = z.object({
  apiKey: z.string().min(1, 'API key is required'),
  enabled: z.boolean().default(true),
  endpoint: z.string().optional(),
  options: z
    .object({
      baseUrl: z.string().url().default('https://api.honeyhive.ai'),
      batchSize: z.number().min(1).max(1000).default(100),
      flushInterval: z.number().min(60000).max(3600000).default(300000), // 5 minutes
      project: z.string().min(1, 'Project is required'),
      retryAttempts: z.number().min(0).max(5).default(3),
      retryDelay: z.number().min(1000).max(10000).default(2000), // 2 seconds
      sessionName: z.string().default('untrace-session'),
      source: z.string().default('production'),
      timeout: z.number().min(5000).max(60000).default(30000), // 30 seconds
    })
    .optional(),
});

export class HoneyHiveProvider extends BaseIntegrationProvider {
  readonly name = 'HoneyHive';
  readonly destinationId = 'honeyhive';

  private baseUrl: string;
  private project: string;
  private source: string;
  private sessionName: string;
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
      (config.options?.baseUrl as string) || 'https://api.honeyhive.ai';
    this.project = (config.options?.project as string) || '';
    this.source = (config.options?.source as string) || 'production';
    this.sessionName =
      (config.options?.sessionName as string) || 'untrace-session';
    this.batchSize = (config.options?.batchSize as number) || 100;
    this.flushInterval = (config.options?.flushInterval as number) || 300000; // 5 minutes
    this.timeout = (config.options?.timeout as number) || 30000; // 30 seconds
    this.retryAttempts = (config.options?.retryAttempts as number) || 3;
    this.retryDelay = (config.options?.retryDelay as number) || 2000; // 2 seconds

    if (!this.project) {
      throw new Error('HoneyHive project is required');
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
      HoneyHiveConfigSchema.parse(config);
      return { success: true };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Invalid configuration',
        success: false,
      };
    }
  }

  getConfigSchema(): z.ZodSchema {
    return HoneyHiveConfigSchema;
  }

  private addTraceToBuffer(trace: TraceData, context: TraceContext): void {
    this.dataBuffer.push({
      context,
      timestamp: new Date().toISOString(),
      trace,
    });

    // Flush if buffer is full
    if (this.dataBuffer.length >= this.batchSize) {
      this.flushToHoneyHive();
    }
  }

  private async flushToHoneyHive(): Promise<void> {
    if (this.dataBuffer.length === 0) {
      return;
    }

    const dataToFlush = [...this.dataBuffer];
    this.dataBuffer = [];

    try {
      await this.sendBatchToHoneyHive(dataToFlush);
    } catch (error) {
      console.error(
        '[HoneyHiveProvider] Failed to flush data to HoneyHive:',
        error,
      );
      // Re-add data to buffer for retry
      this.dataBuffer.unshift(...dataToFlush);
    }
  }

  private async sendBatchToHoneyHive(
    data: Array<{
      trace: TraceData;
      context: TraceContext;
      timestamp: string;
    }>,
  ): Promise<void> {
    // Transform data to HoneyHive format
    const honeyHiveTraces = data.map((item) => ({
      attributes: {
        api_key_id: item.context.apiKeyId,
        ingestion_timestamp: item.timestamp,
        max_tokens: item.trace.attributes?.['llm.max_tokens'] || 1000,
        model: item.trace.attributes?.['llm.model'] || 'unknown',
        org_id: item.context.orgId,
        project_id: item.context.projectId,
        session_name: this.sessionName,
        source: this.source,
        temperature: item.trace.attributes?.['llm.temperature'] || 0.7,
        total_tokens: item.trace.attributes?.['llm.total_tokens'] || 0,
        user_id: item.context.userId,
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
      operation_name: item.trace.name || 'untrace-trace',
      parent_span_id: null,
      span_id: item.trace.id,
      spans:
        item.trace.spans?.map((span) => ({
          attributes: span.attributes || {},
          duration: span.duration || 0,
          end_time: new Date(span.timestamp).getTime() + (span.duration || 0),
          operation_name: span.name || 'untrace-span',
          span_id: span.id,
          start_time: new Date(span.timestamp).getTime(),
        })) || [],
      start_time: new Date(item.trace.timestamp).getTime(),
      status: item.trace.status || 'unknown',
      trace_id: item.trace.id,
    }));

    const endpoint = this.buildEndpoint('/v1/traces');
    await this.makeRequestWithRetry(endpoint, {
      body: JSON.stringify({
        project: this.project,
        session_name: this.sessionName,
        source: this.source,
        traces: honeyHiveTraces,
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
            `HoneyHive API error: ${response.status} ${response.statusText} - ${errorText}`,
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
      this.flushToHoneyHive();
    }, this.flushInterval);
  }

  async destroy(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
    await this.flushToHoneyHive();
  }
}

// HoneyHive provider factory
export class HoneyHiveProviderFactory implements ProviderFactory {
  createProvider(
    config: ProviderConfig,
    destinationId: string,
  ): HoneyHiveProvider {
    return new HoneyHiveProvider(config, destinationId);
  }

  getDestinationId(): string {
    return 'honeyhive';
  }

  getConfigSchema(): z.ZodSchema {
    return HoneyHiveConfigSchema;
  }
}

// HoneyHive test runner
export class HoneyHiveTestRunner extends BaseDestinationTestRunner {
  async testConnection(config: Record<string, unknown>): Promise<TestResult> {
    try {
      const apiKey = config.apiKey as string;
      const baseUrl = (config.baseUrl as string) || 'https://api.honeyhive.ai';
      const project = config.project as string;

      if (!apiKey) {
        return {
          details: {
            destination: this.destinationId,
            metadata: { config },
            testType: 'connection',
          },
          error: 'Missing required field: apiKey',
          message: 'API key is required for HoneyHive destinations',
          success: false,
        };
      }

      if (!project) {
        return {
          details: {
            destination: this.destinationId,
            metadata: { config },
            testType: 'connection',
          },
          error: 'Missing required field: project',
          message: 'Project is required for HoneyHive destinations',
          success: false,
        };
      }

      // Test connection by making a request to HoneyHive's API
      const testEndpoint = `${baseUrl}/v1/projects/${project}`;
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
          message: `HoneyHive connection test failed: ${response.status} ${response.statusText}`,
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
        message: `HoneyHive connection test to ${baseUrl} successful`,
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
        message: `HoneyHive connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
      const baseUrl = (config.baseUrl as string) || 'https://api.honeyhive.ai';
      const project = config.project as string;
      const source = (config.source as string) || 'production';
      const sessionName = (config.sessionName as string) || 'untrace-session';

      if (!apiKey || !project) {
        return {
          details: {
            destination: this.destinationId,
            metadata: { config, trace },
            testType: 'delivery',
          },
          error: 'Missing required fields for delivery test',
          message:
            'API key and project are required for HoneyHive destinations',
          success: false,
        };
      }

      // Test delivery by sending a sample trace
      const testEndpoint = `${baseUrl}/v1/traces`;
      const response = await fetch(testEndpoint, {
        body: JSON.stringify({
          project: project,
          session_name: sessionName,
          source: source,
          traces: [
            {
              attributes: {
                api_key_id: 'test-api-key',
                ingestion_timestamp: new Date().toISOString(),
                max_tokens: 100,
                model: 'gpt-4',
                org_id: 'test-org',
                project_id: 'test-project',
                session_name: sessionName,
                source: source,
                temperature: 0.7,
                test: true,
                total_tokens: 15,
                user_id: 'test-user',
                ...trace,
              },
              duration: 100,
              end_time: Date.now() + 100,
              events: [],
              operation_name: 'test-trace',
              parent_span_id: null,
              span_id: trace.id || 'test-trace-delivery',
              spans: [],
              start_time: Date.now(),
              status: 'ok',
              trace_id: trace.id || 'test-trace-delivery',
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
          message: `HoneyHive delivery test failed: ${response.status} ${response.statusText}`,
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
        message: `HoneyHive delivery test to ${baseUrl} successful`,
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
        message: `HoneyHive delivery test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        success: false,
      };
    }
  }

  async validateConfig(config: Record<string, unknown>): Promise<TestResult> {
    try {
      const apiKey = config.apiKey as string;
      const baseUrl = config.baseUrl as string;
      const project = config.project as string;
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
          message: 'API key is required for HoneyHive destinations',
          success: false,
        };
      }

      if (!project) {
        return {
          details: {
            destination: this.destinationId,
            metadata: { config },
            testType: 'validation',
          },
          error: 'Missing required field: project',
          message: 'Project is required for HoneyHive destinations',
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
        message: 'HoneyHive destination configuration is valid',
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

// Register the HoneyHive provider and test runner
registerProvider(new HoneyHiveProviderFactory());
registerDestinationTestRunner('honeyhive', HoneyHiveTestRunner);
