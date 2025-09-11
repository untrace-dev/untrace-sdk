# Untrace SDK for Elixir

LLM observability SDK for Elixir applications.

## Installation

Add `untrace_sdk` to your list of dependencies in `mix.exs`:

```elixir
def deps do
  [
    {:untrace_sdk, "~> 0.1.2"}
  ]
end
```

## Quick Start

```elixir
# Initialize the client
{:ok, client} = Untrace.Client.start_link(api_key: "your-api-key")

# Send a trace event
{:ok, trace} = Untrace.Client.trace(client, %{
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
})

IO.puts("Trace created: #{trace.id}")
```

## Synchronous Usage

```elixir
# Initialize the client
{:ok, client} = Untrace.Client.start_link(api_key: "your-api-key")

# Send a trace event
{:ok, trace} = Untrace.Client.trace(client, %{
  event_type: "llm_call",
  data: %{
    model: "gpt-4",
    prompt: "Hello, world!",
    response: "Hello! How can I help you today?"
  }
})

IO.puts("Trace created: #{trace.id}")

# Stop the client
Untrace.Client.stop(client)
```

## GenServer Usage

```elixir
# Start as part of your supervision tree
children = [
  {Untrace.Client, api_key: "your-api-key", name: :untrace_client}
]

Supervisor.start_link(children, strategy: :one_for_one)

# Use the named process
{:ok, trace} = Untrace.Client.trace(:untrace_client, %{
  event_type: "llm_call",
  data: %{model: "gpt-4", prompt: "Hello!"}
})
```

## API Reference

### Untrace.Client

The main client module for interacting with the Untrace API.

#### Functions

- `start_link/1`: Start a new client process
- `trace/2`: Send a trace event
- `get_trace/2`: Retrieve a trace by ID
- `stop/1`: Stop the client process

#### Configuration

```elixir
%{
  api_key: "your-api-key",           # Required
  base_url: "https://api.untrace.dev", # Optional, defaults to https://api.untrace.dev
  timeout: 30_000,                   # Optional, defaults to 30 seconds
  name: :untrace_client              # Optional, for named process
}
```

## Error Handling

The SDK provides specific error types for different scenarios:

```elixir
case Untrace.Client.trace(client, trace_data) do
  {:ok, trace} ->
    IO.puts("Success: #{trace.id}")

  {:error, :validation_error, message} ->
    IO.puts("Validation error: #{message}")

  {:error, :api_error, message} ->
    IO.puts("API error: #{message}")

  {:error, :network_error, reason} ->
    IO.puts("Network error: #{inspect(reason)}")
end
```

## Telemetry Integration

The SDK emits telemetry events for monitoring:

```elixir
# Listen to trace events
:telemetry.attach(
  "untrace-trace-sent",
  [:untrace, :trace, :sent],
  fn event, measurements, metadata, config ->
    IO.inspect({event, measurements, metadata, config})
  end,
  nil
)

# Listen to errors
:telemetry.attach(
  "untrace-error",
  [:untrace, :error],
  fn event, measurements, metadata, config ->
    IO.inspect({event, measurements, metadata, config})
  end,
  nil
)
```

## Development

### Setup

```bash
# Clone the repository
git clone https://github.com/untrace-dev/untrace-sdk.git
cd untrace-sdk/sdks/elixir

# Install dependencies
mix deps.get
```

### Running Tests

```bash
mix test
```

### Code Formatting

```bash
mix format
mix credo --strict
mix dialyzer
```

### Documentation

```bash
mix docs
```

## License

MIT License - see LICENSE file for details.
