package untrace

import (
	"context"
	"fmt"
	"reflect"
	"time"

	"go.opentelemetry.io/otel/trace"
)

// ProviderInstrumentation represents instrumentation for a specific provider
type ProviderInstrumentation interface {
	// Name returns the provider name
	Name() string

	// CanInstrument checks if a module can be instrumented
	CanInstrument(module interface{}) bool

	// Instrument instruments the module
	Instrument(module interface{}) interface{}

	// Initialize initializes the instrumentation
	Initialize(client Client) error

	// Shutdown shuts down the instrumentation
	Shutdown() error
}

// ProviderRegistry manages provider instrumentations
type ProviderRegistry struct {
	instrumentations map[string]ProviderInstrumentation
}

// NewProviderRegistry creates a new provider registry
func NewProviderRegistry() *ProviderRegistry {
	return &ProviderRegistry{
		instrumentations: make(map[string]ProviderInstrumentation),
	}
}

// Register registers a provider instrumentation
func (r *ProviderRegistry) Register(provider ProviderInstrumentation) {
	r.instrumentations[provider.Name()] = provider
}

// Get returns a provider instrumentation by name
func (r *ProviderRegistry) Get(name string) (ProviderInstrumentation, bool) {
	provider, exists := r.instrumentations[name]
	return provider, exists
}

// List returns all registered provider names
func (r *ProviderRegistry) List() []string {
	names := make([]string, 0, len(r.instrumentations))
	for name := range r.instrumentations {
		names = append(names, name)
	}
	return names
}

// Instrument instruments a module with the specified provider
func (r *ProviderRegistry) Instrument(name string, module interface{}) (interface{}, error) {
	provider, exists := r.Get(name)
	if !exists {
		return nil, fmt.Errorf("provider %s not found", name)
	}

	if !provider.CanInstrument(module) {
		return nil, fmt.Errorf("module cannot be instrumented by provider %s", name)
	}

	return provider.Instrument(module), nil
}

// baseProviderInstrumentation provides common functionality for provider instrumentations
type baseProviderInstrumentation struct {
	name    string
	client  Client
	enabled bool
}

// Name returns the provider name
func (b *baseProviderInstrumentation) Name() string {
	return b.name
}

// Initialize initializes the instrumentation
func (b *baseProviderInstrumentation) Initialize(client Client) error {
	b.client = client
	b.enabled = true
	return nil
}

// Shutdown shuts down the instrumentation
func (b *baseProviderInstrumentation) Shutdown() error {
	b.enabled = false
	return nil
}

// isEnabled checks if the instrumentation is enabled
func (b *baseProviderInstrumentation) isEnabled() bool {
	return b.enabled && b.client != nil
}

// createLLMSpan creates an LLM span for the provider
func (b *baseProviderInstrumentation) createLLMSpan(ctx context.Context, name string, opts LLMSpanOptions) (context.Context, trace.Span) {
	if !b.isEnabled() {
		return ctx, trace.SpanFromContext(ctx)
	}

	return b.client.Tracer().StartLLMSpan(ctx, name, opts)
}

// recordMetrics records metrics for the provider
func (b *baseProviderInstrumentation) recordMetrics(usage TokenUsage, cost Cost, duration time.Duration, err error) {
	if !b.isEnabled() {
		return
	}

	if err != nil {
		b.client.Metrics().RecordError(err, map[string]interface{}{
			"provider": usage.Provider,
			"model":    usage.Model,
		})
	} else {
		b.client.Metrics().RecordTokenUsage(usage)
		b.client.Metrics().RecordCost(cost)
		b.client.Metrics().RecordLatency(duration, map[string]interface{}{
			"provider": usage.Provider,
			"model":    usage.Model,
		})
	}
}

// OpenAIInstrumentation provides instrumentation for OpenAI
type OpenAIInstrumentation struct {
	baseProviderInstrumentation
}

// NewOpenAIInstrumentation creates a new OpenAI instrumentation
func NewOpenAIInstrumentation() *OpenAIInstrumentation {
	return &OpenAIInstrumentation{
		baseProviderInstrumentation: baseProviderInstrumentation{
			name: "openai",
		},
	}
}

// CanInstrument checks if a module can be instrumented by OpenAI
func (o *OpenAIInstrumentation) CanInstrument(module interface{}) bool {
	// Check if the module has OpenAI-specific methods
	// This is a simplified check - in practice, you'd check for specific types
	moduleType := reflect.TypeOf(module)
	if moduleType == nil {
		return false
	}

	// Look for common OpenAI client methods
	methods := []string{"CreateChatCompletion", "CreateCompletion", "CreateEmbedding"}
	for _, method := range methods {
		if _, exists := moduleType.MethodByName(method); exists {
			return true
		}
	}

	return false
}

// Instrument instruments an OpenAI module
func (o *OpenAIInstrumentation) Instrument(module interface{}) interface{} {
	// This is a simplified implementation
	// In practice, you would use reflection or code generation to wrap methods
	return &OpenAIWrapper{
		client: module,
		instrumentation: o,
	}
}

// OpenAIWrapper wraps an OpenAI client with instrumentation
type OpenAIWrapper struct {
	client         interface{}
	instrumentation *OpenAIInstrumentation
}

// AnthropicInstrumentation provides instrumentation for Anthropic
type AnthropicInstrumentation struct {
	baseProviderInstrumentation
}

// NewAnthropicInstrumentation creates a new Anthropic instrumentation
func NewAnthropicInstrumentation() *AnthropicInstrumentation {
	return &AnthropicInstrumentation{
		baseProviderInstrumentation: baseProviderInstrumentation{
			name: "anthropic",
		},
	}
}

// CanInstrument checks if a module can be instrumented by Anthropic
func (a *AnthropicInstrumentation) CanInstrument(module interface{}) bool {
	moduleType := reflect.TypeOf(module)
	if moduleType == nil {
		return false
	}

	// Look for common Anthropic client methods
	methods := []string{"CreateMessage", "CreateCompletion"}
	for _, method := range methods {
		if _, exists := moduleType.MethodByName(method); exists {
			return true
		}
	}

	return false
}

// Instrument instruments an Anthropic module
func (a *AnthropicInstrumentation) Instrument(module interface{}) interface{} {
	return &AnthropicWrapper{
		client: module,
		instrumentation: a,
	}
}

// AnthropicWrapper wraps an Anthropic client with instrumentation
type AnthropicWrapper struct {
	client         interface{}
	instrumentation *AnthropicInstrumentation
}

// GetDefaultProviders returns the default set of providers
func GetDefaultProviders() []ProviderInstrumentation {
	return []ProviderInstrumentation{
		NewOpenAIInstrumentation(),
		NewAnthropicInstrumentation(),
	}
}

// RegisterDefaultProviders registers all default providers
func RegisterDefaultProviders(registry *ProviderRegistry) {
	for _, provider := range GetDefaultProviders() {
		registry.Register(provider)
	}
}
