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

// Snowflake provider configuration schema
const SnowflakeConfigSchema = z.object({
  apiKey: z.string().optional(),
  enabled: z.boolean().default(true),
  endpoint: z.string().optional(),
  options: z
    .object({
      account: z.string().min(1, 'Account identifier is required'),
      batchSize: z.number().min(1).max(10000).default(1000),
      database: z.string().min(1, 'Database name is required'),
      flushInterval: z.number().min(60000).max(3600000).default(300000), // 5 minutes
      password: z.string().optional(),
      privateKey: z.string().optional(),
      role: z.string().optional(),
      schema: z.string().default('PUBLIC'),
      table: z.string().default('untrace_traces'),
      username: z.string().min(1, 'Username is required'),
      warehouse: z.string().optional(),
    })
    .optional(),
});

export class SnowflakeProvider extends BaseIntegrationProvider {
  readonly name = 'Snowflake';
  readonly destinationId = 'snowflake';

  private account: string;
  private database: string;
  private schema: string;
  private table: string;
  private username: string;
  private password?: string;
  private privateKey?: string;
  private warehouse?: string;
  private role?: string;
  private batchSize: number;
  private flushInterval: number;
  private dataBuffer: Array<{
    trace: TraceData;
    context: TraceContext;
    timestamp: string;
  }> = [];
  private flushTimer?: NodeJS.Timeout;

  constructor(config: ProviderConfig, destinationId: string) {
    super(config, destinationId);
    this.account = (config.options?.account as string) || '';
    this.database = (config.options?.database as string) || '';
    this.schema = (config.options?.schema as string) || 'PUBLIC';
    this.table = (config.options?.table as string) || 'untrace_traces';
    this.username = (config.options?.username as string) || '';
    this.password = config.options?.password as string;
    this.privateKey = config.options?.privateKey as string;
    this.warehouse = config.options?.warehouse as string;
    this.role = config.options?.role as string;
    this.batchSize = (config.options?.batchSize as number) || 1000;
    this.flushInterval = (config.options?.flushInterval as number) || 300000; // 5 minutes

    if (!this.account || !this.database || !this.username) {
      throw new Error('Snowflake account, database, and username are required');
    }

    if (!this.password && !this.privateKey) {
      throw new Error(
        'Either password or private key is required for Snowflake authentication',
      );
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
      SnowflakeConfigSchema.parse(config);
      return { success: true };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Invalid configuration',
        success: false,
      };
    }
  }

  getConfigSchema(): z.ZodSchema {
    return SnowflakeConfigSchema;
  }

  private addTraceToBuffer(trace: TraceData, context: TraceContext): void {
    this.dataBuffer.push({
      context,
      timestamp: new Date().toISOString(),
      trace,
    });

    // Flush if buffer is full
    if (this.dataBuffer.length >= this.batchSize) {
      this.flushToSnowflake();
    }
  }

  private async flushToSnowflake(): Promise<void> {
    if (this.dataBuffer.length === 0) {
      return;
    }

    const dataToFlush = [...this.dataBuffer];
    this.dataBuffer = [];

    try {
      await this.insertBatchToSnowflake(dataToFlush);
    } catch (error) {
      console.error(
        '[SnowflakeProvider] Failed to flush data to Snowflake:',
        error,
      );
      // Re-add data to buffer for retry
      this.dataBuffer.unshift(...dataToFlush);
    }
  }

  private async insertBatchToSnowflake(
    data: Array<{
      trace: TraceData;
      context: TraceContext;
      timestamp: string;
    }>,
  ): Promise<void> {
    // Transform data to Snowflake format
    const snowflakeData = data.map((item) => ({
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
      trace_timestamp: item.trace.timestamp,
      user_id: item.context.userId,
    }));

    // Create INSERT statement
    const values = snowflakeData
      .map(
        (row) =>
          `(${[
            `'${row.trace_id.replace(/'/g, "''")}'`,
            `'${(row.trace_name || '').replace(/'/g, "''")}'`,
            `'${(row.trace_status || '').replace(/'/g, "''")}'`,
            row.trace_duration || 'NULL',
            `'${row.trace_timestamp.replace(/'/g, "''")}'`,
            `'${row.org_id.replace(/'/g, "''")}'`,
            `'${row.project_id.replace(/'/g, "''")}'`,
            row.user_id ? `'${row.user_id.replace(/'/g, "''")}'` : 'NULL',
            row.api_key_id ? `'${row.api_key_id.replace(/'/g, "''")}'` : 'NULL',
            `'${row.attributes.replace(/'/g, "''")}'`,
            `'${row.events.replace(/'/g, "''")}'`,
            `'${row.spans.replace(/'/g, "''")}'`,
            `'${row.ingestion_timestamp.replace(/'/g, "''")}'`,
          ].join(', ')})`,
      )
      .join(',\n');

    const insertQuery = `
			INSERT INTO ${this.database}.${this.schema}.${this.table} (
				trace_id,
				trace_name,
				trace_status,
				trace_duration,
				trace_timestamp,
				org_id,
				project_id,
				user_id,
				api_key_id,
				attributes,
				events,
				spans,
				ingestion_timestamp
			) VALUES ${values}
		`;

    // Execute query via Snowflake REST API
    await this.executeSnowflakeQuery(insertQuery);
  }

  private async executeSnowflakeQuery(query: string): Promise<void> {
    const url = `https://${this.account}.snowflakecomputing.com/api/v2/statements`;

    const headers: Record<string, string> = {
      Accept: 'application/json',
      Authorization: await this.getAuthorizationHeader(),
      'Content-Type': 'application/json',
    };

    if (this.warehouse) {
      headers['X-Snowflake-Warehouse'] = this.warehouse;
    }

    if (this.role) {
      headers['X-Snowflake-Role'] = this.role;
    }

    const payload = {
      async: false,
      statement: query,
      timeout: 300,
    };

    const response = await this.makeRequest(url, {
      body: JSON.stringify(payload),
      headers,
      method: 'POST',
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Snowflake API error: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const result = await response.json();
    if (result.data?.error) {
      throw new Error(`Snowflake query error: ${result.data.error}`);
    }
  }

  private async getAuthorizationHeader(): Promise<string> {
    // For simplicity, using basic auth with username/password
    // In production, you'd want to implement proper OAuth or key-pair auth
    if (this.password) {
      const credentials = Buffer.from(
        `${this.username}:${this.password}`,
      ).toString('base64');
      return `Basic ${credentials}`;
    }

    // For private key authentication, you'd implement JWT token generation
    throw new Error('Private key authentication not implemented yet');
  }

  private setupAutoFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flushToSnowflake();
    }, this.flushInterval);
  }

  async destroy(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
    await this.flushToSnowflake();
  }
}

// Snowflake provider factory
export class SnowflakeProviderFactory implements ProviderFactory {
  createProvider(
    config: ProviderConfig,
    destinationId: string,
  ): SnowflakeProvider {
    return new SnowflakeProvider(config, destinationId);
  }

  getDestinationId(): string {
    return 'snowflake';
  }

  getConfigSchema(): z.ZodSchema {
    return SnowflakeConfigSchema;
  }
}

// Snowflake test runner
export class SnowflakeTestRunner extends BaseDestinationTestRunner {
  async testConnection(config: Record<string, unknown>): Promise<TestResult> {
    try {
      const account = config.account as string;
      const database = config.database as string;
      const username = config.username as string;
      const password = config.password as string;

      if (!account || !database || !username) {
        return {
          details: {
            destination: this.destinationId,
            metadata: { config },
            testType: 'connection',
          },
          error: 'Missing required fields: account, database, username',
          message:
            'Account, database, and username are required for Snowflake destinations',
          success: false,
        };
      }

      if (!password) {
        return {
          details: {
            destination: this.destinationId,
            metadata: { config },
            testType: 'connection',
          },
          error: 'Missing required field: password',
          message: 'Password is required for Snowflake destinations',
          success: false,
        };
      }

      // Test connection by executing a simple query
      const testUrl = `https://${account}.snowflakecomputing.com/api/v2/statements`;
      const credentials = Buffer.from(`${username}:${password}`).toString(
        'base64',
      );

      const response = await fetch(testUrl, {
        body: JSON.stringify({
          async: false,
          statement: 'SELECT CURRENT_TIMESTAMP()',
          timeout: 30,
        }),
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/json',
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
          message: `Snowflake connection test failed: ${response.status} ${response.statusText}`,
          success: false,
        };
      }

      const result = await response.json();
      if (result.data?.error) {
        return {
          details: {
            destination: this.destinationId,
            metadata: {
              config,
              error: result.data.error,
            },
            testType: 'connection',
          },
          error: result.data.error,
          message: `Snowflake connection test failed: ${result.data.error}`,
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
        message: `Snowflake connection test to ${account} successful`,
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
        message: `Snowflake connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        success: false,
      };
    }
  }

  async testDelivery(
    config: Record<string, unknown>,
    trace: Record<string, unknown>,
  ): Promise<TestResult> {
    try {
      const account = config.account as string;
      const database = config.database as string;
      const schema = (config.schema as string) || 'PUBLIC';
      const table = (config.table as string) || 'untrace_traces';
      const username = config.username as string;
      const password = config.password as string;

      if (!account || !database || !username || !password) {
        return {
          details: {
            destination: this.destinationId,
            metadata: { config, trace },
            testType: 'delivery',
          },
          error: 'Missing required fields for delivery test',
          message:
            'Account, database, username, and password are required for Snowflake delivery test',
          success: false,
        };
      }

      // Test delivery by inserting a test record
      const testUrl = `https://${account}.snowflakecomputing.com/api/v2/statements`;
      const credentials = Buffer.from(`${username}:${password}`).toString(
        'base64',
      );

      const testQuery = `
				INSERT INTO ${database}.${schema}.${table} (
					trace_id,
					trace_name,
					trace_status,
					trace_duration,
					trace_timestamp,
					org_id,
					project_id,
					user_id,
					api_key_id,
					attributes,
					events,
					spans,
					ingestion_timestamp
				) VALUES (
					'test-trace-delivery',
					'test-trace',
					'ok',
					100,
					'${new Date().toISOString()}',
					'test-org',
					'test-project',
					'test-user',
					'test-api-key',
					'{}',
					'[]',
					'[]',
					'${new Date().toISOString()}'
				)
			`;

      const response = await fetch(testUrl, {
        body: JSON.stringify({
          async: false,
          statement: testQuery,
          timeout: 30,
        }),
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/json',
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
          message: `Snowflake delivery test failed: ${response.status} ${response.statusText}`,
          success: false,
        };
      }

      const result = await response.json();
      if (result.data?.error) {
        return {
          details: {
            destination: this.destinationId,
            metadata: {
              config,
              error: result.data.error,
              trace,
            },
            testType: 'delivery',
          },
          error: result.data.error,
          message: `Snowflake delivery test failed: ${result.data.error}`,
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
        message: `Snowflake delivery test to ${account} successful`,
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
        message: `Snowflake delivery test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        success: false,
      };
    }
  }

  async validateConfig(config: Record<string, unknown>): Promise<TestResult> {
    try {
      const account = config.account as string;
      const database = config.database as string;
      const username = config.username as string;
      const password = config.password as string;
      const privateKey = config.privateKey as string;
      const batchSize = config.batchSize as number;

      if (!account) {
        return {
          details: {
            destination: this.destinationId,
            metadata: { config },
            testType: 'validation',
          },
          error: 'Missing required field: account',
          message: 'Account identifier is required for Snowflake destinations',
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
          message: 'Database name is required for Snowflake destinations',
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
          message: 'Username is required for Snowflake destinations',
          success: false,
        };
      }

      if (!password && !privateKey) {
        return {
          details: {
            destination: this.destinationId,
            metadata: { config },
            testType: 'validation',
          },
          error: 'Missing authentication credentials',
          message:
            'Either password or private key is required for Snowflake destinations',
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

      // Validate account format (should be like account.snowflakecomputing.com)
      if (!account.includes('.snowflakecomputing.com')) {
        return {
          details: {
            destination: this.destinationId,
            metadata: { config },
            testType: 'validation',
          },
          error: 'Invalid account format',
          message:
            'Account should be in format: account.snowflakecomputing.com',
          success: false,
        };
      }

      return {
        details: {
          destination: this.destinationId,
          metadata: { config },
          testType: 'validation',
        },
        message: 'Snowflake destination configuration is valid',
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

// Register the Snowflake provider and test runner
registerProvider(new SnowflakeProviderFactory());
registerDestinationTestRunner('snowflake', SnowflakeTestRunner);
