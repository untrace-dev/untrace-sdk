# Contributing to Untrace

First off, thank you for considering contributing to Untrace! It's people like you that make Untrace such a great tool.

## Code of Conduct

By participating in this project, you are expected to uphold our Code of Conduct. Please report unacceptable behavior to [chris.watts.t@gmail.com](mailto:chris.watts.t@gmail.com).

## Project Structure

This is a monorepo using [Turborepo](https://turbo.build/) and bun workspaces. The project is organized into several main components:

```
untrace/
├── packages/              # Shared packages
│   ├── analytics/         # Analytics utilities
├── tooling/              # Build and development tools
├── turbo/                # Turborepo configuration
└── patches/              # Package patches
```

## Development Setup

### Prerequisites

- [Node.js](https://nodejs.org/) (version specified in `.nvmrc`)
- [bun](https://bun.io/) (we use this instead of npm or yarn)
- [Git](https://git-scm.com/)

### Getting Started

1. Install bun if you haven't already:
   ```bash
   npm install -g bun
   ```

2. Clone the repository:
   ```bash
   git clone https://github.com/untrace-dev/untrace.git
   cd untrace
   ```

3. Install dependencies:
   ```bash
   bun install
   ```

4. Build all packages:
   ```bash
   bun build
   ```

5. Start development servers:
   ```bash
   bun dev
   ```

### Useful Commands

- `bun build` - Build all packages
- `bun dev` - Start all development servers
- `bun test` - Run tests across all packages
- `bun lint` - Lint all packages
- `bun clean` - Clean all build outputs
- `bun changeset` - Create a changeset for version management

### Working with Turborepo

We use Turborepo for managing our monorepo. Key concepts:

- Each package has its own `package.json` with its dependencies
- Shared configuration lives in the root `turbo.json`
- Build outputs are cached for faster subsequent builds
- Workspace dependencies are managed through `bun-workspace.yaml`

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible:

* Use a clear and descriptive title
* Describe the exact steps which reproduce the problem
* Provide specific examples to demonstrate the steps
* Describe the behavior you observed after following the steps
* Explain which behavior you expected to see instead and why
* Include screenshots if possible
* Include your environment details (OS, Node.js version, etc.)

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please include:

* A clear and descriptive title
* A detailed description of the proposed functionality
* Explain why this enhancement would be useful to most Untrace users
* List any additional context or screenshots

### Pull Requests

Please follow these steps to have your contribution considered:

1. Follow all instructions in the template
2. Follow the styleguides
3. After you submit your pull request, verify that all status checks are passing

#### Pull Request Process

1. Fork the repository
2. Create a new branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run the tests (`bun test`)
5. Commit your changes (`git commit -m 'Add some amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## Styleguides

### Git Commit Messages

* Use the present tense ("Add feature" not "Added feature")
* Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
* Limit the first line to 72 characters or less
* Reference issues and pull requests liberally after the first line

### TypeScript Styleguide

* Use TypeScript for all new code
* Follow the existing code style
* Include types for all variables and function parameters
* Write descriptive variable and function names
* Add JSDoc comments for public APIs
* Keep functions small and focused
* Use async/await over raw promises

### Documentation Styleguide

* Use [Markdown](https://guides.github.com/features/mastering-markdown/) for documentation
* Reference functions and classes with backticks: \`myFunction()\`
* Include code examples where appropriate
* Keep line length to a maximum of 80 characters
* Use descriptive link texts: prefer "[Contributing Guide](#)" over "[click here](#)"

## Testing

* Write unit tests for all new code using bun test
* Ensure all tests pass before submitting a PR (`bun test`)
* Include integration tests for new features
* Follow the existing testing patterns
* Use meaningful test descriptions

## Code Style

* We use [Biome](https://biomejs.dev/) for formatting and linting
* Configuration is in the root `biome.json`
* Run `bun format` to format code
* Run `bun lint` to check for style issues

## Version Management

We use [Changesets](https://github.com/changesets/changesets) for version management:

1. Make your changes
2. Run `bun changeset` to create a changeset
3. Follow the prompts to describe your changes
4. Commit the generated changeset file
5. Submit your PR

## Git Hooks

We use [lefthook](https://github.com/evilmartians/lefthook) for git hooks:
* Pre-commit: Linting, formatting, and type checking
* Pre-push: Running tests

Configuration is in `lefthook.yml`

## Security

* Never commit API keys or credentials
* Use environment variables for sensitive data
* Follow security best practices
* Report security vulnerabilities privately to [chris.watts.t@gmail.com](mailto:chris.watts.t@gmail.com)

## Observability and Monitoring

### OpenTelemetry Integration

We use [OpenTelemetry](https://opentelemetry.io/) (OTel) as our standard observability framework for monitoring and tracing across all services. OpenTelemetry provides:

* **Standardized instrumentation** for traces, metrics, and logs
* **Vendor-neutral** data collection that works with any observability backend
* **Automatic context propagation** across service boundaries
* **Semantic conventions** for consistent telemetry data

#### Setting Up OpenTelemetry

1. **Install dependencies**:
   ```bash
   bun add @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node
   ```

2. **Initialize in your service**:
   ```typescript
   import { NodeSDK } from '@opentelemetry/sdk-node';
   import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

   const sdk = new NodeSDK({
     instrumentations: [getNodeAutoInstrumentations()]
   });

   sdk.start();
   ```

3. **Add custom spans**:
   ```typescript
   import { trace } from '@opentelemetry/api';

   const tracer = trace.getTracer('untrace-service');
   const span = tracer.startSpan('operation-name');
   // ... your code
   span.end();
   ```

### OpenLLMetry for LLM Observability

For LLM-specific observability, we use [OpenLLMetry](https://github.com/traceloop/openllmetry), which provides automatic instrumentation for LLM applications built on top of OpenTelemetry.

#### Why OpenLLMetry?

* **Auto-instrumentation** for popular LLM frameworks (LangChain, LlamaIndex, OpenAI, etc.)
* **LLM-specific metrics**: token usage, costs, latencies, prompt/response pairs
* **Privacy-first**: Built-in PII detection and redaction capabilities
* **Zero-code setup**: Minimal configuration required

#### Setting Up OpenLLMetry

1. **Install the SDK**:
   ```bash
   # For Python components
   pip install traceloop-sdk

   # For TypeScript/JavaScript components
   bun add @traceloop/node-server-sdk
   ```

2. **Initialize in Python services**:
   ```python
   from traceloop.sdk import Traceloop

   Traceloop.init(
       app_name="untrace-llm-service",
       disable_batch=False,
       api_endpoint="http://localhost:4318"  # Your OTel collector endpoint
   )
   ```

3. **Initialize in TypeScript services**:
   ```typescript
   import * as traceloop from "@traceloop/node-server-sdk";

   traceloop.initialize({
     appName: "untrace-llm-service",
     apiEndpoint: "http://localhost:4318"  // Your OTel collector endpoint
   });
   ```

#### Key Metrics to Monitor

When working with LLM applications, ensure you're tracking:

* **Performance Metrics (RED method)**:
  - **Rate**: Requests per second
  - **Errors**: Failed LLM API calls, timeouts, rate limits
  - **Duration**: Response times and latencies

* **LLM-Specific Metrics**:
  - **Token usage**: Input/output tokens per request
  - **Costs**: Estimated costs based on token usage
  - **Model performance**: Response quality metrics
  - **Context window usage**: Percentage of context used

* **User Experience Metrics**:
  - **User feedback scores**
  - **Conversation completion rates**
  - **Intent recognition accuracy**

#### Best Practices

1. **Sampling Strategy**: For high-volume services, implement intelligent sampling:
   ```typescript
   // Sample 10% of successful requests, 100% of errors
   const sampler = new TraceIdRatioBased(0.1);
   ```

2. **Privacy Protection**: Always sanitize sensitive data:
   ```python
   # Configure PII detection in OpenLLMetry
   Traceloop.init(
       app_name="untrace-service",
       disable_batch=False,
       headers={"x-traceloop-pii-detection": "true"}
   )
   ```

3. **Cost Management**: Monitor and alert on token usage:
   ```typescript
   // Add cost tracking attributes
   span.setAttribute('llm.token.total_cost', calculateCost(tokens));
   span.setAttribute('llm.token.prompt_tokens', promptTokens);
   span.setAttribute('llm.token.completion_tokens', completionTokens);
   ```

4. **Debugging**: Use trace context for debugging LLM interactions:
   ```python
   from opentelemetry import trace

   tracer = trace.get_tracer(__name__)
   with tracer.start_as_current_span("llm_operation") as span:
       span.set_attribute("prompt", prompt)
       span.set_attribute("model", model_name)
       # Your LLM call here
   ```

### Testing Observability

* Include observability tests in your test suite
* Verify that traces are properly exported in CI/CD
* Test error scenarios to ensure they're captured
* Use the OpenTelemetry Collector's debug exporter during development

### Resources

* [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
* [OpenTelemetry Semantic Conventions](https://opentelemetry.io/docs/specs/semconv/)
* [GenAI Semantic Conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/)
* [OpenLLMetry Documentation](https://docs.traceloop.com/openllmetry/introduction)
* [OTel Collector Configuration](https://opentelemetry.io/docs/collector/configuration/)

For a more detailed guide on implementing observability in the Untrace project, see our [Observability Guide](contributing/OBSERVABILITY_GUIDE.md).

## Questions?

Don't hesitate to ask questions by:
* Opening an issue
* Joining our [Discord community](https://discord.gg/untrace)
* Checking our [documentation](https://docs.untrace.dev)

## License

By contributing to Untrace, you agree that your contributions will be licensed under its MIT License.