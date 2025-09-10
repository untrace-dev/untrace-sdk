"""Exporter implementation for the Untrace SDK."""

import asyncio
import json
import logging
from typing import Any, Dict, List, Optional, Union
from opentelemetry.sdk.trace.export import SpanExporter, SpanExportResult, ReadableSpan
from opentelemetry.trace import SpanKind, StatusCode

from .types import UntraceConfig


logger = logging.getLogger(__name__)


class UntraceExporter(SpanExporter):
    """Exporter that sends spans to Untrace backend."""

    def __init__(self, config: UntraceConfig):
        """Initialize the Untrace exporter.

        Args:
            config: Untrace configuration
        """
        self.config = config
        self._export_url = f"{config.base_url}/api/v1/traces/ingest"

        if config.debug:
            logger.info(
                "[UntraceExporter] Initialized with config: %s",
                {
                    "apiKey": f"{config.api_key[:8]}...{config.api_key[-4:]}" if config.api_key else "missing",
                    "baseUrl": config.base_url,
                    "debug": config.debug,
                }
            )

    def export(self, spans: List[ReadableSpan]) -> SpanExportResult:
        """Export spans to Untrace backend.

        Args:
            spans: List of spans to export

        Returns:
            Export result
        """
        if not spans:
            return SpanExportResult.SUCCESS

        try:
            # Run the async export in a new event loop
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                result = loop.run_until_complete(self._export_spans(spans))
                return result
            finally:
                loop.close()
        except Exception as error:
            logger.error("[UntraceExporter] Export failed: %s", error)
            return SpanExportResult.FAILURE

    async def _export_spans(self, spans: List[ReadableSpan]) -> SpanExportResult:
        """Async export implementation.

        Args:
            spans: List of spans to export

        Returns:
            Export result
        """
        try:
            if self.config.debug:
                logger.info(
                    "[UntraceExporter] Exporting %d spans to %s",
                    len(spans),
                    self._export_url
                )
                logger.info(
                    "[UntraceExporter] Span names: %s",
                    [span.name for span in spans]
                )

            payload = self._convert_spans_to_payload(spans)

            if self.config.debug:
                logger.info("[UntraceExporter] Payload prepared, sending request...")

            import httpx

            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self._export_url,
                    json=payload,
                    headers={
                        "Authorization": f"Bearer {self.config.api_key}",
                        "Content-Type": "application/json",
                        **self.config.headers,
                    },
                    timeout=30.0,
                )

                if not response.is_success:
                    logger.error(
                        "[UntraceExporter] Export failed with status %d: %s",
                        response.status_code,
                        response.text
                    )
                    return SpanExportResult.FAILURE

                if self.config.debug:
                    logger.info("[UntraceExporter] Export successful")
                    logger.info("[UntraceExporter] Response: %s", response.text)

                return SpanExportResult.SUCCESS

        except Exception as error:
            logger.error("[UntraceExporter] Export failed: %s", error)
            return SpanExportResult.FAILURE

    def shutdown(self) -> None:
        """Shutdown the exporter."""
        # No cleanup needed for this exporter
        pass

    def force_flush(self, timeout_millis: Optional[int] = None) -> bool:
        """Force flush any pending spans.

        Args:
            timeout_millis: Timeout in milliseconds

        Returns:
            True if flush was successful
        """
        # No buffering, so nothing to flush
        return True

    def _convert_spans_to_payload(self, spans: List[ReadableSpan]) -> Dict[str, Any]:
        """Convert spans to OTLP JSON format.

        Args:
            spans: List of spans to convert

        Returns:
            OTLP payload dictionary
        """
        # Group spans by resource and scope
        resource_map: Dict[str, Dict[str, List[ReadableSpan]]] = {}

        for span in spans:
            # Convert attributes to regular dict for JSON serialization
            resource_attrs = dict(span.resource.attributes) if hasattr(span.resource.attributes, 'items') else span.resource.attributes
            resource_key = json.dumps(resource_attrs, sort_keys=True)
            scope_key = f"{span.instrumentation_scope.name}:{span.instrumentation_scope.version or ''}"

            if resource_key not in resource_map:
                resource_map[resource_key] = {}

            if scope_key not in resource_map[resource_key]:
                resource_map[resource_key][scope_key] = []

            resource_map[resource_key][scope_key].append(span)

        # Convert to OTLP format
        resource_spans = []

        for resource_key, scope_map in resource_map.items():
            # Get the first span to extract resource info
            first_span = next(iter(next(iter(scope_map.values()))))

            resource = {
                "attributes": self._convert_attributes(first_span.resource.attributes)
            }

            scope_spans = []

            for scope_key, span_list in scope_map.items():
                scope_name, scope_version = scope_key.split(":", 1)

                scope = {
                    "name": scope_name,
                    "version": scope_version if scope_version else None
                }

                scope_spans.append({
                    "scope": scope,
                    "spans": [self._convert_span(span) for span in span_list]
                })

            resource_spans.append({
                "resource": resource,
                "scopeSpans": scope_spans
            })

        return {"resourceSpans": resource_spans}

    def _convert_span(self, span: ReadableSpan) -> Dict[str, Any]:
        """Convert a single span to OTLP format.

        Args:
            span: Span to convert

        Returns:
            OTLP span dictionary
        """
        return {
            "traceId": format(span.context.trace_id, '032x'),
            "spanId": format(span.context.span_id, '016x'),
            "parentSpanId": format(span.parent.span_id, '016x') if span.parent else None,
            "name": span.name,
            "kind": span.kind.value,
            "startTimeUnixNano": str(self._time_to_nanos(span.start_time)),
            "endTimeUnixNano": str(self._time_to_nanos(span.end_time)),
            "attributes": self._convert_attributes(span.attributes),
            "status": {
                "code": span.status.status_code.value,
                "message": span.status.description
            },
            "events": [
                {
                    "timeUnixNano": str(self._time_to_nanos(event.timestamp)),
                    "name": event.name,
                    "attributes": self._convert_attributes(event.attributes or {})
                }
                for event in span.events
            ],
            "links": [
                {
                    "traceId": format(link.context.trace_id, '032x'),
                    "spanId": format(link.context.span_id, '016x'),
                    "attributes": self._convert_attributes(link.attributes or {})
                }
                for link in span.links
            ]
        }

    def _convert_attributes(self, attributes: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Convert attributes to OTLP format.

        Args:
            attributes: Attributes dictionary

        Returns:
            List of OTLP attributes
        """
        result = []

        # Convert BoundedAttributes to regular dict if needed
        if hasattr(attributes, 'items'):
            attrs_dict = dict(attributes)
        else:
            attrs_dict = attributes

        for key, value in attrs_dict.items():
            if value is None:
                continue

            attr = {"key": key, "value": self._convert_value(value)}
            result.append(attr)

        return result

    def _convert_value(self, value: Any) -> Dict[str, Any]:
        """Convert an attribute value to OTLP format.

        Args:
            value: Attribute value

        Returns:
            OTLP value dictionary
        """
        if isinstance(value, str):
            return {"stringValue": value}
        elif isinstance(value, bool):
            return {"boolValue": value}
        elif isinstance(value, int):
            return {"intValue": value}
        elif isinstance(value, float):
            return {"doubleValue": value}
        elif isinstance(value, (list, tuple)):
            return {
                "arrayValue": {
                    "values": [self._convert_value(v) for v in value]
                }
            }
        elif isinstance(value, dict):
            return {
                "kvlistValue": {
                    "values": [
                        {"key": k, "value": self._convert_value(v)}
                        for k, v in value.items()
                        if v is not None
                    ]
                }
            }
        else:
            # Fallback to string
            return {"stringValue": str(value)}

    def _time_to_nanos(self, timestamp: int) -> int:
        """Convert timestamp to nanoseconds.

        Args:
            timestamp: Timestamp in nanoseconds

        Returns:
            Timestamp in nanoseconds
        """
        return timestamp
