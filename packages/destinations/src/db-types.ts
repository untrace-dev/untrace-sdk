// Database types copied from @untrace/db/schema
// This is a temporary solution to avoid import issues

export type TraceType = {
  apiKeyId: string | null;
  createdAt: Date;
  data: Record<string, unknown>;
  expiresAt: Date;
  id: string;
  metadata: Record<string, unknown> | null;
  orgId: string;
  parentSpanId: string | null;
  projectId: string;
  spanId: string | null;
  traceId: string;
  updatedAt: Date | null;
  userId: string | null;
};

export type TraceInsertType = {
  apiKeyId?: string | null;
  data: Record<string, unknown>;
  expiresAt?: Date;
  metadata?: Record<string, unknown> | null;
  orgId: string;
  parentSpanId?: string | null;
  projectId: string;
  spanId?: string | null;
  traceId: string;
  userId?: string | null;
};

export type UserType = {
  avatarUrl: string | null;
  clerkId: string;
  createdAt: Date;
  email: string;
  firstName: string | null;
  id: string;
  lastLoggedInAt: Date | null;
  lastName: string | null;
  online: boolean;
  updatedAt: Date | null;
};

export type OrgType = {
  clerkOrgId: string;
  createdAt: Date | null;
  createdByUserId: string;
  id: string;
  name: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripeSubscriptionStatus:
    | 'active'
    | 'canceled'
    | 'incomplete'
    | 'incomplete_expired'
    | 'past_due'
    | 'paused'
    | 'trialing'
    | 'unpaid'
    | null;
  updatedAt: Date | null;
};

export type ProjectType = {
  createdAt: Date | null;
  createdByUserId: string;
  description: string | null;
  id: string;
  maxTracesPerDay: number | null;
  name: string;
  orgId: string;
  storeInputOutput: boolean;
  tracesRetentionDays: number;
  updatedAt: Date | null;
};

export type ApiKeyType = {
  createdAt: Date;
  expiresAt: Date | null;
  id: string;
  isActive: boolean;
  key: string;
  lastUsedAt: Date | null;
  name: string;
  orgId: string;
  projectId: string;
  updatedAt: Date | null;
  userId: string;
};

export type DestinationType = {
  batchSize: number | null;
  config: Record<string, unknown>;
  createdAt: Date;
  description: string | null;
  destinationId: string;
  id: string;
  isEnabled: boolean;
  maxRetries: number;
  name: string;
  orgId: string;
  projectId: string;
  rateLimit: number | null;
  retryDelayMs: number;
  retryEnabled: boolean;
  transformFunction: string | null;
  updatedAt: Date | null;
};

export type DeliveryType = {
  attempts: number;
  createdAt: Date;
  deliveredAt: Date | null;
  destinationId: string;
  id: string;
  lastError: string | null;
  lastErrorAt: Date | null;
  nextRetryAt: Date | null;
  projectId: string;
  responseData: Record<string, unknown> | null;
  status: 'pending' | 'success' | 'failed' | 'retrying' | 'cancelled';
  traceId: string;
  transformedPayload: Record<string, unknown> | null;
  updatedAt: Date | null;
};

export type GovernanceRuleType = {
  createdAt: Date;
  description: string | null;
  fieldPath: string;
  id: string;
  isEnabled: boolean | null;
  llmPrompt: string | null;
  name: string;
  orgId: string;
  pattern: string | null;
  priority: number | null;
  projectId: string;
  replacement: string | null;
  ruleType: 'obfuscation' | 'filter' | 'transform' | 'llm';
  updatedAt: Date;
};

// Enum types
export type UserRoleType = 'admin' | 'superAdmin' | 'user';
export type LocalConnectionStatusType = 'connected' | 'disconnected';
export type StripeSubscriptionStatusType =
  | 'active'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'past_due'
  | 'paused'
  | 'trialing'
  | 'unpaid';
export type ApiKeyUsageTypeType = 'mcp-server' | 'trace';
export type GovernanceRuleTypeType =
  | 'obfuscation'
  | 'filter'
  | 'transform'
  | 'llm';
export type DeliveryStatusType =
  | 'pending'
  | 'success'
  | 'failed'
  | 'retrying'
  | 'cancelled';
