import type { Attributes } from '@opentelemetry/api';
import type {
  FrameworkAttributes,
  LLMOperationType,
  LLMSpanAttributes,
  VectorDBAttributes,
  WorkflowAttributes,
} from './types';

/**
 * LLM attribute keys following OpenTelemetry semantic conventions
 */
export const LLM_ATTRIBUTES = {
  COMPLETION_TOKENS: 'llm.completion.tokens',
  COST_COMPLETION: 'llm.cost.completion',
  COST_PROMPT: 'llm.cost.prompt',
  COST_TOTAL: 'llm.cost.total',
  DURATION: 'llm.duration_ms',
  ERROR: 'llm.error',
  ERROR_TYPE: 'llm.error.type',
  MAX_TOKENS: 'llm.max_tokens',
  MODEL: 'llm.model',
  OPERATION_TYPE: 'llm.operation.type',
  PROMPT_TOKENS: 'llm.prompt.tokens',
  PROVIDER: 'llm.provider',
  REQUEST_ID: 'llm.request.id',
  STREAM: 'llm.stream',
  TEMPERATURE: 'llm.temperature',
  TOOL_CALLS: 'llm.tool_calls',
  TOOLS: 'llm.tools',
  TOP_P: 'llm.top_p',
  TOTAL_TOKENS: 'llm.total.tokens',
  USAGE_INPUT_TOKENS: 'llm.usage.input_tokens',
  USAGE_OUTPUT_TOKENS: 'llm.usage.output_tokens',
  USAGE_REASON: 'llm.usage.reason',
  USAGE_TOTAL_TOKENS: 'llm.usage.total_tokens',
} as const;

/**
 * Attribute aliases for common use
 */
export const ATTR_LLM_PROVIDER = LLM_ATTRIBUTES.PROVIDER;
export const ATTR_LLM_MODEL = LLM_ATTRIBUTES.MODEL;

/**
 * Vector DB attribute keys
 */
export const VECTOR_DB_ATTRIBUTES = {
  COLLECTION: 'db.collection',
  COUNT: 'vector.count',
  DIMENSION: 'vector.dimension',
  NAME: 'db.name',
  NAMESPACE: 'db.namespace',
  OPERATION: 'db.operation',
  QUERY_FILTER: 'vector.query.filter',
  QUERY_K: 'vector.query.k',
  QUERY_METRIC: 'vector.query.metric',
  SYSTEM: 'db.system',
} as const;

/**
 * Framework attribute keys
 */
export const FRAMEWORK_ATTRIBUTES = {
  AGENT_NAME: 'framework.agent.name',
  AGENT_TYPE: 'framework.agent.type',
  CHAIN_NAME: 'framework.chain.name',
  CHAIN_TYPE: 'framework.chain.type',
  NAME: 'framework.name',
  OPERATION: 'framework.operation',
  TOOL_NAME: 'framework.tool.name',
  TOOL_TYPE: 'framework.tool.type',
  VERSION: 'framework.version',
} as const;

/**
 * Workflow attribute keys
 */
export const WORKFLOW_ATTRIBUTES = {
  METADATA: 'workflow.metadata',
  NAME: 'workflow.name',
  PARENT_ID: 'workflow.parent_id',
  RUN_ID: 'workflow.run_id',
  SESSION_ID: 'workflow.session_id',
  USER_ID: 'workflow.user_id',
  VERSION: 'workflow.version',
} as const;

/**
 * Create LLM span attributes
 */
export function createLLMAttributes(
  provider: string,
  model: string,
  operationType: LLMOperationType,
  additionalAttributes?: Partial<LLMSpanAttributes>,
): LLMSpanAttributes {
  return {
    [LLM_ATTRIBUTES.PROVIDER]: provider,
    [LLM_ATTRIBUTES.MODEL]: model,
    [LLM_ATTRIBUTES.OPERATION_TYPE]: operationType,
    ...additionalAttributes,
  } as LLMSpanAttributes;
}

/**
 * Create vector DB attributes
 */
export function createVectorDBAttributes(
  system: string,
  operation: string,
  additionalAttributes?: Partial<VectorDBAttributes>,
): VectorDBAttributes {
  return {
    [VECTOR_DB_ATTRIBUTES.SYSTEM]: system,
    [VECTOR_DB_ATTRIBUTES.OPERATION]: operation,
    ...additionalAttributes,
  } as VectorDBAttributes;
}

/**
 * Create framework attributes
 */
export function createFrameworkAttributes(
  name: string,
  operation: string,
  additionalAttributes?: Partial<FrameworkAttributes>,
): FrameworkAttributes {
  return {
    [FRAMEWORK_ATTRIBUTES.NAME]: name,
    [FRAMEWORK_ATTRIBUTES.OPERATION]: operation,
    ...additionalAttributes,
  } as FrameworkAttributes;
}

/**
 * Create workflow attributes
 */
export function createWorkflowAttributes(
  name: string,
  runId: string,
  additionalAttributes?: Partial<WorkflowAttributes>,
): WorkflowAttributes {
  return {
    [WORKFLOW_ATTRIBUTES.NAME]: name,
    [WORKFLOW_ATTRIBUTES.RUN_ID]: runId,
    ...additionalAttributes,
  } as WorkflowAttributes;
}

/**
 * Sanitize attributes by removing undefined values
 */
export function sanitizeAttributes(
  attributes: Record<string, unknown>,
): Attributes {
  const sanitized: Attributes = {};

  for (const [key, value] of Object.entries(attributes)) {
    if (value !== undefined && value !== null) {
      if (typeof value === 'object') {
        sanitized[key] = JSON.stringify(value);
      } else if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
      ) {
        sanitized[key] = value;
      } else {
        sanitized[key] = String(value);
      }
    }
  }

  return sanitized;
}

/**
 * Merge multiple attribute objects
 */
export function mergeAttributes(...attributeSets: Attributes[]): Attributes {
  return Object.assign({}, ...attributeSets);
}
