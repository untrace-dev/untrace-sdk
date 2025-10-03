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

export * from './braintrust';
export * from './datadog';
export * from './keywords-ai';
export * from './langfuse';
export * from './langsmith';
export * from './openinference';
export * from './otel-collector';
export * from './posthog';
// Export all providers
export * from './providers';
export * from './s3';
// Export testing utilities
export * from './testing';
// Export all destinations
export * from './webhook';
