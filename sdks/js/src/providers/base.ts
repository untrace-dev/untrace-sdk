import type { Tracer } from '@opentelemetry/api';
import { InstrumentationBase } from '@opentelemetry/instrumentation';
import type {
  ProviderInstrumentation,
  UntraceConfig,
  UntraceInstrumentationConfig,
} from '../types';

/**
 * Base class for provider instrumentations
 */
export abstract class BaseProviderInstrumentation
  extends InstrumentationBase<UntraceInstrumentationConfig>
  implements ProviderInstrumentation
{
  protected config?: UntraceConfig;

  constructor(name: string, version = '1.0.0') {
    super(name, version, { enabled: true });
  }

  /**
   * Initialize the instrumentation
   */
  initialize(config: UntraceConfig, tracer?: Tracer): void {
    this.config = config;
    if (tracer) {
      this.setTracerProvider({ getTracer: () => tracer });
    }
    this.setConfig({ enabled: true, untraceConfig: config });
  }

  /**
   * Check if a module is instrumentable
   */
  abstract canInstrument(module: unknown): boolean;

  /**
   * Instrument a module
   */
  abstract instrument<T = unknown>(module: T): T;

  /**
   * Enable the instrumentation
   */
  enable(): void {
    // Implementation will be provided by subclasses
  }

  /**
   * Disable the instrumentation
   */
  disable(): void {
    // Implementation will be provided by subclasses
  }

  /**
   * Check if debug mode is enabled
   */
  protected isDebugEnabled(): boolean {
    return this.config?.debug === true;
  }

  /**
   * Log debug message
   */
  protected debug(message: string, ...args: unknown[]): void {
    if (this.isDebugEnabled()) {
      console.debug(`[Untrace:${this.instrumentationName}]`, message, ...args);
    }
  }

  /**
   * Get the tracer instance
   */
  protected getTracer(): Tracer {
    return this.tracer;
  }

  /**
   * Initialize the instrumentation - required by OpenTelemetry
   */
  protected init(): void {
    // Implementation will be provided by subclasses
  }
}
