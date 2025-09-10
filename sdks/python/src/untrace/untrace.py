"""Main Untrace SDK implementation."""

import logging
from typing import Any, Dict, List, Optional
from opentelemetry import trace
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
try:
    from opentelemetry.semantic_conventions.resource import ResourceAttributes
except ImportError:
    # Fallback for older versions
    class ResourceAttributes:
        SERVICE_NAME = "service.name"
        SERVICE_VERSION = "service.version"

from .context import UntraceContext
from .exporter import UntraceExporter
from .metrics import UntraceMetrics
from .tracer import UntraceTracer
from .types import UntraceConfig
from .instrumentation import instrument_all, get_supported_providers


logger = logging.getLogger(__name__)

# Global state management
_global_state = {
    "instance": None,
    "is_initialized": False,
}


class Untrace:
    """Main Untrace SDK class."""

    def __init__(self, config: UntraceConfig):
        """Initialize the Untrace SDK.

        Args:
            config: Untrace configuration
        """
        self.config = config

        # Set up logging if debug is enabled
        if config.debug:
            logging.basicConfig(level=logging.DEBUG)
            logger.info("[Untrace] Initializing SDK with debug enabled")

        # Create resource with service information
        resource_attributes = {
            ResourceAttributes.SERVICE_NAME: "untrace-app",
            ResourceAttributes.SERVICE_VERSION: config.version,
            **config.resource_attributes,
        }

        resource = Resource.create(resource_attributes)

        # Create exporter
        exporter = UntraceExporter(config)

        # Create batch span processor
        batch_span_processor = BatchSpanProcessor(
            exporter,
            max_export_batch_size=config.max_batch_size,
            max_queue_size=max(config.max_batch_size * 2, 10),
            export_timeout_millis=config.export_interval_ms,
        )

        # Create tracer provider
        self._provider = TracerProvider(
            resource=resource,
            active_span_processor=batch_span_processor,
        )

        # Register provider
        trace.set_tracer_provider(self._provider)

        # Initialize components
        self._tracer = UntraceTracer(
            self._provider.get_tracer("untrace-app", config.version)
        )
        self._metrics = UntraceMetrics()
        self._context = UntraceContext()

        # Auto-instrument if not disabled
        if not config.disable_auto_instrumentation:
            self._auto_instrument()

        # Store instance
        _global_state["instance"] = self

        if config.debug:
            logger.info("[Untrace] SDK initialized successfully")

    def _auto_instrument(self) -> None:
        """Auto-instrument supported providers."""
        providers = self.config.providers

        # Get all supported providers
        supported_providers = get_supported_providers()

        # Default providers if not specified
        default_providers = ["openai", "anthropic", "google", "microsoft", "aws", "cohere"]

        providers_to_instrument = (
            supported_providers if "all" in providers
            else [p for p in providers if p in supported_providers]
        )

        if self.config.debug:
            logger.info(f"[Untrace] Auto-instrumenting providers: {providers_to_instrument}")

        # Instrument all providers at once
        try:
            instrument_all(self._tracer, self._metrics, self._context, providers_to_instrument)
        except Exception as error:
            if self.config.debug:
                logger.warning(f"[Untrace] Failed to instrument providers: {error}")

    def get_tracer(self) -> UntraceTracer:
        """Get the tracer instance.

        Returns:
            UntraceTracer instance
        """
        return self._tracer

    def get_metrics(self) -> UntraceMetrics:
        """Get the metrics instance.

        Returns:
            UntraceMetrics instance
        """
        return self._metrics

    def get_context(self) -> UntraceContext:
        """Get the context instance.

        Returns:
            UntraceContext instance
        """
        return self._context

    def instrument(self, provider_name: str, module: Any) -> Any:
        """Manually instrument a provider.

        Args:
            provider_name: Name of the provider
            module: Module to instrument

        Returns:
            Instrumented module

        Raises:
            ValueError: If provider is not supported
        """
        if provider_name not in ["openai"]:
            raise ValueError(f"Unknown provider: {provider_name}")

        # TODO: Implement provider-specific instrumentation
        if self.config.debug:
            logger.info(f"[Untrace] Manually instrumenting {provider_name}")

        return module

    async def flush(self) -> None:
        """Flush all pending spans."""
        if self.config.debug:
            logger.info("[Untrace] Flushing spans...")

        self._provider.force_flush()

        if self.config.debug:
            logger.info("[Untrace] Flush completed")

    async def shutdown(self) -> None:
        """Shutdown the SDK."""
        if self.config.debug:
            logger.info("[Untrace] Shutting down SDK...")

        # Shutdown provider
        self._provider.shutdown()

        # Clear instance and reset singleton state
        if _global_state["instance"] == self:
            _global_state["instance"] = None
            _global_state["is_initialized"] = False

        if self.config.debug:
            logger.info("[Untrace] SDK shutdown complete")

    @staticmethod
    def get_instance() -> Optional["Untrace"]:
        """Get the current Untrace instance.

        Returns:
            Current Untrace instance or None
        """
        return _global_state["instance"]


def init(config: UntraceConfig) -> Untrace:
    """Initialize the Untrace SDK.

    Args:
        config: Untrace configuration

    Returns:
        Untrace instance

    Raises:
        RuntimeError: If SDK is already initialized
    """
    if _global_state["is_initialized"] and _global_state["instance"]:
        if config.debug:
            logger.info("[Untrace] SDK already initialized. Returning existing instance.")
        return _global_state["instance"]

    if _global_state["is_initialized"]:
        raise RuntimeError("Untrace SDK is already initialized but instance is null.")

    _global_state["is_initialized"] = True
    _global_state["instance"] = Untrace(config)
    return _global_state["instance"]


def get_untrace() -> Untrace:
    """Get the current Untrace instance.

    Returns:
        Current Untrace instance

    Raises:
        RuntimeError: If SDK is not initialized
    """
    if not _global_state["instance"]:
        raise RuntimeError("Untrace SDK not initialized. Call init() first.")
    return _global_state["instance"]
