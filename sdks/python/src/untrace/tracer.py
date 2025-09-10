"""Tracer implementation for the Untrace SDK."""

from typing import Any, Callable, Dict, Optional, Union
from opentelemetry import context, trace
from opentelemetry.trace import Span, SpanKind, StatusCode, Tracer
from opentelemetry.context import Context

from .types import UntraceSpanOptions, LLMSpanAttributes


class UntraceTracer:
    """Wrapper around OpenTelemetry tracer with LLM-specific helpers."""

    def __init__(self, tracer: Tracer):
        """Initialize the Untrace tracer.

        Args:
            tracer: OpenTelemetry tracer instance
        """
        self._tracer = tracer

    def get_tracer(self) -> Tracer:
        """Get the underlying OpenTelemetry tracer.

        Returns:
            OpenTelemetry tracer instance
        """
        return self._tracer

    def start_span(self, options: UntraceSpanOptions) -> Span:
        """Start a new span.

        Args:
            options: Span options

        Returns:
            Started span
        """
        span_options = {
            "attributes": options.attributes,
            "kind": options.kind,
        }

        parent_context = options.parent
        if parent_context is None:
            parent_context = context.get_current()

        return self._tracer.start_span(
            options.name,
            context=parent_context,
            **span_options
        )

    def start_llm_span(
        self,
        name: str,
        attributes: Union[LLMSpanAttributes, Dict[str, Any]],
        parent: Optional[Span] = None,
    ) -> Span:
        """Start an LLM span.

        Args:
            name: Span name
            attributes: LLM attributes
            parent: Parent span

        Returns:
            Started LLM span
        """
        if isinstance(attributes, LLMSpanAttributes):
            attrs = attributes.to_dict()
        else:
            attrs = attributes

        return self.start_span(
            UntraceSpanOptions(
                name=name,
                attributes=attrs,
                kind=SpanKind.CLIENT,
                parent=parent,
            )
        )

    def start_workflow_span(
        self,
        name: str,
        attributes: Optional[Dict[str, Any]] = None,
        parent: Optional[Span] = None,
    ) -> Span:
        """Start a workflow span.

        Args:
            name: Span name
            attributes: Span attributes
            parent: Parent span

        Returns:
            Started workflow span
        """
        attrs = {"workflow.name": name}
        if attributes:
            attrs.update(attributes)

        return self.start_span(
            UntraceSpanOptions(
                name=name,
                attributes=attrs,
                kind=SpanKind.INTERNAL,
                parent=parent,
            )
        )

    def start_tool_span(
        self,
        name: str,
        attributes: Optional[Dict[str, Any]] = None,
        parent: Optional[Span] = None,
    ) -> Span:
        """Start a tool span.

        Args:
            name: Span name
            attributes: Span attributes
            parent: Parent span

        Returns:
            Started tool span
        """
        attrs = {"tool.name": name}
        if attributes:
            attrs.update(attributes)

        return self.start_span(
            UntraceSpanOptions(
                name=name,
                attributes=attrs,
                kind=SpanKind.INTERNAL,
                parent=parent,
            )
        )

    async def with_span(
        self,
        options: UntraceSpanOptions,
        fn: Callable[[Span], Any],
    ) -> Any:
        """Wrap a function with a span.

        Args:
            options: Span options
            fn: Function to wrap

        Returns:
            Function result
        """
        span = self.start_span(options)

        try:
            result = await fn(span)
            span.set_status(StatusCode.OK)
            return result
        except Exception as error:
            span.record_exception(error)
            span.set_status(
                StatusCode.ERROR,
                description=str(error) if error else "Unknown error"
            )
            raise
        finally:
            span.end()

    async def with_llm_span(
        self,
        name: str,
        attributes: Union[LLMSpanAttributes, Dict[str, Any]],
        fn: Callable[[Span], Any],
    ) -> Any:
        """Wrap an LLM call with a span.

        Args:
            name: Span name
            attributes: LLM attributes
            fn: Function to wrap

        Returns:
            Function result
        """
        if isinstance(attributes, LLMSpanAttributes):
            attrs = attributes.to_dict()
        else:
            attrs = attributes

        return await self.with_span(
            UntraceSpanOptions(
                name=name,
                attributes=attrs,
                kind=SpanKind.CLIENT,
            ),
            fn,
        )

    def get_active_span(self) -> Optional[Span]:
        """Get the active span.

        Returns:
            Active span or None
        """
        return trace.get_current_span()

    def add_event(self, name: str, attributes: Optional[Dict[str, Any]] = None) -> None:
        """Add event to the active span.

        Args:
            name: Event name
            attributes: Event attributes
        """
        span = self.get_active_span()
        if span:
            span.add_event(name, attributes or {})

    def set_attributes(self, attributes: Dict[str, Any]) -> None:
        """Set attributes on the active span.

        Args:
            attributes: Attributes to set
        """
        span = self.get_active_span()
        if span:
            span.set_attributes(attributes)

    def set_status(self, code: StatusCode, message: Optional[str] = None) -> None:
        """Set status on the active span.

        Args:
            code: Status code
            message: Status message
        """
        span = self.get_active_span()
        if span:
            span.set_status(code, description=message)

    def record_exception(
        self,
        error: Exception,
        attributes: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Record an exception on the active span.

        Args:
            error: Exception to record
            attributes: Additional attributes
        """
        span = self.get_active_span()
        if span:
            if attributes:
                span.set_attributes(attributes)
            span.record_exception(error)
