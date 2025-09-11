package main

import (
	"context"
	"fmt"
	"log"
	"time"

	untrace "github.com/untrace-dev/untrace-sdk-go"
)

// MockOpenAIClient simulates an OpenAI client
type MockOpenAIClient struct {
	APIKey string
}

func (c *MockOpenAIClient) CreateChatCompletion(ctx context.Context, request ChatCompletionRequest) (*ChatCompletionResponse, error) {
	// Simulate API call
	time.Sleep(100 * time.Millisecond)

	return &ChatCompletionResponse{
		ID: "chatcmpl-123",
		Choices: []ChatChoice{
			{
				Message: ChatMessage{
					Role:    "assistant",
					Content: "Hello! How can I help you today?",
				},
				FinishReason: "stop",
			},
		},
		Usage: Usage{
			PromptTokens:     50,
			CompletionTokens: 25,
			TotalTokens:      75,
		},
	}, nil
}

// Mock request/response types
type ChatCompletionRequest struct {
	Model    string        `json:"model"`
	Messages []ChatMessage `json:"messages"`
}

type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type ChatCompletionResponse struct {
	ID      string       `json:"id"`
	Choices []ChatChoice `json:"choices"`
	Usage   Usage        `json:"usage"`
}

type ChatChoice struct {
	Message      ChatMessage `json:"message"`
	FinishReason string      `json:"finish_reason"`
}

type Usage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

func main() {
	// Initialize the SDK
	client, err := untrace.Init(untrace.Config{
		APIKey:      "your-api-key-here",
		ServiceName: "instrumentation-example",
		Environment: "development",
		Debug:       true,
	})
	if err != nil {
		log.Fatal(err)
	}
	defer client.Shutdown(context.Background())

	// Create instrumentation helper
	instrumentation := untrace.NewInstrumentation(client, untrace.DefaultInstrumentationConfig())

	// Create a mock OpenAI client
	openaiClient := &MockOpenAIClient{
		APIKey: "sk-1234567890",
	}

	// Example 1: Instrumented function call
	err = instrumentation.TraceFunction(
		context.Background(),
		"processUserQuery",
		func(ctx context.Context) error {
			// Simulate some processing
			time.Sleep(50 * time.Millisecond)
			return nil
		},
		untrace.String("user.id", "user-123"),
		untrace.String("query.type", "general"),
	)
	if err != nil {
		log.Printf("Error in processUserQuery: %v", err)
	}

	// Example 2: Instrumented LLM call
	err = instrumentation.TraceLLMCall(
		context.Background(),
		"openai-chat-completion",
		untrace.LLMSpanOptions{
			Provider:  "openai",
			Model:     "gpt-3.5-turbo",
			Operation: untrace.LLMOperationChat,
		},
		func(ctx context.Context) error {
			// Simulate the actual LLM call
			_, err := openaiClient.CreateChatCompletion(ctx, ChatCompletionRequest{
				Model: "gpt-3.5-turbo",
				Messages: []ChatMessage{
					{
						Role:    "user",
						Content: "Hello, how are you?",
					},
				},
			})
			return err
		},
	)
	if err != nil {
		log.Printf("Error in LLM call: %v", err)
	}

	// Example 3: Instrumented HTTP request
	err = instrumentation.TraceHTTPRequest(
		context.Background(),
		"POST",
		"https://api.openai.com/v1/chat/completions",
		func(ctx context.Context) error {
			// Simulate HTTP request
			time.Sleep(75 * time.Millisecond)
			return nil
		},
	)
	if err != nil {
		log.Printf("Error in HTTP request: %v", err)
	}

	// Example 4: Instrumented database query
	err = instrumentation.TraceDatabaseQuery(
		context.Background(),
		"SELECT",
		"users",
		func(ctx context.Context) error {
			// Simulate database query
			time.Sleep(25 * time.Millisecond)
			return nil
		},
	)
	if err != nil {
		log.Printf("Error in database query: %v", err)
	}

	// Example 5: Instrumented workflow
	err = instrumentation.TraceWorkflow(
		context.Background(),
		"customer-support-workflow",
		"workflow-123",
		untrace.WorkflowOptions{
			UserID:    "user-456",
			SessionID: "session-789",
			Metadata: map[string]interface{}{
				"priority": "high",
				"category": "technical",
			},
		},
		func(ctx context.Context) error {
			// Simulate workflow steps
			steps := []string{"analyze_query", "search_knowledge_base", "generate_response", "log_interaction"}

			for i, step := range steps {
				stepCtx, span := client.Tracer().StartSpan(ctx, step, untrace.SpanOptions{
					Attributes: map[string]interface{}{
						"workflow.step":     i + 1,
						"workflow.step.name": step,
					},
				})

				// Simulate step work
				time.Sleep(30 * time.Millisecond)

				span.End()
			}

			return nil
		},
	)
	if err != nil {
		log.Printf("Error in workflow: %v", err)
	}

	// Example 6: Provider instrumentation
	registry := untrace.NewProviderRegistry()
	untrace.RegisterDefaultProviders(registry)

	// Try to instrument the OpenAI client
	instrumentedClient, err := registry.Instrument("openai", openaiClient)
	if err != nil {
		log.Printf("Failed to instrument OpenAI client: %v", err)
	} else {
		fmt.Printf("Successfully instrumented client: %T\n", instrumentedClient)
	}

	// Flush to ensure all spans are sent
	if err := client.Flush(context.Background()); err != nil {
		log.Printf("Failed to flush: %v", err)
	}

	fmt.Println("All instrumentation examples completed successfully!")
}
