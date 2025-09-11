using System;
using Xunit;
using Untrace;

namespace Untrace.Tests;

public class UntraceTests
{
    [Fact]
    public void UntraceConfig_ShouldHaveDefaultValues()
    {
        // Arrange
        var config = new UntraceConfig();

        // Assert
        Assert.Equal("https://api.untrace.dev", config.BaseUrl);
        Assert.Equal("untrace-app", config.ServiceName);
        Assert.Equal("production", config.Environment);
        Assert.Equal("0.0.0", config.Version);
        Assert.False(config.Debug);
        Assert.False(config.DisableAutoInstrumentation);
        Assert.True(config.CaptureBody);
        Assert.True(config.CaptureErrors);
        Assert.Equal(1.0, config.SamplingRate);
        Assert.Equal(512, config.MaxBatchSize);
        Assert.Equal(5000, config.ExportIntervalMs);
        Assert.Contains("all", config.Providers);
    }

    [Fact]
    public void UntraceConfig_ShouldRequireApiKey()
    {
        // Arrange & Act
        var config = new UntraceConfig();

        // Assert
        Assert.True(string.IsNullOrEmpty(config.ApiKey));
    }

    [Fact]
    public void TraceEvent_ShouldHaveDefaultValues()
    {
        // Arrange
        var traceEvent = new TraceEvent();

        // Assert
        Assert.True(string.IsNullOrEmpty(traceEvent.Id));
        Assert.Equal(default(DateTime), traceEvent.Timestamp);
        Assert.True(string.IsNullOrEmpty(traceEvent.EventType));
        Assert.NotNull(traceEvent.Data);
        Assert.Empty(traceEvent.Data);
        Assert.Null(traceEvent.Metadata);
    }

    [Fact]
    public void TokenUsage_ShouldHaveDefaultValues()
    {
        // Arrange
        var tokenUsage = new TokenUsage();

        // Assert
        Assert.Equal(0, tokenUsage.PromptTokens);
        Assert.Equal(0, tokenUsage.CompletionTokens);
        Assert.Equal(0, tokenUsage.TotalTokens);
        Assert.True(string.IsNullOrEmpty(tokenUsage.Model));
        Assert.True(string.IsNullOrEmpty(tokenUsage.Provider));
    }

    [Fact]
    public void Cost_ShouldHaveDefaultValues()
    {
        // Arrange
        var cost = new Cost();

        // Assert
        Assert.Equal(0, cost.Prompt);
        Assert.Equal(0, cost.Completion);
        Assert.Equal(0, cost.Total);
        Assert.True(string.IsNullOrEmpty(cost.Model));
        Assert.True(string.IsNullOrEmpty(cost.Provider));
    }

    [Fact]
    public void LLMSpanAttributes_ShouldHaveDefaultValues()
    {
        // Arrange
        var attributes = new LLMSpanAttributes();

        // Assert
        Assert.True(string.IsNullOrEmpty(attributes.Provider));
        Assert.True(string.IsNullOrEmpty(attributes.Model));
        Assert.True(string.IsNullOrEmpty(attributes.Operation));
        Assert.Null(attributes.PromptTokens);
        Assert.Null(attributes.CompletionTokens);
        Assert.Null(attributes.TotalTokens);
        Assert.Null(attributes.Cost);
    }

    [Fact]
    public void WorkflowAttributes_ShouldHaveDefaultValues()
    {
        // Arrange
        var attributes = new WorkflowAttributes();

        // Assert
        Assert.True(string.IsNullOrEmpty(attributes.Id));
        Assert.True(string.IsNullOrEmpty(attributes.Name));
        Assert.Null(attributes.UserId);
        Assert.Null(attributes.SessionId);
        Assert.Null(attributes.Metadata);
    }

    [Fact]
    public void UntraceClient_ShouldThrowOnEmptyApiKey()
    {
        // Arrange & Act & Assert
        Assert.Throws<ArgumentException>(() => new UntraceClient(""));
        Assert.Throws<ArgumentException>(() => new UntraceClient(null!));
    }

    [Fact]
    public void UntraceSdk_ShouldThrowOnNullConfig()
    {
        // Arrange & Act & Assert
        Assert.Throws<ArgumentNullException>(() => new Untrace(null!));
    }

    [Fact]
    public void UntraceSdk_ShouldThrowOnEmptyApiKey()
    {
        // Arrange
        var config = new UntraceConfig { ApiKey = "" };

        // Act & Assert
        Assert.Throws<ArgumentException>(() => new Untrace(config));
    }

    [Fact]
    public void UntraceSdk_GetInstance_ShouldThrowWhenNotInitialized()
    {
        // Arrange & Act & Assert
        Assert.Throws<InvalidOperationException>(() => UntraceSdk.GetInstance());
    }

    [Fact]
    public void UntraceSdk_IsInitialized_ShouldReturnFalseByDefault()
    {
        // Arrange & Act
        var isInitialized = UntraceSdk.IsInitialized();

        // Assert
        Assert.False(isInitialized);
    }
}
