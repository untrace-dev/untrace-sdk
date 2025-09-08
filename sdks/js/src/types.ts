import type {
  Attributes,
  Context,
  Span,
  SpanKind,
  Tracer,
} from '@opentelemetry/api';
import type {
  Instrumentation,
  InstrumentationConfig,
} from '@opentelemetry/instrumentation';

/**
 * Configuration options for initializing Untrace SDK
 */
export interface UntraceConfig {
  /**
   * API key for authentication
   */
  apiKey: string;

  /**
   * Base URL for the Untrace ingestion endpoint
   */
  baseUrl?: string;

  /**
   * Application version
   */
  version?: string;

  /**
   * Additional resource attributes
   */
  resourceAttributes?: Attributes;

  /**
   * Whether to log debug information
   */
  debug?: boolean;

  /**
   * Whether to disable automatic instrumentation
   */
  disableAutoInstrumentation?: boolean;

  /**
   * Custom headers to include in requests
   */
  headers?: Record<string, string>;

  /**
   * Sampling rate (0.0 to 1.0)
   */
  samplingRate?: number;

  /**
   * Maximum batch size for exporting spans
   */
  maxBatchSize?: number;

  /**
   * Export interval in milliseconds
   */
  exportIntervalMs?: number;

  /**
   * Whether to capture request/response bodies
   */
  captureBody?: boolean;

  /**
   * Whether to capture errors
   */
  captureErrors?: boolean;

  /**
   * Custom span processors
   */
  spanProcessors?: unknown[];

  /**
   * Providers to auto-instrument
   */
  providers?: string[];
}

/**
 * LLM specific span attributes
 */
export interface LLMSpanAttributes extends Attributes {
  'llm.provider': string;
  'llm.model': string;
  'llm.operation.type': LLMOperationType;
  'llm.prompt.tokens'?: number;
  'llm.completion.tokens'?: number;
  'llm.total.tokens'?: number;
  'llm.temperature'?: number;
  'llm.top_p'?: number;
  'llm.max_tokens'?: number;
  'llm.stream'?: boolean;
  'llm.tools'?: string;
  'llm.tool_calls'?: string;
  'llm.duration_ms'?: number;
  'llm.cost.prompt'?: number;
  'llm.cost.completion'?: number;
  'llm.cost.total'?: number;
  'llm.error'?: string;
  'llm.error.type'?: string;
  'llm.request.id'?: string;
  'llm.usage.reason'?: string;
}

/**
 * Types of LLM operations
 */
export type LLMOperationType =
  | 'completion'
  | 'chat'
  | 'embedding'
  | 'fine_tune'
  | 'image_generation'
  | 'audio_transcription'
  | 'audio_generation'
  | 'moderation'
  | 'tool_use';

/**
 * LLM Request data
 */
export interface LLMRequest {
  provider: string;
  model: string;
  operation: LLMOperationType;
  prompt?: string | unknown[];
  messages?: Array<{ role: string; content: string; [key: string]: unknown }>;
  input?: string | string[];
  parameters?: Record<string, unknown>;
  tools?: Array<{ name: string; description?: string; parameters?: unknown }>;
  timestamp?: number;
}

/**
 * LLM Response data
 */
export interface LLMResponse {
  requestId?: string;
  model: string;
  choices?: Array<{
    text?: string;
    message?: { role: string; content: string };
    index: number;
    finish_reason?: string;
  }>;
  completion?: string;
  embeddings?: number[][];
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  cost?: {
    prompt?: number;
    completion?: number;
    total?: number;
  };
  error?: Error | { message: string; type?: string; code?: string };
  timestamp?: number;
  duration?: number;
}

/**
 * Vector DB operation attributes
 */
export interface VectorDBAttributes extends Attributes {
  'db.system': string;
  'db.operation': string;
  'db.name'?: string;
  'db.collection'?: string;
  'db.namespace'?: string;
  'vector.dimension'?: number;
  'vector.count'?: number;
  'vector.query.k'?: number;
  'vector.query.filter'?: string;
  'vector.query.metric'?: string;
}

/**
 * Framework attributes (LangChain, LlamaIndex, etc.)
 */
export interface FrameworkAttributes extends Attributes {
  'framework.name': string;
  'framework.version'?: string;
  'framework.operation': string;
  'framework.chain.name'?: string;
  'framework.chain.type'?: string;
  'framework.agent.name'?: string;
  'framework.agent.type'?: string;
  'framework.tool.name'?: string;
  'framework.tool.type'?: string;
}

/**
 * Workflow attributes
 */
export interface WorkflowAttributes extends Attributes {
  'workflow.name': string;
  'workflow.version'?: string;
  'workflow.run_id': string;
  'workflow.parent_id'?: string;
  'workflow.user_id'?: string;
  'workflow.session_id'?: string;
  'workflow.metadata'?: string;
}

/**
 * Configuration for Untrace instrumentations
 */
export interface UntraceInstrumentationConfig extends InstrumentationConfig {
  /**
   * Untrace configuration
   */
  untraceConfig?: UntraceConfig;
}

/**
 * Provider instrumentation interface
 */
export interface ProviderInstrumentation
  extends Instrumentation<UntraceInstrumentationConfig> {
  /**
   * Initialize the instrumentation
   */
  initialize(config: UntraceConfig, tracer?: Tracer): void;

  /**
   * Check if a module is instrumentable
   */
  canInstrument(module: unknown): boolean;

  /**
   * Instrument a module
   */
  instrument<T = unknown>(module: T): T;

  /**
   * Disable instrumentation
   */
  disable(): void;
}

/**
 * Span options for manual instrumentation
 */
export interface UntraceSpanOptions {
  name: string;
  kind?: SpanKind;
  attributes?: Attributes;
  parent?: Context | Span;
}

/**
 * Metrics types
 */
export interface UntraceMetrics {
  recordTokenUsage(usage: TokenUsage): void;
  recordLatency(duration: number, attributes?: Attributes): void;
  recordError(error: Error, attributes?: Attributes): void;
  recordCost(cost: Cost, attributes?: Attributes): void;
}

export interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  model: string;
  provider: string;
}

export interface Cost {
  prompt?: number;
  completion?: number;
  total: number;
  currency?: string;
  model: string;
  provider: string;
}
