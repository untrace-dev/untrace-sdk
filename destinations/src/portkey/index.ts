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

// Portkey provider configuration schema
const PortkeyConfigSchema = z.object({
  apiKey: z.string().min(1, 'API key is required'),
  enabled: z.boolean().default(true),
  endpoint: z.string().optional(),
  options: z
    .object({
      baseUrl: z.string().url().default('https://api.portkey.ai'),
      batchSize: z.number().min(1).max(1000).default(100),
      flushInterval: z.number().min(60000).max(3600000).default(300000), // 5 minutes
      organizationId: z.string().optional(),
      retryAttempts: z.number().min(0).max(5).default(3),
      retryDelay: z.number().min(1000).max(10000).default(2000), // 2 seconds
      timeout: z.number().min(5000).max(60000).default(30000), // 30 seconds
      workspaceId: z.string().optional(),
    })
    .optional(),
});

export class PortkeyProvider extends BaseIntegrationProvider {
  readonly name = 'Portkey';
  readonly destinationId = 'portkey';

  private baseUrl: string;
  private organizationId?: string;
  private workspaceId?: string;
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
      (config.options?.baseUrl as string) || 'https://api.portkey.ai';
    this.organizationId = config.options?.organizationId as string;
    this.workspaceId = config.options?.workspaceId as string;
    this.batchSize = (config.options?.batchSize as number) || 100;
    this.flushInterval = (config.options?.flushInterval as number) || 300000; // 5 minutes
    this.timeout = (config.options?.timeout as number) || 30000; // 30 seconds
    this.retryAttempts = (config.options?.retryAttempts as number) || 3;
    this.retryDelay = (config.options?.retryDelay as number) || 2000; // 2 seconds

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
      PortkeyConfigSchema.parse(config);
      return { success: true };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Invalid configuration',
        success: false,
      };
    }
  }

  getConfigSchema(): z.ZodSchema {
    return PortkeyConfigSchema;
  }

  private addTraceToBuffer(trace: TraceData, context: TraceContext): void {
    this.dataBuffer.push({
      context,
      timestamp: new Date().toISOString(),
      trace,
    });

    // Flush if buffer is full
    if (this.dataBuffer.length >= this.batchSize) {
      this.flushToPortkey();
    }
  }

  private async flushToPortkey(): Promise<void> {
    if (this.dataBuffer.length === 0) {
      return;
    }

    const dataToFlush = [...this.dataBuffer];
    this.dataBuffer = [];

    try {
      await this.sendBatchToPortkey(dataToFlush);
    } catch (error) {
      console.error(
        '[PortkeyProvider] Failed to flush data to Portkey:',
        error,
      );
      // Re-add data to buffer for retry
      this.dataBuffer.unshift(...dataToFlush);
    }
  }

  private async sendBatchToPortkey(
    data: Array<{
      trace: TraceData;
      context: TraceContext;
      timestamp: string;
    }>,
  ): Promise<void> {
    // Transform data to Portkey format
    const portkeyLogs = data.map((item) => ({
      duration: item.trace.duration || 0,
      id: item.trace.id,
      metadata: {
        api_key_id: item.context.apiKeyId,
        attributes: item.trace.attributes || {},
        events: item.trace.events || [],
        ingestion_timestamp: item.timestamp,
        org_id: item.context.orgId,
        project_id: item.context.projectId,
        source: 'untrace-sdk',
        spans: item.trace.spans || [],
        trace_duration: item.trace.duration,
        trace_status: item.trace.status,
        trace_timestamp: item.trace.timestamp,
        user_id: item.context.userId,
      },
      request: {
        max_tokens: item.trace.attributes?.['llm.max_tokens'] || 1000,
        messages: item.trace.attributes?.['llm.messages'] || [],
        model: item.trace.attributes?.['llm.model'] || 'unknown',
        temperature: item.trace.attributes?.['llm.temperature'] || 0,
      },
      response: {
        content: item.trace.attributes?.['llm.response'] || '',
        finish_reason: item.trace.status === 'error' ? 'error' : 'stop',
        tokens_used: item.trace.attributes?.['llm.total_tokens'] || 0,
      },
      status: item.trace.status || 'unknown',
      timestamp: item.trace.timestamp,
    }));

    const endpoint = this.buildEndpoint('/v1/logs');
    await this.makeRequestWithRetry(endpoint, {
      body: JSON.stringify({
        logs: portkeyLogs,
        organization_id: this.organizationId,
        workspace_id: this.workspaceId,
      }),
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Untrace-SDK/1.0',
        'x-portkey-api-key': this.config.apiKey,
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
            `Portkey API error: ${response.status} ${response.statusText} - ${errorText}`,
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
      this.flushToPortkey();
    }, this.flushInterval);
  }

  async destroy(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
    await this.flushToPortkey();
  }
}

// Portkey provider factory
export class PortkeyProviderFactory implements ProviderFactory {
  createProvider(
    config: ProviderConfig,
    destinationId: string,
  ): PortkeyProvider {
    return new PortkeyProvider(config, destinationId);
  }

  getDestinationId(): string {
    return 'portkey';
  }

  getConfigSchema(): z.ZodSchema {
    return PortkeyConfigSchema;
  }
}

// Portkey test runner
export class PortkeyTestRunner extends BaseDestinationTestRunner {
  async testConnection(config: Record<string, unknown>): Promise<TestResult> {
    try {
      const apiKey = config.apiKey as string;
      const baseUrl = (config.baseUrl as string) || 'https://api.portkey.ai';

      if (!apiKey) {
        return {
          details: {
            destination: this.destinationId,
            metadata: { config },
            testType: 'connection',
          },
          error: 'Missing required field: apiKey',
          message: 'API key is required for Portkey destinations',
          success: false,
        };
      }

      // Test connection by making a request to Portkey's API
      const testEndpoint = `${baseUrl}/v1/organizations`;
      const response = await fetch(testEndpoint, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Untrace-SDK/1.0',
          'x-portkey-api-key': apiKey,
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
          message: `Portkey connection test failed: ${response.status} ${response.statusText}`,
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
        message: `Portkey connection test to ${baseUrl} successful`,
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
        message: `Portkey connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
      const baseUrl = (config.baseUrl as string) || 'https://api.portkey.ai';
      const organizationId = config.organizationId as string;
      const workspaceId = config.workspaceId as string;

      if (!apiKey) {
        return {
          details: {
            destination: this.destinationId,
            metadata: { config, trace },
            testType: 'delivery',
          },
          error: 'Missing required field: apiKey',
          message: 'API key is required for Portkey destinations',
          success: false,
        };
      }

      // Test delivery by sending a sample log
      const testEndpoint = `${baseUrl}/v1/logs`;
      const response = await fetch(testEndpoint, {
        body: JSON.stringify({
          logs: [
            {
              duration: 100,
              id: trace.id || 'test-trace-delivery',
              metadata: {
                api_key_id: 'test-api-key',
                attributes: { test: true },
                events: [],
                ingestion_timestamp: new Date().toISOString(),
                org_id: 'test-org',
                project_id: 'test-project',
                source: 'untrace-sdk-test',
                spans: [],
                trace_duration: 100,
                trace_status: 'ok',
                trace_timestamp: new Date().toISOString(),
                user_id: 'test-user',
                ...trace,
              },
              request: {
                max_tokens: 100,
                messages: [{ content: 'Hello, world!', role: 'user' }],
                model: 'gpt-4',
                temperature: 0.7,
              },
              response: {
                content: 'Hello! How can I help you today?',
                finish_reason: 'stop',
                tokens_used: 15,
              },
              status: 'ok',
              timestamp: new Date().toISOString(),
            },
          ],
          organization_id: organizationId,
          workspace_id: workspaceId,
        }),
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Untrace-SDK/1.0',
          'x-portkey-api-key': apiKey,
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
          message: `Portkey delivery test failed: ${response.status} ${response.statusText}`,
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
        message: `Portkey delivery test to ${baseUrl} successful`,
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
        message: `Portkey delivery test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        success: false,
      };
    }
  }

  async validateConfig(config: Record<string, unknown>): Promise<TestResult> {
    try {
      const apiKey = config.apiKey as string;
      const baseUrl = config.baseUrl as string;
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
          message: 'API key is required for Portkey destinations',
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
        message: 'Portkey destination configuration is valid',
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

// Register the Portkey provider and test runner
registerProvider(new PortkeyProviderFactory());
registerDestinationTestRunner('portkey', PortkeyTestRunner);
