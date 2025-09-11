package untrace

import (
	"context"
	"fmt"
	"reflect"
	"runtime"
	"strings"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

// InstrumentationConfig represents configuration for instrumentation
type InstrumentationConfig struct {
	Enabled     bool
	CaptureBody bool
	CaptureArgs bool
	MaxBodySize int
}

// DefaultInstrumentationConfig returns default instrumentation configuration
func DefaultInstrumentationConfig() InstrumentationConfig {
	return InstrumentationConfig{
		Enabled:     true,
		CaptureBody: true,
		CaptureArgs: false,
		MaxBodySize: 1024 * 1024, // 1MB
	}
}

// Instrumentation represents an instrumentation helper
type Instrumentation struct {
	client   Client
	config   InstrumentationConfig
}

// NewInstrumentation creates a new instrumentation helper
func NewInstrumentation(client Client, config InstrumentationConfig) *Instrumentation {
	return &Instrumentation{
		client: client,
		config: config,
	}
}

// TraceFunction traces a function call
func (i *Instrumentation) TraceFunction(ctx context.Context, name string, fn func(context.Context) error, attrs ...attribute.KeyValue) error {
	if !i.config.Enabled {
		return fn(ctx)
	}

	ctx, span := i.client.Tracer().StartSpan(ctx, name, SpanOptions{
		Attributes: i.attributesToMap(attrs),
	})
	defer span.End()

	start := time.Now()
	err := fn(ctx)
	duration := time.Since(start)

	// Record metrics
	if err != nil {
		i.client.Metrics().RecordError(err, map[string]interface{}{
			"function": name,
		})
	} else {
		i.client.Metrics().RecordLatency(duration, map[string]interface{}{
			"function": name,
		})
	}

	return err
}

// TraceLLMCall traces an LLM call
func (i *Instrumentation) TraceLLMCall(ctx context.Context, name string, opts LLMSpanOptions, fn func(context.Context) error) error {
	if !i.config.Enabled {
		return fn(ctx)
	}

	ctx, span := i.client.Tracer().StartLLMSpan(ctx, name, opts)
	defer span.End()

	start := time.Now()
	err := fn(ctx)
	duration := time.Since(start)

	// Update span with duration
	opts.DurationMs = int(duration.Milliseconds())

	// Record metrics
	if err != nil {
		i.client.Metrics().RecordError(err, map[string]interface{}{
			"provider": opts.Provider,
			"model":    opts.Model,
			"operation": string(opts.Operation),
		})
	} else {
		i.client.Metrics().RecordLatency(duration, map[string]interface{}{
			"provider": opts.Provider,
			"model":    opts.Model,
			"operation": string(opts.Operation),
		})
	}

	return err
}

// TraceHTTPRequest traces an HTTP request
func (i *Instrumentation) TraceHTTPRequest(ctx context.Context, method, url string, fn func(context.Context) error) error {
	if !i.config.Enabled {
		return fn(ctx)
	}

	attrs := map[string]interface{}{
		"http.method": method,
		"http.url":    url,
	}

	ctx, span := i.client.Tracer().StartSpan(ctx, fmt.Sprintf("%s %s", method, url), SpanOptions{
		Attributes: attrs,
	})
	defer span.End()

	start := time.Now()
	err := fn(ctx)
	duration := time.Since(start)

	// Record metrics
	if err != nil {
		i.client.Metrics().RecordError(err, map[string]interface{}{
			"http.method": method,
			"http.url":    url,
		})
	} else {
		i.client.Metrics().RecordLatency(duration, map[string]interface{}{
			"http.method": method,
			"http.url":    url,
		})
	}

	return err
}

// TraceDatabaseQuery traces a database query
func (i *Instrumentation) TraceDatabaseQuery(ctx context.Context, operation, table string, fn func(context.Context) error) error {
	if !i.config.Enabled {
		return fn(ctx)
	}

	attrs := map[string]interface{}{
		"db.operation": operation,
		"db.table":     table,
	}

	ctx, span := i.client.Tracer().StartSpan(ctx, fmt.Sprintf("db.%s", operation), SpanOptions{
		Attributes: attrs,
	})
	defer span.End()

	start := time.Now()
	err := fn(ctx)
	duration := time.Since(start)

	// Record metrics
	if err != nil {
		i.client.Metrics().RecordError(err, map[string]interface{}{
			"db.operation": operation,
			"db.table":     table,
		})
	} else {
		i.client.Metrics().RecordLatency(duration, map[string]interface{}{
			"db.operation": operation,
			"db.table":     table,
		})
	}

	return err
}

// TraceWorkflow traces a workflow execution
func (i *Instrumentation) TraceWorkflow(ctx context.Context, name, runID string, opts WorkflowOptions, fn func(context.Context) error) error {
	if !i.config.Enabled {
		return fn(ctx)
	}

	workflow := i.client.Context().StartWorkflow(name, runID, opts)
	defer workflow.End()

	// Add workflow context to the function context
	workflowCtx := workflow.Context()

	start := time.Now()
	err := fn(workflowCtx)
	duration := time.Since(start)

	// Record metrics
	if err != nil {
		i.client.Metrics().RecordError(err, map[string]interface{}{
			"workflow.name": name,
			"workflow.run_id": runID,
		})
	} else {
		i.client.Metrics().RecordLatency(duration, map[string]interface{}{
			"workflow.name": name,
			"workflow.run_id": runID,
		})
	}

	return err
}

// attributesToMap converts OpenTelemetry attributes to a map
func (i *Instrumentation) attributesToMap(attrs []attribute.KeyValue) map[string]interface{} {
	result := make(map[string]interface{})

	for _, attr := range attrs {
		key := string(attr.Key)
		switch attr.Value.Type() {
		case attribute.STRING:
			result[key] = attr.Value.AsString()
		case attribute.BOOL:
			result[key] = attr.Value.AsBool()
		case attribute.INT64:
			result[key] = attr.Value.AsInt64()
		case attribute.FLOAT64:
			result[key] = attr.Value.AsFloat64()
		case attribute.STRINGSLICE:
			result[key] = attr.Value.AsStringSlice()
		case attribute.INT64SLICE:
			result[key] = attr.Value.AsInt64Slice()
		case attribute.FLOAT64SLICE:
			result[key] = attr.Value.AsFloat64Slice()
		case attribute.BOOLSLICE:
			result[key] = attr.Value.AsBoolSlice()
		default:
			result[key] = attr.Value.AsInterface()
		}
	}

	return result
}

// GetFunctionName gets the name of the calling function
func GetFunctionName() string {
	pc, _, _, _ := runtime.Caller(1)
	fn := runtime.FuncForPC(pc)
	if fn != nil {
		name := fn.Name()
		// Extract just the function name from the full path
		parts := strings.Split(name, ".")
		return parts[len(parts)-1]
	}
	return "unknown"
}

// GetCallerInfo gets information about the calling function
func GetCallerInfo(skip int) (string, string, int) {
	pc, file, line, ok := runtime.Caller(skip + 1)
	if !ok {
		return "unknown", "unknown", 0
	}

	fn := runtime.FuncForPC(pc)
	if fn != nil {
		return fn.Name(), file, line
	}

	return "unknown", file, line
}

// SafeString converts a value to a string safely
func SafeString(value interface{}) string {
	if value == nil {
		return ""
	}

	switch v := value.(type) {
	case string:
		return v
	case fmt.Stringer:
		return v.String()
	default:
		return fmt.Sprintf("%v", v)
	}
}

// TruncateString truncates a string to the specified length
func TruncateString(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
}

// IsNil checks if a value is nil
func IsNil(value interface{}) bool {
	if value == nil {
		return true
	}

	v := reflect.ValueOf(value)
	switch v.Kind() {
	case reflect.Chan, reflect.Func, reflect.Interface, reflect.Map, reflect.Ptr, reflect.Slice:
		return v.IsNil()
	default:
		return false
	}
}
