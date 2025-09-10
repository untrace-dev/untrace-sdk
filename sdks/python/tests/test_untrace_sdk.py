"""Integration tests for the Untrace SDK."""

import asyncio
import os
import pytest
from unittest.mock import AsyncMock, patch

from untrace import (
    Untrace,
    init,
    get_untrace,
    UntraceConfig,
    LLMSpanAttributes,
    TokenUsage,
    Cost,
    create_llm_attributes,
)


class TestUntraceSDK:
    """Test cases for the Untrace SDK."""

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

    def test_sdk_initialization(self):
        """Test SDK initialization."""
        sdk = init(self.config)

        assert sdk is not None
        assert sdk.config.api_key == "test-api-key"
        assert sdk.config.base_url == "https://test.untrace.dev"
        assert sdk.config.debug is True

    def test_singleton_behavior(self):
        """Test that SDK follows singleton pattern."""
        sdk1 = init(self.config)
        sdk2 = init(self.config)

        assert sdk1 is sdk2

    def test_get_untrace(self):
        """Test getting the current Untrace instance."""
        sdk = init(self.config)
        current_sdk = get_untrace()

        assert current_sdk is sdk

    def test_get_untrace_without_init(self):
        """Test getting Untrace instance without initialization."""
        with pytest.raises(RuntimeError, match="Untrace SDK not initialized"):
            get_untrace()

    def test_tracer_access(self):
        """Test accessing the tracer."""
        sdk = init(self.config)
        tracer = sdk.get_tracer()

        assert tracer is not None
        assert hasattr(tracer, 'start_span')
        assert hasattr(tracer, 'start_llm_span')

    def test_metrics_access(self):
        """Test accessing the metrics."""
        sdk = init(self.config)
        metrics = sdk.get_metrics()

        assert metrics is not None
        assert hasattr(metrics, 'record_token_usage')
        assert hasattr(metrics, 'record_latency')

    def test_context_access(self):
        """Test accessing the context."""
        sdk = init(self.config)
        context = sdk.get_context()

        assert context is not None
        assert hasattr(context, 'set_user_id')
        assert hasattr(context, 'get_user_id')

    def test_context_management(self):
        """Test context management functionality."""
        sdk = init(self.config)
        context = sdk.get_context()

        # Test setting and getting user ID
        context.set_user_id("test-user")
        assert context.get_user_id() == "test-user"

        # Test setting and getting session ID
        context.set_session_id("test-session")
        assert context.get_session_id() == "test-session"

        # Test workflow context creation
        workflow_context = context.create_workflow_context(
            "test-workflow",
            user_id="test-user",
            metadata={"test": "value"}
        )

        assert "workflow_id" in workflow_context
        assert "run_id" in workflow_context
        assert workflow_context["user_id"] == "test-user"

    def test_llm_span_creation(self):
        """Test LLM span creation."""
        sdk = init(self.config)
        tracer = sdk.get_tracer()

        # Test with LLMSpanAttributes object
        attributes = LLMSpanAttributes(
            provider="openai",
            model="gpt-4",
            operation_type="chat",
            temperature=0.7,
            max_tokens=1000
        )

        span = tracer.start_llm_span("test-llm-call", attributes)
        assert span is not None
        assert span.name == "test-llm-call"
        span.end()

    def test_llm_span_with_dict_attributes(self):
        """Test LLM span creation with dictionary attributes."""
        sdk = init(self.config)
        tracer = sdk.get_tracer()

        attributes = {
            "llm.provider": "openai",
            "llm.model": "gpt-4",
            "llm.operation.type": "chat",
            "llm.temperature": 0.7,
        }

        span = tracer.start_llm_span("test-llm-call", attributes)
        assert span is not None
        span.end()

    def test_workflow_span_creation(self):
        """Test workflow span creation."""
        sdk = init(self.config)
        tracer = sdk.get_tracer()

        span = tracer.start_workflow_span(
            "test-workflow",
            {"custom": "attribute"}
        )

        assert span is not None
        assert span.name == "test-workflow"
        span.end()

    def test_tool_span_creation(self):
        """Test tool span creation."""
        sdk = init(self.config)
        tracer = sdk.get_tracer()

        span = tracer.start_tool_span(
            "test-tool",
            {"tool.type": "function"}
        )

        assert span is not None
        assert span.name == "test-tool"
        span.end()

    @pytest.mark.asyncio
    async def test_with_span_decorator(self):
        """Test the with_span decorator."""
        sdk = init(self.config)
        tracer = sdk.get_tracer()

        async def test_function(span):
            span.set_attribute("test.attribute", "test-value")
            return "test-result"

        result = await tracer.with_span(
            tracer.start_span.__class__(
                name="test-span",
                attributes={"test": "value"}
            ),
            test_function
        )

        assert result == "test-result"

    @pytest.mark.asyncio
    async def test_with_llm_span_decorator(self):
        """Test the with_llm_span decorator."""
        sdk = init(self.config)
        tracer = sdk.get_tracer()

        async def test_llm_function(span):
            span.set_attribute("llm.response", "test-response")
            return "llm-result"

        attributes = create_llm_attributes(
            provider="openai",
            model="gpt-4",
            operation_type="chat"
        )

        result = await tracer.with_llm_span(
            "test-llm-call",
            attributes,
            test_llm_function
        )

        assert result == "llm-result"

    def test_token_usage_recording(self):
        """Test token usage recording."""
        sdk = init(self.config)
        metrics = sdk.get_metrics()

        usage = TokenUsage(
            model="gpt-4",
            provider="openai",
            prompt_tokens=100,
            completion_tokens=50,
            total_tokens=150
        )

        # This should not raise an exception
        metrics.record_token_usage(usage)

    def test_cost_recording(self):
        """Test cost recording."""
        sdk = init(self.config)
        metrics = sdk.get_metrics()

        cost = Cost(
            model="gpt-4",
            provider="openai",
            total=0.01,
            prompt=0.005,
            completion=0.005
        )

        # This should not raise an exception
        metrics.record_cost(cost)

    def test_error_recording(self):
        """Test error recording."""
        sdk = init(self.config)
        metrics = sdk.get_metrics()

        error = ValueError("Test error")

        # This should not raise an exception
        metrics.record_error(error, {"test": "attribute"})

    def test_latency_recording(self):
        """Test latency recording."""
        sdk = init(self.config)
        metrics = sdk.get_metrics()

        # This should not raise an exception
        metrics.record_latency(150.5, {"operation": "test"})

    @pytest.mark.asyncio
    async def test_flush_functionality(self):
        """Test flush functionality."""
        sdk = init(self.config)

        # This should not raise an exception
        await sdk.flush()

    @pytest.mark.asyncio
    async def test_shutdown_functionality(self):
        """Test shutdown functionality."""
        sdk = init(self.config)

        # This should not raise an exception
        await sdk.shutdown()

    def test_instrument_method(self):
        """Test the instrument method."""
        sdk = init(self.config)

        # Test with supported provider
        mock_module = object()
        instrumented = sdk.instrument("openai", mock_module)

        # For now, it should return the same module
        assert instrumented is mock_module

    def test_instrument_unsupported_provider(self):
        """Test instrumenting unsupported provider."""
        sdk = init(self.config)

        with pytest.raises(ValueError, match="Unknown provider"):
            sdk.instrument("unsupported", object())

    def test_config_defaults(self):
        """Test configuration defaults."""
        config = UntraceConfig(api_key="test-key")

        assert config.base_url == "https://untrace.dev"
        assert config.version == "0.1.0"
        assert config.debug is False
        assert config.disable_auto_instrumentation is False
        assert config.sampling_rate == 1.0
        assert config.max_batch_size == 512
        assert config.export_interval_ms == 5000
        assert config.capture_body is True
        assert config.capture_errors is True
        assert config.providers == ["all"]

    def test_llm_attributes_creation(self):
        """Test LLM attributes creation."""
        attributes = create_llm_attributes(
            provider="openai",
            model="gpt-4",
            operation_type="chat",
            temperature=0.7,
            max_tokens=1000
        )

        assert isinstance(attributes, LLMSpanAttributes)
        attrs_dict = attributes.to_dict()

        assert attrs_dict["llm.provider"] == "openai"
        assert attrs_dict["llm.model"] == "gpt-4"
        assert attrs_dict["llm.operation.type"] == "chat"
        assert attrs_dict["llm.temperature"] == 0.7
        assert attrs_dict["llm.max_tokens"] == 1000
