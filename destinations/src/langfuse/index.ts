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

// Langfuse provider configuration schema
const LangfuseConfigSchema = z.object({
	apiKey: z.string().min(1, 'API key is required'),
	enabled: z.boolean().default(true),
	endpoint: z.string().optional(),
	options: z
		.object({
			baseUrl: z.string().url().default('https://us.cloud.langfuse.com'),
			publicKey: z.string().optional(),
			secretKey: z.string().optional(),
		})
		.optional(),
});

export class LangfuseProvider extends BaseIntegrationProvider {
	readonly name = 'Langfuse';
	readonly destinationId = 'langfuse';

	private endpoint: string;
	private authString: string;

	constructor(config: ProviderConfig, destinationId: string) {
		super(config, destinationId);
		this.endpoint = this.buildEndpoint();
		this.authString = this.buildAuthString();
	}

	private buildEndpoint(): string {
		if (this.config.endpoint) {
			return this.config.endpoint;
		}

		const baseUrl =
			(this.config.options?.baseUrl as string) ||
			'https://us.cloud.langfuse.com';
		return `${baseUrl}/api/public/otel/v1/traces`;
	}

	private buildAuthString(): string {
		const apiKey = this.config.apiKey;
		if (!apiKey) {
			throw new Error('Langfuse API key is required');
		}

		if (apiKey.includes(':')) {
			// Already in correct format (publicKey:secretKey)
			return Buffer.from(apiKey).toString('base64');
		}
		// Assume it's a single key, create dummy secret key
		return Buffer.from(`${apiKey}:sk-lf-dummy`).toString('base64');
	}

	async sendTrace(trace: TraceData, context: TraceContext): Promise<void> {
		if (!this.config.apiKey) {
			throw new Error('Langfuse API key is required');
		}

		// Transform trace to Langfuse OTLP format
		const otlpPayload = this.transformTraceToOTLP(trace, context);

		const response = await this.makeRequest(this.endpoint, {
			body: JSON.stringify(otlpPayload),
			headers: {
				Authorization: `Basic ${this.authString}`,
				'Content-Type': 'application/json',
			},
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(
				`Langfuse API error: ${response.status} ${response.statusText} - ${errorText}`,
			);
		}
	}

	async sendBatch(traces: TraceData[], context: TraceContext): Promise<void> {
		if (!this.config.apiKey) {
			throw new Error('Langfuse API key is required');
		}

		// Transform traces to OTLP format
		const otlpPayload = this.transformTracesToOTLP(traces, context);

		const response = await this.makeRequest(this.endpoint, {
			body: JSON.stringify(otlpPayload),
			headers: {
				Authorization: `Basic ${this.authString}`,
				'Content-Type': 'application/json',
			},
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(
				`Langfuse batch API error: ${response.status} ${response.statusText} - ${errorText}`,
			);
		}
	}

	async validateConfig(
		config: ProviderConfig,
	): Promise<{ success: boolean; error?: string }> {
		try {
			LangfuseConfigSchema.parse(config);
			return { success: true };
		} catch (error) {
			return {
				error: error instanceof Error ? error.message : 'Invalid configuration',
				success: false,
			};
		}
	}

	getConfigSchema(): z.ZodSchema {
		return LangfuseConfigSchema;
	}

	private transformTraceToOTLP(trace: TraceData, context: TraceContext) {
		const now = Date.now();
		const nowNano = now * 1000000; // Convert to nanoseconds

		// Create span attributes following Langfuse conventions
		const attributes: Array<{
			key: string;
			value: {
				stringValue?: string;
				boolValue?: boolean;
				intValue?: number;
				doubleValue?: number;
			};
		}> = [];

		// Add trace-level attributes
		if (context.userId) {
			attributes.push({
				key: 'langfuse.user.id',
				value: { stringValue: context.userId },
			});
		}

		if (trace.attributes) {
			Object.entries(trace.attributes).forEach(([key, value]) => {
				if (typeof value === 'string') {
					attributes.push({
						key: `langfuse.trace.metadata.${key}`,
						value: { stringValue: value },
					});
				} else if (typeof value === 'number') {
					attributes.push({
						key: `langfuse.trace.metadata.${key}`,
						value: { doubleValue: value },
					});
				} else if (typeof value === 'boolean') {
					attributes.push({
						key: `langfuse.trace.metadata.${key}`,
						value: { boolValue: value },
					});
				}
			});
		}

		// Add LLM-specific attributes from trace attributes
		if (trace.attributes?.['llm.model']) {
			attributes.push({
				key: 'langfuse.observation.model.name',
				value: { stringValue: trace.attributes['llm.model'] as string },
			});
		}

		if (trace.attributes?.['llm.provider']) {
			attributes.push({
				key: 'langfuse.observation.provider',
				value: { stringValue: trace.attributes['llm.provider'] as string },
			});
		}

		// Set observation type
		attributes.push({
			key: 'langfuse.observation.type',
			value: { stringValue: 'generation' },
		});

		// Set status
		const status = trace.status === 'error' ? 1 : 0; // 0 = OK, 1 = ERROR
		const statusMessage = trace.status === 'error' ? 'Trace failed' : undefined;

		const span = {
			attributes,
			endTimeUnixNano: nowNano.toString(),
			events:
				trace.events?.map((event) => ({
					attributes: Object.entries(event.attributes || {}).map(
						([key, value]) => ({
							key,
							value:
								typeof value === 'string'
									? { stringValue: value }
									: typeof value === 'number'
										? { doubleValue: value }
										: typeof value === 'boolean'
											? { boolValue: value }
											: { stringValue: String(value) },
						}),
					),
					name: event.name,
					timeUnixNano: new Date(event.timestamp).getTime() * 1000000,
				})) || [],
			kind: 1, // SPAN_KIND_INTERNAL
			links: [],
			name: trace.name || 'llm_generation',
			parentSpanId: '',
			spanId: trace.spans?.[0]?.id || this.generateSpanId(),
			startTimeUnixNano: (nowNano - (trace.duration || 0) * 1000000).toString(),
			status: {
				code: status,
				message: statusMessage,
			},
			traceId: trace.id,
		};

		return {
			resourceSpans: [
				{
					resource: {
						attributes: [
							{
								key: 'service.name',
								value: { stringValue: 'untrace' },
							},
							{
								key: 'service.version',
								value: { stringValue: '1.0.0' },
							},
						],
					},
					scopeSpans: [
						{
							scope: {
								name: 'untrace-langfuse',
								version: '1.0.0',
							},
							spans: [span],
						},
					],
				},
			],
		};
	}

	private transformTracesToOTLP(traces: TraceData[], context: TraceContext) {
		const spans = traces
			.map((trace) => {
				const otlp = this.transformTraceToOTLP(trace, context);
				return otlp.resourceSpans?.[0]?.scopeSpans?.[0]?.spans?.[0];
			})
			.filter(Boolean);

		return {
			resourceSpans: [
				{
					resource: {
						attributes: [
							{
								key: 'service.name',
								value: { stringValue: 'untrace' },
							},
							{
								key: 'service.version',
								value: { stringValue: '1.0.0' },
							},
						],
					},
					scopeSpans: [
						{
							scope: {
								name: 'untrace-langfuse',
								version: '1.0.0',
							},
							spans,
						},
					],
				},
			],
		};
	}

	private generateSpanId(): string {
		return (
			Math.random().toString(36).substring(2, 15) +
			Math.random().toString(36).substring(2, 15)
		);
	}
}

// Langfuse provider factory
export class LangfuseProviderFactory implements ProviderFactory {
	createProvider(
		config: ProviderConfig,
		destinationId: string,
	): LangfuseProvider {
		return new LangfuseProvider(config, destinationId);
	}

	getDestinationId(): string {
		return 'langfuse';
	}

	getConfigSchema(): z.ZodSchema {
		return LangfuseConfigSchema;
	}
}

// Langfuse test runner
export class LangfuseTestRunner extends BaseDestinationTestRunner {
	async testConnection(config: Record<string, unknown>): Promise<TestResult> {
		try {
			const apiKey = config.apiKey as string;
			const baseUrl =
				(config.baseUrl as string) || 'https://us.cloud.langfuse.com';

			if (!apiKey) {
				return {
					details: {
						destination: this.destinationId,
						metadata: { config },
						testType: 'connection',
					},
					error: 'Missing required field: apiKey',
					message: 'API key is required for Langfuse destinations',
					success: false,
				};
			}

			// Test connection by making a request to Langfuse's OTLP endpoint
			const testEndpoint = `${baseUrl}/api/public/otel/v1/traces`;
			const authString = apiKey.includes(':')
				? Buffer.from(apiKey).toString('base64')
				: Buffer.from(`${apiKey}:sk-lf-dummy`).toString('base64');

			const response = await fetch(testEndpoint, {
				body: JSON.stringify({
					resourceSpans: [
						{
							resource: { attributes: [] },
							scopeSpans: [
								{
									scope: { name: 'test', version: '1.0.0' },
									spans: [
										{
											attributes: [],
											endTimeUnixNano: Date.now().toString(),
											events: [],
											kind: 1,
											links: [],
											name: 'test_connection',
											spanId: 'test-span',
											startTimeUnixNano: Date.now().toString(),
											status: { code: 0 },
											traceId: 'test-trace',
										},
									],
								},
							],
						},
					],
				}),
				headers: {
					Authorization: `Basic ${authString}`,
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
					message: `Langfuse connection test failed: ${response.status} ${response.statusText}`,
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
				message: `Langfuse connection test to ${baseUrl} successful`,
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
				message: `Langfuse connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
			const baseUrl =
				(config.baseUrl as string) || 'https://us.cloud.langfuse.com';

			if (!apiKey) {
				return {
					details: {
						destination: this.destinationId,
						metadata: { config, trace },
						testType: 'delivery',
					},
					error: 'Missing required field: apiKey',
					message: 'API key is required for Langfuse destinations',
					success: false,
				};
			}

			// Test delivery by sending a sample trace
			const testEndpoint = `${baseUrl}/api/public/otel/v1/traces`;
			const authString = apiKey.includes(':')
				? Buffer.from(apiKey).toString('base64')
				: Buffer.from(`${apiKey}:sk-lf-dummy`).toString('base64');

			const response = await fetch(testEndpoint, {
				body: JSON.stringify({
					resourceSpans: [
						{
							resource: {
								attributes: [
									{
										key: 'service.name',
										value: { stringValue: 'untrace-test' },
									},
								],
							},
							scopeSpans: [
								{
									scope: { name: 'untrace-test', version: '1.0.0' },
									spans: [
										{
											attributes: [
												{
													key: 'langfuse.observation.type',
													value: { stringValue: 'generation' },
												},
												{ key: 'langfuse.test', value: { boolValue: true } },
											],
											endTimeUnixNano: Date.now().toString(),
											events: [],
											kind: 1,
											links: [],
											name: 'test_delivery',
											spanId: trace.id || 'test-span',
											startTimeUnixNano: Date.now().toString(),
											status: { code: 0 },
											traceId: trace.id || 'test-trace',
										},
									],
								},
							],
						},
					],
				}),
				headers: {
					Authorization: `Basic ${authString}`,
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
					message: `Langfuse delivery test failed: ${response.status} ${response.statusText}`,
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
				message: `Langfuse delivery test to ${baseUrl} successful`,
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
				message: `Langfuse delivery test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
				success: false,
			};
		}
	}

	async validateConfig(config: Record<string, unknown>): Promise<TestResult> {
		try {
			const apiKey = config.apiKey as string;
			const baseUrl = config.baseUrl as string;

			if (!apiKey) {
				return {
					details: {
						destination: this.destinationId,
						metadata: { config },
						testType: 'validation',
					},
					error: 'Missing required field: apiKey',
					message: 'API key is required for Langfuse destinations',
					success: false,
				};
			}

			// Validate base URL if provided
			if (baseUrl) {
				try {
					new URL(baseUrl);
				} catch {
					return {
						details: {
							destination: this.destinationId,
							metadata: { config },
							testType: 'validation',
						},
						error: 'Invalid baseUrl format',
						message: 'Invalid baseUrl format',
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
				message: 'Langfuse destination configuration is valid',
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

// Register the Langfuse provider and test runner
registerProvider(new LangfuseProviderFactory());
registerDestinationTestRunner('langfuse', LangfuseTestRunner);
