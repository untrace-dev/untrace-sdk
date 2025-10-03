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

// W&B Weave provider configuration schema
const WeaveConfigSchema = z.object({
  apiKey: z.string().min(1, 'API key is required'),
  enabled: z.boolean().default(true),
  endpoint: z.string().optional(),
  options: z
    .object({
      baseUrl: z.string().url().default('https://trace.wandb.ai'),
      batchSize: z.number().min(1).max(1000).default(100),
      entity: z.string().optional(),
      flushInterval: z.number().min(60000).max(3600000).default(300000), // 5 minutes
      project: z.string().min(1, 'Project is required'),
      retryAttempts: z.number().min(0).max(5).default(3),
      retryDelay: z.number().min(1000).max(10000).default(2000), // 2 seconds
      timeout: z.number().min(5000).max(60000).default(30000), // 30 seconds
    })
    .optional(),
});

export class WeaveProvider extends BaseIntegrationProvider {
  readonly name = 'W&B Weave';
  readonly destinationId = 'weave';

  private baseUrl: string;
  private project: string;
  private entity?: string;
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
      (config.options?.baseUrl as string) || 'https://trace.wandb.ai';
    this.project = (config.options?.project as string) || '';
    this.entity = config.options?.entity as string;
    this.batchSize = (config.options?.batchSize as number) || 100;
    this.flushInterval = (config.options?.flushInterval as number) || 300000; // 5 minutes
    this.timeout = (config.options?.timeout as number) || 30000; // 30 seconds
    this.retryAttempts = (config.options?.retryAttempts as number) || 3;
    this.retryDelay = (config.options?.retryDelay as number) || 2000; // 2 seconds

    if (!this.project) {
      throw new Error('W&B Weave project is required');
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
      WeaveConfigSchema.parse(config);
      return { success: true };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Invalid configuration',
        success: false,
      };
    }
  }

  getConfigSchema(): z.ZodSchema {
    return WeaveConfigSchema;
  }

  private addTraceToBuffer(trace: TraceData, context: TraceContext): void {
    this.dataBuffer.push({
      context,
      timestamp: new Date().toISOString(),
      trace,
    });

    // Flush if buffer is full
    if (this.dataBuffer.length >= this.batchSize) {
      this.flushToWeave();
    }
  }

  private async flushToWeave(): Promise<void> {
    if (this.dataBuffer.length === 0) {
      return;
    }

    const dataToFlush = [...this.dataBuffer];
    this.dataBuffer = [];

    try {
      await this.sendBatchToWeave(dataToFlush);
    } catch (error) {
      console.error(
        '[WeaveProvider] Failed to flush data to W&B Weave:',
        error,
      );
      // Re-add data to buffer for retry
      this.dataBuffer.unshift(...dataToFlush);
    }
  }

  private async sendBatchToWeave(
    data: Array<{
      trace: TraceData;
      context: TraceContext;
      timestamp: string;
    }>,
  ): Promise<void> {
    // Transform data to W&B Weave format
    const weaveTraces = data.map((item) => ({
      resourceSpans: [
        {
          resource: {
            attributes: [
              {
                key: 'service.name',
                value: {
                  stringValue: 'untrace-sdk',
                },
              },
              {
                key: 'service.version',
                value: {
                  stringValue: '1.0.0',
                },
              },
              {
                key: 'org.id',
                value: {
                  stringValue: item.context.orgId,
                },
              },
              {
                key: 'project.id',
                value: {
                  stringValue: item.context.projectId,
                },
              },
              {
                key: 'user.id',
                value: {
                  stringValue: item.context.userId || '',
                },
              },
              {
                key: 'api.key.id',
                value: {
                  stringValue: item.context.apiKeyId || '',
                },
              },
            ],
          },
          scopeSpans: [
            {
              scope: {
                name: 'untrace-sdk',
                version: '1.0.0',
              },
              spans: [
                {
                  attributes: [
                    {
                      key: 'trace.status',
                      value: {
                        stringValue: item.trace.status || 'unknown',
                      },
                    },
                    {
                      key: 'trace.duration',
                      value: {
                        intValue: item.trace.duration || 0,
                      },
                    },
                    {
                      key: 'llm.model',
                      value: {
                        stringValue:
                          item.trace.attributes?.['llm.model'] || 'unknown',
                      },
                    },
                    {
                      key: 'llm.temperature',
                      value: {
                        doubleValue:
                          item.trace.attributes?.['llm.temperature'] || 0.7,
                      },
                    },
                    {
                      key: 'llm.max_tokens',
                      value: {
                        intValue:
                          item.trace.attributes?.['llm.max_tokens'] || 1000,
                      },
                    },
                    {
                      key: 'llm.total_tokens',
                      value: {
                        intValue:
                          item.trace.attributes?.['llm.total_tokens'] || 0,
                      },
                    },
                    {
                      key: 'ingestion.timestamp',
                      value: {
                        stringValue: item.timestamp,
                      },
                    },
                  ],
                  endTimeUnixNano:
                    (new Date(item.trace.timestamp).getTime() +
                      (item.trace.duration || 0)) *
                    1000000,
                  events:
                    item.trace.events?.map((event) => ({
                      attributes: Object.entries(event.attributes || {}).map(
                        ([key, value]) => ({
                          key,
                          value: {
                            stringValue: String(value),
                          },
                        }),
                      ),
                      name: event.name,
                      timeUnixNano:
                        new Date(event.timestamp).getTime() * 1000000,
                    })) || [],
                  kind: 1, // SPAN_KIND_INTERNAL
                  links: [],
                  name: item.trace.name || 'untrace-trace',
                  parentSpanId: '',
                  spanId: item.trace.id,
                  startTimeUnixNano:
                    new Date(item.trace.timestamp).getTime() * 1000000,
                  status: {
                    code: item.trace.status === 'error' ? 2 : 1, // 1 = OK, 2 = ERROR
                  },
                  traceId: item.trace.id,
                },
              ],
            },
          ],
        },
      ],
    }));

    const endpoint = this.buildEndpoint('/otel/v1/traces');
    await this.makeRequestWithRetry(endpoint, {
      body: JSON.stringify(weaveTraces),
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.config.apiKey}:`).toString('base64')}`,
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
            `W&B Weave API error: ${response.status} ${response.statusText} - ${errorText}`,
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
      this.flushToWeave();
    }, this.flushInterval);
  }

  async destroy(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
    await this.flushToWeave();
  }
}

// W&B Weave provider factory
export class WeaveProviderFactory implements ProviderFactory {
  createProvider(config: ProviderConfig, destinationId: string): WeaveProvider {
    return new WeaveProvider(config, destinationId);
  }

  getDestinationId(): string {
    return 'weave';
  }

  getConfigSchema(): z.ZodSchema {
    return WeaveConfigSchema;
  }
}

// W&B Weave test runner
export class WeaveTestRunner extends BaseDestinationTestRunner {
  async testConnection(config: Record<string, unknown>): Promise<TestResult> {
    try {
      const apiKey = config.apiKey as string;
      const baseUrl = (config.baseUrl as string) || 'https://trace.wandb.ai';
      const project = config.project as string;

      if (!apiKey) {
        return {
          details: {
            destination: this.destinationId,
            metadata: { config },
            testType: 'connection',
          },
          error: 'Missing required field: apiKey',
          message: 'API key is required for W&B Weave destinations',
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
          message: 'Project is required for W&B Weave destinations',
          success: false,
        };
      }

      // Test connection by making a request to W&B Weave's API
      const testEndpoint = `${baseUrl}/otel/v1/traces`;
      const response = await fetch(testEndpoint, {
        body: JSON.stringify([
          {
            resourceSpans: [
              {
                resource: {
                  attributes: [
                    {
                      key: 'service.name',
                      value: {
                        stringValue: 'untrace-sdk-test',
                      },
                    },
                  ],
                },
                scopeSpans: [
                  {
                    scope: {
                      name: 'untrace-sdk-test',
                      version: '1.0.0',
                    },
                    spans: [
                      {
                        attributes: [],
                        endTimeUnixNano: (Date.now() + 100) * 1000000,
                        events: [],
                        kind: 1,
                        links: [],
                        name: 'test-connection',
                        parentSpanId: '',
                        spanId: 'test-span-id',
                        startTimeUnixNano: Date.now() * 1000000,
                        status: {
                          code: 1,
                        },
                        traceId: 'test-trace-id',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ]),
        headers: {
          Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`,
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
            },
            testType: 'connection',
          },
          error: `HTTP ${response.status}: ${response.statusText}`,
          message: `W&B Weave connection test failed: ${response.status} ${response.statusText}`,
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
        message: `W&B Weave connection test to ${baseUrl} successful`,
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
        message: `W&B Weave connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
      const baseUrl = (config.baseUrl as string) || 'https://trace.wandb.ai';
      const project = config.project as string;

      if (!apiKey || !project) {
        return {
          details: {
            destination: this.destinationId,
            metadata: { config, trace },
            testType: 'delivery',
          },
          error: 'Missing required fields for delivery test',
          message:
            'API key and project are required for W&B Weave destinations',
          success: false,
        };
      }

      // Test delivery by sending a sample trace
      const testEndpoint = `${baseUrl}/otel/v1/traces`;
      const response = await fetch(testEndpoint, {
        body: JSON.stringify([
          {
            resourceSpans: [
              {
                resource: {
                  attributes: [
                    {
                      key: 'service.name',
                      value: {
                        stringValue: 'untrace-sdk-test',
                      },
                    },
                    {
                      key: 'org.id',
                      value: {
                        stringValue: 'test-org',
                      },
                    },
                    {
                      key: 'project.id',
                      value: {
                        stringValue: 'test-project',
                      },
                    },
                    {
                      key: 'user.id',
                      value: {
                        stringValue: 'test-user',
                      },
                    },
                    {
                      key: 'api.key.id',
                      value: {
                        stringValue: 'test-api-key',
                      },
                    },
                  ],
                },
                scopeSpans: [
                  {
                    scope: {
                      name: 'untrace-sdk-test',
                      version: '1.0.0',
                    },
                    spans: [
                      {
                        attributes: [
                          {
                            key: 'trace.status',
                            value: {
                              stringValue: 'ok',
                            },
                          },
                          {
                            key: 'trace.duration',
                            value: {
                              intValue: 100,
                            },
                          },
                          {
                            key: 'llm.model',
                            value: {
                              stringValue: 'gpt-4',
                            },
                          },
                          {
                            key: 'llm.temperature',
                            value: {
                              doubleValue: 0.7,
                            },
                          },
                          {
                            key: 'llm.max_tokens',
                            value: {
                              intValue: 100,
                            },
                          },
                          {
                            key: 'llm.total_tokens',
                            value: {
                              intValue: 15,
                            },
                          },
                          {
                            key: 'ingestion.timestamp',
                            value: {
                              stringValue: new Date().toISOString(),
                            },
                          },
                        ],
                        endTimeUnixNano: (Date.now() + 100) * 1000000,
                        events: [],
                        kind: 1,
                        links: [],
                        name: 'test-trace',
                        parentSpanId: '',
                        spanId: trace.id || 'test-trace-delivery',
                        startTimeUnixNano: Date.now() * 1000000,
                        status: {
                          code: 1,
                        },
                        traceId: trace.id || 'test-trace-delivery',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ]),
        headers: {
          Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`,
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
          message: `W&B Weave delivery test failed: ${response.status} ${response.statusText}`,
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
        message: `W&B Weave delivery test to ${baseUrl} successful`,
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
        message: `W&B Weave delivery test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
          message: 'API key is required for W&B Weave destinations',
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
          message: 'Project is required for W&B Weave destinations',
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
        message: 'W&B Weave destination configuration is valid',
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

// Register the W&B Weave provider and test runner
registerProvider(new WeaveProviderFactory());
registerDestinationTestRunner('weave', WeaveTestRunner);
