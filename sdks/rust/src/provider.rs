//! Provider instrumentation for the Untrace SDK

use crate::error::{UntraceError, UntraceResult};
use crate::types::{InstrumentationConfig, Provider};
use std::collections::HashMap;

/// Provider registry for managing instrumentations
#[derive(Debug, Clone)]
pub struct ProviderRegistry {
    providers: HashMap<String, Provider>,
}

impl ProviderRegistry {
    /// Create a new provider registry
    pub fn new() -> Self {
        Self {
            providers: HashMap::new(),
        }
    }

    /// Register a provider
    pub fn register(&mut self, provider: Provider) {
        self.providers.insert(provider.name.clone(), provider);
    }

    /// Get a provider by name
    pub fn get(&self, name: &str) -> Option<&Provider> {
        self.providers.get(name)
    }

    /// Get all providers
    pub fn get_all(&self) -> Vec<&Provider> {
        self.providers.values().collect()
    }

    /// Get enabled providers
    pub fn get_enabled(&self) -> Vec<&Provider> {
        self.providers.values().filter(|p| p.enabled).collect()
    }

    /// Enable a provider
    pub fn enable(&mut self, name: &str) -> UntraceResult<()> {
        if let Some(provider) = self.providers.get_mut(name) {
            provider.enabled = true;
            Ok(())
        } else {
            Err(UntraceError::instrumentation(format!("Provider '{}' not found", name)))
        }
    }

    /// Disable a provider
    pub fn disable(&mut self, name: &str) -> UntraceResult<()> {
        if let Some(provider) = self.providers.get_mut(name) {
            provider.enabled = false;
            Ok(())
        } else {
            Err(UntraceError::instrumentation(format!("Provider '{}' not found", name)))
        }
    }

    /// Check if a provider is enabled
    pub fn is_enabled(&self, name: &str) -> bool {
        self.providers.get(name).map_or(false, |p| p.enabled)
    }
}

impl Default for ProviderRegistry {
    fn default() -> Self {
        Self::new()
    }
}

/// Get default providers
pub fn get_default_providers() -> Vec<Provider> {
    vec![
        Provider {
            name: "openai".to_string(),
            version: "1.0.0".to_string(),
            enabled: true,
        },
        Provider {
            name: "anthropic".to_string(),
            version: "1.0.0".to_string(),
            enabled: true,
        },
        Provider {
            name: "google".to_string(),
            version: "1.0.0".to_string(),
            enabled: true,
        },
        Provider {
            name: "microsoft".to_string(),
            version: "1.0.0".to_string(),
            enabled: true,
        },
        Provider {
            name: "aws".to_string(),
            version: "1.0.0".to_string(),
            enabled: true,
        },
        Provider {
            name: "cohere".to_string(),
            version: "1.0.0".to_string(),
            enabled: true,
        },
    ]
}

/// Register default providers
pub fn register_default_providers(registry: &mut ProviderRegistry) {
    for provider in get_default_providers() {
        registry.register(provider);
    }
}
