"""Exact user example demonstrating seamless DX."""

import os
from openai import OpenAI
from untrace import init, UntraceConfig


def main():
    """Main example - exactly as requested by the user."""
    # Initialize Untrace - this auto-instruments everything!
    init(UntraceConfig(
        api_key=os.getenv("UNTRACE_API_KEY", "your-untrace-api-key"),
        base_url="https://untrace.dev",
        debug=True,
    ))

    # Now just use OpenAI normally - it should be automatically traced!
    client = OpenAI(
        # This is the default and can be omitted
        api_key=os.environ.get("OPENAI_API_KEY"),
    )

    # This call should be automatically traced
    response = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[{"role": "user", "content": "Hello, world!"}],
        max_tokens=10
    )

    print(f"Response: {response.choices[0].message.content}")
    print(f"Usage: {response.usage.total_tokens} tokens")
    print("✅ All API calls are automatically traced!")


if __name__ == "__main__":
    main()
