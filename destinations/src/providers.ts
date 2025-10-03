import { z } from 'zod';

// Provider configuration schema
export const ProviderConfigSchema = z.object({
	apiKey: z.string().optional(),
	enabled: z.boolean().default(true),
	endpoint: z.string().optional(),
	options: z.record(z.string(), z.unknown()).optional(),
});

export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;

// Trace context schema
export const TraceContextSchema = z.object({
	apiKeyId: z.string().optional(),
	orgId: z.string(),
	projectId: z.string(),
	userId: z.string().optional(),
});

export type TraceContext = z.infer<typeof TraceContextSchema>;

// Trace data schema
export const TraceDataSchema = z.object({
	attributes: z.record(z.string(), z.unknown()).optional(),
	duration: z.number().optional(),
	events: z
		.array(
			z.object({
				attributes: z.record(z.string(), z.unknown()).optional(),
				name: z.string(),
				timestamp: z.string(),
			}),
		)
		.optional(),
	id: z.string(),
	name: z.string().optional(),
	spans: z
		.array(
			z.object({
				attributes: z.record(z.string(), z.unknown()).optional(),
				duration: z.number().optional(),
				id: z.string(),
				name: z.string(),
				status: z.string().optional(),
				timestamp: z.string(),
			}),
		)
		.optional(),
	status: z.string().optional(),
	timestamp: z.string(),
});

export type TraceData = z.infer<typeof TraceDataSchema>;

// Integration provider interface
export interface IntegrationProvider {
	readonly name: string;
	readonly destinationId: string;

	/**
	 * Check if the provider is enabled
	 */
	isEnabled(): boolean;

	/**
	 * Send a single trace to the destination
	 */
	sendTrace(trace: TraceData, context: TraceContext): Promise<void>;

	/**
	 * Send multiple traces in a batch (if supported)
	 */
	sendBatch?(traces: TraceData[], context: TraceContext): Promise<void>;

	/**
	 * Validate the provider configuration
	 */
	validateConfig(
		config: ProviderConfig,
	): Promise<{ success: boolean; error?: string }>;

	/**
	 * Get provider-specific configuration requirements
	 */
	getConfigSchema(): z.ZodSchema;
}

// Provider factory interface
export interface ProviderFactory {
	createProvider(
		config: ProviderConfig,
		destinationId: string,
	): IntegrationProvider;
	getDestinationId(): string;
	getConfigSchema(): z.ZodSchema;
}

// Registry for integration providers
const providerRegistry = new Map<string, ProviderFactory>();

export function registerProvider(factory: ProviderFactory): void {
	providerRegistry.set(factory.getDestinationId(), factory);
}

export function getProviderFactory(
	destinationId: string,
): ProviderFactory | null {
	return providerRegistry.get(destinationId) || null;
}

export function getRegisteredProviders(): string[] {
	return Array.from(providerRegistry.keys());
}

export function createProvider(
	destinationId: string,
	config: ProviderConfig,
	destinationIdParam: string,
): IntegrationProvider | null {
	const factory = getProviderFactory(destinationId);
	if (!factory) {
		return null;
	}
	return factory.createProvider(config, destinationIdParam);
}

// Base provider class for common functionality
export abstract class BaseIntegrationProvider implements IntegrationProvider {
	abstract readonly name: string;
	abstract readonly destinationId: string;

	constructor(
		protected config: ProviderConfig,
		protected destinationIdParam: string,
	) { }

	isEnabled(): boolean {
		return this.config.enabled;
	}

	abstract sendTrace(trace: TraceData, context: TraceContext): Promise<void>;

	sendBatch?(traces: TraceData[], context: TraceContext): Promise<void>;

	abstract validateConfig(
		config: ProviderConfig,
	): Promise<{ success: boolean; error?: string }>;

	abstract getConfigSchema(): z.ZodSchema;

	protected async makeRequest(
		url: string,
		options: {
			method?: string;
			headers?: Record<string, string>;
			body?: string;
			timeout?: number;
		} = {},
	): Promise<Response> {
		const { method = 'POST', headers = {}, body, timeout = 10000 } = options;

		const controller = new AbortController();
		// biome-ignore lint/suspicious/noExplicitAny: ignore
		const timeoutId = setTimeout(() => (controller as any).abort(), timeout);

		try {
			const response = await fetch(url, {
				body,
				headers: {
					'Content-Type': 'application/json',
					'User-Agent': 'Untrace-Integration/1.0',
					...headers,
				},
				method,
				// biome-ignore lint/suspicious/noExplicitAny: ignore
				signal: (controller as any).signal,
			});

			clearTimeout(timeoutId);
			return response;
		} catch (error) {
			clearTimeout(timeoutId);
			throw error;
		}
	}
}
