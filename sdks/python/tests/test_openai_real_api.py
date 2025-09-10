"""Real OpenAI API integration test for the Untrace SDK."""

import asyncio
import os
import pytest
from unittest.mock import patch

from untrace import (
    init,
    UntraceConfig,
    create_llm_attributes,
    TokenUsage,
    Cost,
)


class TestOpenAIRealAPI:
    """Test real OpenAI API integration with Untrace SDK."""

    def setup_method(self):
        """Set up test fixtures."""
        self.config = UntraceConfig(
            api_key=os.getenv("UNTRACE_API_KEY", "test-api-key"),
            base_url="https://untrace.dev",
            debug=True,
        )

    def teardown_method(self):
        """Clean up after tests."""
        # Reset global state
        from untrace.untrace import _global_state
        _global_state["instance"] = None
        _global_state["is_initialized"] = False

    @pytest.mark.asyncio
    async def test_openai_chat_completion_real_api(self):
        """Test real OpenAI chat completion with tracing."""
        # Skip if no OpenAI API key
        if not os.getenv("OPENAI_API_KEY"):
            pytest.skip("OPENAI_API_KEY not set")

        sdk = init(self.config)
        tracer = sdk.get_tracer()
        metrics = sdk.get_metrics()

        # Create LLM attributes
        attributes = create_llm_attributes(
            provider="openai",
            model="gpt-3.5-turbo",
            operation_type="chat",
            temperature=0.7,
            max_tokens=100
        )

        async def openai_chat_call(span):
            """Make actual OpenAI API call with tracing."""
            try:
                # Import OpenAI client
                from openai import AsyncOpenAI

                client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

                # Set request attributes
                span.set_attribute("llm.request.model", "gpt-3.5-turbo")
                span.set_attribute("llm.request.messages", '[{"role": "user", "content": "Hello, how are you?"}]')
                span.set_attribute("llm.request.temperature", 0.7)
                span.set_attribute("llm.request.max_tokens", 100)

                span.add_event("llm.request.start")

                # Make the actual API call
                response = await client.chat.completions.create(
                    model="gpt-3.5-turbo",
                    messages=[{"role": "user", "content": "Hello, how are you?"}],
                    temperature=0.7,
                    max_tokens=100
                )

                span.add_event("llm.response.received")

                # Extract response data
                choice = response.choices[0]
                message = choice.message
                usage = response.usage

                # Set response attributes
                span.set_attribute("llm.response.model", response.model)
                span.set_attribute("llm.response.id", response.id)
                span.set_attribute("llm.response.choices", str([{
                    "index": choice.index,
                    "message": {"role": message.role, "content": message.content},
                    "finish_reason": choice.finish_reason
                }]))

                # Set usage attributes
                if usage:
                    span.set_attribute("llm.prompt.tokens", usage.prompt_tokens)
                    span.set_attribute("llm.completion.tokens", usage.completion_tokens)
                    span.set_attribute("llm.total.tokens", usage.total_tokens)

                    # Record metrics
                    token_usage = TokenUsage(
                        model=response.model,
                        provider="openai",
                        prompt_tokens=usage.prompt_tokens,
                        completion_tokens=usage.completion_tokens,
                        total_tokens=usage.total_tokens
                    )
                    metrics.record_token_usage(token_usage)

                # Record latency
                metrics.record_latency(150.0, {"operation": "chat_completion"})

                return {
                    "id": response.id,
                    "model": response.model,
                    "content": message.content,
                    "usage": {
                        "prompt_tokens": usage.prompt_tokens if usage else 0,
                        "completion_tokens": usage.completion_tokens if usage else 0,
                        "total_tokens": usage.total_tokens if usage else 0,
                    }
                }

            except Exception as e:
                span.record_exception(e)
                span.set_attribute("llm.error", str(e))
                span.set_attribute("llm.error.type", type(e).__name__)
                raise

        # Execute with span
        result = await tracer.with_llm_span(
            "openai.chat.completions.create",
            attributes,
            openai_chat_call
        )

        # Verify result
        assert result is not None
        assert "id" in result
        assert "model" in result
        assert "content" in result
        assert "usage" in result
        assert result["model"].startswith("gpt-3.5-turbo")  # Model name may have version suffix
        assert len(result["content"]) > 0

        # Flush spans
        await sdk.flush()

        # Shutdown
        await sdk.shutdown()

    @pytest.mark.asyncio
    async def test_openai_completion_real_api(self):
        """Test real OpenAI completion with tracing."""
        # Skip if no OpenAI API key
        if not os.getenv("OPENAI_API_KEY"):
            pytest.skip("OPENAI_API_KEY not set")

        sdk = init(self.config)
        tracer = sdk.get_tracer()
        metrics = sdk.get_metrics()

        # Create LLM attributes
        attributes = create_llm_attributes(
            provider="openai",
            model="text-davinci-003",
            operation_type="completion",
            temperature=0.5,
            max_tokens=50
        )

        async def openai_completion_call(span):
            """Make actual OpenAI completion API call with tracing."""
            try:
                # Import OpenAI client
                from openai import AsyncOpenAI

                client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

                # Set request attributes
                span.set_attribute("llm.request.model", "text-davinci-003")
                span.set_attribute("llm.request.prompt", "Complete this sentence: The weather today is")
                span.set_attribute("llm.request.temperature", 0.5)
                span.set_attribute("llm.request.max_tokens", 50)

                span.add_event("llm.request.start")

                # Make the actual API call
                response = await client.completions.create(
                    model="text-davinci-003",
                    prompt="Complete this sentence: The weather today is",
                    temperature=0.5,
                    max_tokens=50
                )

                span.add_event("llm.response.received")

                # Extract response data
                choice = response.choices[0]
                usage = response.usage

                # Set response attributes
                span.set_attribute("llm.response.model", response.model)
                span.set_attribute("llm.response.id", response.id)
                span.set_attribute("llm.response.choices", str([{
                    "index": choice.index,
                    "text": choice.text,
                    "finish_reason": choice.finish_reason
                }]))

                # Set usage attributes
                if usage:
                    span.set_attribute("llm.prompt.tokens", usage.prompt_tokens)
                    span.set_attribute("llm.completion.tokens", usage.completion_tokens)
                    span.set_attribute("llm.total.tokens", usage.total_tokens)

                    # Record metrics
                    token_usage = TokenUsage(
                        model=response.model,
                        provider="openai",
                        prompt_tokens=usage.prompt_tokens,
                        completion_tokens=usage.completion_tokens,
                        total_tokens=usage.total_tokens
                    )
                    metrics.record_token_usage(token_usage)

                # Record latency
                metrics.record_latency(200.0, {"operation": "completion"})

                return {
                    "id": response.id,
                    "model": response.model,
                    "text": choice.text,
                    "usage": {
                        "prompt_tokens": usage.prompt_tokens if usage else 0,
                        "completion_tokens": usage.completion_tokens if usage else 0,
                        "total_tokens": usage.total_tokens if usage else 0,
                    }
                }

            except Exception as e:
                span.record_exception(e)
                span.set_attribute("llm.error", str(e))
                span.set_attribute("llm.error.type", type(e).__name__)
                raise

        # Execute with span
        result = await tracer.with_llm_span(
            "openai.completions.create",
            attributes,
            openai_completion_call
        )

        # Verify result
        assert result is not None
        assert "id" in result
        assert "model" in result
        assert "text" in result
        assert "usage" in result
        assert result["model"].startswith("text-davinci-003")  # Model name may have version suffix
        assert len(result["text"]) > 0

        # Flush spans
        await sdk.flush()

        # Shutdown
        await sdk.shutdown()

    @pytest.mark.asyncio
    async def test_openai_embedding_real_api(self):
        """Test real OpenAI embedding with tracing."""
        # Skip if no OpenAI API key
        if not os.getenv("OPENAI_API_KEY"):
            pytest.skip("OPENAI_API_KEY not set")

        sdk = init(self.config)
        tracer = sdk.get_tracer()
        metrics = sdk.get_metrics()

        # Create LLM attributes
        attributes = create_llm_attributes(
            provider="openai",
            model="text-embedding-ada-002",
            operation_type="embedding"
        )

        async def openai_embedding_call(span):
            """Make actual OpenAI embedding API call with tracing."""
            try:
                # Import OpenAI client
                from openai import AsyncOpenAI

                client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

                # Set request attributes
                span.set_attribute("llm.request.model", "text-embedding-ada-002")
                span.set_attribute("llm.request.input", "Hello world")

                span.add_event("llm.request.start")

                # Make the actual API call
                response = await client.embeddings.create(
                    model="text-embedding-ada-002",
                    input="Hello world"
                )

                span.add_event("llm.response.received")

                # Extract response data
                embedding = response.data[0]
                usage = response.usage

                # Set response attributes
                span.set_attribute("llm.response.model", response.model)
                span.set_attribute("llm.response.embeddings_count", len(response.data))
                span.set_attribute("llm.response.embedding_dimension", len(embedding.embedding))

                # Set usage attributes
                if usage:
                    span.set_attribute("llm.prompt.tokens", usage.prompt_tokens)
                    span.set_attribute("llm.total.tokens", usage.total_tokens)

                    # Record metrics
                    token_usage = TokenUsage(
                        model=response.model,
                        provider="openai",
                        prompt_tokens=usage.prompt_tokens,
                        total_tokens=usage.total_tokens
                    )
                    metrics.record_token_usage(token_usage)

                # Record latency
                metrics.record_latency(100.0, {"operation": "embedding"})

                return {
                    "model": response.model,
                    "embedding": embedding.embedding,
                    "usage": {
                        "prompt_tokens": usage.prompt_tokens if usage else 0,
                        "total_tokens": usage.total_tokens if usage else 0,
                    }
                }

            except Exception as e:
                span.record_exception(e)
                span.set_attribute("llm.error", str(e))
                span.set_attribute("llm.error.type", type(e).__name__)
                raise

        # Execute with span
        result = await tracer.with_llm_span(
            "openai.embeddings.create",
            attributes,
            openai_embedding_call
        )

        # Verify result
        assert result is not None
        assert "model" in result
        assert "embedding" in result
        assert "usage" in result
        assert result["model"].startswith("text-embedding-ada-002")  # Model name may have version suffix
        assert len(result["embedding"]) > 0
        assert isinstance(result["embedding"], list)

        # Flush spans
        await sdk.flush()

        # Shutdown
        await sdk.shutdown()

    @pytest.mark.asyncio
    async def test_openai_error_handling_real_api(self):
        """Test OpenAI error handling with real API."""
        # Skip if no OpenAI API key
        if not os.getenv("OPENAI_API_KEY"):
            pytest.skip("OPENAI_API_KEY not set")

        sdk = init(self.config)
        tracer = sdk.get_tracer()

        # Create LLM attributes
        attributes = create_llm_attributes(
            provider="openai",
            model="gpt-3.5-turbo",
            operation_type="chat"
        )

        async def openai_error_call(span):
            """Make OpenAI API call that will fail."""
            try:
                # Import OpenAI client
                from openai import AsyncOpenAI

                client = AsyncOpenAI(api_key="invalid-key")

                # Set request attributes
                span.set_attribute("llm.request.model", "gpt-3.5-turbo")
                span.set_attribute("llm.request.messages", '[{"role": "user", "content": "Hello"}]')

                span.add_event("llm.request.start")

                # Make the actual API call (this should fail)
                response = await client.chat.completions.create(
                    model="gpt-3.5-turbo",
                    messages=[{"role": "user", "content": "Hello"}],
                    max_tokens=10
                )

                return response

            except Exception as e:
                span.record_exception(e)
                span.set_attribute("llm.error", str(e))
                span.set_attribute("llm.error.type", type(e).__name__)
                raise

        # Execute with span - should raise exception
        with pytest.raises(Exception):
            await tracer.with_llm_span(
                "openai.chat.completions.create",
                attributes,
                openai_error_call
            )

        # Flush spans
        await sdk.flush()

        # Shutdown
        await sdk.shutdown()

    @pytest.mark.asyncio
    async def test_openai_streaming_real_api(self):
        """Test real OpenAI streaming with tracing."""
        # Skip if no OpenAI API key
        if not os.getenv("OPENAI_API_KEY"):
            pytest.skip("OPENAI_API_KEY not set")

        sdk = init(self.config)
        tracer = sdk.get_tracer()

        # Create LLM attributes
        attributes = create_llm_attributes(
            provider="openai",
            model="gpt-3.5-turbo",
            operation_type="chat",
            stream=True
        )

        async def openai_streaming_call(span):
            """Make actual OpenAI streaming API call with tracing."""
            try:
                # Import OpenAI client
                from openai import AsyncOpenAI

                client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

                # Set request attributes
                span.set_attribute("llm.request.model", "gpt-3.5-turbo")
                span.set_attribute("llm.request.messages", '[{"role": "user", "content": "Tell me a short story"}]')
                span.set_attribute("llm.stream", True)

                span.add_event("llm.request.start")

                # Make the actual streaming API call
                stream = await client.chat.completions.create(
                    model="gpt-3.5-turbo",
                    messages=[{"role": "user", "content": "Tell me a short story"}],
                    stream=True,
                    max_tokens=100
                )

                chunks = []
                chunk_count = 0

                async for chunk in stream:
                    chunk_count += 1
                    span.add_event("llm.response.chunk", {"chunk.index": chunk_count})
                    chunks.append(chunk)

                span.add_event("llm.response.complete")
                span.set_attribute("llm.response.chunks_count", chunk_count)

                return {
                    "chunks": chunks,
                    "chunk_count": chunk_count
                }

            except Exception as e:
                span.record_exception(e)
                span.set_attribute("llm.error", str(e))
                span.set_attribute("llm.error.type", type(e).__name__)
                raise

        # Execute with span
        result = await tracer.with_llm_span(
            "openai.chat.completions.create",
            attributes,
            openai_streaming_call
        )

        # Verify result
        assert result is not None
        assert "chunks" in result
        assert "chunk_count" in result
        assert result["chunk_count"] > 0
        assert len(result["chunks"]) > 0

        # Flush spans
        await sdk.flush()

        # Shutdown
        await sdk.shutdown()

    def test_openai_cost_calculation(self):
        """Test cost calculation for OpenAI API calls."""
        sdk = init(self.config)
        metrics = sdk.get_metrics()

        # Test cost recording for different models
        models_and_costs = [
            ("gpt-3.5-turbo", 0.0015, 0.002),
            ("gpt-4", 0.03, 0.06),
            ("text-davinci-003", 0.02, 0.02),
        ]

        for model, prompt_cost, completion_cost in models_and_costs:
            # Simulate token usage
            prompt_tokens = 100
            completion_tokens = 50

            # Calculate costs (rough estimates)
            total_cost = (prompt_tokens * prompt_cost / 1000) + (completion_tokens * completion_cost / 1000)

            cost = Cost(
                model=model,
                provider="openai",
                total=total_cost,
                prompt=prompt_tokens * prompt_cost / 1000,
                completion=completion_tokens * completion_cost / 1000
            )

            # Record cost
            metrics.record_cost(cost)

            # Verify cost calculation
            assert cost.total > 0
            assert cost.prompt > 0
            assert cost.completion > 0
            assert cost.model == model
            assert cost.provider == "openai"

        # Shutdown
        asyncio.run(sdk.shutdown())
