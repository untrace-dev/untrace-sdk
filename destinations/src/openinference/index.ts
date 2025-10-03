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

// OpenInference provider configuration schema
const OpenInferenceConfigSchema = z.object({
	apiKey: z.string().optional(),
	enabled: z.boolean().default(true),
	endpoint: z.string().url('Invalid endpoint URL'),
	options: z
		.object({
			batchSize: z.number().min(1).max(1000).default(100),
			endpoint: z.string().url().default('http://localhost:8000/v1/traces'),
			flushInterval: z.number().min(1000).max(60000).default(5000),
			headers: z.record(z.string(), z.string()).optional(),
			timeout: z.number().min(1000).max(30000).default(30000),
		})
		.optional(),
});

export class OpenInferenceProvider extends BaseIntegrationProvider {
	readonly name = 'OpenInference';
	readonly destinationId = 'openinference';

	private endpoint: string;
	private headers: Record<string, string>;
	private timeout: number;
	private batchSize: number;
	private flushInterval: number;
	private spanBuffer: Array<{
		trace: TraceData;
		context: TraceContext;
		timestamp: string;
	}> = [];
	private flushTimer?: NodeJS.Timeout;

	constructor(config: ProviderConfig, destinationId: string) {
		super(config, destinationId);
		this.endpoint =
			(config.options?.endpoint as string) || 'http://localhost:8000/v1/traces';
		this.headers = (config.options?.headers as Record<string, string>) || {};
		this.timeout = (config.options?.timeout as number) || 30000;
		this.batchSize = (config.options?.batchSize as number) || 100;
		this.flushInterval = (config.options?.flushInterval as number) || 5000;

		// Set up automatic flushing
		this.setupAutoFlush();
	}

	async sendTrace(trace: TraceData, context: TraceContext): Promise<void> {
		if (!this.endpoint) {
			throw new Error('OpenInference endpoint is required');
		}

		// Add trace to buffer
		this.addTraceToBuffer(trace, context);
	}

	async sendBatch(traces: TraceData[], context: TraceContext): Promise<void> {
		if (!this.endpoint) {
			throw new Error('OpenInference endpoint is required');
		}

		// Add traces to buffer
		for (const trace of traces) {
			this.addTraceToBuffer(trace, context);
		}
	}

	async validateConfig(
		config: ProviderConfig,
	): Promise<{ success: boolean; error?: string }> {
		try {
			OpenInferenceConfigSchema.parse(config);
			return { success: true };
		} catch (error) {
			return {
				error: error instanceof Error ? error.message : 'Invalid configuration',
				success: false,
			};
		}
	}

	getConfigSchema(): z.ZodSchema {
		return OpenInferenceConfigSchema;
	}

	private addTraceToBuffer(trace: TraceData, context: TraceContext): void {
		this.spanBuffer.push({
			context,
			timestamp: new Date().toISOString(),
			trace,
		});

		// Flush if buffer is full
		if (this.spanBuffer.length >= this.batchSize) {
			this.flushSpans();
		}
	}

	private async flushSpans(): Promise<void> {
		if (this.spanBuffer.length === 0) {
			return;
		}

		const spansToFlush = [...this.spanBuffer];
		this.spanBuffer = [];

		try {
			await this.sendSpansToOpenInference(spansToFlush);
		} catch (error) {
			console.error('[OpenInferenceProvider] Failed to flush spans:', error);
			// Re-add spans to buffer for retry
			this.spanBuffer.unshift(...spansToFlush);
		}
	}

	private async sendSpansToOpenInference(
		spans: Array<{
			trace: TraceData;
			context: TraceContext;
			timestamp: string;
		}>,
	): Promise<void> {
		// Transform spans to OpenInference format
		const openInferenceSpans = spans.map(({ trace, context }) =>
			this.transformTraceToOpenInference(trace, context),
		);

		const trace = {
			resources: {
				'deployment.environment': 'production',
				'service.name': 'untrace',
				'service.version': '1.0.0',
			},
			spans: openInferenceSpans,
		};

		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			...this.headers,
		};

		// Add authorization header if API key is provided
		if (this.config.apiKey) {
			headers.Authorization = `Bearer ${this.config.apiKey}`;
		}

		const response = await this.makeRequest(this.endpoint, {
			body: JSON.stringify(trace),
			headers,
			timeout: this.timeout,
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(
				`OpenInference API error: ${response.status} ${response.statusText} - ${errorText}`,
			);
		}
	}

	private transformTraceToOpenInference(
		trace: TraceData,
		context: TraceContext,
	) {
		const now = new Date().toISOString();

		// Determine span kind based on trace attributes
		let spanKind:
			| 'llm'
			| 'retriever'
			| 'embedding'
			| 'reranker'
			| 'chain'
			| 'agent'
			| 'tool' = 'llm';
		if (trace.attributes?.['llm.provider']) {
			const provider = (
				trace.attributes['llm.provider'] as string
			).toLowerCase();
			switch (provider) {
				case 'langchain':
					spanKind = 'chain';
					break;
				case 'agent':
					spanKind = 'agent';
					break;
				case 'retriever':
					spanKind = 'retriever';
					break;
				case 'embedding':
					spanKind = 'embedding';
					break;
				default:
					spanKind = 'llm';
			}
		}

		// Build attributes following OpenInference semantic conventions
		const attributes: Record<string, unknown> = {
			'openinference.context.distinct_id': context.userId,
			'openinference.context.org_id': context.orgId,
			'openinference.context.project_id': context.projectId,
			'openinference.context.user_id': context.userId,
			'openinference.span.id': trace.spans?.[0]?.id || this.generateSpanId(),
			'openinference.span.kind': spanKind,
			'openinference.span.name':
				trace.spans?.[0]?.name || trace.name || 'untrace_span',
			'openinference.trace.id': trace.id,
			...trace.attributes,
		};

		// Add LLM-specific attributes
		if (trace.attributes?.['llm.model']) {
			attributes['openinference.llm.model.name'] =
				trace.attributes['llm.model'];
		}
		if (trace.attributes?.['llm.provider']) {
			attributes['openinference.llm.provider'] =
				trace.attributes['llm.provider'];
		}
		if (trace.attributes?.['llm.input_tokens']) {
			attributes['openinference.llm.input.tokens'] =
				trace.attributes['llm.input_tokens'];
		}
		if (trace.attributes?.['llm.output_tokens']) {
			attributes['openinference.llm.output.tokens'] =
				trace.attributes['llm.output_tokens'];
		}
		if (trace.attributes?.['llm.total_cost_usd']) {
			attributes['openinference.llm.total.cost'] =
				trace.attributes['llm.total_cost_usd'];
		}
		if (trace.attributes?.['llm.temperature']) {
			attributes['openinference.llm.temperature'] =
				trace.attributes['llm.temperature'];
		}

		// Add error information
		if (trace.status === 'error') {
			attributes['openinference.llm.error'] = true;
			attributes['openinference.error.message'] = 'Trace failed';
		}

		// Create span events
		const events = [
			{
				attributes: {
					'openinference.event.type': 'span_start',
				},
				name: 'span_start',
				timestamp: now,
			},
		];

		if (trace.status !== 'error') {
			events.push({
				attributes: {
					'openinference.event.success': true,
					'openinference.event.type': 'llm_completion',
				} as any,
				name: 'llm_completion',
				timestamp: now,
			});
		}

		// Prepare inputs and outputs
		const inputs: Record<string, unknown> = {};
		const outputs: Record<string, unknown> = {};

		if (trace.attributes?.['llm.input']) {
			inputs['openinference.llm.input'] = trace.attributes['llm.input'];
		}
		if (trace.attributes?.['llm.output']) {
			outputs['openinference.llm.output'] = trace.attributes['llm.output'];
		}

		return {
			attributes,
			end_time: now,
			events: events.length > 0 ? events : undefined,
			inputs: Object.keys(inputs).length > 0 ? inputs : undefined,
			outputs: Object.keys(outputs).length > 0 ? outputs : undefined,
			parent_span_id: trace.spans?.[0]?.id || undefined,
			span_id: trace.spans?.[0]?.id || this.generateSpanId(),
			span_kind: spanKind,
			start_time: now,
			status: trace.status === 'error' ? 'error' : 'ok',
			status_message: trace.status === 'error' ? 'Trace failed' : undefined,
			trace_id: trace.id,
		};
	}

	private generateSpanId(): string {
		const bytes = new Uint8Array(8);
		crypto.getRandomValues(bytes);
		return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
			'',
		);
	}

	private setupAutoFlush(): void {
		this.flushTimer = setInterval(() => {
			this.flushSpans();
		}, this.flushInterval);
	}

	async destroy(): Promise<void> {
		if (this.flushTimer) {
			clearInterval(this.flushTimer);
			this.flushTimer = undefined;
		}
		await this.flushSpans();
	}
}

// OpenInference provider factory
export class OpenInferenceProviderFactory implements ProviderFactory {
	createProvider(
		config: ProviderConfig,
		destinationId: string,
	): OpenInferenceProvider {
		return new OpenInferenceProvider(config, destinationId);
	}

	getDestinationId(): string {
		return 'openinference';
	}

	getConfigSchema(): z.ZodSchema {
		return OpenInferenceConfigSchema;
	}
}

// OpenInference test runner
export class OpenInferenceTestRunner extends BaseDestinationTestRunner {
	async testConnection(config: Record<string, unknown>): Promise<TestResult> {
		try {
			const endpoint = config.endpoint as string;

			if (!endpoint) {
				return {
					details: {
						destination: this.destinationId,
						metadata: { config },
						testType: 'connection',
					},
					error: 'Missing required field: endpoint',
					message: 'Endpoint is required for OpenInference destinations',
					success: false,
				};
			}

			// Test connection by making a request to OpenInference endpoint
			const response = await fetch(endpoint, {
				body: JSON.stringify({
					resources: {
						'service.name': 'untrace-test',
					},
					spans: [
						{
							attributes: { test: 'true' },
							end_time: new Date().toISOString(),
							events: [],
							inputs: {},
							outputs: {},
							span_id: 'test-span',
							span_kind: 'llm',
							start_time: new Date().toISOString(),
							status: 'ok',
							trace_id: 'test-trace',
						},
					],
				}),
				headers: {
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
					message: `OpenInference connection test failed: ${response.status} ${response.statusText}`,
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
				message: `OpenInference connection test to ${endpoint} successful`,
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
				message: `OpenInference connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
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

			if (!endpoint) {
				return {
					details: {
						destination: this.destinationId,
						metadata: { config, trace },
						testType: 'delivery',
					},
					error: 'Missing required field: endpoint',
					message: 'Endpoint is required for OpenInference destinations',
					success: false,
				};
			}

			// Test delivery by sending a sample trace
			const response = await fetch(endpoint, {
				body: JSON.stringify({
					resources: {
						'service.name': 'untrace-test',
					},
					spans: [
						{
							attributes: {
								test: 'true',
								...trace,
							},
							end_time: new Date().toISOString(),
							events: [],
							inputs: {},
							outputs: {},
							span_id: trace.id || 'test-span',
							span_kind: 'llm',
							start_time: new Date().toISOString(),
							status: 'ok',
							trace_id: trace.id || 'test-trace',
						},
					],
				}),
				headers: {
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
					message: `OpenInference delivery test failed: ${response.status} ${response.statusText}`,
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
				message: `OpenInference delivery test to ${endpoint} successful`,
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
				message: `OpenInference delivery test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
				success: false,
			};
		}
	}

	async validateConfig(config: Record<string, unknown>): Promise<TestResult> {
		try {
			const endpoint = config.endpoint as string;

			if (!endpoint) {
				return {
					details: {
						destination: this.destinationId,
						metadata: { config },
						testType: 'validation',
					},
					error: 'Missing required field: endpoint',
					message: 'Endpoint is required for OpenInference destinations',
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

			return {
				details: {
					destination: this.destinationId,
					metadata: { config },
					testType: 'validation',
				},
				message: 'OpenInference destination configuration is valid',
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

// Register the OpenInference provider and test runner
registerProvider(new OpenInferenceProviderFactory());
registerDestinationTestRunner('openinference', OpenInferenceTestRunner);
