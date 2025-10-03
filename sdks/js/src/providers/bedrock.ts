import { SpanKind, SpanStatusCode } from '@opentelemetry/api';
import {
  LLM_OPERATION_TYPES,
  LLM_PROVIDERS,
  type LLMChoice,
  type LLMMessage,
  OpenInferenceAttributeBuilder,
  PROVIDER_SEMANTIC_CONVENTIONS,
} from '../semantic-conventions';
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
          const originalMethod = target[prop as keyof typeof target] as unknown;

          if (typeof originalMethod === 'function') {
            return (...args: unknown[]) => {
              const span = tracer.startSpan('bedrock.generate', {
                kind: SpanKind.CLIENT,
              });

              const startTime = Date.now();

              try {
                // Extract model information
                const modelInfo = extractModelInfo(modelId);

                // Build OpenInference-compliant attributes for Bedrock
                const attributeBuilder =
                  new OpenInferenceAttributeBuilder().setOperation(
                    LLM_OPERATION_TYPES.CHAT,
                    LLM_PROVIDERS.AWS_BEDROCK,
                    modelInfo.modelName,
                  );

                // Add Bedrock-specific attributes
                if (modelInfo.isInferenceProfile) {
                  attributeBuilder.setAttribute(
                    PROVIDER_SEMANTIC_CONVENTIONS.BEDROCK.INFERENCE_PROFILE,
                    modelId,
                  );
                }
                attributeBuilder.setAttribute(
                  PROVIDER_SEMANTIC_CONVENTIONS.BEDROCK.MODEL_ARN,
                  modelId,
                );

                // Extract request parameters if available
                if (args[0]) {
                  const requestOptions = args[0] as BedrockOptions;

                  // Set configuration parameters
                  attributeBuilder.setConfig(
                    requestOptions.temperature,
                    requestOptions.maxOutputTokens,
                    requestOptions.topP,
                    false, // Bedrock doesn't stream by default
                  );

                  // Set input attributes
                  if (requestOptions.messages) {
                    const messages: LLMMessage[] = Array.isArray(
                      requestOptions.messages,
                    )
                      ? (requestOptions.messages as LLMMessage[])
                      : [
                        {
                          content: String(requestOptions.messages),
                          role: 'user',
                        },
                      ];
                    attributeBuilder.setInput(messages);
                  } else if (requestOptions.prompt) {
                    const promptStr =
                      typeof requestOptions.prompt === 'string'
                        ? requestOptions.prompt
                        : JSON.stringify(requestOptions.prompt);
                    attributeBuilder.setInput([
                      { content: promptStr, role: 'user' },
                    ]);
                  }
                }

                const attributes = attributeBuilder.build();

                span.setAttributes(attributes);

                // Execute the original method
                const result = (
                  originalMethod as (...args: unknown[]) => unknown
                ).apply(target, args);

                // Handle both sync and async results
                if (
                  result &&
                  typeof (result as Promise<unknown>).then === 'function'
                ) {
                  // Async result
                  return (result as Promise<unknown>)
                    .then((response: unknown) => {
                      const duration = Date.now() - startTime;

                      // Extract response data
                      const responseData = extractBedrockResponse(
                        response as BedrockResponse,
                      );

                      // Build response attributes using OpenInference conventions
                      const responseBuilder =
                        new OpenInferenceAttributeBuilder();

                      if (responseData.choices) {
                        responseBuilder.setOutput(
                          responseData.choices as LLMChoice[],
                        );
                      }

                      if (responseData.usage) {
                        responseBuilder.setUsage({
                          completion_tokens:
                            responseData.usage.completionTokens,
                          prompt_tokens: responseData.usage.promptTokens,
                          total_tokens: responseData.usage.totalTokens,
                        });
                      }

                      responseBuilder.setPerformance(duration);

                      span.setAttributes(responseBuilder.build());
                      span.setStatus({ code: SpanStatusCode.OK });
                      span.end();

                      return response;
                    })
                    .catch((error: unknown) => {
                      const duration = Date.now() - startTime;

                      // Set error attributes using OpenInference conventions
                      const errorBuilder = new OpenInferenceAttributeBuilder()
                        .setError(
                          error instanceof Error
                            ? error.message
                            : 'Unknown error',
                          'api_error',
                        )
                        .setPerformance(duration);

                      span.setAttributes(errorBuilder.build());

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

                const syncResponseBuilder =
                  new OpenInferenceAttributeBuilder().setPerformance(duration);

                span.setAttributes(syncResponseBuilder.build());

                span.setStatus({ code: SpanStatusCode.OK });
                span.end();

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
    // Instrument the Bedrock module
    try {
      // Dynamic import for ESM compatibility
      import('@ai-sdk/amazon-bedrock')
        .then((bedrockModule) => {
          this.instrument(bedrockModule);
        })
        .catch((error) => {
          this.debug('Failed to instrument Bedrock:', error);
        });
    } catch (error) {
      this.debug('Failed to instrument Bedrock:', error);
    }
  }

  disable(): void {
    // Note: Bedrock instrumentation uses a proxy, so we can't easily restore
    // The proxy will be garbage collected when the instrumentation is disabled
    this.debug('Bedrock instrumentation disabled');
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
