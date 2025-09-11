using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using OpenTelemetry;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using System.Diagnostics;

namespace Untrace;

/// <summary>
/// Main Untrace SDK class for OpenTelemetry-based observability
/// </summary>
public class Untrace : IDisposable
{
    private readonly TracerProvider _tracerProvider;
    private readonly UntraceConfig _config;
    private readonly ILogger<Untrace>? _logger;
    private readonly ActivitySource _activitySource;
    private bool _disposed = false;

    /// <summary>
    /// Initializes a new instance of the Untrace class
    /// </summary>
    /// <param name="config">Configuration options</param>
    /// <param name="logger">Optional logger</param>
    public Untrace(UntraceConfig config, ILogger<Untrace>? logger = null)
    {
        _config = config ?? throw new ArgumentNullException(nameof(config));
        _logger = logger;

        if (string.IsNullOrWhiteSpace(_config.ApiKey))
        {
            throw new ArgumentException("API key is required", nameof(config));
        }

        _activitySource = new ActivitySource(_config.ServiceName, _config.Version);

        // Create resource with service information
        var resourceBuilder = ResourceBuilder.CreateDefault()
            .AddService(_config.ServiceName, _config.Version)
            .AddAttributes(new Dictionary<string, object>
            {
                ["service.environment"] = _config.Environment,
                ["service.namespace"] = "untrace",
            });

        // Add custom resource attributes
        foreach (var attribute in _config.ResourceAttributes)
        {
            resourceBuilder.AddAttributes(new Dictionary<string, object> { [attribute.Key] = attribute.Value });
        }

        // Create tracer provider
        _tracerProvider = Sdk.CreateTracerProviderBuilder()
            .SetResourceBuilder(resourceBuilder)
            .SetSampler(new TraceIdRatioBasedSampler(_config.SamplingRate))
            .AddSource(_config.ServiceName)
            .Build();

        _logger?.LogInformation("Untrace SDK initialized for service: {ServiceName}", _config.ServiceName);
    }

    /// <summary>
    /// Get the activity source for creating activities
    /// </summary>
    public ActivitySource ActivitySource => _activitySource;

    /// <summary>
    /// Create a new activity for tracing
    /// </summary>
    /// <param name="name">Activity name</param>
    /// <param name="kind">Activity kind</param>
    /// <param name="attributes">Initial attributes</param>
    /// <returns>Activity instance</returns>
    public Activity? StartActivity(
        string name,
        ActivityKind kind = ActivityKind.Internal,
        Dictionary<string, object>? attributes = null)
    {
        var activity = _activitySource.StartActivity(name, kind);

        if (activity != null && attributes != null)
        {
            foreach (var attribute in attributes)
            {
                activity.SetTag(attribute.Key, attribute.Value);
            }
        }

        return activity;
    }

    /// <summary>
    /// Create an LLM activity for tracing LLM operations
    /// </summary>
    /// <param name="operation">LLM operation type</param>
    /// <param name="provider">Provider name</param>
    /// <param name="model">Model name</param>
    /// <param name="attributes">Additional attributes</param>
    /// <returns>Activity instance</returns>
    public Activity? StartLLMActivity(
        string operation,
        string provider,
        string model,
        Dictionary<string, object>? attributes = null)
    {
        var activityAttributes = new Dictionary<string, object>
        {
            ["llm.operation"] = operation,
            ["llm.provider"] = provider,
            ["llm.model"] = model,
        };

        if (attributes != null)
        {
            foreach (var attribute in attributes)
            {
                activityAttributes[attribute.Key] = attribute.Value;
            }
        }

        return StartActivity($"llm.{operation}", ActivityKind.Client, activityAttributes);
    }

    /// <summary>
    /// Record token usage metrics
    /// </summary>
    /// <param name="tokenUsage">Token usage information</param>
    public void RecordTokenUsage(TokenUsage tokenUsage)
    {
        var activity = Activity.Current;
        if (activity != null)
        {
            activity.SetTag("llm.prompt.tokens", tokenUsage.PromptTokens);
            activity.SetTag("llm.completion.tokens", tokenUsage.CompletionTokens);
            activity.SetTag("llm.total.tokens", tokenUsage.TotalTokens);
            activity.SetTag("llm.model", tokenUsage.Model);
            activity.SetTag("llm.provider", tokenUsage.Provider);
        }
    }

    /// <summary>
    /// Record cost metrics
    /// </summary>
    /// <param name="cost">Cost information</param>
    public void RecordCost(Cost cost)
    {
        var activity = Activity.Current;
        if (activity != null)
        {
            activity.SetTag("llm.cost.prompt", cost.Prompt);
            activity.SetTag("llm.cost.completion", cost.Completion);
            activity.SetTag("llm.cost.total", cost.Total);
            activity.SetTag("llm.model", cost.Model);
            activity.SetTag("llm.provider", cost.Provider);
        }
    }

    /// <summary>
    /// Record an exception in the current activity
    /// </summary>
    /// <param name="exception">Exception to record</param>
    public void RecordException(Exception exception)
    {
        var activity = Activity.Current;
        if (activity != null)
        {
            activity.SetStatus(ActivityStatusCode.Error, exception.Message);
            activity.SetTag("error", true);
            activity.SetTag("error.message", exception.Message);
            activity.SetTag("error.type", exception.GetType().Name);
        }
    }

    /// <summary>
    /// Flush all pending spans
    /// </summary>
    public void Flush()
    {
        _tracerProvider.ForceFlush();
        _logger?.LogDebug("Flushed all pending spans");
    }

    /// <summary>
    /// Dispose the SDK
    /// </summary>
    public void Dispose()
    {
        Dispose(true);
        GC.SuppressFinalize(this);
    }

    /// <summary>
    /// Dispose the SDK
    /// </summary>
    /// <param name="disposing">Whether to dispose managed resources</param>
    protected virtual void Dispose(bool disposing)
    {
        if (!_disposed && disposing)
        {
            _tracerProvider?.Dispose();
            _activitySource?.Dispose();
            _disposed = true;
            _logger?.LogInformation("Untrace SDK disposed");
        }
    }
}

/// <summary>
/// Static class for initializing the Untrace SDK
/// </summary>
public static class UntraceSdk
{
    private static Untrace? _instance;
    private static readonly object _lock = new();

    /// <summary>
    /// Initialize the Untrace SDK
    /// </summary>
    /// <param name="config">Configuration options</param>
    /// <param name="logger">Optional logger</param>
    /// <returns>Untrace instance</returns>
    public static Untrace Init(UntraceConfig config, ILogger<Untrace>? logger = null)
    {
        lock (_lock)
        {
            if (_instance != null)
            {
                logger?.LogWarning("Untrace SDK already initialized. Returning existing instance.");
                return _instance;
            }

            _instance = new Untrace(config, logger);
            return _instance;
        }
    }

    /// <summary>
    /// Get the current Untrace instance
    /// </summary>
    /// <returns>Untrace instance</returns>
    /// <exception cref="InvalidOperationException">Thrown when SDK is not initialized</exception>
    public static Untrace GetInstance()
    {
        lock (_lock)
        {
            if (_instance == null)
            {
                throw new InvalidOperationException("Untrace SDK not initialized. Call Init() first.");
            }
            return _instance;
        }
    }

    /// <summary>
    /// Check if the SDK is initialized
    /// </summary>
    /// <returns>True if initialized, false otherwise</returns>
    public static bool IsInitialized()
    {
        lock (_lock)
        {
            return _instance != null;
        }
    }

    /// <summary>
    /// Shutdown the SDK
    /// </summary>
    public static void Shutdown()
    {
        lock (_lock)
        {
            _instance?.Dispose();
            _instance = null;
        }
    }
}
