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

// Webhook provider configuration schema
const WebhookConfigSchema = z.object({
	apiKey: z.string().optional(),
	enabled: z.boolean().default(true),
	endpoint: z.string().url('Invalid webhook URL'),
	options: z
		.object({
			headers: z.record(z.string(), z.string()).optional(),
			method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).default('POST'),
			timeout: z.number().min(1000).max(30000).default(10000),
		})
		.optional(),
});

export class WebhookProvider extends BaseIntegrationProvider {
	readonly name = 'Webhook';
	readonly destinationId = 'webhook';

	async sendTrace(trace: TraceData, context: TraceContext): Promise<void> {
		if (!this.config.endpoint) {
			throw new Error('Webhook endpoint is required');
		}

		const method: string = (this.config.options?.method as string) || 'POST';
		const headers: Record<string, string> =
			(this.config.options?.headers as Record<string, string>) || {};
		const timeout: number = (this.config.options?.timeout as number) || 10000;

		// Add API key to headers if provided
		if (this.config.apiKey) {
			headers.Authorization = `Bearer ${this.config.apiKey}`;
		}

		const payload = {
			context,
			source: 'untrace',
			timestamp: new Date().toISOString(),
			trace,
		};

		const response = await this.makeRequest(this.config.endpoint, {
			body: JSON.stringify(payload),
			headers,
			method,
			timeout,
		});

		if (!response.ok) {
			throw new Error(
				`Webhook delivery failed: ${response.status} ${response.statusText}`,
			);
		}
	}

	async sendBatch(traces: TraceData[], context: TraceContext): Promise<void> {
		if (!this.config.endpoint) {
			throw new Error('Webhook endpoint is required');
		}

		const method: string = (this.config.options?.method as string) || 'POST';
		const headers: Record<string, string> =
			(this.config.options?.headers as Record<string, string>) || {};
		const timeout: number = (this.config.options?.timeout as number) || 10000;

		// Add API key to headers if provided
		if (this.config.apiKey) {
			headers.Authorization = `Bearer ${this.config.apiKey}`;
		}

		const payload = {
			batch: true,
			context,
			source: 'untrace',
			timestamp: new Date().toISOString(),
			traces,
		};

		const response = await this.makeRequest(this.config.endpoint, {
			body: JSON.stringify(payload),
			headers,
			method,
			timeout,
		});

		if (!response.ok) {
			throw new Error(
				`Webhook batch delivery failed: ${response.status} ${response.statusText}`,
			);
		}
	}

	async validateConfig(
		config: ProviderConfig,
	): Promise<{ success: boolean; error?: string }> {
		try {
			WebhookConfigSchema.parse(config);
			return { success: true };
		} catch (error) {
			return {
				error: error instanceof Error ? error.message : 'Invalid configuration',
				success: false,
			};
		}
	}

	getConfigSchema(): z.ZodSchema {
		return WebhookConfigSchema;
	}
}

// Webhook provider factory
export class WebhookProviderFactory implements ProviderFactory {
	createProvider(
		config: ProviderConfig,
		destinationId: string,
	): WebhookProvider {
		return new WebhookProvider(config, destinationId);
	}

	getDestinationId(): string {
		return 'webhook';
	}

	getConfigSchema(): z.ZodSchema {
		return WebhookConfigSchema;
	}
}

// Webhook test runner
export class WebhookTestRunner extends BaseDestinationTestRunner {
	async testConnection(config: Record<string, unknown>): Promise<TestResult> {
		try {
			const url = config.endpoint as string;

			if (!url) {
				return {
					details: {
						destination: this.destinationId,
						metadata: { config },
						testType: 'connection',
					},
					error: 'Missing required field: endpoint',
					message: 'URL is required for webhook destinations',
					success: false,
				};
			}

			// Test the connection by making a HEAD request
			const response = await fetch(url, {
				headers: {
					'User-Agent': 'Untrace-Test-Client/1.0',
					...((config.headers as Record<string, string>) || {}),
				},
				method: 'HEAD',
				signal: AbortSignal.timeout(5000),
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
					message: `Webhook connection test failed: ${response.status} ${response.statusText}`,
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
				message: `Webhook connection test to ${url} successful`,
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
				message: `Webhook connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
				success: false,
			};
		}
	}

	async testDelivery(
		config: Record<string, unknown>,
		trace: Record<string, unknown>,
	): Promise<TestResult> {
		try {
			const url = config.endpoint as string;
			const method = (config.method as string) || 'POST';

			if (!url) {
				return {
					details: {
						destination: this.destinationId,
						metadata: { config, trace },
						testType: 'delivery',
					},
					error: 'Missing required field: endpoint',
					message: 'URL is required for webhook destinations',
					success: false,
				};
			}

			// Test delivery by sending a sample trace
			const response = await fetch(url, {
				body: JSON.stringify({
					test: true,
					timestamp: new Date().toISOString(),
					trace,
				}),
				headers: {
					'Content-Type': 'application/json',
					'User-Agent': 'Untrace-Test-Client/1.0',
					...((config.headers as Record<string, string>) || {}),
				},
				method,
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
					message: `Webhook delivery test failed: ${response.status} ${response.statusText}`,
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
				message: `Webhook delivery test to ${url} successful`,
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
				message: `Webhook delivery test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
				success: false,
			};
		}
	}

	async validateConfig(config: Record<string, unknown>): Promise<TestResult> {
		try {
			const url = config.endpoint as string;

			if (!url) {
				return {
					details: {
						destination: this.destinationId,
						metadata: { config },
						testType: 'validation',
					},
					error: 'Missing required field: endpoint',
					message: 'URL is required for webhook destinations',
					success: false,
				};
			}

			// Basic URL validation
			try {
				new URL(url);
			} catch {
				return {
					details: {
						destination: this.destinationId,
						metadata: { config },
						testType: 'validation',
					},
					error: 'Invalid URL format',
					message: 'Invalid URL format',
					success: false,
				};
			}

			// Validate method if provided
			const method = config.method as string;
			if (
				method &&
				!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(
					method.toUpperCase(),
				)
			) {
				return {
					details: {
						destination: this.destinationId,
						metadata: { config },
						testType: 'validation',
					},
					error: 'Invalid HTTP method',
					message: 'Invalid HTTP method',
					success: false,
				};
			}

			return {
				details: {
					destination: this.destinationId,
					metadata: { config },
					testType: 'validation',
				},
				message: 'Webhook destination configuration is valid',
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

// Register the webhook provider and test runner
registerProvider(new WebhookProviderFactory());
registerDestinationTestRunner('webhook', WebhookTestRunner);
