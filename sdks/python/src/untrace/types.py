"""Type definitions for the Untrace SDK."""

from typing import Any, Dict, List, Optional, Union
from opentelemetry.trace import Span, SpanKind, StatusCode
from opentelemetry.context import Context


class UntraceConfig:
    """Configuration options for initializing Untrace SDK."""

    def __init__(
        self,
        api_key: str,
        base_url: str = "https://untrace.dev",
        version: str = "0.1.0",
        resource_attributes: Optional[Dict[str, Any]] = None,
        debug: bool = False,
        disable_auto_instrumentation: bool = False,
        headers: Optional[Dict[str, str]] = None,
        sampling_rate: float = 1.0,
        max_batch_size: int = 512,
        export_interval_ms: int = 5000,
        capture_body: bool = True,
        capture_errors: bool = True,
        span_processors: Optional[List[Any]] = None,
        providers: Optional[List[str]] = None,
    ):
        """Initialize Untrace configuration.

        Args:
            api_key: API key for authentication
            base_url: Base URL for the Untrace ingestion endpoint
            version: Application version
            resource_attributes: Additional resource attributes
            debug: Whether to log debug information
            disable_auto_instrumentation: Whether to disable automatic instrumentation
            headers: Custom headers to include in requests
            sampling_rate: Sampling rate (0.0 to 1.0)
            max_batch_size: Maximum batch size for exporting spans
            export_interval_ms: Export interval in milliseconds
            capture_body: Whether to capture request/response bodies
            capture_errors: Whether to capture errors
            span_processors: Custom span processors
            providers: Providers to auto-instrument
        """
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.version = version
        self.resource_attributes = resource_attributes or {}
        self.debug = debug
        self.disable_auto_instrumentation = disable_auto_instrumentation
        self.headers = headers or {}
        self.sampling_rate = sampling_rate
        self.max_batch_size = max_batch_size
        self.export_interval_ms = export_interval_ms
        self.capture_body = capture_body
        self.capture_errors = capture_errors
        self.span_processors = span_processors or []
        self.providers = providers or ["all"]


class LLMSpanAttributes:
    """LLM specific span attributes."""

    def __init__(
        self,
        provider: str,
        model: str,
        operation_type: str,
        prompt_tokens: Optional[int] = None,
        completion_tokens: Optional[int] = None,
        total_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
        top_p: Optional[float] = None,
        max_tokens: Optional[int] = None,
        stream: Optional[bool] = None,
        tools: Optional[str] = None,
        tool_calls: Optional[str] = None,
        duration_ms: Optional[int] = None,
        cost_prompt: Optional[float] = None,
        cost_completion: Optional[float] = None,
        cost_total: Optional[float] = None,
        error: Optional[str] = None,
        error_type: Optional[str] = None,
        request_id: Optional[str] = None,
        usage_reason: Optional[str] = None,
        **kwargs: Any,
    ):
        """Initialize LLM span attributes.

        Args:
            provider: LLM provider name
            model: Model name
            operation_type: Type of LLM operation
            prompt_tokens: Number of prompt tokens
            completion_tokens: Number of completion tokens
            total_tokens: Total number of tokens
            temperature: Temperature setting
            top_p: Top-p setting
            max_tokens: Maximum tokens
            stream: Whether streaming was used
            tools: Tools used
            tool_calls: Tool calls made
            duration_ms: Duration in milliseconds
            cost_prompt: Cost for prompt
            cost_completion: Cost for completion
            cost_total: Total cost
            error: Error message
            error_type: Error type
            request_id: Request ID
            usage_reason: Usage reason
            **kwargs: Additional attributes
        """
        self.attributes = {
            "llm.provider": provider,
            "llm.model": model,
            "llm.operation.type": operation_type,
        }

        if prompt_tokens is not None:
            self.attributes["llm.prompt.tokens"] = prompt_tokens
        if completion_tokens is not None:
            self.attributes["llm.completion.tokens"] = completion_tokens
        if total_tokens is not None:
            self.attributes["llm.total.tokens"] = total_tokens
        if temperature is not None:
            self.attributes["llm.temperature"] = temperature
        if top_p is not None:
            self.attributes["llm.top_p"] = top_p
        if max_tokens is not None:
            self.attributes["llm.max_tokens"] = max_tokens
        if stream is not None:
            self.attributes["llm.stream"] = stream
        if tools is not None:
            self.attributes["llm.tools"] = tools
        if tool_calls is not None:
            self.attributes["llm.tool_calls"] = tool_calls
        if duration_ms is not None:
            self.attributes["llm.duration_ms"] = duration_ms
        if cost_prompt is not None:
            self.attributes["llm.cost.prompt"] = cost_prompt
        if cost_completion is not None:
            self.attributes["llm.cost.completion"] = cost_completion
        if cost_total is not None:
            self.attributes["llm.cost.total"] = cost_total
        if error is not None:
            self.attributes["llm.error"] = error
        if error_type is not None:
            self.attributes["llm.error.type"] = error_type
        if request_id is not None:
            self.attributes["llm.request.id"] = request_id
        if usage_reason is not None:
            self.attributes["llm.usage.reason"] = usage_reason

        # Add any additional attributes
        self.attributes.update(kwargs)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return self.attributes


class VectorDBAttributes:
    """Vector DB operation attributes."""

    def __init__(
        self,
        system: str,
        operation: str,
        name: Optional[str] = None,
        collection: Optional[str] = None,
        namespace: Optional[str] = None,
        dimension: Optional[int] = None,
        count: Optional[int] = None,
        query_k: Optional[int] = None,
        query_filter: Optional[str] = None,
        query_metric: Optional[str] = None,
        **kwargs: Any,
    ):
        """Initialize vector DB attributes.

        Args:
            system: Database system name
            operation: Database operation
            name: Database name
            collection: Collection name
            namespace: Namespace
            dimension: Vector dimension
            count: Vector count
            query_k: Query k parameter
            query_filter: Query filter
            query_metric: Query metric
            **kwargs: Additional attributes
        """
        self.attributes = {
            "db.system": system,
            "db.operation": operation,
        }

        if name is not None:
            self.attributes["db.name"] = name
        if collection is not None:
            self.attributes["db.collection"] = collection
        if namespace is not None:
            self.attributes["db.namespace"] = namespace
        if dimension is not None:
            self.attributes["vector.dimension"] = dimension
        if count is not None:
            self.attributes["vector.count"] = count
        if query_k is not None:
            self.attributes["vector.query.k"] = query_k
        if query_filter is not None:
            self.attributes["vector.query.filter"] = query_filter
        if query_metric is not None:
            self.attributes["vector.query.metric"] = query_metric

        # Add any additional attributes
        self.attributes.update(kwargs)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return self.attributes


class FrameworkAttributes:
    """Framework attributes (LangChain, LlamaIndex, etc.)."""

    def __init__(
        self,
        name: str,
        operation: str,
        version: Optional[str] = None,
        chain_name: Optional[str] = None,
        chain_type: Optional[str] = None,
        agent_name: Optional[str] = None,
        agent_type: Optional[str] = None,
        tool_name: Optional[str] = None,
        tool_type: Optional[str] = None,
        **kwargs: Any,
    ):
        """Initialize framework attributes.

        Args:
            name: Framework name
            operation: Framework operation
            version: Framework version
            chain_name: Chain name
            chain_type: Chain type
            agent_name: Agent name
            agent_type: Agent type
            tool_name: Tool name
            tool_type: Tool type
            **kwargs: Additional attributes
        """
        self.attributes = {
            "framework.name": name,
            "framework.operation": operation,
        }

        if version is not None:
            self.attributes["framework.version"] = version
        if chain_name is not None:
            self.attributes["framework.chain.name"] = chain_name
        if chain_type is not None:
            self.attributes["framework.chain.type"] = chain_type
        if agent_name is not None:
            self.attributes["framework.agent.name"] = agent_name
        if agent_type is not None:
            self.attributes["framework.agent.type"] = agent_type
        if tool_name is not None:
            self.attributes["framework.tool.name"] = tool_name
        if tool_type is not None:
            self.attributes["framework.tool.type"] = tool_type

        # Add any additional attributes
        self.attributes.update(kwargs)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return self.attributes


class WorkflowAttributes:
    """Workflow attributes."""

    def __init__(
        self,
        name: str,
        run_id: str,
        version: Optional[str] = None,
        parent_id: Optional[str] = None,
        user_id: Optional[str] = None,
        session_id: Optional[str] = None,
        metadata: Optional[str] = None,
        **kwargs: Any,
    ):
        """Initialize workflow attributes.

        Args:
            name: Workflow name
            run_id: Workflow run ID
            version: Workflow version
            parent_id: Parent workflow ID
            user_id: User ID
            session_id: Session ID
            metadata: Workflow metadata
            **kwargs: Additional attributes
        """
        self.attributes = {
            "workflow.name": name,
            "workflow.run_id": run_id,
        }

        if version is not None:
            self.attributes["workflow.version"] = version
        if parent_id is not None:
            self.attributes["workflow.parent_id"] = parent_id
        if user_id is not None:
            self.attributes["workflow.user_id"] = user_id
        if session_id is not None:
            self.attributes["workflow.session_id"] = session_id
        if metadata is not None:
            self.attributes["workflow.metadata"] = metadata

        # Add any additional attributes
        self.attributes.update(kwargs)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return self.attributes


class UntraceSpanOptions:
    """Span options for manual instrumentation."""

    def __init__(
        self,
        name: str,
        kind: Optional[SpanKind] = None,
        attributes: Optional[Dict[str, Any]] = None,
        parent: Optional[Union[Context, Span]] = None,
    ):
        """Initialize span options.

        Args:
            name: Span name
            kind: Span kind
            attributes: Span attributes
            parent: Parent context or span
        """
        self.name = name
        self.kind = kind or SpanKind.INTERNAL
        self.attributes = attributes or {}
        self.parent = parent


class TokenUsage:
    """Token usage information."""

    def __init__(
        self,
        model: str,
        provider: str,
        prompt_tokens: Optional[int] = None,
        completion_tokens: Optional[int] = None,
        total_tokens: Optional[int] = None,
    ):
        """Initialize token usage.

        Args:
            model: Model name
            provider: Provider name
            prompt_tokens: Number of prompt tokens
            completion_tokens: Number of completion tokens
            total_tokens: Total number of tokens
        """
        self.model = model
        self.provider = provider
        self.prompt_tokens = prompt_tokens
        self.completion_tokens = completion_tokens
        self.total_tokens = total_tokens


class Cost:
    """Cost information."""

    def __init__(
        self,
        model: str,
        provider: str,
        total: float,
        prompt: Optional[float] = None,
        completion: Optional[float] = None,
        currency: str = "USD",
    ):
        """Initialize cost information.

        Args:
            model: Model name
            provider: Provider name
            total: Total cost
            prompt: Prompt cost
            completion: Completion cost
            currency: Currency code
        """
        self.model = model
        self.provider = provider
        self.total = total
        self.prompt = prompt
        self.completion = completion
        self.currency = currency


# LLM Operation Types
LLMOperationType = Union[
    "completion",
    "chat",
    "embedding",
    "fine_tune",
    "image_generation",
    "audio_transcription",
    "audio_generation",
    "moderation",
    "tool_use",
]
