"""Example usage of the Untrace SDK."""

import asyncio
import os
from untrace import (
    init,
    UntraceConfig,
    create_llm_attributes,
    TokenUsage,
    Cost,
)


async def main():
    """Main example function."""
    # Initialize the SDK
    config = UntraceConfig(
        api_key=os.getenv("UNTRACE_API_KEY", "your-api-key-here"),
        base_url="https://untrace.dev",
        debug=True,
    )

    sdk = init(config)

    # Get components
    tracer = sdk.get_tracer()
    metrics = sdk.get_metrics()
    context = sdk.get_context()

    # Set up context
    context.set_user_id("example-user")
    context.set_session_id("example-session")

    # Create a workflow context
    workflow_context = context.create_workflow_context(
        "example-workflow",
        user_id="example-user",
        metadata={"example": "metadata"}
    )

    print(f"Workflow context: {workflow_context}")

    # Example 1: Simple LLM call tracing
    async def mock_openai_call(span):
        """Mock OpenAI API call."""
        span.set_attribute("llm.request.model", "gpt-4")
        span.set_attribute("llm.request.messages", '[{"role": "user", "content": "Hello"}]')

        span.add_event("llm.request.start")

        # Simulate API call
        await asyncio.sleep(0.1)

        span.add_event("llm.response.received")
        span.set_attribute("llm.response.model", "gpt-4")
        span.set_attribute("llm.response.choices", '[{"message": {"content": "Hello! How can I help you?"}}]')

        # Set usage attributes
        span.set_attribute("llm.prompt.tokens", 10)
        span.set_attribute("llm.completion.tokens", 15)
        span.set_attribute("llm.total.tokens", 25)

        return {"response": "Hello! How can I help you?"}

    # Create LLM attributes
    llm_attributes = create_llm_attributes(
        provider="openai",
        model="gpt-4",
        operation_type="chat",
        temperature=0.7,
        max_tokens=1000
    )

    # Execute with span
    result = await tracer.with_llm_span(
        "openai.chat.completions.create",
        llm_attributes,
        mock_openai_call
    )

    print(f"LLM call result: {result}")

    # Example 2: Workflow tracing
    async def example_workflow(span):
        """Example workflow function."""
        span.set_attribute("workflow.step", "data_processing")

        # Create a child span for a tool call
        tool_span = tracer.start_tool_span(
            "data-processor",
            {"tool.type": "function", "tool.input.size": 1000}
        )

        # Simulate tool work
        await asyncio.sleep(0.05)

        tool_span.set_attribute("tool.output.size", 500)
        tool_span.end()

        span.set_attribute("workflow.step", "completed")
        return {"processed_items": 500}

    # Execute workflow
    from untrace import UntraceSpanOptions
    workflow_result = await tracer.with_span(
        UntraceSpanOptions(
            name="example-workflow",
            attributes={"workflow.name": "example-workflow"}
        ),
        example_workflow
    )

    print(f"Workflow result: {workflow_result}")

    # Example 3: Metrics recording
    # Record token usage
    usage = TokenUsage(
        model="gpt-4",
        provider="openai",
        prompt_tokens=10,
        completion_tokens=15,
        total_tokens=25
    )
    metrics.record_token_usage(usage)

    # Record cost
    cost = Cost(
        model="gpt-4",
        provider="openai",
        total=0.01,
        prompt=0.005,
        completion=0.005
    )
    metrics.record_cost(cost)

    # Record latency
    metrics.record_latency(150.5, {"operation": "llm_call"})

    print("Metrics recorded successfully")

    # Example 4: Error handling
    async def error_example(span):
        """Example with error handling."""
        try:
            span.set_attribute("operation.type", "risky_operation")

            # Simulate an error
            raise ValueError("Something went wrong!")

        except Exception as e:
            span.record_exception(e)
            span.set_attribute("error.handled", True)
            raise

    try:
        await tracer.with_span(
            UntraceSpanOptions(
                name="error-example",
                attributes={"example": "error_handling"}
            ),
            error_example
        )
    except ValueError as e:
        print(f"Caught expected error: {e}")

    # Flush all spans
    await sdk.flush()
    print("All spans flushed successfully")

    # Shutdown
    await sdk.shutdown()
    print("SDK shutdown complete")


if __name__ == "__main__":
    asyncio.run(main())
