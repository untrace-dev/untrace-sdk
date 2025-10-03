/**
 * LLM SDK and Provider Matrix for 2025
 *
 * This file defines the comprehensive matrix of LLM SDKs and providers
 * that we need to support for auto-instrumentation.
 */

export interface LLMProvider {
	id: string;
	name: string;
	baseUrls: string[];
	apiVersions: string[];
	supportedModels: string[];
	requestFormat: 'openai' | 'anthropic' | 'bedrock' | 'custom';
	responseFormat: 'openai' | 'anthropic' | 'bedrock' | 'custom';
	authMethod: 'api-key' | 'bearer' | 'aws-sigv4' | 'oauth';
	customHeaders?: Record<string, string>;
	metadata: {
		supportsStreaming: boolean;
		supportsFunctionCalling: boolean;
		supportsVision: boolean;
		supportsEmbeddings: boolean;
		maxTokens: number;
		rateLimits?: {
			requestsPerMinute: number;
			tokensPerMinute: number;
		};
	};
}

export interface LLMSDK {
	id: string;
	name: string;
	version: string;
	supportedProviders: string[];
	instrumentation: {
		method:
		| 'function-wrapping'
		| 'class-proxy'
		| 'http-intercept'
		| 'event-based';
		entryPoints: string[];
		metadata: {
			supportsAutoInstrumentation: boolean;
			requiresManualSetup: boolean;
			supportsCustomProviders: boolean;
		};
	};
}

/**
 * LLM Providers Matrix (2025)
 */
export const LLM_PROVIDERS: Record<string, LLMProvider> = {
	// Anthropic
	anthropic: {
		apiVersions: ['v1'],
		authMethod: 'api-key',
		baseUrls: ['https://api.anthropic.com'],
		customHeaders: {
			'anthropic-version': '2023-06-01',
		},
		id: 'anthropic',
		metadata: {
			maxTokens: 200000,
			rateLimits: {
				requestsPerMinute: 50,
				tokensPerMinute: 40000,
			},
			supportsEmbeddings: false,
			supportsFunctionCalling: true,
			supportsStreaming: true,
			supportsVision: true,
		},
		name: 'Anthropic',
		requestFormat: 'anthropic',
		responseFormat: 'anthropic',
		supportedModels: [
			'claude-3-5-sonnet-20241022',
			'claude-3-5-haiku-20241022',
			'claude-3-opus-20240229',
			'claude-3-sonnet-20240229',
			'claude-3-haiku-20240307',
		],
	},

	// AWS Bedrock
	bedrock: {
		apiVersions: ['2023-09-30'],
		authMethod: 'aws-sigv4',
		baseUrls: [
			'https://bedrock-runtime.us-east-1.amazonaws.com',
			'https://bedrock-runtime.us-west-2.amazonaws.com',
			'https://bedrock-runtime.eu-west-1.amazonaws.com',
		],
		id: 'bedrock',
		metadata: {
			maxTokens: 200000,
			rateLimits: {
				requestsPerMinute: 100,
				tokensPerMinute: 10000,
			},
			supportsEmbeddings: true,
			supportsFunctionCalling: false,
			supportsStreaming: true,
			supportsVision: false,
		},
		name: 'AWS Bedrock',
		requestFormat: 'bedrock',
		responseFormat: 'bedrock',
		supportedModels: [
			'anthropic.claude-3-5-sonnet-20241022-v2:0',
			'anthropic.claude-3-5-haiku-20241022-v1:0',
			'anthropic.claude-3-opus-20240229-v1:0',
			'anthropic.claude-3-sonnet-20240229-v1:0',
			'anthropic.claude-3-haiku-20240307-v1:0',
			'amazon.titan-text-express-v1',
			'amazon.titan-text-lite-v1',
			'meta.llama3-8b-instruct-v1:0',
			'meta.llama3-70b-instruct-v1:0',
		],
	},

	// Cohere
	cohere: {
		apiVersions: ['v1'],
		authMethod: 'bearer',
		baseUrls: ['https://api.cohere.ai'],
		id: 'cohere',
		metadata: {
			maxTokens: 128000,
			rateLimits: {
				requestsPerMinute: 100,
				tokensPerMinute: 10000,
			},
			supportsEmbeddings: true,
			supportsFunctionCalling: true,
			supportsStreaming: true,
			supportsVision: false,
		},
		name: 'Cohere',
		requestFormat: 'custom',
		responseFormat: 'custom',
		supportedModels: [
			'command-r-plus',
			'command-r',
			'command',
			'command-light',
			'embed-english-v3.0',
			'embed-multilingual-v3.0',
		],
	},

	// Google AI
	google: {
		apiVersions: ['v1beta'],
		authMethod: 'api-key',
		baseUrls: ['https://generativelanguage.googleapis.com'],
		id: 'google',
		metadata: {
			maxTokens: 1000000,
			rateLimits: {
				requestsPerMinute: 60,
				tokensPerMinute: 32000,
			},
			supportsEmbeddings: true,
			supportsFunctionCalling: true,
			supportsStreaming: true,
			supportsVision: true,
		},
		name: 'Google AI',
		requestFormat: 'custom',
		responseFormat: 'custom',
		supportedModels: [
			'gemini-1.5-pro',
			'gemini-1.5-flash',
			'gemini-pro',
			'gemini-pro-vision',
			'text-embedding-004',
			'text-multilingual-embedding-002',
		],
	},

	// Groq
	groq: {
		apiVersions: ['openai/v1'],
		authMethod: 'bearer',
		baseUrls: ['https://api.groq.com'],
		id: 'groq',
		metadata: {
			maxTokens: 32768,
			rateLimits: {
				requestsPerMinute: 30,
				tokensPerMinute: 10000,
			},
			supportsEmbeddings: false,
			supportsFunctionCalling: false,
			supportsStreaming: true,
			supportsVision: false,
		},
		name: 'Groq',
		requestFormat: 'openai',
		responseFormat: 'openai',
		supportedModels: [
			'llama3-8b-8192',
			'llama3-70b-8192',
			'mixtral-8x7b-32768',
			'gemma2-9b-it',
			'llama-3.1-70b-versatile',
		],
	},

	// Mistral AI
	mistral: {
		apiVersions: ['v1'],
		authMethod: 'bearer',
		baseUrls: ['https://api.mistral.ai'],
		id: 'mistral',
		metadata: {
			maxTokens: 32000,
			rateLimits: {
				requestsPerMinute: 100,
				tokensPerMinute: 10000,
			},
			supportsEmbeddings: false,
			supportsFunctionCalling: true,
			supportsStreaming: true,
			supportsVision: false,
		},
		name: 'Mistral AI',
		requestFormat: 'openai',
		responseFormat: 'openai',
		supportedModels: [
			'mistral-large-latest',
			'mistral-medium-latest',
			'mistral-small-latest',
			'mistral-tiny',
			'mistral-nemo',
		],
	},
	// OpenAI
	openai: {
		apiVersions: ['v1'],
		authMethod: 'bearer',
		baseUrls: ['https://api.openai.com', 'https://api.openai.com/v1'],
		customHeaders: {
			'OpenAI-Beta': 'assistants=v2',
		},
		id: 'openai',
		metadata: {
			maxTokens: 128000,
			rateLimits: {
				requestsPerMinute: 500,
				tokensPerMinute: 150000,
			},
			supportsEmbeddings: true,
			supportsFunctionCalling: true,
			supportsStreaming: true,
			supportsVision: true,
		},
		name: 'OpenAI',
		requestFormat: 'openai',
		responseFormat: 'openai',
		supportedModels: [
			'gpt-4o',
			'gpt-4o-mini',
			'gpt-4-turbo',
			'gpt-4',
			'gpt-3.5-turbo',
			'o1-preview',
			'o1-mini',
			'text-embedding-3-large',
			'text-embedding-3-small',
		],
	},

	// Together AI
	together: {
		apiVersions: ['v1'],
		authMethod: 'bearer',
		baseUrls: ['https://api.together.xyz'],
		id: 'together',
		metadata: {
			maxTokens: 128000,
			rateLimits: {
				requestsPerMinute: 100,
				tokensPerMinute: 10000,
			},
			supportsEmbeddings: true,
			supportsFunctionCalling: false,
			supportsStreaming: true,
			supportsVision: false,
		},
		name: 'Together AI',
		requestFormat: 'openai',
		responseFormat: 'openai',
		supportedModels: [
			'meta-llama/Llama-3.1-8B-Instruct-Turbo',
			'meta-llama/Llama-3.1-70B-Instruct-Turbo',
			'mistralai/Mixtral-8x7B-Instruct-v0.1',
			'Qwen/Qwen2.5-72B-Instruct',
		],
	},
};

/**
 * LLM SDKs Matrix (2025)
 */
export const LLM_SDKS: Record<string, LLMSDK> = {
	// Vercel AI SDK
	'ai-sdk': {
		id: 'ai-sdk',
		instrumentation: {
			entryPoints: [
				'generateText',
				'streamText',
				'generateObject',
				'streamObject',
			],
			metadata: {
				requiresManualSetup: false,
				supportsAutoInstrumentation: true,
				supportsCustomProviders: true,
			},
			method: 'function-wrapping',
		},
		name: 'Vercel AI SDK',
		supportedProviders: [
			'openai',
			'anthropic',
			'google',
			'bedrock',
			'cohere',
			'mistral',
			'groq',
			'together',
		],
		version: '3.x',
	},

	// Anthropic SDK
	'anthropic-sdk': {
		id: 'anthropic-sdk',
		instrumentation: {
			entryPoints: ['Anthropic', 'messages.create', 'completions.create'],
			metadata: {
				requiresManualSetup: false,
				supportsAutoInstrumentation: true,
				supportsCustomProviders: false,
			},
			method: 'class-proxy',
		},
		name: 'Anthropic SDK',
		supportedProviders: ['anthropic'],
		version: '0.30.x',
	},

	// AWS SDK
	'aws-sdk': {
		id: 'aws-sdk',
		instrumentation: {
			entryPoints: [
				'BedrockRuntime',
				'invokeModel',
				'invokeModelWithResponseStream',
			],
			metadata: {
				requiresManualSetup: false,
				supportsAutoInstrumentation: true,
				supportsCustomProviders: false,
			},
			method: 'class-proxy',
		},
		name: 'AWS SDK',
		supportedProviders: ['bedrock'],
		version: '3.x',
	},

	// Google AI SDK
	'google-ai-sdk': {
		id: 'google-ai-sdk',
		instrumentation: {
			entryPoints: [
				'GoogleGenerativeAI',
				'generateContent',
				'generateContentStream',
			],
			metadata: {
				requiresManualSetup: false,
				supportsAutoInstrumentation: true,
				supportsCustomProviders: false,
			},
			method: 'class-proxy',
		},
		name: 'Google AI SDK',
		supportedProviders: ['google'],
		version: '0.21.x',
	},

	// LangChain
	langchain: {
		id: 'langchain',
		instrumentation: {
			entryPoints: [
				'ChatOpenAI',
				'ChatAnthropic',
				'ChatGoogleGenerativeAI',
				'ChatBedrock',
			],
			metadata: {
				requiresManualSetup: false,
				supportsAutoInstrumentation: true,
				supportsCustomProviders: true,
			},
			method: 'class-proxy',
		},
		name: 'LangChain',
		supportedProviders: [
			'openai',
			'anthropic',
			'google',
			'bedrock',
			'cohere',
			'mistral',
			'groq',
			'together',
		],
		version: '0.3.x',
	},

	// LiteLLM
	litellm: {
		id: 'litellm',
		instrumentation: {
			entryPoints: ['completion', 'acompletion', 'chat.completions.create'],
			metadata: {
				requiresManualSetup: false,
				supportsAutoInstrumentation: true,
				supportsCustomProviders: true,
			},
			method: 'function-wrapping',
		},
		name: 'LiteLLM',
		supportedProviders: [
			'openai',
			'anthropic',
			'google',
			'bedrock',
			'cohere',
			'mistral',
			'groq',
			'together',
		],
		version: '1.50.x',
	},

	// LlamaIndex
	llamaindex: {
		id: 'llamaindex',
		instrumentation: {
			entryPoints: ['OpenAI', 'Anthropic', 'GoogleGenerativeAI', 'Bedrock'],
			metadata: {
				requiresManualSetup: false,
				supportsAutoInstrumentation: true,
				supportsCustomProviders: true,
			},
			method: 'class-proxy',
		},
		name: 'LlamaIndex',
		supportedProviders: [
			'openai',
			'anthropic',
			'google',
			'bedrock',
			'cohere',
			'mistral',
		],
		version: '0.12.x',
	},

	// OpenAI SDK
	'openai-sdk': {
		id: 'openai-sdk',
		instrumentation: {
			entryPoints: ['OpenAI', 'chat.completions.create', 'completions.create'],
			metadata: {
				requiresManualSetup: false,
				supportsAutoInstrumentation: true,
				supportsCustomProviders: false,
			},
			method: 'class-proxy',
		},
		name: 'OpenAI SDK',
		supportedProviders: ['openai'],
		version: '4.x',
	},
};

/**
 * Instrumentation Strategy Matrix
 *
 * This defines how we should instrument each SDK-Provider combination
 */
export interface InstrumentationStrategy {
	sdk: string;
	provider: string;
	method: 'sdk-level' | 'provider-level' | 'http-level' | 'hybrid';
	priority: number; // 1 = highest priority
	fallback?: string[];
	metadata: {
		reliability: 'high' | 'medium' | 'low';
		performance: 'high' | 'medium' | 'low';
		coverage: 'full' | 'partial' | 'basic';
	};
}

export const INSTRUMENTATION_STRATEGIES: InstrumentationStrategy[] = [
	// High-priority SDK-level instrumentation
	{
		metadata: {
			coverage: 'full',
			performance: 'high',
			reliability: 'high',
		},
		method: 'sdk-level',
		priority: 1,
		provider: 'openai',
		sdk: 'ai-sdk',
	},
	{
		metadata: {
			coverage: 'full',
			performance: 'high',
			reliability: 'high',
		},
		method: 'sdk-level',
		priority: 1,
		provider: 'anthropic',
		sdk: 'ai-sdk',
	},
	{
		metadata: {
			coverage: 'full',
			performance: 'high',
			reliability: 'high',
		},
		method: 'sdk-level',
		priority: 1,
		provider: 'bedrock',
		sdk: 'ai-sdk',
	},

	// LangChain instrumentation
	{
		metadata: {
			coverage: 'full',
			performance: 'high',
			reliability: 'high',
		},
		method: 'sdk-level',
		priority: 2,
		provider: 'openai',
		sdk: 'langchain',
	},
	{
		metadata: {
			coverage: 'full',
			performance: 'high',
			reliability: 'high',
		},
		method: 'sdk-level',
		priority: 2,
		provider: 'anthropic',
		sdk: 'langchain',
	},

	// Provider-level instrumentation for direct SDKs
	{
		metadata: {
			coverage: 'full',
			performance: 'high',
			reliability: 'high',
		},
		method: 'provider-level',
		priority: 3,
		provider: 'openai',
		sdk: 'openai-sdk',
	},
	{
		metadata: {
			coverage: 'full',
			performance: 'high',
			reliability: 'high',
		},
		method: 'provider-level',
		priority: 3,
		provider: 'anthropic',
		sdk: 'anthropic-sdk',
	},

	// HTTP-level fallback for custom implementations
	{
		fallback: ['sdk-level', 'provider-level'],
		metadata: {
			coverage: 'partial',
			performance: 'medium',
			reliability: 'medium',
		},
		method: 'http-level',
		priority: 4,
		provider: 'openai',
		sdk: 'custom',
	},
	{
		fallback: ['sdk-level', 'provider-level'],
		metadata: {
			coverage: 'partial',
			performance: 'medium',
			reliability: 'medium',
		},
		method: 'http-level',
		priority: 4,
		provider: 'anthropic',
		sdk: 'custom',
	},

	// Hybrid approach for complex scenarios
	{
		metadata: {
			coverage: 'full',
			performance: 'high',
			reliability: 'high',
		},
		method: 'hybrid',
		priority: 2,
		provider: 'openai',
		sdk: 'litellm',
	},
];

/**
 * Get the best instrumentation strategy for a given SDK-Provider combination
 */
export function getInstrumentationStrategy(
	sdk: string,
	provider: string,
): InstrumentationStrategy | null {
	// First, try to find an exact match
	const exactMatch = INSTRUMENTATION_STRATEGIES.find(
		(strategy) => strategy.sdk === sdk && strategy.provider === provider,
	);

	if (exactMatch) {
		return exactMatch;
	}

	// If no exact match, try to find a fallback strategy
	const fallbackStrategy = INSTRUMENTATION_STRATEGIES.find(
		(strategy) => strategy.sdk === 'custom' && strategy.provider === provider,
	);

	if (fallbackStrategy) {
		return fallbackStrategy;
	}

	// If still no match, return null (no instrumentation available)
	return null;
}

/**
 * Get all supported SDK-Provider combinations
 */
export function getSupportedCombinations(): Array<{
	sdk: string;
	provider: string;
	strategy: InstrumentationStrategy;
}> {
	const combinations: Array<{
		sdk: string;
		provider: string;
		strategy: InstrumentationStrategy;
	}> = [];

	for (const [sdkId, sdk] of Object.entries(LLM_SDKS)) {
		for (const providerId of sdk.supportedProviders) {
			const strategy = getInstrumentationStrategy(sdkId, providerId);
			if (strategy) {
				combinations.push({
					provider: providerId,
					sdk: sdkId,
					strategy,
				});
			}
		}
	}

	return combinations.sort((a, b) => a.strategy.priority - b.strategy.priority);
}

/**
 * Check if a combination is supported
 */
export function isCombinationSupported(sdk: string, provider: string): boolean {
	return getInstrumentationStrategy(sdk, provider) !== null;
}

