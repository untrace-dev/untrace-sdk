//! Instrumentation example for the Untrace Rust SDK

use untrace::{init, Config, WorkflowOptions, Span};
use std::collections::HashMap;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize the SDK
    let config = Config::new("your-api-key".to_string())
        .with_service_name("instrumentation-example".to_string())
        .with_debug(true);

    let untrace = init(config).await?;

    // Check instrumentation status
    println!("Instrumentation enabled: {}", untrace.instrumentation().is_enabled());

    // Check available providers
    let providers = untrace.provider_registry().get_all();
    println!("Available providers:");
    for provider in providers {
        println!("  - {} v{} (enabled: {})",
                provider.name, provider.version, provider.enabled);
    }

    // Create a workflow
    let mut metadata = HashMap::new();
    metadata.insert("user_id".to_string(), "user123".to_string());
    metadata.insert("session_id".to_string(), "session456".to_string());

    let workflow_options = WorkflowOptions {
        user_id: Some("user123".to_string()),
        session_id: Some("session456".to_string()),
        version: Some("1.0.0".to_string()),
        parent_id: None,
        metadata,
    };

    let workflow = untrace.context().start_workflow(
        "my-workflow".to_string(),
        untrace.context().generate_run_id(),
        workflow_options,
    )?;

    println!("Created workflow: {} (run_id: {})", workflow.name, workflow.run_id);

    // Create a workflow span
    let mut workflow_span = untrace.tracer().start_workflow_span(&workflow);
    println!("Created workflow span: {}", workflow_span.span_context().span_id());

    // Simulate workflow processing
    tokio::time::sleep(std::time::Duration::from_millis(300)).await;

    workflow_span.end();

    // End the workflow
    untrace.context().end_current_workflow()?;

    // Shutdown
    untrace.shutdown().await?;

    println!("Instrumentation example completed successfully!");
    Ok(())
}
