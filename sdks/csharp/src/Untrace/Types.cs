using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace Untrace;

/// <summary>
/// Configuration options for the Untrace SDK
/// </summary>
public class UntraceConfig
{
    /// <summary>
    /// Your Untrace API key (required)
    /// </summary>
    [JsonPropertyName("apiKey")]
    public string ApiKey { get; set; } = string.Empty;

    /// <summary>
    /// Base URL for the Untrace API (optional)
    /// </summary>
    [JsonPropertyName("baseUrl")]
    public string BaseUrl { get; set; } = "https://api.untrace.dev";

    /// <summary>
    /// Service name for identification (optional)
    /// </summary>
    [JsonPropertyName("serviceName")]
    public string ServiceName { get; set; } = "untrace-app";

    /// <summary>
    /// Environment name (optional)
    /// </summary>
    [JsonPropertyName("environment")]
    public string Environment { get; set; } = "production";

    /// <summary>
    /// Service version (optional)
    /// </summary>
    [JsonPropertyName("version")]
    public string Version { get; set; } = "0.0.0";

    /// <summary>
    /// Enable debug logging (optional)
    /// </summary>
    [JsonPropertyName("debug")]
    public bool Debug { get; set; } = false;

    /// <summary>
    /// Disable auto-instrumentation (optional)
    /// </summary>
    [JsonPropertyName("disableAutoInstrumentation")]
    public bool DisableAutoInstrumentation { get; set; } = false;

    /// <summary>
    /// Capture request/response bodies (optional)
    /// </summary>
    [JsonPropertyName("captureBody")]
    public bool CaptureBody { get; set; } = true;

    /// <summary>
    /// Capture and report errors (optional)
    /// </summary>
    [JsonPropertyName("captureErrors")]
    public bool CaptureErrors { get; set; } = true;

    /// <summary>
    /// Sampling rate from 0.0 to 1.0 (optional)
    /// </summary>
    [JsonPropertyName("samplingRate")]
    public double SamplingRate { get; set; } = 1.0;

    /// <summary>
    /// Maximum batch size for spans (optional)
    /// </summary>
    [JsonPropertyName("maxBatchSize")]
    public int MaxBatchSize { get; set; } = 512;

    /// <summary>
    /// Export interval in milliseconds (optional)
    /// </summary>
    [JsonPropertyName("exportIntervalMs")]
    public int ExportIntervalMs { get; set; } = 5000;

    /// <summary>
    /// Providers to instrument (optional)
    /// </summary>
    [JsonPropertyName("providers")]
    public List<string> Providers { get; set; } = new() { "all" };

    /// <summary>
    /// Custom headers for requests (optional)
    /// </summary>
    [JsonPropertyName("headers")]
    public Dictionary<string, string> Headers { get; set; } = new();

    /// <summary>
    /// Additional resource attributes (optional)
    /// </summary>
    [JsonPropertyName("resourceAttributes")]
    public Dictionary<string, object> ResourceAttributes { get; set; } = new();
}

/// <summary>
/// Represents a trace event
/// </summary>
public class TraceEvent
{
    /// <summary>
    /// Unique identifier for the trace
    /// </summary>
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    /// <summary>
    /// Timestamp when the trace was created
    /// </summary>
    [JsonPropertyName("timestamp")]
    public DateTime Timestamp { get; set; }

    /// <summary>
    /// Type of the event
    /// </summary>
    [JsonPropertyName("eventType")]
    public string EventType { get; set; } = string.Empty;

    /// <summary>
    /// Event data payload
    /// </summary>
    [JsonPropertyName("data")]
    public Dictionary<string, object> Data { get; set; } = new();

    /// <summary>
    /// Optional metadata for the event
    /// </summary>
    [JsonPropertyName("metadata")]
    public Dictionary<string, object>? Metadata { get; set; }
}

/// <summary>
/// Token usage information
/// </summary>
public class TokenUsage
{
    /// <summary>
    /// Number of prompt tokens
    /// </summary>
    [JsonPropertyName("promptTokens")]
    public int PromptTokens { get; set; }

    /// <summary>
    /// Number of completion tokens
    /// </summary>
    [JsonPropertyName("completionTokens")]
    public int CompletionTokens { get; set; }

    /// <summary>
    /// Total number of tokens
    /// </summary>
    [JsonPropertyName("totalTokens")]
    public int TotalTokens { get; set; }

    /// <summary>
    /// Model used
    /// </summary>
    [JsonPropertyName("model")]
    public string Model { get; set; } = string.Empty;

    /// <summary>
    /// Provider used
    /// </summary>
    [JsonPropertyName("provider")]
    public string Provider { get; set; } = string.Empty;
}

/// <summary>
/// Cost information
/// </summary>
public class Cost
{
    /// <summary>
    /// Cost for prompt tokens
    /// </summary>
    [JsonPropertyName("prompt")]
    public decimal Prompt { get; set; }

    /// <summary>
    /// Cost for completion tokens
    /// </summary>
    [JsonPropertyName("completion")]
    public decimal Completion { get; set; }

    /// <summary>
    /// Total cost
    /// </summary>
    [JsonPropertyName("total")]
    public decimal Total { get; set; }

    /// <summary>
    /// Model used
    /// </summary>
    [JsonPropertyName("model")]
    public string Model { get; set; } = string.Empty;

    /// <summary>
    /// Provider used
    /// </summary>
    [JsonPropertyName("provider")]
    public string Provider { get; set; } = string.Empty;
}

/// <summary>
/// LLM span attributes
/// </summary>
public class LLMSpanAttributes
{
    /// <summary>
    /// Provider name
    /// </summary>
    [JsonPropertyName("llm.provider")]
    public string Provider { get; set; } = string.Empty;

    /// <summary>
    /// Model name
    /// </summary>
    [JsonPropertyName("llm.model")]
    public string Model { get; set; } = string.Empty;

    /// <summary>
    /// Operation type
    /// </summary>
    [JsonPropertyName("llm.operation")]
    public string Operation { get; set; } = string.Empty;

    /// <summary>
    /// Prompt tokens
    /// </summary>
    [JsonPropertyName("llm.prompt.tokens")]
    public int? PromptTokens { get; set; }

    /// <summary>
    /// Completion tokens
    /// </summary>
    [JsonPropertyName("llm.completion.tokens")]
    public int? CompletionTokens { get; set; }

    /// <summary>
    /// Total tokens
    /// </summary>
    [JsonPropertyName("llm.total.tokens")]
    public int? TotalTokens { get; set; }

    /// <summary>
    /// Cost information
    /// </summary>
    [JsonPropertyName("llm.cost")]
    public decimal? Cost { get; set; }
}

/// <summary>
/// Workflow attributes
/// </summary>
public class WorkflowAttributes
{
    /// <summary>
    /// Workflow ID
    /// </summary>
    [JsonPropertyName("workflow.id")]
    public string Id { get; set; } = string.Empty;

    /// <summary>
    /// Workflow name
    /// </summary>
    [JsonPropertyName("workflow.name")]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// User ID
    /// </summary>
    [JsonPropertyName("workflow.user_id")]
    public string? UserId { get; set; }

    /// <summary>
    /// Session ID
    /// </summary>
    [JsonPropertyName("workflow.session_id")]
    public string? SessionId { get; set; }

    /// <summary>
    /// Additional metadata
    /// </summary>
    [JsonPropertyName("workflow.metadata")]
    public Dictionary<string, object>? Metadata { get; set; }
}
