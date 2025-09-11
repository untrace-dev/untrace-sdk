//! Tracer implementation for the Untrace SDK

use crate::attributes::helpers;
use crate::types::{LLMSpanOptions, SpanOptions, Workflow};
use opentelemetry::trace::{Span, SpanKind, Tracer as OtelTracer};
use opentelemetry::KeyValue;
use std::collections::HashMap;

/// Untrace tracer wrapper
#[derive(Debug)]
pub struct UntraceTracer {
    tracer: opentelemetry::global::BoxedTracer,
}

impl UntraceTracer {
    /// Create a new Untrace tracer
    pub fn new(tracer: opentelemetry::global::BoxedTracer) -> Self {
        Self { tracer }
    }

    /// Start a new span
    pub fn start_span(&self, name: &str) -> opentelemetry::global::BoxedSpan {
        self.tracer.start(name.to_string())
    }

    /// Start a new span with options
    pub fn start_span_with_options(
        &self,
        options: SpanOptions,
    ) -> opentelemetry::global::BoxedSpan {
        let mut span = self.tracer.start(options.name.clone());

        // Note: Span kind setting is not available on BoxedSpan
        // span.set_span_kind(options.kind);

        // Add attributes
        for (key, value) in options.attributes {
            span.set_attribute(KeyValue::new(key, value));
        }

        span
    }

    /// Start an LLM span
    pub fn start_llm_span(
        &self,
        name: &str,
        options: LLMSpanOptions,
    ) -> opentelemetry::global::BoxedSpan {
        let mut span = self.tracer.start(name.to_string());

        // Note: Span kind setting is not available on BoxedSpan
        // span.set_span_kind(SpanKind::Client);

        // Add LLM-specific attributes
        span.set_attribute(helpers::string("llm.provider", &options.provider));
        span.set_attribute(helpers::string("llm.model", &options.model));
        span.set_attribute(helpers::string(
            "llm.operation",
            &options.operation.to_string(),
        ));

        if let Some(prompt_tokens) = options.prompt_tokens {
            span.set_attribute(helpers::int("llm.prompt_tokens", prompt_tokens as i64));
        }

        if let Some(completion_tokens) = options.completion_tokens {
            span.set_attribute(helpers::int(
                "llm.completion_tokens",
                completion_tokens as i64,
            ));
        }

        if let Some(total_tokens) = options.total_tokens {
            span.set_attribute(helpers::int("llm.total_tokens", total_tokens as i64));
        }

        if let Some(temperature) = options.temperature {
            span.set_attribute(helpers::float("llm.temperature", temperature));
        }

        if let Some(top_p) = options.top_p {
            span.set_attribute(helpers::float("llm.top_p", top_p));
        }

        if let Some(max_tokens) = options.max_tokens {
            span.set_attribute(helpers::int("llm.max_tokens", max_tokens as i64));
        }

        if let Some(stream) = options.stream {
            span.set_attribute(helpers::bool("llm.stream", stream));
        }

        if let Some(tools) = options.tools {
            span.set_attribute(helpers::string("llm.tools", &tools));
        }

        if let Some(tool_calls) = options.tool_calls {
            span.set_attribute(helpers::string("llm.tool_calls", &tool_calls));
        }

        if let Some(duration_ms) = options.duration_ms {
            span.set_attribute(helpers::int("llm.duration_ms", duration_ms as i64));
        }

        if let Some(cost_prompt) = options.cost_prompt {
            span.set_attribute(helpers::float("llm.cost_prompt", cost_prompt));
        }

        if let Some(cost_completion) = options.cost_completion {
            span.set_attribute(helpers::float("llm.cost_completion", cost_completion));
        }

        if let Some(cost_total) = options.cost_total {
            span.set_attribute(helpers::float("llm.cost_total", cost_total));
        }

        if let Some(error) = options.error {
            span.set_attribute(helpers::string("llm.error", &error));
        }

        if let Some(error_type) = options.error_type {
            span.set_attribute(helpers::string("llm.error_type", &error_type));
        }

        if let Some(request_id) = options.request_id {
            span.set_attribute(helpers::string("llm.request_id", &request_id));
        }

        if let Some(usage_reason) = options.usage_reason {
            span.set_attribute(helpers::string("llm.usage_reason", &usage_reason));
        }

        // Add custom attributes
        for (key, value) in options.attributes {
            span.set_attribute(KeyValue::new(key, value));
        }

        span
    }

    /// Start a workflow span
    pub fn start_workflow_span(&self, workflow: &Workflow) -> opentelemetry::global::BoxedSpan {
        let mut span = self.tracer.start(workflow.name.clone());

        // Note: Span kind setting is not available on BoxedSpan
        // span.set_span_kind(SpanKind::Internal);

        // Add workflow attributes
        span.set_attribute(helpers::string("workflow.id", &workflow.id));
        span.set_attribute(helpers::string("workflow.name", &workflow.name));
        span.set_attribute(helpers::string("workflow.run_id", &workflow.run_id));

        if let Some(user_id) = &workflow.user_id {
            span.set_attribute(helpers::string("workflow.user_id", user_id));
        }

        if let Some(session_id) = &workflow.session_id {
            span.set_attribute(helpers::string("workflow.session_id", session_id));
        }

        if let Some(version) = &workflow.version {
            span.set_attribute(helpers::string("workflow.version", version));
        }

        if let Some(parent_id) = &workflow.parent_id {
            span.set_attribute(helpers::string("workflow.parent_id", parent_id));
        }

        // Add metadata as attributes
        for (key, value) in &workflow.metadata {
            span.set_attribute(KeyValue::new(
                format!("workflow.metadata.{}", key),
                value.clone(),
            ));
        }

        span
    }

    /// Get the underlying OpenTelemetry tracer
    pub fn get_tracer(&self) -> &opentelemetry::global::BoxedTracer {
        &self.tracer
    }
}

impl Clone for UntraceTracer {
    fn clone(&self) -> Self {
        Self {
            tracer: opentelemetry::global::tracer("untrace-sdk"),
        }
    }
}
