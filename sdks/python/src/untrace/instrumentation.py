"""Main instrumentation module for backward compatibility."""

import logging
from typing import Optional

from .providers import (
    instrument_provider,
    uninstrument_provider,
    instrument_all_providers,
    uninstrument_all_providers,
    get_supported_providers,
)

logger = logging.getLogger(__name__)

# Global instrumentation state
_instrumented_providers = set()


def instrument_openai(tracer, metrics, context):
    """Instrument OpenAI SDK (backward compatibility)."""
    instrument_provider("openai", tracer, metrics, context)
    _instrumented_providers.add("openai")


def uninstrument_openai():
    """Remove OpenAI instrumentation (backward compatibility)."""
    uninstrument_provider("openai")
    _instrumented_providers.discard("openai")


def instrument_anthropic(tracer, metrics, context):
    """Instrument Anthropic SDK."""
    instrument_provider("anthropic", tracer, metrics, context)
    _instrumented_providers.add("anthropic")


def uninstrument_anthropic():
    """Remove Anthropic instrumentation."""
    uninstrument_provider("anthropic")
    _instrumented_providers.discard("anthropic")


def instrument_google(tracer, metrics, context):
    """Instrument Google/Gemini SDK."""
    instrument_provider("google", tracer, metrics, context)
    _instrumented_providers.add("google")


def uninstrument_google():
    """Remove Google/Gemini instrumentation."""
    uninstrument_provider("google")
    _instrumented_providers.discard("google")


def instrument_microsoft(tracer, metrics, context):
    """Instrument Microsoft Azure OpenAI SDK."""
    instrument_provider("microsoft", tracer, metrics, context)
    _instrumented_providers.add("microsoft")


def uninstrument_microsoft():
    """Remove Microsoft Azure OpenAI instrumentation."""
    uninstrument_provider("microsoft")
    _instrumented_providers.discard("microsoft")


def instrument_aws(tracer, metrics, context):
    """Instrument AWS Bedrock SDK."""
    instrument_provider("aws", tracer, metrics, context)
    _instrumented_providers.add("aws")


def uninstrument_aws():
    """Remove AWS Bedrock instrumentation."""
    uninstrument_provider("aws")
    _instrumented_providers.discard("aws")


def instrument_cohere(tracer, metrics, context):
    """Instrument Cohere SDK."""
    instrument_provider("cohere", tracer, metrics, context)
    _instrumented_providers.add("cohere")


def uninstrument_cohere():
    """Remove Cohere instrumentation."""
    uninstrument_provider("cohere")
    _instrumented_providers.discard("cohere")


def instrument_all(tracer, metrics, context, providers=None):
    """Instrument all supported providers.

    Args:
        tracer: UntraceTracer instance
        metrics: UntraceMetrics instance
        context: UntraceContext instance
        providers: List of provider names to instrument (default: all)
    """
    instrument_all_providers(tracer, metrics, context, providers)
    if providers is None:
        providers = get_supported_providers()
    _instrumented_providers.update(providers)


def uninstrument_all():
    """Remove instrumentation for all providers."""
    uninstrument_all_providers()
    _instrumented_providers.clear()


def get_instrumented_providers():
    """Get list of currently instrumented providers.

    Returns:
        Set of instrumented provider names
    """
    return _instrumented_providers.copy()


def is_provider_instrumented(provider_name: str) -> bool:
    """Check if a provider is currently instrumented.

    Args:
        provider_name: Name of the provider

    Returns:
        True if instrumented, False otherwise
    """
    return provider_name in _instrumented_providers


# Backward compatibility exports
__all__ = [
    "instrument_openai",
    "uninstrument_openai",
    "instrument_anthropic",
    "uninstrument_anthropic",
    "instrument_google",
    "uninstrument_google",
    "instrument_microsoft",
    "uninstrument_microsoft",
    "instrument_aws",
    "uninstrument_aws",
    "instrument_cohere",
    "uninstrument_cohere",
    "instrument_all",
    "uninstrument_all",
    "get_instrumented_providers",
    "is_provider_instrumented",
    "get_supported_providers",
]