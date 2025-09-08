import {
  type Attributes,
  context,
  type Span,
  SpanKind,
  type SpanOptions,
  SpanStatusCode,
  type Tracer,
  trace,
} from '@opentelemetry/api';

import type { LLMSpanAttributes, UntraceSpanOptions } from './types';

/**
 * Wrapper around OpenTelemetry tracer with LLM-specific helpers
 */
export class UntraceTracer {
  constructor(private tracer: Tracer) {}

  /**
   * Get the underlying OpenTelemetry tracer
   */
  getTracer(): Tracer {
    return this.tracer;
  }

  /**
   * Start a new span
   */
  startSpan(options: UntraceSpanOptions): Span {
    const spanOptions: SpanOptions = {
      attributes: options.attributes,
      kind: options.kind || SpanKind.INTERNAL,
    };

    const parentContext = options.parent
      ? 'spanContext' in options.parent
        ? trace.setSpan(context.active(), options.parent as Span)
        : options.parent
      : context.active();

    return this.tracer.startSpan(options.name, spanOptions, parentContext);
  }

  /**
   * Start an LLM span
   */
  startLLMSpan(
    name: string,
    attributes: Partial<LLMSpanAttributes>,
    parent?: Span,
  ): Span {
    return this.startSpan({
      attributes: attributes as Attributes,
      kind: SpanKind.CLIENT,
      name,
      parent,
    });
  }

  /**
   * Start a workflow span
   */
  startWorkflowSpan(
    name: string,
    attributes?: Attributes,
    parent?: Span,
  ): Span {
    return this.startSpan({
      attributes: {
        'workflow.name': name,
        ...attributes,
      },
      kind: SpanKind.INTERNAL,
      name,
      parent,
    });
  }

  /**
   * Start a tool span
   */
  startToolSpan(name: string, attributes?: Attributes, parent?: Span): Span {
    return this.startSpan({
      attributes: {
        'tool.name': name,
        ...attributes,
      },
      kind: SpanKind.INTERNAL,
      name,
      parent,
    });
  }

  /**
   * Wrap a function with a span
   */
  async withSpan<T>(
    options: UntraceSpanOptions,
    fn: (span: Span) => Promise<T>,
  ): Promise<T> {
    const span = this.startSpan(options);

    try {
      const result = await context.with(
        trace.setSpan(context.active(), span),
        async () => {
          return await fn(span);
        },
      );

      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Wrap an LLM call with a span
   */
  async withLLMSpan<T>(
    name: string,
    attributes: Partial<LLMSpanAttributes>,
    fn: (span: Span) => Promise<T>,
  ): Promise<T> {
    return this.withSpan(
      {
        attributes: attributes as Attributes,
        kind: SpanKind.CLIENT,
        name,
      },
      fn,
    );
  }

  /**
   * Get the active span
   */
  getActiveSpan(): Span | undefined {
    return trace.getActiveSpan();
  }

  /**
   * Add event to the active span
   */
  addEvent(name: string, attributes?: Attributes): void {
    const span = this.getActiveSpan();
    if (span) {
      span.addEvent(name, attributes);
    }
  }

  /**
   * Set attributes on the active span
   */
  setAttributes(attributes: Attributes): void {
    const span = this.getActiveSpan();
    if (span) {
      span.setAttributes(attributes);
    }
  }

  /**
   * Set status on the active span
   */
  setStatus(code: SpanStatusCode, message?: string): void {
    const span = this.getActiveSpan();
    if (span) {
      span.setStatus({ code, message });
    }
  }

  /**
   * Record an exception on the active span
   */
  recordException(error: Error, attributes?: Attributes): void {
    const span = this.getActiveSpan();
    if (span) {
      if (attributes) {
        span.setAttributes(attributes);
      }
      span.recordException(error);
    }
  }
}
