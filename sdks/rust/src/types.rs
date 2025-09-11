//! Type definitions for the Untrace SDK

use opentelemetry::trace::SpanKind;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// LLM operation types
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum LLMOperationType {
    Completion,
    Chat,
    Embedding,
    FineTune,
    ImageGeneration,
    AudioTranscription,
    AudioGeneration,
    Moderation,
    ToolUse,
}

impl std::fmt::Display for LLMOperationType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            LLMOperationType::Completion => write!(f, "completion"),
            LLMOperationType::Chat => write!(f, "chat"),
            LLMOperationType::Embedding => write!(f, "embedding"),
            LLMOperationType::FineTune => write!(f, "fine_tune"),
            LLMOperationType::ImageGeneration => write!(f, "image_generation"),
            LLMOperationType::AudioTranscription => write!(f, "audio_transcription"),
            LLMOperationType::AudioGeneration => write!(f, "audio_generation"),
            LLMOperationType::Moderation => write!(f, "moderation"),
            LLMOperationType::ToolUse => write!(f, "tool_use"),
        }
    }
}

/// Options for creating LLM spans
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LLMSpanOptions {
    pub provider: String,
    pub model: String,
    pub operation: LLMOperationType,
    pub prompt_tokens: Option<u32>,
    pub completion_tokens: Option<u32>,
    pub total_tokens: Option<u32>,
    pub temperature: Option<f64>,
    pub top_p: Option<f64>,
    pub max_tokens: Option<u32>,
    pub stream: Option<bool>,
    pub tools: Option<String>,
    pub tool_calls: Option<String>,
    pub duration_ms: Option<u64>,
    pub cost_prompt: Option<f64>,
    pub cost_completion: Option<f64>,
    pub cost_total: Option<f64>,
    pub error: Option<String>,
    pub error_type: Option<String>,
    pub request_id: Option<String>,
    pub usage_reason: Option<String>,
    pub attributes: HashMap<String, String>,
}

impl Default for LLMSpanOptions {
    fn default() -> Self {
        Self {
            provider: String::new(),
            model: String::new(),
            operation: LLMOperationType::Chat,
            prompt_tokens: None,
            completion_tokens: None,
            total_tokens: None,
            temperature: None,
            top_p: None,
            max_tokens: None,
            stream: None,
            tools: None,
            tool_calls: None,
            duration_ms: None,
            cost_prompt: None,
            cost_completion: None,
            cost_total: None,
            error: None,
            error_type: None,
            request_id: None,
            usage_reason: None,
            attributes: HashMap::new(),
        }
    }
}

/// Options for creating workflows
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowOptions {
    pub user_id: Option<String>,
    pub session_id: Option<String>,
    pub version: Option<String>,
    pub parent_id: Option<String>,
    pub metadata: HashMap<String, String>,
}

impl Default for WorkflowOptions {
    fn default() -> Self {
        Self {
            user_id: None,
            session_id: None,
            version: None,
            parent_id: None,
            metadata: HashMap::new(),
        }
    }
}

/// Token usage information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenUsage {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
    pub model: String,
    pub provider: String,
}

/// Cost information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Cost {
    pub prompt: f64,
    pub completion: f64,
    pub total: f64,
    pub currency: String,
    pub model: String,
    pub provider: String,
}

/// Options for creating spans
#[derive(Debug, Clone)]
pub struct SpanOptions {
    pub name: String,
    pub kind: SpanKind,
    pub attributes: HashMap<String, String>,
}

impl Default for SpanOptions {
    fn default() -> Self {
        Self {
            name: String::new(),
            kind: SpanKind::Internal,
            attributes: HashMap::new(),
        }
    }
}

/// Workflow context
#[derive(Debug, Clone)]
pub struct Workflow {
    pub id: String,
    pub name: String,
    pub run_id: String,
    pub user_id: Option<String>,
    pub session_id: Option<String>,
    pub version: Option<String>,
    pub parent_id: Option<String>,
    pub metadata: HashMap<String, String>,
    pub start_time: chrono::DateTime<chrono::Utc>,
}

impl Workflow {
    /// Create a new workflow
    pub fn new(name: String, run_id: String, options: WorkflowOptions) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            name,
            run_id,
            user_id: options.user_id,
            session_id: options.session_id,
            version: options.version,
            parent_id: options.parent_id,
            metadata: options.metadata,
            start_time: chrono::Utc::now(),
        }
    }

    /// Get the duration since the workflow started
    pub fn duration(&self) -> chrono::Duration {
        chrono::Utc::now() - self.start_time
    }
}

/// Provider information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Provider {
    pub name: String,
    pub version: String,
    pub enabled: bool,
}

/// Instrumentation configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstrumentationConfig {
    pub providers: Vec<Provider>,
    pub auto_instrument: bool,
    pub capture_body: bool,
    pub capture_errors: bool,
}

impl Default for InstrumentationConfig {
    fn default() -> Self {
        Self {
            providers: vec![],
            auto_instrument: true,
            capture_body: true,
            capture_errors: true,
        }
    }
}
