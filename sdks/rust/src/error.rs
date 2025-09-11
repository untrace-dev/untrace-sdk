//! Error types for the Untrace SDK

use thiserror::Error;

/// Result type alias for Untrace operations
pub type UntraceResult<T> = Result<T, UntraceError>;

/// Main error type for the Untrace SDK
#[derive(Error, Debug)]
pub enum UntraceError {
    #[error("Configuration error: {message}")]
    Config { message: String },

    #[error("API error: {message}")]
    Api { message: String },

    #[error("Validation error: {message}")]
    Validation { message: String },

    #[error("Initialization error: {message}")]
    Initialization { message: String },

    #[error("Export error: {message}")]
    Export { message: String },

    #[error("Instrumentation error: {message}")]
    Instrumentation { message: String },

    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("OpenTelemetry error: {0}")]
    OpenTelemetry(#[from] opentelemetry::trace::TraceError),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("URL parsing error: {0}")]
    Url(#[from] url::ParseError),

    #[error("Unknown error: {message}")]
    Unknown { message: String },
}

impl UntraceError {
    /// Create a new configuration error
    pub fn config<S: Into<String>>(message: S) -> Self {
        Self::Config {
            message: message.into(),
        }
    }

    /// Create a new API error
    pub fn api<S: Into<String>>(message: S) -> Self {
        Self::Api {
            message: message.into(),
        }
    }

    /// Create a new validation error
    pub fn validation<S: Into<String>>(message: S) -> Self {
        Self::Validation {
            message: message.into(),
        }
    }

    /// Create a new initialization error
    pub fn initialization<S: Into<String>>(message: S) -> Self {
        Self::Initialization {
            message: message.into(),
        }
    }

    /// Create a new export error
    pub fn export<S: Into<String>>(message: S) -> Self {
        Self::Export {
            message: message.into(),
        }
    }

    /// Create a new instrumentation error
    pub fn instrumentation<S: Into<String>>(message: S) -> Self {
        Self::Instrumentation {
            message: message.into(),
        }
    }

    /// Create a new unknown error
    pub fn unknown<S: Into<String>>(message: S) -> Self {
        Self::Unknown {
            message: message.into(),
        }
    }
}
