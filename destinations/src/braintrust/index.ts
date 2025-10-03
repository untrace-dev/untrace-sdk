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

// Braintrust provider configuration schema
const BraintrustConfigSchema = z.object({
	apiKey: z.string().min(1, 'API key is required'),
	enabled: z.boolean().default(true),
	endpoint: z.string().optional(),
	options: z
		.object({
			baseUrl: z.string().url().default('https://api.braintrust.dev'),
			projectId: z.string().min(1, 'Project ID is required'),
		})
		.optional(),
});

export class BraintrustProvider extends BaseIntegrationProvider {
	readonly name = 'Braintrust';
	readonly destinationId = 'braintrust';

	private baseUrl: string;
	private projectId: string;

	constructor(config: ProviderConfig, destinationId: string) {
		super(config, destinationId);
		this.baseUrl =
			(config.options?.baseUrl as string) || 'https://api.braintrust.dev';
		this.projectId = (config.options?.projectId as string) || '';
	}

	async sendTrace(trace: TraceData, context: TraceContext): Promise<void> {
		if (!this.config.apiKey) {
			throw new Error('Braintrust API key is required');
		}

		if (!this.projectId) {
			throw new Error('Braintrust project ID is required');
		}

		// Transform trace to Braintrust format
		const braintrustData = this.transformTraceToBraintrust(trace, context);

		const url = `${this.baseUrl}/v1/project_logs/${this.projectId}/insert`;
		const payload = {
			events: [braintrustData],
		};

		const response = await this.makeRequest(url, {
			body: JSON.stringify(payload),
			headers: {
				Authorization: `Bearer ${this.config.apiKey}`,
				'Content-Type': 'application/json',
			},
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(
				`Braintrust API error: ${response.status} ${response.statusText} - ${errorText}`,
			);
		}
	}

	async sendBatch(traces: TraceData[], context: TraceContext): Promise<void> {
		if (!this.config.apiKey) {
			throw new Error('Braintrust API key is required');
		}

		if (!this.projectId) {
			throw new Error('Braintrust project ID is required');
		}

		// Transform traces to Braintrust format
		const braintrustData = traces.map((trace) =>
			this.transformTraceToBraintrust(trace, context),
		);

		const url = `${this.baseUrl}/v1/project_logs/${this.projectId}/insert`;
		const payload = {
			events: braintrustData,
		};

		const response = await this.makeRequest(url, {
			body: JSON.stringify(payload),
			headers: {
				Authorization: `Bearer ${this.config.apiKey}`,
				'Content-Type': 'application/json',
			},
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(
				`Braintrust batch API error: ${response.status} ${response.statusText} - ${errorText}`,
			);
		}
	}

	async validateConfig(
		config: ProviderConfig,
	): Promise<{ success: boolean; error?: string }> {
		try {
			BraintrustConfigSchema.parse(config);
			return { success: true };
		} catch (error) {
			return {
				error: error instanceof Error ? error.message : 'Invalid configuration',
				success: false,
			};
		}
	}

	getConfigSchema(): z.ZodSchema {
		return BraintrustConfigSchema;
	}

	private transformTraceToBraintrust(trace: TraceData, context: TraceContext) {
		const now = new Date().toISOString();

		// Extract input/output from trace attributes or spans
		const input =
			trace.attributes?.['llm.input'] ||
			trace.spans?.[0]?.attributes?.['llm.input'];
		const output =
			trace.attributes?.['llm.output'] ||
			trace.spans?.[0]?.attributes?.['llm.output'];

		// Build metadata
		const metadata: Record<string, unknown> = {
			...trace.attributes,
			duration: trace.duration,
			org_id: context.orgId,
			project_id: context.projectId,
			span_id: trace.spans?.[0]?.id,
			span_name: trace.spans?.[0]?.name || trace.name,
			status: trace.status,
			trace_id: trace.id,
			user_id: context.userId,
		};

		// Add LLM-specific metadata
		if (trace.attributes?.['llm.model']) {
			metadata.model = trace.attributes['llm.model'];
		}
		if (trace.attributes?.['llm.provider']) {
			metadata.provider = trace.attributes['llm.provider'];
		}
		if (trace.attributes?.['llm.temperature']) {
			metadata.temperature = trace.attributes['llm.temperature'];
		}

		// Build scores
		const scores: Record<string, number> = {};
		if (trace.attributes?.['llm.cost']) {
			scores.cost_usd = trace.attributes['llm.cost'] as number;
		}

		return {
			duration: trace.duration,
			endTime: now,
			id: trace.id,
			input: (input as Record<string, unknown>) || undefined,
			metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
			output: (output as Record<string, unknown>) || undefined,
			scores: Object.keys(scores).length > 0 ? scores : undefined,
			startTime: now,
			tags: this.generateTags(trace),
		};
	}

	private generateTags(trace: TraceData): string[] {
		const tags: string[] = [];

		if (trace.attributes?.['llm.provider']) {
			tags.push(`provider:${trace.attributes['llm.provider']}`);
		}
		if (trace.attributes?.['llm.model']) {
			tags.push(`model:${trace.attributes['llm.model']}`);
		}
		if (trace.status === 'error') {
			tags.push('error');
		}

		return tags;
	}
}

// Braintrust provider factory
export class BraintrustProviderFactory implements ProviderFactory {
	createProvider(
		config: ProviderConfig,
		destinationId: string,
	): BraintrustProvider {
		return new BraintrustProvider(config, destinationId);
	}

	getDestinationId(): string {
		return 'braintrust';
	}

	getConfigSchema(): z.ZodSchema {
		return BraintrustConfigSchema;
	}
}

// Braintrust test runner
export class BraintrustTestRunner extends BaseDestinationTestRunner {
	async testConnection(config: Record<string, unknown>): Promise<TestResult> {
		try {
			const apiKey = config.apiKey as string;
			const baseUrl =
				(config.baseUrl as string) || 'https://api.braintrust.dev';
			const projectId = config.projectId as string;

			if (!apiKey) {
				return {
					details: {
						destination: this.destinationId,
						metadata: { config },
						testType: 'connection',
					},
					error: 'Missing required field: apiKey',
					message: 'API key is required for Braintrust destinations',
					success: false,
				};
			}

			if (!projectId) {
				return {
					details: {
						destination: this.destinationId,
						metadata: { config },
						testType: 'connection',
					},
					error: 'Missing required field: projectId',
					message: 'Project ID is required for Braintrust destinations',
					success: false,
				};
			}

			// Test connection by making a request to Braintrust's API
			const testUrl = `${baseUrl}/v1/project_logs/${projectId}/insert`;
			const response = await fetch(testUrl, {
				body: JSON.stringify({
					events: [
						{
							endTime: new Date().toISOString(),
							id: 'test-connection',
							input: { test: true },
							metadata: { test: true },
							output: { success: true },
							startTime: new Date().toISOString(),
						},
					],
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
					message: `Braintrust connection test failed: ${response.status} ${response.statusText}`,
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
				message: `Braintrust connection test to ${baseUrl} successful`,
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
				message: `Braintrust connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
				(config.baseUrl as string) || 'https://api.braintrust.dev';
			const projectId = config.projectId as string;

			if (!apiKey) {
				return {
					details: {
						destination: this.destinationId,
						metadata: { config, trace },
						testType: 'delivery',
					},
					error: 'Missing required field: apiKey',
					message: 'API key is required for Braintrust destinations',
					success: false,
				};
			}

			if (!projectId) {
				return {
					details: {
						destination: this.destinationId,
						metadata: { config, trace },
						testType: 'delivery',
					},
					error: 'Missing required field: projectId',
					message: 'Project ID is required for Braintrust destinations',
					success: false,
				};
			}

			// Test delivery by sending a sample trace
			const testUrl = `${baseUrl}/v1/project_logs/${projectId}/insert`;
			const response = await fetch(testUrl, {
				body: JSON.stringify({
					events: [
						{
							endTime: new Date().toISOString(),
							id: trace.id || 'test-delivery',
							input: trace.input || { test: true },
							metadata: {
								test: true,
								...trace,
							},
							output: trace.output || { success: true },
							startTime: new Date().toISOString(),
						},
					],
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
					message: `Braintrust delivery test failed: ${response.status} ${response.statusText}`,
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
				message: `Braintrust delivery test to ${baseUrl} successful`,
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
				message: `Braintrust delivery test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
				success: false,
			};
		}
	}

	async validateConfig(config: Record<string, unknown>): Promise<TestResult> {
		try {
			const apiKey = config.apiKey as string;
			const baseUrl = config.baseUrl as string;
			const projectId = config.projectId as string;

			if (!apiKey) {
				return {
					details: {
						destination: this.destinationId,
						metadata: { config },
						testType: 'validation',
					},
					error: 'Missing required field: apiKey',
					message: 'API key is required for Braintrust destinations',
					success: false,
				};
			}

			if (!projectId) {
				return {
					details: {
						destination: this.destinationId,
						metadata: { config },
						testType: 'validation',
					},
					error: 'Missing required field: projectId',
					message: 'Project ID is required for Braintrust destinations',
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
				message: 'Braintrust destination configuration is valid',
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

// Register the Braintrust provider and test runner
registerProvider(new BraintrustProviderFactory());
registerDestinationTestRunner('braintrust', BraintrustTestRunner);
