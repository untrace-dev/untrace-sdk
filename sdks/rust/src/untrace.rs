//! Main Untrace SDK implementation

use crate::client::UntraceClient;
use crate::config::Config;
use crate::context::UntraceContext;
use crate::error::{UntraceError, UntraceResult};
use crate::instrumentation::Instrumentation;
use crate::metrics::UntraceMetrics;
use crate::provider::{ProviderRegistry, register_default_providers};
use crate::tracer::UntraceTracer;
use opentelemetry::global;
use opentelemetry::trace::TracerProvider;
use opentelemetry::KeyValue;
use opentelemetry_semantic_conventions::resource::SERVICE_NAME;
use std::sync::{Arc, OnceLock};
use tracing::{debug, info, warn};

/// Global Untrace instance
static GLOBAL_INSTANCE: OnceLock<Untrace> = OnceLock::new();

/// Main Untrace SDK struct
#[derive(Debug)]
pub struct Untrace {
    client: UntraceClient,
    instrumentation: Instrumentation,
    provider_registry: ProviderRegistry,
    config: Arc<Config>,
}

impl Untrace {
    /// Initialize the Untrace SDK
    pub async fn init(config: Config) -> UntraceResult<Self> {
        // Validate configuration
        config.validate()?;

        // Set up logging if debug is enabled
        if config.debug {
            tracing_subscriber::fmt()
                .with_env_filter("untrace=debug")
                .init();
            info!("Untrace SDK initialized with debug logging enabled");
        }

        // Create resource
        let mut resource_attributes = vec![
            KeyValue::new(SERVICE_NAME.to_string(), config.service_name.clone()),
            KeyValue::new("service.version", config.service_version.clone()),
            KeyValue::new("service.environment", config.environment.clone()),
        ];

        // Add custom resource attributes
        for (key, value) in &config.resource_attributes {
            resource_attributes.push(KeyValue::new(key.clone(), value.clone()));
        }

        // Set up OpenTelemetry
        let tracer = global::tracer("untrace-sdk");
        let untrace_tracer = Arc::new(UntraceTracer::new(tracer));

        // Create metrics
        let meter = global::meter("untrace-sdk");
        let metrics = Arc::new(UntraceMetrics::new(meter));

        // Create context
        let context = Arc::new(UntraceContext::new());

        // Create client
        let client = UntraceClient::new(untrace_tracer, metrics, context);

        // Create instrumentation
        let mut instrumentation = Instrumentation::new(Default::default());

        // Create provider registry
        let mut provider_registry = ProviderRegistry::new();
        register_default_providers(&mut provider_registry);

        // Enable instrumentation if not disabled
        if !config.disable_auto_instrumentation {
            instrumentation.enable()?;
        }

        let untrace = Self {
            client,
            instrumentation,
            provider_registry,
            config: Arc::new(config),
        };

        // Set global instance
        GLOBAL_INSTANCE.set(untrace.clone()).map_err(|_| {
            UntraceError::initialization("Failed to set global Untrace instance")
        })?;

        info!("Untrace SDK initialized successfully");
        Ok(untrace)
    }

    /// Initialize from environment variables
    pub async fn init_from_env() -> UntraceResult<Self> {
        let config = Config::from_env()?;
        Self::init(config).await
    }

    /// Get the global instance
    pub fn get_instance() -> Option<Self> {
        GLOBAL_INSTANCE.get().cloned()
    }

    /// Get the client
    pub fn client(&self) -> &UntraceClient {
        &self.client
    }

    /// Get the tracer
    pub fn tracer(&self) -> &UntraceTracer {
        self.client.tracer()
    }

    /// Get the metrics
    pub fn metrics(&self) -> &UntraceMetrics {
        self.client.metrics()
    }

    /// Get the context
    pub fn context(&self) -> &UntraceContext {
        self.client.context()
    }

    /// Get the instrumentation
    pub fn instrumentation(&self) -> &Instrumentation {
        &self.instrumentation
    }

    /// Get the provider registry
    pub fn provider_registry(&self) -> &ProviderRegistry {
        &self.provider_registry
    }

    /// Get the configuration
    pub fn config(&self) -> &Config {
        &self.config
    }

    /// Shutdown the SDK
    pub async fn shutdown(&self) -> UntraceResult<()> {
        info!("Shutting down Untrace SDK");

        // Disable instrumentation
        if self.instrumentation.is_enabled() {
            // Note: We can't mutate self here, so we'll just log
            warn!("Instrumentation is still enabled during shutdown");
        }

        // Shutdown client
        self.client.shutdown().await?;

        debug!("Untrace SDK shutdown complete");
        Ok(())
    }

    /// Flush any pending data
    pub async fn flush(&self) -> UntraceResult<()> {
        self.client.flush().await
    }
}

impl Clone for Untrace {
    fn clone(&self) -> Self {
        Self {
            client: self.client.clone(),
            instrumentation: self.instrumentation.clone(),
            provider_registry: self.provider_registry.clone(),
            config: Arc::clone(&self.config),
        }
    }
}