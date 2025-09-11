//! Client implementation for the Untrace SDK

use crate::context::UntraceContext;
use crate::error::UntraceResult;
use crate::metrics::UntraceMetrics;
use crate::tracer::UntraceTracer;
use std::sync::Arc;

/// Untrace client interface
#[derive(Debug)]
pub struct UntraceClient {
    tracer: Arc<UntraceTracer>,
    metrics: Arc<UntraceMetrics>,
    context: Arc<UntraceContext>,
}

impl UntraceClient {
    /// Create a new Untrace client
    pub fn new(
        tracer: Arc<UntraceTracer>,
        metrics: Arc<UntraceMetrics>,
        context: Arc<UntraceContext>,
    ) -> Self {
        Self {
            tracer,
            metrics,
            context,
        }
    }

    /// Get the tracer
    pub fn tracer(&self) -> &Arc<UntraceTracer> {
        &self.tracer
    }

    /// Get the metrics
    pub fn metrics(&self) -> &Arc<UntraceMetrics> {
        &self.metrics
    }

    /// Get the context
    pub fn context(&self) -> &Arc<UntraceContext> {
        &self.context
    }

    /// Shutdown the client
    pub async fn shutdown(&self) -> UntraceResult<()> {
        // In a real implementation, this would flush any pending data
        // and clean up resources
        tracing::info!("Untrace client shutdown");
        Ok(())
    }

    /// Flush any pending data
    pub async fn flush(&self) -> UntraceResult<()> {
        // In a real implementation, this would flush any pending spans/metrics
        tracing::debug!("Flushing Untrace client data");
        Ok(())
    }
}

impl Clone for UntraceClient {
    fn clone(&self) -> Self {
        Self {
            tracer: Arc::clone(&self.tracer),
            metrics: Arc::clone(&self.metrics),
            context: Arc::clone(&self.context),
        }
    }
}