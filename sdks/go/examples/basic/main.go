package main

import (
	"context"
	"fmt"
	"log"
	"time"

	untrace "github.com/untrace-dev/untrace-sdk-go"
)

func main() {
	// Initialize the SDK
	client, err := untrace.Init(untrace.Config{
		APIKey:      "your-api-key-here",
		ServiceName: "my-llm-app",
		Environment: "development",
		Debug:       true,
	})
	if err != nil {
		log.Fatal(err)
	}
	defer client.Shutdown(context.Background())

	// Example 1: Basic LLM span
	ctx, span := client.Tracer().StartLLMSpan(context.Background(), "chat-completion", untrace.LLMSpanOptions{
		Provider:  "openai",
		Model:     "gpt-3.5-turbo",
		Operation: untrace.LLMOperationChat,
	})
	defer span.End()

	// Simulate some work
	time.Sleep(100 * time.Millisecond)

	// Add custom attributes
	span.SetAttributes(
		untrace.String("user.id", "user-123"),
		untrace.String("session.id", "session-456"),
		untrace.Int("llm.prompt.tokens", 50),
		untrace.Int("llm.completion.tokens", 25),
		untrace.Int("llm.total.tokens", 75),
	)

	fmt.Println("Basic LLM span completed")

	// Example 2: Workflow tracking
	workflow := client.Context().StartWorkflow("customer-support-chat", "workflow-789", untrace.WorkflowOptions{
		UserID:    "user-123",
		SessionID: "session-456",
		Metadata: map[string]interface{}{
			"tier":      "premium",
			"language":  "en",
			"category":  "billing",
		},
	})
	defer workflow.End()

	// Simulate multiple LLM calls within the workflow
	for i := 0; i < 3; i++ {
		ctx, span := client.Tracer().StartLLMSpan(workflow.Context(), fmt.Sprintf("llm-call-%d", i+1), untrace.LLMSpanOptions{
			Provider:  "openai",
			Model:     "gpt-4",
			Operation: untrace.LLMOperationChat,
		})

		// Simulate work
		time.Sleep(50 * time.Millisecond)

		span.End()
	}

	fmt.Println("Workflow completed")

	// Example 3: Metrics recording
	client.Metrics().RecordTokenUsage(untrace.TokenUsage{
		PromptTokens:     150,
		CompletionTokens: 50,
		TotalTokens:      200,
		Model:            "gpt-3.5-turbo",
		Provider:         "openai",
	})

	client.Metrics().RecordCost(untrace.Cost{
		Prompt:     0.0015,
		Completion: 0.002,
		Total:      0.0035,
		Model:      "gpt-3.5-turbo",
		Provider:   "openai",
		Currency:   "USD",
	})

	client.Metrics().RecordLatency(250*time.Millisecond, map[string]interface{}{
		"provider":  "openai",
		"operation": "chat",
		"model":     "gpt-3.5-turbo",
	})

	fmt.Println("Metrics recorded")

	// Example 4: Custom span
	ctx, customSpan := client.Tracer().StartSpan(context.Background(), "custom-operation", untrace.SpanOptions{
		Attributes: map[string]interface{}{
			"operation.type": "data-processing",
			"records.count":  1000,
			"batch.size":     100,
		},
	})
	defer customSpan.End()

	// Simulate work
	time.Sleep(75 * time.Millisecond)

	fmt.Println("Custom span completed")

	// Flush to ensure all spans are sent
	if err := client.Flush(context.Background()); err != nil {
		log.Printf("Failed to flush: %v", err)
	}

	fmt.Println("All examples completed successfully!")
}
