//! Instrumentation for the Untrace SDK

use crate::error::UntraceResult;
use crate::types::InstrumentationConfig;

/// Instrumentation manager
#[derive(Debug, Clone)]
pub struct Instrumentation {
    config: InstrumentationConfig,
    enabled: bool,
}

impl Instrumentation {
    /// Create new instrumentation
    pub fn new(config: InstrumentationConfig) -> Self {
        Self {
            config,
            enabled: false,
        }
    }

    /// Enable instrumentation
    pub fn enable(&mut self) -> UntraceResult<()> {
        if self.enabled {
            return Ok(());
        }

        // In a real implementation, this would set up actual instrumentation
        // for the various LLM providers
        tracing::info!("Enabling Untrace instrumentation");

        self.enabled = true;
        Ok(())
    }

    /// Disable instrumentation
    pub fn disable(&mut self) -> UntraceResult<()> {
        if !self.enabled {
            return Ok(());
        }

        // In a real implementation, this would remove instrumentation
        tracing::info!("Disabling Untrace instrumentation");

        self.enabled = false;
        Ok(())
    }

    /// Check if instrumentation is enabled
    pub fn is_enabled(&self) -> bool {
        self.enabled
    }

    /// Get the configuration
    pub fn config(&self) -> &InstrumentationConfig {
        &self.config
    }

    /// Update the configuration
    pub fn update_config(&mut self, config: InstrumentationConfig) {
        self.config = config;
    }
}

/// Create new instrumentation with default config
pub fn new_instrumentation() -> Instrumentation {
    Instrumentation::new(InstrumentationConfig::default())
}