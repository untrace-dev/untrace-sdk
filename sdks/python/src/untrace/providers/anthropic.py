"""Anthropic instrumentation implementation."""

import functools
import logging
from typing import Any, Callable, Dict

from .base import BaseProviderInstrumentation

logger = logging.getLogger(__name__)


class AnthropicInstrumentation(BaseProviderInstrumentation):
    """Anthropic SDK instrumentation."""

    def __init__(self, tracer, metrics, context):
        """Initialize Anthropic instrumentation."""
        super().__init__(tracer, metrics, context, "anthropic")
        self._original_constructors = {}

    def instrument(self) -> None:
        """Instrument Anthropic client methods."""
        if self._instrumented:
            return

        try:
            # Import Anthropic here to avoid import errors if not installed
            from anthropic import Anthropic, AsyncAnthropic
            
            # Store original constructors
            self._original_constructors['Anthropic'] = Anthropic.__init__
            self._original_constructors['AsyncAnthropic'] = AsyncAnthropic.__init__
            
            # Patch constructors to instrument instances
            Anthropic.__init__ = self._wrap_anthropic_constructor(Anthropic.__init__)
            AsyncAnthropic.__init__ = self._wrap_async_anthropic_constructor(AsyncAnthropic.__init__)
            
            self._mark_instrumented()
            
        except ImportError:
            logger.warning("[Untrace] Anthropic not installed, skipping instrumentation")

    def _wrap_anthropic_constructor(self, original_constructor):
        """Wrap Anthropic constructor to instrument the instance."""
        instrumentation = self
        
        @functools.wraps(original_constructor)
        def wrapper(self, *args, **kwargs):
            # Call original constructor
            original_constructor(self, *args, **kwargs)
            
            # Instrument the instance methods
            instrumentation._instrument_client_instance(self)
            
        return wrapper

    def _wrap_async_anthropic_constructor(self, original_constructor):
        """Wrap AsyncAnthropic constructor to instrument the instance."""
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
        # Instrument messages (chat completions)
        if hasattr(client_instance, 'messages'):
            self._patch_method(
                client_instance.messages,
                'create',
                self._wrap_message_create_sync
            )
        
        # Instrument completions
        if hasattr(client_instance, 'completions'):
            self._patch_method(
                client_instance.completions,
                'create',
                self._wrap_completion_create_sync
            )

    def _wrap_message_create_sync(self, original_method):
        """Wrap synchronous message create method."""
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
            span_name = f"anthropic.messages.create"
            
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
                if hasattr(response, 'content') and response.content:
                    content = response.content[0] if isinstance(response.content, list) else response.content
                    if hasattr(content, 'text'):
                        span.set_attribute("llm.response.content", content.text)
                
                # Set response attributes
                self._set_response_attributes(span, response)
                
                # Handle usage information
                self._handle_usage_metrics(span, response, model)
                
                return response
            
            return self._create_llm_span_sync(span_name, attributes, traced_call)
        
        return wrapper

    def _wrap_completion_create_sync(self, original_method):
        """Wrap synchronous completion create method."""
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
            span_name = f"anthropic.completions.create"
            
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
                if hasattr(response, 'completion'):
                    span.set_attribute("llm.response.text", response.completion)
                
                # Set response attributes
                self._set_response_attributes(span, response)
                
                # Handle usage information
                self._handle_usage_metrics(span, response, model)
                
                return response
            
            return self._create_llm_span_sync(span_name, attributes, traced_call)
        
        return wrapper

    def _set_response_attributes(self, span, response):
        """Set Anthropic-specific response attributes."""
        super()._set_response_attributes(span, response)
        
        # Anthropic-specific attributes
        if hasattr(response, 'id'):
            span.set_attribute("llm.response.id", response.id)
        if hasattr(response, 'type'):
            span.set_attribute("llm.response.type", response.type)
        if hasattr(response, 'role'):
            span.set_attribute("llm.response.role", response.role)
        if hasattr(response, 'stop_reason'):
            span.set_attribute("llm.response.stop_reason", response.stop_reason)

    def _handle_usage_metrics(self, span, response, model: str):
        """Handle Anthropic-specific usage metrics."""
        if hasattr(response, 'usage') and response.usage:
            usage = response.usage
            
            # Set span attributes
            if hasattr(usage, 'input_tokens'):
                span.set_attribute("llm.prompt.tokens", usage.input_tokens)
            if hasattr(usage, 'output_tokens'):
                span.set_attribute("llm.completion.tokens", usage.output_tokens)
            if hasattr(usage, 'total_tokens'):
                span.set_attribute("llm.total.tokens", usage.total_tokens)
            
            # Record metrics
            from ..types import TokenUsage
            token_usage = TokenUsage(
                model=model,
                provider=self.provider_name,
                prompt_tokens=getattr(usage, 'input_tokens', 0),
                completion_tokens=getattr(usage, 'output_tokens', 0),
                total_tokens=getattr(usage, 'total_tokens', 0)
            )
            self.metrics.record_token_usage(token_usage)

    def uninstrument(self) -> None:
        """Remove instrumentation."""
        if not self._instrumented:
            return

        # Restore original constructors
        try:
            from anthropic import Anthropic, AsyncAnthropic
            Anthropic.__init__ = self._original_constructors['Anthropic']
            AsyncAnthropic.__init__ = self._original_constructors['AsyncAnthropic']
        except ImportError:
            pass
        
        self._mark_uninstrumented()
