"""Untrace SDK for Python - LLM Observability and Tracing."""

__version__ = "0.1.0"
__author__ = "Untrace"
__email__ = "hello@untrace.dev"

# Legacy client (deprecated)
from .client import UntraceClient
from .exceptions import UntraceAPIError, UntraceError, UntraceValidationError

# New OpenTelemetry-based SDK
from .untrace import Untrace, init, get_untrace
from .tracer import UntraceTracer
from .context import UntraceContext
from .metrics import UntraceMetrics
from .instrumentation_main import (
    instrument_openai, uninstrument_openai,
    instrument_anthropic, uninstrument_anthropic,
    instrument_google, uninstrument_google,
    instrument_microsoft, uninstrument_microsoft,
    instrument_aws, uninstrument_aws,
    instrument_cohere, uninstrument_cohere,
    instrument_all, uninstrument_all,
    get_instrumented_providers, is_provider_instrumented,
    get_supported_providers
)
from .types import (
    UntraceConfig,
    LLMSpanAttributes,
    VectorDBAttributes,
    FrameworkAttributes,
    WorkflowAttributes,
    UntraceSpanOptions,
    TokenUsage,
    Cost,
)
from .attributes import (
    LLM_ATTRIBUTES,
    VECTOR_DB_ATTRIBUTES,
    FRAMEWORK_ATTRIBUTES,
    WORKFLOW_ATTRIBUTES,
    create_llm_attributes,
    create_vector_db_attributes,
    create_framework_attributes,
    create_workflow_attributes,
    sanitize_attributes,
    merge_attributes,
)

__all__ = [
    # Legacy exports (deprecated)
    "UntraceClient",
    "UntraceError",
    "UntraceAPIError",
    "UntraceValidationError",

    # New OpenTelemetry-based exports
    "Untrace",
    "init",
    "get_untrace",
    "UntraceTracer",
    "UntraceContext",
    "UntraceMetrics",
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
    "UntraceConfig",
    "LLMSpanAttributes",
    "VectorDBAttributes",
    "FrameworkAttributes",
    "WorkflowAttributes",
    "UntraceSpanOptions",
    "TokenUsage",
    "Cost",
    "LLM_ATTRIBUTES",
    "VECTOR_DB_ATTRIBUTES",
    "FRAMEWORK_ATTRIBUTES",
    "WORKFLOW_ATTRIBUTES",
    "create_llm_attributes",
    "create_vector_db_attributes",
    "create_framework_attributes",
    "create_workflow_attributes",
    "sanitize_attributes",
    "merge_attributes",
]
