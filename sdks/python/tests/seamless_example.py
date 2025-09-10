"""Seamless developer experience example with auto-instrumentation."""

import asyncio
import os
from openai import OpenAI, AsyncOpenAI
from untrace import init, UntraceConfig


async def main():
    """Main example demonstrating seamless DX."""
    print("🚀 Seamless Untrace SDK Example")
    print("=" * 50)

    # Check if API keys are available
    if not os.getenv("OPENAI_API_KEY"):
        print("❌ OPENAI_API_KEY not set. Please set your OpenAI API key to run this example.")
        return

    if not os.getenv("UNTRACE_API_KEY"):
        print("❌ UNTRACE_API_KEY not set. Please set your Untrace API key to run this example.")
        return

    # Step 1: Initialize Untrace SDK - this auto-instruments everything!
    print("\n1️⃣ Initializing Untrace SDK...")
    sdk = init(UntraceConfig(
        api_key=os.getenv("UNTRACE_API_KEY"),
        base_url="https://untrace.dev",
        debug=True,
    ))
    print("✅ Untrace SDK initialized with auto-instrumentation enabled")

    # Step 2: Use OpenAI normally - everything is automatically traced!
    print("\n2️⃣ Using OpenAI with automatic tracing...")

    # Sync client example
    print("\n📝 Sync Client Example:")
    sync_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    sync_response = sync_client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[{"role": "user", "content": "What is the capital of France?"}],
        max_tokens=50
    )

    print(f"✅ Sync Response: {sync_response.choices[0].message.content}")
    print(f"📊 Usage: {sync_response.usage.total_tokens} tokens")

    # Async client example
    print("\n🔄 Async Client Example:")
    async_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    async_response = await async_client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[{"role": "user", "content": "What is 2+2?"}],
        max_tokens=10
    )

    print(f"✅ Async Response: {async_response.choices[0].message.content}")
    print(f"📊 Usage: {async_response.usage.total_tokens} tokens")

    # Embedding example
    print("\n🔢 Embedding Example:")
    embedding_response = await async_client.embeddings.create(
        model="text-embedding-ada-002",
        input="Hello, world!"
    )

    print(f"✅ Embedding Dimension: {len(embedding_response.data[0].embedding)}")
    print(f"📊 Usage: {embedding_response.usage.total_tokens} tokens")

    # Step 3: All calls are automatically traced - no manual work needed!
    print("\n3️⃣ All API calls are automatically traced and sent to Untrace!")
    print("   - No manual span creation needed")
    print("   - No manual attribute setting needed")
    print("   - No manual metrics recording needed")
    print("   - Just use OpenAI normally and everything is traced!")

    # Step 4: Flush and shutdown
    print("\n4️⃣ Flushing traces...")
    await sdk.flush()
    print("✅ Traces flushed to Untrace backend")

    print("\n5️⃣ Shutting down...")
    await sdk.shutdown()
    print("✅ SDK shutdown complete")

    print("\n🎉 Example completed! Check your Untrace dashboard to see the traces.")


if __name__ == "__main__":
    asyncio.run(main())
