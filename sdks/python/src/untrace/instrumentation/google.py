"""Google/Gemini instrumentation implementation."""

import functools
import logging
from typing import Any, Callable, Dict

from .base import BaseProviderInstrumentation

logger = logging.getLogger(__name__)


class GoogleInstrumentation(BaseProviderInstrumentation):
    """Google/Gemini SDK instrumentation."""

    def __init__(self, tracer: Any, metrics: Any, context: Any) -> None:
        """Initialize Google instrumentation."""
        super().__init__(tracer, metrics, context, "google")
        self._original_constructors: Dict[str, Any] = {}

    def instrument(self) -> None:
        """Instrument Google client methods."""
        if self._instrumented:
            return

        try:
            # Import Google AI here to avoid import errors if not installed
            from google.generativeai import GenerativeModel
            from google.generativeai.types import HarmCategory, HarmBlockThreshold

            # Store original constructors
            self._original_constructors['GenerativeModel'] = GenerativeModel.__init__

            # Patch constructor to instrument instances
            GenerativeModel.__init__ = self._wrap_generative_model_constructor(GenerativeModel.__init__)

            self._mark_instrumented()

        except ImportError:
            logger.warning("[Untrace] Google Generative AI not installed, skipping instrumentation")

    def _wrap_generative_model_constructor(self, original_constructor: Callable) -> Callable:
        """Wrap GenerativeModel constructor to instrument the instance."""
        instrumentation = self

        @functools.wraps(original_constructor)
        def wrapper(self: Any, *args: Any, **kwargs: Any) -> None:
            # Call original constructor
            original_constructor(self, *args, **kwargs)

            # Instrument the instance methods
            instrumentation._instrument_client_instance(self)

        return wrapper

    def _instrument_client_instance(self, client_instance: Any) -> None:
        """Instrument a client instance."""
        # Instrument generate_content
        if hasattr(client_instance, 'generate_content'):
            self._patch_method(
                client_instance,
                'generate_content',
                self._wrap_generate_content_sync
            )

        # Instrument chat methods
        if hasattr(client_instance, 'start_chat'):
            self._patch_method(
                client_instance,
                'start_chat',
                self._wrap_start_chat_sync
            )

    def _wrap_generate_content_sync(self, original_method: Callable) -> Callable:
        """Wrap synchronous generate_content method."""
        @functools.wraps(original_method)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            # Extract model from the instance
            model = getattr(self, 'model_name', 'unknown')

            # Create LLM attributes
            attributes = self._create_llm_attributes(
                model=model,
                operation_type="completion",
                temperature=kwargs.get('generation_config', {}).get('temperature'),
                max_tokens=kwargs.get('generation_config', {}).get('max_output_tokens')
            )

            # Create span name
            span_name = f"google.generativeai.generate_content"

            # Wrap the call with tracing
            def traced_call(span: Any) -> Any:
                # Set request attributes
                self._set_request_attributes(span, model, **kwargs)

                # Extract prompt from args
                if args:
                    prompt = str(args[0])
                    span.set_attribute("llm.request.prompt", prompt)

                span.add_event("llm.request.start")

                # Make the original API call
                response = original_method(*args, **kwargs)

                span.add_event("llm.response.received")

                # Extract response data
                if hasattr(response, 'text'):
                    span.set_attribute("llm.response.text", response.text)
                if hasattr(response, 'candidates') and response.candidates:
                    candidate = response.candidates[0]
                    if hasattr(candidate, 'content') and hasattr(candidate.content, 'parts'):
                        if candidate.content.parts:
                            span.set_attribute("llm.response.content", candidate.content.parts[0].text)

                # Set response attributes
                self._set_response_attributes(span, response)

                # Handle usage information
                self._handle_usage_metrics(span, response, model)

                return response

            return self._create_llm_span_sync(span_name, attributes, traced_call)

        return wrapper

    def _wrap_start_chat_sync(self, original_method: Callable) -> Callable:
        """Wrap synchronous start_chat method."""
        @functools.wraps(original_method)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            # Extract model from the instance
            model = getattr(self, 'model_name', 'unknown')

            # Create LLM attributes
            attributes = self._create_llm_attributes(
                model=model,
                operation_type="chat"
            )

            # Create span name
            span_name = f"google.generativeai.start_chat"

            # Wrap the call with tracing
            def traced_call(span: Any) -> Any:
                # Set request attributes
                self._set_request_attributes(span, model, **kwargs)

                span.add_event("llm.request.start")

                # Make the original API call
                response = original_method(*args, **kwargs)

                span.add_event("llm.response.received")

                # Set response attributes
                self._set_response_attributes(span, response)

                return response

            return self._create_llm_span_sync(span_name, attributes, traced_call)

        return wrapper

    def _set_response_attributes(self, span: Any, response: Any) -> None:
        """Set Google-specific response attributes."""
        super()._set_response_attributes(span, response)

        # Google-specific attributes
        if hasattr(response, 'candidates') and response.candidates:
            span.set_attribute("llm.response.candidates_count", len(response.candidates))
            candidate = response.candidates[0]
            if hasattr(candidate, 'finish_reason'):
                span.set_attribute("llm.response.finish_reason", candidate.finish_reason)

        if hasattr(response, 'usage_metadata') and response.usage_metadata:
            usage = response.usage_metadata
            if hasattr(usage, 'prompt_token_count'):
                span.set_attribute("llm.prompt.tokens", usage.prompt_token_count)
            if hasattr(usage, 'candidates_token_count'):
                span.set_attribute("llm.completion.tokens", usage.candidates_token_count)
            if hasattr(usage, 'total_token_count'):
                span.set_attribute("llm.total.tokens", usage.total_token_count)

    def _handle_usage_metrics(self, span: Any, response: Any, model: str) -> None:
        """Handle Google-specific usage metrics."""
        if hasattr(response, 'usage_metadata') and response.usage_metadata:
            usage = response.usage_metadata

            # Set span attributes
            if hasattr(usage, 'prompt_token_count'):
                span.set_attribute("llm.prompt.tokens", usage.prompt_token_count)
            if hasattr(usage, 'candidates_token_count'):
                span.set_attribute("llm.completion.tokens", usage.candidates_token_count)
            if hasattr(usage, 'total_token_count'):
                span.set_attribute("llm.total.tokens", usage.total_token_count)

            # Record metrics
            from ..types import TokenUsage
            token_usage = TokenUsage(
                model=model,
                provider=self.provider_name,
                prompt_tokens=getattr(usage, 'prompt_token_count', 0),
                completion_tokens=getattr(usage, 'candidates_token_count', 0),
                total_tokens=getattr(usage, 'total_token_count', 0)
            )
            self.metrics.record_token_usage(token_usage)

    def uninstrument(self) -> None:
        """Remove instrumentation."""
        if not self._instrumented:
            return

        # Restore original constructors
        try:
            from google.generativeai import GenerativeModel
            GenerativeModel.__init__ = self._original_constructors['GenerativeModel']
        except ImportError:
            pass

        self._mark_uninstrumented()
