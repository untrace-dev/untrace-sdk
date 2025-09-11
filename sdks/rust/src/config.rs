//! Configuration types for the Untrace SDK

use crate::error::{UntraceError, UntraceResult};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Duration;

/// Configuration for the Untrace SDK
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    /// API key for authentication
    pub api_key: String,

    /// Base URL for the Untrace API
    pub base_url: String,

    /// Service name for identification
    pub service_name: String,

    /// Service version
    pub service_version: String,

    /// Environment (e.g., "production", "development")
    pub environment: String,

    /// Whether to enable debug logging
    pub debug: bool,

    /// Sampling rate (0.0 to 1.0)
    pub sampling_rate: f64,

    /// Maximum batch size for span export
    pub max_batch_size: usize,

    /// Export interval
    pub export_interval: Duration,

    /// Additional headers to include in requests
    pub headers: HashMap<String, String>,

    /// Resource attributes
    pub resource_attributes: HashMap<String, String>,

    /// Whether to capture request/response bodies
    pub capture_body: bool,

    /// Whether to capture errors
    pub capture_errors: bool,

    /// Whether to disable auto-instrumentation
    pub disable_auto_instrumentation: bool,

    /// List of providers to instrument
    pub providers: Vec<String>,
}

impl Config {
    /// Create a new configuration with the given API key
    pub fn new(api_key: String) -> Self {
        Self {
            api_key,
            base_url: "https://untrace.dev".to_string(),
            service_name: "untrace-app".to_string(),
            service_version: "0.1.0".to_string(),
            environment: "production".to_string(),
            debug: false,
            sampling_rate: 1.0,
            max_batch_size: 512,
            export_interval: Duration::from_secs(5),
            headers: HashMap::new(),
            resource_attributes: HashMap::new(),
            capture_body: true,
            capture_errors: true,
            disable_auto_instrumentation: false,
            providers: vec!["all".to_string()],
        }
    }

    /// Create a configuration from environment variables
    pub fn from_env() -> UntraceResult<Self> {
        let api_key = std::env::var("UNTRACE_API_KEY").map_err(|_| {
            UntraceError::config("UNTRACE_API_KEY environment variable is required")
        })?;

        let mut config = Self::new(api_key);

        if let Ok(base_url) = std::env::var("UNTRACE_BASE_URL") {
            config.base_url = base_url;
        }

        if let Ok(service_name) = std::env::var("UNTRACE_SERVICE_NAME") {
            config.service_name = service_name;
        }

        if let Ok(service_version) = std::env::var("UNTRACE_SERVICE_VERSION") {
            config.service_version = service_version;
        }

        if let Ok(environment) = std::env::var("UNTRACE_ENVIRONMENT") {
            config.environment = environment;
        }

        if let Ok(debug) = std::env::var("UNTRACE_DEBUG") {
            config.debug = debug.parse().unwrap_or(false);
        }

        if let Ok(sampling_rate) = std::env::var("UNTRACE_SAMPLING_RATE") {
            config.sampling_rate = sampling_rate.parse().unwrap_or(1.0);
        }

        if let Ok(max_batch_size) = std::env::var("UNTRACE_MAX_BATCH_SIZE") {
            config.max_batch_size = max_batch_size.parse().unwrap_or(512);
        }

        if let Ok(export_interval) = std::env::var("UNTRACE_EXPORT_INTERVAL") {
            config.export_interval = Duration::from_secs(export_interval.parse().unwrap_or(5));
        }

        if let Ok(capture_body) = std::env::var("UNTRACE_CAPTURE_BODY") {
            config.capture_body = capture_body.parse().unwrap_or(true);
        }

        if let Ok(capture_errors) = std::env::var("UNTRACE_CAPTURE_ERRORS") {
            config.capture_errors = capture_errors.parse().unwrap_or(true);
        }

        if let Ok(disable_auto_instrumentation) =
            std::env::var("UNTRACE_DISABLE_AUTO_INSTRUMENTATION")
        {
            config.disable_auto_instrumentation =
                disable_auto_instrumentation.parse().unwrap_or(false);
        }

        if let Ok(providers) = std::env::var("UNTRACE_PROVIDERS") {
            config.providers = providers.split(',').map(|s| s.trim().to_string()).collect();
        }

        Ok(config)
    }

    /// Validate the configuration
    pub fn validate(&self) -> UntraceResult<()> {
        if self.api_key.is_empty() {
            return Err(UntraceError::validation("API key cannot be empty"));
        }

        if self.sampling_rate < 0.0 || self.sampling_rate > 1.0 {
            return Err(UntraceError::validation(
                "Sampling rate must be between 0.0 and 1.0",
            ));
        }

        if self.max_batch_size == 0 {
            return Err(UntraceError::validation(
                "Max batch size must be greater than 0",
            ));
        }

        if self.export_interval.is_zero() {
            return Err(UntraceError::validation(
                "Export interval must be greater than 0",
            ));
        }

        Ok(())
    }

    /// Set the service name
    pub fn with_service_name(mut self, service_name: String) -> Self {
        self.service_name = service_name;
        self
    }

    /// Set the service version
    pub fn with_service_version(mut self, service_version: String) -> Self {
        self.service_version = service_version;
        self
    }

    /// Set the environment
    pub fn with_environment(mut self, environment: String) -> Self {
        self.environment = environment;
        self
    }

    /// Set debug mode
    pub fn with_debug(mut self, debug: bool) -> Self {
        self.debug = debug;
        self
    }

    /// Set the sampling rate
    pub fn with_sampling_rate(mut self, sampling_rate: f64) -> Self {
        self.sampling_rate = sampling_rate;
        self
    }

    /// Set the base URL
    pub fn with_base_url(mut self, base_url: String) -> Self {
        self.base_url = base_url;
        self
    }

    /// Add a header
    pub fn with_header(mut self, key: String, value: String) -> Self {
        self.headers.insert(key, value);
        self
    }

    /// Add a resource attribute
    pub fn with_resource_attribute(mut self, key: String, value: String) -> Self {
        self.resource_attributes.insert(key, value);
        self
    }

    /// Set providers to instrument
    pub fn with_providers(mut self, providers: Vec<String>) -> Self {
        self.providers = providers;
        self
    }
}
