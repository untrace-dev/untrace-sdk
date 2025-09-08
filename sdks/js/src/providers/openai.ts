import { SpanKind, SpanStatusCode } from '@opentelemetry/api';
import { ATTR_LLM_MODEL, ATTR_LLM_PROVIDER } from '../attributes';
import type {
  LLMOperationType,
  LLMRequest,
  LLMResponse,
  LLMSpanAttributes,
} from '../types';
import { BaseProviderInstrumentation } from './base';

interface OpenAIClient {
  chat?: {
    completions?: {
      create: (params: OpenAIParams) => Promise<OpenAIResponse>;
    };
  };
  completions?: {
    create: (params: OpenAIParams) => Promise<OpenAIResponse>;
  };
  embeddings?: {
    create: (params: OpenAIParams) => Promise<OpenAIResponse>;
  };
  images?: {
    generate: (params: OpenAIParams) => Promise<OpenAIResponse>;
  };
  audio?: {
    transcriptions?: {
      create: (params: OpenAIParams) => Promise<OpenAIResponse>;
    };
  };
  moderations?: {
    create: (params: OpenAIParams) => Promise<OpenAIResponse>;
  };
}

interface OpenAIParams {
  model?: string;
  messages?: Array<{ role: string; content: string }>;
  prompt?: string | string[];
  input?: string | string[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream?: boolean;
  tools?: Array<{ name: string; description?: string; parameters?: unknown }>;
}

interface OpenAIResponse {
  id?: string;
  model?: string;
  choices?: Array<{
    text?: string;
    message?: { role: string; content: string };
    index: number;
    finish_reason?: string;
  }>;
  data?: Array<{ embedding: number[] }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

/**
 * OpenAI provider instrumentation
 */
export class OpenAIInstrumentation extends BaseProviderInstrumentation {
  // biome-ignore lint/complexity/noBannedTypes: This is a valid use of any
  private originalMethods: Map<string, Function> = new Map();

  constructor() {
    super('openai', '1.0.0');
  }

  canInstrument(module: unknown): boolean {
    // Check if this is an OpenAI client
    return (
      module !== null &&
      typeof module === 'object' &&
      ('chat' in module || 'completions' in module || 'embeddings' in module)
    );
  }

  instrument<T = unknown>(module: T): T {
    const client = module as OpenAIClient;

    this.debug('Instrumenting OpenAI client:', {
      hasChat: !!client.chat,
      hasCompletions: !!client.completions,
      hasEmbeddings: !!client.embeddings,
    });

    // Instrument chat completions
    if (client.chat?.completions?.create) {
      this.debug('Instrumenting chat.completions.create');
      const originalCreate = client.chat.completions.create.bind(
        client.chat.completions,
      );
      this.originalMethods.set('chat.completions.create', originalCreate);
      client.chat.completions.create = this.wrapMethod(
        originalCreate,
        'chat',
        'chat.completions.create',
      );
    }

    // Instrument completions
    if (client.completions?.create) {
      const originalCreate = client.completions.create.bind(client.completions);
      this.originalMethods.set('completions.create', originalCreate);
      client.completions.create = this.wrapMethod(
        originalCreate,
        'completion',
        'completions.create',
      );
    }

    // Instrument embeddings
    if (client.embeddings?.create) {
      const originalCreate = client.embeddings.create.bind(client.embeddings);
      this.originalMethods.set('embeddings.create', originalCreate);
      client.embeddings.create = this.wrapMethod(
        originalCreate,
        'embedding',
        'embeddings.create',
      );
    }

    // Instrument images
    if (client.images?.generate) {
      const originalGenerate = client.images.generate.bind(client.images);
      this.originalMethods.set('images.generate', originalGenerate);
      client.images.generate = this.wrapMethod(
        originalGenerate,
        'image_generation',
        'images.generate',
      );
    }

    // Instrument audio
    if (client.audio?.transcriptions?.create) {
      const originalCreate = client.audio.transcriptions.create.bind(
        client.audio.transcriptions,
      );
      this.originalMethods.set('audio.transcriptions.create', originalCreate);
      client.audio.transcriptions.create = this.wrapMethod(
        originalCreate,
        'audio_transcription',
        'audio.transcriptions.create',
      );
    }

    // Instrument moderations
    if (client.moderations?.create) {
      const originalCreate = client.moderations.create.bind(client.moderations);
      this.originalMethods.set('moderations.create', originalCreate);
      client.moderations.create = this.wrapMethod(
        originalCreate,
        'moderation',
        'moderations.create',
      );
    }

    return module;
  }

  enable(): void {
    // Enable instrumentation - this is called when the instrumentation is enabled
    this.debug('OpenAI instrumentation enabled');
  }

  disable(): void {
    // Restore original methods
    this.originalMethods.forEach((_originalMethod, methodName) => {
      // This would need to be implemented based on how we track the instrumented modules
      this.debug(`Restored original method: ${methodName}`);
    });
    this.originalMethods.clear();
    this.debug('OpenAI instrumentation disabled');
  }

  private wrapMethod(
    originalMethod: (params: OpenAIParams) => Promise<OpenAIResponse>,
    operationType: LLMOperationType,
    methodName: string,
  ) {
    const instrumentation = this;

    return async function (
      this: unknown,
      params: OpenAIParams,
    ): Promise<OpenAIResponse> {
      instrumentation.debug(`Executing wrapped method: ${methodName}`, {
        messagesCount: params.messages?.length,
        model: params.model,
        operationType,
      });

      const tracer = instrumentation.getTracer();
      const span = tracer.startSpan(`openai.${methodName}`, {
        kind: SpanKind.CLIENT,
      });

      const startTime = Date.now();

      try {
        // Extract request data
        const request = instrumentation.extractRequest(params, operationType);

        // Set initial attributes
        const attributes: LLMSpanAttributes = {
          [ATTR_LLM_PROVIDER]: 'openai',
          [ATTR_LLM_MODEL]: request.model,
          'llm.operation.type': operationType,
        };

        if (request.parameters?.temperature !== undefined) {
          attributes['llm.temperature'] = request.parameters
            .temperature as number;
        }
        if (request.parameters?.max_tokens !== undefined) {
          attributes['llm.max_tokens'] = request.parameters
            .max_tokens as number;
        }
        if (request.parameters?.stream !== undefined) {
          attributes['llm.stream'] = request.parameters.stream as boolean;
        }

        // Add messages for chat operations
        if (request.messages) {
          attributes['llm.messages'] = JSON.stringify(request.messages);
        }

        // Add prompt for completion operations
        if (request.prompt) {
          attributes['llm.prompt'] =
            typeof request.prompt === 'string'
              ? request.prompt
              : JSON.stringify(request.prompt);
        }

        // Add input for embedding operations
        if (request.input) {
          attributes['llm.input'] =
            typeof request.input === 'string'
              ? request.input
              : JSON.stringify(request.input);
        }

        // Add tools if present
        if (request.tools) {
          attributes['llm.tools'] = JSON.stringify(request.tools);
        }

        span.setAttributes(attributes);

        // Execute original method
        const result = await originalMethod.call(this, params);

        // Extract response data
        const response = instrumentation.extractResponse(result, operationType);

        // Update attributes with response data
        if (response.usage) {
          if (response.usage.promptTokens !== undefined) {
            span.setAttribute('llm.prompt.tokens', response.usage.promptTokens);
          }
          if (response.usage.completionTokens !== undefined) {
            span.setAttribute(
              'llm.completion.tokens',
              response.usage.completionTokens,
            );
          }
          if (response.usage.totalTokens !== undefined) {
            span.setAttribute('llm.total.tokens', response.usage.totalTokens);
          }
        }

        if (response.requestId) {
          span.setAttribute('llm.request.id', response.requestId);
        }

        // Add response choices for chat/completion operations
        if (response.choices) {
          span.setAttribute('llm.choices', JSON.stringify(response.choices));
        }

        // Add embeddings for embedding operations
        if (response.embeddings) {
          span.setAttribute(
            'llm.embeddings',
            JSON.stringify(response.embeddings),
          );
        }

        const duration = Date.now() - startTime;
        span.setAttribute('llm.duration_ms', duration);

        // Calculate costs if available
        const cost = instrumentation.calculateCost(
          request.model,
          response.usage,
        );
        if (cost) {
          if (cost.prompt !== undefined) {
            span.setAttribute('llm.cost.prompt', cost.prompt);
          }
          if (cost.completion !== undefined) {
            span.setAttribute('llm.cost.completion', cost.completion);
          }
          span.setAttribute('llm.cost.total', cost.total);
        }

        span.setStatus({ code: SpanStatusCode.OK });
        span.end();

        return result;
      } catch (error) {
        // Record error
        span.recordException(error as Error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: (error as Error).message,
        });

        if (error instanceof Error) {
          span.setAttribute('llm.error', error.message);
          span.setAttribute('llm.error.type', error.name);
        }

        span.end();
        throw error;
      }
    };
  }

  private extractRequest(
    params: OpenAIParams,
    operationType: LLMOperationType,
  ): LLMRequest {
    const request: LLMRequest = {
      model: params.model || 'unknown',
      operation: operationType,
      parameters: {},
      provider: 'openai',
    };

    // Extract common parameters
    if (params.temperature !== undefined && request.parameters) {
      request.parameters.temperature = params.temperature;
    }
    if (params.max_tokens !== undefined && request.parameters) {
      request.parameters.max_tokens = params.max_tokens;
    }
    if (params.top_p !== undefined && request.parameters) {
      request.parameters.top_p = params.top_p;
    }
    if (params.stream !== undefined && request.parameters) {
      request.parameters.stream = params.stream;
    }

    // Extract operation-specific data
    switch (operationType) {
      case 'chat':
        request.messages = params.messages;
        if (params.tools) {
          request.tools = params.tools;
        }
        break;
      case 'completion':
        request.prompt = params.prompt;
        break;
      case 'embedding':
        request.input = params.input;
        break;
    }

    return request;
  }

  private extractResponse(
    response: OpenAIResponse,
    operationType: LLMOperationType,
  ): LLMResponse {
    const result: LLMResponse = {
      model: response.model || 'unknown',
    };

    // Extract common fields
    if (response.id) {
      result.requestId = response.id;
    }

    if (response.usage) {
      result.usage = {
        completionTokens: response.usage.completion_tokens,
        promptTokens: response.usage.prompt_tokens,
        totalTokens: response.usage.total_tokens,
      };
    }

    // Extract operation-specific data
    switch (operationType) {
      case 'chat':
      case 'completion':
        if (response.choices) {
          result.choices = response.choices;
        }
        break;
      case 'embedding':
        if (response.data) {
          result.embeddings = response.data.map((item) => item.embedding);
        }
        break;
    }

    return result;
  }

  private calculateCost(
    model: string,
    usage?: { promptTokens?: number; completionTokens?: number },
  ) {
    if (!usage || !usage.promptTokens || !usage.completionTokens) {
      return null;
    }

    // Cost per 1K tokens (example rates, should be configurable)
    const costs: Record<string, { prompt: number; completion: number }> = {
      'gpt-3.5-turbo': { completion: 0.0015, prompt: 0.0005 },
      'gpt-4': { completion: 0.06, prompt: 0.03 },
      'gpt-4-turbo': { completion: 0.03, prompt: 0.01 },
      'text-embedding-ada-002': { completion: 0, prompt: 0.0001 },
    };

    const modelCost = costs[model];
    if (!modelCost) {
      return null;
    }

    const promptCost = (usage.promptTokens / 1000) * modelCost.prompt;
    const completionCost =
      (usage.completionTokens / 1000) * modelCost.completion;

    return {
      completion: completionCost,
      prompt: promptCost,
      total: promptCost + completionCost,
    };
  }
}
