import type { ProviderInstrumentation } from '../types';
import { AISDKInstrumentation } from './ai-sdk';
import { BedrockInstrumentation } from './bedrock';
import { OpenAIInstrumentation } from './openai';

// Provider instrumentation map
const providerMap = new Map<string, () => ProviderInstrumentation>();

/**
 * Register a provider instrumentation
 */
export function registerProviderInstrumentation(
  name: string,
  factory: () => ProviderInstrumentation,
): void {
  providerMap.set(name, factory);
}

/**
 * Get provider instrumentation by name
 */
export function getProviderInstrumentation(
  name: string,
): ProviderInstrumentation | null {
  const factory = providerMap.get(name);
  if (!factory) {
    return null;
  }
  return factory();
}

/**
 * Get all available provider names
 */
export function getAvailableProviders(): string[] {
  return Array.from(providerMap.keys());
}

// Register built-in provider instrumentations
registerProviderInstrumentation('openai', () => new OpenAIInstrumentation());
registerProviderInstrumentation('bedrock', () => new BedrockInstrumentation());

// Register SDK instrumentations (these wrap multiple providers)
registerProviderInstrumentation('ai-sdk', () => new AISDKInstrumentation());

// TODO: Add more provider instrumentations as they are implemented
// registerProviderInstrumentation('anthropic', () => new AnthropicInstrumentation());
// registerProviderInstrumentation('cohere', () => new CohereInstrumentation());
// registerProviderInstrumentation('langchain', () => new LangChainInstrumentation());
// registerProviderInstrumentation('llamaindex', () => new LlamaIndexInstrumentation());
// registerProviderInstrumentation('vertex-ai', () => new VertexAIInstrumentation());
// registerProviderInstrumentation('mistral', () => new MistralInstrumentation());
