#!/usr/bin/env elixir
# Telemetry integration example for the Untrace Elixir SDK

# Get API key from environment variable
api_key = System.get_env("UNTRACE_API_KEY")

if is_nil(api_key) do
  IO.puts("Please set UNTRACE_API_KEY environment variable")
  System.halt(1)
end

IO.puts("=== Telemetry Integration Example ===")

# Attach telemetry handlers
defmodule TelemetryHandlers do
  require Logger

  def attach_handlers do
    # Handler for trace events
    :telemetry.attach(
      "untrace-trace-handler",
      [:untrace, :trace, :event],
      &handle_trace_event/4,
      nil
    )

    # Handler for error events
    :telemetry.attach(
      "untrace-error-handler",
      [:untrace, :error],
      &handle_error_event/4,
      nil
    )

    # Handler for client operations
    :telemetry.attach(
      "untrace-client-handler",
      [:untrace, :client],
      &handle_client_event/4,
      nil
    )
  end

  def handle_trace_event([:untrace, :trace, :event], measurements, metadata, _config) do
    Logger.info("Trace event received: #{inspect(metadata)}")
    IO.puts("📊 Trace Event: #{metadata.event_type} - Count: #{measurements.count}")
  end

  def handle_error_event([:untrace, :error], measurements, metadata, _config) do
    Logger.error("Error event received: #{inspect(metadata)}")
    IO.puts("❌ Error Event: #{metadata.error} - Count: #{measurements.count}")
  end

  def handle_client_event([:untrace, :client, operation], measurements, metadata, _config) do
    Logger.info("Client operation: #{operation} - #{inspect(metadata)}")
    IO.puts("🔧 Client Operation: #{operation} - Status: #{metadata.status} - Duration: #{measurements.duration}μs")
  end
end

# Attach the handlers
TelemetryHandlers.attach_handlers()

# Start the client
{:ok, client} = Untrace.Client.start_link(api_key: api_key)

IO.puts("Telemetry handlers attached. Sending traces...")

# Send some traces to see telemetry events
trace_data = %{
  event_type: "llm_call",
  data: %{
    model: "gpt-4",
    prompt: "Hello, world!",
    response: "Hello! How can I help you today?",
    tokens_used: 25
  },
  metadata: %{
    user_id: "user123",
    session_id: "session456"
  }
}

{:ok, trace} = Untrace.Client.trace(client, trace_data)
IO.puts("✅ Trace sent: #{trace.id}")

# Send another trace
trace_data2 = %{
  event_type: "user_action",
  data: %{
    action: "button_click",
    button_id: "submit"
  },
  metadata: %{
    user_id: "user123"
  }
}

{:ok, trace2} = Untrace.Client.trace(client, trace_data2)
IO.puts("✅ Trace sent: #{trace2.id}")

# Try to get a trace (this will also emit telemetry)
{:ok, retrieved_trace} = Untrace.Client.get_trace(client, trace.id)
IO.puts("✅ Trace retrieved: #{retrieved_trace.id}")

# Send an invalid trace to trigger an error event
IO.puts("Sending invalid trace to trigger error event...")
{:error, reason, message} = Untrace.Client.trace(client, %{invalid: "data"})
IO.puts("❌ Expected error: #{reason} - #{message}")

# Stop the client
Untrace.Client.stop(client)
IO.puts("✅ Client stopped")

# Detach handlers
:telemetry.detach("untrace-trace-handler")
:telemetry.detach("untrace-error-handler")
:telemetry.detach("untrace-client-handler")
IO.puts("✅ Telemetry handlers detached")
