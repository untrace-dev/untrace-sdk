import { SpanKind, SpanStatusCode } from '@opentelemetry/api';
import { LLM_ATTRIBUTES } from '../attributes';
import type { LLMSpanAttributes } from '../types';
import { BaseProviderInstrumentation } from './base';

// AI SDK function types
type GenerateTextFunction = (...args: unknown[]) => Promise<unknown>;
type StreamTextFunction = (...args: unknown[]) => Promise<unknown>;

interface AISDKOptions {
  model?: unknown;
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  messages?: unknown[];
  prompt?: string | unknown;
}

interface AISDKResponse {
  choices?: unknown[];
  usage?: {
    totalTokens?: number;
    completionTokens?: number;
    promptTokens?: number;
  };
  text?: string;
}

/**
 * AI SDK provider instrumentation
 */
export class AISDKInstrumentation extends BaseProviderInstrumentation {
  private originalGenerateText?: GenerateTextFunction;
  private originalStreamText?: StreamTextFunction;

  constructor() {
    super('ai-sdk', '1.0.0');
  }

  canInstrument(module: unknown): boolean {
    // Check if this is the AI SDK module
    return (
      module !== null &&
      typeof module === 'object' &&
      ('generateText' in module || 'streamText' in module)
    );
  }

  instrument<T = unknown>(module: T): T {
    const aiSdk = module as Record<string, unknown>;

    this.debug('Instrumenting AI SDK:', {
      hasGenerateText: !!aiSdk.generateText,
      hasStreamText: !!aiSdk.streamText,
    });

    // Instrument generateText
    if (aiSdk.generateText && typeof aiSdk.generateText === 'function') {
      this.debug('Instrumenting generateText');
      this.originalGenerateText = aiSdk.generateText.bind(
        aiSdk,
      ) as GenerateTextFunction;
      aiSdk.generateText = this.wrapGenerateText(this.originalGenerateText);
    }

    // Instrument streamText
    if (aiSdk.streamText && typeof aiSdk.streamText === 'function') {
      this.debug('Instrumenting streamText');
      this.originalStreamText = aiSdk.streamText.bind(
        aiSdk,
      ) as StreamTextFunction;
      aiSdk.streamText = this.wrapStreamText(this.originalStreamText);
    }

    return aiSdk as T;
  }

  private wrapGenerateText(
    originalGenerateText: GenerateTextFunction,
  ): GenerateTextFunction {
    const instrumentation = this;

    return async function (...args: unknown[]) {
      const tracer = instrumentation.getTracer();
      const span = tracer.startSpan('ai-sdk.generateText', {
        kind: SpanKind.CLIENT,
      });

      const startTime = Date.now();

      try {
        // Extract request data from first argument (options object)
        const options = (args[0] as AISDKOptions) || {};
        const request = instrumentation.extractAISDKRequest(options);

        // Set initial attributes
        const attributes: LLMSpanAttributes = {
          [LLM_ATTRIBUTES.PROVIDER]: request.provider || 'ai-sdk',
          [LLM_ATTRIBUTES.MODEL]: request.model || 'unknown',
          [LLM_ATTRIBUTES.OPERATION_TYPE]: 'chat',
        };

        if (request.parameters?.temperature !== undefined) {
          attributes[LLM_ATTRIBUTES.TEMPERATURE] =
            request.parameters.temperature;
        }
        if (request.parameters?.maxOutputTokens !== undefined) {
          attributes[LLM_ATTRIBUTES.MAX_TOKENS] =
            request.parameters.maxOutputTokens;
        }
        if (request.parameters?.topP !== undefined) {
          attributes['llm.top_p'] = request.parameters.topP;
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

        span.setAttributes(attributes);

        // Execute the original function
        const result = await originalGenerateText.apply(this, args);

        // Extract response data
        const response = instrumentation.extractAISDKResponse(
          result as AISDKResponse,
        );

        // Set response attributes
        const responseAttributes: Partial<LLMSpanAttributes> = {};

        if (response.choices) {
          responseAttributes['llm.choices'] = JSON.stringify(response.choices);
        }

        if (response.usage) {
          responseAttributes[LLM_ATTRIBUTES.TOTAL_TOKENS] =
            response.usage.totalTokens || 0;
          responseAttributes[LLM_ATTRIBUTES.COMPLETION_TOKENS] =
            response.usage.completionTokens || 0;
          responseAttributes[LLM_ATTRIBUTES.PROMPT_TOKENS] =
            response.usage.promptTokens || 0;
        }

        // Calculate duration
        const duration = Date.now() - startTime;
        responseAttributes[LLM_ATTRIBUTES.DURATION] = duration;

        span.setAttributes(responseAttributes);
        span.setStatus({ code: SpanStatusCode.OK });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;

        span.setAttributes({
          [LLM_ATTRIBUTES.ERROR]:
            error instanceof Error ? error.message : 'Unknown error',
          [LLM_ATTRIBUTES.ERROR_TYPE]: 'api_error',
          [LLM_ATTRIBUTES.DURATION]: duration,
        });

        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : 'Unknown error',
        });

        throw error;
      } finally {
        span.end();
      }
    };
  }

  private wrapStreamText(
    originalStreamText: StreamTextFunction,
  ): StreamTextFunction {
    const instrumentation = this;

    return async function (...args: unknown[]) {
      const tracer = instrumentation.getTracer();
      const span = tracer.startSpan('ai-sdk.streamText', {
        kind: SpanKind.CLIENT,
      });

      const startTime = Date.now();

      try {
        // Extract request data from first argument (options object)
        const options = (args[0] as AISDKOptions) || {};
        const request = instrumentation.extractAISDKRequest(options);

        // Set initial attributes
        const attributes: LLMSpanAttributes = {
          [LLM_ATTRIBUTES.PROVIDER]: request.provider || 'ai-sdk',
          [LLM_ATTRIBUTES.MODEL]: request.model || 'unknown',
          [LLM_ATTRIBUTES.OPERATION_TYPE]: 'chat',
          [LLM_ATTRIBUTES.STREAM]: true,
        };

        if (request.parameters?.temperature !== undefined) {
          attributes[LLM_ATTRIBUTES.TEMPERATURE] =
            request.parameters.temperature;
        }
        if (request.parameters?.maxOutputTokens !== undefined) {
          attributes[LLM_ATTRIBUTES.MAX_TOKENS] =
            request.parameters.maxOutputTokens;
        }
        if (request.parameters?.topP !== undefined) {
          attributes['llm.top_p'] = request.parameters.topP;
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

        span.setAttributes(attributes);

        // Execute the original function
        const result = await originalStreamText.apply(this, args);

        // For streaming, we can't easily extract the full response
        // but we can mark it as successful
        const duration = Date.now() - startTime;

        span.setAttributes({
          [LLM_ATTRIBUTES.STREAM]: true,
          [LLM_ATTRIBUTES.DURATION]: duration,
        });

        span.setStatus({ code: SpanStatusCode.OK });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;

        span.setAttributes({
          [LLM_ATTRIBUTES.ERROR]:
            error instanceof Error ? error.message : 'Unknown error',
          [LLM_ATTRIBUTES.ERROR_TYPE]: 'api_error',
          [LLM_ATTRIBUTES.DURATION]: duration,
        });

        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : 'Unknown error',
        });

        throw error;
      } finally {
        span.end();
      }
    };
  }

  private extractAISDKRequest(options: AISDKOptions) {
    const request: {
      provider: string;
      model: string;
      parameters: {
        temperature?: number;
        maxOutputTokens?: number;
        topP?: number;
      };
      messages?: unknown[];
      prompt?: string | unknown;
    } = {
      model: 'unknown',
      parameters: {},
      provider: 'ai-sdk',
    };

    // Extract model information
    if (options.model) {
      // Try to extract provider and model from the model object
      if (typeof options.model === 'object' && options.model !== null) {
        const modelObj = options.model as Record<string, unknown>;
        request.provider = (modelObj.provider as string) || 'ai-sdk';
        request.model = (modelObj.modelId as string) || 'unknown';
      } else {
        request.model = String(options.model);
      }
    }

    // Extract parameters
    if (options.temperature !== undefined) {
      request.parameters.temperature = options.temperature;
    }
    if (options.maxOutputTokens !== undefined) {
      request.parameters.maxOutputTokens = options.maxOutputTokens;
    }
    if (options.topP !== undefined) {
      request.parameters.topP = options.topP;
    }

    // Extract messages
    if (options.messages) {
      request.messages = options.messages;
    }

    // Extract prompt
    if (options.prompt) {
      request.prompt = options.prompt;
    }

    return request;
  }

  private extractAISDKResponse(result: AISDKResponse) {
    const response: AISDKResponse = {};

    // Extract choices if available
    if (result.choices) {
      response.choices = result.choices;
    }

    // Extract usage if available
    if (result.usage) {
      response.usage = {
        completionTokens: result.usage.completionTokens,
        promptTokens: result.usage.promptTokens,
        totalTokens: result.usage.totalTokens,
      };
    }

    // Extract text if available (for generateText)
    if (result.text) {
      response.text = result.text;
    }

    return response;
  }

  enable(): void {
    // Implementation for enabling instrumentation
  }

  disable(): void {
    // Implementation for disabling instrumentation
  }
}
