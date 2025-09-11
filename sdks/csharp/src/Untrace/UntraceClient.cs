using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace Untrace;

/// <summary>
/// Main client for interacting with the Untrace API
/// </summary>
public class UntraceClient : IDisposable
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<UntraceClient>? _logger;
    private readonly JsonSerializerOptions _jsonOptions;
    private bool _disposed = false;

    /// <summary>
    /// Initializes a new instance of the UntraceClient class
    /// </summary>
    /// <param name="apiKey">Your Untrace API key</param>
    /// <param name="baseUrl">Base URL for the Untrace API</param>
    /// <param name="timeout">Request timeout</param>
    /// <param name="logger">Optional logger</param>
    public UntraceClient(
        string apiKey,
        string baseUrl = "https://api.untrace.dev",
        TimeSpan? timeout = null,
        ILogger<UntraceClient>? logger = null)
    {
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            throw new ArgumentException("API key cannot be null or empty", nameof(apiKey));
        }

        _logger = logger;
        _jsonOptions = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            WriteIndented = false
        };

        _httpClient = new HttpClient
        {
            BaseAddress = new Uri(baseUrl.TrimEnd('/')),
            Timeout = timeout ?? TimeSpan.FromSeconds(30)
        };

        _httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {apiKey}");
        _httpClient.DefaultRequestHeaders.Add("User-Agent", "untrace-sdk-csharp/0.1.2");
    }

    /// <summary>
    /// Send a trace event to Untrace
    /// </summary>
    /// <param name="eventType">Type of the event (e.g., 'llm_call', 'user_action')</param>
    /// <param name="data">Event data payload</param>
    /// <param name="metadata">Optional metadata for the event</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>TraceEvent object representing the created trace</returns>
    /// <exception cref="UntraceApiException">Thrown when the API request fails</exception>
    /// <exception cref="UntraceValidationException">Thrown when the request data is invalid</exception>
    public async Task<TraceEvent> TraceAsync(
        string eventType,
        Dictionary<string, object> data,
        Dictionary<string, object>? metadata = null,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(eventType))
        {
            throw new ArgumentException("Event type cannot be null or empty", nameof(eventType));
        }

        if (data == null)
        {
            throw new ArgumentNullException(nameof(data));
        }

        try
        {
            var payload = new
            {
                EventType = eventType,
                Data = data,
                Metadata = metadata ?? new Dictionary<string, object>(),
                Timestamp = DateTime.UtcNow
            };

            var json = JsonSerializer.Serialize(payload, _jsonOptions);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            _logger?.LogDebug("Sending trace event: {EventType}", eventType);

            var response = await _httpClient.PostAsync("/api/v1/traces", content, cancellationToken);

            if (response.StatusCode == HttpStatusCode.UnprocessableEntity)
            {
                var errorContent = await response.Content.ReadAsStringAsync(cancellationToken);
                throw new UntraceValidationException($"Validation error: {errorContent}");
            }

            if (!response.IsSuccessStatusCode)
            {
                var errorContent = await response.Content.ReadAsStringAsync(cancellationToken);
                throw new UntraceApiException(
                    $"API request failed with status {response.StatusCode}: {errorContent}",
                    response.StatusCode,
                    errorContent);
            }

            var responseContent = await response.Content.ReadAsStringAsync(cancellationToken);
            var traceData = JsonSerializer.Deserialize<TraceEvent>(responseContent, _jsonOptions);

            if (traceData == null)
            {
                throw new UntraceApiException("Failed to deserialize trace response");
            }

            _logger?.LogDebug("Trace event created successfully: {TraceId}", traceData.Id);
            return traceData;
        }
        catch (HttpRequestException ex)
        {
            _logger?.LogError(ex, "HTTP request failed while sending trace event");
            throw new UntraceApiException($"Request failed: {ex.Message}", ex);
        }
        catch (TaskCanceledException ex) when (ex.InnerException is TimeoutException)
        {
            _logger?.LogError(ex, "Request timeout while sending trace event");
            throw new UntraceApiException("Request timeout", ex);
        }
        catch (JsonException ex)
        {
            _logger?.LogError(ex, "JSON serialization/deserialization failed");
            throw new UntraceApiException("JSON processing failed", ex);
        }
    }

    /// <summary>
    /// Retrieve a trace by ID
    /// </summary>
    /// <param name="traceId">The ID of the trace to retrieve</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>TraceEvent object</returns>
    /// <exception cref="UntraceApiException">Thrown when the API request fails</exception>
    public async Task<TraceEvent> GetTraceAsync(
        string traceId,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(traceId))
        {
            throw new ArgumentException("Trace ID cannot be null or empty", nameof(traceId));
        }

        try
        {
            _logger?.LogDebug("Retrieving trace: {TraceId}", traceId);

            var response = await _httpClient.GetAsync($"/api/v1/traces/{traceId}", cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                var errorContent = await response.Content.ReadAsStringAsync(cancellationToken);
                throw new UntraceApiException(
                    $"API request failed with status {response.StatusCode}: {errorContent}",
                    response.StatusCode,
                    errorContent);
            }

            var responseContent = await response.Content.ReadAsStringAsync(cancellationToken);
            var traceData = JsonSerializer.Deserialize<TraceEvent>(responseContent, _jsonOptions);

            if (traceData == null)
            {
                throw new UntraceApiException("Failed to deserialize trace response");
            }

            _logger?.LogDebug("Trace retrieved successfully: {TraceId}", traceData.Id);
            return traceData;
        }
        catch (HttpRequestException ex)
        {
            _logger?.LogError(ex, "HTTP request failed while retrieving trace");
            throw new UntraceApiException($"Request failed: {ex.Message}", ex);
        }
        catch (TaskCanceledException ex) when (ex.InnerException is TimeoutException)
        {
            _logger?.LogError(ex, "Request timeout while retrieving trace");
            throw new UntraceApiException("Request timeout", ex);
        }
        catch (JsonException ex)
        {
            _logger?.LogError(ex, "JSON deserialization failed");
            throw new UntraceApiException("JSON processing failed", ex);
        }
    }

    /// <summary>
    /// Dispose the HTTP client
    /// </summary>
    public void Dispose()
    {
        Dispose(true);
        GC.SuppressFinalize(this);
    }

    /// <summary>
    /// Dispose the HTTP client
    /// </summary>
    /// <param name="disposing">Whether to dispose managed resources</param>
    protected virtual void Dispose(bool disposing)
    {
        if (!_disposed && disposing)
        {
            _httpClient?.Dispose();
            _disposed = true;
        }
    }
}
