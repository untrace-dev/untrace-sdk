"""OpenAI instrumentation implementation."""

import functools
import logging
from typing import Any, Callable, Dict

from .base import BaseProviderInstrumentation

logger = logging.getLogger(__name__)


class OpenAIInstrumentation(BaseProviderInstrumentation):
    """OpenAI SDK instrumentation."""

    def __init__(self, tracer, metrics, context):
        """Initialize OpenAI instrumentation."""
        super().__init__(tracer, metrics, context, "openai")
        self._original_constructors = {}

    def instrument(self) -> None:
        """Instrument OpenAI client methods."""
        if self._instrumented:
            return

        try:
            # Import OpenAI here to avoid import errors if not installed
            from openai import OpenAI, AsyncOpenAI

            # Store original constructors
            self._original_constructors['OpenAI'] = OpenAI.__init__
            self._original_constructors['AsyncOpenAI'] = AsyncOpenAI.__init__

            # Patch constructors to instrument instances
            OpenAI.__init__ = self._wrap_openai_constructor(OpenAI.__init__)
            AsyncOpenAI.__init__ = self._wrap_async_openai_constructor(AsyncOpenAI.__init__)

            self._mark_instrumented()

        except ImportError:
            logger.warning("[Untrace] OpenAI not installed, skipping instrumentation")

    def _wrap_openai_constructor(self, original_constructor):
        """Wrap OpenAI constructor to instrument the instance."""
        instrumentation = self

        @functools.wraps(original_constructor)
        def wrapper(self, *args, **kwargs):
            # Call original constructor
            original_constructor(self, *args, **kwargs)

            # Instrument the instance methods
            instrumentation._instrument_client_instance(self)

        return wrapper

    def _wrap_async_openai_constructor(self, original_constructor):
        """Wrap AsyncOpenAI constructor to instrument the instance."""
        instrumentation = self

        @functools.wraps(original_constructor)
        def wrapper(self, *args, **kwargs):
            # Call original constructor
            original_constructor(self, *args, **kwargs)

            # Instrument the instance methods
            instrumentation._instrument_client_instance(self)

        return wrapper

    def _instrument_client_instance(self, client_instance):
        """Instrument a client instance."""
        # Instrument chat completions
        if hasattr(client_instance, 'chat') and hasattr(client_instance.chat, 'completions'):
            self._patch_method(
                client_instance.chat.completions,
                'create',
                self._wrap_chat_completion_sync
            )

        # Instrument completions
        if hasattr(client_instance, 'completions'):
            self._patch_method(
                client_instance.completions,
                'create',
                self._wrap_completion_sync
            )

        # Instrument embeddings
        if hasattr(client_instance, 'embeddings'):
            self._patch_method(
                client_instance.embeddings,
                'create',
                self._wrap_embedding_sync
            )

    def _wrap_chat_completion_sync(self, original_method):
        """Wrap synchronous chat completion method."""
        @functools.wraps(original_method)
        def wrapper(*args, **kwargs):
            # Extract model and messages from kwargs
            model = self._extract_model_from_kwargs(kwargs)
            messages = self._extract_messages_from_kwargs(kwargs)

            # Create LLM attributes
            attributes = self._create_llm_attributes(
                model=model,
                operation_type="chat",
                temperature=kwargs.get('temperature'),
                max_tokens=kwargs.get('max_tokens'),
                stream=kwargs.get('stream', False)
            )

            # Create span name
            span_name = f"openai.chat.completions.create"

            # Wrap the call with tracing
            def traced_call(span):
                # Set request attributes
                self._set_request_attributes(span, model, **kwargs)
                span.set_attribute("llm.request.messages", str(messages))

                span.add_event("llm.request.start")

                # Make the original API call
                response = original_method(*args, **kwargs)

                span.add_event("llm.response.received")

                # Extract response data
                if hasattr(response, 'choices') and response.choices:
                    choice = response.choices[0]
                    if hasattr(choice, 'message'):
                        span.set_attribute("llm.response.content", choice.message.content)
                    elif hasattr(choice, 'text'):
                        span.set_attribute("llm.response.content", choice.text)

                # Set response attributes
                self._set_response_attributes(span, response)

                # Handle usage information
                self._handle_usage_metrics(span, response, model)

                return response

            return self._create_llm_span_sync(span_name, attributes, traced_call)

        return wrapper

    def _wrap_completion_sync(self, original_method):
        """Wrap synchronous completion method."""
        @functools.wraps(original_method)
        def wrapper(*args, **kwargs):
            # Extract model and prompt from kwargs
            model = self._extract_model_from_kwargs(kwargs)
            prompt = self._extract_prompt_from_kwargs(kwargs)

            # Create LLM attributes
            attributes = self._create_llm_attributes(
                model=model,
                operation_type="completion",
                temperature=kwargs.get('temperature'),
                max_tokens=kwargs.get('max_tokens')
            )

            # Create span name
            span_name = f"openai.completions.create"

            # Wrap the call with tracing
            def traced_call(span):
                # Set request attributes
                self._set_request_attributes(span, model, **kwargs)
                span.set_attribute("llm.request.prompt", prompt)

                span.add_event("llm.request.start")

                # Make the original API call
                response = original_method(*args, **kwargs)

                span.add_event("llm.response.received")

                # Extract response data
                if hasattr(response, 'choices') and response.choices:
                    choice = response.choices[0]
                    if hasattr(choice, 'text'):
                        span.set_attribute("llm.response.text", choice.text)

                # Set response attributes
                self._set_response_attributes(span, response)

                # Handle usage information
                self._handle_usage_metrics(span, response, model)

                return response

            return self._create_llm_span_sync(span_name, attributes, traced_call)

        return wrapper

    def _wrap_embedding_sync(self, original_method):
        """Wrap synchronous embedding method."""
        @functools.wraps(original_method)
        def wrapper(*args, **kwargs):
            # Extract model and input from kwargs
            model = self._extract_model_from_kwargs(kwargs)
            input_text = self._extract_input_from_kwargs(kwargs)

            # Create LLM attributes
            attributes = self._create_llm_attributes(
                model=model,
                operation_type="embedding"
            )

            # Create span name
            span_name = f"openai.embeddings.create"

            # Wrap the call with tracing
            def traced_call(span):
                # Set request attributes
                self._set_request_attributes(span, model, **kwargs)
                span.set_attribute("llm.request.input", str(input_text))

                span.add_event("llm.request.start")

                # Make the original API call
                response = original_method(*args, **kwargs)

                span.add_event("llm.response.received")

                # Extract response data
                if hasattr(response, 'data') and response.data:
                    embedding = response.data[0]
                    span.set_attribute("llm.response.embeddings_count", len(response.data))
                    span.set_attribute("llm.response.embedding_dimension", len(embedding.embedding))

                # Set response attributes
                self._set_response_attributes(span, response)

                # Handle usage information
                self._handle_usage_metrics(span, response, model)

                return response

            return self._create_llm_span_sync(span_name, attributes, traced_call)

        return wrapper

    def uninstrument(self) -> None:
        """Remove instrumentation."""
        if not self._instrumented:
            return

        # Restore original constructors
        try:
            from openai import OpenAI, AsyncOpenAI
            OpenAI.__init__ = self._original_constructors['OpenAI']
            AsyncOpenAI.__init__ = self._original_constructors['AsyncOpenAI']
        except ImportError:
            pass

        self._mark_uninstrumented()
