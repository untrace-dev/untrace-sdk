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

// OTel Collector provider configuration schema
const OTelCollectorConfigSchema = z.object({
	apiKey: z.string().optional(),
	enabled: z.boolean().default(true),
	endpoint: z.string().url('Invalid endpoint URL'),
	options: z
		.object({
			endpoint: z.string().url().default('http://localhost:4317'),
			headers: z.record(z.string(), z.string()).optional(),
			insecure: z.boolean().default(false),
			protocol: z.enum(['grpc', 'http']).default('http'),
			timeout: z.number().min(1000).max(30000).default(30000),
		})
		.optional(),
});

export class OTelCollectorProvider extends BaseIntegrationProvider {
	readonly name = 'OpenTelemetry Collector';
	readonly destinationId = 'otel-collector';

	private endpoint: string;
	private protocol: 'grpc' | 'http';
	private headers: Record<string, string>;
	private timeout: number;
	private insecure: boolean;

	constructor(config: ProviderConfig, destinationId: string) {
		super(config, destinationId);
		this.endpoint =
			(config.options?.endpoint as string) || 'http://localhost:4317';
		this.protocol = (config.options?.protocol as 'grpc' | 'http') || 'http';
		this.headers = (config.options?.headers as Record<string, string>) || {};
		this.timeout = (config.options?.timeout as number) || 30000;
		this.insecure = (config.options?.insecure as boolean) || false;
	}

	async sendTrace(trace: TraceData, context: TraceContext): Promise<void> {
		if (!this.endpoint) {
			throw new Error('OTel Collector endpoint is required');
		}

		// Transform trace to OTLP format
		const otlpData = this.transformTraceToOTLP(trace, context);

		const url = `${this.endpoint}/v1/traces`;
		const headers: Record<string, string> = {
			'Content-Type':
				this.protocol === 'grpc'
					? 'application/x-protobuf'
					: 'application/json',
			...this.headers,
		};

		// Add authorization header if API key is provided
		if (this.config.apiKey) {
			headers.Authorization = `Bearer ${this.config.apiKey}`;
		}

		const response = await this.makeRequest(url, {
			body:
				this.protocol === 'grpc'
					? JSON.stringify(this.serializeProtobuf(otlpData))
					: JSON.stringify(otlpData),
			headers,
			timeout: this.timeout,
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(
				`OTel Collector API error: ${response.status} ${response.statusText} - ${errorText}`,
			);
		}
	}

	async sendBatch(traces: TraceData[], context: TraceContext): Promise<void> {
		if (!this.endpoint) {
			throw new Error('OTel Collector endpoint is required');
		}

		// Transform traces to OTLP format
		const otlpData = this.transformTracesToOTLP(traces, context);

		const url = `${this.endpoint}/v1/traces`;
		const headers: Record<string, string> = {
			'Content-Type':
				this.protocol === 'grpc'
					? 'application/x-protobuf'
					: 'application/json',
			...this.headers,
		};

		// Add authorization header if API key is provided
		if (this.config.apiKey) {
			headers.Authorization = `Bearer ${this.config.apiKey}`;
		}

		const response = await this.makeRequest(url, {
			body:
				this.protocol === 'grpc'
					? JSON.stringify(this.serializeProtobuf(otlpData))
					: JSON.stringify(otlpData),
			headers,
			timeout: this.timeout,
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(
				`OTel Collector batch API error: ${response.status} ${response.statusText} - ${errorText}`,
			);
		}
	}

	async validateConfig(
		config: ProviderConfig,
	): Promise<{ success: boolean; error?: string }> {
		try {
			OTelCollectorConfigSchema.parse(config);
			return { success: true };
		} catch (error) {
			return {
				error: error instanceof Error ? error.message : 'Invalid configuration',
				success: false,
			};
		}
	}

	getConfigSchema(): z.ZodSchema {
		return OTelCollectorConfigSchema;
	}

	private transformTraceToOTLP(trace: TraceData, context: TraceContext) {
		const now = Date.now() * 1000000; // Convert to nanoseconds
		const duration = (trace.duration || 0) * 1000000; // Convert to nanoseconds

		// Create resource attributes
		const resourceAttributes = [
			{ key: 'service.name', value: { stringValue: 'untrace' } },
			{ key: 'service.version', value: { stringValue: '1.0.0' } },
			{ key: 'deployment.environment', value: { stringValue: 'production' } },
			{ key: 'org.id', value: { stringValue: context.orgId } },
			{ key: 'project.id', value: { stringValue: context.projectId } },
		];

		// Add user information if available
		if (context.userId) {
			resourceAttributes.push({
				key: 'user.id',
				value: { stringValue: context.userId },
			});
		}

		// Create span attributes
		const spanAttributes = [
			{
				key: 'span.name',
				value: {
					stringValue: trace.spans?.[0]?.name || trace.name || 'untrace_span',
				},
			},
			{ key: 'trace.id', value: { stringValue: trace.id } },
			{
				key: 'span.id',
				value: { stringValue: trace.spans?.[0]?.id || this.generateSpanId() },
			},
		];

		// Add LLM-specific attributes
		if (trace.attributes?.['llm.model']) {
			spanAttributes.push({
				key: 'llm.model',
				value: { stringValue: trace.attributes['llm.model'] as string },
			});
		}
		if (trace.attributes?.['llm.provider']) {
			spanAttributes.push({
				key: 'llm.provider',
				value: { stringValue: trace.attributes['llm.provider'] as string },
			});
		}
		if (trace.attributes?.['llm.input_tokens']) {
			spanAttributes.push({
				key: 'llm.input_tokens',
				value: { stringValue: String(trace.attributes['llm.input_tokens']) },
			});
		}
		if (trace.attributes?.['llm.output_tokens']) {
			spanAttributes.push({
				key: 'llm.output_tokens',
				value: { stringValue: String(trace.attributes['llm.output_tokens']) },
			});
		}
		if (trace.attributes?.['llm.total_cost_usd']) {
			spanAttributes.push({
				key: 'llm.total_cost_usd',
				value: { stringValue: String(trace.attributes['llm.total_cost_usd']) },
			});
		}
		if (trace.attributes?.['llm.temperature']) {
			spanAttributes.push({
				key: 'llm.temperature',
				value: { stringValue: String(trace.attributes['llm.temperature']) },
			});
		}

		// Add error information
		if (trace.status === 'error') {
			spanAttributes.push({
				key: 'llm.is_error',
				value: { stringValue: 'true' },
			});
			spanAttributes.push({
				key: 'error.message',
				value: { stringValue: 'Trace failed' },
			});
		}

		// Create span events
		const events = [
			{
				attributes: [
					{ key: 'event.type', value: { stringValue: 'span_start' } },
				],
				name: 'span_start',
				timeUnixNano: now.toString(),
			},
		];

		if (trace.status !== 'error') {
			events.push({
				attributes: [
					{ key: 'event.type', value: { stringValue: 'llm_completion' } },
					{ key: 'event.success', value: { stringValue: 'true' } },
				],
				name: 'llm_completion',
				timeUnixNano: (now + duration).toString(),
			});
		}

		// Create span
		const span = {
			attributes: spanAttributes,
			endTimeUnixNano: (now + duration).toString(),
			events: events.length > 0 ? events : undefined,
			kind: 1, // SPAN_KIND_INTERNAL
			name: trace.spans?.[0]?.name || trace.name || 'untrace_span',
			parentSpanId: trace.spans?.[0]?.id || undefined,
			spanId: this.hexToBytes(trace.spans?.[0]?.id || this.generateSpanId()),
			startTimeUnixNano: now.toString(),
			status: {
				code: trace.status === 'error' ? 2 : 1, // STATUS_CODE_ERROR : STATUS_CODE_OK
				message: trace.status === 'error' ? 'Trace failed' : undefined,
			},
			traceId: this.hexToBytes(trace.id),
		};

		// Create resource spans
		const resourceSpans = {
			resource: {
				attributes: resourceAttributes,
			},
			scopeSpans: [
				{
					scope: {
						name: 'untrace-otel-integration',
						version: '1.0.0',
					},
					spans: [span],
				},
			],
		};

		return {
			resourceSpans: [resourceSpans],
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
							{ key: 'service.name', value: { stringValue: 'untrace' } },
							{ key: 'service.version', value: { stringValue: '1.0.0' } },
							{
								key: 'deployment.environment',
								value: { stringValue: 'production' },
							},
							{ key: 'org.id', value: { stringValue: context.orgId } },
							{ key: 'project.id', value: { stringValue: context.projectId } },
						],
					},
					scopeSpans: [
						{
							scope: {
								name: 'untrace-otel-integration',
								version: '1.0.0',
							},
							spans,
						},
					],
				},
			],
		};
	}

	private hexToBytes(hex: string): string {
		// Remove any non-hex characters and pad to 16 characters for span IDs
		const cleanHex = hex.replace(/[^0-9a-fA-F]/g, '');
		return cleanHex.length === 32 ? cleanHex : cleanHex.padEnd(32, '0');
	}

	private generateSpanId(): string {
		const bytes = new Uint8Array(8);
		crypto.getRandomValues(bytes);
		return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
			'',
		);
	}

	private serializeProtobuf(data: unknown): ArrayBuffer {
		// Note: This is a simplified implementation
		// In a real implementation, you would use protobuf-js or similar
		const jsonString = JSON.stringify(data);
		const uint8Array = new TextEncoder().encode(jsonString);
		const buffer = new ArrayBuffer(uint8Array.byteLength);
		const view = new Uint8Array(buffer);
		view.set(uint8Array);
		return buffer;
	}
}

// OTel Collector provider factory
export class OTelCollectorProviderFactory implements ProviderFactory {
	createProvider(
		config: ProviderConfig,
		destinationId: string,
	): OTelCollectorProvider {
		return new OTelCollectorProvider(config, destinationId);
	}

	getDestinationId(): string {
		return 'otel-collector';
	}

	getConfigSchema(): z.ZodSchema {
		return OTelCollectorConfigSchema;
	}
}

// OTel Collector test runner
export class OTelCollectorTestRunner extends BaseDestinationTestRunner {
	async testConnection(config: Record<string, unknown>): Promise<TestResult> {
		try {
			const endpoint = config.endpoint as string;
			const protocol = (config.protocol as string) || 'http';

			if (!endpoint) {
				return {
					details: {
						destination: this.destinationId,
						metadata: { config },
						testType: 'connection',
					},
					error: 'Missing required field: endpoint',
					message: 'Endpoint is required for OTel Collector destinations',
					success: false,
				};
			}

			// Test connection by making a request to OTel Collector endpoint
			const testUrl = `${endpoint}/v1/traces`;
			const response = await fetch(testUrl, {
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
												{ key: 'test', value: { stringValue: 'true' } },
											],
											endTimeUnixNano: Date.now().toString(),
											events: [],
											kind: 1,
											name: 'test_connection',
											spanId: '1',
											startTimeUnixNano: Date.now().toString(),
											status: { code: 1 },
											traceId: '1',
										},
									],
								},
							],
						},
					],
				}),
				headers: {
					'Content-Type':
						protocol === 'grpc' ? 'application/x-protobuf' : 'application/json',
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
					message: `OTel Collector connection test failed: ${response.status} ${response.statusText}`,
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
				message: `OTel Collector connection test to ${endpoint} successful`,
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
				message: `OTel Collector connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
				success: false,
			};
		}
	}

	async testDelivery(
		config: Record<string, unknown>,
		trace: Record<string, unknown>,
	): Promise<TestResult> {
		try {
			const endpoint = config.endpoint as string;
			const protocol = (config.protocol as string) || 'http';

			if (!endpoint) {
				return {
					details: {
						destination: this.destinationId,
						metadata: { config, trace },
						testType: 'delivery',
					},
					error: 'Missing required field: endpoint',
					message: 'Endpoint is required for OTel Collector destinations',
					success: false,
				};
			}

			// Test delivery by sending a sample trace
			const testUrl = `${endpoint}/v1/traces`;
			const response = await fetch(testUrl, {
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
												{ key: 'test', value: { stringValue: 'true' } },
												{
													key: 'trace_id',
													value: { stringValue: trace.id || 'test-trace' },
												},
											],
											endTimeUnixNano: Date.now().toString(),
											events: [],
											kind: 1,
											name: 'test_delivery',
											spanId: trace.id || '1',
											startTimeUnixNano: Date.now().toString(),
											status: { code: 1 },
											traceId: trace.id || '1',
										},
									],
								},
							],
						},
					],
				}),
				headers: {
					'Content-Type':
						protocol === 'grpc' ? 'application/x-protobuf' : 'application/json',
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
					message: `OTel Collector delivery test failed: ${response.status} ${response.statusText}`,
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
				message: `OTel Collector delivery test to ${endpoint} successful`,
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
				message: `OTel Collector delivery test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
				success: false,
			};
		}
	}

	async validateConfig(config: Record<string, unknown>): Promise<TestResult> {
		try {
			const endpoint = config.endpoint as string;
			const protocol = config.protocol as string;

			if (!endpoint) {
				return {
					details: {
						destination: this.destinationId,
						metadata: { config },
						testType: 'validation',
					},
					error: 'Missing required field: endpoint',
					message: 'Endpoint is required for OTel Collector destinations',
					success: false,
				};
			}

			// Validate endpoint URL
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

			// Validate protocol if provided
			if (protocol && !['grpc', 'http'].includes(protocol)) {
				return {
					details: {
						destination: this.destinationId,
						metadata: { config },
						testType: 'validation',
					},
					error: 'Invalid protocol value',
					message: 'Protocol must be one of: grpc, http',
					success: false,
				};
			}

			return {
				details: {
					destination: this.destinationId,
					metadata: { config },
					testType: 'validation',
				},
				message: 'OTel Collector destination configuration is valid',
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

// Register the OTel Collector provider and test runner
registerProvider(new OTelCollectorProviderFactory());
registerDestinationTestRunner('otel-collector', OTelCollectorTestRunner);
