import { SpanKind, SpanStatusCode } from '@opentelemetry/api';
import {
  LLM_OPERATION_TYPES,
  LLM_PROVIDERS,
  type LLMChoice,
  type LLMMessage,
  type LLMUsage,
  OpenInferenceAttributeBuilder,
} from '../semantic-conventions';
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


    return async (...args: unknown[]) => {
      const tracer = this.getTracer();
      const span = tracer.startSpan('ai-sdk.generateText', {
        kind: SpanKind.CLIENT,
      });

      const startTime = Date.now();

      try {
        // Extract request data from first argument (options object)
        const options = (args[0] as AISDKOptions) || {};
        const request = this.extractAISDKRequest(options);

        // Build OpenInference-compliant attributes
        const attributeBuilder = new OpenInferenceAttributeBuilder()
          .setOperation(
            LLM_OPERATION_TYPES.CHAT,
            request.provider || LLM_PROVIDERS.AI_SDK,
            request.model || 'unknown',
          )
          .setConfig(
            request.parameters?.temperature,
            request.parameters?.maxOutputTokens,
            request.parameters?.topP,
            false, // not streaming for generateText
          );

        // Set input attributes
        if (request.messages) {
          const messages: LLMMessage[] = Array.isArray(request.messages)
            ? (request.messages as LLMMessage[])
            : [{ content: String(request.messages), role: 'user' }];
          attributeBuilder.setInput(messages);
        } else if (request.prompt) {
          const promptStr =
            typeof request.prompt === 'string'
              ? request.prompt
              : JSON.stringify(request.prompt);
          attributeBuilder.setInput([{ content: promptStr, role: 'user' }]);
        }

        const attributes = attributeBuilder.build();

        span.setAttributes(attributes);

        // Execute the original function
        const result = await originalGenerateText(...args);

        // Extract response data
        const response = this.extractAISDKResponse(result as AISDKResponse);

        // Build response attributes using OpenInference conventions
        const responseBuilder = new OpenInferenceAttributeBuilder();

        // Set output choices
        if (response.text) {
          const choices: LLMChoice[] = [
            {
              finish_reason: 'stop',
              index: 0,
              message: {
                content: response.text,
                role: 'assistant',
              },
            },
          ];
          responseBuilder.setOutput(choices);
        } else if (response.choices) {
          responseBuilder.setOutput(response.choices as LLMChoice[]);
        }

        // Set usage information
        if (response.usage) {
          const usage: LLMUsage = {
            completion_tokens: response.usage.completionTokens,
            prompt_tokens: response.usage.promptTokens,
            total_tokens: response.usage.totalTokens,
          };
          responseBuilder.setUsage(usage);
        }

        // Set performance metrics
        const duration = Date.now() - startTime;
        responseBuilder.setPerformance(duration);

        span.setAttributes(responseBuilder.build());
        span.setStatus({ code: SpanStatusCode.OK });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;

        // Set error attributes using OpenInference conventions
        const errorBuilder = new OpenInferenceAttributeBuilder()
          .setError(
            error instanceof Error ? error.message : 'Unknown error',
            'api_error',
          )
          .setPerformance(duration);

        span.setAttributes(errorBuilder.build());

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


    return async (...args: unknown[]) => {
      const tracer = this.getTracer();
      const span = tracer.startSpan('ai-sdk.streamText', {
        kind: SpanKind.CLIENT,
      });

      const startTime = Date.now();

      try {
        // Extract request data from first argument (options object)
        const options = (args[0] as AISDKOptions) || {};
        const request = this.extractAISDKRequest(options);

        // Build OpenInference-compliant attributes for streaming
        const attributeBuilder = new OpenInferenceAttributeBuilder()
          .setOperation(
            LLM_OPERATION_TYPES.CHAT,
            request.provider || LLM_PROVIDERS.AI_SDK,
            request.model || 'unknown',
          )
          .setConfig(
            request.parameters?.temperature,
            request.parameters?.maxOutputTokens,
            request.parameters?.topP,
            true, // streaming enabled
          );

        // Set input attributes
        if (request.messages) {
          const messages: LLMMessage[] = Array.isArray(request.messages)
            ? (request.messages as LLMMessage[])
            : [{ content: String(request.messages), role: 'user' }];
          attributeBuilder.setInput(messages);
        } else if (request.prompt) {
          const promptStr =
            typeof request.prompt === 'string'
              ? request.prompt
              : JSON.stringify(request.prompt);
          attributeBuilder.setInput([{ content: promptStr, role: 'user' }]);
        }

        const attributes = attributeBuilder.build();

        span.setAttributes(attributes);

        // Execute the original function
        const result = await originalStreamText(...args);

        // For streaming, we can't easily extract the full response
        // but we can mark it as successful
        const duration = Date.now() - startTime;

        const responseBuilder =
          new OpenInferenceAttributeBuilder().setPerformance(duration);

        span.setAttributes(responseBuilder.build());

        span.setStatus({ code: SpanStatusCode.OK });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;

        // Set error attributes using OpenInference conventions
        const errorBuilder = new OpenInferenceAttributeBuilder()
          .setError(
            error instanceof Error ? error.message : 'Unknown error',
            'api_error',
          )
          .setPerformance(duration);

        span.setAttributes(errorBuilder.build());

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
    // Instrument the AI SDK module
    try {
      // Dynamic import for ESM compatibility
      import('ai').then((aiModule) => {
        this.instrument(aiModule);
      }).catch((error) => {
        this.debug('Failed to instrument AI SDK:', error);
      });
    } catch (error) {
      this.debug('Failed to instrument AI SDK:', error);
    }
  }

  disable(): void {
    // Restore original functions
    try {
      // Dynamic import for ESM compatibility
      import('ai').then((aiModule) => {
        if (this.originalGenerateText) {
          (aiModule as Record<string, unknown>).generateText = this.originalGenerateText;
        }
        if (this.originalStreamText) {
          (aiModule as Record<string, unknown>).streamText = this.originalStreamText;
        }
      }).catch((error) => {
        this.debug('Failed to disable AI SDK instrumentation:', error);
      });
    } catch (error) {
      this.debug('Failed to disable AI SDK instrumentation:', error);
    }
  }
}
