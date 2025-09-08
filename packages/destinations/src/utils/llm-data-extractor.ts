/**
 * Shared utility for extracting LLM data from trace payloads
 * Supports multiple trace data formats including the new request/response structure
 */

export interface LLMData {
  spanName?: string;
  model?: string;
  provider?: string;
  input?: Array<{
    role: string;
    content: Array<{
      type: string;
      text?: string;
      image?: string;
      function?: {
        name: string;
        arguments: Record<string, unknown>;
      };
    }>;
  }>;
  inputTokens?: number;
  outputChoices?: Array<{
    role: string;
    content: Array<{
      type: string;
      text?: string;
      function?: {
        name: string;
        arguments: Record<string, unknown>;
      };
    }>;
  }>;
  outputTokens?: number;
  latency?: number;
  httpStatus?: number;
  baseUrl?: string;
  requestUrl?: string;
  isError?: boolean;
  error?: string | Record<string, unknown>;
  inputCostUsd?: number;
  outputCostUsd?: number;
  totalCostUsd?: number;
  cacheReadInputTokens?: number;
  cacheCreationInputTokens?: number;
  temperature?: number;
  stream?: boolean;
  maxTokens?: number;
  tools?: Array<{
    type: string;
    function: {
      name: string;
      description?: string;
      parameters?: Record<string, unknown>;
    };
  }>;
}

/**
 * Extract LLM-specific data from trace payload
 * Handles multiple trace data formats including the new request/response structure
 */
export function extractLLMDataFromTrace(
  traceData: Record<string, unknown>,
): LLMData {
  // New format: request/response structure from API ingest
  if (traceData.request && traceData.response) {
    const request = traceData.request as Record<string, unknown>;
    const response = traceData.response as Record<string, unknown>;
    const span = traceData.span as Record<string, unknown>;
    const spanAttributes = (span?.attributes as Record<string, unknown>) || {};

    return {
      error: traceData.error
        ? (traceData.error as string | Record<string, unknown>)
        : undefined,
      input: (
        request.messages as Array<{ role: string; content: string }>
      )?.map((msg) => ({
        content: [{ text: msg.content, type: 'text' }],
        role: msg.role,
      })),
      inputCostUsd: spanAttributes['llm.cost.prompt'] as number,
      inputTokens: spanAttributes['llm.prompt.tokens'] as number,
      isError: !!traceData.error,
      latency: spanAttributes['llm.duration_ms'] as number,
      maxTokens: spanAttributes['llm.max_tokens'] as number,
      model: spanAttributes['llm.model'] as string,
      outputChoices: (
        response.choices as Array<{
          message: { content: string; role: string };
        }>
      )?.map((choice) => ({
        content: [{ text: choice.message?.content, type: 'text' }],
        role: choice.message?.role || 'assistant',
      })),
      outputCostUsd: spanAttributes['llm.cost.completion'] as number,
      outputTokens: spanAttributes['llm.completion.tokens'] as number,
      provider: spanAttributes['llm.provider'] as string,
      spanName: spanAttributes['llm.operation.type'] as string,
      stream: spanAttributes['llm.stream'] as boolean,
      temperature: spanAttributes['llm.temperature'] as number,
      totalCostUsd: spanAttributes['llm.cost.total'] as number,
    };
  }

  // Legacy format: llm_generation structure
  if (traceData.llm_generation) {
    const llmGen = traceData.llm_generation as Record<string, unknown>;
    return {
      baseUrl: llmGen.base_url as string,
      cacheCreationInputTokens: llmGen.cache_creation_input_tokens as number,
      cacheReadInputTokens: llmGen.cache_read_input_tokens as number,
      error: llmGen.error
        ? (llmGen.error as string | Record<string, unknown>)
        : undefined,
      httpStatus: llmGen.http_status as number,
      input: llmGen.input as Array<{
        role: string;
        content: Array<{
          type: string;
          text?: string;
          image?: string;
          function?: {
            name: string;
            arguments: Record<string, unknown>;
          };
        }>;
      }>,
      inputCostUsd: llmGen.input_cost_usd as number,
      inputTokens: llmGen.input_tokens as number,
      isError: llmGen.is_error as boolean,
      latency: llmGen.latency as number,
      maxTokens: llmGen.max_tokens as number,
      model: llmGen.model as string,
      outputChoices: llmGen.output_choices as Array<{
        role: string;
        content: Array<{
          type: string;
          text?: string;
          function?: {
            name: string;
            arguments: Record<string, unknown>;
          };
        }>;
      }>,
      outputCostUsd: llmGen.output_cost_usd as number,
      outputTokens: llmGen.output_tokens as number,
      provider: llmGen.provider as string,
      requestUrl: llmGen.request_url as string,
      spanName: llmGen.span_name as string,
      stream: llmGen.stream as boolean,
      temperature: llmGen.temperature as number,
      tools: llmGen.tools as Array<{
        type: string;
        function: {
          name: string;
          description?: string;
          parameters?: Record<string, unknown>;
        };
      }>,
      totalCostUsd: llmGen.total_cost_usd as number,
    };
  }

  // Legacy format: OpenAI structure
  if (traceData.openai) {
    const openai = traceData.openai as Record<string, unknown>;
    return {
      input: (openai.messages as Array<{ role: string; content: string }>)?.map(
        (msg) => ({
          content: [{ text: msg.content, type: 'text' }],
          role: msg.role,
        }),
      ),
      inputTokens: (openai.usage as { prompt_tokens: number })?.prompt_tokens,
      latency: openai.latency as number,
      maxTokens: openai.max_tokens as number,
      model: openai.model as string,
      outputChoices: (
        openai.choices as Array<{ message: { content: string } }>
      )?.map((choice) => ({
        content: [{ text: choice.message?.content, type: 'text' }],
        role: 'assistant',
      })),
      outputTokens: (openai.usage as { completion_tokens: number })
        ?.completion_tokens,
      provider: 'openai',
      spanName: 'openai_completion',
      stream: openai.stream as boolean,
      temperature: openai.temperature as number,
    };
  }

  // PostHog LLM analytics format
  if (traceData.$ai_generation) {
    const aiGen = traceData.$ai_generation as Record<string, unknown>;
    return {
      baseUrl: aiGen.$ai_base_url as string,
      cacheCreationInputTokens: aiGen.$ai_cache_creation_input_tokens as number,
      cacheReadInputTokens: aiGen.$ai_cache_read_input_tokens as number,
      error: aiGen.$ai_error
        ? (aiGen.$ai_error as string | Record<string, unknown>)
        : undefined,
      httpStatus: aiGen.$ai_http_status as number,
      input: aiGen.$ai_input as Array<{
        role: string;
        content: Array<{
          type: string;
          text?: string;
          image?: string;
          function?: {
            name: string;
            arguments: Record<string, unknown>;
          };
        }>;
      }>,
      inputCostUsd: aiGen.$ai_input_cost_usd as number,
      inputTokens: aiGen.$ai_input_tokens as number,
      isError: aiGen.$ai_is_error as boolean,
      latency: aiGen.$ai_latency as number,
      maxTokens: aiGen.$ai_max_tokens as number,
      model: aiGen.$ai_model as string,
      outputChoices: aiGen.$ai_output_choices as Array<{
        role: string;
        content: Array<{
          type: string;
          text?: string;
          function?: {
            name: string;
            arguments: Record<string, unknown>;
          };
        }>;
      }>,
      outputCostUsd: aiGen.$ai_output_cost_usd as number,
      outputTokens: aiGen.$ai_output_tokens as number,
      provider: aiGen.$ai_provider as string,
      requestUrl: aiGen.$ai_request_url as string,
      spanName: aiGen.$ai_span_name as string,
      stream: aiGen.$ai_stream as boolean,
      temperature: aiGen.$ai_temperature as number,
      tools: aiGen.$ai_tools as Array<{
        type: string;
        function: {
          name: string;
          description?: string;
          parameters?: Record<string, unknown>;
        };
      }>,
      totalCostUsd: aiGen.$ai_total_cost_usd as number,
    };
  }

  // Default fallback - try to extract common fields
  return {
    error: traceData.error
      ? (traceData.error as string | Record<string, unknown>)
      : undefined,
    httpStatus: (traceData.http_status || traceData.status_code) as number,
    input:
      (traceData.input as Array<{
        role: string;
        content: Array<{
          type: string;
          text?: string;
          image?: string;
          function?: {
            name: string;
            arguments: Record<string, unknown>;
          };
        }>;
      }>) ||
      (traceData.messages as Array<{
        role: string;
        content: Array<{
          type: string;
          text?: string;
          image?: string;
          function?: {
            name: string;
            arguments: Record<string, unknown>;
          };
        }>;
      }>),
    inputTokens: (traceData.input_tokens || traceData.prompt_tokens) as number,
    isError: (traceData.is_error || traceData.error !== undefined) as boolean,
    latency: (traceData.latency || traceData.duration) as number,
    maxTokens: traceData.max_tokens as number,
    model: (traceData.model || traceData.model_name) as string,
    outputChoices: (traceData.output_choices || traceData.choices) as Array<{
      role: string;
      content: Array<{
        type: string;
        text?: string;
        function?: {
          name: string;
          arguments: Record<string, unknown>;
        };
      }>;
    }>,
    outputTokens: (traceData.output_tokens ||
      traceData.completion_tokens) as number,
    provider: (traceData.provider || traceData.service) as string,
    spanName:
      ((traceData.span_name || traceData.name) as string) || 'llm_generation',
    stream: traceData.stream as boolean,
    temperature: traceData.temperature as number,
  };
}
