import type { Attributes } from '@opentelemetry/api';
import { type ExportResult, ExportResultCode } from '@opentelemetry/core';
import type { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace-base';
import type { UntraceConfig } from './types';

interface OTLPAttribute {
  key: string;
  value: OTLPValue;
}

interface OTLPValue {
  stringValue?: string;
  boolValue?: boolean;
  intValue?: number;
  doubleValue?: number;
  arrayValue?: {
    values: OTLPValue[];
  };
  kvlistValue?: {
    values: OTLPAttribute[];
  };
}

interface OTLPSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: number;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes: OTLPAttribute[];
  status: {
    code: number;
    message?: string;
  };
  events: Array<{
    timeUnixNano: string;
    name: string;
    attributes: OTLPAttribute[];
  }>;
  links: Array<{
    traceId: string;
    spanId: string;
    attributes: OTLPAttribute[];
  }>;
}

interface OTLPResource {
  attributes: OTLPAttribute[];
}

interface OTLPInstrumentationScope {
  name: string;
  version?: string;
}

interface OTLPScopeSpan {
  scope: OTLPInstrumentationScope;
  spans: OTLPSpan[];
}

interface OTLPResourceSpan {
  resource: OTLPResource;
  scopeSpans: OTLPScopeSpan[];
}

interface OTLPExportRequest {
  resourceSpans: OTLPResourceSpan[];
}

/**
 * Exporter that sends spans to Untrace backend
 */
export class UntraceExporter implements SpanExporter {
  private readonly config: UntraceConfig;

  constructor(config: UntraceConfig) {
    this.config = config;

    if (config.debug) {
      console.log('[UntraceExporter] Initialized with config:', {
        apiKey: config.apiKey
          ? `${config.apiKey.substring(0, 8)}...${config.apiKey.substring(config.apiKey.length - 4)}`
          : 'missing',
        baseUrl: config.baseUrl,
        debug: config.debug,
      });
    }
  }

  /**
   * Export spans to Untrace backend
   */
  export(
    spans: ReadableSpan[],
    resultCallback: (result: ExportResult) => void,
  ): void {
    const exportStartTime = Date.now();
    const exportUrl = `${this.config.baseUrl}/api/v1/traces/ingest`;

    // Handle async operation internally
    this.performExport(spans, resultCallback, exportStartTime, exportUrl).catch(
      (error) => {
        const exportDuration = Date.now() - exportStartTime;
        console.error(
          `[UntraceExporter] Export failed after ${exportDuration}ms:`,
          error,
        );

        // Log additional error details for debugging
        if (error instanceof Error) {
          console.error('[UntraceExporter] Error details:', {
            message: error.message,
            name: error.name,
            stack: error.stack,
          });
        }

        resultCallback({
          code: ExportResultCode.FAILED,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      },
    );
  }

  private async performExport(
    spans: ReadableSpan[],
    resultCallback: (result: ExportResult) => void,
    exportStartTime: number,
    exportUrl: string,
  ): Promise<void> {
    try {
      console.log(
        `[UntraceExporter] Exporting ${spans.length} spans to ${exportUrl}`,
      );
      console.log(
        '[UntraceExporter] Span names:',
        spans.map((s) => s.name),
      );

      const payload = this.convertSpansToPayload(spans);
      console.log('[UntraceExporter] Payload prepared, sending request...');

      const response = await fetch(exportUrl, {
        body: JSON.stringify(payload),
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
          ...this.config.headers,
        },
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      const exportDuration = Date.now() - exportStartTime;
      console.log(`[UntraceExporter] Export successful in ${exportDuration}ms`);
      console.log(`[UntraceExporter] Response: ${JSON.stringify(result)}`);
      resultCallback({ code: ExportResultCode.SUCCESS });
    } catch (error) {
      const exportDuration = Date.now() - exportStartTime;
      console.error(
        `[UntraceExporter] Export failed after ${exportDuration}ms:`,
        error,
      );

      // Log additional error details for debugging
      if (error instanceof Error) {
        console.error('[UntraceExporter] Error details:', {
          message: error.message,
          name: error.name,
          stack: error.stack,
        });
      }

      resultCallback({
        code: ExportResultCode.FAILED,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  /**
   * Shutdown the exporter
   */
  async shutdown(): Promise<void> {
    // No cleanup needed
  }

  /**
   * Force flush any pending spans
   */
  async forceFlush(): Promise<void> {
    // No buffering, so nothing to flush
  }

  /**
   * Convert spans to OTLP JSON format
   */
  private convertSpansToPayload(spans: ReadableSpan[]): OTLPExportRequest {
    // Group spans by resource and scope
    const resourceMap = new Map<string, Map<string, ReadableSpan[]>>();

    for (const span of spans) {
      const resourceKey = JSON.stringify(span.resource.attributes);
      const scopeKey = `${span.instrumentationScope.name}:${span.instrumentationScope.version || ''}`;

      if (!resourceMap.has(resourceKey)) {
        resourceMap.set(resourceKey, new Map());
      }

      const scopeMap = resourceMap.get(resourceKey);
      if (!scopeMap) {
        continue;
      }

      if (!scopeMap.has(scopeKey)) {
        scopeMap.set(scopeKey, []);
      }

      scopeMap.get(scopeKey)?.push(span);
    }

    // Convert to OTLP format
    const resourceSpans: OTLPResourceSpan[] = [];

    for (const [_resourceKey, scopeMap] of resourceMap) {
      const firstSpanArray = Array.from(scopeMap.values())[0];
      if (!firstSpanArray || firstSpanArray.length === 0) {
        continue;
      }

      const firstSpan = firstSpanArray[0];
      if (!firstSpan) {
        continue;
      }

      const resource: OTLPResource = {
        attributes: this.convertAttributes(firstSpan.resource.attributes),
      };

      const scopeSpans: OTLPScopeSpan[] = [];

      for (const [_scopeKey, spanArray] of scopeMap) {
        if (!spanArray || spanArray.length === 0 || !spanArray[0]) {
          continue;
        }

        const scope: OTLPInstrumentationScope = {
          name: spanArray[0].instrumentationScope.name,
          version: spanArray[0].instrumentationScope.version,
        };

        scopeSpans.push({
          scope,
          spans: spanArray.map((span) => this.convertSpan(span)),
        });
      }

      resourceSpans.push({
        resource,
        scopeSpans,
      });
    }

    return { resourceSpans };
  }

  /**
   * Convert a single span to OTLP format
   */
  private convertSpan(span: ReadableSpan): OTLPSpan {
    return {
      attributes: this.convertAttributes(span.attributes),
      endTimeUnixNano: this.hrTimeToNanos(span.endTime),
      events: span.events.map((event) => ({
        attributes: this.convertAttributes(event.attributes || {}),
        name: event.name,
        timeUnixNano: this.hrTimeToNanos(event.time),
      })),
      kind: span.kind,
      links: span.links.map((link) => ({
        attributes: this.convertAttributes(link.attributes || {}),
        spanId: link.context.spanId,
        traceId: link.context.traceId,
      })),
      name: span.name,
      parentSpanId: span.parentSpanContext?.spanId,
      spanId: span.spanContext().spanId,
      startTimeUnixNano: this.hrTimeToNanos(span.startTime),
      status: {
        code: span.status.code,
        message: span.status.message,
      },
      traceId: span.spanContext().traceId,
    };
  }

  /**
   * Convert attributes to OTLP format
   */
  private convertAttributes(attributes: Attributes): OTLPAttribute[] {
    const result: OTLPAttribute[] = [];

    for (const [key, value] of Object.entries(attributes)) {
      if (value === undefined || value === null) {
        continue;
      }

      const attr: OTLPAttribute = { key, value: this.convertValue(value) };
      result.push(attr);
    }

    return result;
  }

  /**
   * Convert an attribute value to OTLP format
   */
  private convertValue(value: unknown): OTLPValue {
    if (typeof value === 'string') {
      return { stringValue: value };
    }

    if (typeof value === 'boolean') {
      return { boolValue: value };
    }

    if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        return { intValue: value };
      }
      return { doubleValue: value };
    }

    if (Array.isArray(value)) {
      return {
        arrayValue: {
          values: value.map((v) => this.convertValue(v)),
        },
      };
    }

    if (typeof value === 'object' && value !== null) {
      const kvList: OTLPAttribute[] = [];
      for (const [k, v] of Object.entries(value)) {
        if (v !== undefined && v !== null) {
          kvList.push({ key: k, value: this.convertValue(v) });
        }
      }
      return {
        kvlistValue: {
          values: kvList,
        },
      };
    }

    // Fallback to string
    return { stringValue: String(value) };
  }

  /**
   * Convert HrTime to nanoseconds string
   */
  private hrTimeToNanos(hrTime: [number, number]): string {
    return (hrTime[0] * 1e9 + hrTime[1]).toString();
  }
}
