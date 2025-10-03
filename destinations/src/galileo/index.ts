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

// Galileo AI provider configuration schema
const GalileoConfigSchema = z.object({
  apiKey: z.string().min(1, 'API key is required'),
  enabled: z.boolean().default(true),
  endpoint: z.string().optional(),
  options: z
    .object({
      baseUrl: z.string().url().default('https://api.galileo.ai'),
      projectId: z.string().min(1, 'Project ID is required'),
      logStream: z.string().default('untrace-stream'),
      batchSize: z.number().min(1).max(1000).default(100),
      flushInterval: z.number().min(60000).max(3600000).default(300000), // 5 minutes
      timeout: z.number().min(5000).max(60000).default(30000), // 30 seconds
      retryAttempts: z.number().min(0).max(5).default(3),
      retryDelay: z.number().min(1000).max(10000).default(2000), // 2 seconds
    })
    .optional(),
});

export class GalileoProvider extends BaseIntegrationProvider {
  readonly name = 'Galileo AI';
  readonly destinationId = 'galileo';

  private baseUrl: string;
  private projectId: string;
  private logStream: string;
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
    this.baseUrl = (config.options?.baseUrl as string) || 'https://api.galileo.ai';
    this.projectId = (config.options?.projectId as string) || '';
    this.logStream = (config.options?.logStream as string) || 'untrace-stream';
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
      GalileoConfigSchema.parse(config);
      return { success: true };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Invalid configuration',
        success: false,
      };
    }
  }

  getConfigSchema(): z.ZodSchema {
    return GalileoConfigSchema;
  }

  private addTraceToBuffer(trace: TraceData, context: TraceContext): void {
    this.dataBuffer.push({
      context,
      timestamp: new Date().toISOString(),
      trace,
    });

    // Flush if buffer is full
    if (this.dataBuffer.length >= this.batchSize) {
      this.flushToGalileo();
    }
  }

  private async flushToGalileo(): Promise<void> {
    if (this.dataBuffer.length === 0) {
      return;
    }

    const dataToFlush = [...this.dataBuffer];
    this.dataBuffer = [];

    try {
      await this.sendBatchToGalileo(dataToFlush);
    } catch (error) {
      console.error(
        '[GalileoProvider] Failed to flush data to Galileo AI:',
        error,
      );
      // Re-add data to buffer for retry
      this.dataBuffer.unshift(...dataToFlush);
    }
  }

  private async sendBatchToGalileo(
    data: Array<{
      trace: TraceData;
      context: TraceContext;
      timestamp: string;
    }>,
  ): Promise<void> {
    // Transform data to Galileo AI format
    const galileoSamples = data.map((item) => ({
      task_type: this.determineTaskType(item.trace),
      input: this.extractInput(item.trace),
      output: this.extractOutput(item.trace),
      metadata: {
        trace_id: item.trace.id,
        trace_name: item.trace.name,
        trace_status: item.trace.status,
        trace_duration: item.trace.duration,
        org_id: item.context.orgId,
        project_id: item.context.projectId,
        user_id: item.context.userId,
        api_key_id: item.context.apiKeyId,
        ingestion_timestamp: item.timestamp,
        source: 'untrace-sdk',
        // LLM specific metadata
        model: item.trace.attributes?.['llm.model'] || 'unknown',
        temperature: item.trace.attributes?.['llm.temperature'] || 0.7,
        max_tokens: item.trace.attributes?.['llm.max_tokens'] || 1000,
        total_tokens: item.trace.attributes?.['llm.total_tokens'] || 0,
        prompt_tokens: item.trace.attributes?.['llm.prompt_tokens'] || 0,
        completion_tokens: item.trace.attributes?.['llm.completion_tokens'] || 0,
        // Additional attributes
        ...Object.fromEntries(
          Object.entries(item.trace.attributes || {}).filter(
            ([key]) =>
              !key.startsWith('llm.') &&
              !key.startsWith('input.') &&
              !key.startsWith('output.'),
          ),
        ),
      },
    }));

    const endpoint = this.buildEndpoint('/samples');
    await this.makeRequestWithRetry(endpoint, {
      body: JSON.stringify(galileoSamples),
      headers: {
        'Content-Type': 'application/json',
        'Galileo-API-Key': this.config.apiKey,
        'User-Agent': 'Untrace-SDK/1.0',
      },
    });
  }

  private determineTaskType(trace: TraceData): string {
    // Determine task type based on trace attributes and name
    const model = trace.attributes?.['llm.model'];
    const traceName = trace.name?.toLowerCase() || '';

    if (model || traceName.includes('llm') || traceName.includes('gpt')) {
      return 'text-generation';
    }
    if (traceName.includes('embedding') || traceName.includes('vector')) {
      return 'embedding';
    }
    if (traceName.includes('classification') || traceName.includes('classify')) {
      return 'classification';
    }
    if (traceName.includes('summarization') || traceName.includes('summarize')) {
      return 'summarization';
    }
    if (traceName.includes('translation') || traceName.includes('translate')) {
      return 'translation';
    }
    if (traceName.includes('question') || traceName.includes('qa')) {
      return 'question-answering';
    }
    if (traceName.includes('chat') || traceName.includes('conversation')) {
      return 'chat';
    }

    return 'text-generation'; // Default to text generation
  }

  private extractInput(trace: TraceData): string {
    // Extract input from trace attributes
    const messages = trace.attributes?.['llm.messages'];
    if (Array.isArray(messages) && messages.length > 0) {
      return messages
        .map((msg: any) => {
          if (typeof msg === 'string') return msg;
          if (msg.content) return msg.content;
          if (msg.message) return msg.message;
          return JSON.stringify(msg);
        })
        .join('\n');
    }

    const prompt = trace.attributes?.['llm.prompt'];
    if (prompt) return String(prompt);

    const input = trace.attributes?.['input.text'] || trace.attributes?.['input'];
    if (input) return String(input);

    return trace.name || 'untrace-input';
  }

  private extractOutput(trace: TraceData): string {
    // Extract output from trace attributes
    const response = trace.attributes?.['llm.response'];
    if (response) return String(response);

    const output = trace.attributes?.['output.text'] || trace.attributes?.['output'];
    if (output) return String(output);

    const completion = trace.attributes?.['llm.completion'];
    if (completion) return String(completion);

    return trace.status === 'error' ? 'Error occurred' : 'Success';
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
            `Galileo AI API error: ${response.status} ${response.statusText} - ${errorText}`,
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
      this.flushToGalileo();
    }, this.flushInterval);
  }

  async destroy(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
    await this.flushToGalileo();
  }
}

// Galileo AI provider factory
export class GalileoProviderFactory implements ProviderFactory {
  createProvider(
    config: ProviderConfig,
    destinationId: string,
  ): GalileoProvider {
    return new GalileoProvider(config, destinationId);
  }

  getDestinationId(): string {
    return 'galileo';
  }

  getConfigSchema(): z.ZodSchema {
    return GalileoConfigSchema;
  }
}

// Galileo AI test runner
export class GalileoTestRunner extends BaseDestinationTestRunner {
  async testConnection(config: Record<string, unknown>): Promise<TestResult> {
    try {
      const apiKey = config.apiKey as string;
      const baseUrl = (config.baseUrl as string) || 'https://api.galileo.ai';

      if (!apiKey) {
        return {
          details: {
            destination: this.destinationId,
            metadata: { config },
            testType: 'connection',
          },
          error: 'Missing required field: apiKey',
          message: 'API key is required for Galileo AI destinations',
          success: false,
        };
      }

      // Test connection by making a request to Galileo AI's API
      const testEndpoint = `${baseUrl}/samples`;
      const response = await fetch(testEndpoint, {
        headers: {
          'Content-Type': 'application/json',
          'Galileo-API-Key': apiKey,
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
          message: `Galileo AI connection test failed: ${response.status} ${response.statusText}`,
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
        message: `Galileo AI connection test to ${baseUrl} successful`,
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
        message: `Galileo AI connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
      const baseUrl = (config.baseUrl as string) || 'https://api.galileo.ai';
      const projectId = config.projectId as string;
      const logStream = (config.logStream as string) || 'untrace-stream';

      if (!apiKey) {
        return {
          details: {
            destination: this.destinationId,
            metadata: { config, trace },
            testType: 'delivery',
          },
          error: 'Missing required fields for delivery test',
          message: 'API key is required for Galileo AI destinations',
          success: false,
        };
      }

      // Test delivery by sending a sample Galileo AI log
      const testEndpoint = `${baseUrl}/samples`;
      const response = await fetch(testEndpoint, {
        body: JSON.stringify([
          {
            task_type: 'text-generation',
            input: 'Hello, world! This is a test input.',
            output: 'Hello! This is a test response from Galileo AI.',
            metadata: {
              trace_id: trace.id || 'test-trace-delivery',
              trace_name: 'test-trace',
              trace_status: 'ok',
              trace_duration: 100,
              org_id: 'test-org',
              project_id: projectId || 'test-project',
              user_id: 'test-user',
              api_key_id: 'test-api-key',
              ingestion_timestamp: new Date().toISOString(),
              source: 'untrace-sdk',
              model: 'gpt-4',
              temperature: 0.7,
              max_tokens: 100,
              total_tokens: 15,
              prompt_tokens: 10,
              completion_tokens: 5,
              test: true,
              ...trace,
            },
          },
        ]),
        headers: {
          'Content-Type': 'application/json',
          'Galileo-API-Key': apiKey,
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
          message: `Galileo AI delivery test failed: ${response.status} ${response.statusText}`,
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
        message: `Galileo AI delivery test to ${baseUrl} successful`,
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
        message: `Galileo AI delivery test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        success: false,
      };
    }
  }

  async validateConfig(config: Record<string, unknown>): Promise<TestResult> {
    try {
      const apiKey = config.apiKey as string;
      const baseUrl = config.baseUrl as string;
      const projectId = config.projectId as string;
      const logStream = config.logStream as string;
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
          message: 'API key is required for Galileo AI destinations',
          success: false,
        };
      }

      if (!projectId) {
        return {
          details: {
            destination: this.destinationId,
            metadata: { config },
            testType: 'validation',
          },
          error: 'Missing required field: projectId',
          message: 'Project ID is required for Galileo AI destinations',
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

      // Validate project ID if provided
      if (projectId && projectId.length === 0) {
        return {
          details: {
            destination: this.destinationId,
            metadata: { config },
            testType: 'validation',
          },
          error: 'Invalid project ID',
          message: 'Project ID cannot be empty',
          success: false,
        };
      }

      // Validate log stream if provided
      if (logStream && logStream.length === 0) {
        return {
          details: {
            destination: this.destinationId,
            metadata: { config },
            testType: 'validation',
          },
          error: 'Invalid log stream',
          message: 'Log stream cannot be empty',
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
        message: 'Galileo AI destination configuration is valid',
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

// Register the Galileo AI provider and test runner
registerProvider(new GalileoProviderFactory());
registerDestinationTestRunner('galileo', GalileoTestRunner);
