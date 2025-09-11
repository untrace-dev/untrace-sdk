defmodule Untrace.ClientTest do
  use ExUnit.Case, async: true
  doctest Untrace.Client

  alias Untrace.Client

  @test_api_key "test-api-key"
  @test_base_url "https://api.test.untrace.dev"

  setup do
    # Start a test client
    {:ok, client} = Client.start_link(api_key: @test_api_key, base_url: @test_base_url)
    %{client: client}
  end

  test "start_link/1 with valid options" do
    {:ok, client} = Client.start_link(api_key: @test_api_key)
    assert is_pid(client)
  end

  test "start_link/1 with custom options" do
    {:ok, client} = Client.start_link(
      api_key: @test_api_key,
      base_url: @test_base_url,
      timeout: 5000
    )
    assert is_pid(client)
  end

  test "start_link/1 with name" do
    {:ok, client} = Client.start_link(api_key: @test_api_key, name: :test_client)
    assert is_pid(client)
    assert Process.whereis(:test_client) == client
  end

  test "trace/2 with valid data", %{client: client} do
    trace_data = %{
      event_type: "test_event",
      data: %{message: "test"},
      metadata: %{user_id: "123"}
    }

    # This will fail in test environment without a real API, but we can test the structure
    result = Client.trace(client, trace_data)
    assert {:error, :network_error, _} = result
  end

  test "trace/2 with invalid data", %{client: client} do
    trace_data = %{invalid: "data"}

    result = Client.trace(client, trace_data)
    assert {:error, :validation_error, _} = result
  end

  test "get_trace/2", %{client: client} do
    # This will fail in test environment without a real API
    result = Client.get_trace(client, "test-trace-id")
    assert {:error, :network_error, _} = result
  end

  test "stop/1", %{client: client} do
    assert :ok = Client.stop(client)
  end
end
