package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	untrace "github.com/untrace-dev/untrace-sdk-go"
)

func main() {
	// Set environment variables for demonstration
	os.Setenv("UNTRACE_API_KEY", "your-api-key-here")
	os.Setenv("UNTRACE_SERVICE_NAME", "env-example")
	os.Setenv("UNTRACE_ENVIRONMENT", "production")
	os.Setenv("UNTRACE_VERSION", "1.0.0")
	os.Setenv("UNTRACE_DEBUG", "true")
	os.Setenv("UNTRACE_SAMPLING_RATE", "0.8")
	os.Setenv("UNTRACE_MAX_BATCH_SIZE", "256")
	os.Setenv("UNTRACE_EXPORT_INTERVAL", "3s")

	// Initialize from environment variables
	client, err := untrace.InitFromEnv()
	if err != nil {
		log.Fatal(err)
	}
	defer client.Shutdown(context.Background())

	fmt.Println("SDK initialized from environment variables")

	// Demonstrate that the configuration was loaded from environment
	// Note: In a real implementation, you would expose these values through the Client interface
	fmt.Println("SDK configuration loaded from environment variables")

	// Create some spans to demonstrate the configuration
	ctx, span := client.Tracer().StartLLMSpan(context.Background(), "env-test-span", untrace.LLMSpanOptions{
		Provider:  "openai",
		Model:     "gpt-3.5-turbo",
		Operation: untrace.LLMOperationChat,
	})
	defer span.End()

	// Simulate some work
	time.Sleep(100 * time.Millisecond)

	// Add some attributes
	span.SetAttributes(
		untrace.String("test.type", "environment_configuration"),
		untrace.Bool("env.loaded", true),
	)

	fmt.Println("Environment configuration test completed")

	// Flush to ensure all spans are sent
	if err := client.Flush(context.Background()); err != nil {
		log.Printf("Failed to flush: %v", err)
	}

	fmt.Println("Environment example completed successfully!")
}
