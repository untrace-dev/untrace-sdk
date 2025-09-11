package untrace

import (
	"context"
	"fmt"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/metric"
)

// untraceMetrics implements the Metrics interface
type untraceMetrics struct {
	meter metric.Meter
}

// NewMetrics creates a new Untrace metrics instance
func NewMetrics(meter metric.Meter) Metrics {
	return &untraceMetrics{
		meter: meter,
	}
}

// RecordTokenUsage records token usage metrics
func (m *untraceMetrics) RecordTokenUsage(usage TokenUsage) {
	attrs := []attribute.KeyValue{
		attribute.String("model", usage.Model),
		attribute.String("provider", usage.Provider),
	}

	// Create counters for different token types
	promptCounter, _ := m.meter.Int64Counter("llm.prompt.tokens")
	completionCounter, _ := m.meter.Int64Counter("llm.completion.tokens")
	totalCounter, _ := m.meter.Int64Counter("llm.total.tokens")

	if usage.PromptTokens > 0 {
		promptCounter.Add(context.Background(), int64(usage.PromptTokens), metric.WithAttributes(attrs...))
	}
	if usage.CompletionTokens > 0 {
		completionCounter.Add(context.Background(), int64(usage.CompletionTokens), metric.WithAttributes(attrs...))
	}
	if usage.TotalTokens > 0 {
		totalCounter.Add(context.Background(), int64(usage.TotalTokens), metric.WithAttributes(attrs...))
	}
}

// RecordLatency records latency metrics
func (m *untraceMetrics) RecordLatency(duration time.Duration, attributes map[string]interface{}) {
	attrs := m.buildAttributes(attributes)

	histogram, _ := m.meter.Float64Histogram("llm.latency")
	histogram.Record(context.Background(), duration.Seconds(), metric.WithAttributes(attrs...))
}

// RecordError records error metrics
func (m *untraceMetrics) RecordError(err error, attributes map[string]interface{}) {
	attrs := m.buildAttributes(attributes)
	attrs = append(attrs, attribute.String("error.type", err.Error()))

	counter, _ := m.meter.Int64Counter("llm.errors")
	counter.Add(context.Background(), 1, metric.WithAttributes(attrs...))
}

// RecordCost records cost metrics
func (m *untraceMetrics) RecordCost(cost Cost) {
	attrs := []attribute.KeyValue{
		attribute.String("model", cost.Model),
		attribute.String("provider", cost.Provider),
		attribute.String("currency", cost.Currency),
	}

	// Create counters for different cost components
	promptCounter, _ := m.meter.Float64Counter("llm.cost.prompt")
	completionCounter, _ := m.meter.Float64Counter("llm.cost.completion")
	totalCounter, _ := m.meter.Float64Counter("llm.cost.total")

	if cost.Prompt > 0 {
		promptCounter.Add(context.Background(), cost.Prompt, metric.WithAttributes(attrs...))
	}
	if cost.Completion > 0 {
		completionCounter.Add(context.Background(), cost.Completion, metric.WithAttributes(attrs...))
	}
	if cost.Total > 0 {
		totalCounter.Add(context.Background(), cost.Total, metric.WithAttributes(attrs...))
	}
}

// buildAttributes converts a map of attributes to OpenTelemetry attributes
func (m *untraceMetrics) buildAttributes(attrs map[string]interface{}) []attribute.KeyValue {
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
		default:
			// Convert to string as fallback
			result = append(result, attribute.String(key, fmt.Sprintf("%v", v)))
		}
	}

	return result
}
