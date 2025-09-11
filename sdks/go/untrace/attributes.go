package untrace

import (
	"strings"

	"go.opentelemetry.io/otel/attribute"
)

// LLM attribute keys
const (
	// Provider attributes
	LLMProviderKey = "llm.provider"
	LLMModelKey    = "llm.model"

	// Operation attributes
	LLMOperationTypeKey = "llm.operation.type"

	// Token attributes
	LLMPromptTokensKey     = "llm.prompt.tokens"
	LLMCompletionTokensKey = "llm.completion.tokens"
	LLMTotalTokensKey      = "llm.total.tokens"

	// Parameter attributes
	LLMTemperatureKey = "llm.temperature"
	LLMTopPKey        = "llm.top_p"
	LLMMaxTokensKey   = "llm.max_tokens"
	LLMStreamKey      = "llm.stream"

	// Tool attributes
	LLMToolsKey     = "llm.tools"
	LLMToolCallsKey = "llm.tool_calls"

	// Performance attributes
	LLMDurationMsKey = "llm.duration_ms"

	// Cost attributes
	LLMCostPromptKey     = "llm.cost.prompt"
	LLMCostCompletionKey = "llm.cost.completion"
	LLMCostTotalKey      = "llm.cost.total"

	// Error attributes
	LLMErrorKey     = "llm.error"
	LLMErrorTypeKey = "llm.error.type"

	// Request attributes
	LLMRequestIDKey    = "llm.request.id"
	LLMUsageReasonKey  = "llm.usage.reason"
)

// Vector DB attribute keys
const (
	DBSystemKey      = "db.system"
	DBOperationKey   = "db.operation"
	DBNameKey        = "db.name"
	DBCollectionKey  = "db.collection"
	DBNamespaceKey   = "db.namespace"
	VectorDimensionKey = "vector.dimension"
	VectorCountKey   = "vector.count"
	VectorQueryKKey  = "vector.query.k"
	VectorQueryFilterKey = "vector.query.filter"
	VectorQueryMetricKey = "vector.query.metric"
)

// Framework attribute keys
const (
	FrameworkNameKey    = "framework.name"
	FrameworkVersionKey = "framework.version"
	FrameworkOperationKey = "framework.operation"
	FrameworkChainNameKey = "framework.chain.name"
	FrameworkChainTypeKey = "framework.chain.type"
	FrameworkAgentNameKey = "framework.agent.name"
	FrameworkAgentTypeKey = "framework.agent.type"
	FrameworkToolNameKey  = "framework.tool.name"
	FrameworkToolTypeKey  = "framework.tool.type"
)

// Workflow attribute keys
const (
	WorkflowNameKey     = "workflow.name"
	WorkflowVersionKey  = "workflow.version"
	WorkflowRunIDKey    = "workflow.run_id"
	WorkflowParentIDKey = "workflow.parent_id"
	WorkflowUserIDKey   = "workflow.user_id"
	WorkflowSessionIDKey = "workflow.session_id"
	WorkflowMetadataKey = "workflow.metadata"
)

// CreateLLMAttributes creates LLM-specific attributes
func CreateLLMAttributes(provider, model string, operation LLMOperationType) []attribute.KeyValue {
	return []attribute.KeyValue{
		attribute.String(LLMProviderKey, provider),
		attribute.String(LLMModelKey, model),
		attribute.String(LLMOperationTypeKey, string(operation)),
	}
}

// CreateVectorDBAttributes creates vector DB-specific attributes
func CreateVectorDBAttributes(system, operation string) []attribute.KeyValue {
	return []attribute.KeyValue{
		attribute.String(DBSystemKey, system),
		attribute.String(DBOperationKey, operation),
	}
}

// CreateFrameworkAttributes creates framework-specific attributes
func CreateFrameworkAttributes(name, operation string) []attribute.KeyValue {
	return []attribute.KeyValue{
		attribute.String(FrameworkNameKey, name),
		attribute.String(FrameworkOperationKey, operation),
	}
}

// CreateWorkflowAttributes creates workflow-specific attributes
func CreateWorkflowAttributes(name, runID string) []attribute.KeyValue {
	return []attribute.KeyValue{
		attribute.String(WorkflowNameKey, name),
		attribute.String(WorkflowRunIDKey, runID),
	}
}

// SanitizeAttributes removes or masks sensitive attributes
func SanitizeAttributes(attrs map[string]interface{}) map[string]interface{} {
	sanitized := make(map[string]interface{})

	for key, value := range attrs {
		// Skip sensitive keys
		if isSensitiveKey(key) {
			sanitized[key] = "[REDACTED]"
		} else {
			sanitized[key] = value
		}
	}

	return sanitized
}

// isSensitiveKey checks if a key contains sensitive information
func isSensitiveKey(key string) bool {
	sensitiveKeys := []string{
		"password",
		"secret",
		"token",
		"key",
		"auth",
		"credential",
		"api_key",
		"access_token",
		"refresh_token",
	}

	keyLower := strings.ToLower(key)
	for _, sensitive := range sensitiveKeys {
		if strings.Contains(keyLower, sensitive) {
			return true
		}
	}

	return false
}

// MergeAttributes merges multiple attribute maps
func MergeAttributes(attrs ...map[string]interface{}) map[string]interface{} {
	merged := make(map[string]interface{})

	for _, attrMap := range attrs {
		for key, value := range attrMap {
			merged[key] = value
		}
	}

	return merged
}
