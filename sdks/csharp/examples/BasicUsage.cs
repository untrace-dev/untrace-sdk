using Microsoft.Extensions.DependencyInjection;
using Untrace;

namespace Untrace.Examples;

/// <summary>
/// Basic usage example for the Untrace .NET SDK
/// </summary>
public class BasicUsage
{
    public BasicUsage()
    {
    }

    /// <summary>
    /// Demonstrate basic SDK usage with the legacy client
    /// </summary>
    public async Task DemonstrateLegacyClientAsync()
    {
        var apiKey = Environment.GetEnvironmentVariable("UNTRACE_API_KEY");
        if (string.IsNullOrEmpty(apiKey))
        {
            Console.WriteLine("Please set UNTRACE_API_KEY environment variable");
            return;
        }

        // Initialize the client
        using var client = new UntraceClient(apiKey);

        try
        {
            // Example 1: Trace an LLM call
            Console.WriteLine("Tracing LLM call...");
            var trace = await client.TraceAsync(
                eventType: "llm_call",
                data: new Dictionary<string, object>
                {
                    ["model"] = "gpt-4",
                    ["prompt"] = "What is the capital of France?",
                    ["response"] = "The capital of France is Paris.",
                    ["tokens_used"] = 15,
                    ["cost"] = 0.0003m
                },
                metadata: new Dictionary<string, object>
                {
                    ["user_id"] = "user123",
                    ["session_id"] = "session456",
                    ["request_id"] = "req789"
                }
            );
            Console.WriteLine($"✅ LLM call traced: {trace.Id}");

            // Example 2: Trace a user action
            Console.WriteLine("Tracing user action...");
            trace = await client.TraceAsync(
                eventType: "user_action",
                data: new Dictionary<string, object>
                {
                    ["action"] = "button_click",
                    ["button_id"] = "submit_form",
                    ["page"] = "/dashboard"
                },
                metadata: new Dictionary<string, object>
                {
                    ["user_id"] = "user123",
                    ["session_id"] = "session456",
                    ["timestamp"] = DateTime.UtcNow.ToString("O")
                }
            );
            Console.WriteLine($"✅ User action traced: {trace.Id}");

            // Example 3: Retrieve a trace
            Console.WriteLine($"Retrieving trace: {trace.Id}");
            var retrievedTrace = await client.GetTraceAsync(trace.Id);
            Console.WriteLine($"✅ Retrieved trace: {retrievedTrace.EventType}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error in legacy client example: {ex.Message}");
        }
    }

    /// <summary>
    /// Demonstrate OpenTelemetry-based SDK usage
    /// </summary>
    public async Task DemonstrateOpenTelemetrySdkAsync()
    {
        var apiKey = Environment.GetEnvironmentVariable("UNTRACE_API_KEY");
        if (string.IsNullOrEmpty(apiKey))
        {
            Console.WriteLine("Please set UNTRACE_API_KEY environment variable");
            return;
        }

        // Initialize the SDK
        var config = new UntraceConfig
        {
            ApiKey = apiKey,
            ServiceName = "untrace-example-app",
            Environment = "development",
            Version = "1.0.0",
            Debug = true
        };

        using var untrace = UntraceSdk.Init(config);

        try
        {
            // Example 1: Basic activity tracing
            Console.WriteLine("Creating basic activity...");
            using var activity = untrace.StartActivity("example-operation");
            activity?.SetTag("operation.type", "example");
            activity?.SetTag("user.id", "user123");

            // Simulate some work
            await Task.Delay(100);

            // Example 2: LLM activity tracing
            Console.WriteLine("Creating LLM activity...");
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
                PromptTokens = 10,
                CompletionTokens = 5,
                TotalTokens = 15,
                Model = "gpt-4",
                Provider = "openai"
            };
            untrace.RecordTokenUsage(tokenUsage);

            // Record cost
            var cost = new Cost
            {
                Prompt = 0.0001m,
                Completion = 0.0002m,
                Total = 0.0003m,
                Model = "gpt-4",
                Provider = "openai"
            };
            untrace.RecordCost(cost);

            // Simulate LLM processing
            await Task.Delay(200);

            Console.WriteLine("✅ LLM activity completed");

            // Example 3: Error handling
            Console.WriteLine("Demonstrating error handling...");
            using var errorActivity = untrace.StartActivity("error-prone-operation");
            try
            {
                throw new InvalidOperationException("This is a test error");
            }
            catch (Exception ex)
            {
                untrace.RecordException(ex);
                Console.WriteLine($"Error recorded in activity: {ex.Message}");
            }

            // Flush all pending spans
            untrace.Flush();
            Console.WriteLine("✅ All activities completed and flushed");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error in OpenTelemetry SDK example: {ex.Message}");
        }
    }

    /// <summary>
    /// Demonstrate dependency injection usage
    /// </summary>
    public async Task DemonstrateDependencyInjectionAsync()
    {
        var apiKey = Environment.GetEnvironmentVariable("UNTRACE_API_KEY");
        if (string.IsNullOrEmpty(apiKey))
        {
            Console.WriteLine("Please set UNTRACE_API_KEY environment variable");
            return;
        }

        // Setup dependency injection
        var services = new ServiceCollection();
        // No logging setup needed for this example
        services.AddUntrace(config =>
        {
            config.ApiKey = apiKey;
            config.ServiceName = "untrace-di-example";
            config.Environment = "development";
            config.Debug = true;
        });

        var serviceProvider = services.BuildServiceProvider();

        try
        {
            // Get services from DI container
            var untrace = serviceProvider.GetRequiredService<Untrace>();
            var client = serviceProvider.GetRequiredService<UntraceClient>();

            Console.WriteLine("Using services from dependency injection...");

            // Use the client
            var trace = await client.TraceAsync(
                eventType: "di_example",
                data: new Dictionary<string, object>
                {
                    ["message"] = "Hello from dependency injection!",
                    ["timestamp"] = DateTime.UtcNow
                }
            );

            Console.WriteLine($"✅ Trace created via DI: {trace.Id}");

            // Use the SDK
            using var activity = untrace.StartActivity("di-operation");
            activity?.SetTag("source", "dependency-injection");
            await Task.Delay(50);

            Console.WriteLine("✅ Activity created via DI");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error in dependency injection example: {ex.Message}");
        }
        finally
        {
            serviceProvider.Dispose();
        }
    }
}

/// <summary>
/// Example service demonstrating LLM operations
/// </summary>
public class ExampleLLMService
{
    private readonly Untrace _untrace;

    public ExampleLLMService(Untrace untrace)
    {
        _untrace = untrace;
    }

    /// <summary>
    /// Simulate an LLM completion call
    /// </summary>
    public async Task<string> CompleteAsync(string prompt)
    {
        using var activity = _untrace.StartLLMActivity(
            operation: "completion",
            provider: "openai",
            model: "gpt-3.5-turbo"
        );

        try
        {
            activity?.SetTag("llm.prompt", prompt);

            // Simulate API call
            await Task.Delay(300);

            var response = $"Response to: {prompt}";
            activity?.SetTag("llm.response", response);

            // Record token usage
            var tokenUsage = new TokenUsage
            {
                PromptTokens = prompt.Length / 4, // Rough estimate
                CompletionTokens = response.Length / 4,
                TotalTokens = (prompt.Length + response.Length) / 4,
                Model = "gpt-3.5-turbo",
                Provider = "openai"
            };
            _untrace.RecordTokenUsage(tokenUsage);

            // Record cost
            var cost = new Cost
            {
                Prompt = tokenUsage.PromptTokens * 0.000001m,
                Completion = tokenUsage.CompletionTokens * 0.000002m,
                Total = tokenUsage.TotalTokens * 0.0000015m,
                Model = "gpt-3.5-turbo",
                Provider = "openai"
            };
            _untrace.RecordCost(cost);

            Console.WriteLine($"LLM completion successful: {tokenUsage.TotalTokens} tokens, ${cost.Total}");

            return response;
        }
        catch (Exception ex)
        {
            _untrace.RecordException(ex);
            Console.WriteLine($"LLM completion failed: {ex.Message}");
            throw;
        }
    }
}
