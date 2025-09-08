# Untrace PRFAQ (Press Release and FAQ)

---

## PRESS RELEASE

### Untrace Launches to Eliminate LLM Observability Fragmentation, Saving AI Teams 80% of Integration Time

**The "Segment for LLM Traces" enables developers to capture once and route everywhere, ending vendor lock-in and tool sprawl**

SAN FRANCISCO, CA - March 15, 2025 - Untrace, the first unified routing platform for LLM observability, today announced its official launch to address the growing fragmentation in the AI monitoring ecosystem. The platform enables development teams to capture LLM traces through a single integration and intelligently route them to any combination of observability platforms including LangSmith, Langfuse, Keywords.ai, and others.

As enterprises rapidly adopt AI, they face a critical challenge: the average team uses 3.2 different LLM observability tools, each requiring separate integration, maintenance, and data management. This fragmentation costs companies an estimated $200,000 annually in engineering time and creates dangerous blind spots in AI system monitoring.

"When we surveyed 200 AI teams, 67% cited observability tool sprawl as their biggest operational pain point," said [Founder Name], CEO of Untrace. "Teams are spending more time managing integrations than improving their AI systems. We built Untrace to solve this once and for all - integrate once with us, and seamlessly work with any observability platform."

Untrace acts as intelligent middleware that:
- **Captures traces with <50ms latency overhead** through OpenAI-compatible proxy or native SDKs
- **Routes intelligently** based on model type, cost thresholds, errors, or custom rules
- **Transforms data** between different platform formats automatically
- **Reduces costs** through intelligent sampling and filtering
- **Ensures reliability** with 99.95% uptime and zero data loss guarantees

Early customer Untrace Corp reduced their observability integration time from 3 weeks to 30 minutes while cutting monitoring costs by 60% through intelligent sampling. "Untrace gave us the freedom to experiment with different platforms without the integration tax," said Dana Chen, Engineering Manager at Untrace Corp. "We can now route high-value traces to premium platforms and everything else to cost-effective alternatives."

The platform launches with support for 10+ destinations including:
- LangSmith
- Langfuse (cloud and self-hosted)
- Keywords.ai
- Helicone
- Phoenix/Arize
- Custom webhooks and data warehouses

Untrace is available immediately with a generous free tier supporting 100,000 traces per month. Paid plans start at $99/month for teams needing higher volumes and advanced features.

"This is just the beginning," added [Founder Name]. "We're building the infrastructure layer that will power the next generation of AI applications. When every company becomes an AI company, they'll need Untrace to manage the complexity."

For more information or to start a free trial, visit untrace.dev.

---

## FREQUENTLY ASKED QUESTIONS

### External FAQ (Customer-Facing)

**Q: What is Untrace?**
A: Untrace is a middleware platform that captures LLM (Large Language Model) traces from your AI applications and intelligently routes them to multiple observability platforms. Think of it as "Segment for LLM traces" - you integrate once with Untrace, and we handle the complexity of sending your data to LangSmith, Langfuse, Keywords.ai, or any other observability platform you choose.

**Q: Why do I need Untrace when I can integrate directly with observability platforms?**
A: Direct integration creates several problems:
- Each platform requires separate SDK integration and maintenance
- Switching platforms requires code changes and potential downtime
- You can't easily use multiple platforms for different purposes
- There's no way to sample or filter traces before sending them
- You're locked into a single vendor's pricing and features

Untrace solves all these issues with a single integration that future-proofs your observability stack.

**Q: How does Untrace work?**
A: Untrace provides three ways to capture traces:
1. **OpenAI Proxy**: Simply change your OpenAI base URL to route through Untrace
2. **Native SDKs**: Drop-in replacements for OpenAI SDKs with automatic trace capture
3. **Webhook API**: Send traces directly from your existing infrastructure

Once captured, our routing engine evaluates your rules and sends traces to the appropriate destinations in their required formats.

**Q: What's the performance impact?**
A: Untrace adds less than 50ms latency (P95) to your LLM calls. Our infrastructure is designed for high performance with:
- Global edge locations for low latency
- Asynchronous trace processing (non-blocking)
- 99.95% uptime SLA
- Automatic failover and retry logic

**Q: How much does it cost?**
A: Untrace offers flexible pricing:
- **Free Tier**: 100K traces/month, 2 destinations
- **Growth**: $99/month for 10M traces, 5 destinations
- **Scale**: $499/month for 100M traces, unlimited destinations
- **Enterprise**: Custom pricing with SLA and dedicated support

This is typically 80% cheaper than maintaining multiple direct integrations.

**Q: Is my data secure?**
A: Security is our top priority:
- All data is encrypted in transit (TLS 1.3) and at rest (AES-256)
- Automatic PII detection and redaction
- SOC2 Type II certified (in progress)
- GDPR and CCPA compliant infrastructure
- Data is only stored temporarily for routing (configurable retention)

**Q: Which platforms do you support?**
A: We currently support 10+ destinations with more added monthly:
- LangSmith
- Langfuse (cloud & self-hosted)
- Keywords.ai
- Helicone
- LangWatch
- Phoenix/Arize
- Datadog APM
- Custom webhooks
- S3/GCS data lakes
- OpenTelemetry collectors

**Q: Can I filter or sample traces?**
A: Yes! Untrace provides powerful filtering and sampling:
- Route by model type, cost, error conditions, or custom metadata
- Sample by percentage, cost threshold, or error-biased sampling
- Transform data between platforms
- Filter out sensitive information
- Aggregate before sending to reduce costs

**Q: Do you support self-hosted deployment?**
A: We plan to offer self-hosted options for enterprise customers in Q3 2025. Contact us to join the early access program.

**Q: How do I get started?**
A: Getting started takes less than 5 minutes:
1. Sign up at untrace.dev
2. Create an API key
3. Add Untrace to your code (one line change for OpenAI proxy)
4. Configure your first destination
5. Start seeing traces flow!

### Internal FAQ (Team/Investor-Facing)

**Q: What's the market opportunity?**
A: The LLM observability market is projected to reach $2.5B by 2027 with 87% YoY growth. Every AI application needs observability, and the current fragmentation creates a perfect wedge for a routing layer. We estimate our TAM at $500M for middleware services, with a path to $50M ARR in 3 years.

**Q: Who are the competitors?**
A: We have no direct competitors in the "LLM trace routing" space. Indirect competition includes:
- Observability platforms adding multi-destination features (unlikely due to competitive dynamics)
- General log routers like Fluentd (not optimized for LLM traces)
- DIY solutions (expensive to maintain)

Our moat comes from deep integrations, intelligent routing logic, and network effects.

**Q: What's the technical moat?**
A: Our technical advantages include:
- Proprietary high-performance routing engine handling 100K+ traces/second
- Deep integrations with 10+ platforms with format translation
- Intelligent sampling algorithms that maintain statistical accuracy
- Edge deployment for sub-50ms global latency
- Patent-pending trace deduplication technology

**Q: How do we make money?**
A: Revenue streams:
1. **Usage-based pricing**: Per trace routed (primary)
2. **Platform fees**: Base monthly fee for advanced features
3. **Enterprise contracts**: Annual contracts with volume commits
4. **Future: Data intelligence**: Anonymous insights and benchmarking (opt-in)

**Q: What's the acquisition strategy?**
A: Three-pronged approach:
1. **Developer-led growth**: Open source SDKs, technical content, community
2. **Partner channel**: Integrate with LLM frameworks and platforms
3. **Enterprise sales**: Target Fortune 500 AI teams with POCs

Early traction: 50 beta users, 10M traces/day, 3 enterprise POCs

**Q: Why will platforms integrate with us instead of building their own routing?**
A: Platforms benefit from Untrace because:
- We drive new customer acquisition to them
- They avoid building/maintaining routing infrastructure
- They can focus on their core differentiators
- We're neutral (not competing with them)
- Network effects: more platforms = more valuable for everyone

**Q: What are the key risks?**
A: Main risks and mitigations:
- **Platform API changes**: Version detection, graceful degradation, strong partnerships
- **Observability platforms add routing**: Focus on advanced features, better UX, neutral position
- **Performance at scale**: Proven architecture, experienced team, gradual rollout
- **Security concerns**: SOC2 certification, enterprise-grade security, self-hosted option

**Q: What's the team background?**
A: [To be filled with actual team details]
- CEO: Previously built data infrastructure at [Company], 10 years experience
- CTO: Distributed systems expert from [Company], scaled to billions of events/day
- Advisors: Former executives from Segment, Datadog, New Relic

**Q: What are you raising and what will you use it for?**
A: Raising $2M pre-seed to:
- Hire 4 engineers to accelerate platform development (60%)
- Go-to-market initiatives and developer relations (20%)
- Infrastructure and security certifications (15%)
- Operating buffer (5%)

This gets us to $1M ARR and Series A metrics in 12 months.

**Q: What's the exit strategy?**
A: Multiple paths to exit:
- **Strategic acquisition** by observability platforms (Datadog, New Relic)
- **Infrastructure consolidation** by cloud providers (AWS, Google, Microsoft)
- **Platform expansion** to become broader AI infrastructure (IPO path)

Comparable exits: Segment ($3.2B), LaunchDarkly ($3B), Algolia ($2.1B)

---

**Document Version**: 1.0
**Last Updated**: January 2025
**Status**: Ready for Review