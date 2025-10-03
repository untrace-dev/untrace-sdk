import { z } from 'zod';
import {
	BaseIntegrationProvider,
	type ProviderConfig,
	type ProviderFactory,
	registerProvider,
	type TraceContext,
	type TraceData,
} from '../providers';
import {
	BaseDestinationTestRunner,
	registerDestinationTestRunner,
	type TestResult,
} from '../testing';

// Keywords AI provider configuration schema
const KeywordsAIConfigSchema = z.object({
	apiKey: z.string().min(1, 'API key is required'),
	enabled: z.boolean().default(true),
	endpoint: z.string().optional(),
	options: z
		.object({
			batchSize: z.number().min(1).max(1000).default(100),
			endpoint: z.string().url().default('https://api.keywords.ai/v1/events'),
			flushInterval: z.number().min(1000).max(60000).default(5000),
			headers: z.record(z.string(), z.string()).optional(),
			timeout: z.number().min(1000).max(30000).default(30000),
		})
		.optional(),
});

export class KeywordsAIProvider extends BaseIntegrationProvider {
	readonly name = 'Keywords AI';
	readonly destinationId = 'keywords-ai';

	private endpoint: string;
	private headers: Record<string, string>;
	private timeout: number;
	private batchSize: number;
	private flushInterval: number;
	private eventBuffer: Array<{
		type: 'identify' | 'track';
		data: unknown;
	}> = [];
	private flushTimer?: NodeJS.Timeout;

	constructor(config: ProviderConfig, destinationId: string) {
		super(config, destinationId);
		this.endpoint =
			(config.options?.endpoint as string) ||
			'https://api.keywords.ai/v1/events';
		this.headers = (config.options?.headers as Record<string, string>) || {};
		this.timeout = (config.options?.timeout as number) || 30000;
		this.batchSize = (config.options?.batchSize as number) || 100;
		this.flushInterval = (config.options?.flushInterval as number) || 5000;

		// Set up automatic flushing
		this.setupAutoFlush();
	}

	async sendTrace(trace: TraceData, context: TraceContext): Promise<void> {
		if (!this.config.apiKey) {
			throw new Error('Keywords AI API key is required');
		}

		// Transform trace to Keywords AI track event
		const event = this.transformTraceToKeywordsAIEvent(trace, context);
		this.addEventToBuffer('track', event);
	}

	async sendBatch(traces: TraceData[], context: TraceContext): Promise<void> {
		if (!this.config.apiKey) {
			throw new Error('Keywords AI API key is required');
		}

		// Transform traces to Keywords AI track events
		const events = traces.map((trace) =>
			this.transformTraceToKeywordsAIEvent(trace, context),
		);

		// Send all events
		for (const event of events) {
			this.addEventToBuffer('track', event);
		}
	}

	async validateConfig(
		config: ProviderConfig,
	): Promise<{ success: boolean; error?: string }> {
		try {
			KeywordsAIConfigSchema.parse(config);
			return { success: true };
		} catch (error) {
			return {
				error: error instanceof Error ? error.message : 'Invalid configuration',
				success: false,
			};
		}
	}

	getConfigSchema(): z.ZodSchema {
		return KeywordsAIConfigSchema;
	}

	private transformTraceToKeywordsAIEvent(
		trace: TraceData,
		context: TraceContext,
	) {
		// Create event name based on trace status
		const eventName = trace.status === 'error' ? 'LLM Error' : 'LLM Request';

		// Build properties
		const properties: Record<string, unknown> = {
			...trace.attributes,
			duration: trace.duration,
			is_error: trace.status === 'error',
			org_id: context.orgId,
			project_id: context.projectId,
			span_id: trace.spans?.[0]?.id,
			span_name: trace.spans?.[0]?.name || trace.name,
			status: trace.status,
			trace_id: trace.id,
			user_id: context.userId,
		};

		// Add LLM-specific properties
		if (trace.attributes?.['llm.model']) {
			properties.model = trace.attributes['llm.model'];
		}
		if (trace.attributes?.['llm.provider']) {
			properties.provider = trace.attributes['llm.provider'];
		}
		if (trace.attributes?.['llm.temperature']) {
			properties.temperature = trace.attributes['llm.temperature'];
		}
		if (trace.attributes?.['llm.input_tokens']) {
			properties.input_tokens = trace.attributes['llm.input_tokens'];
		}
		if (trace.attributes?.['llm.output_tokens']) {
			properties.output_tokens = trace.attributes['llm.output_tokens'];
		}
		if (trace.attributes?.['llm.total_cost_usd']) {
			properties.total_cost_usd = trace.attributes['llm.total_cost_usd'];
		}

		// Build context
		const eventContext: Record<string, unknown> = {
			library: 'untrace-keywords-ai',
			timestamp: new Date().toISOString(),
			version: '1.0.0',
		};

		return {
			context: eventContext,
			event: eventName,
			properties,
		};
	}

	private addEventToBuffer(type: 'identify' | 'track', data: unknown): void {
		this.eventBuffer.push({ data, type });

		// Flush if buffer is full
		if (this.eventBuffer.length >= this.batchSize) {
			this.flushEvents();
		}
	}

	private async flushEvents(): Promise<void> {
		if (this.eventBuffer.length === 0) {
			return;
		}

		const eventsToFlush = [...this.eventBuffer];
		this.eventBuffer = [];

		try {
			await this.sendEventsToKeywordsAI(eventsToFlush);
		} catch (error) {
			console.error('[KeywordsAIProvider] Failed to flush events:', error);
			// Re-add events to buffer for retry
			this.eventBuffer.unshift(...eventsToFlush);
		}
	}

	private async sendEventsToKeywordsAI(
		events: Array<{
			type: 'identify' | 'track';
			data: unknown;
		}>,
	): Promise<void> {
		// Send events in parallel
		const promises = events.map(({ type, data }) => {
			return this.sendSingleEventToKeywordsAI(type, data);
		});

		await Promise.all(promises);
	}

	private async sendSingleEventToKeywordsAI(
		type: 'identify' | 'track',
		data: unknown,
	): Promise<void> {
		const url = `${this.endpoint}/${type}`;

		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			...this.headers,
		};

		// Add authorization header
		if (this.config.apiKey) {
			headers.Authorization = `Bearer ${this.config.apiKey}`;
		}

		const response = await this.makeRequest(url, {
			body: JSON.stringify(data),
			headers,
			timeout: this.timeout,
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(
				`Keywords AI API error: ${response.status} ${response.statusText} - ${errorText}`,
			);
		}
	}

	private setupAutoFlush(): void {
		this.flushTimer = setInterval(() => {
			this.flushEvents();
		}, this.flushInterval);
	}

	async destroy(): Promise<void> {
		if (this.flushTimer) {
			clearInterval(this.flushTimer);
			this.flushTimer = undefined;
		}
		await this.flushEvents();
	}
}

// Keywords AI provider factory
export class KeywordsAIProviderFactory implements ProviderFactory {
	createProvider(
		config: ProviderConfig,
		destinationId: string,
	): KeywordsAIProvider {
		return new KeywordsAIProvider(config, destinationId);
	}

	getDestinationId(): string {
		return 'keywords-ai';
	}

	getConfigSchema(): z.ZodSchema {
		return KeywordsAIConfigSchema;
	}
}

// Keywords AI test runner
export class KeywordsAITestRunner extends BaseDestinationTestRunner {
	async testConnection(config: Record<string, unknown>): Promise<TestResult> {
		try {
			const apiKey = config.apiKey as string;
			const endpoint =
				(config.endpoint as string) || 'https://api.keywords.ai/v1/events';

			if (!apiKey) {
				return {
					details: {
						destination: this.destinationId,
						metadata: { config },
						testType: 'connection',
					},
					error: 'Missing required field: apiKey',
					message: 'API key is required for Keywords AI destinations',
					success: false,
				};
			}

			// Test connection by making a request to Keywords AI's track endpoint
			const testUrl = `${endpoint}/track`;
			const response = await fetch(testUrl, {
				body: JSON.stringify({
					context: {
						library: 'untrace-test',
						timestamp: new Date().toISOString(),
						version: '1.0.0',
					},
					event: 'test_connection',
					properties: { test: true },
				}),
				headers: {
					Authorization: `Bearer ${apiKey}`,
					'Content-Type': 'application/json',
				},
				method: 'POST',
				signal: AbortSignal.timeout(10000),
			});

			if (!response.ok) {
				return {
					details: {
						destination: this.destinationId,
						metadata: {
							config,
							status: response.status,
							statusText: response.statusText,
						},
						testType: 'connection',
					},
					error: `HTTP ${response.status}: ${response.statusText}`,
					message: `Keywords AI connection test failed: ${response.status} ${response.statusText}`,
					success: false,
				};
			}

			return {
				details: {
					destination: this.destinationId,
					metadata: {
						config,
						status: response.status,
						statusText: response.statusText,
					},
					testType: 'connection',
				},
				message: `Keywords AI connection test to ${endpoint} successful`,
				success: true,
			};
		} catch (error) {
			return {
				details: {
					destination: this.destinationId,
					metadata: { config },
					testType: 'connection',
				},
				error: error instanceof Error ? error.message : 'Unknown error',
				message: `Keywords AI connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
				success: false,
			};
		}
	}

	async testDelivery(
		config: Record<string, unknown>,
		trace: Record<string, unknown>,
	): Promise<TestResult> {
		try {
			const apiKey = config.apiKey as string;
			const endpoint =
				(config.endpoint as string) || 'https://api.keywords.ai/v1/events';

			if (!apiKey) {
				return {
					details: {
						destination: this.destinationId,
						metadata: { config, trace },
						testType: 'delivery',
					},
					error: 'Missing required field: apiKey',
					message: 'API key is required for Keywords AI destinations',
					success: false,
				};
			}

			// Test delivery by sending a sample trace
			const testUrl = `${endpoint}/track`;
			const response = await fetch(testUrl, {
				body: JSON.stringify({
					context: {
						library: 'untrace-test',
						timestamp: new Date().toISOString(),
						version: '1.0.0',
					},
					event: 'LLM Request',
					properties: {
						test: true,
						trace_id: trace.id || 'test-trace',
						...trace,
					},
				}),
				headers: {
					Authorization: `Bearer ${apiKey}`,
					'Content-Type': 'application/json',
				},
				method: 'POST',
				signal: AbortSignal.timeout(10000),
			});

			if (!response.ok) {
				return {
					details: {
						destination: this.destinationId,
						metadata: {
							config,
							status: response.status,
							statusText: response.statusText,
							trace,
						},
						testType: 'delivery',
					},
					error: `HTTP ${response.status}: ${response.statusText}`,
					message: `Keywords AI delivery test failed: ${response.status} ${response.statusText}`,
					success: false,
				};
			}

			return {
				details: {
					destination: this.destinationId,
					metadata: {
						config,
						status: response.status,
						statusText: response.statusText,
						trace,
					},
					testType: 'delivery',
				},
				message: `Keywords AI delivery test to ${endpoint} successful`,
				success: true,
			};
		} catch (error) {
			return {
				details: {
					destination: this.destinationId,
					metadata: { config, trace },
					testType: 'delivery',
				},
				error: error instanceof Error ? error.message : 'Unknown error',
				message: `Keywords AI delivery test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
				success: false,
			};
		}
	}

	async validateConfig(config: Record<string, unknown>): Promise<TestResult> {
		try {
			const apiKey = config.apiKey as string;
			const endpoint = config.endpoint as string;

			if (!apiKey) {
				return {
					details: {
						destination: this.destinationId,
						metadata: { config },
						testType: 'validation',
					},
					error: 'Missing required field: apiKey',
					message: 'API key is required for Keywords AI destinations',
					success: false,
				};
			}

			// Validate endpoint if provided
			if (endpoint) {
				try {
					new URL(endpoint);
				} catch {
					return {
						details: {
							destination: this.destinationId,
							metadata: { config },
							testType: 'validation',
						},
						error: 'Invalid endpoint format',
						message: 'Invalid endpoint format',
						success: false,
					};
				}
			}

			return {
				details: {
					destination: this.destinationId,
					metadata: { config },
					testType: 'validation',
				},
				message: 'Keywords AI destination configuration is valid',
				success: true,
			};
		} catch (error) {
			return {
				details: {
					destination: this.destinationId,
					metadata: { config },
					testType: 'validation',
				},
				error: error instanceof Error ? error.message : 'Unknown error',
				message: `Configuration validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
				success: false,
			};
		}
	}
}

// Register the Keywords AI provider and test runner
registerProvider(new KeywordsAIProviderFactory());
registerDestinationTestRunner('keywords-ai', KeywordsAITestRunner);
