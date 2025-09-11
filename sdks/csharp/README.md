# Untrace SDK for .NET

LLM observability SDK for .NET applications.

## Installation

```bash
dotnet add package Untrace.Sdk
```

Or via Package Manager:
```
Install-Package Untrace.Sdk
```

## Quick Start

### Basic Setup

```csharp
using Untrace;

// Initialize the SDK
var config = new UntraceConfig
{
    ApiKey = "your-api-key",
    ServiceName = "my-llm-app",
    Environment = "production"
};

using var untrace = UntraceSdk.Init(config);

// Create activities for tracing
using var activity = untrace.StartActivity("my-operation");
activity?.SetTag("user.id", "user123");

// Your LLM code is automatically traced!
```

### Legacy Client Usage

```csharp
using Untrace;

// Initialize the client
using var client = new UntraceClient("your-api-key");

// Send a trace event
var trace = await client.TraceAsync(
    eventType: "llm_call",
    data: new Dictionary<string, object>
    {
        ["model"] = "gpt-4",
        ["prompt"] = "Hello, world!",
        ["response"] = "Hello! How can I help you today?",
        ["tokens_used"] = 25
    },
    metadata: new Dictionary<string, object>
    {
        ["user_id"] = "user123",
        ["session_id"] = "session456"
    }
);

Console.WriteLine($"Trace created: {trace.Id}");
```

### Dependency Injection

```csharp
using Microsoft.Extensions.DependencyInjection;
using Untrace;

// Setup dependency injection
var services = new ServiceCollection();
services.AddLogging(builder => builder.AddConsole());
services.AddUntrace(config =>
{
    config.ApiKey = "your-api-key";
    config.ServiceName = "my-app";
    config.Environment = "production";
});

var serviceProvider = services.BuildServiceProvider();

// Get services from DI container
var untrace = serviceProvider.GetRequiredService<Untrace>();
var client = serviceProvider.GetRequiredService<UntraceClient>();
```

## Advanced Usage

### LLM Activity Tracing

```csharp
using var llmActivity = untrace.StartLLMActivity(
    operation: "chat",
    provider: "openai",
    model: "gpt-4",
    attributes: new Dictionary<string, object>
    {
        ["llm.prompt"] = "What is the meaning of life?",
        ["llm.response"] = "42"
    }
);

// Record token usage
var tokenUsage = new TokenUsage
{
    PromptTokens = 150,
    CompletionTokens = 50,
    TotalTokens = 200,
    Model = "gpt-4",
    Provider = "openai"
};
untrace.RecordTokenUsage(tokenUsage);

// Record cost
var cost = new Cost
{
    Prompt = 0.0015m,
    Completion = 0.002m,
    Total = 0.0035m,
    Model = "gpt-4",
    Provider = "openai"
};
untrace.RecordCost(cost);
```

### Activity Extensions

```csharp
using var activity = untrace.StartActivity("my-operation");

// Set LLM attributes
var llmAttributes = new LLMSpanAttributes
{
    Provider = "openai",
    Model = "gpt-4",
    Operation = "chat",
    PromptTokens = 100,
    CompletionTokens = 50,
    TotalTokens = 150,
    Cost = 0.003m
};
activity?.SetLLMAttributes(llmAttributes);

// Set workflow attributes
var workflowAttributes = new WorkflowAttributes
{
    Id = "workflow-123",
    Name = "customer-support",
    UserId = "user-456",
    SessionId = "session-789",
    Metadata = new Dictionary<string, object>
    {
        ["tier"] = "premium",
        ["region"] = "us-east"
    }
};
activity?.SetWorkflowAttributes(workflowAttributes);
```

### Error Handling

```csharp
using var activity = untrace.StartActivity("risky-operation");

try
{
    // Your risky operation here
    throw new InvalidOperationException("Something went wrong");
}
catch (Exception ex)
{
    untrace.RecordException(ex);
    activity?.SetStatus(ActivityStatusCode.Error, ex.Message);
    throw;
}
```

## Configuration Options

```csharp
var config = new UntraceConfig
{
    // Required
    ApiKey = "your-api-key",

    // Optional
    BaseUrl = "https://api.untrace.dev",           // Custom API endpoint
    ServiceName = "untrace-app",                   // Service name
    Environment = "production",                     // Environment name
    Version = "1.0.0",                            // Service version
    Debug = false,                                 // Enable debug logging
    DisableAutoInstrumentation = false,            // Disable auto-instrumentation
    CaptureBody = true,                            // Capture request/response bodies
    CaptureErrors = true,                          // Capture and report errors
    SamplingRate = 1.0,                           // Sampling rate (0.0 to 1.0)
    MaxBatchSize = 512,                           // Max spans per batch
    ExportIntervalMs = 5000,                      // Export interval in milliseconds
    Providers = new List<string> { "all" },       // Providers to instrument
    Headers = new Dictionary<string, string>(),   // Custom headers
    ResourceAttributes = new Dictionary<string, object>() // Additional attributes
};
```

## Supported Providers

### AI/LLM Providers
- ✅ OpenAI
- ✅ Anthropic (Claude)
- ✅ Azure OpenAI
- ✅ Google Vertex AI
- ✅ AWS Bedrock
- ✅ Cohere
- ✅ Mistral

### Framework Support
- ✅ ASP.NET Core
- ✅ Console Applications
- ✅ Background Services
- ✅ Web APIs

## Best Practices

1. **Initialize early**: Call `UntraceSdk.Init()` as early as possible in your application lifecycle
2. **Use activities**: Group related operations using activities
3. **Add metadata**: Include relevant metadata for better observability
4. **Handle errors**: The SDK automatically captures errors, but add context when possible
5. **Monitor costs**: Use the cost tracking features to monitor spending
6. **Sample wisely**: Adjust sampling rate for high-volume production apps

## Environment Variables

The SDK respects these environment variables:

- `UNTRACE_API_KEY` - API key (overrides config)
- `UNTRACE_BASE_URL` - Base URL for ingestion
- `UNTRACE_DEBUG` - Enable debug mode
- `OTEL_SERVICE_NAME` - Service name (OpenTelemetry standard)
- `OTEL_RESOURCE_ATTRIBUTES` - Additional resource attributes

## Examples

### ASP.NET Core Web API

```csharp
// Program.cs
using Untrace;

var builder = WebApplication.CreateBuilder(args);

// Add Untrace SDK
builder.Services.AddUntrace(config =>
{
    config.ApiKey = builder.Configuration["Untrace:ApiKey"];
    config.ServiceName = "my-web-api";
    config.Environment = builder.Environment.EnvironmentName;
});

var app = builder.Build();

// Controllers are automatically instrumented
app.MapControllers();
app.Run();
```

```csharp
// Controllers/ChatController.cs
[ApiController]
[Route("api/[controller]")]
public class ChatController : ControllerBase
{
    private readonly Untrace _untrace;

    public ChatController(Untrace untrace)
    {
        _untrace = untrace;
    }

    [HttpPost]
    public async Task<IActionResult> Chat([FromBody] ChatRequest request)
    {
        using var activity = _untrace.StartLLMActivity(
            operation: "chat",
            provider: "openai",
            model: "gpt-3.5-turbo"
        );

        try
        {
            // Your LLM logic here
            var response = await CallOpenAI(request.Message);

            activity?.SetTag("llm.response", response);
            return Ok(new { response });
        }
        catch (Exception ex)
        {
            _untrace.RecordException(ex);
            throw;
        }
    }
}
```

### Background Service

```csharp
public class LLMProcessingService : BackgroundService
{
    private readonly Untrace _untrace;
    private readonly ILogger<LLMProcessingService> _logger;

    public LLMProcessingService(Untrace untrace, ILogger<LLMProcessingService> logger)
    {
        _untrace = untrace;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            using var activity = _untrace.StartActivity("process-queue");

            try
            {
                // Process LLM requests from queue
                await ProcessQueueItems();
            }
            catch (Exception ex)
            {
                _untrace.RecordException(ex);
                _logger.LogError(ex, "Error processing queue");
            }

            await Task.Delay(1000, stoppingToken);
        }
    }
}
```

## Troubleshooting

### No traces appearing?

1. Check your API key is correct
2. Ensure SDK is initialized before making LLM calls
3. Check `Debug = true` mode for any errors
4. Verify network connectivity to Untrace servers

### High latency?

1. Adjust `MaxBatchSize` and `ExportIntervalMs`
2. Use sampling for high-volume applications
3. Check network latency to ingestion endpoint

### Missing instrumentation?

1. Ensure the provider is in the supported list
2. Try manual instrumentation
3. Check that the provider module structure matches expected format

## Development

### Setup

```bash
# Clone the repository
git clone https://github.com/untrace-dev/untrace-sdk.git
cd untrace-sdk/sdks/csharp

# Restore packages
dotnet restore

# Build the project
dotnet build

# Run tests
dotnet test
```

### Running Examples

```bash
cd examples
dotnet run
```

## License

MIT License - see LICENSE file for details.

## Contributing

Contributions are welcome! Please see our [Contributing Guide](../../CONTRIBUTING.md) for details.

## Support

- Documentation: [https://docs.untrace.dev](https://docs.untrace.dev)
- Issues: [GitHub Issues](https://github.com/untrace-dev/untrace/issues)
- Discord: [Join our community](https://discord.gg/untrace)
