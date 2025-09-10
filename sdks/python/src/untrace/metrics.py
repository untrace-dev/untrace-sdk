"""Metrics implementation for the Untrace SDK."""

import logging
from typing import Any, Dict, Optional
from opentelemetry import metrics
from opentelemetry.metrics import Counter, Histogram, Meter

from .types import TokenUsage, Cost


logger = logging.getLogger(__name__)


class UntraceMetrics:
    """Metrics collection for Untrace SDK."""

    def __init__(self, meter_name: str = "untrace-sdk"):
        """Initialize the metrics collector.

        Args:
            meter_name: Name of the meter
        """
        self._meter: Meter = metrics.get_meter(meter_name)

        # Create metrics instruments
        self._token_counter = self._meter.create_counter(
            name="untrace.tokens.total",
            description="Total number of tokens processed",
            unit="1"
        )

        self._latency_histogram = self._meter.create_histogram(
            name="untrace.latency",
            description="Latency of operations",
            unit="ms"
        )

        self._error_counter = self._meter.create_counter(
            name="untrace.errors.total",
            description="Total number of errors",
            unit="1"
        )

        self._cost_counter = self._meter.create_counter(
            name="untrace.cost.total",
            description="Total cost of operations",
            unit="USD"
        )

    def record_token_usage(self, usage: TokenUsage) -> None:
        """Record token usage metrics.

        Args:
            usage: Token usage information
        """
        try:
            attributes = {
                "model": usage.model,
                "provider": usage.provider,
            }

            if usage.prompt_tokens:
                self._token_counter.add(
                    usage.prompt_tokens,
                    {**attributes, "token_type": "prompt"}
                )

            if usage.completion_tokens:
                self._token_counter.add(
                    usage.completion_tokens,
                    {**attributes, "token_type": "completion"}
                )

            if usage.total_tokens:
                self._token_counter.add(
                    usage.total_tokens,
                    {**attributes, "token_type": "total"}
                )

        except Exception as error:
            logger.error("Failed to record token usage: %s", error)

    def record_latency(self, duration_ms: float, attributes: Optional[Dict[str, Any]] = None) -> None:
        """Record latency metrics.

        Args:
            duration_ms: Duration in milliseconds
            attributes: Additional attributes
        """
        try:
            attrs = attributes or {}
            self._latency_histogram.record(duration_ms, attrs)
        except Exception as error:
            logger.error("Failed to record latency: %s", error)

    def record_error(self, error: Exception, attributes: Optional[Dict[str, Any]] = None) -> None:
        """Record error metrics.

        Args:
            error: Exception that occurred
            attributes: Additional attributes
        """
        try:
            attrs = {
                "error_type": type(error).__name__,
                "error_message": str(error),
                **(attributes or {})
            }
            self._error_counter.add(1, attrs)
        except Exception as error:
            logger.error("Failed to record error: %s", error)

    def record_cost(self, cost: Cost, attributes: Optional[Dict[str, Any]] = None) -> None:
        """Record cost metrics.

        Args:
            cost: Cost information
            attributes: Additional attributes
        """
        try:
            attrs = {
                "model": cost.model,
                "provider": cost.provider,
                "currency": cost.currency,
                **(attributes or {})
            }

            if cost.prompt:
                self._cost_counter.add(
                    cost.prompt,
                    {**attrs, "cost_type": "prompt"}
                )

            if cost.completion:
                self._cost_counter.add(
                    cost.completion,
                    {**attrs, "cost_type": "completion"}
                )

            self._cost_counter.add(
                cost.total,
                {**attrs, "cost_type": "total"}
            )

        except Exception as error:
            logger.error("Failed to record cost: %s", error)

    def get_meter(self) -> Meter:
        """Get the underlying meter.

        Returns:
            OpenTelemetry meter
        """
        return self._meter
