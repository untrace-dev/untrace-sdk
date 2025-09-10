"""Test modular instrumentation system."""

import os
import pytest
from unittest.mock import patch

from untrace import (
    init,
    UntraceConfig,
    get_supported_providers,
    get_instrumented_providers,
    is_provider_instrumented,
    instrument_all,
    uninstrument_all,
)


class TestModularInstrumentation:
    """Test modular instrumentation system."""

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

        # Uninstrument all providers
        uninstrument_all()

    def test_get_supported_providers(self):
        """Test getting supported providers list."""
        providers = get_supported_providers()

        assert isinstance(providers, list)
        assert "openai" in providers
        assert "anthropic" in providers
        assert "google" in providers
        assert "microsoft" in providers
        assert "aws" in providers
        assert "cohere" in providers

    def test_instrumentation_state_tracking(self):
        """Test instrumentation state tracking."""
        # Initially no providers should be instrumented
        assert len(get_instrumented_providers()) == 0
        assert not is_provider_instrumented("openai")

        # Initialize SDK - should instrument providers
        sdk = init(self.config)

        # Check that providers are instrumented
        instrumented = get_instrumented_providers()
        assert "openai" in instrumented

        # Test individual provider checks
        assert is_provider_instrumented("openai")
        assert not is_provider_instrumented("nonexistent")

    def test_manual_instrumentation(self):
        """Test manual instrumentation of specific providers."""
        from untrace import instrument_openai, uninstrument_openai

        # Initialize SDK first
        sdk = init(self.config)

        # Initially not instrumented
        assert not is_provider_instrumented("openai")

        # Manually instrument OpenAI
        instrument_openai(sdk.get_tracer(), sdk.get_metrics(), sdk.get_context())
        assert is_provider_instrumented("openai")

        # Uninstrument OpenAI
        uninstrument_openai()
        assert not is_provider_instrumented("openai")

    def test_instrument_all_providers(self):
        """Test instrumenting all providers."""
        sdk = init(self.config)

        # Instrument all providers
        instrument_all(sdk.get_tracer(), sdk.get_metrics(), sdk.get_context())

        # Check that all supported providers are instrumented
        instrumented = get_instrumented_providers()
        supported = get_supported_providers()

        for provider in supported:
            assert provider in instrumented

    def test_instrument_specific_providers(self):
        """Test instrumenting specific providers only."""
        sdk = init(self.config)

        # Instrument only specific providers
        specific_providers = ["openai", "anthropic"]
        instrument_all(sdk.get_tracer(), sdk.get_metrics(), sdk.get_context(), specific_providers)

        # Check that only specified providers are instrumented
        instrumented = get_instrumented_providers()
        assert "openai" in instrumented
        assert "anthropic" in instrumented
        assert "google" not in instrumented

    def test_uninstrument_all(self):
        """Test uninstrumenting all providers."""
        sdk = init(self.config)

        # Instrument all providers
        instrument_all(sdk.get_tracer(), sdk.get_metrics(), sdk.get_context())
        assert len(get_instrumented_providers()) > 0

        # Uninstrument all
        uninstrument_all()
        assert len(get_instrumented_providers()) == 0

    def test_provider_specific_instrumentation(self):
        """Test provider-specific instrumentation functions."""
        sdk = init(self.config)
        tracer = sdk.get_tracer()
        metrics = sdk.get_metrics()
        context = sdk.get_context()

        # Test OpenAI instrumentation
        from untrace import instrument_openai, uninstrument_openai
        instrument_openai(tracer, metrics, context)
        assert is_provider_instrumented("openai")
        uninstrument_openai()
        assert not is_provider_instrumented("openai")

        # Test Anthropic instrumentation
        from untrace import instrument_anthropic, uninstrument_anthropic
        instrument_anthropic(tracer, metrics, context)
        assert is_provider_instrumented("anthropic")
        uninstrument_anthropic()
        assert not is_provider_instrumented("anthropic")

        # Test Google instrumentation
        from untrace import instrument_google, uninstrument_google
        instrument_google(tracer, metrics, context)
        assert is_provider_instrumented("google")
        uninstrument_google()
        assert not is_provider_instrumented("google")

        # Test Microsoft instrumentation
        from untrace import instrument_microsoft, uninstrument_microsoft
        instrument_microsoft(tracer, metrics, context)
        assert is_provider_instrumented("microsoft")
        uninstrument_microsoft()
        assert not is_provider_instrumented("microsoft")

        # Test AWS instrumentation
        from untrace import instrument_aws, uninstrument_aws
        instrument_aws(tracer, metrics, context)
        assert is_provider_instrumented("aws")
        uninstrument_aws()
        assert not is_provider_instrumented("aws")

        # Test Cohere instrumentation
        from untrace import instrument_cohere, uninstrument_cohere
        instrument_cohere(tracer, metrics, context)
        assert is_provider_instrumented("cohere")
        uninstrument_cohere()
        assert not is_provider_instrumented("cohere")

    def test_auto_instrumentation_with_specific_providers(self):
        """Test auto-instrumentation with specific providers in config."""
        # Test with specific providers
        config = UntraceConfig(
            api_key="test-api-key",
            base_url="https://untrace.dev",
            debug=True,
            providers=["openai", "anthropic"]
        )

        sdk = init(config)

        # Check that only specified providers are instrumented
        instrumented = get_instrumented_providers()
        assert "openai" in instrumented
        assert "anthropic" in instrumented
        assert "google" not in instrumented

    def test_auto_instrumentation_with_all_providers(self):
        """Test auto-instrumentation with 'all' providers."""
        # Test with all providers
        config = UntraceConfig(
            api_key="test-api-key",
            base_url="https://untrace.dev",
            debug=True,
            providers=["all"]
        )

        sdk = init(config)

        # Check that all supported providers are instrumented
        instrumented = get_instrumented_providers()
        supported = get_supported_providers()

        for provider in supported:
            assert provider in instrumented

    def test_instrumentation_error_handling(self):
        """Test error handling in instrumentation."""
        sdk = init(self.config)

        # Test instrumenting non-existent provider
        from untrace.instrumentation import instrument_provider
        result = instrument_provider("nonexistent", sdk.get_tracer(), sdk.get_metrics(), sdk.get_context())
        assert result is None

    def test_provider_registry(self):
        """Test provider registry functionality."""
        from untrace.instrumentation import PROVIDER_INSTRUMENTATIONS

        # Check that all expected providers are in registry
        expected_providers = ["openai", "anthropic", "google", "microsoft", "aws", "cohere"]
        for provider in expected_providers:
            assert provider in PROVIDER_INSTRUMENTATIONS
            assert PROVIDER_INSTRUMENTATIONS[provider] is not None

    def test_base_provider_instrumentation(self):
        """Test base provider instrumentation class."""
        from untrace.instrumentation.base import BaseProviderInstrumentation
        from untrace.tracer import UntraceTracer
        from untrace.metrics import UntraceMetrics
        from untrace.context import UntraceContext

        # Create mock components
        tracer = UntraceTracer(None)
        metrics = UntraceMetrics()
        context = UntraceContext()

        # Test base class functionality
        base = BaseProviderInstrumentation(tracer, metrics, context, "test")
        assert base.provider_name == "test"
        assert not base._is_instrumented()

        # Test attribute creation
        attributes = base._create_llm_attributes("test-model", "chat", temperature=0.7)
        assert attributes["provider"] == "test"
        assert attributes["model"] == "test-model"
        assert attributes["operation_type"] == "chat"
        assert attributes["temperature"] == 0.7
