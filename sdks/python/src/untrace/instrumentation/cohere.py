"""Cohere instrumentation implementation."""

import functools
import logging
from typing import Any, Callable, Dict

from .base import BaseProviderInstrumentation

logger = logging.getLogger(__name__)


class CohereInstrumentation(BaseProviderInstrumentation):
    """Cohere SDK instrumentation."""

    def __init__(self, tracer: Any, metrics: Any, context: Any) -> None:
        """Initialize Cohere instrumentation."""
        super().__init__(tracer, metrics, context, "cohere")
        self._original_constructors: Dict[str, Any] = {}

    def instrument(self) -> None:
        """Instrument Cohere client methods."""
        if self._instrumented:
            return

        try:
            # Import Cohere here to avoid import errors if not installed
            from cohere import Client as CohereClient

            # Store original constructors
            self._original_constructors['CohereClient'] = CohereClient.__init__

            # Patch constructor to instrument instances
            CohereClient.__init__ = self._wrap_cohere_constructor(CohereClient.__init__)

            self._mark_instrumented()

        except ImportError:
            logger.warning("[Untrace] Cohere not installed, skipping instrumentation")

    def _wrap_cohere_constructor(self, original_constructor: Callable) -> Callable:
        """Wrap Cohere constructor to instrument the instance."""
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
        # Instrument generate
        if hasattr(client_instance, 'generate'):
            self._patch_method(
                client_instance,
                'generate',
                self._wrap_generate_sync
            )

        # Instrument chat
        if hasattr(client_instance, 'chat'):
            self._patch_method(
                client_instance,
                'chat',
                self._wrap_chat_sync
            )

        # Instrument embed
        if hasattr(client_instance, 'embed'):
            self._patch_method(
                client_instance,
                'embed',
                self._wrap_embed_sync
            )

    def _wrap_generate_sync(self, original_method: Callable) -> Callable:
        """Wrap synchronous generate method."""
        @functools.wraps(original_method)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            # Extract model and prompt from kwargs
            model = kwargs.get('model', 'command')
            prompt = kwargs.get('prompt', '')

            # Create LLM attributes
            attributes = self._create_llm_attributes(
                model=model,
                operation_type="completion",
                temperature=kwargs.get('temperature'),
                max_tokens=kwargs.get('max_tokens')
            )

            # Create span name
            span_name = f"cohere.generate"

            # Wrap the call with tracing
            def traced_call(span: Any) -> Any:
                # Set request attributes
                self._set_request_attributes(span, model, **kwargs)
                span.set_attribute("llm.request.prompt", prompt)

                span.add_event("llm.request.start")

                # Make the original API call
                response = original_method(*args, **kwargs)

                span.add_event("llm.response.received")

                # Extract response data
                if hasattr(response, 'generations') and response.generations:
                    generation = response.generations[0]
                    if hasattr(generation, 'text'):
                        span.set_attribute("llm.response.text", generation.text)

                # Set response attributes
                self._set_response_attributes(span, response)

                # Handle usage information
                self._handle_usage_metrics(span, response, model)

                return response

            return self._create_llm_span_sync(span_name, attributes, traced_call)

        return wrapper

    def _wrap_chat_sync(self, original_method: Callable) -> Callable:
        """Wrap synchronous chat method."""
        @functools.wraps(original_method)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            # Extract model and message from kwargs
            model = kwargs.get('model', 'command')
            message = kwargs.get('message', '')

            # Create LLM attributes
            attributes = self._create_llm_attributes(
                model=model,
                operation_type="chat",
                temperature=kwargs.get('temperature'),
                max_tokens=kwargs.get('max_tokens')
            )

            # Create span name
            span_name = f"cohere.chat"

            # Wrap the call with tracing
            def traced_call(span: Any) -> Any:
                # Set request attributes
                self._set_request_attributes(span, model, **kwargs)
                span.set_attribute("llm.request.message", message)

                span.add_event("llm.request.start")

                # Make the original API call
                response = original_method(*args, **kwargs)

                span.add_event("llm.response.received")

                # Extract response data
                if hasattr(response, 'text'):
                    span.set_attribute("llm.response.text", response.text)

                # Set response attributes
                self._set_response_attributes(span, response)

                # Handle usage information
                self._handle_usage_metrics(span, response, model)

                return response

            return self._create_llm_span_sync(span_name, attributes, traced_call)

        return wrapper

    def _wrap_embed_sync(self, original_method: Callable) -> Callable:
        """Wrap synchronous embed method."""
        @functools.wraps(original_method)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            # Extract model and texts from kwargs
            model = kwargs.get('model', 'embed-english-v2.0')
            texts = kwargs.get('texts', [])

            # Create LLM attributes
            attributes = self._create_llm_attributes(
                model=model,
                operation_type="embedding"
            )

            # Create span name
            span_name = f"cohere.embed"

            # Wrap the call with tracing
            def traced_call(span: Any) -> Any:
                # Set request attributes
                self._set_request_attributes(span, model, **kwargs)
                span.set_attribute("llm.request.texts_count", len(texts))
                span.set_attribute("llm.request.texts", str(texts))

                span.add_event("llm.request.start")

                # Make the original API call
                response = original_method(*args, **kwargs)

                span.add_event("llm.response.received")

                # Extract response data
                if hasattr(response, 'embeddings'):
                    span.set_attribute("llm.response.embeddings_count", len(response.embeddings))
                    if response.embeddings:
                        span.set_attribute("llm.response.embedding_dimension", len(response.embeddings[0]))

                # Set response attributes
                self._set_response_attributes(span, response)

                # Handle usage information
                self._handle_usage_metrics(span, response, model)

                return response

            return self._create_llm_span_sync(span_name, attributes, traced_call)

        return wrapper

    def _set_response_attributes(self, span: Any, response: Any) -> None:
        """Set Cohere-specific response attributes."""
        super()._set_response_attributes(span, response)

        # Cohere-specific attributes
        if hasattr(response, 'id'):
            span.set_attribute("llm.response.id", response.id)
        if hasattr(response, 'meta'):
            span.set_attribute("llm.response.meta", str(response.meta))

    def _handle_usage_metrics(self, span: Any, response: Any, model: str) -> None:
        """Handle Cohere-specific usage metrics."""
        if hasattr(response, 'meta') and hasattr(response.meta, 'billed_units'):
            billed_units = response.meta.billed_units

            # Set span attributes
            if hasattr(billed_units, 'input_tokens'):
                span.set_attribute("llm.prompt.tokens", billed_units.input_tokens)
            if hasattr(billed_units, 'output_tokens'):
                span.set_attribute("llm.completion.tokens", billed_units.output_tokens)
            if hasattr(billed_units, 'total_tokens'):
                span.set_attribute("llm.total.tokens", billed_units.total_tokens)

            # Record metrics
            from ..types import TokenUsage
            token_usage = TokenUsage(
                model=model,
                provider=self.provider_name,
                prompt_tokens=getattr(billed_units, 'input_tokens', 0),
                completion_tokens=getattr(billed_units, 'output_tokens', 0),
                total_tokens=getattr(billed_units, 'total_tokens', 0)
            )
            self.metrics.record_token_usage(token_usage)

    def uninstrument(self) -> None:
        """Remove instrumentation."""
        if not self._instrumented:
            return

        # Restore original constructors
        try:
            from cohere import Client as CohereClient
            CohereClient.__init__ = self._original_constructors['CohereClient']
        except ImportError:
            pass

        self._mark_uninstrumented()
