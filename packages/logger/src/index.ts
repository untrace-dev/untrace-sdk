import { UntraceLogger } from './logger';

// Create and export a default logger instance
export const defaultLogger = new UntraceLogger({
  defaultNamespace: 'untrace',
});

// Export a debug function that uses the default logger
export const debug = (namespace: string) => defaultLogger.debug(namespace);

// Export everything else
export { UntraceLogger };
export type { LoggerProps } from './logger';

// Enable debug namespaces based on environment variable (similar to debug package)
if (typeof process !== 'undefined' && process.env.DEBUG) {
  for (const namespace of process.env.DEBUG.split(',')) {
    defaultLogger.enableNamespace(namespace.trim());
  }
}

export * from './logger';
export * from './types';
