import type { InstrumentationConfig } from '@opentelemetry/instrumentation';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { SpanKind, SpanStatusCode } from '@opentelemetry/api';

import {
  LLM_OPERATION_TYPES,
  LLM_PROVIDERS,
  OpenInferenceAttributeBuilder,
  PROVIDER_SEMANTIC_CONVENTIONS,
  type LLMChoice,
  type LLMMessage,
  type LLMUsage,
} from '../semantic-conventions';

/**
 * LLM provider detection patterns
 */
const LLM_PROVIDERS_PATTERNS = {
  openai: {
    hosts: ['api.openai.com'],
    paths: ['/v1/chat/completions', '/v1/completions', '/v1/embeddings'],
    provider: LLM_PROVIDERS.OPENAI,
  },
  bedrock: {
    hosts: ['bedrock-runtime.*.amazonaws.com', 'bedrock.*.amazonaws.com'],
    paths: ['/model/*/invoke', '/model/*/invoke-with-response-stream'],
    provider: LLM_PROVIDERS.AWS_BEDROCK,
  },
  anthropic: {
    hosts: ['api.anthropic.com'],
    paths: ['/v1/messages', '/v1/complete'],
    provider: 'anthropic',
  },
  cohere: {
    hosts: ['api.cohere.ai'],
    paths: ['/v1/generate', '/v1/chat', '/v1/embed'],
    provider: 'cohere',
  },
  huggingface: {
    hosts: ['api-inference.huggingface.co'],
    paths: ['/models/*'],
    provider: 'huggingface',
  },
} as const;

/**
 * Detect if an HTTP request is to an LLM provider
 */
function detectLLMProvider(url: string): {
  provider: string;
  isLLMRequest: boolean;
} {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();
    const pathname = parsedUrl.pathname.toLowerCase();

    for (const [_providerName, config] of Object.entries(LLM_PROVIDERS_PATTERNS)) {
      // Check hostname patterns
      const hostMatches = config.hosts.some((pattern) => {
        if (pattern.includes('*')) {
          const regex = new RegExp(pattern.replace(/\*/g, '.*'));
          return regex.test(hostname);
        }
        return hostname.includes(pattern);
      });

      if (hostMatches) {
        // Check path patterns
        const pathMatches = config.paths.some((pattern) => {
          if (pattern.includes('*')) {
            const regex = new RegExp(pattern.replace(/\*/g, '.*'));
            return regex.test(pathname);
          }
          return pathname.includes(pattern);
        });

        if (pathMatches) {
          return {
            provider: config.provider,
            isLLMRequest: true,
          };
        }
      }
    }

    return {
      provider: 'unknown',
      isLLMRequest: false,
    };
  } catch {
    return {
      provider: 'unknown',
      isLLMRequest: false,
    };
  }
}

/**
 * Extract model name from request URL or body
 */
function extractModelName(url: string, body?: string): string {
  try {
    const parsedUrl = new URL(url);

    // For Bedrock, model is in the URL path
    if (parsedUrl.hostname.includes('bedrock')) {
      const match = parsedUrl.pathname.match(/\/model\/([^\/]+)\/invoke/);
      if (match?.[1]) {
        return match[1];
      }
    }

    // For other providers, model is usually in the request body
    if (body) {
      try {
        const parsed = JSON.parse(body);
        if (parsed.model) {
          return parsed.model;
        }
      } catch {
        // Ignore JSON parse errors
      }
    }

    return 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Extract LLM request attributes from HTTP request
 */
function extractLLMRequestAttributes(
  url: string,
  _method: string,
  _headers: Record<string, string | string[]>,
  body?: string,
): Partial<ReturnType<OpenInferenceAttributeBuilder['build']>> {
  const { provider, isLLMRequest } = detectLLMProvider(url);

  if (!isLLMRequest) {
    return {};
  }

  const model = extractModelName(url, body);
  const attributeBuilder = new OpenInferenceAttributeBuilder()
    .setOperation(LLM_OPERATION_TYPES.CHAT, provider, model);

  // Extract request parameters from body
  if (body) {
    try {
      const parsed = JSON.parse(body) as Record<string, unknown>;

      // Common parameters across providers
      if (parsed.temperature !== undefined) {
        attributeBuilder.setConfig(parsed.temperature as number);
      }
      if (parsed.max_tokens !== undefined) {
        attributeBuilder.setConfig(undefined, parsed.max_tokens as number);
      }
      if (parsed.maxOutputTokens !== undefined) {
        attributeBuilder.setConfig(undefined, parsed.maxOutputTokens as number);
      }
      if (parsed.top_p !== undefined) {
        attributeBuilder.setConfig(undefined, undefined, parsed.top_p as number);
      }
      if (parsed.stream !== undefined) {
        attributeBuilder.setConfig(undefined, undefined, undefined, parsed.stream as boolean);
      }

      // Extract messages/prompt
      if (parsed.messages && Array.isArray(parsed.messages)) {
        const messages: LLMMessage[] = (parsed.messages as Record<string, unknown>[]).map((msg) => ({
          role: ((msg.role as string) || 'user') as LLMMessage['role'],
          content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
        }));
        attributeBuilder.setInput(messages);
      } else if (parsed.prompt) {
        const promptStr = typeof parsed.prompt === 'string' ? parsed.prompt : JSON.stringify(parsed.prompt);
        attributeBuilder.setInput([{ role: 'user', content: promptStr }]);
      }

      // Provider-specific attributes
      if (provider === LLM_PROVIDERS.AWS_BEDROCK) {
        const parsedUrl = new URL(url);
        attributeBuilder.setAttribute(
          PROVIDER_SEMANTIC_CONVENTIONS.BEDROCK.MODEL_ARN,
          model,
        );
        if (parsedUrl.hostname.match(/bedrock-runtime\.(.+)\.amazonaws\.com/)) {
          const region = parsedUrl.hostname.match(/bedrock-runtime\.(.+)\.amazonaws\.com/)?.[1];
          if (region) {
            attributeBuilder.setAttribute(
              PROVIDER_SEMANTIC_CONVENTIONS.BEDROCK.REGION,
              region,
            );
          }
        }
      }
    } catch {
      // Ignore JSON parse errors
    }
  }

  return attributeBuilder.build();
}

/**
 * Extract LLM response attributes from HTTP response
 */
function extractLLMResponseAttributes(
  url: string,
  _statusCode: number,
  headers: Record<string, string | string[]>,
  body?: string,
): Partial<ReturnType<OpenInferenceAttributeBuilder['build']>> {
  const { provider, isLLMRequest } = detectLLMProvider(url);

  if (!isLLMRequest || !body) {
    return {};
  }

  const attributeBuilder = new OpenInferenceAttributeBuilder();

  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;

    // Extract response content
    if (parsed.choices && Array.isArray(parsed.choices)) {
      const choices: LLMChoice[] = (parsed.choices as Record<string, unknown>[]).map((choice, index: number) => ({
        index,
        message: {
          role: ((choice.message as Record<string, unknown>)?.role as string) || 'assistant',
          content: ((choice.message as Record<string, unknown>)?.content as string) || (choice.text as string) || '',
        },
        finish_reason: (choice.finish_reason as string) || 'stop',
      }));
      attributeBuilder.setOutput(choices);
    } else if (parsed.content && Array.isArray(parsed.content)) {
      // Anthropic format
      const choices: LLMChoice[] = [{
        index: 0,
        message: {
          role: 'assistant',
          content: (parsed.content as Record<string, unknown>[]).map((c) => (c.text as string) || '').join(''),
        },
        finish_reason: (parsed.stop_reason as string) || 'stop',
      }];
      attributeBuilder.setOutput(choices);
    }

    // Extract token usage
    if (parsed.usage) {
      const usageData = parsed.usage as Record<string, unknown>;
      const usage: LLMUsage = {
        prompt_tokens: (usageData.prompt_tokens as number) || (usageData.input_tokens as number) || 0,
        completion_tokens: (usageData.completion_tokens as number) || (usageData.output_tokens as number) || 0,
        total_tokens: (usageData.total_tokens as number) ||
          ((usageData.prompt_tokens as number) || 0) + ((usageData.completion_tokens as number) || 0),
      };
      attributeBuilder.setUsage(usage);
    }

    // Provider-specific response attributes
    if (provider === LLM_PROVIDERS.OPENAI && parsed.id) {
      attributeBuilder.setAttribute(
        PROVIDER_SEMANTIC_CONVENTIONS.OPENAI.REQUEST_ID,
        parsed.id as string,
      );
    }
    if (provider === LLM_PROVIDERS.AWS_BEDROCK && headers['x-amzn-requestid']) {
      const requestId = Array.isArray(headers['x-amzn-requestid'])
        ? headers['x-amzn-requestid'][0]
        : headers['x-amzn-requestid'];
      if (requestId) {
        attributeBuilder.setAttribute(
          PROVIDER_SEMANTIC_CONVENTIONS.BEDROCK.REQUEST_ID,
          requestId,
        );
      }
    }
  } catch {
    // Ignore JSON parse errors
  }

  return attributeBuilder.build();
}

/**
 * HTTP-based LLM instrumentation that captures all LLM requests automatically
 */
export class HTTPLLMInstrumentation {
  private httpInstrumentation: HttpInstrumentation;
  private fetchInstrumentation: FetchInstrumentation;

  constructor(config: InstrumentationConfig = { enabled: true }) {
    // Configure HTTP instrumentation for Node.js
    this.httpInstrumentation = new HttpInstrumentation({
      ...config,
      requestHook: (span, request) => {
        const url = this.getRequestUrl(request);
        if (!url) return;

        const { isLLMRequest } = detectLLMProvider(url);
        if (!isLLMRequest) return;

        // Update span name for LLM requests
        span.updateName('llm.request');
        span.setAttributes({
          'span.kind': SpanKind.CLIENT,
        });

        // Extract request body if available
        let body = '';
        const req = request as unknown as Record<string, unknown>;
        if ('body' in req && req.body) {
          body = String(req.body);
        }

        const requestAttributes = extractLLMRequestAttributes(
          url,
          (req.method as string) || 'POST',
          (req.headers as Record<string, string | string[]>) || {},
          body,
        );

        span.setAttributes(requestAttributes);
      },
      responseHook: (span, response) => {
        const url = (span as unknown as { attributes: Record<string, unknown> }).attributes['http.url'] as string;
        if (!url) return;

        const { isLLMRequest } = detectLLMProvider(url);
        if (!isLLMRequest) return;

        // Extract response body if available
        let body = '';
        const res = response as unknown as Record<string, unknown>;
        if ('body' in res && res.body) {
          body = String(res.body);
        }

        const responseAttributes = extractLLMResponseAttributes(
          url,
          (res.statusCode as number) || 200,
          (res.headers as Record<string, string | string[]>) || {},
          body,
        );

        span.setAttributes(responseAttributes);

        // Set span status based on response
        const statusCode = res.statusCode as number;
        if (statusCode && statusCode >= 400) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: 'HTTP ' + statusCode,
          });
        } else {
          span.setStatus({ code: SpanStatusCode.OK });
        }
      },
    });

    // Configure Fetch instrumentation for browsers/modern environments
    this.fetchInstrumentation = new FetchInstrumentation({
      ...config,
      requestHook: (span, request) => {
        const req = request as Request;
        const url = req.url;
        const { isLLMRequest } = detectLLMProvider(url);
        if (!isLLMRequest) return;

        // Update span name for LLM requests
        span.updateName('llm.request');
        span.setAttributes({
          'span.kind': SpanKind.CLIENT,
        });

        // Extract request body if available
        let body = '';
        if (req.body) {
          body = String(req.body);
        }

        const requestAttributes = extractLLMRequestAttributes(
          url,
          req.method || 'POST',
          this.headersToRecord(req.headers),
          body,
        );

        span.setAttributes(requestAttributes);
      },
      // Note: FetchInstrumentation doesn't support responseHook
      // Response data will be captured through request attributes
    });
  }

  /**
   * Enable the instrumentation
   */
  enable(): void {
    this.httpInstrumentation.enable();
    this.fetchInstrumentation.enable();
  }

  /**
   * Disable the instrumentation
   */
  disable(): void {
    this.httpInstrumentation.disable();
    this.fetchInstrumentation.disable();
  }

  /**
   * Get request URL from various request formats
   */
  private getRequestUrl(request: unknown): string | null {
    if (typeof request === 'string') {
      return request;
    }

    const req = request as Record<string, unknown>;

    if (req.url && typeof req.url === 'string') {
      return req.url;
    }

    if (req.href && typeof req.href === 'string') {
      return req.href;
    }

    // Construct URL from request options
    if (req.protocol && req.hostname) {
      const protocol = typeof req.protocol === 'string' && req.protocol.endsWith(':') ? req.protocol : req.protocol + ':';
      const port = req.port ? ':' + req.port : '';
      const path = req.path || req.pathname || '/';
      return protocol + '//' + req.hostname + port + path;
    }

    return null;
  }

  /**
   * Convert Headers object to record
   */
  private headersToRecord(headers?: Headers): Record<string, string> {
    if (!headers) return {};

    const record: Record<string, string> = {};
    headers.forEach((value, key) => {
      record[key.toLowerCase()] = value;
    });
    return record;
  }
}
