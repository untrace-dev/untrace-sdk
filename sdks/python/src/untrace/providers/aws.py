"""AWS Bedrock instrumentation implementation."""

import functools
import logging
from typing import Any, Callable, Dict, Optional, TYPE_CHECKING

from .base import BaseProviderInstrumentation

if TYPE_CHECKING:
    from opentelemetry.trace import Span

logger = logging.getLogger(__name__)


class AWSInstrumentation(BaseProviderInstrumentation):
    """AWS Bedrock SDK instrumentation."""

    def __init__(self, tracer: Any, metrics: Any, context: Any) -> None:
        """Initialize AWS instrumentation."""
        super().__init__(tracer, metrics, context, "aws")
        self._original_constructors: Dict[str, Any] = {}

    def instrument(self) -> None:
        """Instrument AWS Bedrock client methods."""
        if self._instrumented:
            return

        try:
            # Import boto3 here to avoid import errors if not installed
            import boto3
            from botocore.client import BaseClient
            
            # Store original constructors
            self._original_constructors['boto3_client'] = boto3.client
            
            # Patch boto3.client to instrument Bedrock clients
            boto3.client = self._wrap_boto3_client(boto3.client)
            
            self._mark_instrumented()
            
        except ImportError:
            logger.warning("[Untrace] boto3 not installed, skipping AWS instrumentation")

    def _wrap_boto3_client(self, original_client):
        """Wrap boto3.client to instrument Bedrock clients."""
        instrumentation = self
        
        @functools.wraps(original_client)
        def wrapper(service_name, *args, **kwargs):
            # Create the client
            client = original_client(service_name, *args, **kwargs)
            
            # Only instrument Bedrock clients
            if service_name == 'bedrock-runtime':
                instrumentation._instrument_bedrock_client(client)
            
            return client
            
        return wrapper

    def _instrument_bedrock_client(self, client):
        """Instrument a Bedrock client instance."""
        # Instrument invoke_model
        if hasattr(client, 'invoke_model'):
            self._patch_method(
                client,
                'invoke_model',
                self._wrap_invoke_model_sync
            )
        
        # Instrument invoke_model_with_response_stream
        if hasattr(client, 'invoke_model_with_response_stream'):
            self._patch_method(
                client,
                'invoke_model_with_response_stream',
                self._wrap_invoke_model_stream_sync
            )

    def _wrap_invoke_model_sync(self, original_method: Callable[..., Any]) -> Callable[..., Any]:
        """Wrap synchronous invoke_model method."""
        @functools.wraps(original_method)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            # Extract model from kwargs
            model = kwargs.get('modelId', 'unknown')
            
            # Determine operation type based on model
            operation_type = self._get_operation_type_from_model(model)
            
            # Create LLM attributes
            attributes = self._create_llm_attributes(
                model=model,
                operation_type=operation_type
            )
            
            # Create span name
            span_name = f"aws.bedrock.invoke_model"
            
            # Wrap the call with tracing
            def traced_call(span: "Span") -> Any:
                # Set request attributes
                self._set_request_attributes(span, model, **kwargs)
                span.set_attribute("llm.request.model_id", model)
                
                # AWS-specific attributes
                if 'region' in kwargs:
                    span.set_attribute("llm.request.region", kwargs['region'])
                if 'accept' in kwargs:
                    span.set_attribute("llm.request.accept", kwargs['accept'])
                if 'contentType' in kwargs:
                    span.set_attribute("llm.request.content_type", kwargs['contentType'])
                
                span.add_event("llm.request.start")
                
                # Make the original API call
                response = original_method(*args, **kwargs)
                
                span.add_event("llm.response.received")
                
                # Extract response data
                if hasattr(response, 'body'):
                    span.set_attribute("llm.response.body_size", len(response['body'].read()))
                    response['body'].seek(0)  # Reset stream position
                
                # Set response attributes
                self._set_response_attributes(span, response)
                
                # Handle usage information
                self._handle_usage_metrics(span, response, model)
                
                return response
            
            return self._create_llm_span_sync(span_name, attributes, traced_call)
        
        return wrapper

    def _wrap_invoke_model_stream_sync(self, original_method: Callable[..., Any]) -> Callable[..., Any]:
        """Wrap synchronous invoke_model_with_response_stream method."""
        @functools.wraps(original_method)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            # Extract model from kwargs
            model = kwargs.get('modelId', 'unknown')
            
            # Determine operation type based on model
            operation_type = self._get_operation_type_from_model(model)
            
            # Create LLM attributes
            attributes = self._create_llm_attributes(
                model=model,
                operation_type=operation_type,
                stream=True
            )
            
            # Create span name
            span_name = f"aws.bedrock.invoke_model_stream"
            
            # Wrap the call with tracing
            def traced_call(span: "Span") -> Any:
                # Set request attributes
                self._set_request_attributes(span, model, **kwargs)
                span.set_attribute("llm.request.model_id", model)
                span.set_attribute("llm.request.stream", True)
                
                # AWS-specific attributes
                if 'region' in kwargs:
                    span.set_attribute("llm.request.region", kwargs['region'])
                if 'accept' in kwargs:
                    span.set_attribute("llm.request.accept", kwargs['accept'])
                if 'contentType' in kwargs:
                    span.set_attribute("llm.request.content_type", kwargs['contentType'])
                
                span.add_event("llm.request.start")
                
                # Make the original API call
                response = original_method(*args, **kwargs)
                
                span.add_event("llm.response.received")
                
                # Set response attributes
                self._set_response_attributes(span, response)
                
                return response
            
            return self._create_llm_span_sync(span_name, attributes, traced_call)
        
        return wrapper

    def _get_operation_type_from_model(self, model: str) -> str:
        """Determine operation type from model ID."""
        if 'claude' in model.lower():
            return 'chat'
        elif 'titan' in model.lower():
            return 'embedding'
        elif 'llama' in model.lower():
            return 'completion'
        else:
            return 'completion'

    def _set_response_attributes(self, span: "Span", response: Any) -> None:
        """Set AWS-specific response attributes."""
        super()._set_response_attributes(span, response)
        
        # AWS-specific attributes
        if hasattr(response, 'ResponseMetadata'):
            metadata = response['ResponseMetadata']
            if 'RequestId' in metadata:
                span.set_attribute("llm.response.request_id", metadata['RequestId'])
            if 'HTTPStatusCode' in metadata:
                span.set_attribute("llm.response.http_status", metadata['HTTPStatusCode'])

    def _handle_usage_metrics(self, span: "Span", response: Any, model: str) -> None:
        """Handle AWS-specific usage metrics."""
        # AWS Bedrock usage metrics are typically in the response body
        # This would need to be parsed from the actual response content
        # For now, we'll set basic attributes
        if hasattr(response, 'body'):
            span.set_attribute("llm.response.has_body", True)

    def uninstrument(self) -> None:
        """Remove instrumentation."""
        if not self._instrumented:
            return

        # Restore original constructors
        try:
            import boto3
            boto3.client = self._original_constructors['boto3_client']
        except ImportError:
            pass
        
        self._mark_uninstrumented()
