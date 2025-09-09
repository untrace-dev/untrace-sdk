# Untrace SDK for Python

LLM observability SDK for Python applications.

## Installation

```bash
pip install untrace-sdk
```

## Quick Start

```python
import asyncio
from untrace import UntraceClient

async def main():
    # Initialize the client
    async with UntraceClient(api_key="your-api-key") as client:
        # Send a trace event
        trace = await client.trace(
            event_type="llm_call",
            data={
                "model": "gpt-4",
                "prompt": "Hello, world!",
                "response": "Hello! How can I help you today?",
                "tokens_used": 25,
            },
            metadata={
                "user_id": "user123",
                "session_id": "session456",
            }
        )

        print(f"Trace created: {trace.id}")

# Run the async function
asyncio.run(main())
```

## Synchronous Usage

```python
from untrace import UntraceClient

# Initialize the client
client = UntraceClient(api_key="your-api-key")

# Send a trace event
trace = client.trace_sync(
    event_type="llm_call",
    data={
        "model": "gpt-4",
        "prompt": "Hello, world!",
        "response": "Hello! How can I help you today?",
    }
)

print(f"Trace created: {trace.id}")

# Don't forget to close the client
client.close()
```

## API Reference

### UntraceClient

The main client class for interacting with the Untrace API.

#### Constructor

```python
UntraceClient(
    api_key: str,
    base_url: str = "https://api.untrace.dev",
    timeout: float = 30.0,
)
```

#### Methods

- `trace(event_type, data, metadata=None)`: Send a trace event (async)
- `trace_sync(event_type, data, metadata=None)`: Send a trace event (sync)
- `get_trace(trace_id)`: Retrieve a trace by ID (async)
- `close()`: Close the HTTP client

## Error Handling

The SDK provides specific exception types for different error scenarios:

- `UntraceError`: Base exception for all SDK errors
- `UntraceAPIError`: Raised when API requests fail
- `UntraceValidationError`: Raised when request validation fails

```python
from untrace import UntraceClient, UntraceAPIError, UntraceValidationError

try:
    client = UntraceClient(api_key="your-api-key")
    trace = client.trace_sync("llm_call", {"model": "gpt-4"})
except UntraceValidationError as e:
    print(f"Validation error: {e}")
except UntraceAPIError as e:
    print(f"API error: {e}")
```

## Development

### Setup

```bash
# Clone the repository
git clone https://github.com/untrace-dev/untrace-sdk.git
cd untrace-sdk/sdks/python

# Install in development mode
pip install -e ".[dev]"
```

### Running Tests

```bash
pytest
```

### Code Formatting

```bash
black src/
isort src/
ruff check src/
```

## License

MIT License - see LICENSE file for details.
