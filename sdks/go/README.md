# Untrace SDK for Go

LLM observability SDK for Go applications.

## Installation

```bash
go get github.com/untrace-dev/untrace-sdk-go
```

## Quick Start

```go
package main

import (
    "context"
    "log"

    "github.com/untrace-dev/untrace-sdk-go"
)

func main() {
    // Initialize the SDK
    client, err := untrace.Init(untrace.Config{
        APIKey: "your-api-key",
        ServiceName: "my-llm-app",
        Environment: "production",
    })
    if err != nil {
        log.Fatal(err)
    }
    defer client.Shutdown(context.Background())

    // Create a span for an LLM operation
    ctx, span := client.Tracer().StartLLMSpan(context.Background(), "chat-completion", untrace.LLMSpanOptions{
        Provider: "openai",
        Model: "gpt-3.5-turbo",
        Operation: "chat",
    })
    defer span.End()

    // Your LLM code here
    // The span will automatically capture timing and context
}
```

## Manual Instrumentation

```go
package main

import (
    "context"
    "log"

    "github.com/untrace-dev/untrace-sdk-go"
)

func main() {
    client, err := untrace.Init(untrace.Config{
        APIKey: "your-api-key",
        ServiceName: "my-api",
    })
    if err != nil {
        log.Fatal(err)
    }
    defer client.Shutdown(context.Background())

    // Create custom spans for your LLM workflows
    ctx, span := client.Tracer().StartLLMSpan(context.Background(), "custom-llm-call", untrace.LLMSpanOptions{
        Provider: "custom",
        Model: "my-model",
        Operation: "chat",
    })
    defer span.End()

    // Add custom attributes
    span.SetAttributes(
        untrace.String("custom.metric", "42"),
        untrace.Int("llm.prompt.tokens", 100),
    )

    // Your LLM logic here
}
```

## Configuration Options

```go
type Config struct {
    // Required
    APIKey string

    // Optional
    ServiceName    string
    Environment    string
    Version        string
    BaseURL        string
    Debug          bool
    SamplingRate   float64
    MaxBatchSize   int
    ExportInterval time.Duration
    Headers        map[string]string
    ResourceAttributes map[string]interface{}
}
```

## Supported Providers

### AI/LLM Providers
- ✅ OpenAI
- ✅ Anthropic (Claude)
- ✅ Cohere
- ✅ Mistral
- ✅ AWS Bedrock
- ✅ Google Vertex AI
- ✅ Azure OpenAI

### Framework Support
- ✅ Custom instrumentation support

## Advanced Usage

### Workflow Tracking

```go
// Start a workflow
workflow := client.Context().StartWorkflow("customer-support-chat", untrace.WorkflowOptions{
    UserID: "user-123",
    SessionID: "session-456",
    Metadata: map[string]interface{}{
        "tier": "premium",
    },
})
defer workflow.End()

// Your LLM calls are automatically associated with this workflow
```

### Metrics Collection

```go
// Record custom metrics
client.Metrics().RecordTokenUsage(untrace.TokenUsage{
    PromptTokens: 150,
    CompletionTokens: 50,
    TotalTokens: 200,
    Model: "gpt-3.5-turbo",
    Provider: "openai",
})

client.Metrics().RecordLatency(1234, map[string]interface{}{
    "provider": "openai",
    "operation": "chat",
})

client.Metrics().RecordCost(untrace.Cost{
    Prompt: 0.0015,
    Completion: 0.002,
    Total: 0.0035,
    Model: "gpt-4",
    Provider: "openai",
})
```

## Error Handling

The SDK provides specific error types for different scenarios:

```go
import "github.com/untrace-dev/untrace-sdk-go/errors"

// Check for specific error types
if err != nil {
    switch e := err.(type) {
    case *errors.APIError:
        log.Printf("API error: %v", e)
    case *errors.ValidationError:
        log.Printf("Validation error: %v", e)
    case *errors.UntraceError:
        log.Printf("Untrace error: %v", e)
    default:
        log.Printf("Unknown error: %v", e)
    }
}
```

## Development

### Setup

```bash
# Clone the repository
git clone https://github.com/untrace-dev/untrace-sdk.git
cd untrace-sdk/sdks/go

# Install dependencies
go mod tidy

# Run tests
go test ./...
```

### Code Formatting

```bash
go fmt ./...
go vet ./...
```

## License

MIT License - see LICENSE file for details.
