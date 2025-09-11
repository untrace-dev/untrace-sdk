// Package untrace provides the main public API for the Untrace Go SDK
package untrace

// Re-export all public types and functions from the internal package
import (
	untrace "github.com/untrace-dev/untrace-sdk/sdks/go/untrace"
)

// Type aliases for convenience
type (
	Config                = untrace.Config
	Client                = untrace.Client
	Tracer                = untrace.Tracer
	Metrics               = untrace.Metrics
	Context               = untrace.Context
	Workflow              = untrace.Workflow
	LLMSpanOptions        = untrace.LLMSpanOptions
	WorkflowOptions       = untrace.WorkflowOptions
	TokenUsage            = untrace.TokenUsage
	Cost                  = untrace.Cost
	SpanOptions           = untrace.SpanOptions
	LLMOperationType      = untrace.LLMOperationType
	Instrumentation       = untrace.Instrumentation
	InstrumentationConfig = untrace.InstrumentationConfig
	ProviderRegistry      = untrace.ProviderRegistry
	ProviderInstrumentation = untrace.ProviderInstrumentation
)

// Re-export all public functions
var (
	Init                    = untrace.Init
	InitFromEnv            = untrace.InitFromEnv
	MustInit               = untrace.MustInit
	MustInitFromEnv        = untrace.MustInitFromEnv
	GetInstance            = untrace.GetInstance
	DefaultConfig          = untrace.DefaultConfig
	NewInstrumentation     = untrace.NewInstrumentation
	NewProviderRegistry    = untrace.NewProviderRegistry
	GetDefaultProviders    = untrace.GetDefaultProviders
	RegisterDefaultProviders = untrace.RegisterDefaultProviders
)

// Re-export all public constants
const (
	// LLM Operation Types
	LLMOperationCompletion        = untrace.LLMOperationCompletion
	LLMOperationChat             = untrace.LLMOperationChat
	LLMOperationEmbedding        = untrace.LLMOperationEmbedding
	LLMOperationFineTune         = untrace.LLMOperationFineTune
	LLMOperationImageGeneration  = untrace.LLMOperationImageGeneration
	LLMOperationAudioTranscription = untrace.LLMOperationAudioTranscription
	LLMOperationAudioGeneration  = untrace.LLMOperationAudioGeneration
	LLMOperationModeration       = untrace.LLMOperationModeration
	LLMOperationToolUse          = untrace.LLMOperationToolUse
)

// Re-export attribute helpers
var (
	String        = untrace.String
	Int           = untrace.Int
	Int64         = untrace.Int64
	Float64       = untrace.Float64
	Bool          = untrace.Bool
	StringSlice   = untrace.StringSlice
	IntSlice      = untrace.IntSlice
	Float64Slice  = untrace.Float64Slice
)

// Re-export attribute creation functions
var (
	CreateLLMAttributes      = untrace.CreateLLMAttributes
	CreateVectorDBAttributes = untrace.CreateVectorDBAttributes
	CreateFrameworkAttributes = untrace.CreateFrameworkAttributes
	CreateWorkflowAttributes = untrace.CreateWorkflowAttributes
	SanitizeAttributes       = untrace.SanitizeAttributes
	MergeAttributes          = untrace.MergeAttributes
)

// Re-export utility functions
var (
	GetFunctionName = untrace.GetFunctionName
	GetCallerInfo   = untrace.GetCallerInfo
	SafeString      = untrace.SafeString
	TruncateString  = untrace.TruncateString
	IsNil           = untrace.IsNil
)
