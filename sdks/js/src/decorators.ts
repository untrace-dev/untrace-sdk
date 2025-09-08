import { type Attributes, type Span, SpanKind } from '@opentelemetry/api';
import type {
  Cost,
  LLMOperationType,
  LLMSpanAttributes,
  TokenUsage,
} from './types';
import { getUntrace } from './untrace';

/**
 * Type for class constructor
 */
type Constructor = { new (...args: unknown[]): object };

/**
 * Type for method decorator target
 */
type DecoratorTarget = Record<string, unknown> & {
  constructor: Constructor;
};

/**
 * Decorator options for @trace
 */
export interface TraceOptions {
  /** Custom operation name (defaults to method name) */
  name?: string;
  /** Span attributes */
  attributes?: Attributes;
  /** Span kind */
  kind?: SpanKind;
  /** Whether to record exceptions automatically */
  recordExceptions?: boolean;
}

/**
 * Decorator options for @metric
 */
export interface MetricOptions {
  /** Metric name (defaults to class.method) */
  name?: string;
  /** Additional attributes */
  attributes?: Attributes;
  /** Whether to record duration */
  recordDuration?: boolean;
}

/**
 * Decorator options for @llmOperation
 */
export interface LLMOperationOptions {
  /** Operation type */
  type: LLMOperationType;
  /** Model name */
  model?: string;
  /** Provider name */
  provider?: string;
  /** Additional attributes */
  attributes?: Attributes;
  /** Function to extract token usage from result */
  extractTokenUsage?: (result: unknown) => TokenUsage | undefined;
  /** Function to extract cost from result */
  extractCost?: (result: unknown) => Cost | undefined;
}

/**
 * Trace decorator - automatically creates spans for methods
 *
 * @example
 * ```typescript
 * class MyService {
 *   @trace({ name: 'fetchUserData', attributes: { 'user.type': 'admin' } })
 *   async getUser(id: string) {
 *     // Method implementation
 *   }
 * }
 * ```
 */
export function trace(options: TraceOptions = {}) {
  return (
    target: DecoratorTarget,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) => {
    const originalMethod = descriptor.value;
    const className = target.constructor.name;
    const methodName = propertyKey;

    descriptor.value = async function (this: unknown, ...args: unknown[]) {
      const untrace = getUntrace();
      const tracer = untrace.getTracer();

      const spanName = options.name || `${className}.${methodName}`;

      return tracer.withSpan(
        {
          attributes: {
            'code.function': methodName,
            'code.namespace': className,
            ...options.attributes,
          },
          kind: options.kind || SpanKind.INTERNAL,
          name: spanName,
        },
        async (_span: Span) => {
          if (options.recordExceptions === false) {
            // If not recording exceptions, just run the method
            return await originalMethod.apply(this, args);
          }
          // Otherwise let withSpan handle the exception recording
          return await originalMethod.apply(this, args);
        },
      );
    };

    return descriptor;
  };
}

/**
 * Metric decorator - automatically records metrics for methods
 *
 * @example
 * ```typescript
 * class MyService {
 *   @metric({ name: 'api.request.count', recordDuration: true })
 *   async processRequest(data: any) {
 *     // Method implementation
 *   }
 * }
 * ```
 */
export function metric(options: MetricOptions = {}) {
  return (
    target: DecoratorTarget,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) => {
    const originalMethod = descriptor.value;
    const className = target.constructor.name;
    const methodName = propertyKey;

    descriptor.value = async function (this: unknown, ...args: unknown[]) {
      const untrace = getUntrace();
      const metrics = untrace.getMetrics();

      const startTime = Date.now();

      try {
        const result = await originalMethod.apply(this, args);

        if (options.recordDuration !== false) {
          const duration = Date.now() - startTime;
          metrics.recordLatency(duration, {
            'method.class': className,
            'method.name': methodName,
            'method.result': 'success',
            ...options.attributes,
          });
        }

        return result;
      } catch (error) {
        if (options.recordDuration !== false) {
          const duration = Date.now() - startTime;
          metrics.recordLatency(duration, {
            'error.type':
              error instanceof Error ? error.constructor.name : 'Unknown',
            'method.class': className,
            'method.name': methodName,
            'method.result': 'error',
            ...options.attributes,
          });
        }

        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * LLM Operation decorator - specialized decorator for LLM operations
 *
 * @example
 * ```typescript
 * class OpenAIService {
 *   @llmOperation({
 *     type: 'chat',
 *     model: 'gpt-4',
 *     provider: 'openai',
 *     extractTokenUsage: (result) => ({
 *       promptTokens: result.usage.prompt_tokens,
 *       completionTokens: result.usage.completion_tokens,
 *       totalTokens: result.usage.total_tokens,
 *     })
 *   })
 *   async chat(messages: Message[]) {
 *     // OpenAI API call
 *   }
 * }
 * ```
 */
export function llmOperation(options: LLMOperationOptions) {
  return (
    target: DecoratorTarget,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) => {
    const originalMethod = descriptor.value;
    const className = target.constructor.name;
    const methodName = propertyKey;

    descriptor.value = async function (this: unknown, ...args: unknown[]) {
      const untrace = getUntrace();
      const tracer = untrace.getTracer();
      const metrics = untrace.getMetrics();

      const spanName = `${className}.${methodName}`;

      return tracer.withLLMSpan(
        spanName,
        {
          'code.function': methodName,
          'code.namespace': className,
          'llm.model': options.model || 'unknown',
          'llm.operation.type': options.type,
          'llm.provider': options.provider || 'unknown',
          ...options.attributes,
        } as LLMSpanAttributes,
        async (_span: Span) => {
          const result = await originalMethod.apply(this, args);

          // Extract and record token usage if available
          if (options.extractTokenUsage) {
            const tokenUsage = options.extractTokenUsage(result);
            if (tokenUsage) {
              metrics.recordTokenUsage({
                ...tokenUsage,
                model: tokenUsage.model || options.model || 'unknown',
                provider: tokenUsage.provider || options.provider || 'unknown',
              });
            }
          }

          // Extract and record cost if available
          if (options.extractCost) {
            const cost = options.extractCost(result);
            if (cost) {
              metrics.recordCost({
                ...cost,
                model: cost.model || options.model || 'unknown',
                provider: cost.provider || options.provider || 'unknown',
              });
            }
          }

          return result;
        },
      );
    };

    return descriptor;
  };
}

/**
 * Error handler decorator - automatically records errors
 *
 * @example
 * ```typescript
 * class MyService {
 *   @errorHandler({ rethrow: true })
 *   async riskyOperation() {
 *     // Method that might throw
 *   }
 * }
 * ```
 */
export function errorHandler(options: { rethrow?: boolean } = {}) {
  return (
    target: DecoratorTarget,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) => {
    const originalMethod = descriptor.value;

    descriptor.value = async function (this: unknown, ...args: unknown[]) {
      const untrace = getUntrace();
      const metrics = untrace.getMetrics();

      try {
        return await originalMethod.apply(this, args);
      } catch (error) {
        if (error instanceof Error) {
          metrics.recordError(error, {
            'error.source': `${target.constructor.name}.${propertyKey}`,
          });
        }

        if (options.rethrow !== false) {
          throw error;
        }

        return undefined;
      }
    };

    return descriptor;
  };
}

/**
 * Timed decorator - simple timing decorator
 *
 * @example
 * ```typescript
 * class MyService {
 *   @timed()
 *   async slowOperation() {
 *     // Method implementation
 *   }
 * }
 * ```
 */
export function timed(label?: string) {
  return (
    target: DecoratorTarget,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) => {
    const originalMethod = descriptor.value;
    const timerLabel = label || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (this: unknown, ...args: unknown[]) {
      console.time(timerLabel);
      try {
        return await originalMethod.apply(this, args);
      } finally {
        console.timeEnd(timerLabel);
      }
    };

    return descriptor;
  };
}

/**
 * Cached decorator - caches method results
 *
 * @example
 * ```typescript
 * class MyService {
 *   @cached({ ttl: 60000 }) // Cache for 1 minute
 *   async expensiveComputation(input: string) {
 *     // Expensive operation
 *   }
 * }
 * ```
 */
export function cached(
  options: { ttl?: number; key?: (...args: unknown[]) => string } = {},
) {
  const cache = new Map<string, { value: unknown; expires: number }>();

  return (
    _target: DecoratorTarget,
    _propertyKey: string,
    descriptor: PropertyDescriptor,
  ) => {
    const originalMethod = descriptor.value;

    descriptor.value = async function (this: unknown, ...args: unknown[]) {
      const cacheKey = options.key
        ? options.key(...args)
        : JSON.stringify(args);

      const cached = cache.get(cacheKey);
      if (cached && (!cached.expires || cached.expires > Date.now())) {
        return cached.value;
      }

      const result = await originalMethod.apply(this, args);

      cache.set(cacheKey, {
        expires: options.ttl ? Date.now() + options.ttl : 0,
        value: result,
      });

      return result;
    };

    return descriptor;
  };
}
