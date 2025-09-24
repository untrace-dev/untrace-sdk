# Untrace 🚀

> The Segment.io for LLM Observability - Route your LLM traces to any platform with a single integration

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Status](https://img.shields.io/badge/status-planning-yellow.svg)]()
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)]()

## 🎯 What is Untrace?

Untrace is a middleware service that captures LLM trace events from your applications and intelligently routes them to multiple observability platforms. Think of it as Segment.io, but specifically designed for LLM traces.

### Why Untrace?

- **🔌 Single Integration**: Integrate once, send traces everywhere
- **🌐 Multi-Language Support**: Native SDKs for 6+ programming languages
- **🔀 Intelligent Routing**: Route traces based on model, cost, errors, or custom rules
- **🔄 No Vendor Lock-in**: Switch between observability platforms without code changes
- **📊 Unified Analytics**: Get insights across all your observability tools
- **💰 Cost Optimization**: Sample intelligently to reduce observability costs
- **🔒 Privacy First**: Built-in PII detection and redaction

## 🏗️ Architecture Overview

```
Your LLM App → Untrace → Multiple Observability Platforms
                    ↓
              • LangSmith
              • Langfuse
              • Keywords.ai
              • Helicone
              • Custom Endpoints
```

## 🚀 Quick Start

### Multi-Language SDK Support

Untrace provides native SDKs for all major programming languages:

| Language | Installation | Quick Start |
|----------|-------------|-------------|
| **JavaScript/TypeScript** | `npm install @untrace/sdk` | [Docs](https://docs.untrace.dev/sdk) |
| **Python** | `pip install untrace-sdk` | [Docs](https://docs.untrace.dev/sdk-python) |
| **Go** | `go get github.com/untrace-dev/untrace-sdk-go` | [Docs](https://docs.untrace.dev/sdk-go) |
| **Rust** | `cargo add untrace-sdk` | [Docs](https://docs.untrace.dev/sdk-rust) |
| **C#/.NET** | `dotnet add package Untrace.Sdk` | [Docs](https://docs.untrace.dev/sdk-csharp) |
| **Elixir** | `{:untrace_sdk, "~> 0.1.2"}` | [Docs](https://docs.untrace.dev/sdk-elixir) |

### JavaScript/TypeScript Example

```typescript
import { init } from '@untrace/sdk';

// Initialize the SDK
const untrace = init({
  apiKey: 'your-api-key',
  serviceName: 'my-llm-app',
});

// Your LLM code is automatically instrumented!
import OpenAI from 'openai';
const openai = new OpenAI();
const response = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

### Python Example

```python
import asyncio
from untrace import UntraceClient

async def main():
    async with UntraceClient(api_key="your-api-key") as client:
        trace = await client.trace(
            event_type="llm_call",
            data={
                "model": "gpt-4",
                "prompt": "Hello, world!",
                "response": "Hello! How can I help you today?",
            }
        )
        print(f"Trace created: {trace.id}")

asyncio.run(main())
```

### Go Example

```go
package main

import (
    "context"
    "github.com/untrace-dev/untrace-sdk-go"
)

func main() {
    client, _ := untrace.Init(untrace.Config{
        APIKey: "your-api-key",
        ServiceName: "my-llm-app",
    })
    defer client.Shutdown(context.Background())

    ctx, span := client.Tracer().StartLLMSpan(context.Background(), "chat", untrace.LLMSpanOptions{
        Provider: "openai",
        Model: "gpt-4",
    })
    defer span.End()

    // Your LLM code here
}
```

### Using the OpenAI Proxy

```python
# Simply change your base URL
from openai import OpenAI

client = OpenAI(
    api_key="your-openai-key",
    base_url="https://api.untrace.dev/v1/proxy"  # Add this line
    default_headers={
        "X-Untrace-Key": "your-untrace-key"
    }
)

# Use OpenAI as normal - traces are automatically captured
response = client.chat.completions.create(
    model="gpt-4",
    messages=[{"role": "user", "content": "Hello!"}]
)
```

## 📚 Documentation

- [SDK Overview](https://docs.untrace.dev/sdk-overview) - Compare all available languages
- [JavaScript/TypeScript SDK](https://docs.untrace.dev/sdk) - Node.js, React, Next.js
- [Python SDK](https://docs.untrace.dev/sdk-python) - FastAPI, Django, Flask
- [Go SDK](https://docs.untrace.dev/sdk-go) - Gin, Echo, Fiber
- [Rust SDK](https://docs.untrace.dev/sdk-rust) - Axum, Actix, Tokio
- [C#/.NET SDK](https://docs.untrace.dev/sdk-csharp) - ASP.NET Core, Console apps
- [Elixir SDK](https://docs.untrace.dev/sdk-elixir) - Phoenix, LiveView, OTP
- [API Reference](https://docs.untrace.dev/api-reference)
- [Architecture Overview](https://docs.untrace.dev/architecture)

## 🎯 Features

### Core Features
- ✅ OpenAI-compatible proxy endpoint
- ✅ **6 Native SDKs** (JavaScript/TypeScript, Python, Go, Rust, C#/.NET, Elixir)
- ✅ 10+ platform integrations
- ✅ Rule-based routing
- ✅ Real-time monitoring dashboard
- ✅ Cost tracking and optimization
- ✅ Framework-specific integrations (React, Next.js, FastAPI, Django, Gin, Axum, ASP.NET Core, Phoenix)

### Routing Features
- Route by model type (GPT-4, Claude, etc.)
- Route by cost threshold
- Route by error conditions
- Route by environment or tags
- Percentage-based traffic splitting
- Fallback destinations

### Security & Compliance
- End-to-end encryption
- PII detection and redaction
- GDPR compliant
- SOC2 Type II (planned)
- On-premise deployment option

## 🔗 Supported Integrations

| Platform | Status | Documentation |
|----------|--------|---------------|
| LangSmith | ✅ Ready | [Guide](docs/integrations/langsmith.md) |
| Langfuse | ✅ Ready | [Guide](docs/integrations/langfuse.md) |
| Keywords.ai | ✅ Ready | [Guide](docs/integrations/keywords.md) |
| Helicone | 🔄 In Progress | Coming soon |
| LangWatch | 🔄 In Progress | Coming soon |
| Phoenix/Arize | 📅 Planned | Coming soon |
| Custom Webhooks | ✅ Ready | [Guide](docs/integrations/webhooks.md) |

## 💻 Development

### Prerequisites
- Node.js 18+
- Python 3.8+
- Docker & Docker Compose
- Kubernetes (for production deployment)

### Local Setup

```bash
# Clone the repository
git clone https://github.com/your-org/untrace.git
cd untrace

# Install dependencies
npm install

# Start local services
docker-compose up -d

# Run the development server
npm run dev
```

### Project Structure

```
untrace-sdk/
├── docs/              # Documentation site
├── sdks/              # Language-specific SDKs
│   ├── js/            # JavaScript/TypeScript SDK
│   ├── python/        # Python SDK
│   ├── go/            # Go SDK
│   ├── rust/          # Rust SDK
│   ├── csharp/        # C#/.NET SDK
│   └── elixir/        # Elixir SDK
├── packages/          # Shared packages
│   ├── analytics/     # Analytics components
│   ├── destinations/  # Platform connectors
│   ├── logger/        # Logging utilities
│   ├── ui/            # UI components
│   └── utils/         # Shared utilities
├── tooling/           # Development tools
└── integ-tests/       # Integration tests
```

## 🗺️ Roadmap

### Phase 1: MVP (Q1 2025)
- [x] Core architecture design
- [x] **6 Native SDKs** (JavaScript/TypeScript, Python, Go, Rust, C#/.NET, Elixir)
- [x] Comprehensive documentation
- [ ] OpenAI proxy implementation
- [ ] 3 platform integrations
- [ ] Basic web dashboard

### Phase 2: Growth (Q2 2025)
- [ ] 5 additional integrations
- [ ] Advanced routing rules
- [ ] Analytics dashboard
- [ ] Enterprise features
- [ ] Additional language SDKs (Java, Swift, Kotlin)

### Phase 3: Scale (Q3-Q4 2025)
- [ ] AI-powered routing
- [ ] Real-time analytics
- [ ] Compliance certifications
- [ ] Global deployment
- [ ] Mobile SDKs (React Native, Flutter)

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### How to Contribute
1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📊 Status

This project is currently in **active development**. We have:
- ✅ **6 Native SDKs** with comprehensive documentation
- ✅ Multi-language support (JavaScript/TypeScript, Python, Go, Rust, C#/.NET, Elixir)
- ✅ Framework-specific integrations
- 🔄 Building the core platform and integrations
- 🔄 Gathering feedback from early adopters

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=untrace-dev/untrace-sdk&type=Date)](https://www.star-history.com/#untrace-dev/untrace-sdk&Date)

## 🙏 Acknowledgments

- Inspired by [Segment.io](https://segment.com)'s approach to analytics
- Built on the shoulders of giants in the LLM observability space

## 📧 Contact

- Email: team@untrace.dev
- Discord: [Join our community](https://untrace.dev/discord)
- Twitter: [@untrace_dev](https://twitter.com/untrace_dev)

---

**⭐ Star us on GitHub** — it helps us reach more developers and improve the product!

[Report Bug](https://github.com/untrace-dev/untrace-sdk/issues) · [Request Feature](https://github.com/untrae-dev/untrace-sdk/issues) · [Documentation](https://docs.untrace.dev)
