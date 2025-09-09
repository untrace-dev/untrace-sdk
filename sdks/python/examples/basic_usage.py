#!/usr/bin/env python3
"""Basic usage example for the Untrace Python SDK."""

import asyncio
import os
from untrace import UntraceClient


async def main():
    """Demonstrate basic SDK usage."""
    # Get API key from environment variable
    api_key = os.getenv("UNTRACE_API_KEY")
    if not api_key:
        print("Please set UNTRACE_API_KEY environment variable")
        return

    # Initialize the client
    async with UntraceClient(api_key=api_key) as client:
        # Example 1: Trace an LLM call
        print("Tracing LLM call...")
        trace = await client.trace(
            event_type="llm_call",
            data={
                "model": "gpt-4",
                "prompt": "What is the capital of France?",
                "response": "The capital of France is Paris.",
                "tokens_used": 15,
                "cost": 0.0003,
            },
            metadata={
                "user_id": "user123",
                "session_id": "session456",
                "request_id": "req789",
            }
        )
        print(f"✅ LLM call traced: {trace.id}")

        # Example 2: Trace a user action
        print("Tracing user action...")
        trace = await client.trace(
            event_type="user_action",
            data={
                "action": "button_click",
                "button_id": "submit_form",
                "page": "/dashboard",
            },
            metadata={
                "user_id": "user123",
                "session_id": "session456",
                "timestamp": "2023-01-01T12:00:00Z",
            }
        )
        print(f"✅ User action traced: {trace.id}")

        # Example 3: Retrieve a trace
        print(f"Retrieving trace: {trace.id}")
        retrieved_trace = await client.get_trace(trace.id)
        print(f"✅ Retrieved trace: {retrieved_trace.event_type}")


def sync_example():
    """Demonstrate synchronous SDK usage."""
    api_key = os.getenv("UNTRACE_API_KEY")
    if not api_key:
        print("Please set UNTRACE_API_KEY environment variable")
        return

    # Initialize the client
    client = UntraceClient(api_key=api_key)

    try:
        # Trace an event synchronously
        trace = client.trace_sync(
            event_type="api_call",
            data={
                "endpoint": "/api/v1/users",
                "method": "GET",
                "status_code": 200,
                "response_time_ms": 150,
            },
            metadata={
                "user_id": "user123",
                "ip_address": "192.168.1.1",
            }
        )
        print(f"✅ API call traced: {trace.id}")

    finally:
        # Always close the client
        client.close()


if __name__ == "__main__":
    print("=== Async Example ===")
    asyncio.run(main())

    print("\n=== Sync Example ===")
    sync_example()
