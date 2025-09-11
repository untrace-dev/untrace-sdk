defmodule Untrace.Config do
  @moduledoc """
  Configuration management for the Untrace SDK.
  """

  use GenServer
  require Logger

  @default_config %{
    api_key: nil,
    base_url: "https://api.untrace.dev",
    timeout: 30_000,
    debug: false,
    capture_body: true,
    capture_errors: true,
    sampling_rate: 1.0,
    max_batch_size: 512,
    export_interval_ms: 5000
  }

  defstruct Map.keys(@default_config)

  @type t :: %__MODULE__{
          api_key: String.t() | nil,
          base_url: String.t(),
          timeout: non_neg_integer(),
          debug: boolean(),
          capture_body: boolean(),
          capture_errors: boolean(),
          sampling_rate: float(),
          max_batch_size: non_neg_integer(),
          export_interval_ms: non_neg_integer()
        }

  ## Client API

  @doc """
  Start the configuration server.
  """
  @spec start_link(keyword()) :: GenServer.on_start()
  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, @default_config, opts)
  end

  @doc """
  Configure the SDK with the given options.

  ## Options

  - `:api_key` - Your Untrace API key
  - `:base_url` - Base URL for the Untrace API
  - `:timeout` - Request timeout in milliseconds
  - `:debug` - Enable debug logging
  - `:capture_body` - Whether to capture request/response bodies
  - `:capture_errors` - Whether to capture and report errors
  - `:sampling_rate` - Sampling rate (0.0 to 1.0)
  - `:max_batch_size` - Maximum number of spans per batch
  - `:export_interval_ms` - Export interval in milliseconds

  ## Examples

      Untrace.Config.configure(api_key: "your-api-key", debug: true)
  """
  @spec configure(keyword()) :: :ok
  def configure(opts) do
    GenServer.call(__MODULE__, {:configure, opts})
  end

  @doc """
  Get the current configuration.

  ## Examples

      config = Untrace.Config.get_config()
  """
  @spec get_config() :: t()
  def get_config do
    GenServer.call(__MODULE__, :get_config)
  end

  @doc """
  Get a specific configuration value.

  ## Examples

      api_key = Untrace.Config.get(:api_key)
      debug = Untrace.Config.get(:debug)
  """
  @spec get(atom()) :: any()
  def get(key) do
    config = get_config()
    Map.get(config, key)
  end

  @doc """
  Set a specific configuration value.

  ## Examples

      Untrace.Config.set(:api_key, "your-api-key")
      Untrace.Config.set(:debug, true)
  """
  @spec set(atom(), any()) :: :ok
  def set(key, value) do
    GenServer.call(__MODULE__, {:set, key, value})
  end

  ## GenServer Callbacks

  @impl true
  def init(initial_config) do
    config = load_from_env(initial_config)
    {:ok, struct(__MODULE__, config)}
  end

  @impl true
  def handle_call({:configure, opts}, _from, state) do
    new_config = merge_config(state, opts)
    new_state = struct(__MODULE__, new_config)
    {:reply, :ok, new_state}
  end

  @impl true
  def handle_call(:get_config, _from, state) do
    {:reply, state, state}
  end

  @impl true
  def handle_call({:set, key, value}, _from, state) do
    new_state = Map.put(state, key, value)
    {:reply, :ok, new_state}
  end

  ## Private Functions

  defp load_from_env(config) do
    config
    |> Map.put(:api_key, System.get_env("UNTRACE_API_KEY") || config.api_key)
    |> Map.put(:base_url, System.get_env("UNTRACE_BASE_URL") || config.base_url)
    |> Map.put(:debug, parse_boolean(System.get_env("UNTRACE_DEBUG"), config.debug))
    |> Map.put(:timeout, parse_integer(System.get_env("UNTRACE_TIMEOUT"), config.timeout))
    |> Map.put(:sampling_rate, parse_float(System.get_env("UNTRACE_SAMPLING_RATE"), config.sampling_rate))
  end

  defp merge_config(config, opts) do
    Enum.reduce(opts, Map.from_struct(config), fn {key, value}, acc ->
      if Map.has_key?(acc, key) do
        Map.put(acc, key, value)
      else
        Logger.warning("Unknown configuration option: #{key}")
        acc
      end
    end)
  end

  defp parse_boolean(nil, default), do: default
  defp parse_boolean("true", _), do: true
  defp parse_boolean("false", _), do: false
  defp parse_boolean(_, default), do: default

  defp parse_integer(nil, default), do: default
  defp parse_integer(value, default) do
    case Integer.parse(value) do
      {int, _} -> int
      :error -> default
    end
  end

  defp parse_float(nil, default), do: default
  defp parse_float(value, default) do
    case Float.parse(value) do
      {float, _} -> float
      :error -> default
    end
  end
end
