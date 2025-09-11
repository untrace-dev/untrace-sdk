defmodule Untrace.AttributesTest do
  use ExUnit.Case, async: true
  doctest Untrace.Attributes

  alias Untrace.Attributes

  test "llm_attributes/0 returns list of strings" do
    attrs = Attributes.llm_attributes()
    assert is_list(attrs)
    assert Enum.all?(attrs, &is_binary/1)
  end

  test "vector_db_attributes/0 returns list of strings" do
    attrs = Attributes.vector_db_attributes()
    assert is_list(attrs)
    assert Enum.all?(attrs, &is_binary/1)
  end

  test "framework_attributes/0 returns list of strings" do
    attrs = Attributes.framework_attributes()
    assert is_list(attrs)
    assert Enum.all?(attrs, &is_binary/1)
  end

  test "workflow_attributes/0 returns list of strings" do
    attrs = Attributes.workflow_attributes()
    assert is_list(attrs)
    assert Enum.all?(attrs, &is_binary/1)
  end

  test "create_llm_attributes/1" do
    data = %{
      model: "gpt-4",
      provider: "openai",
      prompt_tokens: 100,
      completion_tokens: 50,
      temperature: 0.7
    }

    result = Attributes.create_llm_attributes(data)

    expected = %{
      "llm.model" => "gpt-4",
      "llm.provider" => "openai",
      "llm.prompt.tokens" => 100,
      "llm.completion.tokens" => 50,
      "llm.temperature" => 0.7
    }

    assert result == expected
  end

  test "create_vector_db_attributes/1" do
    data = %{
      provider: "pinecone",
      operation: "query",
      collection: "documents",
      top_k: 10
    }

    result = Attributes.create_vector_db_attributes(data)

    expected = %{
      "vector_db.provider" => "pinecone",
      "vector_db.operation" => "query",
      "vector_db.collection" => "documents",
      "vector_db.top_k" => 10
    }

    assert result == expected
  end

  test "create_framework_attributes/1" do
    data = %{
      name: "langchain",
      version: "0.1.0",
      operation: "chain",
      chain_id: "chain-123"
    }

    result = Attributes.create_framework_attributes(data)

    expected = %{
      "framework.name" => "langchain",
      "framework.version" => "0.1.0",
      "framework.operation" => "chain",
      "framework.chain_id" => "chain-123"
    }

    assert result == expected
  end

  test "create_workflow_attributes/1" do
    data = %{
      id: "workflow-123",
      name: "customer-support",
      status: "running",
      step_id: "step-1"
    }

    result = Attributes.create_workflow_attributes(data)

    expected = %{
      "workflow.id" => "workflow-123",
      "workflow.name" => "customer-support",
      "workflow.status" => "running",
      "workflow.step_id" => "step-1"
    }

    assert result == expected
  end

  test "create_user_attributes/1" do
    data = %{
      id: "user-123",
      session_id: "session-456",
      tenant_id: "tenant-789"
    }

    result = Attributes.create_user_attributes(data)

    expected = %{
      "user.id" => "user-123",
      "user.session_id" => "session-456",
      "user.tenant_id" => "tenant-789"
    }

    assert result == expected
  end

  test "create_app_attributes/1" do
    data = %{
      name: "my-app",
      version: "1.0.0",
      environment: "production"
    }

    result = Attributes.create_app_attributes(data)

    expected = %{
      "app.name" => "my-app",
      "app.version" => "1.0.0",
      "app.environment" => "production"
    }

    assert result == expected
  end

  test "sanitize_attributes/1 removes sensitive data" do
    attributes = %{
      "llm.prompt" => "Hello, my password is secret123",
      "user.id" => "user-123",
      "llm.temperature" => "0.7"
    }

    result = Attributes.sanitize_attributes(attributes)

    expected = %{
      "llm.prompt" => "[REDACTED]",
      "user.id" => "user-123",
      "llm.temperature" => 0.7
    }

    assert result == expected
  end

  test "merge_attributes/1 merges multiple maps" do
    maps = [
      %{"llm.model" => "gpt-4"},
      %{"user.id" => "user-123"},
      %{"app.name" => "my-app"}
    ]

    result = Attributes.merge_attributes(maps)

    expected = %{
      "llm.model" => "gpt-4",
      "user.id" => "user-123",
      "app.name" => "my-app"
    }

    assert result == expected
  end
end
