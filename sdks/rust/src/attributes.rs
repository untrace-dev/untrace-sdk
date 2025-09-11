//! Attribute definitions and helpers for the Untrace SDK

use opentelemetry::{Key, KeyValue};
use std::collections::HashMap;

/// LLM-specific attributes
pub mod llm {
    use super::*;

    pub const PROVIDER: &str = "llm.provider";
    pub const MODEL: &str = "llm.model";
    pub const OPERATION: &str = "llm.operation";
    pub const PROMPT_TOKENS: &str = "llm.prompt_tokens";
    pub const COMPLETION_TOKENS: &str = "llm.completion_tokens";
    pub const TOTAL_TOKENS: &str = "llm.total_tokens";
    pub const TEMPERATURE: &str = "llm.temperature";
    pub const TOP_P: &str = "llm.top_p";
    pub const MAX_TOKENS: &str = "llm.max_tokens";
    pub const STREAM: &str = "llm.stream";
    pub const TOOLS: &str = "llm.tools";
    pub const TOOL_CALLS: &str = "llm.tool_calls";
    pub const DURATION_MS: &str = "llm.duration_ms";
    pub const COST_PROMPT: &str = "llm.cost_prompt";
    pub const COST_COMPLETION: &str = "llm.cost_completion";
    pub const COST_TOTAL: &str = "llm.cost_total";
    pub const ERROR: &str = "llm.error";
    pub const ERROR_TYPE: &str = "llm.error_type";
    pub const REQUEST_ID: &str = "llm.request_id";
    pub const USAGE_REASON: &str = "llm.usage_reason";
}

/// Vector database attributes
pub mod vector_db {
    use super::*;

    pub const PROVIDER: &str = "vector_db.provider";
    pub const COLLECTION: &str = "vector_db.collection";
    pub const OPERATION: &str = "vector_db.operation";
    pub const DIMENSIONS: &str = "vector_db.dimensions";
    pub const VECTOR_COUNT: &str = "vector_db.vector_count";
    pub const QUERY_VECTOR_COUNT: &str = "vector_db.query_vector_count";
    pub const RESULT_COUNT: &str = "vector_db.result_count";
    pub const SIMILARITY_THRESHOLD: &str = "vector_db.similarity_threshold";
    pub const FILTER: &str = "vector_db.filter";
    pub const METADATA: &str = "vector_db.metadata";
}

/// Framework attributes
pub mod framework {
    use super::*;

    pub const NAME: &str = "framework.name";
    pub const VERSION: &str = "framework.version";
    pub const TYPE: &str = "framework.type";
    pub const OPERATION: &str = "framework.operation";
    pub const COMPONENT: &str = "framework.component";
    pub const METHOD: &str = "framework.method";
    pub const ROUTE: &str = "framework.route";
    pub const STATUS_CODE: &str = "framework.status_code";
    pub const DURATION_MS: &str = "framework.duration_ms";
    pub const ERROR: &str = "framework.error";
    pub const ERROR_TYPE: &str = "framework.error_type";
}

/// Workflow attributes
pub mod workflow {
    use super::*;

    pub const ID: &str = "workflow.id";
    pub const NAME: &str = "workflow.name";
    pub const RUN_ID: &str = "workflow.run_id";
    pub const USER_ID: &str = "workflow.user_id";
    pub const SESSION_ID: &str = "workflow.session_id";
    pub const VERSION: &str = "workflow.version";
    pub const PARENT_ID: &str = "workflow.parent_id";
    pub const STATUS: &str = "workflow.status";
    pub const DURATION_MS: &str = "workflow.duration_ms";
    pub const ERROR: &str = "workflow.error";
    pub const ERROR_TYPE: &str = "workflow.error_type";
    pub const METADATA: &str = "workflow.metadata";
}

/// Create LLM attributes from a map
pub fn create_llm_attributes(attrs: &HashMap<String, String>) -> Vec<KeyValue> {
    attrs
        .iter()
        .map(|(k, v)| KeyValue::new(Key::new(k.clone()), v.clone()))
        .collect()
}

/// Create vector database attributes from a map
pub fn create_vector_db_attributes(attrs: &HashMap<String, String>) -> Vec<KeyValue> {
    attrs
        .iter()
        .map(|(k, v)| KeyValue::new(Key::new(k.clone()), v.clone()))
        .collect()
}

/// Create framework attributes from a map
pub fn create_framework_attributes(attrs: &HashMap<String, String>) -> Vec<KeyValue> {
    attrs
        .iter()
        .map(|(k, v)| KeyValue::new(Key::new(k.clone()), v.clone()))
        .collect()
}

/// Create workflow attributes from a map
pub fn create_workflow_attributes(attrs: &HashMap<String, String>) -> Vec<KeyValue> {
    attrs
        .iter()
        .map(|(k, v)| KeyValue::new(Key::new(k.clone()), v.clone()))
        .collect()
}

/// Sanitize attributes by removing sensitive information
pub fn sanitize_attributes(attrs: &mut HashMap<String, String>) {
    let sensitive_keys = [
        "password",
        "secret",
        "token",
        "key",
        "auth",
        "credential",
        "api_key",
        "access_token",
        "refresh_token",
    ];

    for key in sensitive_keys {
        if attrs.contains_key(key) {
            attrs.insert(key.to_string(), "[REDACTED]".to_string());
        }
    }
}

/// Merge two attribute maps
pub fn merge_attributes(
    mut base: HashMap<String, String>,
    other: HashMap<String, String>,
) -> HashMap<String, String> {
    for (k, v) in other {
        base.insert(k, v);
    }
    base
}

/// Helper functions for creating common attribute values
pub mod helpers {
    use super::*;

    /// Create a string attribute
    pub fn string(key: &str, value: &str) -> KeyValue {
        KeyValue::new(Key::new(key.to_string()), value.to_string())
    }

    /// Create an integer attribute
    pub fn int(key: &str, value: i64) -> KeyValue {
        KeyValue::new(Key::new(key.to_string()), value)
    }

    /// Create a float attribute
    pub fn float(key: &str, value: f64) -> KeyValue {
        KeyValue::new(Key::new(key.to_string()), value)
    }

    /// Create a boolean attribute
    pub fn bool(key: &str, value: bool) -> KeyValue {
        KeyValue::new(Key::new(key.to_string()), value)
    }

    /// Create a string slice attribute
    pub fn string_slice(key: &str, value: Vec<String>) -> KeyValue {
        KeyValue::new(Key::new(key.to_string()), value.join(","))
    }

    /// Create an integer slice attribute
    pub fn int_slice(key: &str, value: Vec<i64>) -> KeyValue {
        KeyValue::new(Key::new(key.to_string()), value.iter().map(|v| v.to_string()).collect::<Vec<_>>().join(","))
    }

    /// Create a float slice attribute
    pub fn float_slice(key: &str, value: Vec<f64>) -> KeyValue {
        KeyValue::new(Key::new(key.to_string()), value.iter().map(|v| v.to_string()).collect::<Vec<_>>().join(","))
    }
}
