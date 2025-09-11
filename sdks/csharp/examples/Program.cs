using Microsoft.Extensions.DependencyInjection;
using Untrace;
using Untrace.Examples;

namespace Untrace.Examples;

/// <summary>
/// Console application demonstrating Untrace SDK usage
/// </summary>
class Program
{
    static async Task Main(string[] args)
    {
        Console.WriteLine("=== Untrace .NET SDK Examples ===\n");

        var basicUsage = new BasicUsage();

        try
        {
            // Example 1: Legacy Client
            Console.WriteLine("1. Legacy Client Example");
            Console.WriteLine("========================");
            await basicUsage.DemonstrateLegacyClientAsync();
            Console.WriteLine("");

            // Example 2: OpenTelemetry SDK
            Console.WriteLine("2. OpenTelemetry SDK Example");
            Console.WriteLine("=============================");
            await basicUsage.DemonstrateOpenTelemetrySdkAsync();
            Console.WriteLine("");

            // Example 3: Dependency Injection
            Console.WriteLine("3. Dependency Injection Example");
            Console.WriteLine("=================================");
            await basicUsage.DemonstrateDependencyInjectionAsync();
            Console.WriteLine("");

            // Example 4: LLM Service
            Console.WriteLine("4. LLM Service Example");
            Console.WriteLine("========================");
            await DemonstrateLLMServiceAsync();

            Console.WriteLine("=== All Examples Completed Successfully ===");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error running examples: {ex.Message}");
            Environment.Exit(1);
        }
    }

    private static async Task DemonstrateLLMServiceAsync()
    {
        var apiKey = Environment.GetEnvironmentVariable("UNTRACE_API_KEY");
        if (string.IsNullOrEmpty(apiKey))
        {
            Console.WriteLine("Please set UNTRACE_API_KEY environment variable");
            return;
        }

        // Setup services
        var services = new ServiceCollection();
        services.AddUntrace(config =>
        {
            config.ApiKey = apiKey;
            config.ServiceName = "llm-service-example";
            config.Environment = "development";
            config.Debug = true;
        });

        var serviceProvider = services.BuildServiceProvider();

        try
        {
            var llmService = new ExampleLLMService(
                serviceProvider.GetRequiredService<Untrace>()
            );

            var prompts = new[]
            {
                "What is the capital of France?",
                "Explain quantum computing in simple terms",
                "Write a haiku about programming"
            };

            foreach (var prompt in prompts)
            {
                Console.WriteLine($"Prompt: {prompt}");
                var response = await llmService.CompleteAsync(prompt);
                Console.WriteLine($"Response: {response}\n");
            }
        }
        finally
        {
            serviceProvider.Dispose();
        }
    }
}
