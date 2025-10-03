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

// Grafana provider configuration schema
const GrafanaConfigSchema = z.object({
  apiKey: z.string().min(1, 'API key is required'),
  enabled: z.boolean().default(true),
  endpoint: z.string().optional(),
  options: z
    .object({
      baseUrl: z.string().url().min(1, 'Base URL is required'),
      batchSize: z.number().min(1).max(1000).default(100),
      dataSourceName: z.string().default('tempo'),
      flushInterval: z.number().min(60000).max(3600000).default(300000), // 5 minutes
      orgId: z.number().default(1),
      retryAttempts: z.number().min(0).max(5).default(3),
      retryDelay: z.number().min(1000).max(10000).default(2000), // 2 seconds
      timeout: z.number().min(5000).max(60000).default(30000), // 30 seconds
      useTempo: z.boolean().default(true),
    })
    .optional(),
});

export class GrafanaProvider extends BaseIntegrationProvider {
  readonly name = 'Grafana';
  readonly destinationId = 'grafana';

  private baseUrl: string;
  private orgId: number;
  private dataSourceName: string;
  private batchSize: number;
  private flushInterval: number;
  private timeout: number;
  private retryAttempts: number;
  private retryDelay: number;
  private useTempo: boolean;
  private dataBuffer: Array<{
    trace: TraceData;
    context: TraceContext;
    timestamp: string;
  }> = [];
  private flushTimer?: NodeJS.Timeout;

  constructor(config: ProviderConfig, destinationId: string) {
    super(config, destinationId);
    this.baseUrl = (config.options?.baseUrl as string) || '';
    this.orgId = (config.options?.orgId as number) || 1;
    this.dataSourceName = (config.options?.dataSourceName as string) || 'tempo';
    this.batchSize = (config.options?.batchSize as number) || 100;
    this.flushInterval = (config.options?.flushInterval as number) || 300000; // 5 minutes
    this.timeout = (config.options?.timeout as number) || 30000; // 30 seconds
    this.retryAttempts = (config.options?.retryAttempts as number) || 3;
    this.retryDelay = (config.options?.retryDelay as number) || 2000; // 2 seconds
    this.useTempo = (config.options?.useTempo as boolean) ?? true;

    if (!this.baseUrl) {
      throw new Error('Grafana base URL is required');
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
      GrafanaConfigSchema.parse(config);
      return { success: true };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Invalid configuration',
        success: false,
      };
    }
  }

  getConfigSchema(): z.ZodSchema {
    return GrafanaConfigSchema;
  }

  private addTraceToBuffer(trace: TraceData, context: TraceContext): void {
    this.dataBuffer.push({
      context,
      timestamp: new Date().toISOString(),
      trace,
    });

    // Flush if buffer is full
    if (this.dataBuffer.length >= this.batchSize) {
      this.flushToGrafana();
    }
  }

  private async flushToGrafana(): Promise<void> {
    if (this.dataBuffer.length === 0) {
      return;
    }

    const dataToFlush = [...this.dataBuffer];
    this.dataBuffer = [];

    try {
      await this.sendBatchToGrafana(dataToFlush);
    } catch (error) {
      console.error(
        '[GrafanaProvider] Failed to flush data to Grafana:',
        error,
      );
      // Re-add data to buffer for retry
      this.dataBuffer.unshift(...dataToFlush);
    }
  }

  private async sendBatchToGrafana(
    data: Array<{
      trace: TraceData;
      context: TraceContext;
      timestamp: string;
    }>,
  ): Promise<void> {
    if (this.useTempo) {
      await this.sendToTempo(data);
    } else {
      await this.sendToGrafanaAPI(data);
    }
  }

  private async sendToTempo(
    data: Array<{
      trace: TraceData;
      context: TraceContext;
      timestamp: string;
    }>,
  ): Promise<void> {
    // Transform data to Tempo format
    const tempoTraces = data.map((item) => ({
      spans:
        item.trace.spans?.map((span) => ({
          duration: (span.duration || 0) * 1000, // Convert to microseconds
          logs:
            item.trace.events?.map((event) => ({
              fields: [
                { key: 'event.name', value: event.name },
                ...Object.entries(event.attributes || {}).map(
                  ([key, value]) => ({
                    key,
                    value: String(value),
                  }),
                ),
              ],
              timestamp: new Date(event.timestamp).getTime() * 1000,
            })) || [],
          operationName: span.name,
          parentSpanID: span.id, // Simplified for demo
          spanID: span.id,
          startTime: new Date(span.timestamp).getTime() * 1000, // Convert to microseconds
          tags: [
            { key: 'service.name', value: 'untrace-sdk' },
            { key: 'org.id', value: item.context.orgId },
            { key: 'project.id', value: item.context.projectId },
            { key: 'user.id', value: item.context.userId || '' },
            { key: 'api.key.id', value: item.context.apiKeyId || '' },
            ...Object.entries(span.attributes || {}).map(([key, value]) => ({
              key,
              value: String(value),
            })),
          ],
          traceID: item.trace.id,
        })) || [],
      traceID: item.trace.id,
    }));

    // Send to Tempo API
    const endpoint = this.buildEndpoint('/api/traces');
    await this.makeRequestWithRetry(endpoint, {
      body: JSON.stringify(tempoTraces),
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  private async sendToGrafanaAPI(
    data: Array<{
      trace: TraceData;
      context: TraceContext;
      timestamp: string;
    }>,
  ): Promise<void> {
    // Transform data to Grafana format
    const grafanaData = data.map((item) => ({
      fields: {
        api_key_id: item.context.apiKeyId,
        attributes: JSON.stringify(item.trace.attributes || {}),
        events: JSON.stringify(item.trace.events || []),
        ingestion_timestamp: item.timestamp,
        org_id: item.context.orgId,
        project_id: item.context.projectId,
        spans: JSON.stringify(item.trace.spans || []),
        trace_duration: item.trace.duration,
        trace_id: item.trace.id,
        trace_name: item.trace.name,
        trace_status: item.trace.status,
        user_id: item.context.userId,
      },
      timestamp: new Date(item.trace.timestamp).getTime(),
    }));

    // Send to Grafana data source
    const endpoint = this.buildEndpoint('/api/ds/query');
    const payload = {
      from: Date.now() - 3600000, // 1 hour ago
      queries: [
        {
          datasource: {
            type: 'grafana-json-datasource',
            uid: this.dataSourceName,
          },
          format: 'table',
          rawSql: `INSERT INTO traces (timestamp, fields) VALUES ${grafanaData
            .map(
              (item) => `(${item.timestamp}, '${JSON.stringify(item.fields)}')`,
            )
            .join(', ')}`,
          refId: 'A',
        },
      ],
      to: Date.now(),
    };

    await this.makeRequestWithRetry(endpoint, {
      body: JSON.stringify(payload),
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        'X-Grafana-Org-Id': this.orgId.toString(),
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
            `Grafana API error: ${response.status} ${response.statusText} - ${errorText}`,
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
      this.flushToGrafana();
    }, this.flushInterval);
  }

  async destroy(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
    await this.flushToGrafana();
  }
}

// Grafana provider factory
export class GrafanaProviderFactory implements ProviderFactory {
  createProvider(
    config: ProviderConfig,
    destinationId: string,
  ): GrafanaProvider {
    return new GrafanaProvider(config, destinationId);
  }

  getDestinationId(): string {
    return 'grafana';
  }

  getConfigSchema(): z.ZodSchema {
    return GrafanaConfigSchema;
  }
}

// Grafana test runner
export class GrafanaTestRunner extends BaseDestinationTestRunner {
  async testConnection(config: Record<string, unknown>): Promise<TestResult> {
    try {
      const apiKey = config.apiKey as string;
      const baseUrl = (config.baseUrl as string) || '';
      const orgId = (config.orgId as number) || 1;

      if (!apiKey) {
        return {
          details: {
            destination: this.destinationId,
            metadata: { config },
            testType: 'connection',
          },
          error: 'Missing required field: apiKey',
          message: 'API key is required for Grafana destinations',
          success: false,
        };
      }

      if (!baseUrl) {
        return {
          details: {
            destination: this.destinationId,
            metadata: { config },
            testType: 'connection',
          },
          error: 'Missing required field: baseUrl',
          message: 'Base URL is required for Grafana destinations',
          success: false,
        };
      }

      // Test connection by making a request to Grafana's API
      const testEndpoint = `${baseUrl}/api/org`;
      const response = await fetch(testEndpoint, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'X-Grafana-Org-Id': orgId.toString(),
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
          message: `Grafana connection test failed: ${response.status} ${response.statusText}`,
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
        message: `Grafana connection test to ${baseUrl} successful`,
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
        message: `Grafana connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
      const baseUrl = (config.baseUrl as string) || '';
      const orgId = (config.orgId as number) || 1;
      const useTempo = (config.useTempo as boolean) ?? true;

      if (!apiKey || !baseUrl) {
        return {
          details: {
            destination: this.destinationId,
            metadata: { config, trace },
            testType: 'delivery',
          },
          error: 'Missing required fields for delivery test',
          message:
            'API key and base URL are required for Grafana delivery test',
          success: false,
        };
      }

      // Test delivery by sending a sample trace
      const testEndpoint = useTempo
        ? `${baseUrl}/api/traces`
        : `${baseUrl}/api/ds/query`;

      const headers: Record<string, string> = {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Grafana-Org-Id': orgId.toString(),
      };

      let testPayload: unknown;

      if (useTempo) {
        // Tempo format
        testPayload = [
          {
            spans: [
              {
                duration: 100000,
                logs: [],
                operationName: 'test-operation',
                parentSpanID: '',
                spanID: 'test-span-1',
                startTime: Date.now() * 1000,
                tags: [
                  { key: 'service.name', value: 'untrace-sdk-test' },
                  { key: 'test', value: 'true' },
                ],
                traceID: trace.id || 'test-trace-delivery',
              },
            ],
            traceID: trace.id || 'test-trace-delivery',
          },
        ];
      } else {
        // Grafana API format
        testPayload = {
          from: Date.now() - 3600000,
          queries: [
            {
              datasource: {
                type: 'grafana-json-datasource',
                uid: 'test',
              },
              format: 'table',
              rawSql: `INSERT INTO traces (timestamp, fields) VALUES (${Date.now()}, '${JSON.stringify(
                {
                  test: true,
                  trace_id: trace.id || 'test-trace-delivery',
                },
              )}')`,
              refId: 'A',
            },
          ],
          to: Date.now(),
        };
      }

      const response = await fetch(testEndpoint, {
        body: JSON.stringify(testPayload),
        headers,
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
          message: `Grafana delivery test failed: ${response.status} ${response.statusText}`,
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
        message: `Grafana delivery test to ${baseUrl} successful`,
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
        message: `Grafana delivery test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        success: false,
      };
    }
  }

  async validateConfig(config: Record<string, unknown>): Promise<TestResult> {
    try {
      const apiKey = config.apiKey as string;
      const baseUrl = config.baseUrl as string;
      const orgId = config.orgId as number;
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
          message: 'API key is required for Grafana destinations',
          success: false,
        };
      }

      if (!baseUrl) {
        return {
          details: {
            destination: this.destinationId,
            metadata: { config },
            testType: 'validation',
          },
          error: 'Missing required field: baseUrl',
          message: 'Base URL is required for Grafana destinations',
          success: false,
        };
      }

      // Validate base URL format
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

      // Validate org ID if provided
      if (orgId && (orgId < 1 || orgId > 1000000)) {
        return {
          details: {
            destination: this.destinationId,
            metadata: { config },
            testType: 'validation',
          },
          error: 'Invalid org ID',
          message: 'Organization ID must be between 1 and 1000000',
          success: false,
        };
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
        message: 'Grafana destination configuration is valid',
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

// Register the Grafana provider and test runner
registerProvider(new GrafanaProviderFactory());
registerDestinationTestRunner('grafana', GrafanaTestRunner);
