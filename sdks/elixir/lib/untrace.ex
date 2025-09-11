defmodule Untrace do
  @moduledoc """
  Untrace SDK for Elixir - LLM Observability and Tracing.

  This module provides the main interface for the Untrace SDK, allowing you to
  trace LLM calls and other events in your Elixir applications.
  """

  @version "0.1.2"
  @author "Untrace"
  @email "hello@untrace.dev"

  def version, do: @version
  def author, do: @author
  def email, do: @email

  # Main client module
  defdelegate start_link(opts), to: Untrace.Client
  defdelegate trace(client, trace_data), to: Untrace.Client
  defdelegate get_trace(client, trace_id), to: Untrace.Client
  defdelegate stop(client), to: Untrace.Client

  # Configuration and utilities
  defdelegate configure(opts), to: Untrace.Config
  defdelegate get_config, to: Untrace.Config

  # Telemetry helpers
  defdelegate emit_trace_event(event_type, data, metadata \\ %{}), to: Untrace.Telemetry
  defdelegate emit_error_event(error, context \\ %{}), to: Untrace.Telemetry

  # Types and schemas
  defdelegate trace_schema, to: Untrace.Types
  defdelegate validate_trace_data(data), to: Untrace.Types
end
