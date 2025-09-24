"""Attribute constants and utilities for the Untrace SDK."""

from typing import Any, Dict, Optional, Union
from .types import LLMSpanAttributes, VectorDBAttributes, FrameworkAttributes, WorkflowAttributes


# LLM attribute keys following OpenTelemetry semantic conventions
class LLM_ATTRIBUTES:
    """LLM attribute constants."""

    COMPLETION_TOKENS = "llm.completion.tokens"
    COST_COMPLETION = "llm.cost.completion"
    COST_PROMPT = "llm.cost.prompt"
    COST_TOTAL = "llm.cost.total"
    DURATION = "llm.duration_ms"
    ERROR = "llm.error"
    ERROR_TYPE = "llm.error.type"
    MAX_TOKENS = "llm.max_tokens"
    MODEL = "llm.model"
    OPERATION_TYPE = "llm.operation.type"
    PROMPT_TOKENS = "llm.prompt.tokens"
    PROVIDER = "llm.provider"
    REQUEST_ID = "llm.request.id"
    STREAM = "llm.stream"
    TEMPERATURE = "llm.temperature"
    TOOL_CALLS = "llm.tool_calls"
    TOOLS = "llm.tools"
    TOP_P = "llm.top_p"
    TOTAL_TOKENS = "llm.total.tokens"
    USAGE_INPUT_TOKENS = "llm.usage.input_tokens"
    USAGE_OUTPUT_TOKENS = "llm.usage.output_tokens"
    USAGE_REASON = "llm.usage.reason"
    USAGE_TOTAL_TOKENS = "llm.usage.total_tokens"


# Attribute aliases for common use
ATTR_LLM_PROVIDER = LLM_ATTRIBUTES.PROVIDER
ATTR_LLM_MODEL = LLM_ATTRIBUTES.MODEL


# Vector DB attribute keys
class VECTOR_DB_ATTRIBUTES:
    """Vector DB attribute constants."""

    COLLECTION = "db.collection"
    COUNT = "vector.count"
    DIMENSION = "vector.dimension"
    NAME = "db.name"
    NAMESPACE = "db.namespace"
    OPERATION = "db.operation"
    QUERY_FILTER = "vector.query.filter"
    QUERY_K = "vector.query.k"
    QUERY_METRIC = "vector.query.metric"
    SYSTEM = "db.system"


# Framework attribute keys
class FRAMEWORK_ATTRIBUTES:
    """Framework attribute constants."""

    AGENT_NAME = "framework.agent.name"
    AGENT_TYPE = "framework.agent.type"
    CHAIN_NAME = "framework.chain.name"
    CHAIN_TYPE = "framework.chain.type"
    NAME = "framework.name"
    OPERATION = "framework.operation"
    TOOL_NAME = "framework.tool.name"
    TOOL_TYPE = "framework.tool.type"
    VERSION = "framework.version"


# Workflow attribute keys
class WORKFLOW_ATTRIBUTES:
    """Workflow attribute constants."""

    METADATA = "workflow.metadata"
    NAME = "workflow.name"
    PARENT_ID = "workflow.parent_id"
    RUN_ID = "workflow.run_id"
    SESSION_ID = "workflow.session_id"
    USER_ID = "workflow.user_id"
    VERSION = "workflow.version"


def create_llm_attributes(
    provider: str,
    model: str,
    operation_type: str,
    **additional_attributes: Any,
) -> LLMSpanAttributes:
    """Create LLM span attributes.

    Args:
        provider: LLM provider name
        model: Model name
        operation_type: Type of LLM operation
        **additional_attributes: Additional attributes to include

    Returns:
        LLMSpanAttributes object
    """
    return LLMSpanAttributes(
        provider=provider,
        model=model,
        operation_type=operation_type,
        **additional_attributes
    )


def create_vector_db_attributes(
    system: str,
    operation: str,
    additional_attributes: Optional[Dict[str, Any]] = None,
) -> VectorDBAttributes:
    """Create vector DB attributes.

    Args:
        system: Database system name
        operation: Database operation
        additional_attributes: Additional attributes to include

    Returns:
        VectorDBAttributes object
    """
    return VectorDBAttributes(
        system=system,
        operation=operation,
        **(additional_attributes or {})
    )


def create_framework_attributes(
    name: str,
    operation: str,
    additional_attributes: Optional[Dict[str, Any]] = None,
) -> FrameworkAttributes:
    """Create framework attributes.

    Args:
        name: Framework name
        operation: Framework operation
        additional_attributes: Additional attributes to include

    Returns:
        FrameworkAttributes object
    """
    return FrameworkAttributes(
        name=name,
        operation=operation,
        **(additional_attributes or {})
    )


def create_workflow_attributes(
    name: str,
    run_id: str,
    additional_attributes: Optional[Dict[str, Any]] = None,
) -> WorkflowAttributes:
    """Create workflow attributes.

    Args:
        name: Workflow name
        run_id: Workflow run ID
        additional_attributes: Additional attributes to include

    Returns:
        WorkflowAttributes object
    """
    return WorkflowAttributes(
        name=name,
        run_id=run_id,
        **(additional_attributes or {})
    )


def sanitize_attributes(attributes: Dict[str, Any]) -> Dict[str, Union[str, int, float, bool]]:
    """Sanitize attributes by removing undefined values and converting to appropriate types.

    Args:
        attributes: Raw attributes dictionary

    Returns:
        Sanitized attributes dictionary
    """
    sanitized = {}

    for key, value in attributes.items():
        if value is not None:
            if isinstance(value, (str, int, float, bool)):
                sanitized[key] = value
            elif isinstance(value, (list, dict)):
                sanitized[key] = str(value)  # Convert complex types to string
            else:
                sanitized[key] = str(value)

    return sanitized


def merge_attributes(*attribute_sets: Dict[str, Any]) -> Dict[str, Any]:
    """Merge multiple attribute objects.

    Args:
        *attribute_sets: Variable number of attribute dictionaries

    Returns:
        Merged attributes dictionary
    """
    merged = {}
    for attributes in attribute_sets:
        merged.update(attributes)
    return merged
