//! Basic usage example for the Untrace Rust SDK

use untrace::{init, Config, LLMOperationType, LLMSpanOptions, Span};
use std::time::Duration;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize the SDK
    let config = Config::new("your-api-key".to_string())
        .with_service_name("my-rust-app".to_string())
        .with_service_version("1.0.0".to_string())
        .with_environment("development".to_string())
        .with_debug(true);

    let untrace = init(config).await?;

    // Create a simple span
    let mut span = untrace.tracer().start_span("my-operation");
    println!("Created span: {}", span.span_context().span_id());

    // Simulate some work
    tokio::time::sleep(Duration::from_millis(100)).await;

    span.end();

    // Create an LLM span
    let llm_options = LLMSpanOptions {
        provider: "openai".to_string(),
        model: "gpt-4".to_string(),
        operation: LLMOperationType::Chat,
        prompt_tokens: Some(100),
        completion_tokens: Some(50),
        total_tokens: Some(150),
        temperature: Some(0.7),
        ..Default::default()
    };

    let mut llm_span = untrace.tracer().start_llm_span("llm-chat", llm_options);
    println!("Created LLM span: {}", llm_span.span_context().span_id());

    // Simulate LLM processing
    tokio::time::sleep(Duration::from_millis(500)).await;

    llm_span.end();

    // Record some metrics
    let token_usage = untrace::TokenUsage {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150,
        model: "gpt-4".to_string(),
        provider: "openai".to_string(),
    };
    untrace.metrics().record_token_usage(token_usage)?;

    let cost = untrace::Cost {
        prompt: 0.01,
        completion: 0.02,
        total: 0.03,
        currency: "USD".to_string(),
        model: "gpt-4".to_string(),
        provider: "openai".to_string(),
    };
    untrace.metrics().record_cost(cost)?;

    // Flush and shutdown
    untrace.flush().await?;
    untrace.shutdown().await?;

    println!("Example completed successfully!");
    Ok(())
}
