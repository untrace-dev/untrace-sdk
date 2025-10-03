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

// Datadog provider configuration schema
const DatadogConfigSchema = z.object({
	apiKey: z.string().min(1, 'API key is required'),
	enabled: z.boolean().default(true),
	endpoint: z.string().optional(),
	options: z
		.object({
			env: z.string().optional(),
			service: z.string().default('untrace'),
			site: z
				.enum([
					'datadoghq.com',
					'datadoghq.eu',
					'us3.datadoghq.com',
					'us5.datadoghq.com',
				])
				.default('datadoghq.com'),
			version: z.string().optional(),
		})
		.optional(),
});

export class DatadogProvider extends BaseIntegrationProvider {
	readonly name = 'Datadog';
	readonly destinationId = 'datadog';

	private site: string;
	private env?: string;
	private service: string;
	private version?: string;

	constructor(config: ProviderConfig, destinationId: string) {
		super(config, destinationId);
		this.site = (config.options?.site as string) || 'datadoghq.com';
		this.env = config.options?.env as string;
		this.service = (config.options?.service as string) || 'untrace';
		this.version = config.options?.version as string;
	}

	async sendTrace(trace: TraceData, context: TraceContext): Promise<void> {
		if (!this.config.apiKey) {
			throw new Error('Datadog API key is required');
		}

		// Transform trace to Datadog format
		const datadogTrace = this.transformTraceToDatadog(trace, context);

		const url = `https://trace.agent.${this.site}/v0.4/traces`;
		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			'DD-API-KEY': this.config.apiKey,
		};

		// Add environment headers if configured
		if (this.env) {
			headers['DD-ENV'] = this.env;
		}
		if (this.service) {
			headers['DD-SERVICE'] = this.service;
		}
		if (this.version) {
			headers['DD-VERSION'] = this.version;
		}

		const response = await this.makeRequest(url, {
			body: JSON.stringify(datadogTrace),
			headers,
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(
				`Datadog API error: ${response.status} ${response.statusText} - ${errorText}`,
			);
		}
	}

	async sendBatch(traces: TraceData[], context: TraceContext): Promise<void> {
		if (!this.config.apiKey) {
			throw new Error('Datadog API key is required');
		}

		// Transform traces to Datadog format
		const datadogTraces = traces.map((trace) =>
			this.transformTraceToDatadog(trace, context),
		);

		const url = `https://trace.agent.${this.site}/v0.4/traces`;
		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			'DD-API-KEY': this.config.apiKey,
		};

		// Add environment headers if configured
		if (this.env) {
			headers['DD-ENV'] = this.env;
		}
		if (this.service) {
			headers['DD-SERVICE'] = this.service;
		}
		if (this.version) {
			headers['DD-VERSION'] = this.version;
		}

		const response = await this.makeRequest(url, {
			body: JSON.stringify(datadogTraces),
			headers,
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(
				`Datadog batch API error: ${response.status} ${response.statusText} - ${errorText}`,
			);
		}
	}

	async validateConfig(
		config: ProviderConfig,
	): Promise<{ success: boolean; error?: string }> {
		try {
			DatadogConfigSchema.parse(config);
			return { success: true };
		} catch (error) {
			return {
				error: error instanceof Error ? error.message : 'Invalid configuration',
				success: false,
			};
		}
	}

	getConfigSchema(): z.ZodSchema {
		return DatadogConfigSchema;
	}

	private transformTraceToDatadog(trace: TraceData, context: TraceContext) {
		const now = Date.now() * 1000000; // Convert to nanoseconds
		const duration = (trace.duration || 0) * 1000000; // Convert to nanoseconds

		// Create main span
		const span: any = {
			duration,
			meta: {
				environment: this.env || 'production',
				'org.id': context.orgId,
				'project.id': context.projectId,
				'trace.span_id': trace.spans?.[0]?.id || '',
				'trace.trace_id': trace.id,
				'user.id': context.userId || '',
				version: this.version || '1.0.0',
				...trace.attributes,
			},
			metrics: {
				duration_ms: trace.duration || 0,
			},
			name: trace.spans?.[0]?.name || trace.name || 'untrace_span',
			parent_id: undefined,
			resource: `${trace.attributes?.['llm.provider'] || 'unknown'}.${trace.attributes?.['llm.model'] || 'unknown'}`,
			service: this.service,
			span_id: this.convertSpanId(
				trace.spans?.[0]?.id || this.generateSpanId(),
			),
			start: now - duration,
			trace_id: this.convertTraceId(trace.id),
			type: 'llm',
		};

		// Add error information if present
		if (trace.status === 'error') {
			span.meta.error = '1';
			span.meta['error.message'] = 'Trace failed';
		}

		// Add LLM-specific metrics
		if (trace.attributes?.['llm.input_tokens']) {
			span.metrics['llm.input_tokens'] = trace.attributes[
				'llm.input_tokens'
			] as number;
		}
		if (trace.attributes?.['llm.output_tokens']) {
			span.metrics['llm.output_tokens'] = trace.attributes[
				'llm.output_tokens'
			] as number;
		}
		if (trace.attributes?.['llm.total_cost_usd']) {
			span.metrics['llm.total_cost_usd'] = trace.attributes[
				'llm.total_cost_usd'
			] as number;
		}

		return {
			spans: [span],
		};
	}

	private convertTraceId(traceId: string): string {
		// Datadog expects trace IDs as 64-bit integers
		const hex = traceId.replace(/[^0-9a-f]/gi, '');
		const num = Number.parseInt(hex.substring(0, 16), 16);
		return num.toString();
	}

	private convertSpanId(spanId: string): string {
		// Datadog expects span IDs as 64-bit integers
		const hex = spanId.replace(/[^0-9a-f]/gi, '');
		const num = Number.parseInt(hex.substring(0, 16), 16);
		return num.toString();
	}

	private generateSpanId(): string {
		const bytes = new Uint8Array(8);
		crypto.getRandomValues(bytes);
		return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
			'',
		);
	}
}

// Datadog provider factory
export class DatadogProviderFactory implements ProviderFactory {
	createProvider(
		config: ProviderConfig,
		destinationId: string,
	): DatadogProvider {
		return new DatadogProvider(config, destinationId);
	}

	getDestinationId(): string {
		return 'datadog';
	}

	getConfigSchema(): z.ZodSchema {
		return DatadogConfigSchema;
	}
}

// Datadog test runner
export class DatadogTestRunner extends BaseDestinationTestRunner {
	async testConnection(config: Record<string, unknown>): Promise<TestResult> {
		try {
			const apiKey = config.apiKey as string;
			const site = (config.site as string) || 'datadoghq.com';

			if (!apiKey) {
				return {
					details: {
						destination: this.destinationId,
						metadata: { config },
						testType: 'connection',
					},
					error: 'Missing required field: apiKey',
					message: 'API key is required for Datadog destinations',
					success: false,
				};
			}

			// Test connection by making a request to Datadog's trace API
			const testUrl = `https://trace.agent.${site}/v0.4/traces`;
			const response = await fetch(testUrl, {
				body: JSON.stringify([
					{
						spans: [
							{
								duration: 1000000,
								meta: { test: 'true' },
								metrics: {},
								name: 'test_connection',
								resource: 'test',
								service: 'untrace-test',
								span_id: '1',
								start: Date.now() * 1000000,
								trace_id: '1',
								type: 'test',
							},
						],
					},
				]),
				headers: {
					'Content-Type': 'application/json',
					'DD-API-KEY': apiKey,
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
					message: `Datadog connection test failed: ${response.status} ${response.statusText}`,
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
				message: `Datadog connection test to ${site} successful`,
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
				message: `Datadog connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
			const site = (config.site as string) || 'datadoghq.com';

			if (!apiKey) {
				return {
					details: {
						destination: this.destinationId,
						metadata: { config, trace },
						testType: 'delivery',
					},
					error: 'Missing required field: apiKey',
					message: 'API key is required for Datadog destinations',
					success: false,
				};
			}

			// Test delivery by sending a sample trace
			const testUrl = `https://trace.agent.${site}/v0.4/traces`;
			const response = await fetch(testUrl, {
				body: JSON.stringify([
					{
						spans: [
							{
								duration: 1000000,
								meta: {
									test: 'true',
									...trace,
								},
								metrics: {},
								name: 'test_delivery',
								resource: 'test',
								service: 'untrace-test',
								span_id: trace.id || '1',
								start: Date.now() * 1000000,
								trace_id: trace.id || '1',
								type: 'test',
							},
						],
					},
				]),
				headers: {
					'Content-Type': 'application/json',
					'DD-API-KEY': apiKey,
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
					message: `Datadog delivery test failed: ${response.status} ${response.statusText}`,
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
				message: `Datadog delivery test to ${site} successful`,
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
				message: `Datadog delivery test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
				success: false,
			};
		}
	}

	async validateConfig(config: Record<string, unknown>): Promise<TestResult> {
		try {
			const apiKey = config.apiKey as string;
			const site = config.site as string;

			if (!apiKey) {
				return {
					details: {
						destination: this.destinationId,
						metadata: { config },
						testType: 'validation',
					},
					error: 'Missing required field: apiKey',
					message: 'API key is required for Datadog destinations',
					success: false,
				};
			}

			// Validate site if provided
			if (
				site &&
				![
					'datadoghq.com',
					'datadoghq.eu',
					'us3.datadoghq.com',
					'us5.datadoghq.com',
				].includes(site)
			) {
				return {
					details: {
						destination: this.destinationId,
						metadata: { config },
						testType: 'validation',
					},
					error: 'Invalid site value',
					message:
						'Site must be one of: datadoghq.com, datadoghq.eu, us3.datadoghq.com, us5.datadoghq.com',
					success: false,
				};
			}

			return {
				details: {
					destination: this.destinationId,
					metadata: { config },
					testType: 'validation',
				},
				message: 'Datadog destination configuration is valid',
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

// Register the Datadog provider and test runner
registerProvider(new DatadogProviderFactory());
registerDestinationTestRunner('datadog', DatadogTestRunner);
