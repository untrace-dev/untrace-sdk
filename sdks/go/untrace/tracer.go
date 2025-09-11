package untrace

import (
	"context"
	"fmt"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

// untraceTracer implements the Tracer interface
type untraceTracer struct {
	tracer trace.Tracer
}

// NewTracer creates a new Untrace tracer
func NewTracer(tracer trace.Tracer) Tracer {
	return &untraceTracer{
		tracer: tracer,
	}
}

// StartLLMSpan starts a new LLM span with appropriate attributes
func (t *untraceTracer) StartLLMSpan(ctx context.Context, name string, opts LLMSpanOptions) (context.Context, trace.Span) {
	attrs := t.buildLLMAttributes(opts)

	spanCtx, span := t.tracer.Start(ctx, name, trace.WithAttributes(attrs...))

	return spanCtx, span
}

// StartSpan starts a new span with the given options
func (t *untraceTracer) StartSpan(ctx context.Context, name string, opts SpanOptions) (context.Context, trace.Span) {
	var spanOpts []trace.SpanStartOption

	if opts.Kind != trace.SpanKindInternal {
		spanOpts = append(spanOpts, trace.WithSpanKind(opts.Kind))
	}

	if opts.Parent.IsValid() {
		spanCtx := trace.ContextWithSpanContext(ctx, opts.Parent)
		ctx = spanCtx
	}

	attrs := t.buildAttributes(opts.Attributes)
	if len(attrs) > 0 {
		spanOpts = append(spanOpts, trace.WithAttributes(attrs...))
	}

	spanCtx, span := t.tracer.Start(ctx, name, spanOpts...)
	return spanCtx, span
}

// GetTracer returns the underlying OpenTelemetry tracer
func (t *untraceTracer) GetTracer() trace.Tracer {
	return t.tracer
}

// buildLLMAttributes builds attributes for LLM spans
func (t *untraceTracer) buildLLMAttributes(opts LLMSpanOptions) []attribute.KeyValue {
	attrs := []attribute.KeyValue{
		attribute.String("llm.provider", opts.Provider),
		attribute.String("llm.model", opts.Model),
		attribute.String("llm.operation.type", string(opts.Operation)),
	}

	if opts.PromptTokens != nil {
		attrs = append(attrs, attribute.Int("llm.prompt.tokens", *opts.PromptTokens))
	}
	if opts.CompletionTokens != nil {
		attrs = append(attrs, attribute.Int("llm.completion.tokens", *opts.CompletionTokens))
	}
	if opts.TotalTokens != nil {
		attrs = append(attrs, attribute.Int("llm.total.tokens", *opts.TotalTokens))
	}
	if opts.Temperature != nil {
		attrs = append(attrs, attribute.Float64("llm.temperature", *opts.Temperature))
	}
	if opts.TopP != nil {
		attrs = append(attrs, attribute.Float64("llm.top_p", *opts.TopP))
	}
	if opts.MaxTokens != nil {
		attrs = append(attrs, attribute.Int("llm.max_tokens", *opts.MaxTokens))
	}
	if opts.Stream != nil {
		attrs = append(attrs, attribute.Bool("llm.stream", *opts.Stream))
	}
	if opts.Tools != nil {
		attrs = append(attrs, attribute.String("llm.tools", *opts.Tools))
	}
	if opts.ToolCalls != nil {
		attrs = append(attrs, attribute.String("llm.tool_calls", *opts.ToolCalls))
	}
	if opts.DurationMs != nil {
		attrs = append(attrs, attribute.Int("llm.duration_ms", *opts.DurationMs))
	}
	if opts.CostPrompt != nil {
		attrs = append(attrs, attribute.Float64("llm.cost.prompt", *opts.CostPrompt))
	}
	if opts.CostCompletion != nil {
		attrs = append(attrs, attribute.Float64("llm.cost.completion", *opts.CostCompletion))
	}
	if opts.CostTotal != nil {
		attrs = append(attrs, attribute.Float64("llm.cost.total", *opts.CostTotal))
	}
	if opts.Error != nil {
		attrs = append(attrs, attribute.String("llm.error", *opts.Error))
	}
	if opts.ErrorType != nil {
		attrs = append(attrs, attribute.String("llm.error.type", *opts.ErrorType))
	}
	if opts.RequestID != nil {
		attrs = append(attrs, attribute.String("llm.request.id", *opts.RequestID))
	}
	if opts.UsageReason != nil {
		attrs = append(attrs, attribute.String("llm.usage.reason", *opts.UsageReason))
	}

	// Add custom attributes
	customAttrs := t.buildAttributes(opts.Attributes)
	attrs = append(attrs, customAttrs...)

	return attrs
}

// buildAttributes converts a map of attributes to OpenTelemetry attributes
func (t *untraceTracer) buildAttributes(attrs map[string]interface{}) []attribute.KeyValue {
	var result []attribute.KeyValue

	for key, value := range attrs {
		switch v := value.(type) {
		case string:
			result = append(result, attribute.String(key, v))
		case int:
			result = append(result, attribute.Int(key, v))
		case int64:
			result = append(result, attribute.Int64(key, v))
		case float64:
			result = append(result, attribute.Float64(key, v))
		case bool:
			result = append(result, attribute.Bool(key, v))
		case []string:
			result = append(result, attribute.StringSlice(key, v))
		case []int:
			result = append(result, attribute.IntSlice(key, v))
		case []float64:
			result = append(result, attribute.Float64Slice(key, v))
		case time.Time:
			result = append(result, attribute.String(key, v.Format(time.RFC3339)))
		default:
			// Convert to string as fallback
			result = append(result, attribute.String(key, fmt.Sprintf("%v", v)))
		}
	}

	return result
}
