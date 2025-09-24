defmodule Untrace.Types do
  @moduledoc """
  Type definitions and validation schemas for the Untrace SDK.
  """

  @doc """
  Returns the trace data schema for validation.
  """
  def trace_schema do
    %{
      event_type: :string,
      data: :map,
      metadata: {:optional, :map}
    }
  end

  @doc """
  Validates trace data against the schema.

  ## Examples

      iex> Untrace.Types.validate_trace_data(%{event_type: "llm_call", data: %{}})
      :ok

      iex> Untrace.Types.validate_trace_data(%{event_type: "llm_call"})
      {:error, :validation_error, "Missing required field: data"}

      iex> Untrace.Types.validate_trace_data(%{data: %{}})
      {:error, :validation_error, "Missing required field: event_type"}
  """
  @spec validate_trace_data(map()) :: :ok | {:error, :validation_error, String.t()}
  def validate_trace_data(data) when is_map(data) do
    with :ok <- validate_required_field(data, :event_type, :string),
         :ok <- validate_required_field(data, :data, :map),
         :ok <- validate_optional_field(data, :metadata, :map) do
      :ok
    end
  end

  def validate_trace_data(_) do
    {:error, :validation_error, "Trace data must be a map"}
  end

  @doc """
  Creates a trace data map with proper structure.

  ## Examples

      iex> Untrace.Types.create_trace_data("llm_call", %{model: "gpt-4"})
      %{event_type: "llm_call", data: %{model: "gpt-4"}, metadata: %{}}

      iex> Untrace.Types.create_trace_data("llm_call", %{model: "gpt-4"}, %{user_id: "123"})
      %{event_type: "llm_call", data: %{model: "gpt-4"}, metadata: %{user_id: "123"}}
  """
  @spec create_trace_data(String.t(), map(), map() | nil) :: map()
  def create_trace_data(event_type, data, metadata \\ nil) when is_binary(event_type) and is_map(data) do
    %{
      event_type: event_type,
      data: data,
      metadata: metadata || %{}
    }
  end

  @doc """
  Creates LLM-specific trace data with common attributes.

  ## Examples

      iex> Untrace.Types.create_llm_trace("gpt-4", "Hello", "Hi there", 10, 5)
      %{
        event_type: "llm_call",
        data: %{
          model: "gpt-4",
          prompt: "Hello",
          response: "Hi there",
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15
        },
        metadata: %{}
      }
  """
  @spec create_llm_trace(String.t(), String.t(), String.t(), non_neg_integer(), non_neg_integer(), map() | nil) :: map()
  def create_llm_trace(model, prompt, response, prompt_tokens, completion_tokens, metadata \\ nil) do
    create_trace_data("llm_call", %{
      model: model,
      prompt: prompt,
      response: response,
      prompt_tokens: prompt_tokens,
      completion_tokens: completion_tokens,
      total_tokens: prompt_tokens + completion_tokens
    }, metadata)
  end

  @doc """
  Creates user action trace data.

  ## Examples

      iex> Untrace.Types.create_user_action_trace("button_click", %{button_id: "submit"})
      %{
        event_type: "user_action",
        data: %{
          action: "button_click",
          button_id: "submit"
        },
        metadata: %{}
      }
  """
  @spec create_user_action_trace(String.t(), map(), map() | nil) :: map()
  def create_user_action_trace(action, action_data, metadata \\ nil) do
    create_trace_data("user_action", Map.put(action_data, :action, action), metadata)
  end

  @doc """
  Creates API call trace data.

  ## Examples

      iex> Untrace.Types.create_api_call_trace("GET", "/api/users", 200, 150)
      %{
        event_type: "api_call",
        data: %{
          method: "GET",
          endpoint: "/api/users",
          status_code: 200,
          response_time_ms: 150
        },
        metadata: %{}
      }
  """
  @spec create_api_call_trace(String.t(), String.t(), non_neg_integer(), non_neg_integer(), map() | nil) :: map()
  def create_api_call_trace(method, endpoint, status_code, response_time_ms, metadata \\ nil) do
    create_trace_data("api_call", %{
      method: method,
      endpoint: endpoint,
      status_code: status_code,
      response_time_ms: response_time_ms
    }, metadata)
  end

  ## Private Functions

  defp validate_required_field(data, field, expected_type) do
    case Map.get(data, field) do
      nil ->
        {:error, :validation_error, "Missing required field: #{field}"}

      value ->
        validate_field_type(field, value, expected_type)
    end
  end

  defp validate_optional_field(data, field, expected_type) do
    case Map.get(data, field) do
      nil -> :ok
      value -> validate_field_type(field, value, expected_type)
    end
  end

  defp validate_field_type(_field, value, :string) when is_binary(value), do: :ok
  defp validate_field_type(_field, value, :map) when is_map(value), do: :ok

  defp validate_field_type(field, value, expected_type) do
    {:error, :validation_error, "Field #{field} must be of type #{expected_type}, got #{inspect(value)}"}
  end
end
