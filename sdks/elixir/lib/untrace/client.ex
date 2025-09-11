defmodule Untrace.Client do
  @moduledoc """
  Main client for interacting with the Untrace API.

  This module provides a GenServer-based client that handles HTTP requests
  to the Untrace API for tracing LLM calls and other events.
  """

  use GenServer
  require Logger

  @default_base_url "https://api.untrace.dev"
  @default_timeout 30_000

  defstruct [
    :api_key,
    :base_url,
    :timeout,
    :http_client
  ]

  @type t :: %__MODULE__{
          api_key: String.t(),
          base_url: String.t(),
          timeout: non_neg_integer(),
          http_client: module()
        }

  @type trace_data :: %{
          event_type: String.t(),
          data: map(),
          metadata: map() | nil
        }

  @type trace_event :: %{
          id: String.t(),
          timestamp: DateTime.t(),
          event_type: String.t(),
          data: map(),
          metadata: map() | nil
        }

  @type client_result :: {:ok, trace_event()} | {:error, atom(), String.t()}

  ## Client API

  @doc """
  Start a new Untrace client process.

  ## Options

  - `:api_key` - Your Untrace API key (required)
  - `:base_url` - Base URL for the Untrace API (optional, defaults to "https://api.untrace.dev")
  - `:timeout` - Request timeout in milliseconds (optional, defaults to 30000)
  - `:name` - Name for the process (optional)

  ## Examples

      {:ok, client} = Untrace.Client.start_link(api_key: "your-api-key")
      {:ok, client} = Untrace.Client.start_link(api_key: "your-api-key", name: :untrace_client)
  """
  @spec start_link(keyword()) :: GenServer.on_start()
  def start_link(opts) do
    api_key = Keyword.fetch!(opts, :api_key)
    base_url = Keyword.get(opts, :base_url, @default_base_url)
    timeout = Keyword.get(opts, :timeout, @default_timeout)
    name = Keyword.get(opts, :name)

    state = %__MODULE__{
      api_key: api_key,
      base_url: String.trim_trailing(base_url, "/"),
      timeout: timeout,
      http_client: Req
    }

    if name do
      GenServer.start_link(__MODULE__, state, name: name)
    else
      GenServer.start_link(__MODULE__, state)
    end
  end

  @doc """
  Send a trace event to Untrace.

  ## Parameters

  - `client` - The client process (PID or registered name)
  - `trace_data` - Map containing:
    - `:event_type` - Type of the event (e.g., "llm_call", "user_action")
    - `:data` - Event data payload
    - `:metadata` - Optional metadata for the event

  ## Examples

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
  """
  @spec trace(GenServer.server(), trace_data()) :: client_result()
  def trace(client, trace_data) do
    GenServer.call(client, {:trace, trace_data})
  end

  @doc """
  Retrieve a trace by ID.

  ## Parameters

  - `client` - The client process (PID or registered name)
  - `trace_id` - The ID of the trace to retrieve

  ## Examples

      {:ok, trace} = Untrace.Client.get_trace(client, "trace-123")
  """
  @spec get_trace(GenServer.server(), String.t()) :: client_result()
  def get_trace(client, trace_id) do
    GenServer.call(client, {:get_trace, trace_id})
  end

  @doc """
  Stop the client process.

  ## Parameters

  - `client` - The client process (PID or registered name)

  ## Examples

      Untrace.Client.stop(client)
  """
  @spec stop(GenServer.server()) :: :ok
  def stop(client) do
    GenServer.stop(client)
  end

  ## GenServer Callbacks

  @impl true
  def init(state) do
    Logger.info("Untrace client started")
    {:ok, state}
  end

  @impl true
  def handle_call({:trace, trace_data}, _from, state) do
    result = send_trace(state, trace_data)
    {:reply, result, state}
  end

  @impl true
  def handle_call({:get_trace, trace_id}, _from, state) do
    result = get_trace_by_id(state, trace_id)
    {:reply, result, state}
  end

  @impl true
  def handle_call(:stop, _from, state) do
    {:stop, :normal, :ok, state}
  end

  @impl true
  def terminate(_reason, _state) do
    Logger.info("Untrace client stopped")
    :ok
  end

  ## Private Functions

  defp send_trace(state, trace_data) do
    with :ok <- validate_trace_data(trace_data),
         payload <- build_trace_payload(trace_data),
         {:ok, response} <- make_request(state, :post, "/api/v1/traces", payload) do
      trace_event = build_trace_event(response)
      emit_telemetry(:trace_sent, %{trace_id: trace_event.id}, %{event_type: trace_data.event_type})
      {:ok, trace_event}
    else
      {:error, :validation_error, message} ->
        emit_telemetry(:validation_error, %{}, %{error: message})
        {:error, :validation_error, message}

      {:error, :api_error, message} ->
        emit_telemetry(:api_error, %{}, %{error: message})
        {:error, :api_error, message}

      {:error, :network_error, reason} ->
        emit_telemetry(:network_error, %{}, %{error: reason})
        {:error, :network_error, reason}
    end
  end

  defp get_trace_by_id(state, trace_id) do
    case make_request(state, :get, "/api/v1/traces/#{trace_id}") do
      {:ok, response} ->
        trace_event = build_trace_event(response)
        {:ok, trace_event}

      {:error, :api_error, message} ->
        emit_telemetry(:api_error, %{}, %{error: message})
        {:error, :api_error, message}

      {:error, :network_error, reason} ->
        emit_telemetry(:network_error, %{}, %{error: reason})
        {:error, :network_error, reason}
    end
  end

  defp validate_trace_data(%{event_type: event_type, data: data}) when is_binary(event_type) and is_map(data) do
    :ok
  end

  defp validate_trace_data(_) do
    {:error, :validation_error, "Invalid trace data: event_type must be a string and data must be a map"}
  end

  defp build_trace_payload(%{event_type: event_type, data: data, metadata: metadata}) do
    %{
      event_type: event_type,
      data: data,
      metadata: metadata || %{},
      timestamp: DateTime.utc_now() |> DateTime.to_iso8601()
    }
  end

  defp build_trace_event(response) do
    %{
      id: response["id"],
      timestamp: parse_timestamp(response["timestamp"]),
      event_type: response["event_type"],
      data: response["data"],
      metadata: response["metadata"]
    }
  end

  defp parse_timestamp(timestamp) when is_binary(timestamp) do
    case DateTime.from_iso8601(timestamp) do
      {:ok, datetime, _} -> datetime
      {:error, _} -> DateTime.utc_now()
    end
  end

  defp parse_timestamp(_), do: DateTime.utc_now()

  defp make_request(state, method, path, body \\ nil) do
    url = state.base_url <> path
    headers = build_headers(state.api_key)

    request_opts = [
      method: method,
      url: url,
      headers: headers,
      receive_timeout: state.timeout,
      retry: false
    ]

    request_opts = if body, do: Keyword.put(request_opts, :json, body), else: request_opts

    case Req.request(request_opts) do
      {:ok, %{status: status, body: response_body}} when status in 200..299 ->
        {:ok, response_body}

      {:ok, %{status: 422, body: response_body}} ->
        error_message = extract_error_message(response_body)
        {:error, :validation_error, error_message}

      {:ok, %{status: status, body: response_body}} ->
        error_message = extract_error_message(response_body)
        {:error, :api_error, "API request failed with status #{status}: #{error_message}"}

      {:error, reason} ->
        {:error, :network_error, reason}
    end
  end

  defp build_headers(api_key) do
    [
      {"Authorization", "Bearer #{api_key}"},
      {"Content-Type", "application/json"},
      {"User-Agent", "untrace-sdk-elixir/#{Untrace.version()}"}
    ]
  end

  defp extract_error_message(response_body) when is_map(response_body) do
    case response_body do
      %{"message" => message} when is_binary(message) -> message
      %{"error" => error} when is_binary(error) -> error
      _ -> "Unknown error"
    end
  end

  defp extract_error_message(response_body) when is_binary(response_body) do
    response_body
  end

  defp extract_error_message(_), do: "Unknown error"

  defp emit_telemetry(event, measurements, metadata) do
    :telemetry.execute([:untrace, event], measurements, metadata)
  end
end
