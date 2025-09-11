//! Metrics collection for the Untrace SDK

use crate::error::UntraceResult;
use crate::types::{Cost, TokenUsage};
use opentelemetry::metrics::{Counter, Histogram, Meter, MeterProvider};
use opentelemetry::KeyValue;
use std::collections::HashMap;
use std::time::Duration;

/// Untrace metrics implementation
#[derive(Debug)]
pub struct UntraceMetrics {
    meter: Meter,
    token_usage_counter: Counter<u64>,
    cost_counter: Counter<f64>,
    latency_histogram: Histogram<f64>,
    error_counter: Counter<u64>,
}

impl UntraceMetrics {
    /// Create new metrics
    pub fn new(meter: Meter) -> Self {
        let token_usage_counter = meter
            .u64_counter("untrace.token_usage")
            .with_description("Total token usage")
            .init();

        let cost_counter = meter
            .f64_counter("untrace.cost")
            .with_description("Total cost")
            .init();

        let latency_histogram = meter
            .f64_histogram("untrace.latency")
            .with_description("Operation latency")
            .init();

        let error_counter = meter
            .u64_counter("untrace.errors")
            .with_description("Total errors")
            .init();

        Self {
            meter,
            token_usage_counter,
            cost_counter,
            latency_histogram,
            error_counter,
        }
    }

    /// Record token usage
    pub fn record_token_usage(&self, usage: TokenUsage) -> UntraceResult<()> {
        let attributes = vec![
            KeyValue::new("provider", usage.provider),
            KeyValue::new("model", usage.model),
        ];

        self.token_usage_counter.add(usage.total_tokens as u64, &attributes);
        Ok(())
    }

    /// Record cost
    pub fn record_cost(&self, cost: Cost) -> UntraceResult<()> {
        let attributes = vec![
            KeyValue::new("provider", cost.provider),
            KeyValue::new("model", cost.model),
            KeyValue::new("currency", cost.currency),
        ];

        self.cost_counter.add(cost.total, &attributes);
        Ok(())
    }

    /// Record latency
    pub fn record_latency(&self, duration: Duration, attributes: HashMap<String, String>) -> UntraceResult<()> {
        let latency_ms = duration.as_millis() as f64;
        let otel_attributes: Vec<KeyValue> = attributes
            .into_iter()
            .map(|(k, v)| KeyValue::new(k, v))
            .collect();

        self.latency_histogram.record(latency_ms, &otel_attributes);
        Ok(())
    }

    /// Record an error
    pub fn record_error(&self, error_type: &str, attributes: HashMap<String, String>) -> UntraceResult<()> {
        let mut otel_attributes = vec![KeyValue::new("error_type", error_type.to_string())];
        otel_attributes.extend(
            attributes
                .into_iter()
                .map(|(k, v)| KeyValue::new(k, v))
        );

        self.error_counter.add(1, &otel_attributes);
        Ok(())
    }

    /// Get the underlying meter
    pub fn get_meter(&self) -> &Meter {
        &self.meter
    }
}

impl Clone for UntraceMetrics {
    fn clone(&self) -> Self {
        Self {
            meter: self.meter.clone(),
            token_usage_counter: self.token_usage_counter.clone(),
            cost_counter: self.cost_counter.clone(),
            latency_histogram: self.latency_histogram.clone(),
            error_counter: self.error_counter.clone(),
        }
    }
}
