"""OpenTelemetry integration tests for the Untrace SDK."""

import asyncio
import os
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
import httpx

from untrace import (
    Untrace,
    init,
    UntraceConfig,
    LLMSpanAttributes,
    create_llm_attributes,
)


class TestOpenTelemetryIntegration:
    """Test OpenTelemetry integration functionality."""

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
    async def test_span_export_with_mock_server(self):
        """Test span export with a mock server."""
        sdk = init(self.config)
        tracer = sdk.get_tracer()

        # Create a test span
        attributes = create_llm_attributes(
            provider="openai",
            model="gpt-4",
            operation_type="chat",
            temperature=0.7,
            max_tokens=1000
        )

        span = tracer.start_llm_span("test-llm-call", attributes)
        span.set_attribute("test.custom", "test-value")
        span.add_event("test-event", {"event.attr": "event-value"})
        span.end()

        # Mock the HTTP response
        mock_response = AsyncMock()
        mock_response.is_success = True
        mock_response.status_code = 200
        mock_response.text = '{"status": "success"}'

        with patch('httpx.AsyncClient.post', return_value=mock_response) as mock_post:
            # Force flush to trigger export
            await sdk.flush()

            # Verify the request was made
            mock_post.assert_called_once()
            call_args = mock_post.call_args

            # Check the URL
            assert call_args[0][0] == "https://test.untrace.dev/api/v1/traces/ingest"

            # Check the headers
            headers = call_args[1]["headers"]
            assert headers["Authorization"] == "Bearer test-api-key"
            assert headers["Content-Type"] == "application/json"

            # Check the payload structure
            payload = call_args[1]["json"]
            assert "resourceSpans" in payload
            assert len(payload["resourceSpans"]) > 0

            resource_span = payload["resourceSpans"][0]
            assert "resource" in resource_span
            assert "scopeSpans" in resource_span

            scope_spans = resource_span["scopeSpans"]
            assert len(scope_spans) > 0

            spans = scope_spans[0]["spans"]
            assert len(spans) > 0

            span_data = spans[0]
            assert span_data["name"] == "test-llm-call"
            assert span_data["kind"] == 3  # CLIENT kind
            assert "attributes" in span_data
            assert "events" in span_data

    @pytest.mark.asyncio
    async def test_span_export_failure_handling(self):
        """Test span export failure handling."""
        sdk = init(self.config)
        tracer = sdk.get_tracer()

        # Create a test span
        span = tracer.start_workflow_span("test-workflow")
        span.end()

        # Mock HTTP failure
        mock_response = AsyncMock()
        mock_response.is_success = False
        mock_response.status_code = 500
        mock_response.text = "Internal Server Error"

        with patch('httpx.AsyncClient.post', return_value=mock_response):
            # Force flush should not raise an exception
            await sdk.flush()

    @pytest.mark.asyncio
    async def test_span_export_network_error_handling(self):
        """Test span export network error handling."""
        sdk = init(self.config)
        tracer = sdk.get_tracer()

        # Create a test span
        span = tracer.start_tool_span("test-tool")
        span.end()

        # Mock network error
        with patch('httpx.AsyncClient.post', side_effect=httpx.RequestError("Network error")):
            # Force flush should not raise an exception
            await sdk.flush()

    def test_span_context_propagation(self):
        """Test span context propagation."""
        sdk = init(self.config)
        tracer = sdk.get_tracer()

        # Create parent span
        parent_span = tracer.start_workflow_span("parent-workflow")

        # Create child span
        child_span = tracer.start_tool_span("child-tool", parent=parent_span)

        # Verify parent-child relationship
        assert child_span is not None
        assert parent_span is not None

        # End spans
        child_span.end()
        parent_span.end()

    def test_span_attributes_and_events(self):
        """Test span attributes and events."""
        sdk = init(self.config)
        tracer = sdk.get_tracer()

        span = tracer.start_llm_span(
            "test-llm",
            {
                "llm.provider": "openai",
                "llm.model": "gpt-4",
                "llm.operation.type": "chat"
            }
        )

        # Add more attributes
        span.set_attribute("custom.attribute", "custom-value")
        span.set_attribute("numeric.attribute", 42)
        span.set_attribute("boolean.attribute", True)

        # Add events
        span.add_event("llm.request", {"request.id": "req-123"})
        span.add_event("llm.response", {"response.id": "resp-456"})

        # Set status
        from opentelemetry.trace import StatusCode
        span.set_status(StatusCode.OK, "Success")

        span.end()

    def test_span_exception_recording(self):
        """Test span exception recording."""
        sdk = init(self.config)
        tracer = sdk.get_tracer()

        span = tracer.start_workflow_span("test-workflow")

        try:
            raise ValueError("Test error")
        except Exception as e:
            span.record_exception(e, {"error.context": "test"})
            from opentelemetry.trace import StatusCode
            span.set_status(StatusCode.ERROR, str(e))

        span.end()

    @pytest.mark.asyncio
    async def test_async_span_wrapping(self):
        """Test async span wrapping."""
        sdk = init(self.config)
        tracer = sdk.get_tracer()

        async def async_function(span):
            span.set_attribute("function.name", "async_function")
            await asyncio.sleep(0.01)  # Simulate async work
            return "async-result"

        result = await tracer.with_llm_span(
            "async-llm-call",
            create_llm_attributes("openai", "gpt-4", "chat"),
            async_function
        )

        assert result == "async-result"

    def test_metrics_integration(self):
        """Test metrics integration."""
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

        # Test latency recording
        metrics.record_latency(150.5, {"operation": "test"})

        # Test error recording
        error = ValueError("Test error")
        metrics.record_error(error, {"test": "attribute"})

    def test_context_integration(self):
        """Test context integration."""
        sdk = init(self.config)
        context = sdk.get_context()
        tracer = sdk.get_tracer()

        # Set context values
        context.set_user_id("test-user")
        context.set_session_id("test-session")
        context.set_metadata({"test": "metadata"})

        # Create span and attach context
        span = tracer.start_workflow_span("test-workflow")
        context.attach_to_span(span)

        # Verify context was attached
        span.end()

    def test_resource_attributes(self):
        """Test resource attributes."""
        config = UntraceConfig(
            api_key="test-key",
            version="1.0.0",
            resource_attributes={
                "service.name": "test-service",
                "service.version": "1.0.0",
                "deployment.environment": "test"
            }
        )

        sdk = init(config)
        tracer = sdk.get_tracer()

        span = tracer.start_workflow_span("test-workflow")
        span.end()

    def test_batch_span_processing(self):
        """Test batch span processing."""
        sdk = init(self.config)
        tracer = sdk.get_tracer()

        # Create multiple spans
        spans = []
        for i in range(5):
            span = tracer.start_workflow_span(f"workflow-{i}")
            span.set_attribute("workflow.index", i)
            spans.append(span)

        # End all spans
        for span in spans:
            span.end()

    @pytest.mark.asyncio
    async def test_flush_and_shutdown(self):
        """Test flush and shutdown functionality."""
        sdk = init(self.config)
        tracer = sdk.get_tracer()

        # Create some spans
        span = tracer.start_workflow_span("test-workflow")
        span.end()

        # Test flush
        await sdk.flush()

        # Test shutdown
        await sdk.shutdown()

    def test_span_kind_handling(self):
        """Test different span kinds."""
        sdk = init(self.config)
        tracer = sdk.get_tracer()

        # Test different span kinds
        from opentelemetry.trace import SpanKind

        # Internal span
        internal_span = tracer.start_span(
            tracer.start_span.__class__(
                name="internal-span",
                kind=SpanKind.INTERNAL
            )
        )
        internal_span.end()

        # Client span
        client_span = tracer.start_llm_span(
            "client-span",
            create_llm_attributes("openai", "gpt-4", "chat")
        )
        client_span.end()

        # Server span
        server_span = tracer.start_span(
            tracer.start_span.__class__(
                name="server-span",
                kind=SpanKind.SERVER
            )
        )
        server_span.end()

    def test_span_timing(self):
        """Test span timing."""
        sdk = init(self.config)
        tracer = sdk.get_tracer()

        import time

        span = tracer.start_workflow_span("timing-test")

        # Simulate some work
        time.sleep(0.01)

        span.end()

        # Verify span has timing information
        assert span.start_time is not None
        assert span.end_time is not None
        assert span.end_time > span.start_time
