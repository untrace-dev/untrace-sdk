"""Real OpenAI API example with Untrace SDK."""

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
    """Main example function with real OpenAI API calls."""
    # Initialize the SDK
    config = UntraceConfig(
        api_key=os.getenv("UNTRACE_API_KEY", "your-untrace-api-key"),
        base_url="https://untrace.dev",
        debug=True,
    )

    sdk = init(config)

    # Get components
    tracer = sdk.get_tracer()
    metrics = sdk.get_metrics()
    context = sdk.get_context()

    # Set up context
    context.set_user_id("real-api-user")
    context.set_session_id("real-api-session")

    print("🚀 Starting real OpenAI API example with Untrace SDK")

    # Check if OpenAI API key is available
    if not os.getenv("OPENAI_API_KEY"):
        print("❌ OPENAI_API_KEY not set. Please set your OpenAI API key to run this example.")
        return

    try:
        # Example 1: Chat Completion
        print("\n📝 Example 1: Chat Completion")

        async def chat_completion(span):
            from openai import AsyncOpenAI

            client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

            # Set request attributes
            span.set_attribute("llm.request.model", "gpt-3.5-turbo")
            span.set_attribute("llm.request.messages", '[{"role": "user", "content": "What is the capital of France?"}]')
            span.set_attribute("llm.request.temperature", 0.7)
            span.set_attribute("llm.request.max_tokens", 100)

            span.add_event("llm.request.start")

            # Make the actual API call
            response = await client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[{"role": "user", "content": "What is the capital of France?"}],
                temperature=0.7,
                max_tokens=100
            )

            span.add_event("llm.response.received")

            # Extract response data
            choice = response.choices[0]
            message = choice.message
            usage = response.usage

            # Set response attributes
            span.set_attribute("llm.response.model", response.model)
            span.set_attribute("llm.response.id", response.id)
            span.set_attribute("llm.response.content", message.content)

            # Set usage attributes
            if usage:
                span.set_attribute("llm.prompt.tokens", usage.prompt_tokens)
                span.set_attribute("llm.completion.tokens", usage.completion_tokens)
                span.set_attribute("llm.total.tokens", usage.total_tokens)

                # Record metrics
                token_usage = TokenUsage(
                    model=response.model,
                    provider="openai",
                    prompt_tokens=usage.prompt_tokens,
                    completion_tokens=usage.completion_tokens,
                    total_tokens=usage.total_tokens
                )
                metrics.record_token_usage(token_usage)

            return {
                "content": message.content,
                "model": response.model,
                "usage": {
                    "prompt_tokens": usage.prompt_tokens if usage else 0,
                    "completion_tokens": usage.completion_tokens if usage else 0,
                    "total_tokens": usage.total_tokens if usage else 0,
                }
            }

        # Create LLM attributes
        chat_attributes = create_llm_attributes(
            provider="openai",
            model="gpt-3.5-turbo",
            operation_type="chat",
            temperature=0.7,
            max_tokens=100
        )

        # Execute with span
        chat_result = await tracer.with_llm_span(
            "openai.chat.completions.create",
            chat_attributes,
            chat_completion
        )

        print(f"✅ Chat Response: {chat_result['content']}")
        print(f"📊 Usage: {chat_result['usage']}")

        # Example 2: Embedding
        print("\n🔢 Example 2: Text Embedding")

        async def text_embedding(span):
            from openai import AsyncOpenAI

            client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

            # Set request attributes
            span.set_attribute("llm.request.model", "text-embedding-ada-002")
            span.set_attribute("llm.request.input", "Hello, world!")

            span.add_event("llm.request.start")

            # Make the actual API call
            response = await client.embeddings.create(
                model="text-embedding-ada-002",
                input="Hello, world!"
            )

            span.add_event("llm.response.received")

            # Extract response data
            embedding = response.data[0]
            usage = response.usage

            # Set response attributes
            span.set_attribute("llm.response.model", response.model)
            span.set_attribute("llm.response.embeddings_count", len(response.data))
            span.set_attribute("llm.response.embedding_dimension", len(embedding.embedding))

            # Set usage attributes
            if usage:
                span.set_attribute("llm.prompt.tokens", usage.prompt_tokens)
                span.set_attribute("llm.total.tokens", usage.total_tokens)

                # Record metrics
                token_usage = TokenUsage(
                    model=response.model,
                    provider="openai",
                    prompt_tokens=usage.prompt_tokens,
                    total_tokens=usage.total_tokens
                )
                metrics.record_token_usage(token_usage)

            return {
                "model": response.model,
                "embedding_dimension": len(embedding.embedding),
                "usage": {
                    "prompt_tokens": usage.prompt_tokens if usage else 0,
                    "total_tokens": usage.total_tokens if usage else 0,
                }
            }

        # Create LLM attributes
        embedding_attributes = create_llm_attributes(
            provider="openai",
            model="text-embedding-ada-002",
            operation_type="embedding"
        )

        # Execute with span
        embedding_result = await tracer.with_llm_span(
            "openai.embeddings.create",
            embedding_attributes,
            text_embedding
        )

        print(f"✅ Embedding Model: {embedding_result['model']}")
        print(f"📏 Embedding Dimension: {embedding_result['embedding_dimension']}")
        print(f"📊 Usage: {embedding_result['usage']}")

        # Example 3: Cost Calculation
        print("\n💰 Example 3: Cost Calculation")

        # Calculate costs for different models
        models_and_costs = [
            ("gpt-3.5-turbo", 0.0015, 0.002),
            ("gpt-4", 0.03, 0.06),
            ("text-embedding-ada-002", 0.0001, 0.0001),
        ]

        for model, prompt_cost, completion_cost in models_and_costs:
            # Simulate token usage
            prompt_tokens = 100
            completion_tokens = 50

            # Calculate costs (per 1K tokens)
            total_cost = (prompt_tokens * prompt_cost / 1000) + (completion_tokens * completion_cost / 1000)

            cost = Cost(
                model=model,
                provider="openai",
                total=total_cost,
                prompt=prompt_tokens * prompt_cost / 1000,
                completion=completion_tokens * completion_cost / 1000
            )

            # Record cost
            metrics.record_cost(cost)

            print(f"💵 {model}: ${total_cost:.6f} (${prompt_tokens * prompt_cost / 1000:.6f} prompt + ${completion_tokens * completion_cost / 1000:.6f} completion)")

        # Flush all spans
        print("\n🔄 Flushing spans...")
        await sdk.flush()
        print("✅ Spans flushed successfully")

    except Exception as e:
        print(f"❌ Error occurred: {e}")
        # Record error in metrics
        metrics.record_error(e, {"example": "real_api"})

    finally:
        # Shutdown
        print("\n🛑 Shutting down SDK...")
        await sdk.shutdown()
        print("✅ SDK shutdown complete")


if __name__ == "__main__":
    asyncio.run(main())
