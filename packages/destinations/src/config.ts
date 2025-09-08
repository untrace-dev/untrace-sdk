export interface DestinationConfig {
  id: string;
  name: string;
  type: string;
  description: string;
  configSchema: Record<string, unknown>;
  defaultTransform?: string;
  supportsBatchDelivery: boolean;
  supportsCustomTransform: boolean;
  supportsOpenTelemetry: boolean;
  isActive: boolean;
  logo?: string;
  docsUrl?: string;
}

export const destinations: DestinationConfig[] = [
  {
    configSchema: {
      properties: {
        baseUrl: {
          default: 'https://us.cloud.langfuse.com',
          description: 'Langfuse API base URL',
          type: 'string',
        },
        publicKey: { description: 'Langfuse public key', type: 'string' },
        secretKey: { description: 'Langfuse secret key', type: 'string' },
      },
      required: ['publicKey', 'secretKey'],
      type: 'object',
    },
    description:
      'Open-source LLM engineering platform for observability, metrics, and testing',
    docsUrl: 'https://docs.untrace.dev/destinations/langfuse',
    id: 'langfuse',
    isActive: true,
    logo: 'https://cdn.brandfetch.io/langfuse.com/w/400/h/400?c=1idGJK6TyS2PPBb74bA',
    name: 'Langfuse',
    supportsBatchDelivery: true,
    supportsCustomTransform: true,
    supportsOpenTelemetry: true,
    type: 'langfuse',
  },
  {
    configSchema: {
      properties: {
        apiKey: { description: 'OpenAI API key', type: 'string' },
        orgId: {
          description: 'OpenAI Organization ID (optional)',
          type: 'string',
        },
      },
      required: ['apiKey'],
      type: 'object',
    },
    description: 'OpenAI observability and monitoring',
    docsUrl: 'https://docs.untrace.dev/destinations/openai',
    id: 'openai',
    isActive: true,
    logo: 'https://cdn.brandfetch.io/openai.com/w/400/h/400?c=1idGJK6TyS2PPBb74bA',
    name: 'OpenAI',
    supportsBatchDelivery: false,
    supportsCustomTransform: false,
    supportsOpenTelemetry: true,
    type: 'openai',
  },
  {
    configSchema: {
      properties: {
        apiKey: { description: 'LangSmith API key', type: 'string' },
        endpoint: {
          default: 'https://api.smith.langchain.com',
          description: 'LangSmith API endpoint',
          type: 'string',
        },
        projectId: { description: 'LangSmith project ID', type: 'string' },
      },
      required: ['apiKey', 'projectId'],
      type: 'object',
    },
    description: 'LangChain observability and testing platform',
    docsUrl: 'https://docs.untrace.dev/destinations/langsmith',
    id: 'langsmith',
    isActive: true,
    logo: 'https://cdn.brandfetch.io/smith.langchain.com/w/400/h/400?c=1idGJK6TyS2PPBb74bA',
    name: 'LangSmith',
    supportsBatchDelivery: true,
    supportsCustomTransform: true,
    supportsOpenTelemetry: true,
    type: 'langsmith',
  },
  {
    configSchema: {
      properties: {
        apiKey: { description: 'Keywords AI API key', type: 'string' },
        endpoint: {
          default: 'https://api.keywordsai.co',
          description: 'Keywords AI endpoint',
          type: 'string',
        },
      },
      required: ['apiKey'],
      type: 'object',
    },
    description: 'LLM monitoring and optimization platform',
    docsUrl: 'https://docs.untrace.dev/destinations/keywords-ai',
    id: 'keywords_ai',
    isActive: true,
    logo: 'https://cdn.brandfetch.io/keywordsai.co/w/400/h/400?c=1idGJK6TyS2PPBb74bA',
    name: 'Keywords AI',
    supportsBatchDelivery: true,
    supportsCustomTransform: true,
    supportsOpenTelemetry: false,
    type: 'keywords_ai',
  },
  {
    configSchema: {
      properties: {
        accessKeyId: { description: 'AWS access key ID', type: 'string' },
        bucketName: { description: 'S3 bucket name', type: 'string' },
        endpoint: {
          description: 'Custom S3 endpoint (for S3-compatible services)',
          type: 'string',
        },
        prefix: { description: 'S3 key prefix for traces', type: 'string' },
        region: { description: 'AWS region', type: 'string' },
        secretAccessKey: {
          description: 'AWS secret access key',
          type: 'string',
        },
      },
      required: ['bucketName', 'region', 'accessKeyId', 'secretAccessKey'],
      type: 'object',
    },
    description: 'Store traces in Amazon S3 buckets',
    docsUrl: 'https://docs.untrace.dev/destinations/s3',
    id: 's3',
    isActive: true,
    logo: 'https://cdn.brandfetch.io/amazon.com/w/400/h/400?c=1idGJK6TyS2PPBb74bA',
    name: 'Amazon S3',
    supportsBatchDelivery: true,
    supportsCustomTransform: true,
    supportsOpenTelemetry: true,
    type: 's3',
  },
  {
    configSchema: {
      properties: {
        headers: {
          additionalProperties: { type: 'string' },
          description: 'Custom headers to send with requests',
          type: 'object',
        },
        method: {
          default: 'POST',
          description: 'HTTP method to use',
          enum: ['POST', 'PUT'],
          type: 'string',
        },
        timeout: {
          default: 30000,
          description: 'Request timeout in milliseconds',
          type: 'number',
        },
        url: { description: 'Webhook URL', type: 'string' },
      },
      required: ['url'],
      type: 'object',
    },
    defaultTransform: `// Transform function receives the trace data and must return the transformed payload
// Available globals: trace (the trace object), destination (the destination config)
function transform(trace, destination) {
  // Default: return trace as-is
  return trace;
}`,
    description: 'Send traces to a custom webhook endpoint',
    docsUrl: 'https://docs.untrace.dev/destinations/webhook',
    id: 'webhook',
    isActive: true,
    name: 'Webhook',
    supportsBatchDelivery: true,
    supportsCustomTransform: true,
    supportsOpenTelemetry: true,
    type: 'webhook',
  },
  {
    configSchema: {
      properties: {
        apiKey: { description: 'Datadog API key', type: 'string' },
        env: { description: 'Environment name', type: 'string' },
        service: { description: 'Service name', type: 'string' },
        site: {
          default: 'datadoghq.com',
          description: 'Datadog site',
          enum: [
            'datadoghq.com',
            'datadoghq.eu',
            'us3.datadoghq.com',
            'us5.datadoghq.com',
          ],
          type: 'string',
        },
        version: { description: 'Application version', type: 'string' },
      },
      required: ['apiKey'],
      type: 'object',
    },
    description: 'Datadog APM and distributed tracing',
    docsUrl: 'https://docs.untrace.dev/destinations/datadog',
    id: 'datadog',
    isActive: true,
    logo: 'https://cdn.brandfetch.io/datadoghq.com/w/400/h/400?c=1idGJK6TyS2PPBb74bA',
    name: 'Datadog',
    supportsBatchDelivery: true,
    supportsCustomTransform: false,
    supportsOpenTelemetry: true,
    type: 'datadog',
  },
  {
    configSchema: {
      properties: {
        accountId: { description: 'New Relic account ID', type: 'string' },
        licenseKey: { description: 'New Relic license key', type: 'string' },
        region: {
          default: 'US',
          description: 'New Relic region',
          enum: ['US', 'EU'],
          type: 'string',
        },
      },
      required: ['licenseKey', 'accountId'],
      type: 'object',
    },
    description: 'New Relic APM and distributed tracing',
    docsUrl: 'https://docs.untrace.dev/destinations/new-relic',
    id: 'new_relic',
    isActive: true,
    logo: 'https://cdn.brandfetch.io/newrelic.com/w/400/h/400?c=1idGJK6TyS2PPBb74bA',
    name: 'New Relic',
    supportsBatchDelivery: true,
    supportsCustomTransform: false,
    supportsOpenTelemetry: true,
    type: 'new_relic',
  },
  {
    configSchema: {
      properties: {
        apiKey: { description: 'Grafana API key', type: 'string' },
        orgId: { description: 'Grafana organization ID', type: 'string' },
        url: { description: 'Grafana URL', type: 'string' },
      },
      required: ['url', 'apiKey', 'orgId'],
      type: 'object',
    },
    description: 'Grafana observability and monitoring',
    docsUrl: 'https://docs.untrace.dev/destinations/grafana',
    id: 'grafana',
    isActive: true,
    logo: 'https://cdn.brandfetch.io/grafana.com/w/400/h/400?c=1idGJK6TyS2PPBb74bA',
    name: 'Grafana',
    supportsBatchDelivery: true,
    supportsCustomTransform: true,
    supportsOpenTelemetry: true,
    type: 'grafana',
  },
  {
    configSchema: {
      properties: {
        password: { description: 'Password (optional)', type: 'string' },
        url: { description: 'Prometheus URL', type: 'string' },
        username: { description: 'Username (optional)', type: 'string' },
      },
      required: ['url'],
      type: 'object',
    },
    description: 'Prometheus monitoring and alerting',
    docsUrl: 'https://docs.untrace.dev/destinations/prometheus',
    id: 'prometheus',
    isActive: true,
    logo: 'https://cdn.brandfetch.io/prometheus.io/w/400/h/400?c=1idGJK6TyS2PPBb74bA',
    name: 'Prometheus',
    supportsBatchDelivery: true,
    supportsCustomTransform: true,
    supportsOpenTelemetry: true,
    type: 'prometheus',
  },
  {
    configSchema: {
      properties: {
        index: { description: 'Index name', type: 'string' },
        password: { description: 'Password (optional)', type: 'string' },
        url: { description: 'Elasticsearch URL', type: 'string' },
        username: { description: 'Username (optional)', type: 'string' },
      },
      required: ['url', 'index'],
      type: 'object',
    },
    description: 'Elasticsearch search and analytics',
    docsUrl: 'https://docs.untrace.dev/destinations/elasticsearch',
    id: 'elasticsearch',
    isActive: true,
    logo: 'https://cdn.brandfetch.io/elastic.co/w/400/h/400?c=1idGJK6TyS2PPBb74bA',
    name: 'Elasticsearch',
    supportsBatchDelivery: true,
    supportsCustomTransform: true,
    supportsOpenTelemetry: true,
    type: 'elasticsearch',
  },
  {
    configSchema: {
      properties: {
        apiKey: { description: 'PostHog API key', type: 'string' },
        host: {
          default: 'https://app.posthog.com',
          description: 'PostHog host URL',
          type: 'string',
        },
        projectId: { description: 'PostHog project ID', type: 'string' },
      },
      required: ['apiKey', 'projectId'],
      type: 'object',
    },
    description: 'Product analytics and user behavior tracking',
    docsUrl: 'https://docs.untrace.dev/destinations/posthog',
    id: 'posthog',
    isActive: true,
    logo: 'https://cdn.brandfetch.io/posthug.com/w/400/h/400?c=1idGJK6TyS2PPBb74bA',
    name: 'PostHog',
    supportsBatchDelivery: true,
    supportsCustomTransform: true,
    supportsOpenTelemetry: false,
    type: 'posthog',
  },
  {
    configSchema: {
      properties: {
        endpoint: { description: 'Custom endpoint URL', type: 'string' },
        headers: {
          description: 'Custom headers',
          type: 'object',
        },
        method: {
          default: 'POST',
          description: 'HTTP method',
          enum: ['GET', 'POST', 'PUT', 'PATCH'],
          type: 'string',
        },
      },
      required: ['endpoint'],
      type: 'object',
    },
    description: 'Custom destination with custom configuration',
    docsUrl: 'https://docs.untrace.dev/destinations/custom',
    id: 'custom',
    isActive: true,
    name: 'Custom',
    supportsBatchDelivery: true,
    supportsCustomTransform: true,
    supportsOpenTelemetry: true,
    type: 'custom',
  },
];

export function getDestinationById(id: string): DestinationConfig | undefined {
  return destinations.find((d) => d.id === id);
}

export function getActiveDestinations(): DestinationConfig[] {
  return destinations.filter((d) => d.isActive);
}

export function getDestinationsByType(type: string): DestinationConfig[] {
  return destinations.filter((d) => d.type === type && d.isActive);
}
