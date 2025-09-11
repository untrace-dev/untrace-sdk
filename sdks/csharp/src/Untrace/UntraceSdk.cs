// Main entry point for the Untrace SDK
// This file provides the public API surface

using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using System.Diagnostics;

namespace Untrace;

/// <summary>
/// Untrace SDK - LLM Observability and Tracing for .NET
/// </summary>
public static class UntraceSdkExtensions
{
    /// <summary>
    /// Add Untrace SDK to the service collection
    /// </summary>
    /// <param name="services">Service collection</param>
    /// <param name="config">Configuration options</param>
    /// <returns>Service collection for chaining</returns>
    public static IServiceCollection AddUntrace(
        this IServiceCollection services,
        UntraceConfig config)
    {
        services.AddSingleton(config);
        services.AddSingleton<Untrace>();
        services.AddSingleton<UntraceClient>(provider =>
        {
            var logger = provider.GetService<ILogger<UntraceClient>>();
            return new UntraceClient(config.ApiKey, config.BaseUrl, logger: logger);
        });

        return services;
    }

    /// <summary>
    /// Add Untrace SDK to the service collection with configuration action
    /// </summary>
    /// <param name="services">Service collection</param>
    /// <param name="configure">Configuration action</param>
    /// <returns>Service collection for chaining</returns>
    public static IServiceCollection AddUntrace(
        this IServiceCollection services,
        Action<UntraceConfig> configure)
    {
        var config = new UntraceConfig();
        configure(config);
        return services.AddUntrace(config);
    }
}

/// <summary>
/// Extension methods for Activity to add Untrace-specific functionality
/// </summary>
public static class ActivityExtensions
{
    /// <summary>
    /// Set LLM attributes on an activity
    /// </summary>
    /// <param name="activity">Activity instance</param>
    /// <param name="attributes">LLM attributes</param>
    /// <returns>Activity for chaining</returns>
    public static Activity SetLLMAttributes(this Activity activity, LLMSpanAttributes attributes)
    {
        if (!string.IsNullOrEmpty(attributes.Provider))
            activity.SetTag("llm.provider", attributes.Provider);

        if (!string.IsNullOrEmpty(attributes.Model))
            activity.SetTag("llm.model", attributes.Model);

        if (!string.IsNullOrEmpty(attributes.Operation))
            activity.SetTag("llm.operation", attributes.Operation);

        if (attributes.PromptTokens.HasValue)
            activity.SetTag("llm.prompt.tokens", attributes.PromptTokens.Value);

        if (attributes.CompletionTokens.HasValue)
            activity.SetTag("llm.completion.tokens", attributes.CompletionTokens.Value);

        if (attributes.TotalTokens.HasValue)
            activity.SetTag("llm.total.tokens", attributes.TotalTokens.Value);

        if (attributes.Cost.HasValue)
            activity.SetTag("llm.cost", attributes.Cost.Value);

        return activity;
    }

    /// <summary>
    /// Set workflow attributes on an activity
    /// </summary>
    /// <param name="activity">Activity instance</param>
    /// <param name="attributes">Workflow attributes</param>
    /// <returns>Activity for chaining</returns>
    public static Activity SetWorkflowAttributes(this Activity activity, WorkflowAttributes attributes)
    {
        if (!string.IsNullOrEmpty(attributes.Id))
            activity.SetTag("workflow.id", attributes.Id);

        if (!string.IsNullOrEmpty(attributes.Name))
            activity.SetTag("workflow.name", attributes.Name);

        if (!string.IsNullOrEmpty(attributes.UserId))
            activity.SetTag("workflow.user_id", attributes.UserId);

        if (!string.IsNullOrEmpty(attributes.SessionId))
            activity.SetTag("workflow.session_id", attributes.SessionId);

        if (attributes.Metadata != null)
        {
            foreach (var metadata in attributes.Metadata)
            {
                activity.SetTag($"workflow.metadata.{metadata.Key}", metadata.Value);
            }
        }

        return activity;
    }

    /// <summary>
    /// Record token usage on an activity
    /// </summary>
    /// <param name="activity">Activity instance</param>
    /// <param name="tokenUsage">Token usage information</param>
    /// <returns>Activity for chaining</returns>
    public static Activity RecordTokenUsage(this Activity activity, TokenUsage tokenUsage)
    {
        activity.SetTag("llm.prompt.tokens", tokenUsage.PromptTokens);
        activity.SetTag("llm.completion.tokens", tokenUsage.CompletionTokens);
        activity.SetTag("llm.total.tokens", tokenUsage.TotalTokens);
        activity.SetTag("llm.model", tokenUsage.Model);
        activity.SetTag("llm.provider", tokenUsage.Provider);

        return activity;
    }

    /// <summary>
    /// Record cost information on an activity
    /// </summary>
    /// <param name="activity">Activity instance</param>
    /// <param name="cost">Cost information</param>
    /// <returns>Activity for chaining</returns>
    public static Activity RecordCost(this Activity activity, Cost cost)
    {
        activity.SetTag("llm.cost.prompt", cost.Prompt);
        activity.SetTag("llm.cost.completion", cost.Completion);
        activity.SetTag("llm.cost.total", cost.Total);
        activity.SetTag("llm.model", cost.Model);
        activity.SetTag("llm.provider", cost.Provider);

        return activity;
    }
}
