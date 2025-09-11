defmodule Untrace.Telemetry do
  @moduledoc """
  Telemetry integration for the Untrace SDK.

  This module provides telemetry events for monitoring SDK behavior
  and integrating with external monitoring systems.
  """

  require Logger

  @doc """
  Emit a trace event telemetry event.

  ## Parameters

  - `event_type` - Type of the trace event
  - `data` - Event data
  - `metadata` - Additional metadata

  ## Examples

      Untrace.Telemetry.emit_trace_event("llm_call", %{model: "gpt-4"}, %{user_id: "123"})
  """
  @spec emit_trace_event(String.t(), map(), map()) :: :ok
  def emit_trace_event(event_type, data, metadata \\ %{}) do
    :telemetry.execute(
      [:untrace, :trace, :event],
      %{count: 1},
      Map.merge(metadata, %{event_type: event_type, data: data})
    )
  end

  @doc """
  Emit an error event telemetry event.

  ## Parameters

  - `error` - The error that occurred
  - `context` - Additional context about the error

  ## Examples

      Untrace.Telemetry.emit_error_event(%RuntimeError{message: "Something went wrong"}, %{operation: "trace"})
  """
  @spec emit_error_event(any(), map()) :: :ok
  def emit_error_event(error, context \\ %{}) do
    error_info = %{
      error: inspect(error),
      error_type: error.__struct__,
      message: error_message(error)
    }

    :telemetry.execute(
      [:untrace, :error],
      %{count: 1},
      Map.merge(context, error_info)
    )
  end

  @doc """
  Emit a client operation telemetry event.

  ## Parameters

  - `operation` - The operation being performed (e.g., :trace, :get_trace)
  - `status` - Status of the operation (:success, :error)
  - `duration` - Duration of the operation in microseconds
  - `metadata` - Additional metadata

  ## Examples

      Untrace.Telemetry.emit_client_operation(:trace, :success, 1000, %{event_type: "llm_call"})
  """
  @spec emit_client_operation(atom(), atom(), non_neg_integer(), map()) :: :ok
  def emit_client_operation(operation, status, duration, metadata \\ %{}) do
    :telemetry.execute(
      [:untrace, :client, operation],
      %{duration: duration, count: 1},
      Map.put(metadata, :status, status)
    )
  end

  @doc """
  Emit a batch export telemetry event.

  ## Parameters

  - `batch_size` - Number of spans in the batch
  - `duration` - Duration of the export in microseconds
  - `status` - Status of the export (:success, :error)
  - `metadata` - Additional metadata

  ## Examples

      Untrace.Telemetry.emit_batch_export(100, 5000, :success, %{})
  """
  @spec emit_batch_export(non_neg_integer(), non_neg_integer(), atom(), map()) :: :ok
  def emit_batch_export(batch_size, duration, status, metadata \\ %{}) do
    :telemetry.execute(
      [:untrace, :batch, :export],
      %{batch_size: batch_size, duration: duration, count: 1},
      Map.put(metadata, :status, status)
    )
  end

  @doc """
  Emit a configuration change telemetry event.

  ## Parameters

  - `changed_keys` - List of configuration keys that changed
  - `metadata` - Additional metadata

  ## Examples

      Untrace.Telemetry.emit_config_change([:api_key, :debug], %{})
  """
  @spec emit_config_change([atom()], map()) :: :ok
  def emit_config_change(changed_keys, metadata \\ %{}) do
    :telemetry.execute(
      [:untrace, :config, :change],
      %{changed_count: length(changed_keys), count: 1},
      Map.put(metadata, :changed_keys, changed_keys)
    )
  end

  @doc """
  Attach a telemetry handler for trace events.

  ## Parameters

  - `handler_id` - Unique identifier for the handler
  - `fun` - Function to call when events are received
  - `config` - Handler configuration

  ## Examples

      handler = fn event, measurements, metadata, config ->
        IO.inspect({event, measurements, metadata, config})
      end

      Untrace.Telemetry.attach_trace_handler(:my_handler, handler, %{})
  """
  @spec attach_trace_handler(any(), function(), map()) :: :ok
  def attach_trace_handler(handler_id, fun, config \\ %{}) do
    :telemetry.attach(handler_id, [:untrace, :trace, :event], fun, config)
  end

  @doc """
  Attach a telemetry handler for error events.

  ## Parameters

  - `handler_id` - Unique identifier for the handler
  - `fun` - Function to call when events are received
  - `config` - Handler configuration

  ## Examples

      handler = fn event, measurements, metadata, config ->
        Logger.error("Untrace error: #{inspect(metadata)}")
      end

      Untrace.Telemetry.attach_error_handler(:my_error_handler, handler, %{})
  """
  @spec attach_error_handler(any(), function(), map()) :: :ok
  def attach_error_handler(handler_id, fun, config \\ %{}) do
    :telemetry.attach(handler_id, [:untrace, :error], fun, config)
  end

  @doc """
  Attach a telemetry handler for client operations.

  ## Parameters

  - `handler_id` - Unique identifier for the handler
  - `fun` - Function to call when events are received
  - `config` - Handler configuration

  ## Examples

      handler = fn event, measurements, metadata, config ->
        Logger.info("Client operation: #{inspect(metadata)}")
      end

      Untrace.Telemetry.attach_client_handler(:my_client_handler, handler, %{})
  """
  @spec attach_client_handler(any(), function(), map()) :: :ok
  def attach_client_handler(handler_id, fun, config \\ %{}) do
    :telemetry.attach(handler_id, [:untrace, :client], fun, config)
  end

  @doc """
  Detach a telemetry handler.

  ## Parameters

  - `handler_id` - The handler identifier to detach

  ## Examples

      Untrace.Telemetry.detach_handler(:my_handler)
  """
  @spec detach_handler(any()) :: boolean()
  def detach_handler(handler_id) do
    :telemetry.detach(handler_id)
  end

  ## Private Functions

  defp error_message(%{message: message}) when is_binary(message), do: message
  defp error_message(error) when is_exception(error), do: Exception.message(error)
  defp error_message(_), do: "Unknown error"
end
