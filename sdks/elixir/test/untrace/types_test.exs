defmodule Untrace.TypesTest do
  use ExUnit.Case, async: true
  doctest Untrace.Types

  alias Untrace.Types

  test "validate_trace_data/1 with valid data" do
    trace_data = %{
      event_type: "test_event",
      data: %{message: "test"},
      metadata: %{user_id: "123"}
    }

    assert :ok = Types.validate_trace_data(trace_data)
  end

  test "validate_trace_data/1 with minimal valid data" do
    trace_data = %{
      event_type: "test_event",
      data: %{message: "test"}
    }

    assert :ok = Types.validate_trace_data(trace_data)
  end

  test "validate_trace_data/1 with missing event_type" do
    trace_data = %{data: %{message: "test"}}

    assert {:error, :validation_error, "Missing required field: event_type"} =
             Types.validate_trace_data(trace_data)
  end

  test "validate_trace_data/1 with missing data" do
    trace_data = %{event_type: "test_event"}

    assert {:error, :validation_error, "Missing required field: data"} =
             Types.validate_trace_data(trace_data)
  end

  test "validate_trace_data/1 with non-map data" do
    assert {:error, :validation_error, "Trace data must be a map"} =
             Types.validate_trace_data("invalid")
  end

  test "create_trace_data/3" do
    result = Types.create_trace_data("test_event", %{message: "test"}, %{user_id: "123"})

    expected = %{
      event_type: "test_event",
      data: %{message: "test"},
      metadata: %{user_id: "123"}
    }

    assert result == expected
  end

  test "create_trace_data/2 without metadata" do
    result = Types.create_trace_data("test_event", %{message: "test"})

    expected = %{
      event_type: "test_event",
      data: %{message: "test"},
      metadata: %{}
    }

    assert result == expected
  end

  test "create_llm_trace/5" do
    result = Types.create_llm_trace("gpt-4", "Hello", "Hi", 10, 5, %{user_id: "123"})

    expected = %{
      event_type: "llm_call",
      data: %{
        model: "gpt-4",
        prompt: "Hello",
        response: "Hi",
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15
      },
      metadata: %{user_id: "123"}
    }

    assert result == expected
  end

  test "create_user_action_trace/3" do
    result = Types.create_user_action_trace("click", %{button: "submit"}, %{user_id: "123"})

    expected = %{
      event_type: "user_action",
      data: %{
        action: "click",
        button: "submit"
      },
      metadata: %{user_id: "123"}
    }

    assert result == expected
  end

  test "create_api_call_trace/5" do
    result = Types.create_api_call_trace("GET", "/api/users", 200, 150, %{user_id: "123"})

    expected = %{
      event_type: "api_call",
      data: %{
        method: "GET",
        endpoint: "/api/users",
        status_code: 200,
        response_time_ms: 150
      },
      metadata: %{user_id: "123"}
    }

    assert result == expected
  end
end
