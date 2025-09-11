#!/usr/bin/env elixir
# Supervision tree example for the Untrace Elixir SDK

# Get API key from environment variable
api_key = System.get_env("UNTRACE_API_KEY")

if is_nil(api_key) do
  IO.puts("Please set UNTRACE_API_KEY environment variable")
  System.halt(1)
end

IO.puts("=== Supervision Tree Example ===")

# Define a simple application that uses Untrace
defmodule MyApp do
  use Application

  def start(_type, _args) do
    children = [
      # Start the Untrace client as part of the supervision tree
      {Untrace.Client, [api_key: api_key, name: :untrace_client]},
      # Your other application processes
      {MyApp.Worker, []}
    ]

    Supervisor.start_link(children, strategy: :one_for_one, name: MyApp.Supervisor)
  end
end

# Define a worker that uses the Untrace client
defmodule MyApp.Worker do
  use GenServer
  require Logger

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  def init(_opts) do
    # Start a periodic task to send traces
    :timer.send_interval(5000, :send_trace)
    {:ok, %{}}
  end

  def handle_info(:send_trace, state) do
    # Send a trace using the named client
    trace_data = %{
      event_type: "periodic_task",
      data: %{
        task: "health_check",
        timestamp: DateTime.utc_now() |> DateTime.to_iso8601(),
        status: "healthy"
      },
      metadata: %{
        worker: "MyApp.Worker",
        pid: inspect(self())
      }
    }

    case Untrace.Client.trace(:untrace_client, trace_data) do
      {:ok, trace} ->
        Logger.info("Periodic trace sent: #{trace.id}")
        {:noreply, state}

      {:error, reason, message} ->
        Logger.error("Failed to send trace: #{reason} - #{message}")
        {:noreply, state}
    end
  end
end

# Start the application
IO.puts("Starting application with supervision tree...")
{:ok, _pid} = MyApp.start(:normal, [])

# Let it run for a bit
IO.puts("Application running... Press Ctrl+C to stop")
Process.sleep(15000)

IO.puts("Stopping application...")
System.halt(0)
