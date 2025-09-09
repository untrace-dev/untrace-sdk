import type { TraceType } from './db-types';

// Standard Integration Interface
export interface IntegrationProvider {
  name: string;
  isEnabled(): boolean;
  captureTrace(trace: TraceType): Promise<void>;
  captureError(error: Error, trace: TraceType): Promise<void>;
  identifyUser(
    distinctId: string,
    properties: Record<string, unknown>,
  ): Promise<void>;
  flush?(): Promise<void>;
}

// Configuration for each integration
export interface IntegrationConfig {
  enabled: boolean;
  apiKey?: string;
  endpoint?: string;
  options?: Record<string, unknown>;
}

// Main integrations configuration
export interface IntegrationsConfig {
  posthog?: IntegrationConfig;
  mixpanel?: IntegrationConfig;
  datadog?: IntegrationConfig;
  webhook?: IntegrationConfig;
  s3?: IntegrationConfig;
  langfuse?: IntegrationConfig;
  [key: string]: IntegrationConfig | undefined;
}
