"""Base instrumentation class for LLM providers."""

import functools
import logging
from abc import ABC, abstractmethod
from typing import Any, Callable, Dict, List, Optional

from opentelemetry.trace import StatusCode

from ..attributes import create_llm_attributes
from ..types import TokenUsage, Cost

logger = logging.getLogger(__name__)


class BaseProviderInstrumentation(ABC):
    """Base class for provider instrumentation."""

    def __init__(self, tracer: Any, metrics: Any, context: Any, provider_name: str) -> None:
        """Initialize provider instrumentation.

        Args:
            tracer: UntraceTracer instance
            metrics: UntraceMetrics instance
            context: UntraceContext instance
            provider_name: Name of the provider (e.g., 'openai', 'anthropic')
        """
        self.tracer = tracer
        self.metrics = metrics
        self.context = context
        self.provider_name = provider_name
        self._original_methods: Dict[Any, Any] = {}
        self._instrumented = False

    @abstractmethod
    def instrument(self) -> None:
        """Instrument the provider's SDK."""
        pass

    @abstractmethod
    def uninstrument(self) -> None:
        """Remove instrumentation from the provider's SDK."""
        pass

    def _patch_method(self, obj: Any, method_name: str, wrapper_factory: Callable[..., Any]) -> None:
        """Patch a method with instrumentation wrapper.

        Args:
            obj: Object to patch
            method_name: Name of the method to patch
            wrapper_factory: Function that creates the wrapper
        """
        if hasattr(obj, method_name):
            original_method = getattr(obj, method_name)
            self._original_methods[f"{id(obj)}.{method_name}"] = original_method

            # Create wrapper using the factory function
            wrapper = wrapper_factory(original_method)
            setattr(obj, method_name, wrapper)

    def _create_llm_span_sync(self, span_name: str, attributes: Dict[str, Any], traced_call: Callable) -> Any:
        """Create a synchronous LLM span.

        Args:
            span_name: Name of the span
            attributes: LLM attributes
            traced_call: Function to execute within the span

        Returns:
            Result of the traced call
        """
        span = self.tracer.start_llm_span(span_name, attributes)
        try:
            result = traced_call(span)
            span.set_status(StatusCode.OK)
            return result
        except Exception as e:
            span.record_exception(e)
            span.set_status(StatusCode.ERROR, str(e))
            raise
        finally:
            span.end()

    def _create_llm_span_async(self, span_name: str, attributes: Dict[str, Any], traced_call: Callable) -> Any:
        """Create an asynchronous LLM span.

        Args:
            span_name: Name of the span
            attributes: LLM attributes
            traced_call: Async function to execute within the span

        Returns:
            Result of the traced call
        """
        return self.tracer.with_llm_span(span_name, attributes, traced_call)

    def _extract_model_from_kwargs(self, kwargs: Dict[str, Any], default: str = "unknown") -> str:
        """Extract model name from kwargs.

        Args:
            kwargs: Method keyword arguments
            default: Default model name if not found

        Returns:
            Model name
        """
        return kwargs.get('model', default)  # type: ignore

    def _extract_messages_from_kwargs(self, kwargs: Dict[str, Any]) -> List[Any]:
        """Extract messages from kwargs.

        Args:
            kwargs: Method keyword arguments

        Returns:
            List of messages
        """
        return kwargs.get('messages', [])  # type: ignore

    def _extract_prompt_from_kwargs(self, kwargs: Dict[str, Any]) -> str:
        """Extract prompt from kwargs.

        Args:
            kwargs: Method keyword arguments

        Returns:
            Prompt string
        """
        return kwargs.get('prompt', '')  # type: ignore

    def _extract_input_from_kwargs(self, kwargs: Dict[str, Any]) -> str:
        """Extract input from kwargs.

        Args:
            kwargs: Method keyword arguments

        Returns:
            Input string
        """
        return kwargs.get('input', '')  # type: ignore

    def _set_request_attributes(self, span: Any, model: str, **kwargs: Any) -> None:
        """Set common request attributes on span.

        Args:
            span: OpenTelemetry span
            model: Model name
            **kwargs: Additional request parameters
        """
        span.set_attribute("llm.request.model", model)

        # Set common attributes
        if 'temperature' in kwargs:
            span.set_attribute("llm.request.temperature", kwargs['temperature'])
        if 'max_tokens' in kwargs:
            span.set_attribute("llm.request.max_tokens", kwargs['max_tokens'])
        if 'stream' in kwargs:
            span.set_attribute("llm.request.stream", kwargs['stream'])

    def _set_response_attributes(self, span: Any, response: Any) -> None:
        """Set common response attributes on span.

        Args:
            span: OpenTelemetry span
            response: API response object
        """
        if hasattr(response, 'model'):
            span.set_attribute("llm.response.model", response.model)
        if hasattr(response, 'id'):
            span.set_attribute("llm.response.id", response.id)

    def _handle_usage_metrics(self, span: Any, response: Any, model: str) -> None:
        """Handle token usage and metrics recording.

        Args:
            span: OpenTelemetry span
            response: API response object
            model: Model name
        """
        if hasattr(response, 'usage') and response.usage:
            usage = response.usage

            # Set span attributes
            if hasattr(usage, 'prompt_tokens'):
                span.set_attribute("llm.prompt.tokens", usage.prompt_tokens)
            if hasattr(usage, 'completion_tokens'):
                span.set_attribute("llm.completion.tokens", usage.completion_tokens)
            if hasattr(usage, 'total_tokens'):
                span.set_attribute("llm.total.tokens", usage.total_tokens)

            # Record metrics
            token_usage = TokenUsage(
                model=model,
                provider=self.provider_name,
                prompt_tokens=getattr(usage, 'prompt_tokens', 0),
                completion_tokens=getattr(usage, 'completion_tokens', 0),
                total_tokens=getattr(usage, 'total_tokens', 0)
            )
            self.metrics.record_token_usage(token_usage)

    def _handle_error_metrics(self, error: Exception, operation: str) -> None:
        """Handle error metrics recording.

        Args:
            error: Exception that occurred
            operation: Operation that failed
        """
        self.metrics.record_error(error, {"operation": operation, "provider": self.provider_name})

    def _create_llm_attributes(self, model: str, operation_type: str, **kwargs: Any) -> Any:
        """Create LLM attributes for the provider.

        Args:
            model: Model name
            operation_type: Type of operation (chat, completion, embedding)
            **kwargs: Additional attributes

        Returns:
            LLM attributes dictionary
        """
        return create_llm_attributes(
            provider=self.provider_name,
            model=model,
            operation_type=operation_type,
            **kwargs
        )

    def _is_instrumented(self) -> bool:
        """Check if provider is currently instrumented.

        Returns:
            True if instrumented, False otherwise
        """
        return self._instrumented

    def _mark_instrumented(self) -> None:
        """Mark provider as instrumented."""
        self._instrumented = True
        logger.info(f"[Untrace] {self.provider_name.title()} instrumentation enabled")

    def _mark_uninstrumented(self) -> None:
        """Mark provider as uninstrumented."""
        self._instrumented = False
        logger.info(f"[Untrace] {self.provider_name.title()} instrumentation disabled")
