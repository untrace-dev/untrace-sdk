defmodule UntraceTest do
  use ExUnit.Case, async: true
  doctest Untrace

  test "version returns a string" do
    assert is_binary(Untrace.version())
  end

  test "author returns a string" do
    assert is_binary(Untrace.author())
  end

  test "email returns a string" do
    assert is_binary(Untrace.email())
  end
end
