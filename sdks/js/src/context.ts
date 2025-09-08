import { context, type Context as OtelContext } from '@opentelemetry/api';

/**
 * Context management for Untrace
 */
export class UntraceContext {
  private readonly WORKFLOW_KEY = Symbol('untrace.workflow');
  private readonly USER_KEY = Symbol('untrace.user');
  private readonly SESSION_KEY = Symbol('untrace.session');
  private readonly METADATA_KEY = Symbol('untrace.metadata');

  /**
   * Set workflow context
   */
  setWorkflow(workflowId: string, workflowName?: string): OtelContext {
    const ctx = context.active();
    return ctx.setValue(this.WORKFLOW_KEY, {
      id: workflowId,
      name: workflowName,
    });
  }

  /**
   * Get workflow context
   */
  getWorkflow(): { id: string; name?: string } | undefined {
    const value = context.active().getValue(this.WORKFLOW_KEY);
    if (value && typeof value === 'object' && 'id' in value) {
      return value as { id: string; name?: string };
    }
    return undefined;
  }

  /**
   * Set user context
   */
  setUser(userId: string, userInfo?: Record<string, unknown>): OtelContext {
    const ctx = context.active();
    return ctx.setValue(this.USER_KEY, { id: userId, ...userInfo });
  }

  /**
   * Get user context
   */
  getUser(): { id: string; [key: string]: unknown } | undefined {
    const value = context.active().getValue(this.USER_KEY);
    if (value && typeof value === 'object' && 'id' in value) {
      return value as { id: string; [key: string]: unknown };
    }
    return undefined;
  }

  /**
   * Set session context
   */
  setSession(
    sessionId: string,
    sessionInfo?: Record<string, unknown>,
  ): OtelContext {
    const ctx = context.active();
    return ctx.setValue(this.SESSION_KEY, { id: sessionId, ...sessionInfo });
  }

  /**
   * Get session context
   */
  getSession(): { id: string; [key: string]: unknown } | undefined {
    const value = context.active().getValue(this.SESSION_KEY);
    if (value && typeof value === 'object' && 'id' in value) {
      return value as { id: string; [key: string]: unknown };
    }
    return undefined;
  }

  /**
   * Set metadata
   */
  setMetadata(metadata: Record<string, unknown>): OtelContext {
    const ctx = context.active();
    const existing = this.getMetadata() || {};
    return ctx.setValue(this.METADATA_KEY, { ...existing, ...metadata });
  }

  /**
   * Get metadata
   */
  getMetadata(): Record<string, unknown> | undefined {
    const value = context.active().getValue(this.METADATA_KEY);
    if (value && typeof value === 'object') {
      return value as Record<string, unknown>;
    }
    return undefined;
  }

  /**
   * Run a function with context
   */
  with<T>(ctx: OtelContext, fn: () => T): T {
    return context.with(ctx, fn);
  }

  /**
   * Run an async function with context
   */
  async withAsync<T>(ctx: OtelContext, fn: () => Promise<T>): Promise<T> {
    return context.with(ctx, fn);
  }
}
