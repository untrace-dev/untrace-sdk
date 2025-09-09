"""Main client for the Untrace SDK."""

import asyncio
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import httpx
from pydantic import BaseModel


class TraceEvent(BaseModel):
    """Represents a trace event."""

    id: str
    timestamp: datetime
    event_type: str
    data: Dict[str, Any]
    metadata: Optional[Dict[str, Any]] = None


class UntraceClient:
    """Main client for interacting with the Untrace API."""

    def __init__(
        self,
        api_key: str,
        base_url: str = "https://api.untrace.dev",
        timeout: float = 30.0,
    ):
        """Initialize the Untrace client.

        Args:
            api_key: Your Untrace API key
            base_url: Base URL for the Untrace API
            timeout: Request timeout in seconds
        """
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

        self._client = httpx.AsyncClient(
            base_url=self.base_url,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "User-Agent": "untrace-sdk-python/0.1.0",
            },
            timeout=timeout,
        )

    async def __aenter__(self) -> "UntraceClient":
        """Async context manager entry."""
        return self

    async def __aexit__(
        self, exc_type: type, exc_val: Exception, exc_tb: object
    ) -> None:
        """Async context manager exit."""
        await self.close()

    async def close(self) -> None:
        """Close the HTTP client."""
        await self._client.aclose()

    async def trace(
        self,
        event_type: str,
        data: Dict[str, Any],
        metadata: Optional[Dict[str, Any]] = None,
    ) -> TraceEvent:
        """Send a trace event to Untrace.

        Args:
            event_type: Type of the event (e.g., 'llm_call', 'user_action')
            data: Event data payload
            metadata: Optional metadata for the event

        Returns:
            TraceEvent object representing the created trace

        Raises:
            UntraceAPIError: If the API request fails
            UntraceValidationError: If the request data is invalid
        """
        from .exceptions import UntraceAPIError, UntraceValidationError

        try:
            payload = {
                "event_type": event_type,
                "data": data,
                "metadata": metadata or {},
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }

            response = await self._client.post("/api/v1/traces", json=payload)

            if response.status_code == 422:
                raise UntraceValidationError(
                    f"Validation error: {response.text}", response=response
                )

            response.raise_for_status()

            trace_data = await response.json()
            return TraceEvent(**trace_data)

        except httpx.HTTPStatusError as e:
            raise UntraceAPIError(
                f"API request failed with status {e.response.status_code}: {e.response.text}",
                response=e.response,
            ) from e
        except httpx.RequestError as e:
            raise UntraceAPIError(f"Request failed: {str(e)}") from e

    def trace_sync(
        self,
        event_type: str,
        data: Dict[str, Any],
        metadata: Optional[Dict[str, Any]] = None,
    ) -> TraceEvent:
        """Synchronous version of trace method.

        Args:
            event_type: Type of the event (e.g., 'llm_call', 'user_action')
            data: Event data payload
            metadata: Optional metadata for the event

        Returns:
            TraceEvent object representing the created trace
        """
        return asyncio.run(self.trace(event_type, data, metadata))

    async def get_trace(self, trace_id: str) -> TraceEvent:
        """Retrieve a trace by ID.

        Args:
            trace_id: The ID of the trace to retrieve

        Returns:
            TraceEvent object

        Raises:
            UntraceAPIError: If the API request fails
        """
        from .exceptions import UntraceAPIError

        try:
            response = await self._client.get(f"/api/v1/traces/{trace_id}")
            response.raise_for_status()

            trace_data = response.json()
            return TraceEvent(**trace_data)

        except httpx.HTTPStatusError as e:
            raise UntraceAPIError(
                f"API request failed with status {e.response.status_code}: {e.response.text}",
                response=e.response,
            ) from e
        except httpx.RequestError as e:
            raise UntraceAPIError(f"Request failed: {str(e)}") from e
