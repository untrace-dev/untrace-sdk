"""Test seamless developer experience with auto-instrumentation."""

import asyncio
import os
import pytest
from unittest.mock import patch

from untrace import init, UntraceConfig


class TestSeamlessDX:
    """Test seamless developer experience."""

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
    async def test_seamless_openai_chat_completion(self):
        """Test seamless OpenAI chat completion with auto-instrumentation."""
        # Skip if no OpenAI API key
        if not os.getenv("OPENAI_API_KEY"):
            pytest.skip("OPENAI_API_KEY not set")

        # Initialize Untrace SDK - this should auto-instrument OpenAI
        sdk = init(self.config)

        # Now just use OpenAI normally - it should be automatically traced!
        from openai import OpenAI

        client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

        # This call should be automatically traced
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": "What is 2+2?"}],
            max_tokens=10
        )

        # Verify response
        assert response is not None
        assert hasattr(response, 'choices')
        assert len(response.choices) > 0
        assert hasattr(response.choices[0], 'message')
        assert response.choices[0].message.content is not None

        # Flush spans
        await sdk.flush()

        # Shutdown
        await sdk.shutdown()

    @pytest.mark.asyncio
    async def test_seamless_openai_embedding(self):
        """Test seamless OpenAI embedding with auto-instrumentation."""
        # Skip if no OpenAI API key
        if not os.getenv("OPENAI_API_KEY"):
            pytest.skip("OPENAI_API_KEY not set")

        # Initialize Untrace SDK - this should auto-instrument OpenAI
        sdk = init(self.config)

        # Now just use OpenAI normally - it should be automatically traced!
        from openai import OpenAI

        client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

        # This call should be automatically traced
        response = client.embeddings.create(
            model="text-embedding-ada-002",
            input="Hello, world!"
        )

        # Verify response
        assert response is not None
        assert hasattr(response, 'data')
        assert len(response.data) > 0
        assert hasattr(response.data[0], 'embedding')
        assert len(response.data[0].embedding) > 0

        # Flush spans
        await sdk.flush()

        # Shutdown
        await sdk.shutdown()

    @pytest.mark.asyncio
    async def test_seamless_openai_async_client(self):
        """Test seamless OpenAI async client with auto-instrumentation."""
        # Skip if no OpenAI API key
        if not os.getenv("OPENAI_API_KEY"):
            pytest.skip("OPENAI_API_KEY not set")

        # Initialize Untrace SDK - this should auto-instrument OpenAI
        sdk = init(self.config)

        # Now just use OpenAI async client normally - it should be automatically traced!
        from openai import AsyncOpenAI

        client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

        # This call should be automatically traced
        response = await client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": "What is the capital of France?"}],
            max_tokens=10
        )

        # Verify response
        assert response is not None
        assert hasattr(response, 'choices')
        assert len(response.choices) > 0
        assert hasattr(response.choices[0], 'message')
        assert response.choices[0].message.content is not None

        # Flush spans
        await sdk.flush()

        # Shutdown
        await sdk.shutdown()

    def test_developer_experience_example(self):
        """Test the exact developer experience example from the user."""
        # Skip if no OpenAI API key
        if not os.getenv("OPENAI_API_KEY"):
            pytest.skip("OPENAI_API_KEY not set")

        # This is the exact example from the user's request
        from openai import OpenAI
        from untrace import init

        # Initialize Untrace - this should auto-instrument everything
        init(UntraceConfig(
            api_key=os.getenv("UNTRACE_API_KEY", "test-api-key"),
            base_url="https://untrace.dev",
            debug=True,
        ))

        # Now just use OpenAI normally - it should be automatically traced!
        client = OpenAI(
            # This is the default and can be omitted
            api_key=os.environ.get("OPENAI_API_KEY"),
        )

        # This call should be automatically traced
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": "Hello, world!"}],
            max_tokens=10
        )

        # Verify response
        assert response is not None
        assert hasattr(response, 'choices')
        assert len(response.choices) > 0
        assert hasattr(response.choices[0], 'message')
        assert response.choices[0].message.content is not None

    @pytest.mark.asyncio
    async def test_error_handling_with_auto_instrumentation(self):
        """Test error handling with auto-instrumentation."""
        # Initialize Untrace SDK - this should auto-instrument OpenAI
        sdk = init(self.config)

        # Use OpenAI with invalid API key - should be traced and handled
        from openai import OpenAI

        client = OpenAI(api_key="invalid-key")

        # This call should fail but be traced
        with pytest.raises(Exception):
            await client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[{"role": "user", "content": "Hello"}],
                max_tokens=10
            )

        # Flush spans
        await sdk.flush()

        # Shutdown
        await sdk.shutdown()

    def test_multiple_clients_auto_instrumentation(self):
        """Test that multiple OpenAI clients are all auto-instrumented."""
        # Skip if no OpenAI API key
        if not os.getenv("OPENAI_API_KEY"):
            pytest.skip("OPENAI_API_KEY not set")

        # Initialize Untrace SDK - this should auto-instrument OpenAI
        sdk = init(self.config)

        # Create multiple clients - all should be auto-instrumented
        from openai import OpenAI, AsyncOpenAI

        sync_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        async_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

        # Both clients should work and be traced
        sync_response = sync_client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": "Hello from sync client"}],
            max_tokens=10
        )

        async def test_async():
            return await async_client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[{"role": "user", "content": "Hello from async client"}],
                max_tokens=10
            )

        async_response = asyncio.run(test_async())

        # Verify both responses
        assert sync_response is not None
        assert async_response is not None
        assert hasattr(sync_response, 'choices')
        assert hasattr(async_response, 'choices')

        # Flush spans
        asyncio.run(sdk.flush())

        # Shutdown
        asyncio.run(sdk.shutdown())
