"""Instrumentation package for LLM providers."""

from .base import BaseProviderInstrumentation
from .openai import OpenAIInstrumentation
from .anthropic import AnthropicInstrumentation
from .google import GoogleInstrumentation
from .microsoft import MicrosoftInstrumentation
from .aws import AWSInstrumentation
from .cohere import CohereInstrumentation

# Note: Main instrumentation functions are in the parent instrumentation module

# Provider registry
PROVIDER_INSTRUMENTATIONS = {
    "openai": OpenAIInstrumentation,
    "anthropic": AnthropicInstrumentation,
    "google": GoogleInstrumentation,
    "microsoft": MicrosoftInstrumentation,
    "aws": AWSInstrumentation,
    "cohere": CohereInstrumentation,
}

# Global instrumentation instances
_instrumentations = {}


def get_provider_instrumentation(provider_name: str, tracer, metrics, context):
    """Get or create a provider instrumentation instance.

    Args:
        provider_name: Name of the provider
        tracer: UntraceTracer instance
        metrics: UntraceMetrics instance
        context: UntraceContext instance

    Returns:
        Provider instrumentation instance or None if not supported
    """
    if provider_name not in PROVIDER_INSTRUMENTATIONS:
        return None

    if provider_name not in _instrumentations:
        instrumentation_class = PROVIDER_INSTRUMENTATIONS[provider_name]
        _instrumentations[provider_name] = instrumentation_class(tracer, metrics, context)

    return _instrumentations[provider_name]


def instrument_provider(provider_name: str, tracer, metrics, context):
    """Instrument a specific provider.

    Args:
        provider_name: Name of the provider
        tracer: UntraceTracer instance
        metrics: UntraceMetrics instance
        context: UntraceContext instance
    """
    instrumentation = get_provider_instrumentation(provider_name, tracer, metrics, context)
    if instrumentation:
        instrumentation.instrument()


def uninstrument_provider(provider_name: str):
    """Remove instrumentation for a specific provider.

    Args:
        provider_name: Name of the provider
    """
    if provider_name in _instrumentations:
        _instrumentations[provider_name].uninstrument()
        del _instrumentations[provider_name]


def instrument_all_providers(tracer, metrics, context, providers=None):
    """Instrument all supported providers.

    Args:
        tracer: UntraceTracer instance
        metrics: UntraceMetrics instance
        context: UntraceContext instance
        providers: List of provider names to instrument (default: all)
    """
    if providers is None:
        providers = list(PROVIDER_INSTRUMENTATIONS.keys())

    for provider_name in providers:
        try:
            instrument_provider(provider_name, tracer, metrics, context)
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Failed to instrument {provider_name}: {e}")


def uninstrument_all_providers():
    """Remove instrumentation for all providers."""
    for provider_name in list(_instrumentations.keys()):
        uninstrument_provider(provider_name)


def get_supported_providers():
    """Get list of supported providers.

    Returns:
        List of supported provider names
    """
    return list(PROVIDER_INSTRUMENTATIONS.keys())


__all__ = [
    "BaseProviderInstrumentation",
    "OpenAIInstrumentation",
    "AnthropicInstrumentation",
    "GoogleInstrumentation",
    "MicrosoftInstrumentation",
    "AWSInstrumentation",
    "CohereInstrumentation",
    "get_provider_instrumentation",
    "instrument_provider",
    "uninstrument_provider",
    "instrument_all_providers",
    "uninstrument_all_providers",
    "get_supported_providers",
    "PROVIDER_INSTRUMENTATIONS",
]
