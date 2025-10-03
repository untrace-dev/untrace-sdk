/**
 * LLM Instrumentation Manager
 *
 * This class manages the comprehensive auto-instrumentation of LLM SDKs and providers
 * based on the matrix defined in llm-matrix.ts
 */

import type { InstrumentationConfig } from '@opentelemetry/instrumentation';
import { OpenInferenceAttributeBuilder } from '../semantic-conventions';
import {
	getInstrumentationStrategy,
	getSupportedCombinations,
	type InstrumentationStrategy,
	LLM_SDKS,
} from './llm-matrix';

/**
 * Base class for all LLM instrumentations
 */
export abstract class BaseLLMInstrumentation {
	protected config: InstrumentationConfig;
	protected attributeBuilder: OpenInferenceAttributeBuilder;

	constructor(config: InstrumentationConfig = { enabled: true }) {
		this.config = config;
		this.attributeBuilder = new OpenInferenceAttributeBuilder();
	}

	abstract enable(): void;
	abstract disable(): void;
	abstract isEnabled(): boolean;
}

/**
 * SDK-level instrumentation (wraps SDK functions)
 */
export class SDKLevelInstrumentation extends BaseLLMInstrumentation {
	private sdk: string;
	private provider: string;
	private originalFunctions: Map<string, unknown> = new Map();

	constructor(
		sdk: string,
		provider: string,
		config: InstrumentationConfig = { enabled: true },
	) {
		super(config);
		this.sdk = sdk;
		this.provider = provider;
	}

	enable(): void {
		if (this.isEnabled()) return;

		const sdkConfig = LLM_SDKS[this.sdk];
		if (!sdkConfig) {
			console.warn(`[Untrace] Unknown SDK: ${this.sdk}`);
			return;
		}

		// Import and instrument the SDK
		this.importAndInstrumentSDK(sdkConfig);
	}

	disable(): void {
		// Restore original functions
		for (const [name, original] of this.originalFunctions) {
			// Implementation depends on the specific SDK
			this.restoreOriginalFunction(name, original);
		}
		this.originalFunctions.clear();
	}

	isEnabled(): boolean {
		return this.originalFunctions.size > 0;
	}

	private async importAndInstrumentSDK(_sdkConfig: unknown): Promise<void> {
		try {
			switch (this.sdk) {
				case 'ai-sdk':
					await this.instrumentAISDK();
					break;
				case 'langchain':
					await this.instrumentLangChain();
					break;
				case 'llamaindex':
					await this.instrumentLlamaIndex();
					break;
				case 'litellm':
					await this.instrumentLiteLLM();
					break;
				default:
					console.warn(
						`[Untrace] SDK-level instrumentation not implemented for: ${this.sdk}`,
					);
			}
		} catch (error) {
			console.error(`[Untrace] Failed to instrument ${this.sdk}:`, error);
		}
	}

	private async instrumentAISDK(): Promise<void> {
		// Dynamic import to avoid issues in browser environments
		const aiModule = await import('ai');

		// Wrap generateText
		if (aiModule.generateText && typeof aiModule.generateText === 'function') {
			const original = aiModule.generateText;
			this.originalFunctions.set('generateText', original);

			(aiModule as Record<string, unknown>).generateText =
				this.wrapGenerateText(original);
		}

		// Wrap streamText
		if (aiModule.streamText && typeof aiModule.streamText === 'function') {
			const original = aiModule.streamText;
			this.originalFunctions.set('streamText', original);

			(aiModule as Record<string, unknown>).streamText =
				this.wrapStreamText(original);
		}
	}

	private async instrumentLangChain(): Promise<void> {
		// LangChain instrumentation would go here
		console.log('[Untrace] LangChain instrumentation not yet implemented');
	}

	private async instrumentLlamaIndex(): Promise<void> {
		// LlamaIndex instrumentation would go here
		console.log('[Untrace] LlamaIndex instrumentation not yet implemented');
	}

	private async instrumentLiteLLM(): Promise<void> {
		// LiteLLM instrumentation would go here
		console.log('[Untrace] LiteLLM instrumentation not yet implemented');
	}

	private wrapGenerateText(original: unknown): unknown {
		return async (...args: unknown[]) => {
			const startTime = Date.now();

			try {
				const result = await (
					original as (...args: unknown[]) => Promise<unknown>
				)(...args);
				const duration = Date.now() - startTime;

				// Extract attributes from result
				this.attributeBuilder
					.setOperation('chat', this.provider, 'unknown')
					.setPerformance(duration);

				// TODO: Extract more attributes from the result
				console.log('[Untrace] AI SDK generateText instrumented');

				return result;
			} catch (error) {
				const duration = Date.now() - startTime;
				this.attributeBuilder
					.setError(error instanceof Error ? error.message : 'Unknown error')
					.setPerformance(duration);
				throw error;
			}
		};
	}

	private wrapStreamText(original: unknown): unknown {
		return async (...args: unknown[]) => {
			const startTime = Date.now();

			try {
				const result = await (
					original as (...args: unknown[]) => Promise<unknown>
				)(...args);
				const duration = Date.now() - startTime;

				// Extract attributes from result
				this.attributeBuilder
					.setOperation('chat', this.provider, 'unknown')
					.setPerformance(duration);

				// TODO: Extract more attributes from the result
				console.log('[Untrace] AI SDK streamText instrumented');

				return result;
			} catch (error) {
				const duration = Date.now() - startTime;
				this.attributeBuilder
					.setError(error instanceof Error ? error.message : 'Unknown error')
					.setPerformance(duration);
				throw error;
			}
		};
	}

	private restoreOriginalFunction(_name: string, _original: unknown): void {
		// Implementation depends on the specific SDK
		console.log(`[Untrace] Restoring original function: ${_name}`);
	}
}

/**
 * Provider-level instrumentation (wraps provider SDKs)
 */
export class ProviderLevelInstrumentation extends BaseLLMInstrumentation {
	private provider: string;

	constructor(
		provider: string,
		config: InstrumentationConfig = { enabled: true },
	) {
		super(config);
		this.provider = provider;
	}

	enable(): void {
		if (this.isEnabled()) return;

		switch (this.provider) {
			case 'openai':
				this.instrumentOpenAI();
				break;
			case 'anthropic':
				this.instrumentAnthropic();
				break;
			case 'bedrock':
				this.instrumentBedrock();
				break;
			default:
				console.warn(
					`[Untrace] Provider-level instrumentation not implemented for: ${this.provider}`,
				);
		}
	}

	disable(): void {
		// Implementation depends on the specific provider
		console.log(
			`[Untrace] Disabling provider-level instrumentation for: ${this.provider}`,
		);
	}

	isEnabled(): boolean {
		// Implementation depends on the specific provider
		return false;
	}

	private instrumentOpenAI(): void {
		// OpenAI instrumentation would go here
		console.log(
			'[Untrace] OpenAI provider-level instrumentation not yet implemented',
		);
	}

	private instrumentAnthropic(): void {
		// Anthropic instrumentation would go here
		console.log(
			'[Untrace] Anthropic provider-level instrumentation not yet implemented',
		);
	}

	private instrumentBedrock(): void {
		// Bedrock instrumentation would go here
		console.log(
			'[Untrace] Bedrock provider-level instrumentation not yet implemented',
		);
	}
}

/**
 * HTTP-level instrumentation (intercepts HTTP requests)
 */
export class HTTPLevelInstrumentation extends BaseLLMInstrumentation {
	private httpInstrumentation: unknown;

	constructor(config: InstrumentationConfig = { enabled: true }) {
		super(config);
	}

	async enable(): Promise<void> {
		if (this.isEnabled()) return;

		try {
			// Import HTTP instrumentation dynamically
			const { HTTPLLMInstrumentation } = await import('../providers/http');
			this.httpInstrumentation = new HTTPLLMInstrumentation(this.config);
			(this.httpInstrumentation as { enable(): void }).enable();
		} catch (error) {
			console.error('[Untrace] Failed to enable HTTP instrumentation:', error);
		}
	}

	disable(): void {
		if (this.httpInstrumentation) {
			(this.httpInstrumentation as { disable(): void }).disable();
			this.httpInstrumentation = null;
		}
	}

	isEnabled(): boolean {
		return this.httpInstrumentation !== null;
	}
}

/**
 * Main LLM Instrumentation Manager
 */
export class LLMInstrumentationManager {
	private instrumentations: Map<string, BaseLLMInstrumentation> = new Map();
	private config: InstrumentationConfig;

	constructor(config: InstrumentationConfig = { enabled: true }) {
		this.config = config;
	}

	/**
	 * Enable instrumentation for a specific SDK-Provider combination
	 */
	async enableInstrumentation(sdk: string, provider: string): Promise<boolean> {
		const strategy = getInstrumentationStrategy(sdk, provider);
		if (!strategy) {
			console.warn(
				`[Untrace] No instrumentation strategy found for ${sdk} + ${provider}`,
			);
			return false;
		}

		const key = `${sdk}:${provider}`;

		try {
			let instrumentation: BaseLLMInstrumentation;

			switch (strategy.method) {
				case 'sdk-level':
					instrumentation = new SDKLevelInstrumentation(
						sdk,
						provider,
						this.config,
					);
					break;
				case 'provider-level':
					instrumentation = new ProviderLevelInstrumentation(
						provider,
						this.config,
					);
					break;
				case 'http-level':
					instrumentation = new HTTPLevelInstrumentation(this.config);
					break;
				case 'hybrid':
					// For hybrid, we'll use SDK-level as primary with HTTP as fallback
					instrumentation = new SDKLevelInstrumentation(
						sdk,
						provider,
						this.config,
					);
					break;
				default:
					console.warn(
						`[Untrace] Unknown instrumentation method: ${strategy.method}`,
					);
					return false;
			}

			await instrumentation.enable();
			this.instrumentations.set(key, instrumentation);

			console.log(
				`[Untrace] Enabled ${strategy.method} instrumentation for ${sdk} + ${provider}`,
			);
			return true;
		} catch (error) {
			console.error(
				`[Untrace] Failed to enable instrumentation for ${sdk} + ${provider}:`,
				error,
			);
			return false;
		}
	}

	/**
	 * Enable instrumentation for all supported combinations
	 */
	async enableAllInstrumentations(): Promise<void> {
		const combinations = getSupportedCombinations();

		for (const { sdk, provider, strategy } of combinations) {
			if (strategy.priority <= 2) {
				// Only enable high-priority instrumentations by default
				await this.enableInstrumentation(sdk, provider);
			}
		}
	}

	/**
	 * Disable instrumentation for a specific SDK-Provider combination
	 */
	disableInstrumentation(sdk: string, provider: string): void {
		const key = `${sdk}:${provider}`;
		const instrumentation = this.instrumentations.get(key);

		if (instrumentation) {
			instrumentation.disable();
			this.instrumentations.delete(key);
			console.log(
				`[Untrace] Disabled instrumentation for ${sdk} + ${provider}`,
			);
		}
	}

	/**
	 * Disable all instrumentations
	 */
	disableAllInstrumentations(): void {
		for (const [, instrumentation] of this.instrumentations) {
			instrumentation.disable();
		}
		this.instrumentations.clear();
		console.log('[Untrace] Disabled all LLM instrumentations');
	}

	/**
	 * Get status of all instrumentations
	 */
	getInstrumentationStatus(): Record<string, boolean> {
		const status: Record<string, boolean> = {};

		for (const [key, instrumentation] of this.instrumentations) {
			status[key] = instrumentation.isEnabled();
		}

		return status;
	}

	/**
	 * Get supported combinations
	 */
	getSupportedCombinations(): Array<{
		sdk: string;
		provider: string;
		strategy: InstrumentationStrategy;
	}> {
		return getSupportedCombinations();
	}

	/**
	 * Check if a combination is supported
	 */
	isCombinationSupported(sdk: string, provider: string): boolean {
		return getInstrumentationStrategy(sdk, provider) !== null;
	}
}
