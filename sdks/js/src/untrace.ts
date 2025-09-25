import { DiagConsoleLogger, DiagLogLevel, diag } from '@opentelemetry/api';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import { UntraceContext } from './context';
import { UntraceExporter } from './exporter';
import { UntraceMetricsImpl } from './metrics';
import { getProviderInstrumentation } from './providers';
import { UntraceTracer } from './tracer';
import type { ProviderInstrumentation, UntraceConfig } from './types';

// Global state management
const globalState = {
  instance: null as Untrace | null,
  isDiagSet: false,
  isInitialized: false,
  isRegistered: false,
};

/**
 * Main Untrace SDK class
 */
export class Untrace {
  private provider: NodeTracerProvider;
  private config: Required<UntraceConfig>;
  private tracer: UntraceTracer;
  private metrics: UntraceMetricsImpl;
  private context: UntraceContext;
  private instrumentations: ProviderInstrumentation[] = [];

  constructor(config: UntraceConfig) {
    // Set up config with defaults
    this.config = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl || 'https://untrace.dev',
      captureBody: config.captureBody !== false,
      captureErrors: config.captureErrors !== false,
      debug: config.debug || false,
      disableAutoInstrumentation: config.disableAutoInstrumentation || false,
      exportIntervalMs: config.exportIntervalMs || 5000,
      headers: config.headers || {},
      maxBatchSize: config.maxBatchSize || 512,
      providers: config.providers || ['all'],
      resourceAttributes: config.resourceAttributes || {},
      samplingRate: config.samplingRate || 1.0,
      spanProcessors: config.spanProcessors || [],
      version: config.version || '0.0.0',
    };

    // Create resource with service information (simplified like test-sdk.js)
    if (this.config.debug && !globalState.isDiagSet) {
      diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
      globalState.isDiagSet = true;
    }
    const resource = resourceFromAttributes({
      [ATTR_SERVICE_NAME]: 'untrace-app',
      [ATTR_SERVICE_VERSION]: this.config.version,
      ...this.config.resourceAttributes,
    });

    // Create exporter
    const exporter = new UntraceExporter(this.config);

    // Create batch span processor (simplified like test-sdk.js)
    const batchSpanProcessor = new BatchSpanProcessor(exporter, {
      maxExportBatchSize: this.config.maxBatchSize,
      maxQueueSize: Math.max(this.config.maxBatchSize * 2, 10), // Ensure queue is at least 2x batch size or 10
      scheduledDelayMillis: this.config.exportIntervalMs,
    });

    // Create tracer provider
    this.provider = new NodeTracerProvider({
      resource,
      spanProcessors: [batchSpanProcessor],
    });

    // Register provider
    this.provider.register();

    // Initialize components
    this.tracer = new UntraceTracer(
      this.provider.getTracer('untrace-app', this.config.version),
    );
    this.metrics = new UntraceMetricsImpl();
    this.context = new UntraceContext();

    // Auto-instrument if not disabled
    if (!this.config.disableAutoInstrumentation) {
      this.autoInstrument();
    }

    // Store instance
    globalState.instance = this;
  }

  /**
   * Auto-instrument supported providers (simplified)
   */
  private autoInstrument(): void {
    const providers = this.config.providers;
    const instrumentations: ProviderInstrumentation[] = [];

    // Default providers if not specified
    const defaultProviders = [
      'openai',
      'ai-sdk',
      'bedrock',
      // TODO: Add these as they are implemented
      // 'anthropic',
      // 'cohere',
      // 'langchain',
      // 'llamaindex',
      // 'vertex-ai',
      // 'mistral',
    ];

    const providersToInstrument = providers.includes('all')
      ? defaultProviders
      : providers.filter((p) => defaultProviders.includes(p));

    providersToInstrument.forEach((providerName) => {
      try {
        const instrumentation = getProviderInstrumentation(providerName);
        if (instrumentation) {
          instrumentation.initialize(this.config, this.tracer.getTracer());
          instrumentations.push(instrumentation);
        }
      } catch (error) {
        if (this.config.debug) {
          console.warn(
            `Failed to load instrumentation for ${providerName}:`,
            error,
          );
        }
      }
    });

    // Register all instrumentations
    if (instrumentations.length > 0) {
      // TODO: Refactor ProviderInstrumentation to extend from @opentelemetry/instrumentation's Instrumentation class
      // For now, auto-instrumentation is disabled. Use manual instrumentation via untrace.instrument() method.
      // registerInstrumentations({
      //   instrumentations: instrumentations,
      // });
      this.instrumentations = instrumentations;
    }
  }

  /**
   * Get the tracer instance
   */
  getTracer(): UntraceTracer {
    return this.tracer;
  }

  /**
   * Get the metrics instance
   */
  getMetrics(): UntraceMetricsImpl {
    return this.metrics;
  }

  /**
   * Get the context instance
   */
  getContext(): UntraceContext {
    return this.context;
  }

  /**
   * Manually instrument a provider
   */
  instrument<T>(providerName: string, module: T): T {
    const instrumentation = getProviderInstrumentation(providerName);
    if (!instrumentation) {
      throw new Error(`Unknown provider: ${providerName}`);
    }

    if (!instrumentation.canInstrument(module)) {
      throw new Error(
        `Module is not instrumentable by ${providerName} provider`,
      );
    }

    instrumentation.initialize(this.config, this.tracer.getTracer());
    return instrumentation.instrument(module);
  }

  /**
   * Flush all pending spans
   */
  async flush(): Promise<void> {
    if (this.config.debug) {
      console.log('[Untrace] Flushing spans...');
    }
    await this.provider.forceFlush();
    if (this.config.debug) {
      console.log('[Untrace] Flush completed');
    }
  }

  /**
   * Shutdown the SDK
   */
  async shutdown(): Promise<void> {
    if (this.config.debug) {
      console.log('[Untrace] Shutting down SDK...');
    }

    // Disable all instrumentations
    this.instrumentations.forEach((inst) => {
      try {
        inst.disable();
      } catch (_error) {
        // Ignore errors during shutdown
      }
    });

    // Shutdown provider
    await this.provider.shutdown();

    // Clear instance and reset singleton state
    if (globalState.instance === this) {
      globalState.instance = null;
      globalState.isInitialized = false;
    }
    globalState.isRegistered = false;

    if (this.config.debug) {
      console.log('[Untrace] SDK shutdown complete');
    }
  }

  /**
   * Get the current Untrace instance
   */
  static getInstance(): Untrace | null {
    return globalState.instance;
  }
}

/**
 * Initialize the Untrace SDK (simplified)
 */
export function init(config: UntraceConfig): Untrace {
  if (globalState.isInitialized && globalState.instance) {
    if (config.debug) {
      console.log(
        '[Untrace] SDK already initialized. Returning existing instance.',
      );
    }
    return globalState.instance;
  }

  if (globalState.isInitialized) {
    throw new Error('Untrace SDK is already initialized but instance is null.');
  }

  globalState.isInitialized = true;
  globalState.instance = new Untrace(config);
  return globalState.instance;
}

/**
 * Get the current Untrace instance
 */
export function getUntrace(): Untrace {
  if (!globalState.instance) {
    throw new Error('Untrace SDK not initialized. Call init() first.');
  }
  return globalState.instance;
}
