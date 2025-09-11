# Untrace Go SDK Examples

This directory contains examples demonstrating how to use the Untrace Go SDK.

## Examples

### Basic Usage (`basic/main.go`)

Demonstrates the basic functionality of the SDK:
- Initializing the SDK
- Creating LLM spans
- Workflow tracking
- Metrics recording
- Custom spans

```bash
cd basic
go run main.go
```

### Instrumentation (`instrumentation/main.go`)

Shows how to use the instrumentation helpers:
- Function tracing
- LLM call tracing
- HTTP request tracing
- Database query tracing
- Workflow tracing
- Provider instrumentation

```bash
cd instrumentation
go run main.go
```

### Environment Configuration (`environment/main.go`)

Demonstrates how to initialize the SDK using environment variables:
- Loading configuration from environment
- Setting up different environments
- Debugging configuration

```bash
cd environment
go run main.go
```

## Running the Examples

1. Make sure you have Go 1.21 or later installed
2. Set your API key in the examples or as an environment variable
3. Run the examples:

```bash
# Basic example
cd basic && go run main.go

# Instrumentation example
cd instrumentation && go run main.go

# Environment example
cd environment && go run main.go
```

## Configuration

All examples use a placeholder API key. Replace `"your-api-key-here"` with your actual Untrace API key, or set the `UNTRACE_API_KEY` environment variable.

## Expected Output

The examples will create traces and send them to the Untrace platform. You should see:
- Debug messages about SDK initialization
- Span creation and completion messages
- Metrics recording
- Successful completion messages

Check your Untrace dashboard to see the traces and metrics.
