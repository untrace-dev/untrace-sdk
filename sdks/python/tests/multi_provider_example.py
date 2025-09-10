"""Multi-provider example demonstrating modular instrumentation."""

import asyncio
import os
from untrace import init, UntraceConfig, get_supported_providers, get_instrumented_providers


async def main():
    """Main example demonstrating multi-provider instrumentation."""
    print("🚀 Multi-Provider Untrace SDK Example")
    print("=" * 50)

    # Check if API keys are available
    if not os.getenv("OPENAI_API_KEY"):
        print("❌ OPENAI_API_KEY not set. Please set your OpenAI API key to run this example.")
        return

    # Step 1: Initialize Untrace SDK with all providers
    print("\n1️⃣ Initializing Untrace SDK with all providers...")
    sdk = init(UntraceConfig(
        api_key=os.getenv("UNTRACE_API_KEY", "your-untrace-api-key"),
        base_url="https://untrace.dev",
        debug=True,
        providers=["all"]  # Instrument all supported providers
    ))

    # Show supported providers
    supported = get_supported_providers()
    print(f"✅ Supported providers: {supported}")

    # Show instrumented providers
    instrumented = get_instrumented_providers()
    print(f"✅ Instrumented providers: {instrumented}")

    # Step 2: Test OpenAI (should work)
    print("\n2️⃣ Testing OpenAI...")
    try:
        from openai import OpenAI

        client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": "What is 2+2?"}],
            max_tokens=10
        )

        print(f"✅ OpenAI Response: {response.choices[0].message.content}")
        print(f"📊 Usage: {response.usage.total_tokens} tokens")

    except Exception as e:
        print(f"❌ OpenAI Error: {e}")

    # Step 3: Test Anthropic (will skip if not installed)
    print("\n3️⃣ Testing Anthropic...")
    try:
        from anthropic import Anthropic

        client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY", "test-key"))

        response = client.messages.create(
            model="claude-3-sonnet-20240229",
            max_tokens=10,
            messages=[{"role": "user", "content": "What is 2+2?"}]
        )

        print(f"✅ Anthropic Response: {response.content[0].text}")

    except ImportError:
        print("⏭️ Anthropic not installed, skipping")
    except Exception as e:
        print(f"❌ Anthropic Error: {e}")

    # Step 4: Test Google (will skip if not installed)
    print("\n4️⃣ Testing Google...")
    try:
        from google.generativeai import GenerativeModel

        model = GenerativeModel('gemini-pro')

        response = model.generate_content("What is 2+2?")

        print(f"✅ Google Response: {response.text}")

    except ImportError:
        print("⏭️ Google Generative AI not installed, skipping")
    except Exception as e:
        print(f"❌ Google Error: {e}")

    # Step 5: Test Microsoft Azure (will skip if not installed)
    print("\n5️⃣ Testing Microsoft Azure OpenAI...")
    try:
        from openai import AzureOpenAI

        client = AzureOpenAI(
            api_key=os.getenv("AZURE_OPENAI_API_KEY", "test-key"),
            azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT", "https://test.openai.azure.com/"),
            api_version="2023-07-01-preview"
        )

        response = client.chat.completions.create(
            model="gpt-35-turbo",
            messages=[{"role": "user", "content": "What is 2+2?"}],
            max_tokens=10
        )

        print(f"✅ Azure OpenAI Response: {response.choices[0].message.content}")

    except ImportError:
        print("⏭️ Azure OpenAI not installed, skipping")
    except Exception as e:
        print(f"❌ Azure OpenAI Error: {e}")

    # Step 6: Test AWS Bedrock (will skip if not installed)
    print("\n6️⃣ Testing AWS Bedrock...")
    try:
        import boto3

        client = boto3.client('bedrock-runtime')

        # This would require actual AWS credentials and model access
        print("⏭️ AWS Bedrock requires actual AWS credentials, skipping")

    except ImportError:
        print("⏭️ boto3 not installed, skipping")
    except Exception as e:
        print(f"❌ AWS Bedrock Error: {e}")

    # Step 7: Test Cohere (will skip if not installed)
    print("\n7️⃣ Testing Cohere...")
    try:
        from cohere import Client as CohereClient

        client = CohereClient(api_key=os.getenv("COHERE_API_KEY", "test-key"))

        response = client.generate(
            model="command",
            prompt="What is 2+2?",
            max_tokens=10
        )

        print(f"✅ Cohere Response: {response.generations[0].text}")

    except ImportError:
        print("⏭️ Cohere not installed, skipping")
    except Exception as e:
        print(f"❌ Cohere Error: {e}")

    # Step 8: Summary
    print("\n8️⃣ Summary")
    print("✅ All supported providers are automatically instrumented!")
    print("✅ Each provider's SDK works normally with automatic tracing!")
    print("✅ No manual instrumentation needed!")
    print("✅ Check your Untrace dashboard to see all the traces!")

    # Flush and shutdown
    print("\n9️⃣ Flushing traces...")
    await sdk.flush()
    print("✅ Traces flushed to Untrace backend")

    print("\n🔟 Shutting down...")
    await sdk.shutdown()
    print("✅ SDK shutdown complete")


if __name__ == "__main__":
    asyncio.run(main())
