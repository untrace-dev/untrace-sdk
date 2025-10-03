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

// AWS Firehose provider configuration schema
const FirehoseConfigSchema = z.object({
  apiKey: z.string().optional(),
  enabled: z.boolean().default(true),
  endpoint: z.string().optional(),
  options: z
    .object({
      accessKeyId: z.string().optional(),
      batchSize: z.number().min(1).max(500).default(100),
      deliveryStreamName: z.string().min(1, 'Delivery stream name is required'),
      flushInterval: z.number().min(60000).max(3600000).default(300000), // 5 minutes
      region: z.string().min(1, 'AWS region is required'),
      retryAttempts: z.number().min(0).max(5).default(3),
      retryDelay: z.number().min(1000).max(10000).default(2000), // 2 seconds
      secretAccessKey: z.string().optional(),
      sessionToken: z.string().optional(),
      timeout: z.number().min(5000).max(60000).default(30000), // 30 seconds
    })
    .optional(),
});

export class FirehoseProvider extends BaseIntegrationProvider {
  readonly name = 'AWS Kinesis Data Firehose';
  readonly destinationId = 'firehose';

  private region: string;
  private deliveryStreamName: string;
  private accessKeyId?: string;
  private secretAccessKey?: string;
  private sessionToken?: string;
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
    this.region = (config.options?.region as string) || '';
    this.deliveryStreamName =
      (config.options?.deliveryStreamName as string) || '';
    this.accessKeyId = config.options?.accessKeyId as string;
    this.secretAccessKey = config.options?.secretAccessKey as string;
    this.sessionToken = config.options?.sessionToken as string;
    this.batchSize = (config.options?.batchSize as number) || 100;
    this.flushInterval = (config.options?.flushInterval as number) || 300000; // 5 minutes
    this.timeout = (config.options?.timeout as number) || 30000; // 30 seconds
    this.retryAttempts = (config.options?.retryAttempts as number) || 3;
    this.retryDelay = (config.options?.retryDelay as number) || 2000; // 2 seconds

    if (!this.region || !this.deliveryStreamName) {
      throw new Error('AWS region and delivery stream name are required');
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
      FirehoseConfigSchema.parse(config);
      return { success: true };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Invalid configuration',
        success: false,
      };
    }
  }

  getConfigSchema(): z.ZodSchema {
    return FirehoseConfigSchema;
  }

  private addTraceToBuffer(trace: TraceData, context: TraceContext): void {
    this.dataBuffer.push({
      context,
      timestamp: new Date().toISOString(),
      trace,
    });

    // Flush if buffer is full
    if (this.dataBuffer.length >= this.batchSize) {
      this.flushToFirehose();
    }
  }

  private async flushToFirehose(): Promise<void> {
    if (this.dataBuffer.length === 0) {
      return;
    }

    const dataToFlush = [...this.dataBuffer];
    this.dataBuffer = [];

    try {
      await this.sendBatchToFirehose(dataToFlush);
    } catch (error) {
      console.error(
        '[FirehoseProvider] Failed to flush data to AWS Firehose:',
        error,
      );
      // Re-add data to buffer for retry
      this.dataBuffer.unshift(...dataToFlush);
    }
  }

  private async sendBatchToFirehose(
    data: Array<{
      trace: TraceData;
      context: TraceContext;
      timestamp: string;
    }>,
  ): Promise<void> {
    // Transform data to Firehose format
    const firehoseRecords = data.map((item) => ({
      Data: Buffer.from(
        JSON.stringify({
          api_key_id: item.context.apiKeyId,
          attributes: item.trace.attributes || {},
          events: item.trace.events || [],
          ingestion_timestamp: item.timestamp,
          org_id: item.context.orgId,
          project_id: item.context.projectId,
          spans: item.trace.spans || [],
          trace_duration: item.trace.duration,
          trace_id: item.trace.id,
          trace_name: item.trace.name,
          trace_status: item.trace.status,
          trace_timestamp: item.trace.timestamp,
          user_id: item.context.userId,
        }),
      ),
    }));

    // Send to AWS Firehose using HTTP API
    const endpoint = this.buildEndpoint();
    await this.makeRequestWithRetry(endpoint, {
      body: JSON.stringify({
        DeliveryStreamName: this.deliveryStreamName,
        Records: firehoseRecords,
      }),
      headers: {
        Authorization: await this.getAuthorizationHeader(),
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Date': this.getAmzDate(),
        'X-Amz-Target': 'Firehose_20150804.PutRecordBatch',
      },
    });
  }

  private buildEndpoint(): string {
    return `https://firehose.${this.region}.amazonaws.com/`;
  }

  private getAmzDate(): string {
    return new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  }

  private async getAuthorizationHeader(): Promise<string> {
    // Simplified AWS Signature Version 4 implementation
    // In production, you'd want to use the AWS SDK or a proper signature library
    const amzDate = this.getAmzDate();
    const dateStamp = amzDate.substring(0, 8);

    if (!this.accessKeyId || !this.secretAccessKey) {
      throw new Error(
        'AWS credentials are required for Firehose authentication',
      );
    }

    const credential = `${this.accessKeyId}/${dateStamp}/${this.region}/firehose/aws4_request`;
    const signedHeaders = 'content-type;host;x-amz-date;x-amz-target';
    const signature = 'simplified-signature'; // Would be actual AWS signature

    return `AWS4-HMAC-SHA256 Credential=${credential}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
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
            `AWS Firehose API error: ${response.status} ${response.statusText} - ${errorText}`,
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
      this.flushToFirehose();
    }, this.flushInterval);
  }

  async destroy(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
    await this.flushToFirehose();
  }
}

// AWS Firehose provider factory
export class FirehoseProviderFactory implements ProviderFactory {
  createProvider(
    config: ProviderConfig,
    destinationId: string,
  ): FirehoseProvider {
    return new FirehoseProvider(config, destinationId);
  }

  getDestinationId(): string {
    return 'firehose';
  }

  getConfigSchema(): z.ZodSchema {
    return FirehoseConfigSchema;
  }
}

// AWS Firehose test runner
export class FirehoseTestRunner extends BaseDestinationTestRunner {
  async testConnection(config: Record<string, unknown>): Promise<TestResult> {
    try {
      const region = config.region as string;
      const deliveryStreamName = config.deliveryStreamName as string;
      const accessKeyId = config.accessKeyId as string;
      const secretAccessKey = config.secretAccessKey as string;

      if (!region || !deliveryStreamName) {
        return {
          details: {
            destination: this.destinationId,
            metadata: { config },
            testType: 'connection',
          },
          error: 'Missing required fields: region, deliveryStreamName',
          message:
            'Region and delivery stream name are required for AWS Firehose destinations',
          success: false,
        };
      }

      if (!accessKeyId || !secretAccessKey) {
        return {
          details: {
            destination: this.destinationId,
            metadata: { config },
            testType: 'connection',
          },
          error: 'Missing required fields: accessKeyId, secretAccessKey',
          message: 'AWS credentials are required for Firehose destinations',
          success: false,
        };
      }

      // Test connection by making a request to AWS Firehose
      const testEndpoint = `https://firehose.${region}.amazonaws.com/`;
      const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
      const dateStamp = amzDate.substring(0, 8);
      const credential = `${accessKeyId}/${dateStamp}/${region}/firehose/aws4_request`;
      const signedHeaders = 'content-type;host;x-amz-date;x-amz-target';
      const signature = 'simplified-signature'; // Would be actual AWS signature

      const response = await fetch(testEndpoint, {
        body: JSON.stringify({
          DeliveryStreamName: deliveryStreamName,
          Records: [
            {
              Data: Buffer.from(
                JSON.stringify({ test: 'connection' }),
              ).toString('base64'),
            },
          ],
        }),
        headers: {
          Authorization: `AWS4-HMAC-SHA256 Credential=${credential}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
          'Content-Type': 'application/x-amz-json-1.1',
          'X-Amz-Date': amzDate,
          'X-Amz-Target': 'Firehose_20150804.PutRecordBatch',
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
          message: `AWS Firehose connection test failed: ${response.status} ${response.statusText}`,
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
        message: `AWS Firehose connection test to ${region} successful`,
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
        message: `AWS Firehose connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        success: false,
      };
    }
  }

  async testDelivery(
    config: Record<string, unknown>,
    trace: Record<string, unknown>,
  ): Promise<TestResult> {
    try {
      const region = config.region as string;
      const deliveryStreamName = config.deliveryStreamName as string;
      const accessKeyId = config.accessKeyId as string;
      const secretAccessKey = config.secretAccessKey as string;

      if (!region || !deliveryStreamName || !accessKeyId || !secretAccessKey) {
        return {
          details: {
            destination: this.destinationId,
            metadata: { config, trace },
            testType: 'delivery',
          },
          error: 'Missing required fields for delivery test',
          message:
            'Region, delivery stream name, and AWS credentials are required for Firehose delivery test',
          success: false,
        };
      }

      // Test delivery by sending a sample trace
      const testEndpoint = `https://firehose.${region}.amazonaws.com/`;
      const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
      const dateStamp = amzDate.substring(0, 8);
      const credential = `${accessKeyId}/${dateStamp}/${region}/firehose/aws4_request`;
      const signedHeaders = 'content-type;host;x-amz-date;x-amz-target';
      const signature = 'simplified-signature'; // Would be actual AWS signature

      const testData = {
        api_key_id: 'test-api-key',
        attributes: { test: true },
        events: [],
        ingestion_timestamp: new Date().toISOString(),
        org_id: 'test-org',
        project_id: 'test-project',
        spans: [],
        trace_duration: 100,
        trace_id: trace.id || 'test-trace-delivery',
        trace_name: 'test-trace',
        trace_status: 'ok',
        trace_timestamp: new Date().toISOString(),
        user_id: 'test-user',
        ...trace,
      };

      const response = await fetch(testEndpoint, {
        body: JSON.stringify({
          DeliveryStreamName: deliveryStreamName,
          Records: [
            {
              Data: Buffer.from(JSON.stringify(testData)).toString('base64'),
            },
          ],
        }),
        headers: {
          Authorization: `AWS4-HMAC-SHA256 Credential=${credential}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
          'Content-Type': 'application/x-amz-json-1.1',
          'X-Amz-Date': amzDate,
          'X-Amz-Target': 'Firehose_20150804.PutRecordBatch',
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
          message: `AWS Firehose delivery test failed: ${response.status} ${response.statusText}`,
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
        message: `AWS Firehose delivery test to ${region} successful`,
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
        message: `AWS Firehose delivery test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        success: false,
      };
    }
  }

  async validateConfig(config: Record<string, unknown>): Promise<TestResult> {
    try {
      const region = config.region as string;
      const deliveryStreamName = config.deliveryStreamName as string;
      const batchSize = config.batchSize as number;
      const flushInterval = config.flushInterval as number;
      const timeout = config.timeout as number;
      const retryAttempts = config.retryAttempts as number;
      const retryDelay = config.retryDelay as number;

      if (!region) {
        return {
          details: {
            destination: this.destinationId,
            metadata: { config },
            testType: 'validation',
          },
          error: 'Missing required field: region',
          message: 'AWS region is required for Firehose destinations',
          success: false,
        };
      }

      if (!deliveryStreamName) {
        return {
          details: {
            destination: this.destinationId,
            metadata: { config },
            testType: 'validation',
          },
          error: 'Missing required field: deliveryStreamName',
          message: 'Delivery stream name is required for Firehose destinations',
          success: false,
        };
      }

      // Validate AWS region format
      const validRegions = [
        'us-east-1',
        'us-east-2',
        'us-west-1',
        'us-west-2',
        'eu-west-1',
        'eu-west-2',
        'eu-central-1',
        'ap-southeast-1',
        'ap-southeast-2',
        'ap-northeast-1',
      ];

      if (!validRegions.includes(region)) {
        return {
          details: {
            destination: this.destinationId,
            metadata: { config },
            testType: 'validation',
          },
          error: 'Invalid AWS region',
          message: `Region must be one of: ${validRegions.join(', ')}`,
          success: false,
        };
      }

      // Validate batch size if provided
      if (batchSize && (batchSize < 1 || batchSize > 500)) {
        return {
          details: {
            destination: this.destinationId,
            metadata: { config },
            testType: 'validation',
          },
          error: 'Invalid batch size',
          message: 'Batch size must be between 1 and 500',
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
        message: 'AWS Firehose destination configuration is valid',
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

// Register the AWS Firehose provider and test runner
registerProvider(new FirehoseProviderFactory());
registerDestinationTestRunner('firehose', FirehoseTestRunner);
