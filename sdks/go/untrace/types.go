package untrace

import (
	"context"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

// LLMOperationType represents the type of LLM operation
type LLMOperationType string

const (
	LLMOperationCompletion        LLMOperationType = "completion"
	LLMOperationChat             LLMOperationType = "chat"
	LLMOperationEmbedding        LLMOperationType = "embedding"
	LLMOperationFineTune         LLMOperationType = "fine_tune"
	LLMOperationImageGeneration  LLMOperationType = "image_generation"
	LLMOperationAudioTranscription LLMOperationType = "audio_transcription"
	LLMOperationAudioGeneration  LLMOperationType = "audio_generation"
	LLMOperationModeration       LLMOperationType = "moderation"
	LLMOperationToolUse          LLMOperationType = "tool_use"
)

// LLMSpanOptions represents options for creating LLM spans
type LLMSpanOptions struct {
	Provider         string
	Model            string
	Operation        LLMOperationType
	PromptTokens     *int
	CompletionTokens *int
	TotalTokens      *int
	Temperature      *float64
	TopP             *float64
	MaxTokens        *int
	Stream           *bool
	Tools            *string
	ToolCalls        *string
	DurationMs       *int
	CostPrompt       *float64
	CostCompletion   *float64
	CostTotal        *float64
	Error            *string
	ErrorType        *string
	RequestID        *string
	UsageReason      *string
	Attributes       map[string]interface{}
}

// WorkflowOptions represents options for creating workflows
type WorkflowOptions struct {
	UserID    string
	SessionID string
	Version   string
	ParentID  string
	Metadata  map[string]interface{}
}

// TokenUsage represents token usage information
type TokenUsage struct {
	PromptTokens     int
	CompletionTokens int
	TotalTokens      int
	Model            string
	Provider         string
}

// Cost represents cost information
type Cost struct {
	Prompt     float64
	Completion float64
	Total      float64
	Currency   string
	Model      string
	Provider   string
}

// SpanOptions represents options for creating spans
type SpanOptions struct {
	Name       string
	Kind       trace.SpanKind
	Attributes map[string]interface{}
	Parent     trace.SpanContext
}

// Workflow represents a workflow context
type Workflow interface {
	End()
	Context() context.Context
	SetAttribute(key string, value interface{})
	SetAttributes(attrs map[string]interface{})
}

// Tracer represents the tracer interface
type Tracer interface {
	StartLLMSpan(ctx context.Context, name string, opts LLMSpanOptions) (context.Context, trace.Span)
	StartSpan(ctx context.Context, name string, opts SpanOptions) (context.Context, trace.Span)
	GetTracer() trace.Tracer
}

// Metrics represents the metrics interface
type Metrics interface {
	RecordTokenUsage(usage TokenUsage)
	RecordLatency(duration time.Duration, attributes map[string]interface{})
	RecordError(err error, attributes map[string]interface{})
	RecordCost(cost Cost)
}

// Context represents the context manager interface
type Context interface {
	StartWorkflow(name, runID string, opts WorkflowOptions) Workflow
	GetCurrentWorkflow() Workflow
	SetAttribute(key string, value interface{})
	SetAttributes(attrs map[string]interface{})
}

// Client represents the main Untrace client interface
type Client interface {
	Tracer() Tracer
	Metrics() Metrics
	Context() Context
	Shutdown(ctx context.Context) error
	Flush(ctx context.Context) error
}

// Attribute helpers for common types
func String(key, value string) attribute.KeyValue {
	return attribute.String(key, value)
}

func Int(key string, value int) attribute.KeyValue {
	return attribute.Int(key, value)
}

func Int64(key string, value int64) attribute.KeyValue {
	return attribute.Int64(key, value)
}

func Float64(key string, value float64) attribute.KeyValue {
	return attribute.Float64(key, value)
}

func Bool(key string, value bool) attribute.KeyValue {
	return attribute.Bool(key, value)
}

func StringSlice(key string, value []string) attribute.KeyValue {
	return attribute.StringSlice(key, value)
}

func IntSlice(key string, value []int) attribute.KeyValue {
	return attribute.IntSlice(key, value)
}

func Float64Slice(key string, value []float64) attribute.KeyValue {
	return attribute.Float64Slice(key, value)
}
