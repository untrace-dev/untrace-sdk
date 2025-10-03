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

// LangSmith provider configuration schema
const LangSmithConfigSchema = z.object({
	apiKey: z.string().min(1, 'API key is required'),
	enabled: z.boolean().default(true),
	endpoint: z.string().optional(),
	options: z
		.object({
			baseUrl: z.string().url().default('https://api.smith.langchain.com'),
			projectId: z.string().min(1, 'Project ID is required'),
			projectName: z.string().default('untrace'),
		})
		.optional(),
});

export class LangSmithProvider extends BaseIntegrationProvider {
	readonly name = 'LangSmith';
	readonly destinationId = 'langsmith';

	private baseUrl: string;
	private projectName: string;

	constructor(config: ProviderConfig, destinationId: string) {
		super(config, destinationId);
		this.baseUrl =
			(config.options?.baseUrl as string) || 'https://api.smith.langchain.com';
		this.projectName = (config.options?.projectName as string) || 'untrace';
	}

	async sendTrace(trace: TraceData, context: TraceContext): Promise<void> {
		if (!this.config.apiKey) {
			throw new Error('LangSmith API key is required');
		}

		// Transform trace to LangSmith format
		const langsmithData = this.transformTraceToLangSmith(trace, context);
		if (!langsmithData) {
			throw new Error('Failed to transform trace data');
		}

		const url = `${this.baseUrl}/api/v1/runs`;
		const payload = {
			...langsmithData,
			execution_order: 1,
			session_id: langsmithData.parent_id,
		};

		const response = await this.makeRequest(url, {
			body: JSON.stringify(payload),
			headers: {
				'Content-Type': 'application/json',
				'x-api-key': this.config.apiKey,
			},
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(
				`LangSmith API error: ${response.status} ${response.statusText} - ${errorText}`,
			);
		}
	}

	async sendBatch(traces: TraceData[], context: TraceContext): Promise<void> {
		if (!this.config.apiKey) {
			throw new Error('LangSmith API key is required');
		}

		// Send each trace individually as LangSmith doesn't have a batch endpoint
		for (const trace of traces) {
			await this.sendTrace(trace, context);
		}
	}

	async validateConfig(
		config: ProviderConfig,
	): Promise<{ success: boolean; error?: string }> {
		try {
			LangSmithConfigSchema.parse(config);
			return { success: true };
		} catch (error) {
			return {
				error: error instanceof Error ? error.message : 'Invalid configuration',
				success: false,
			};
		}
	}

	getConfigSchema(): z.ZodSchema {
		return LangSmithConfigSchema;
	}

	private transformTraceToLangSmith(trace: TraceData, context: TraceContext) {
		const now = new Date().toISOString();

		// Extract input/output from trace attributes or spans
		const inputs =
			trace.attributes?.['llm.input'] ||
			trace.spans?.[0]?.attributes?.['llm.input'];
		const outputs =
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

		// Determine run type based on provider
		let runType:
			| 'llm'
			| 'chain'
			| 'tool'
			| 'retriever'
			| 'embedding'
			| 'prompt'
			| 'parser' = 'llm';
		if (trace.attributes?.['llm.provider']) {
			const provider = (
				trace.attributes['llm.provider'] as string
			).toLowerCase();
			switch (provider) {
				case 'langchain':
					runType = 'chain';
					break;
				case 'anthropic':
				case 'cohere':
					runType = 'llm';
					break;
			}

			return {
				duration_ms: trace.duration
					? Math.round(trace.duration * 1000)
					: undefined,
				end_time: now,
				error: trace.status === 'error' ? 'Trace failed' : undefined,
				id: trace.id,
				inputs: (inputs as Record<string, unknown>) || undefined,
				metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
				name: trace.spans?.[0]?.name || trace.name || 'untrace_span',
				outputs: (outputs as Record<string, unknown>) || undefined,
				parent_id: trace.spans?.[0]?.id || undefined,
				project_name: this.projectName,
				run_type: runType,
				start_time: now,
				tags: this.generateTags(trace),
			};
		}
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

// LangSmith provider factory
export class LangSmithProviderFactory implements ProviderFactory {
	createProvider(
		config: ProviderConfig,
		destinationId: string,
	): LangSmithProvider {
		return new LangSmithProvider(config, destinationId);
	}

	getDestinationId(): string {
		return 'langsmith';
	}

	getConfigSchema(): z.ZodSchema {
		return LangSmithConfigSchema;
	}
}

// LangSmith test runner
export class LangSmithTestRunner extends BaseDestinationTestRunner {
	async testConnection(config: Record<string, unknown>): Promise<TestResult> {
		try {
			const apiKey = config.apiKey as string;
			const baseUrl =
				(config.baseUrl as string) || 'https://api.smith.langchain.com';

			if (!apiKey) {
				return {
					details: {
						destination: this.destinationId,
						metadata: { config },
						testType: 'connection',
					},
					error: 'Missing required field: apiKey',
					message: 'API key is required for LangSmith destinations',
					success: false,
				};
			}

			// Test connection by making a request to LangSmith's API
			const testUrl = `${baseUrl}/api/v1/runs`;
			const response = await fetch(testUrl, {
				body: JSON.stringify({
					execution_order: 1,
					id: 'test-connection',
					name: 'test_connection',
					project_name: 'test',
					run_type: 'llm',
					session_id: 'test-session',
					start_time: new Date().toISOString(),
				}),
				headers: {
					'Content-Type': 'application/json',
					'x-api-key': apiKey,
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
					message: `LangSmith connection test failed: ${response.status} ${response.statusText}`,
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
				message: `LangSmith connection test to ${baseUrl} successful`,
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
				message: `LangSmith connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
				(config.baseUrl as string) || 'https://api.smith.langchain.com';
			const projectName = (config.projectName as string) || 'untrace';

			if (!apiKey) {
				return {
					details: {
						destination: this.destinationId,
						metadata: { config, trace },
						testType: 'delivery',
					},
					error: 'Missing required field: apiKey',
					message: 'API key is required for LangSmith destinations',
					success: false,
				};
			}

			// Test delivery by sending a sample trace
			const testUrl = `${baseUrl}/api/v1/runs`;
			const response = await fetch(testUrl, {
				body: JSON.stringify({
					execution_order: 1,
					id: trace.id || 'test-delivery',
					inputs: trace.input || { test: true },
					metadata: {
						test: true,
						...trace,
					},
					name: 'test_delivery',
					outputs: trace.output || { success: true },
					project_name: projectName,
					run_type: 'llm',
					session_id: 'test-session',
					start_time: new Date().toISOString(),
				}),
				headers: {
					'Content-Type': 'application/json',
					'x-api-key': apiKey,
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
					message: `LangSmith delivery test failed: ${response.status} ${response.statusText}`,
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
				message: `LangSmith delivery test to ${baseUrl} successful`,
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
				message: `LangSmith delivery test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
					message: 'API key is required for LangSmith destinations',
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
				message: 'LangSmith destination configuration is valid',
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

// Register the LangSmith provider and test runner
registerProvider(new LangSmithProviderFactory());
registerDestinationTestRunner('langsmith', LangSmithTestRunner);
