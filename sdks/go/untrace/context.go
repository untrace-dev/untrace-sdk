package untrace

import (
	"context"
	"fmt"
	"sync"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

// untraceContext implements the Context interface
type untraceContext struct {
	mu        sync.RWMutex
	workflows map[string]Workflow
}

// NewContext creates a new Untrace context manager
func NewContext() Context {
	return &untraceContext{
		workflows: make(map[string]Workflow),
	}
}

// StartWorkflow starts a new workflow
func (c *untraceContext) StartWorkflow(name, runID string, opts WorkflowOptions) Workflow {
	c.mu.Lock()
	defer c.mu.Unlock()

	workflow := &untraceWorkflow{
		name:    name,
		runID:   runID,
		opts:    opts,
		ctx:     context.Background(),
		attrs:   make(map[string]interface{}),
		context: c,
	}

	// Set workflow attributes
	workflow.attrs["workflow.name"] = name
	workflow.attrs["workflow.run_id"] = runID
	if opts.Version != "" {
		workflow.attrs["workflow.version"] = opts.Version
	}
	if opts.ParentID != "" {
		workflow.attrs["workflow.parent_id"] = opts.ParentID
	}
	if opts.UserID != "" {
		workflow.attrs["workflow.user_id"] = opts.UserID
	}
	if opts.SessionID != "" {
		workflow.attrs["workflow.session_id"] = opts.SessionID
	}

	// Add custom metadata
	for key, value := range opts.Metadata {
		workflow.attrs["workflow.metadata."+key] = value
	}

	c.workflows[runID] = workflow
	return workflow
}

// GetCurrentWorkflow returns the current workflow if any
func (c *untraceContext) GetCurrentWorkflow() Workflow {
	c.mu.RLock()
	defer c.mu.RUnlock()

	// For simplicity, return the first workflow
	// In a real implementation, you might track the current workflow per goroutine
	for _, workflow := range c.workflows {
		return workflow
	}
	return nil
}

// SetAttribute sets a global attribute
func (c *untraceContext) SetAttribute(key string, value interface{}) {
	// Global attributes could be stored here
	// For now, this is a placeholder
}

// SetAttributes sets multiple global attributes
func (c *untraceContext) SetAttributes(attrs map[string]interface{}) {
	// Global attributes could be stored here
	// For now, this is a placeholder
}

// untraceWorkflow implements the Workflow interface
type untraceWorkflow struct {
	name    string
	runID   string
	opts    WorkflowOptions
	ctx     context.Context
	attrs   map[string]interface{}
	context *untraceContext
	ended   bool
	mu      sync.RWMutex
}

// End ends the workflow
func (w *untraceWorkflow) End() {
	w.mu.Lock()
	defer w.mu.Unlock()

	if w.ended {
		return
	}

	w.ended = true

	// Remove from context
	w.context.mu.Lock()
	delete(w.context.workflows, w.runID)
	w.context.mu.Unlock()
}

// Context returns the workflow context
func (w *untraceWorkflow) Context() context.Context {
	return w.ctx
}

// SetAttribute sets an attribute on the workflow
func (w *untraceWorkflow) SetAttribute(key string, value interface{}) {
	w.mu.Lock()
	defer w.mu.Unlock()

	w.attrs[key] = value
}

// SetAttributes sets multiple attributes on the workflow
func (w *untraceWorkflow) SetAttributes(attrs map[string]interface{}) {
	w.mu.Lock()
	defer w.mu.Unlock()

	for key, value := range attrs {
		w.attrs[key] = value
	}
}

// GetAttributes returns the workflow attributes
func (w *untraceWorkflow) GetAttributes() map[string]interface{} {
	w.mu.RLock()
	defer w.mu.RUnlock()

	// Return a copy to prevent race conditions
	result := make(map[string]interface{})
	for key, value := range w.attrs {
		result[key] = value
	}
	return result
}

// BuildAttributes converts workflow attributes to OpenTelemetry attributes
func (w *untraceWorkflow) BuildAttributes() []attribute.KeyValue {
	w.mu.RLock()
	defer w.mu.RUnlock()

	var result []attribute.KeyValue
	for key, value := range w.attrs {
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
