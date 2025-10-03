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

// ClickHouse provider configuration schema
const ClickHouseConfigSchema = z.object({
  apiKey: z.string().optional(),
  enabled: z.boolean().default(true),
  endpoint: z.string().optional(),
  options: z
    .object({
      batchSize: z.number().min(1).max(10000).default(1000),
      database: z.string().min(1, 'Database name is required'),
      flushInterval: z.number().min(60000).max(3600000).default(300000), // 5 minutes
      host: z.string().min(1, 'Host is required'),
      password: z.string().optional(),
      port: z.number().min(1).max(65535).default(8123),
      retryAttempts: z.number().min(0).max(5).default(3),
      retryDelay: z.number().min(1000).max(10000).default(2000), // 2 seconds
      table: z.string().default('untrace_traces'),
      timeout: z.number().min(5000).max(60000).default(30000), // 30 seconds
      username: z.string().min(1, 'Username is required'),
      useSSL: z.boolean().default(false),
    })
    .optional(),
});

export class ClickHouseProvider extends BaseIntegrationProvider {
  readonly name = 'ClickHouse';
  readonly destinationId = 'clickhouse';

  private host: string;
  private port: number;
  private database: string;
  private username: string;
  private password?: string;
  private table: string;
  private useSSL: boolean;
  private timeout: number;
  private batchSize: number;
  private flushInterval: number;
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
    this.host = (config.options?.host as string) || '';
    this.port = (config.options?.port as number) || 8123;
    this.database = (config.options?.database as string) || '';
    this.username = (config.options?.username as string) || '';
    this.password = config.options?.password as string;
    this.table = (config.options?.table as string) || 'untrace_traces';
    this.useSSL = (config.options?.useSSL as boolean) ?? false;
    this.timeout = (config.options?.timeout as number) || 30000; // 30 seconds
    this.batchSize = (config.options?.batchSize as number) || 1000;
    this.flushInterval = (config.options?.flushInterval as number) || 300000; // 5 minutes
    this.retryAttempts = (config.options?.retryAttempts as number) || 3;
    this.retryDelay = (config.options?.retryDelay as number) || 2000; // 2 seconds

    if (!this.host || !this.database || !this.username) {
      throw new Error('ClickHouse host, database, and username are required');
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
      ClickHouseConfigSchema.parse(config);
      return { success: true };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Invalid configuration',
        success: false,
      };
    }
  }

  getConfigSchema(): z.ZodSchema {
    return ClickHouseConfigSchema;
  }

  private addTraceToBuffer(trace: TraceData, context: TraceContext): void {
    this.dataBuffer.push({
      context,
      timestamp: new Date().toISOString(),
      trace,
    });

    // Flush if buffer is full
    if (this.dataBuffer.length >= this.batchSize) {
      this.flushToClickHouse();
    }
  }

  private async flushToClickHouse(): Promise<void> {
    if (this.dataBuffer.length === 0) {
      return;
    }

    const dataToFlush = [...this.dataBuffer];
    this.dataBuffer = [];

    try {
      await this.insertBatchToClickHouse(dataToFlush);
    } catch (error) {
      console.error(
        '[ClickHouseProvider] Failed to flush data to ClickHouse:',
        error,
      );
      // Re-add data to buffer for retry
      this.dataBuffer.unshift(...dataToFlush);
    }
  }

  private async insertBatchToClickHouse(
    data: Array<{
      trace: TraceData;
      context: TraceContext;
      timestamp: string;
    }>,
  ): Promise<void> {
    // Transform data to ClickHouse format
    const clickhouseData = data.map((item) => ({
      api_key_id: item.context.apiKeyId || '',
      attributes: JSON.stringify(item.trace.attributes || {}),
      events: JSON.stringify(item.trace.events || []),
      ingestion_timestamp: item.timestamp,
      org_id: item.context.orgId,
      project_id: item.context.projectId,
      spans: JSON.stringify(item.trace.spans || []),
      trace_duration: item.trace.duration || 0,
      trace_id: item.trace.id,
      trace_name: item.trace.name || '',
      trace_status: item.trace.status || '',
      trace_timestamp: item.trace.timestamp,
      user_id: item.context.userId || '',
    }));

    // Create JSONEachRow format for ClickHouse
    const jsonRows = clickhouseData
      .map((row) => JSON.stringify(row))
      .join('\n');

    // Execute INSERT statement
    const query = `INSERT INTO ${this.database}.${this.table} FORMAT JSONEachRow`;
    await this.executeClickHouseQuery(query, jsonRows);
  }

  private async executeClickHouseQuery(
    query: string,
    data?: string,
  ): Promise<void> {
    const protocol = this.useSSL ? 'https' : 'http';
    const url = `${protocol}://${this.host}:${this.port}/`;

    const params = new URLSearchParams({
      database: this.database,
      query,
    });

    const headers: Record<string, string> = {
      'Content-Type': 'text/plain',
      'User-Agent': 'Untrace-Integration/1.0',
    };

    // Add authentication if password is provided
    if (this.password) {
      headers.Authorization = `Basic ${Buffer.from(
        `${this.username}:${this.password}`,
      ).toString('base64')}`;
    }

    const requestBody = data || '';

    await this.makeRequestWithRetry(`${url}?${params.toString()}`, {
      body: requestBody,
      headers,
      method: 'POST',
    });
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
            `ClickHouse API error: ${response.status} ${response.statusText} - ${errorText}`,
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
      this.flushToClickHouse();
    }, this.flushInterval);
  }

  async destroy(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
    await this.flushToClickHouse();
  }
}

// ClickHouse provider factory
export class ClickHouseProviderFactory implements ProviderFactory {
  createProvider(
    config: ProviderConfig,
    destinationId: string,
  ): ClickHouseProvider {
    return new ClickHouseProvider(config, destinationId);
  }

  getDestinationId(): string {
    return 'clickhouse';
  }

  getConfigSchema(): z.ZodSchema {
    return ClickHouseConfigSchema;
  }
}

// ClickHouse test runner
export class ClickHouseTestRunner extends BaseDestinationTestRunner {
  async testConnection(config: Record<string, unknown>): Promise<TestResult> {
    try {
      const host = config.host as string;
      const port = (config.port as number) || 8123;
      const database = config.database as string;
      const username = config.username as string;
      const password = config.password as string;
      const useSSL = (config.useSSL as boolean) ?? false;

      if (!host || !database || !username) {
        return {
          details: {
            destination: this.destinationId,
            metadata: { config },
            testType: 'connection',
          },
          error: 'Missing required fields: host, database, username',
          message:
            'Host, database, and username are required for ClickHouse destinations',
          success: false,
        };
      }

      // Test connection by executing a simple query
      const protocol = useSSL ? 'https' : 'http';
      const testUrl = `${protocol}://${host}:${port}/`;
      const params = new URLSearchParams({
        database,
        query: 'SELECT 1',
      });

      const headers: Record<string, string> = {
        'Content-Type': 'text/plain',
        'User-Agent': 'Untrace-Integration/1.0',
      };

      // Add authentication if password is provided
      if (password) {
        headers.Authorization = `Basic ${Buffer.from(
          `${username}:${password}`,
        ).toString('base64')}`;
      }

      const response = await fetch(`${testUrl}?${params.toString()}`, {
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
            },
            testType: 'connection',
          },
          error: `HTTP ${response.status}: ${response.statusText}`,
          message: `ClickHouse connection test failed: ${response.status} ${response.statusText}`,
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
        message: `ClickHouse connection test to ${host}:${port} successful`,
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
        message: `ClickHouse connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        success: false,
      };
    }
  }

  async testDelivery(
    config: Record<string, unknown>,
    trace: Record<string, unknown>,
  ): Promise<TestResult> {
    try {
      const host = config.host as string;
      const port = (config.port as number) || 8123;
      const database = config.database as string;
      const table = (config.table as string) || 'untrace_traces';
      const username = config.username as string;
      const password = config.password as string;
      const useSSL = (config.useSSL as boolean) ?? false;

      if (!host || !database || !username) {
        return {
          details: {
            destination: this.destinationId,
            metadata: { config, trace },
            testType: 'delivery',
          },
          error: 'Missing required fields for delivery test',
          message:
            'Host, database, and username are required for ClickHouse delivery test',
          success: false,
        };
      }

      // Test delivery by inserting a test record
      const protocol = useSSL ? 'https' : 'http';
      const testUrl = `${protocol}://${host}:${port}/`;
      const params = new URLSearchParams({
        database,
        query: `INSERT INTO ${table} FORMAT JSONEachRow`,
      });

      const headers: Record<string, string> = {
        'Content-Type': 'text/plain',
        'User-Agent': 'Untrace-Integration/1.0',
      };

      // Add authentication if password is provided
      if (password) {
        headers.Authorization = `Basic ${Buffer.from(
          `${username}:${password}`,
        ).toString('base64')}`;
      }

      const testData = {
        api_key_id: 'test-api-key',
        attributes: JSON.stringify({ test: true }),
        events: JSON.stringify([]),
        ingestion_timestamp: new Date().toISOString(),
        org_id: 'test-org',
        project_id: 'test-project',
        spans: JSON.stringify([]),
        trace_duration: 100,
        trace_id: trace.id || 'test-trace-delivery',
        trace_name: 'test-trace',
        trace_status: 'ok',
        trace_timestamp: new Date().toISOString(),
        user_id: 'test-user',
      };

      const response = await fetch(`${testUrl}?${params.toString()}`, {
        body: JSON.stringify(testData),
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
          message: `ClickHouse delivery test failed: ${response.status} ${response.statusText}`,
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
        message: `ClickHouse delivery test to ${host}:${port} successful`,
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
        message: `ClickHouse delivery test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        success: false,
      };
    }
  }

  async validateConfig(config: Record<string, unknown>): Promise<TestResult> {
    try {
      const host = config.host as string;
      const port = config.port as number;
      const database = config.database as string;
      const username = config.username as string;
      const batchSize = config.batchSize as number;
      const flushInterval = config.flushInterval as number;
      const timeout = config.timeout as number;
      const retryAttempts = config.retryAttempts as number;
      const retryDelay = config.retryDelay as number;

      if (!host) {
        return {
          details: {
            destination: this.destinationId,
            metadata: { config },
            testType: 'validation',
          },
          error: 'Missing required field: host',
          message: 'Host is required for ClickHouse destinations',
          success: false,
        };
      }

      if (!database) {
        return {
          details: {
            destination: this.destinationId,
            metadata: { config },
            testType: 'validation',
          },
          error: 'Missing required field: database',
          message: 'Database name is required for ClickHouse destinations',
          success: false,
        };
      }

      if (!username) {
        return {
          details: {
            destination: this.destinationId,
            metadata: { config },
            testType: 'validation',
          },
          error: 'Missing required field: username',
          message: 'Username is required for ClickHouse destinations',
          success: false,
        };
      }

      // Validate port if provided
      if (port && (port < 1 || port > 65535)) {
        return {
          details: {
            destination: this.destinationId,
            metadata: { config },
            testType: 'validation',
          },
          error: 'Invalid port number',
          message: 'Port must be between 1 and 65535',
          success: false,
        };
      }

      // Validate batch size if provided
      if (batchSize && (batchSize < 1 || batchSize > 10000)) {
        return {
          details: {
            destination: this.destinationId,
            metadata: { config },
            testType: 'validation',
          },
          error: 'Invalid batch size',
          message: 'Batch size must be between 1 and 10000',
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
        message: 'ClickHouse destination configuration is valid',
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

// Register the ClickHouse provider and test runner
registerProvider(new ClickHouseProviderFactory());
registerDestinationTestRunner('clickhouse', ClickHouseTestRunner);
