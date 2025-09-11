# Untrace Elixir SDK Examples

This directory contains example usage of the Untrace Elixir SDK.

## Prerequisites

1. Set the `UNTRACE_API_KEY` environment variable with your API key:
   ```bash
   export UNTRACE_API_KEY="your-api-key-here"
   ```

2. Make sure you have Elixir installed (version 1.14 or later).

## Running Examples

### Basic Usage

```bash
elixir examples/basic_usage.exs
```

This example demonstrates:
- Starting a client
- Sending trace events
- Retrieving traces
- Using helper functions for common trace types
- Proper cleanup

### Supervision Tree Integration

```bash
elixir examples/supervision_tree.exs
```

This example shows how to:
- Integrate the Untrace client into a supervision tree
- Use named processes
- Send traces from worker processes
- Handle the client lifecycle properly

### Telemetry Integration

```bash
elixir examples/telemetry_integration.exs
```

This example demonstrates:
- Attaching telemetry handlers
- Monitoring trace events
- Error handling and monitoring
- Client operation monitoring

## Example Output

When running the basic usage example, you should see output like:

```
=== Basic Usage Example ===
Tracing LLM call...
✅ LLM call traced: trace-123456
Tracing user action...
✅ User action traced: trace-789012
Retrieving trace: trace-789012
✅ Retrieved trace: user_action
Using helper functions...
✅ LLM trace created with helper: trace-345678
✅ User action trace created with helper: trace-901234
✅ API call trace created with helper: trace-567890
✅ Client stopped
```

## Customization

You can modify these examples to:
- Add your own trace data
- Implement custom error handling
- Add more complex telemetry handlers
- Integrate with your existing application structure

## Error Handling

All examples include proper error handling. Common error scenarios include:
- Invalid API key
- Network connectivity issues
- Invalid trace data
- API rate limiting

The SDK will return appropriate error tuples that you can handle in your application.
