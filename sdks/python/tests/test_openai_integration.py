"""OpenAI integration tests for the Untrace SDK."""

import asyncio
import os
import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from untrace import (
    Untrace,
    init,
    UntraceConfig,
    LLMSpanAttributes,
    create_llm_attributes,
)


class TestOpenAIIntegration:
    """Test OpenAI integration functionality."""

    def setup_method(self):
        """Set up test fixtures."""
        self.config = UntraceConfig(
            api_key="test-api-key",
            base_url="https://test.untrace.dev",
            debug=True,
        )

    def teardown_method(self):
        """Clean up after tests."""
        # Reset global state
        from untrace.untrace import _global_state
        _global_state["instance"] = None
        _global_state["is_initialized"] = False

    @pytest.mark.asyncio
    async def test_openai_chat_completion_tracing(self):
        """Test tracing OpenAI chat completions."""
        sdk = init(self.config)
        tracer = sdk.get_tracer()

        # Mock OpenAI response
        mock_response = {
            "id": "chatcmpl-123",
            "object": "chat.completion",
            "created": 1677652288,
            "model": "gpt-4",
            "choices": [
                {
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": "Hello! How can I help you today?"
                    },
                    "finish_reason": "stop"
                }
            ],
            "usage": {
                "prompt_tokens": 10,
                "completion_tokens": 15,
                "total_tokens": 25
            }
        }

        async def mock_openai_call(span):
            # Simulate OpenAI API call
            span.set_attribute("llm.request.id", "chatcmpl-123")
            span.set_attribute("llm.request.model", "gpt-4")
            span.set_attribute("llm.request.messages", '[{"role": "user", "content": "Hello"}]')

            span.add_event("llm.request.start")

            # Simulate API call
            await asyncio.sleep(0.01)

            span.add_event("llm.response.received")
            span.set_attribute("llm.response.id", "chatcmpl-123")
            span.set_attribute("llm.response.model", "gpt-4")
            span.set_attribute("llm.response.choices", str(mock_response["choices"]))

            # Set usage attributes
            usage = mock_response["usage"]
            span.set_attribute("llm.prompt.tokens", usage["prompt_tokens"])
            span.set_attribute("llm.completion.tokens", usage["completion_tokens"])
            span.set_attribute("llm.total.tokens", usage["total_tokens"])

            return mock_response

        # Create LLM attributes
        attributes = create_llm_attributes(
            provider="openai",
            model="gpt-4",
            operation_type="chat",
            temperature=0.7,
            max_tokens=1000
        )

        # Execute with span
        result = await tracer.with_llm_span(
            "openai.chat.completions.create",
            attributes,
            mock_openai_call
        )

        assert result == mock_response

    @pytest.mark.asyncio
    async def test_openai_completion_tracing(self):
        """Test tracing OpenAI completions."""
        sdk = init(self.config)
        tracer = sdk.get_tracer()

        # Mock OpenAI response
        mock_response = {
            "id": "cmpl-123",
            "object": "text_completion",
            "created": 1677652288,
            "model": "text-davinci-003",
            "choices": [
                {
                    "text": "This is a test completion.",
                    "index": 0,
                    "finish_reason": "stop"
                }
            ],
            "usage": {
                "prompt_tokens": 5,
                "completion_tokens": 8,
                "total_tokens": 13
            }
        }

        async def mock_openai_call(span):
            # Simulate OpenAI API call
            span.set_attribute("llm.request.id", "cmpl-123")
            span.set_attribute("llm.request.model", "text-davinci-003")
            span.set_attribute("llm.request.prompt", "Complete this sentence:")

            span.add_event("llm.request.start")

            # Simulate API call
            await asyncio.sleep(0.01)

            span.add_event("llm.response.received")
            span.set_attribute("llm.response.id", "cmpl-123")
            span.set_attribute("llm.response.model", "text-davinci-003")

            # Set usage attributes
            usage = mock_response["usage"]
            span.set_attribute("llm.prompt.tokens", usage["prompt_tokens"])
            span.set_attribute("llm.completion.tokens", usage["completion_tokens"])
            span.set_attribute("llm.total.tokens", usage["total_tokens"])

            return mock_response

        # Create LLM attributes
        attributes = create_llm_attributes(
            provider="openai",
            model="text-davinci-003",
            operation_type="completion",
            temperature=0.5,
            max_tokens=100
        )

        # Execute with span
        result = await tracer.with_llm_span(
            "openai.completions.create",
            attributes,
            mock_openai_call
        )

        assert result == mock_response

    @pytest.mark.asyncio
    async def test_openai_embedding_tracing(self):
        """Test tracing OpenAI embeddings."""
        sdk = init(self.config)
        tracer = sdk.get_tracer()

        # Mock OpenAI response
        mock_response = {
            "object": "list",
            "data": [
                {
                    "object": "embedding",
                    "index": 0,
                    "embedding": [0.1, 0.2, 0.3, 0.4, 0.5]  # Simplified embedding
                }
            ],
            "model": "text-embedding-ada-002",
            "usage": {
                "prompt_tokens": 3,
                "total_tokens": 3
            }
        }

        async def mock_openai_call(span):
            # Simulate OpenAI API call
            span.set_attribute("llm.request.model", "text-embedding-ada-002")
            span.set_attribute("llm.request.input", "Hello world")

            span.add_event("llm.request.start")

            # Simulate API call
            await asyncio.sleep(0.01)

            span.add_event("llm.response.received")
            span.set_attribute("llm.response.model", "text-embedding-ada-002")
            span.set_attribute("llm.response.embeddings_count", len(mock_response["data"]))

            # Set usage attributes
            usage = mock_response["usage"]
            span.set_attribute("llm.prompt.tokens", usage["prompt_tokens"])
            span.set_attribute("llm.total.tokens", usage["total_tokens"])

            return mock_response

        # Create LLM attributes
        attributes = create_llm_attributes(
            provider="openai",
            model="text-embedding-ada-002",
            operation_type="embedding"
        )

        # Execute with span
        result = await tracer.with_llm_span(
            "openai.embeddings.create",
            attributes,
            mock_openai_call
        )

        assert result == mock_response

    @pytest.mark.asyncio
    async def test_openai_error_handling(self):
        """Test OpenAI error handling and tracing."""
        sdk = init(self.config)
        tracer = sdk.get_tracer()

        async def mock_openai_call_with_error(span):
            # Simulate OpenAI API call
            span.set_attribute("llm.request.model", "gpt-4")
            span.set_attribute("llm.request.messages", '[{"role": "user", "content": "Hello"}]')

            span.add_event("llm.request.start")

            # Simulate API call
            await asyncio.sleep(0.01)

            # Simulate error
            error = Exception("OpenAI API error: Rate limit exceeded")
            span.record_exception(error)
            span.set_attribute("llm.error", str(error))
            span.set_attribute("llm.error.type", "rate_limit")

            raise error

        # Create LLM attributes
        attributes = create_llm_attributes(
            provider="openai",
            model="gpt-4",
            operation_type="chat"
        )

        # Execute with span - should raise exception
        with pytest.raises(Exception, match="OpenAI API error"):
            await tracer.with_llm_span(
                "openai.chat.completions.create",
                attributes,
                mock_openai_call_with_error
            )

    def test_openai_span_attributes(self):
        """Test OpenAI-specific span attributes."""
        sdk = init(self.config)
        tracer = sdk.get_tracer()

        # Test chat completion attributes
        chat_attributes = create_llm_attributes(
            provider="openai",
            model="gpt-4",
            operation_type="chat",
            temperature=0.7,
            max_tokens=1000,
            stream=False
        )

        span = tracer.start_llm_span("openai.chat.completions.create", chat_attributes)

        # Add OpenAI-specific attributes
        span.set_attribute("openai.organization", "org-123")
        span.set_attribute("openai.project", "proj-456")
        span.set_attribute("llm.request.messages", '[{"role": "user", "content": "Hello"}]')

        span.end()

        # Test completion attributes
        completion_attributes = create_llm_attributes(
            provider="openai",
            model="text-davinci-003",
            operation_type="completion",
            temperature=0.5,
            max_tokens=100
        )

        span = tracer.start_llm_span("openai.completions.create", completion_attributes)

        # Add OpenAI-specific attributes
        span.set_attribute("llm.request.prompt", "Complete this sentence:")
        span.set_attribute("llm.request.suffix", ".")

        span.end()

    def test_openai_usage_tracking(self):
        """Test OpenAI usage tracking."""
        sdk = init(self.config)
        metrics = sdk.get_metrics()

        # Test token usage recording
        from untrace import TokenUsage
        usage = TokenUsage(
            model="gpt-4",
            provider="openai",
            prompt_tokens=100,
            completion_tokens=50,
            total_tokens=150
        )
        metrics.record_token_usage(usage)

        # Test cost recording
        from untrace import Cost
        cost = Cost(
            model="gpt-4",
            provider="openai",
            total=0.01,
            prompt=0.005,
            completion=0.005
        )
        metrics.record_cost(cost)

    @pytest.mark.asyncio
    async def test_openai_streaming_tracing(self):
        """Test tracing OpenAI streaming responses."""
        sdk = init(self.config)
        tracer = sdk.get_tracer()

        # Mock streaming response
        streaming_chunks = [
            {
                "id": "chatcmpl-123",
                "object": "chat.completion.chunk",
                "created": 1677652288,
                "model": "gpt-4",
                "choices": [
                    {
                        "index": 0,
                        "delta": {"content": "Hello"},
                        "finish_reason": None
                    }
                ]
            },
            {
                "id": "chatcmpl-123",
                "object": "chat.completion.chunk",
                "created": 1677652288,
                "model": "gpt-4",
                "choices": [
                    {
                        "index": 0,
                        "delta": {"content": " world!"},
                        "finish_reason": "stop"
                    }
                ]
            }
        ]

        async def mock_streaming_call(span):
            # Simulate streaming OpenAI API call
            span.set_attribute("llm.request.model", "gpt-4")
            span.set_attribute("llm.request.messages", '[{"role": "user", "content": "Hello"}]')
            span.set_attribute("llm.stream", True)

            span.add_event("llm.request.start")

            # Simulate streaming response
            for i, chunk in enumerate(streaming_chunks):
                await asyncio.sleep(0.01)
                span.add_event("llm.response.chunk", {"chunk.index": i})

            span.add_event("llm.response.complete")
            span.set_attribute("llm.response.chunks_count", len(streaming_chunks))

            return streaming_chunks

        # Create LLM attributes
        attributes = create_llm_attributes(
            provider="openai",
            model="gpt-4",
            operation_type="chat",
            stream=True
        )

        # Execute with span
        result = await tracer.with_llm_span(
            "openai.chat.completions.create",
            attributes,
            mock_streaming_call
        )

        assert result == streaming_chunks

    def test_openai_tool_calls_tracing(self):
        """Test tracing OpenAI tool calls."""
        sdk = init(self.config)
        tracer = sdk.get_tracer()

        # Mock tool call response
        mock_response = {
            "id": "chatcmpl-123",
            "object": "chat.completion",
            "created": 1677652288,
            "model": "gpt-4",
            "choices": [
                {
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": None,
                        "tool_calls": [
                            {
                                "id": "call_123",
                                "type": "function",
                                "function": {
                                    "name": "get_weather",
                                    "arguments": '{"location": "New York"}'
                                }
                            }
                        ]
                    },
                    "finish_reason": "tool_calls"
                }
            ],
            "usage": {
                "prompt_tokens": 50,
                "completion_tokens": 25,
                "total_tokens": 75
            }
        }

        async def mock_tool_call(span):
            # Simulate OpenAI API call with tools
            span.set_attribute("llm.request.model", "gpt-4")
            span.set_attribute("llm.request.messages", '[{"role": "user", "content": "What is the weather?"}]')
            span.set_attribute("llm.tools", '[{"name": "get_weather", "description": "Get weather information"}]')

            span.add_event("llm.request.start")

            # Simulate API call
            await asyncio.sleep(0.01)

            span.add_event("llm.response.received")
            span.set_attribute("llm.response.model", "gpt-4")
            span.set_attribute("llm.tool_calls", str(mock_response["choices"][0]["message"]["tool_calls"]))

            # Set usage attributes
            usage = mock_response["usage"]
            span.set_attribute("llm.prompt.tokens", usage["prompt_tokens"])
            span.set_attribute("llm.completion.tokens", usage["completion_tokens"])
            span.set_attribute("llm.total.tokens", usage["total_tokens"])

            return mock_response

        # Create LLM attributes
        attributes = create_llm_attributes(
            provider="openai",
            model="gpt-4",
            operation_type="tool_use",
            tools='[{"name": "get_weather", "description": "Get weather information"}]'
        )

        # Execute with span
        result = await tracer.with_llm_span(
            "openai.chat.completions.create",
            attributes,
            mock_tool_call
        )

        assert result == mock_response
