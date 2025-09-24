defmodule Untrace.Attributes do
  @moduledoc """
  Attribute definitions and utilities for the Untrace SDK.

  This module provides standardized attribute names and helper functions
  for creating and managing trace attributes.
  """

  # LLM Attributes
  @llm_model "llm.model"
  @llm_provider "llm.provider"
  @llm_operation "llm.operation"
  @llm_prompt_tokens "llm.prompt.tokens"
  @llm_completion_tokens "llm.completion.tokens"
  @llm_total_tokens "llm.total.tokens"
  @llm_prompt "llm.prompt"
  @llm_response "llm.response"
  @llm_temperature "llm.temperature"
  @llm_max_tokens "llm.max_tokens"
  @llm_top_p "llm.top_p"
  @llm_frequency_penalty "llm.frequency_penalty"
  @llm_presence_penalty "llm.presence_penalty"
  @llm_stop_sequences "llm.stop_sequences"
  @llm_user "llm.user"
  @llm_cost "llm.cost"
  @llm_latency "llm.latency"
  @llm_error "llm.error"
  @llm_error_code "llm.error_code"
  @llm_error_message "llm.error_message"

  # Vector DB Attributes
  @vector_db_provider "vector_db.provider"
  @vector_db_operation "vector_db.operation"
  @vector_db_collection "vector_db.collection"
  @vector_db_dimensions "vector_db.dimensions"
  @vector_db_distance_metric "vector_db.distance_metric"
  @vector_db_top_k "vector_db.top_k"
  @vector_db_threshold "vector_db.threshold"
  @vector_db_query_vector "vector_db.query_vector"
  @vector_db_results_count "vector_db.results_count"
  @vector_db_latency "vector_db.latency"
  @vector_db_error "vector_db.error"

  # Framework Attributes
  @framework_name "framework.name"
  @framework_version "framework.version"
  @framework_operation "framework.operation"
  @framework_chain_id "framework.chain_id"
  @framework_step_id "framework.step_id"
  @framework_step_type "framework.step_type"
  @framework_latency "framework.latency"
  @framework_error "framework.error"

  # Workflow Attributes
  @workflow_id "workflow.id"
  @workflow_name "workflow.name"
  @workflow_version "workflow.version"
  @workflow_status "workflow.status"
  @workflow_step_id "workflow.step_id"
  @workflow_step_name "workflow.step_name"
  @workflow_step_type "workflow.step_type"
  @workflow_latency "workflow.latency"
  @workflow_error "workflow.error"

  # User Attributes
  @user_id "user.id"
  @user_session_id "user.session_id"
  @user_tenant_id "user.tenant_id"
  @user_organization_id "user.organization_id"

  # Application Attributes
  @app_name "app.name"
  @app_version "app.version"
  @app_environment "app.environment"
  @app_instance_id "app.instance_id"
  @app_region "app.region"

  @doc """
  Returns all LLM-related attribute names.
  """
  @spec llm_attributes() :: [String.t()]
  def llm_attributes do
    [
      @llm_model,
      @llm_provider,
      @llm_operation,
      @llm_prompt_tokens,
      @llm_completion_tokens,
      @llm_total_tokens,
      @llm_prompt,
      @llm_response,
      @llm_temperature,
      @llm_max_tokens,
      @llm_top_p,
      @llm_frequency_penalty,
      @llm_presence_penalty,
      @llm_stop_sequences,
      @llm_user,
      @llm_cost,
      @llm_latency,
      @llm_error,
      @llm_error_code,
      @llm_error_message
    ]
  end

  @doc """
  Returns all Vector DB-related attribute names.
  """
  @spec vector_db_attributes() :: [String.t()]
  def vector_db_attributes do
    [
      @vector_db_provider,
      @vector_db_operation,
      @vector_db_collection,
      @vector_db_dimensions,
      @vector_db_distance_metric,
      @vector_db_top_k,
      @vector_db_threshold,
      @vector_db_query_vector,
      @vector_db_results_count,
      @vector_db_latency,
      @vector_db_error
    ]
  end

  @doc """
  Returns all Framework-related attribute names.
  """
  @spec framework_attributes() :: [String.t()]
  def framework_attributes do
    [
      @framework_name,
      @framework_version,
      @framework_operation,
      @framework_chain_id,
      @framework_step_id,
      @framework_step_type,
      @framework_latency,
      @framework_error
    ]
  end

  @doc """
  Returns all Workflow-related attribute names.
  """
  @spec workflow_attributes() :: [String.t()]
  def workflow_attributes do
    [
      @workflow_id,
      @workflow_name,
      @workflow_version,
      @workflow_status,
      @workflow_step_id,
      @workflow_step_name,
      @workflow_step_type,
      @workflow_latency,
      @workflow_error
    ]
  end

  @doc """
  Creates LLM attributes from a map of data.

  ## Examples

      attributes = Untrace.Attributes.create_llm_attributes(%{
        model: "gpt-4",
        provider: "openai",
        prompt_tokens: 100,
        completion_tokens: 50
      })
  """
  @spec create_llm_attributes(map()) :: map()
  def create_llm_attributes(data) do
    data
    |> Map.take([
      :model, :provider, :operation, :prompt_tokens, :completion_tokens, :total_tokens,
      :prompt, :response, :temperature, :max_tokens, :top_p, :frequency_penalty,
      :presence_penalty, :stop_sequences, :user, :cost, :latency, :error,
      :error_code, :error_message
    ])
    |> Enum.map(fn {key, value} -> {llm_attribute_key(key), value} end)
    |> Enum.into(%{})
  end

  @doc """
  Creates Vector DB attributes from a map of data.

  ## Examples

      attributes = Untrace.Attributes.create_vector_db_attributes(%{
        provider: "pinecone",
        operation: "query",
        collection: "documents",
        top_k: 10
      })
  """
  @spec create_vector_db_attributes(map()) :: map()
  def create_vector_db_attributes(data) do
    data
    |> Map.take([
      :provider, :operation, :collection, :dimensions, :distance_metric,
      :top_k, :threshold, :query_vector, :results_count, :latency, :error
    ])
    |> Enum.map(fn {key, value} -> {vector_db_attribute_key(key), value} end)
    |> Enum.into(%{})
  end

  @doc """
  Creates Framework attributes from a map of data.

  ## Examples

      attributes = Untrace.Attributes.create_framework_attributes(%{
        name: "langchain",
        version: "0.1.0",
        operation: "chain",
        chain_id: "chain-123"
      })
  """
  @spec create_framework_attributes(map()) :: map()
  def create_framework_attributes(data) do
    data
    |> Map.take([
      :name, :version, :operation, :chain_id, :step_id, :step_type, :latency, :error
    ])
    |> Enum.map(fn {key, value} -> {framework_attribute_key(key), value} end)
    |> Enum.into(%{})
  end

  @doc """
  Creates Workflow attributes from a map of data.

  ## Examples

      attributes = Untrace.Attributes.create_workflow_attributes(%{
        id: "workflow-123",
        name: "customer-support",
        status: "running",
        step_id: "step-1"
      })
  """
  @spec create_workflow_attributes(map()) :: map()
  def create_workflow_attributes(data) do
    data
    |> Map.take([
      :id, :name, :version, :status, :step_id, :step_name, :step_type, :latency, :error
    ])
    |> Enum.map(fn {key, value} -> {workflow_attribute_key(key), value} end)
    |> Enum.into(%{})
  end

  @doc """
  Creates User attributes from a map of data.

  ## Examples

      attributes = Untrace.Attributes.create_user_attributes(%{
        id: "user-123",
        session_id: "session-456",
        tenant_id: "tenant-789"
      })
  """
  @spec create_user_attributes(map()) :: map()
  def create_user_attributes(data) do
    data
    |> Map.take([:id, :session_id, :tenant_id, :organization_id])
    |> Enum.map(fn {key, value} -> {user_attribute_key(key), value} end)
    |> Enum.into(%{})
  end

  @doc """
  Creates Application attributes from a map of data.

  ## Examples

      attributes = Untrace.Attributes.create_app_attributes(%{
        name: "my-app",
        version: "1.0.0",
        environment: "production"
      })
  """
  @spec create_app_attributes(map()) :: map()
  def create_app_attributes(data) do
    data
    |> Map.take([:name, :version, :environment, :instance_id, :region])
    |> Enum.map(fn {key, value} -> {app_attribute_key(key), value} end)
    |> Enum.into(%{})
  end

  @doc """
  Sanitizes attributes by removing sensitive data and ensuring proper types.

  ## Examples

      sanitized = Untrace.Attributes.sanitize_attributes(%{
        "llm.prompt" => "Hello, my password is secret123",
        "user.id" => "user-123",
        "llm.temperature" => "0.7"
      })
  """
  @spec sanitize_attributes(map()) :: map()
  def sanitize_attributes(attributes) do
    attributes
    |> sanitize_sensitive_data()
    |> convert_types()
  end

  @doc """
  Merges multiple attribute maps into one.

  ## Examples

      merged = Untrace.Attributes.merge_attributes([
        %{"llm.model" => "gpt-4"},
        %{"user.id" => "user-123"},
        %{"app.name" => "my-app"}
      ])
  """
  @spec merge_attributes([map()]) :: map()
  def merge_attributes(attribute_maps) do
    Enum.reduce(attribute_maps, %{}, &Map.merge/2)
  end

  ## Private Functions

  defp llm_attribute_key(:model), do: @llm_model
  defp llm_attribute_key(:provider), do: @llm_provider
  defp llm_attribute_key(:operation), do: @llm_operation
  defp llm_attribute_key(:prompt_tokens), do: @llm_prompt_tokens
  defp llm_attribute_key(:completion_tokens), do: @llm_completion_tokens
  defp llm_attribute_key(:total_tokens), do: @llm_total_tokens
  defp llm_attribute_key(:prompt), do: @llm_prompt
  defp llm_attribute_key(:response), do: @llm_response
  defp llm_attribute_key(:temperature), do: @llm_temperature
  defp llm_attribute_key(:max_tokens), do: @llm_max_tokens
  defp llm_attribute_key(:top_p), do: @llm_top_p
  defp llm_attribute_key(:frequency_penalty), do: @llm_frequency_penalty
  defp llm_attribute_key(:presence_penalty), do: @llm_presence_penalty
  defp llm_attribute_key(:stop_sequences), do: @llm_stop_sequences
  defp llm_attribute_key(:user), do: @llm_user
  defp llm_attribute_key(:cost), do: @llm_cost
  defp llm_attribute_key(:latency), do: @llm_latency
  defp llm_attribute_key(:error), do: @llm_error
  defp llm_attribute_key(:error_code), do: @llm_error_code
  defp llm_attribute_key(:error_message), do: @llm_error_message
  defp llm_attribute_key(key), do: "llm.#{key}"

  defp vector_db_attribute_key(:provider), do: @vector_db_provider
  defp vector_db_attribute_key(:operation), do: @vector_db_operation
  defp vector_db_attribute_key(:collection), do: @vector_db_collection
  defp vector_db_attribute_key(:dimensions), do: @vector_db_dimensions
  defp vector_db_attribute_key(:distance_metric), do: @vector_db_distance_metric
  defp vector_db_attribute_key(:top_k), do: @vector_db_top_k
  defp vector_db_attribute_key(:threshold), do: @vector_db_threshold
  defp vector_db_attribute_key(:query_vector), do: @vector_db_query_vector
  defp vector_db_attribute_key(:results_count), do: @vector_db_results_count
  defp vector_db_attribute_key(:latency), do: @vector_db_latency
  defp vector_db_attribute_key(:error), do: @vector_db_error
  defp vector_db_attribute_key(key), do: "vector_db.#{key}"

  defp framework_attribute_key(:name), do: @framework_name
  defp framework_attribute_key(:version), do: @framework_version
  defp framework_attribute_key(:operation), do: @framework_operation
  defp framework_attribute_key(:chain_id), do: @framework_chain_id
  defp framework_attribute_key(:step_id), do: @framework_step_id
  defp framework_attribute_key(:step_type), do: @framework_step_type
  defp framework_attribute_key(:latency), do: @framework_latency
  defp framework_attribute_key(:error), do: @framework_error
  defp framework_attribute_key(key), do: "framework.#{key}"

  defp workflow_attribute_key(:id), do: @workflow_id
  defp workflow_attribute_key(:name), do: @workflow_name
  defp workflow_attribute_key(:version), do: @workflow_version
  defp workflow_attribute_key(:status), do: @workflow_status
  defp workflow_attribute_key(:step_id), do: @workflow_step_id
  defp workflow_attribute_key(:step_name), do: @workflow_step_name
  defp workflow_attribute_key(:step_type), do: @workflow_step_type
  defp workflow_attribute_key(:latency), do: @workflow_latency
  defp workflow_attribute_key(:error), do: @workflow_error
  defp workflow_attribute_key(key), do: "workflow.#{key}"

  defp user_attribute_key(:id), do: @user_id
  defp user_attribute_key(:session_id), do: @user_session_id
  defp user_attribute_key(:tenant_id), do: @user_tenant_id
  defp user_attribute_key(:organization_id), do: @user_organization_id
  defp user_attribute_key(key), do: "user.#{key}"

  defp app_attribute_key(:name), do: @app_name
  defp app_attribute_key(:version), do: @app_version
  defp app_attribute_key(:environment), do: @app_environment
  defp app_attribute_key(:instance_id), do: @app_instance_id
  defp app_attribute_key(:region), do: @app_region
  defp app_attribute_key(key), do: "app.#{key}"

  defp sanitize_sensitive_data(attributes) do
    sensitive_keys = [
      @llm_prompt,
      @llm_response,
      "password",
      "secret",
      "token",
      "key",
      "auth"
    ]

    Enum.reduce(attributes, %{}, fn {key, value}, acc ->
      if String.contains?(key, sensitive_keys) do
        Map.put(acc, key, "[REDACTED]")
      else
        Map.put(acc, key, value)
      end
    end)
  end

  defp convert_types(attributes) do
    integer_regex = ~r/^\d+$/
    float_regex = ~r/^\d+\.\d+$/

    Enum.reduce(attributes, %{}, fn {key, value}, acc ->
      converted_value = cond do
        is_binary(value) and String.match?(value, integer_regex) -> String.to_integer(value)
        is_binary(value) and String.match?(value, float_regex) -> String.to_float(value)
        is_binary(value) and value in ["true", "false"] -> value == "true"
        true -> value
      end

      Map.put(acc, key, converted_value)
    end)
  end
end
