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

// Dynatrace provider configuration schema
const DynatraceConfigSchema = z.object({
  apiKey: z.string().min(1, 'API key is required'),
  enabled: z.boolean().default(true),
  endpoint: z.string().optional(),
  options: z
    .object({
      baseUrl: z.string().url().default('https://api.dynatrace.com'),
      batchSize: z.number().min(1).max(1000).default(100),
      environmentId: z.string().min(1, 'Environment ID is required'),
      flushInterval: z.number().min(60000).max(3600000).default(300000), // 5 minutes
      region: z.enum(['US', 'EU', 'AU']).default('US'),
      retryAttempts: z.number().min(0).max(5).default(3),
      retryDelay: z.number().min(1000).max(10000).default(2000), // 2 seconds
      timeout: z.number().min(5000).max(60000).default(30000), // 30 seconds
    })
    .optional(),
});

export class DynatraceProvider extends BaseIntegrationProvider {
  readonly name = 'Dynatrace';
  readonly destinationId = 'dynatrace';

  private baseUrl: string;
  private environmentId: string;
  private region: string;
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
      (config.options?.baseUrl as string) || 'https://api.dynatrace.com';
    this.environmentId = (config.options?.environmentId as string) || '';
    this.region = (config.options?.region as string) || 'US';
    this.batchSize = (config.options?.batchSize as number) || 100;
    this.flushInterval = (config.options?.flushInterval as number) || 300000; // 5 minutes
    this.timeout = (config.options?.timeout as number) || 30000; // 30 seconds
    this.retryAttempts = (config.options?.retryAttempts as number) || 3;
    this.retryDelay = (config.options?.retryDelay as number) || 2000; // 2 seconds

    if (!this.environmentId) {
      throw new Error('Dynatrace environment ID is required');
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
      DynatraceConfigSchema.parse(config);
      return { success: true };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Invalid configuration',
        success: false,
      };
    }
  }

  getConfigSchema(): z.ZodSchema {
    return DynatraceConfigSchema;
  }

  private addTraceToBuffer(trace: TraceData, context: TraceContext): void {
    this.dataBuffer.push({
      context,
      timestamp: new Date().toISOString(),
      trace,
    });

    // Flush if buffer is full
    if (this.dataBuffer.length >= this.batchSize) {
      this.flushToDynatrace();
    }
  }

  private async flushToDynatrace(): Promise<void> {
    if (this.dataBuffer.length === 0) {
      return;
    }

    const dataToFlush = [...this.dataBuffer];
    this.dataBuffer = [];

    try {
      await this.sendBatchToDynatrace(dataToFlush);
    } catch (error) {
      console.error(
        '[DynatraceProvider] Failed to flush data to Dynatrace:',
        error,
      );
      // Re-add data to buffer for retry
      this.dataBuffer.unshift(...dataToFlush);
    }
  }

  private async sendBatchToDynatrace(
    data: Array<{
      trace: TraceData;
      context: TraceContext;
      timestamp: string;
    }>,
  ): Promise<void> {
    // Transform data to Dynatrace format
    const dynatraceMetrics = data.map((item) => ({
      dimensions: {
        api_key_id: item.context.apiKeyId,
        model: item.trace.attributes?.['llm.model'] || 'unknown',
        org_id: item.context.orgId,
        project_id: item.context.projectId,
        source: 'untrace-sdk',
        trace_id: item.trace.id,
        trace_name: item.trace.name,
        trace_status: item.trace.status,
        user_id: item.context.userId,
      },
      metricId: 'untrace.ai.trace',
      timestamp: new Date(item.trace.timestamp).getTime(),
      value: item.trace.duration || 0,
    }));

    const dynatraceEvents = data.map((item) => ({
      description: `AI trace execution with status: ${item.trace.status}`,
      end:
        new Date(item.trace.timestamp).getTime() + (item.trace.duration || 0),
      eventType: 'AI_TRACE_EVENT',
      properties: {
        api_key_id: item.context.apiKeyId,
        attributes: JSON.stringify(item.trace.attributes || {}),
        events: JSON.stringify(item.trace.events || []),
        ingestion_timestamp: item.timestamp,
        model: item.trace.attributes?.['llm.model'] || 'unknown',
        org_id: item.context.orgId,
        project_id: item.context.projectId,
        source: 'untrace-sdk',
        spans: JSON.stringify(item.trace.spans || []),
        trace_duration: item.trace.duration,
        trace_id: item.trace.id,
        trace_name: item.trace.name,
        trace_status: item.trace.status,
        user_id: item.context.userId,
      },
      start: new Date(item.trace.timestamp).getTime(),
      title: `AI Trace: ${item.trace.name}`,
    }));

    // Send metrics to Dynatrace
    const metricsEndpoint = this.buildEndpoint('/api/v2/metrics/ingest');
    await this.makeRequestWithRetry(metricsEndpoint, {
      body: JSON.stringify(dynatraceMetrics),
      headers: {
        Authorization: `Api-Token ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Untrace-SDK/1.0',
      },
    });

    // Send events to Dynatrace
    const eventsEndpoint = this.buildEndpoint('/api/v2/events/ingest');
    await this.makeRequestWithRetry(eventsEndpoint, {
      body: JSON.stringify(dynatraceEvents),
      headers: {
        Authorization: `Api-Token ${this.config.apiKey}`,
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
            `Dynatrace API error: ${response.status} ${response.statusText} - ${errorText}`,
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
      this.flushToDynatrace();
    }, this.flushInterval);
  }

  async destroy(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
    await this.flushToDynatrace();
  }
}

// Dynatrace provider factory
export class DynatraceProviderFactory implements ProviderFactory {
  createProvider(
    config: ProviderConfig,
    destinationId: string,
  ): DynatraceProvider {
    return new DynatraceProvider(config, destinationId);
  }

  getDestinationId(): string {
    return 'dynatrace';
  }

  getConfigSchema(): z.ZodSchema {
    return DynatraceConfigSchema;
  }
}

// Dynatrace test runner
export class DynatraceTestRunner extends BaseDestinationTestRunner {
  async testConnection(config: Record<string, unknown>): Promise<TestResult> {
    try {
      const apiKey = config.apiKey as string;
      const baseUrl = (config.baseUrl as string) || 'https://api.dynatrace.com';
      const environmentId = config.environmentId as string;

      if (!apiKey) {
        return {
          details: {
            destination: this.destinationId,
            metadata: { config },
            testType: 'connection',
          },
          error: 'Missing required field: apiKey',
          message: 'API key is required for Dynatrace destinations',
          success: false,
        };
      }

      if (!environmentId) {
        return {
          details: {
            destination: this.destinationId,
            metadata: { config },
            testType: 'connection',
          },
          error: 'Missing required field: environmentId',
          message: 'Environment ID is required for Dynatrace destinations',
          success: false,
        };
      }

      // Test connection by making a request to Dynatrace's API
      const testEndpoint = `${baseUrl}/api/v2/entities`;
      const response = await fetch(testEndpoint, {
        headers: {
          Authorization: `Api-Token ${apiKey}`,
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
          message: `Dynatrace connection test failed: ${response.status} ${response.statusText}`,
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
        message: `Dynatrace connection test to ${baseUrl} successful`,
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
        message: `Dynatrace connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
      const baseUrl = (config.baseUrl as string) || 'https://api.dynatrace.com';
      const environmentId = config.environmentId as string;

      if (!apiKey || !environmentId) {
        return {
          details: {
            destination: this.destinationId,
            metadata: { config, trace },
            testType: 'delivery',
          },
          error: 'Missing required fields for delivery test',
          message:
            'API key and environment ID are required for Dynatrace destinations',
          success: false,
        };
      }

      // Test delivery by sending a sample metric and event
      const testMetric = {
        dimensions: {
          api_key_id: 'test-api-key',
          model: 'gpt-4',
          org_id: 'test-org',
          project_id: 'test-project',
          source: 'untrace-sdk-test',
          trace_id: trace.id || 'test-trace-delivery',
          trace_name: 'test-trace',
          trace_status: 'ok',
          user_id: 'test-user',
        },
        metricId: 'untrace.ai.trace.test',
        timestamp: Date.now(),
        value: 100,
      };

      const testEvent = {
        description: 'AI trace execution with status: ok',
        end: Date.now() + 100,
        eventType: 'AI_TRACE_EVENT',
        properties: {
          api_key_id: 'test-api-key',
          attributes: JSON.stringify({ test: true }),
          events: JSON.stringify([]),
          ingestion_timestamp: new Date().toISOString(),
          model: 'gpt-4',
          org_id: 'test-org',
          project_id: 'test-project',
          source: 'untrace-sdk-test',
          spans: JSON.stringify([]),
          trace_duration: 100,
          trace_id: trace.id || 'test-trace-delivery',
          trace_name: 'test-trace',
          trace_status: 'ok',
          user_id: 'test-user',
          ...trace,
        },
        start: Date.now(),
        title: 'AI Trace: test-trace',
      };

      // Test metrics endpoint
      const metricsEndpoint = `${baseUrl}/api/v2/metrics/ingest`;
      const metricsResponse = await fetch(metricsEndpoint, {
        body: JSON.stringify([testMetric]),
        headers: {
          Authorization: `Api-Token ${apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Untrace-SDK/1.0',
        },
        method: 'POST',
        signal: AbortSignal.timeout(10000),
      });

      if (!metricsResponse.ok) {
        return {
          details: {
            destination: this.destinationId,
            metadata: {
              config,
              status: metricsResponse.status,
              statusText: metricsResponse.statusText,
              trace,
            },
            testType: 'delivery',
          },
          error: `HTTP ${metricsResponse.status}: ${metricsResponse.statusText}`,
          message: `Dynatrace metrics delivery test failed: ${metricsResponse.status} ${metricsResponse.statusText}`,
          success: false,
        };
      }

      // Test events endpoint
      const eventsEndpoint = `${baseUrl}/api/v2/events/ingest`;
      const eventsResponse = await fetch(eventsEndpoint, {
        body: JSON.stringify([testEvent]),
        headers: {
          Authorization: `Api-Token ${apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Untrace-SDK/1.0',
        },
        method: 'POST',
        signal: AbortSignal.timeout(10000),
      });

      if (!eventsResponse.ok) {
        return {
          details: {
            destination: this.destinationId,
            metadata: {
              config,
              status: eventsResponse.status,
              statusText: eventsResponse.statusText,
              trace,
            },
            testType: 'delivery',
          },
          error: `HTTP ${eventsResponse.status}: ${eventsResponse.statusText}`,
          message: `Dynatrace events delivery test failed: ${eventsResponse.status} ${eventsResponse.statusText}`,
          success: false,
        };
      }

      return {
        details: {
          destination: this.destinationId,
          metadata: {
            config,
            status: eventsResponse.status,
            statusText: eventsResponse.statusText,
            trace,
          },
          testType: 'delivery',
        },
        message: `Dynatrace delivery test to ${baseUrl} successful`,
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
        message: `Dynatrace delivery test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        success: false,
      };
    }
  }

  async validateConfig(config: Record<string, unknown>): Promise<TestResult> {
    try {
      const apiKey = config.apiKey as string;
      const baseUrl = config.baseUrl as string;
      const environmentId = config.environmentId as string;
      const region = config.region as string;
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
          message: 'API key is required for Dynatrace destinations',
          success: false,
        };
      }

      if (!environmentId) {
        return {
          details: {
            destination: this.destinationId,
            metadata: { config },
            testType: 'validation',
          },
          error: 'Missing required field: environmentId',
          message: 'Environment ID is required for Dynatrace destinations',
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

      // Validate region if provided
      if (region && !['US', 'EU', 'AU'].includes(region)) {
        return {
          details: {
            destination: this.destinationId,
            metadata: { config },
            testType: 'validation',
          },
          error: 'Invalid region',
          message: 'Region must be one of: US, EU, AU',
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
        message: 'Dynatrace destination configuration is valid',
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

// Register the Dynatrace provider and test runner
registerProvider(new DynatraceProviderFactory());
registerDestinationTestRunner('dynatrace', DynatraceTestRunner);
