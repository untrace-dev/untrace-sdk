"""Tests for the UntraceClient."""

import pytest
from unittest.mock import AsyncMock, patch
from untrace import UntraceClient, UntraceAPIError, UntraceValidationError


class TestUntraceClient:
    """Test cases for UntraceClient."""

    def test_client_initialization(self):
        """Test client initialization."""
        client = UntraceClient(api_key="test-key")
        assert client.api_key == "test-key"
        assert client.base_url == "https://api.untrace.dev"
        assert client.timeout == 30.0

    def test_client_initialization_with_custom_params(self):
        """Test client initialization with custom parameters."""
        client = UntraceClient(
            api_key="test-key",
            base_url="https://custom.api.com",
            timeout=60.0
        )
        assert client.api_key == "test-key"
        assert client.base_url == "https://custom.api.com"
        assert client.timeout == 60.0

    @pytest.mark.asyncio
    async def test_trace_success(self):
        """Test successful trace creation."""
        client = UntraceClient(api_key="test-key")

        mock_response = AsyncMock()
        mock_response.json.return_value = {
            "id": "trace-123",
            "timestamp": "2023-01-01T00:00:00Z",
            "event_type": "llm_call",
            "data": {"model": "gpt-4"},
            "metadata": {}
        }

        with patch.object(client._client, 'post', return_value=mock_response):
            trace = await client.trace(
                event_type="llm_call",
                data={"model": "gpt-4"},
                metadata={"user_id": "user123"}
            )

            assert trace.id == "trace-123"
            assert trace.event_type == "llm_call"
            assert trace.data == {"model": "gpt-4"}

    @pytest.mark.asyncio
    async def test_trace_validation_error(self):
        """Test trace creation with validation error."""
        client = UntraceClient(api_key="test-key")

        mock_response = AsyncMock()
        mock_response.status_code = 422
        mock_response.text = "Validation error"

        with patch.object(client._client, 'post', return_value=mock_response):
            with pytest.raises(UntraceValidationError):
                await client.trace(
                    event_type="invalid",
                    data={}
                )

    @pytest.mark.asyncio
    async def test_trace_api_error(self):
        """Test trace creation with API error."""
        client = UntraceClient(api_key="test-key")

        mock_response = AsyncMock()
        mock_response.status_code = 500
        mock_response.text = "Internal server error"

        with patch.object(client._client, 'post', return_value=mock_response):
            with pytest.raises(UntraceAPIError):
                await client.trace(
                    event_type="llm_call",
                    data={"model": "gpt-4"}
                )
