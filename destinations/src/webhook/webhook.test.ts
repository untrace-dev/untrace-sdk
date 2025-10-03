import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { WebhookProvider, WebhookProviderFactory, WebhookTestRunner } from './index';
import { createDestinationTestService } from '../testing';
import type { TraceData, TraceContext } from '../providers';

// Mock fetch for testing
const originalFetch = globalThis.fetch;
let fetchCalls: any[] = [];

beforeEach(() => {
	// Reset fetch calls
	fetchCalls = [];
	
	// Mock fetch
	globalThis.fetch = async (url: any, options?: any) => {
		fetchCalls.push({ url, options });
		return {
			ok: true,
			status: 200,
			statusText: 'OK',
		} as Response;
	};
});

afterEach(() => {
	// Restore original fetch
	globalThis.fetch = originalFetch;
});

describe('WebhookProvider', () => {
	const validConfig = {
		endpoint: 'https://example.com/webhook',
		enabled: true,
		apiKey: 'test-api-key',
		options: {
			method: 'POST' as const,
			headers: { 'X-Custom': 'value' },
			timeout: 5000,
		},
	};

	const sampleTrace: TraceData = {
		id: 'test-trace-123',
		name: 'test-operation',
		timestamp: new Date().toISOString(),
		status: 'ok',
		duration: 150,
		attributes: { 'http.method': 'GET' },
		spans: [],
		events: [],
	};

	const sampleContext: TraceContext = {
		orgId: 'org-123',
		projectId: 'project-456',
		userId: 'user-789',
		apiKeyId: 'key-abc',
	};

	describe('Provider Creation', () => {
		it('should create provider with valid config', () => {
			const provider = new WebhookProvider(validConfig, 'test-destination');
			
			expect(provider.name).toBe('Webhook');
			expect(provider.destinationId).toBe('webhook');
			expect(provider.isEnabled()).toBe(true);
		});

		it('should create provider via factory', () => {
			const factory = new WebhookProviderFactory();
			const provider = factory.createProvider(validConfig, 'test-destination');
			
			expect(provider).toBeInstanceOf(WebhookProvider);
			expect(factory.getDestinationId()).toBe('webhook');
		});
	});

	describe('Configuration Validation', () => {
		it('should validate correct configuration', async () => {
			const provider = new WebhookProvider(validConfig, 'test-destination');
			const result = await provider.validateConfig(validConfig);
			
			expect(result.success).toBe(true);
			expect(result.error).toBeUndefined();
		});

		it('should reject invalid URL', async () => {
			const invalidConfig = { ...validConfig, endpoint: 'not-a-url' };
			const provider = new WebhookProvider(invalidConfig, 'test-destination');
			const result = await provider.validateConfig(invalidConfig);
			
			expect(result.success).toBe(false);
			expect(result.error).toContain('Invalid webhook URL');
		});

		it('should reject missing endpoint', async () => {
			const invalidConfig = { ...validConfig };
			delete invalidConfig.endpoint;
			const provider = new WebhookProvider(invalidConfig, 'test-destination');
			const result = await provider.validateConfig(invalidConfig);
			
			expect(result.success).toBe(false);
			expect(result.error).toContain('endpoint');
		});
	});

	describe('Trace Delivery', () => {
		it('should send trace successfully', async () => {
			const provider = new WebhookProvider(validConfig, 'test-destination');
			await provider.sendTrace(sampleTrace, sampleContext);

			expect(fetchCalls).toHaveLength(1);
			const call = fetchCalls[0];
			
			expect(call.url).toBe(validConfig.endpoint);
			expect(call.options.method).toBe('POST');
			expect(call.options.headers).toMatchObject({
				'Content-Type': 'application/json',
				'User-Agent': 'Untrace-Integration/1.0',
				'Authorization': 'Bearer test-api-key',
				'X-Custom': 'value',
			});

			const body = JSON.parse(call.options.body as string);
			expect(body).toMatchObject({
				context: sampleContext,
				source: 'untrace',
				trace: sampleTrace,
			});
			expect(body.timestamp).toBeDefined();
		});

		it('should send batch traces successfully', async () => {
			const provider = new WebhookProvider(validConfig, 'test-destination');
			const traces = [sampleTrace, { ...sampleTrace, id: 'trace-456' }];
			
			await provider.sendBatch(traces, sampleContext);

			expect(fetchCalls).toHaveLength(1);
			const call = fetchCalls[0];
			
			const body = JSON.parse(call.options.body as string);
			expect(body.batch).toBe(true);
			expect(body.traces).toHaveLength(2);
		});

		it('should throw error when endpoint is missing', async () => {
			const configWithoutEndpoint = { ...validConfig };
			delete configWithoutEndpoint.endpoint;
			const provider = new WebhookProvider(configWithoutEndpoint, 'test-destination');
			
			await expect(provider.sendTrace(sampleTrace, sampleContext))
				.rejects.toThrow('Webhook endpoint is required');
		});
	});
});

describe('WebhookTestRunner', () => {
	const testRunner = new WebhookTestRunner('webhook');

	describe('Connection Testing', () => {
		it('should test connection successfully', async () => {
			const config = { endpoint: 'https://example.com/webhook' };
			const result = await testRunner.testConnection(config);

			expect(result.success).toBe(true);
			expect(result.message).toContain('successful');
			expect(result.details?.testType).toBe('connection');
			expect(result.details?.destination).toBe('webhook');
		});

		it('should fail when endpoint is missing', async () => {
			const config = {};
			const result = await testRunner.testConnection(config);

			expect(result.success).toBe(false);
			expect(result.error).toContain('Missing required field: endpoint');
		});
	});

	describe('Delivery Testing', () => {
		it('should test delivery successfully', async () => {
			const config = { endpoint: 'https://example.com/webhook' };
			const trace = { id: 'test-trace', name: 'test-operation' };
			const result = await testRunner.testDelivery(config, trace);

			expect(result.success).toBe(true);
			expect(result.message).toContain('successful');
			expect(result.details?.testType).toBe('delivery');

			// Verify the request was made correctly
			expect(fetchCalls).toHaveLength(1);
			const call = fetchCalls[0];
			const body = JSON.parse(call.options.body as string);
			expect(body.test).toBe(true);
			expect(body.trace).toEqual(trace);
		});

		it('should fail when endpoint is missing', async () => {
			const config = {};
			const trace = { id: 'test-trace' };
			const result = await testRunner.testDelivery(config, trace);

			expect(result.success).toBe(false);
			expect(result.error).toContain('Missing required field: endpoint');
		});
	});

	describe('Configuration Validation', () => {
		it('should validate correct configuration', async () => {
			const config = { endpoint: 'https://example.com/webhook' };
			const result = await testRunner.validateConfig(config);

			expect(result.success).toBe(true);
			expect(result.message).toContain('valid');
			expect(result.details?.testType).toBe('validation');
		});

		it('should reject missing endpoint', async () => {
			const config = {};
			const result = await testRunner.validateConfig(config);

			expect(result.success).toBe(false);
			expect(result.error).toContain('Missing required field: endpoint');
		});

		it('should reject invalid URL format', async () => {
			const config = { endpoint: 'not-a-url' };
			const result = await testRunner.validateConfig(config);

			expect(result.success).toBe(false);
			expect(result.error).toContain('Invalid URL format');
		});

		it('should accept valid HTTP methods', async () => {
			const validMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
			
			for (const method of validMethods) {
				const config = { 
					endpoint: 'https://example.com/webhook',
					method 
				};
				const result = await testRunner.validateConfig(config);
				
				expect(result.success).toBe(true);
			}
		});
	});
});

describe('Destination Test Service Integration', () => {
	const testService = createDestinationTestService();

	it('should test webhook connection via service', async () => {
		const config = { endpoint: 'https://example.com/webhook' };
		const result = await testService.testConnection('webhook', config);

		expect(result.success).toBe(true);
		expect(result.details?.destination).toBe('webhook');
		expect(result.details?.testType).toBe('connection');
	});

	it('should test webhook delivery via service', async () => {
		const config = { endpoint: 'https://example.com/webhook' };
		const result = await testService.testDelivery('webhook', config);

		expect(result.success).toBe(true);
		expect(result.details?.destination).toBe('webhook');
		expect(result.details?.testType).toBe('delivery');
	});

	it('should test webhook validation via service', async () => {
		const config = { endpoint: 'https://example.com/webhook' };
		const result = await testService.validateConfig('webhook', config);

		expect(result.success).toBe(true);
		expect(result.details?.destination).toBe('webhook');
		expect(result.details?.testType).toBe('validation');
	});

	it('should handle unknown destination gracefully', async () => {
		const config = { endpoint: 'https://example.com/webhook' };
		const result = await testService.testConnection('unknown-destination', config);

		expect(result.success).toBe(false);
		expect(result.error).toContain('Test runner not found');
	});
});
