#!/usr/bin/env elixir
# Basic usage example for the Untrace Elixir SDK

# Get API key from environment variable
api_key = System.get_env("UNTRACE_API_KEY")

if is_nil(api_key) do
  IO.puts("Please set UNTRACE_API_KEY environment variable")
  System.halt(1)
end

# Start the client
{:ok, client} = Untrace.Client.start_link(api_key: api_key)

IO.puts("=== Basic Usage Example ===")

# Example 1: Trace an LLM call
IO.puts("Tracing LLM call...")
{:ok, trace} = Untrace.Client.trace(client, %{
  event_type: "llm_call",
  data: %{
    model: "gpt-4",
    prompt: "What is the capital of France?",
    response: "The capital of France is Paris.",
    tokens_used: 15,
    cost: 0.0003
  },
  metadata: %{
    user_id: "user123",
    session_id: "session456",
    request_id: "req789"
  }
})
IO.puts("✅ LLM call traced: #{trace.id}")

# Example 2: Trace a user action
IO.puts("Tracing user action...")
{:ok, trace} = Untrace.Client.trace(client, %{
  event_type: "user_action",
  data: %{
    action: "button_click",
    button_id: "submit_form",
    page: "/dashboard"
  },
  metadata: %{
    user_id: "user123",
    session_id: "session456",
    timestamp: "2023-01-01T12:00:00Z"
  }
})
IO.puts("✅ User action traced: #{trace.id}")

# Example 3: Retrieve a trace
IO.puts("Retrieving trace: #{trace.id}")
{:ok, retrieved_trace} = Untrace.Client.get_trace(client, trace.id)
IO.puts("✅ Retrieved trace: #{retrieved_trace.event_type}")

# Example 4: Using helper functions
IO.puts("Using helper functions...")

# Create LLM trace using helper
llm_trace = Untrace.Types.create_llm_trace(
  "gpt-3.5-turbo",
  "Hello, world!",
  "Hello! How can I help you today?",
  10,
  5,
  %{user_id: "user123"}
)

{:ok, trace} = Untrace.Client.trace(client, llm_trace)
IO.puts("✅ LLM trace created with helper: #{trace.id}")

# Create user action trace using helper
user_trace = Untrace.Types.create_user_action_trace(
  "button_click",
  %{button_id: "submit", page: "/form"},
  %{user_id: "user123"}
)

{:ok, trace} = Untrace.Client.trace(client, user_trace)
IO.puts("✅ User action trace created with helper: #{trace.id}")

# Create API call trace using helper
api_trace = Untrace.Types.create_api_call_trace(
  "GET",
  "/api/v1/users",
  200,
  150,
  %{user_id: "user123"}
)

{:ok, trace} = Untrace.Client.trace(client, api_trace)
IO.puts("✅ API call trace created with helper: #{trace.id}")

# Stop the client
Untrace.Client.stop(client)
IO.puts("✅ Client stopped")
