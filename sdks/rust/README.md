# Untrace SDK for Rust

LLM observability and tracing SDK for Rust applications.

## Features

- OpenTelemetry-based tracing
- Automatic instrumentation for LLM providers
- Custom span creation and management
- Metrics collection
- Workflow tracking
- Error handling and reporting

## Installation

Add this to your `Cargo.toml`:

```toml
[dependencies]
untrace-sdk = "0.1.2"
```

## Quick Start

```rust
use untrace::{init, Config};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize the SDK
    let config = Config::new("your-api-key".to_string());
    let untrace = init(config).await?;

    // Create a span
    let span = untrace.tracer().start_span("my-operation");
    // ... your code here ...
    span.end();

    // Shutdown
    untrace.shutdown().await?;
    Ok(())
}
```

## Configuration

### Basic Configuration

```rust
use untrace::Config;

let config = Config::new("your-api-key".to_string())
    .with_service_name("my-app".to_string())
    .with_service_version("1.0.0".to_string())
    .with_environment("production".to_string())
    .with_debug(true);
```

### Environment Variables

You can also configure the SDK using environment variables:

```bash
export UNTRACE_API_KEY="your-api-key"
export UNTRACE_SERVICE_NAME="my-app"
export UNTRACE_SERVICE_VERSION="1.0.0"
export UNTRACE_ENVIRONMENT="production"
export UNTRACE_DEBUG="true"
export UNTRACE_SAMPLING_RATE="0.5"
```

Then initialize with:

```rust
use untrace::init_from_env;

let untrace = init_from_env().await?;
```

## Tracing

### Basic Spans

```rust
let span = untrace.tracer().start_span("my-operation");
// ... your code here ...
span.end();
```

### LLM Spans

```rust
use untrace::{LLMSpanOptions, LLMOperationType};

let options = LLMSpanOptions {
    provider: "openai".to_string(),
    model: "gpt-4".to_string(),
    operation: LLMOperationType::Chat,
    prompt_tokens: Some(100),
    completion_tokens: Some(50),
    total_tokens: Some(150),
    temperature: Some(0.7),
    ..Default::default()
};

let span = untrace.tracer().start_llm_span("llm-chat", options);
// ... your LLM code here ...
span.end();
```

### Workflows

```rust
use untrace::{WorkflowOptions};
use std::collections::HashMap;

let mut metadata = HashMap::new();
metadata.insert("user_id".to_string(), "user123".to_string());

let options = WorkflowOptions {
    user_id: Some("user123".to_string()),
    session_id: Some("session456".to_string()),
    version: Some("1.0.0".to_string()),
    parent_id: None,
    metadata,
};

let workflow = untrace.context().start_workflow(
    "my-workflow".to_string(),
    untrace.context().generate_run_id(),
    options,
)?;

// Create a workflow span
let span = untrace.tracer().start_workflow_span(&workflow);
// ... your workflow code here ...
span.end();

// End the workflow
untrace.context().end_current_workflow()?;
```

## Metrics

```rust
use untrace::{TokenUsage, Cost};

// Record token usage
let usage = TokenUsage {
    prompt_tokens: 100,
    completion_tokens: 50,
    total_tokens: 150,
    model: "gpt-4".to_string(),
    provider: "openai".to_string(),
};
untrace.metrics().record_token_usage(usage)?;

// Record cost
let cost = Cost {
    prompt: 0.01,
    completion: 0.02,
    total: 0.03,
    currency: "USD".to_string(),
    model: "gpt-4".to_string(),
    provider: "openai".to_string(),
};
untrace.metrics().record_cost(cost)?;

// Record latency
let duration = std::time::Duration::from_millis(500);
let mut attributes = HashMap::new();
attributes.insert("operation".to_string(), "llm_call".to_string());
untrace.metrics().record_latency(duration, attributes)?;
```

## Examples

See the `examples/` directory for more detailed examples:

- `basic.rs` - Basic usage
- `environment.rs` - Environment-based configuration
- `instrumentation.rs` - Instrumentation and workflows

Run an example:

```bash
cargo run --example basic
```

## License

MIT
