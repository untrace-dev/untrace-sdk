//! # Untrace SDK for Rust
//!
//! LLM observability and tracing SDK for Rust applications.
//!
//! ## Features
//!
//! - OpenTelemetry-based tracing
//! - Custom span creation and management
//! - Metrics collection
//! - Workflow tracking
//! - Error handling and reporting
//!
//! ## Quick Start
//!
//! ```rust
//! use untrace::{Untrace, Config, Span};
//!
//! #[tokio::main]
//! async fn main() -> Result<(), Box<dyn std::error::Error>> {
//!     // Initialize the SDK
//!     let config = Config::new("your-api-key".to_string());
//!     let untrace = Untrace::init(config).await?;
//!
//!     // Create a span
//!     let mut span = untrace.tracer().start_span("my-operation");
//!     // ... your code here ...
//!     span.end();
//!
//!     // Shutdown
//!     untrace.shutdown().await?;
//!     Ok(())
//! }
//! ```

pub mod attributes;
pub mod client;
pub mod config;
pub mod context;
pub mod error;
pub mod instrumentation;
pub mod metrics;
pub mod provider;
pub mod tracer;
pub mod types;
pub mod untrace;

// Re-export main types and functions
pub use crate::{
    attributes::*,
    client::UntraceClient,
    config::Config,
    context::UntraceContext,
    error::{UntraceError, UntraceResult},
    metrics::UntraceMetrics,
    tracer::UntraceTracer,
    types::*,
    untrace::Untrace,
};

// Re-export OpenTelemetry types for convenience
pub use opentelemetry::{
    trace::{Span, SpanKind, Tracer},
    Key, KeyValue,
};

/// Initialize the Untrace SDK with the given configuration
pub async fn init(config: Config) -> UntraceResult<Untrace> {
    Untrace::init(config).await
}

/// Initialize the Untrace SDK from environment variables
pub async fn init_from_env() -> UntraceResult<Untrace> {
    Untrace::init_from_env().await
}

/// Get the global Untrace instance
pub fn get_instance() -> Option<Untrace> {
    Untrace::get_instance()
}

/// Shutdown the global Untrace instance
pub async fn shutdown() -> UntraceResult<()> {
    if let Some(instance) = Untrace::get_instance() {
        instance.shutdown().await
    } else {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_creation() {
        let config = Config::new("test-api-key".to_string());
        assert_eq!(config.api_key, "test-api-key");
        assert_eq!(config.service_name, "untrace-app");
        assert_eq!(config.sampling_rate, 1.0);
    }

    #[test]
    fn test_config_validation() {
        let config = Config::new("".to_string());
        assert!(config.validate().is_err());

        let config = Config::new("valid-key".to_string());
        assert!(config.validate().is_ok());
    }

    #[test]
    fn test_llm_operation_type_display() {
        assert_eq!(LLMOperationType::Chat.to_string(), "chat");
        assert_eq!(LLMOperationType::Completion.to_string(), "completion");
        assert_eq!(LLMOperationType::Embedding.to_string(), "embedding");
    }

    #[test]
    fn test_workflow_creation() {
        let options = WorkflowOptions::default();
        let workflow = Workflow::new("test-workflow".to_string(), "run-123".to_string(), options);

        assert_eq!(workflow.name, "test-workflow");
        assert_eq!(workflow.run_id, "run-123");
        assert!(!workflow.id.is_empty());
    }

    #[test]
    fn test_provider_registry() {
        use crate::provider::ProviderRegistry;
        let mut registry = ProviderRegistry::new();
        let provider = Provider {
            name: "test-provider".to_string(),
            version: "1.0.0".to_string(),
            enabled: true,
        };

        registry.register(provider);
        assert!(registry.get("test-provider").is_some());
        assert!(registry.is_enabled("test-provider"));
    }

    #[test]
    fn test_attributes_helpers() {
        use attributes::helpers;

        let string_attr = helpers::string("test_key", "test_value");
        assert_eq!(string_attr.key.as_str(), "test_key");

        let int_attr = helpers::int("test_int", 42);
        assert_eq!(int_attr.key.as_str(), "test_int");

        let bool_attr = helpers::bool("test_bool", true);
        assert_eq!(bool_attr.key.as_str(), "test_bool");
    }

    #[test]
    fn test_error_types() {
        let config_error = UntraceError::config("test error");
        assert!(matches!(config_error, UntraceError::Config { .. }));

        let validation_error = UntraceError::validation("test error");
        assert!(matches!(validation_error, UntraceError::Validation { .. }));

        let api_error = UntraceError::api("test error");
        assert!(matches!(api_error, UntraceError::Api { .. }));
    }
}