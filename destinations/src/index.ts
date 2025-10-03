// Untrace SDK - Open source destination integrations and testing utilities
// This package provides destination implementations and testing utilities for the Untrace platform

// Re-export types from local implementations for convenience
export type {
  IntegrationProvider,
  ProviderConfig,
  ProviderFactory,
  TraceContext,
  TraceData,
} from './providers';
export type {
  DestinationTestRunner,
  TestResult,
} from './testing';

// Export all destinations
// Import all destinations to register their providers and test runners
import '../webhook';
import '../posthog';
import '../langfuse';
import '../braintrust';
import '../langsmith';
import '../datadog';
import '../keywords-ai';
import '../openinference';
import '../otel-collector';
import '../s3';
import '../snowflake';
import '../phoenix';
import '../clickhouse';
import '../supabase';
import '../grafana';
import '../firehose';
import '../portkey';
import '../helicone';
import '../newrelic';
import '../dynatrace';
import '../opik';
import '../evidently';
import '../weave';
import '../honeyhive';

export * from './braintrust';
export * from './clickhouse';
export * from './datadog';
export * from './dynatrace';
export * from './evidently';
export * from './firehose';
export * from './grafana';
export * from './helicone';
export * from './honeyhive';
export * from './keywords-ai';
export * from './langfuse';
export * from './langsmith';
export * from './newrelic';
export * from './openinference';
export * from './opik';
export * from './otel-collector';
export * from './phoenix';
export * from './portkey';
export * from './posthog';
// Export all providers
export * from './providers';
export * from './s3';
export * from './snowflake';
export * from './supabase';
// Export testing utilities
export * from './testing';
export * from './weave';
// Export all destinations
export * from './webhook';
