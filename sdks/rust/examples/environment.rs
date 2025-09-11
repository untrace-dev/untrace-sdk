//! Environment-based configuration example for the Untrace Rust SDK

use untrace::{init_from_env, Span};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Set up environment variables (in a real app, these would be set externally)
    std::env::set_var("UNTRACE_API_KEY", "your-api-key");
    std::env::set_var("UNTRACE_SERVICE_NAME", "my-rust-app");
    std::env::set_var("UNTRACE_SERVICE_VERSION", "1.0.0");
    std::env::set_var("UNTRACE_ENVIRONMENT", "production");
    std::env::set_var("UNTRACE_DEBUG", "true");
    std::env::set_var("UNTRACE_SAMPLING_RATE", "0.5");

    // Initialize from environment
    let untrace = init_from_env().await?;

    println!("Untrace SDK initialized from environment variables");
    println!("Service: {} v{}", untrace.config().service_name, untrace.config().service_version);
    println!("Environment: {}", untrace.config().environment);
    println!("Debug: {}", untrace.config().debug);
    println!("Sampling rate: {}", untrace.config().sampling_rate);

    // Create a span
    let mut span = untrace.tracer().start_span("environment-example");
    println!("Created span: {}", span.span_context().span_id());

    // Simulate some work
    tokio::time::sleep(std::time::Duration::from_millis(200)).await;

    span.end();

    // Shutdown
    untrace.shutdown().await?;

    println!("Environment example completed successfully!");
    Ok(())
}
