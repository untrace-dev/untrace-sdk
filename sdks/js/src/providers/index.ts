import type { ProviderInstrumentation } from '../types';
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

// TODO: Add more provider instrumentations as they are implemented
// registerProviderInstrumentation('anthropic', () => new AnthropicInstrumentation());
// registerProviderInstrumentation('ai-sdk', () => new AiSdkInstrumentation());
// registerProviderInstrumentation('cohere', () => new CohereInstrumentation());
// registerProviderInstrumentation('langchain', () => new LangChainInstrumentation());
// registerProviderInstrumentation('llamaindex', () => new LlamaIndexInstrumentation());
// registerProviderInstrumentation('bedrock', () => new BedrockInstrumentation());
// registerProviderInstrumentation('vertexai', () => new VertexAIInstrumentation());
// registerProviderInstrumentation('mistral', () => new MistralInstrumentation());
