/**
 * OpenInference Semantic Conventions for LLM Observability
 * Based on OpenInference specification: https://github.com/Arize-ai/openinference
 */

/**
 * OpenInference semantic conventions for LLM operations
 * These follow the OpenTelemetry semantic conventions for generative AI
 */
export const OPENINFERENCE_SEMANTIC_CONVENTIONS = {
	// Output attributes
	LLM_CHOICES: 'llm.choices',
	LLM_COMPLETIONS: 'llm.completions',
	LLM_DURATION: 'llm.duration',

	// Error attributes
	LLM_ERROR: 'llm.error',
	LLM_ERROR_TYPE: 'llm.error.type',

	// Performance attributes
	LLM_LATENCY: 'llm.latency',
	LLM_MAX_TOKENS: 'llm.max_tokens',

	// Input attributes
	LLM_MESSAGES: 'llm.messages',
	LLM_MODEL: 'llm.model',
	// LLM Operation attributes
	LLM_OPERATION_TYPE: 'llm.operation.type',
	LLM_PROMPT: 'llm.prompt',
	LLM_PROVIDER: 'llm.provider',

	// Provider-specific attributes
	LLM_REQUEST_ID: 'llm.request.id',
	LLM_REQUEST_MODEL: 'llm.request.model',
	LLM_RESPONSE_ID: 'llm.response.id',
	LLM_RESPONSE_MODEL: 'llm.response.model',
	LLM_STREAM: 'llm.stream',
	LLM_TEMPERATURE: 'llm.temperature',
	LLM_TOP_P: 'llm.top_p',
	LLM_USAGE_COMPLETION_TOKENS: 'llm.usage.completion_tokens',
	LLM_USAGE_PROMPT_TOKENS: 'llm.usage.prompt_tokens',

	// Usage/Token attributes
	LLM_USAGE_TOTAL_TOKENS: 'llm.usage.total_tokens',
} as const;

/**
 * Provider-specific semantic conventions
 */
export const PROVIDER_SEMANTIC_CONVENTIONS = {
	// AI SDK specific
	AI_SDK: {
		ADAPTER: 'ai_sdk.adapter',
		PROVIDER: 'ai-sdk',
		VERSION: 'ai_sdk.version',
	},
	// AWS Bedrock specific
	BEDROCK: {
		GUARDRAIL: 'aws.bedrock.guardrail',
		INFERENCE_PROFILE: 'aws.bedrock.inference_profile',
		MODEL_ARN: 'aws.bedrock.model.arn',
		PROVIDER: 'aws.bedrock',
		REGION: 'aws.region',
		REQUEST_ID: 'aws.bedrock.request.id',
		TRACE: 'aws.bedrock.trace',
	},

	// OpenAI specific
	OPENAI: {
		ORGANIZATION: 'openai.organization',
		PROCESSING_MS: 'openai.processing_ms',
		PROVIDER: 'openai',
		REQUEST_ID: 'openai.request.id',
		SYSTEM_FINGERPRINT: 'openai.system_fingerprint',
	},
} as const;

/**
 * Operation types for LLM operations
 */
export const LLM_OPERATION_TYPES = {
	CHAT: 'chat',
	COMPLETION: 'completion',
	EMBEDDING: 'embedding',
	FINE_TUNING: 'fine_tuning',
	RETRIEVAL: 'retrieval',
} as const;

/**
 * Common LLM providers
 */
export const LLM_PROVIDERS = {
	AI_SDK: 'ai-sdk',
	ANTHROPIC: 'anthropic',
	AWS_BEDROCK: 'aws.bedrock',
	AZURE_OPENAI: 'azure.openai',
	COHERE: 'cohere',
	GOOGLE_VERTEX: 'google.vertex',
	HUGGING_FACE: 'huggingface',
	OPENAI: 'openai',
} as const;

/**
 * Utility type for OpenInference attributes
 */
export type OpenInferenceAttributes = {
	[K in keyof typeof OPENINFERENCE_SEMANTIC_CONVENTIONS]?:
	| string
	| number
	| boolean;
};

/**
 * Message structure for LLM conversations
 */
export interface LLMMessage {
	role: 'system' | 'user' | 'assistant' | 'function' | 'tool';
	content: string;
	name?: string;
	function_call?: {
		name: string;
		arguments: string;
	};
	tool_calls?: Array<{
		id: string;
		type: string;
		function: {
			name: string;
			arguments: string;
		};
	}>;
}

/**
 * Choice structure for LLM responses
 */
export interface LLMChoice {
	index?: number;
	message: {
		role: string;
		content: string;
		function_call?: {
			name: string;
			arguments: string;
		};
		tool_calls?: Array<{
			id: string;
			type: string;
			function: {
				name: string;
				arguments: string;
			};
		}>;
	};
	finish_reason?: string;
	logprobs?: unknown;
}

/**
 * Usage/token information for LLM operations
 */
export interface LLMUsage {
	prompt_tokens?: number;
	completion_tokens?: number;
	total_tokens?: number;
}

/**
 * Utility functions for creating OpenInference-compliant attributes
 */
export class OpenInferenceAttributeBuilder {
	private attributes: Record<string, string | number | boolean> = {};

	/**
	 * Set basic LLM operation attributes
	 */
	setOperation(type: string, provider: string, model: string): this {
		this.attributes[OPENINFERENCE_SEMANTIC_CONVENTIONS.LLM_OPERATION_TYPE] =
			type;
		this.attributes[OPENINFERENCE_SEMANTIC_CONVENTIONS.LLM_PROVIDER] = provider;
		this.attributes[OPENINFERENCE_SEMANTIC_CONVENTIONS.LLM_MODEL] = model;
		return this;
	}

	/**
	 * Set input attributes
	 */
	setInput(messages?: LLMMessage[], prompt?: string): this {
		if (messages) {
			this.attributes[OPENINFERENCE_SEMANTIC_CONVENTIONS.LLM_MESSAGES] =
				JSON.stringify(messages);
		}
		if (prompt) {
			this.attributes[OPENINFERENCE_SEMANTIC_CONVENTIONS.LLM_PROMPT] = prompt;
		}
		return this;
	}

	/**
	 * Set output attributes
	 */
	setOutput(choices?: LLMChoice[]): this {
		if (choices) {
			this.attributes[OPENINFERENCE_SEMANTIC_CONVENTIONS.LLM_CHOICES] =
				JSON.stringify(choices);
		}
		return this;
	}

	/**
	 * Set usage/token attributes
	 */
	setUsage(usage?: LLMUsage): this {
		if (usage) {
			if (usage.total_tokens !== undefined) {
				this.attributes[
					OPENINFERENCE_SEMANTIC_CONVENTIONS.LLM_USAGE_TOTAL_TOKENS
				] = usage.total_tokens;
			}
			if (usage.prompt_tokens !== undefined) {
				this.attributes[
					OPENINFERENCE_SEMANTIC_CONVENTIONS.LLM_USAGE_PROMPT_TOKENS
				] = usage.prompt_tokens;
			}
			if (usage.completion_tokens !== undefined) {
				this.attributes[
					OPENINFERENCE_SEMANTIC_CONVENTIONS.LLM_USAGE_COMPLETION_TOKENS
				] = usage.completion_tokens;
			}
		}
		return this;
	}

	/**
	 * Set configuration attributes
	 */
	setConfig(
		temperature?: number,
		maxTokens?: number,
		topP?: number,
		stream?: boolean,
	): this {
		if (temperature !== undefined) {
			this.attributes[OPENINFERENCE_SEMANTIC_CONVENTIONS.LLM_TEMPERATURE] =
				temperature;
		}
		if (maxTokens !== undefined) {
			this.attributes[OPENINFERENCE_SEMANTIC_CONVENTIONS.LLM_MAX_TOKENS] =
				maxTokens;
		}
		if (topP !== undefined) {
			this.attributes[OPENINFERENCE_SEMANTIC_CONVENTIONS.LLM_TOP_P] = topP;
		}
		if (stream !== undefined) {
			this.attributes[OPENINFERENCE_SEMANTIC_CONVENTIONS.LLM_STREAM] = stream;
		}
		return this;
	}

	/**
	 * Set error attributes
	 */
	setError(error: string, errorType?: string): this {
		this.attributes[OPENINFERENCE_SEMANTIC_CONVENTIONS.LLM_ERROR] = error;
		if (errorType) {
			this.attributes[OPENINFERENCE_SEMANTIC_CONVENTIONS.LLM_ERROR_TYPE] =
				errorType;
		}
		return this;
	}

	/**
	 * Set performance attributes
	 */
	setPerformance(duration?: number): this {
		if (duration !== undefined) {
			this.attributes[OPENINFERENCE_SEMANTIC_CONVENTIONS.LLM_DURATION] =
				duration;
			this.attributes[OPENINFERENCE_SEMANTIC_CONVENTIONS.LLM_LATENCY] =
				duration;
		}
		return this;
	}

	/**
	 * Add custom attribute
	 */
	setAttribute(key: string, value: string | number | boolean): this {
		this.attributes[key] = value;
		return this;
	}

	/**
	 * Build and return the attributes object
	 */
	build(): Record<string, string | number | boolean> {
		return { ...this.attributes };
	}
}
