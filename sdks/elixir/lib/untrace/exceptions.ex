defmodule Untrace.Exceptions do
  @moduledoc """
  Custom exception definitions for the Untrace SDK.
  """

  defmodule UntraceError do
    @moduledoc """
    Base exception for all Untrace SDK errors.
    """
    defexception [:message]

    @impl true
    def exception(message) when is_binary(message) do
      %__MODULE__{message: message}
    end

    def exception(opts) when is_list(opts) do
      message = Keyword.get(opts, :message, "Untrace error occurred")
      %__MODULE__{message: message}
    end
  end

  defmodule UntraceAPIError do
    @moduledoc """
    Exception raised when API requests fail.
    """
    defexception [:message, :status_code, :response_body]

    @impl true
    def exception(opts) do
      message = Keyword.get(opts, :message, "API request failed")
      status_code = Keyword.get(opts, :status_code)
      response_body = Keyword.get(opts, :response_body)

      %__MODULE__{
        message: message,
        status_code: status_code,
        response_body: response_body
      }
    end
  end

  defmodule UntraceValidationError do
    @moduledoc """
    Exception raised when request validation fails.
    """
    defexception [:message, :field, :value]

    @impl true
    def exception(opts) do
      message = Keyword.get(opts, :message, "Validation error")
      field = Keyword.get(opts, :field)
      value = Keyword.get(opts, :value)

      %__MODULE__{
        message: message,
        field: field,
        value: value
      }
    end
  end

  defmodule UntraceNetworkError do
    @moduledoc """
    Exception raised when network requests fail.
    """
    defexception [:message, :reason, :url]

    @impl true
    def exception(opts) do
      message = Keyword.get(opts, :message, "Network error")
      reason = Keyword.get(opts, :reason)
      url = Keyword.get(opts, :url)

      %__MODULE__{
        message: message,
        reason: reason,
        url: url
      }
    end
  end

  defmodule UntraceConfigurationError do
    @moduledoc """
    Exception raised when configuration is invalid.
    """
    defexception [:message, :field, :value]

    @impl true
    def exception(opts) do
      message = Keyword.get(opts, :message, "Configuration error")
      field = Keyword.get(opts, :field)
      value = Keyword.get(opts, :value)

      %__MODULE__{
        message: message,
        field: field,
        value: value
      }
    end
  end

  defmodule UntraceTimeoutError do
    @moduledoc """
    Exception raised when requests timeout.
    """
    defexception [:message, :timeout, :operation]

    @impl true
    def exception(opts) do
      message = Keyword.get(opts, :message, "Request timeout")
      timeout = Keyword.get(opts, :timeout)
      operation = Keyword.get(opts, :operation)

      %__MODULE__{
        message: message,
        timeout: timeout,
        operation: operation
      }
    end
  end

  @doc """
  Raise an API error with the given details.

  ## Examples

      Untrace.Exceptions.raise_api_error("API request failed", status_code: 500, response_body: "Internal Server Error")
  """
  @spec raise_api_error(String.t(), keyword()) :: no_return()
  @dialyzer {:nowarn_function, [raise_api_error: 1, raise_api_error: 2]}
  def raise_api_error(message, opts \\ []) do
    raise UntraceAPIError, [message: message] ++ opts
  end

  @doc """
  Raise a validation error with the given details.

  ## Examples

      Untrace.Exceptions.raise_validation_error("Invalid event_type", field: :event_type, value: nil)
  """
  @spec raise_validation_error(String.t(), keyword()) :: no_return()
  @dialyzer {:nowarn_function, [raise_validation_error: 1, raise_validation_error: 2]}
  def raise_validation_error(message, opts \\ []) do
    raise UntraceValidationError, [message: message] ++ opts
  end

  @doc """
  Raise a network error with the given details.

  ## Examples

      Untrace.Exceptions.raise_network_error("Connection failed", reason: :econnrefused, url: "https://api.untrace.dev")
  """
  @spec raise_network_error(String.t(), keyword()) :: no_return()
  @dialyzer {:nowarn_function, [raise_network_error: 1, raise_network_error: 2]}
  def raise_network_error(message, opts \\ []) do
    raise UntraceNetworkError, [message: message] ++ opts
  end

  @doc """
  Raise a configuration error with the given details.

  ## Examples

      Untrace.Exceptions.raise_configuration_error("Invalid API key", field: :api_key, value: nil)
  """
  @spec raise_configuration_error(String.t(), keyword()) :: no_return()
  @dialyzer {:nowarn_function, [raise_configuration_error: 1, raise_configuration_error: 2]}
  def raise_configuration_error(message, opts \\ []) do
    raise UntraceConfigurationError, [message: message] ++ opts
  end

  @doc """
  Raise a timeout error with the given details.

  ## Examples

      Untrace.Exceptions.raise_timeout_error("Request timed out", timeout: 30000, operation: :trace)
  """
  @spec raise_timeout_error(String.t(), keyword()) :: no_return()
  @dialyzer {:nowarn_function, [raise_timeout_error: 1, raise_timeout_error: 2]}
  def raise_timeout_error(message, opts \\ []) do
    raise UntraceTimeoutError, [message: message] ++ opts
  end
end
