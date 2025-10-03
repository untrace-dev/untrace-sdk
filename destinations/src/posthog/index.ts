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

// PostHog provider configuration schema
const PostHogConfigSchema = z.object({
	apiKey: z.string().min(1, 'API key is required'),
	enabled: z.boolean().default(true),
	endpoint: z.string().optional(),
	options: z
		.object({
			baseUrl: z.string().url().default('https://us.i.posthog.com'),
			projectId: z.string().optional(),
		})
		.optional(),
});

export class PostHogProvider extends BaseIntegrationProvider {
	readonly name = 'PostHog';
	readonly destinationId = 'posthog';

	private endpoint: string;

	constructor(config: ProviderConfig, destinationId: string) {
		super(config, destinationId);
		this.endpoint = this.buildEndpoint();
	}

	private buildEndpoint(): string {
		const capturePath = '/i/v0/e/';

		if (this.config.endpoint) {
			return `${this.config.endpoint}${capturePath}`;
		}

		const baseUrl =
			(this.config.options?.baseUrl as string) || 'https://us.i.posthog.com';
		return `${baseUrl}${capturePath}`;
	}

	async sendTrace(trace: TraceData, context: TraceContext): Promise<void> {
		if (!this.config.apiKey) {
			throw new Error('PostHog API key is required');
		}

		// Transform trace to PostHog LLM analytics format
		const properties: Record<string, unknown> = {
			$ai_attributes: trace.attributes,
			$ai_duration: trace.duration,
			$ai_events: trace.events,
			$ai_span_id: trace.spans?.[0]?.id,
			$ai_span_name: trace.spans?.[0]?.name || trace.name,
			$ai_spans: trace.spans,
			$ai_status: trace.status,
			$ai_timestamp: trace.timestamp,
			$ai_trace_id: trace.id,
			distinct_id: context.userId || 'anonymous',
			org_id: context.orgId,
			project_id: context.projectId,
		};

		const payload = {
			api_key: this.config.apiKey,
			event: '$ai_generation',
			properties,
			timestamp: new Date().toISOString(),
		};

		const response = await this.makeRequest(this.endpoint, {
			body: JSON.stringify(payload),
			headers: {
				'Content-Type': 'application/json',
			},
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(
				`PostHog API error: ${response.status} ${response.statusText} - ${errorText}`,
			);
		}
	}

	async sendBatch(traces: TraceData[], context: TraceContext): Promise<void> {
		if (!this.config.apiKey) {
			throw new Error('PostHog API key is required');
		}

		const batchPayload = traces.map((trace) => {
			const properties: Record<string, unknown> = {
				$ai_attributes: trace.attributes,
				$ai_duration: trace.duration,
				$ai_events: trace.events,
				$ai_span_id: trace.spans?.[0]?.id,
				$ai_span_name: trace.spans?.[0]?.name || trace.name,
				$ai_spans: trace.spans,
				$ai_status: trace.status,
				$ai_timestamp: trace.timestamp,
				$ai_trace_id: trace.id,
				distinct_id: context.userId || 'anonymous',
				org_id: context.orgId,
				project_id: context.projectId,
			};

			return {
				api_key: this.config.apiKey,
				event: '$ai_generation',
				properties,
				timestamp: new Date().toISOString(),
			};
		});

		const response = await this.makeRequest(this.endpoint, {
			body: JSON.stringify({ batch: batchPayload }),
			headers: {
				'Content-Type': 'application/json',
			},
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(
				`PostHog batch API error: ${response.status} ${response.statusText} - ${errorText}`,
			);
		}
	}

	async validateConfig(
		config: ProviderConfig,
	): Promise<{ success: boolean; error?: string }> {
		try {
			PostHogConfigSchema.parse(config);
			return { success: true };
		} catch (error) {
			return {
				error: error instanceof Error ? error.message : 'Invalid configuration',
				success: false,
			};
		}
	}

	getConfigSchema(): z.ZodSchema {
		return PostHogConfigSchema;
	}
}

// PostHog provider factory
export class PostHogProviderFactory implements ProviderFactory {
	createProvider(
		config: ProviderConfig,
		destinationId: string,
	): PostHogProvider {
		return new PostHogProvider(config, destinationId);
	}

	getDestinationId(): string {
		return 'posthog';
	}

	getConfigSchema(): z.ZodSchema {
		return PostHogConfigSchema;
	}
}

// PostHog test runner
export class PostHogTestRunner extends BaseDestinationTestRunner {
	async testConnection(config: Record<string, unknown>): Promise<TestResult> {
		try {
			const apiKey = config.apiKey as string;
			const baseUrl = (config.baseUrl as string) || 'https://us.i.posthog.com';

			if (!apiKey) {
				return {
					details: {
						destination: this.destinationId,
						metadata: { config },
						testType: 'connection',
					},
					error: 'Missing required field: apiKey',
					message: 'API key is required for PostHog destinations',
					success: false,
				};
			}

			// Test connection by making a request to PostHog's API
			const testEndpoint = `${baseUrl}/i/v0/e/`;
			const response = await fetch(testEndpoint, {
				body: JSON.stringify({
					api_key: apiKey,
					event: '$test_connection',
					properties: {
						test: true,
						timestamp: new Date().toISOString(),
					},
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
					message: `PostHog connection test failed: ${response.status} ${response.statusText}`,
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
				message: `PostHog connection test to ${baseUrl} successful`,
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
				message: `PostHog connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
			const baseUrl = (config.baseUrl as string) || 'https://us.i.posthog.com';

			if (!apiKey) {
				return {
					details: {
						destination: this.destinationId,
						metadata: { config, trace },
						testType: 'delivery',
					},
					error: 'Missing required field: apiKey',
					message: 'API key is required for PostHog destinations',
					success: false,
				};
			}

			// Test delivery by sending a sample trace
			const testEndpoint = `${baseUrl}/i/v0/e/`;
			const response = await fetch(testEndpoint, {
				body: JSON.stringify({
					api_key: apiKey,
					event: '$ai_generation_test',
					properties: {
						$ai_test: true,
						$ai_trace_id: trace.id || 'test-trace',
						distinct_id: 'test-user',
						test_timestamp: new Date().toISOString(),
						...trace,
					},
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
					message: `PostHog delivery test failed: ${response.status} ${response.statusText}`,
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
				message: `PostHog delivery test to ${baseUrl} successful`,
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
				message: `PostHog delivery test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
					message: 'API key is required for PostHog destinations',
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
				message: 'PostHog destination configuration is valid',
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

// Register the PostHog provider and test runner
registerProvider(new PostHogProviderFactory());
registerDestinationTestRunner('posthog', PostHogTestRunner);
