# Untrace 🚀

> The Segment.io for LLM Observability - Route your LLM traces to any platform with a single integration

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Status](https://img.shields.io/badge/status-planning-yellow.svg)]()
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)]()

## 🎯 What is Untrace?

Untrace is a middleware service that captures LLM trace events from your applications and intelligently routes them to multiple observability platforms. Think of it as Segment.io, but specifically designed for LLM traces.

### Why Untrace?

- **🔌 Single Integration**: Integrate once, send traces everywhere
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

### Using the SDK

```python
from untrace import Untrace

# Initialize
tracer = Untrace(api_key="your-api-key")

# Trace any LLM call
with tracer.trace() as span:
    response = your_llm_call()
    span.set_output(response)
```

## 📚 Documentation

- [Getting Started Guide](docs/getting-started.md)
- [API Reference](docs/api-reference.md)
- [Integration Guides](docs/integrations/)
- [Architecture Overview](ARCHITECTURE.md)

## 🎯 Features

### Core Features
- ✅ OpenAI-compatible proxy endpoint
- ✅ Native SDKs (Python, TypeScript)
- ✅ 10+ platform integrations
- ✅ Rule-based routing
- ✅ Real-time monitoring dashboard
- ✅ Cost tracking and optimization

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
untrace/
├── apps/
│   ├── api/           # Main API service
│   ├── dashboard/     # Web dashboard
│   └── docs/          # Documentation site
├── packages/
│   ├── sdk-python/    # Python SDK
│   ├── sdk-typescript/# TypeScript SDK
│   ├── types/         # Shared types
│   └── connectors/    # Platform connectors
├── infrastructure/
│   ├── k8s/          # Kubernetes configs
│   └── terraform/    # Infrastructure as code
└── docs/             # Documentation
```

## 🗺️ Roadmap

### Phase 1: MVP (Q1 2025)
- [x] Core architecture design
- [ ] OpenAI proxy implementation
- [ ] 3 platform integrations
- [ ] Basic web dashboard
- [ ] Documentation

### Phase 2: Growth (Q2 2025)
- [ ] 5 additional integrations
- [ ] Advanced routing rules
- [ ] Analytics dashboard
- [ ] Enterprise features

### Phase 3: Scale (Q3-Q4 2025)
- [ ] AI-powered routing
- [ ] Real-time analytics
- [ ] Compliance certifications
- [ ] Global deployment

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### How to Contribute
1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📊 Status

This project is currently in the **planning phase**. We're actively working on:
- Finalizing the architecture
- Building the MVP
- Gathering feedback from potential users

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by [Segment.io](https://segment.com)'s approach to analytics
- Built on the shoulders of giants in the LLM observability space

## 📧 Contact

- Email: team@untrace.dev
- Discord: [Join our community](https://discord.gg/untrace)
- Twitter: [@untrace_dev](https://twitter.com/untrace_dev)

---

**⭐ Star us on GitHub** — it helps us reach more developers and improve the product!

[Report Bug](https://github.com/your-org/untrace/issues) · [Request Feature](https://github.com/your-org/untrace/issues) · [Documentation](https://docs.untrace.dev)
