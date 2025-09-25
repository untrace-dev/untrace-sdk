import { SpanKind, SpanStatusCode } from '@opentelemetry/api';
import { LLM_ATTRIBUTES } from '../attributes';
import type { LLMSpanAttributes } from '../types';
import { BaseProviderInstrumentation } from './base';

// Bedrock function types
type BedrockFunction = (modelId: string, options?: unknown) => unknown;

interface BedrockOptions {
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  messages?: unknown[];
  prompt?: string | unknown;
}

interface BedrockResponse {
  choices?: unknown[];
  usage?: {
    totalTokens?: number;
    completionTokens?: number;
    promptTokens?: number;
  };
  text?: string;
}

/**
 * AWS Bedrock provider instrumentation
 */
export class BedrockInstrumentation extends BaseProviderInstrumentation {
  private originalBedrock?: BedrockFunction;

  constructor() {
    super('bedrock', '1.0.0');
  }

  canInstrument(module: unknown): boolean {
    // Check if this is the Bedrock module (from @ai-sdk/amazon-bedrock)
    return (
      module !== null &&
      typeof module === 'function' &&
      module.name === 'bedrock'
    );
  }

  instrument<T = unknown>(module: T): T {
    const bedrock = module as BedrockFunction;

    this.debug('Instrumenting Bedrock provider');

    this.originalBedrock = bedrock.bind(module);

    // Return a wrapped function that creates a model with instrumentation
    return ((modelId: string, options?: unknown) => {
      const tracer = this.getTracer();

      // Create a proxy for the model that intercepts calls
      const originalModel = this.originalBedrock?.(modelId, options);
      if (!originalModel) {
        throw new Error('Failed to create Bedrock model');
      }

      return new Proxy(originalModel, {
        get: (target, prop) => {
          const originalMethod = target[prop as keyof typeof target];

          if (typeof originalMethod === 'function') {
            return (...args: unknown[]) => {
              const span = tracer.startSpan('bedrock.generate', {
                kind: SpanKind.CLIENT,
              });

              const startTime = Date.now();

              try {
                // Extract model information
                const modelInfo = extractModelInfo(modelId);

                // Set initial attributes
                const attributes: LLMSpanAttributes = {
                  [LLM_ATTRIBUTES.PROVIDER]: 'aws-bedrock',
                  [LLM_ATTRIBUTES.MODEL]: modelInfo.modelName,
                  [LLM_ATTRIBUTES.OPERATION_TYPE]: 'chat',
                };

                // Extract request parameters if available
                if (args[0]) {
                  const requestOptions = args[0] as BedrockOptions;

                  if (requestOptions.temperature !== undefined) {
                    attributes[LLM_ATTRIBUTES.TEMPERATURE] =
                      requestOptions.temperature;
                  }
                  if (requestOptions.maxOutputTokens !== undefined) {
                    attributes[LLM_ATTRIBUTES.MAX_TOKENS] =
                      requestOptions.maxOutputTokens;
                  }
                  if (requestOptions.topP !== undefined) {
                    attributes['llm.top_p'] = requestOptions.topP;
                  }
                  if (requestOptions.messages) {
                    attributes['llm.messages'] = JSON.stringify(
                      requestOptions.messages,
                    );
                  }
                  if (requestOptions.prompt) {
                    attributes['llm.prompt'] =
                      typeof requestOptions.prompt === 'string'
                        ? requestOptions.prompt
                        : JSON.stringify(requestOptions.prompt);
                  }
                }

                span.setAttributes(attributes);

                // Execute the original method
                const result = originalMethod.apply(target, args);

                // Handle both sync and async results
                if (result && typeof result.then === 'function') {
                  // Async result
                  return result
                    .then((response: unknown) => {
                      const duration = Date.now() - startTime;

                      // Extract response data
                      const responseData = extractBedrockResponse(
                        response as BedrockResponse,
                      );

                      const responseAttributes: Partial<LLMSpanAttributes> = {};

                      if (responseData.choices) {
                        responseAttributes['llm.choices'] = JSON.stringify(
                          responseData.choices,
                        );
                      }

                      if (responseData.usage) {
                        responseAttributes[LLM_ATTRIBUTES.TOTAL_TOKENS] =
                          responseData.usage.totalTokens || 0;
                        responseAttributes[LLM_ATTRIBUTES.COMPLETION_TOKENS] =
                          responseData.usage.completionTokens || 0;
                        responseAttributes[LLM_ATTRIBUTES.PROMPT_TOKENS] =
                          responseData.usage.promptTokens || 0;
                      }

                      responseAttributes[LLM_ATTRIBUTES.DURATION] = duration;

                      span.setAttributes(responseAttributes);
                      span.setStatus({ code: SpanStatusCode.OK });
                      span.end();

                      return response;
                    })
                    .catch((error: unknown) => {
                      const duration = Date.now() - startTime;

                      span.setAttributes({
                        [LLM_ATTRIBUTES.ERROR]:
                          error instanceof Error
                            ? error.message
                            : 'Unknown error',
                        [LLM_ATTRIBUTES.ERROR_TYPE]: 'api_error',
                        [LLM_ATTRIBUTES.DURATION]: duration,
                      });

                      span.setStatus({
                        code: SpanStatusCode.ERROR,
                        message:
                          error instanceof Error
                            ? error.message
                            : 'Unknown error',
                      });

                      span.end();
                      throw error;
                    });
                }

                // Sync result
                const duration = Date.now() - startTime;

                span.setAttributes({
                  [LLM_ATTRIBUTES.DURATION]: duration,
                });

                span.setStatus({ code: SpanStatusCode.OK });
                span.end();

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
                  message:
                    error instanceof Error ? error.message : 'Unknown error',
                });

                span.end();
                throw error;
              }
            };
          }

          return originalMethod;
        },
      });
    }) as T;
  }

  enable(): void {
    // Implementation for enabling instrumentation
  }

  disable(): void {
    // Implementation for disabling instrumentation
  }
}

/**
 * Extract model information from Bedrock model ID
 */
function extractModelInfo(modelId: string) {
  // Handle different Bedrock model ID formats
  if (modelId.startsWith('arn:aws:bedrock:')) {
    // Inference profile ARN format
    const parts = modelId.split('/');
    const modelName = parts.at(-1) || 'unknown';
    return {
      isInferenceProfile: true,
      modelName: modelName,
      provider: 'aws-bedrock',
    };
  }

  if (modelId.includes('anthropic.claude')) {
    // Direct model ID format
    return {
      isInferenceProfile: false,
      modelName: modelId,
      provider: 'aws-bedrock',
    };
  }

  // Generic format
  return {
    isInferenceProfile: false,
    modelName: modelId,
    provider: 'aws-bedrock',
  };
}

/**
 * Extract response data from Bedrock response
 */
function extractBedrockResponse(response: BedrockResponse) {
  const responseData: BedrockResponse = {};

  // Extract choices if available
  if (response.choices) {
    responseData.choices = response.choices;
  }

  // Extract usage if available
  if (response.usage) {
    responseData.usage = {
      completionTokens: response.usage.completionTokens,
      promptTokens: response.usage.promptTokens,
      totalTokens: response.usage.totalTokens,
    };
  }

  // Extract text if available
  if (response.text) {
    responseData.text = response.text;
  }

  return responseData;
}
