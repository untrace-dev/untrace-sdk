import { z } from 'zod';

// Test result schema
export const TestResultSchema = z.object({
	details: z
		.object({
			destination: z.string().optional(),
			destinationName: z.string().optional(),
			duration: z.number().optional(),
			metadata: z.record(z.string(), z.unknown()).optional(),
			testType: z.enum(['connection', 'delivery', 'validation']),
		})
		.optional(),
	error: z.string().optional(),
	message: z.string(),
	success: z.boolean(),
});

export type TestResult = z.infer<typeof TestResultSchema>;

// Sample trace data for testing
export const SAMPLE_TRACE_DATA = {
	attributes: {
		'http.method': 'GET',
		'http.status_code': 200,
		'operation.name': 'test-operation',
		'service.name': 'test-service',
	},
	duration: 150,
	events: [
		{
			attributes: {
				'event.message': 'This is a test event',
				'event.type': 'test',
			},
			name: 'test-event',
			timestamp: new Date().toISOString(),
		},
	],
	id: 'test-trace-123',
	name: 'test-operation',
	spans: [
		{
			attributes: {
				'span.kind': 'internal',
				'span.type': 'test',
			},
			duration: 100,
			id: 'test-span-456',
			name: 'test-span',
			status: 'ok',
			timestamp: new Date().toISOString(),
		},
	],
	status: 'ok',
	timestamp: new Date().toISOString(),
};

export interface DestinationTestConfig {
	destinationId: string;
	config: Record<string, unknown>;
	sampleTrace?: Record<string, unknown>;
	testType?: 'connection' | 'delivery' | 'validation';
}

// Public interface for destination test runners
export interface DestinationTestRunner {
	testConnection(config: Record<string, unknown>): Promise<TestResult>;
	testDelivery(
		config: Record<string, unknown>,
		trace: Record<string, unknown>,
	): Promise<TestResult>;
	validateConfig(config: Record<string, unknown>): Promise<TestResult>;
}

// Base class for destination test runners
export abstract class BaseDestinationTestRunner
	implements DestinationTestRunner {
	constructor(protected destinationId: string) { }

	abstract testConnection(config: Record<string, unknown>): Promise<TestResult>;
	abstract testDelivery(
		config: Record<string, unknown>,
		trace: Record<string, unknown>,
	): Promise<TestResult>;
	abstract validateConfig(config: Record<string, unknown>): Promise<TestResult>;
}

// Registry for destination test runners
const testRunnerRegistry = new Map<
	string,
	new (destinationId: string) => DestinationTestRunner
>();

export function registerDestinationTestRunner(
	destinationId: string,
	runnerClass: new (destinationId: string) => DestinationTestRunner,
): void {
	testRunnerRegistry.set(destinationId, runnerClass);
}

export function getDestinationTestRunner(
	destinationId: string,
): DestinationTestRunner | null {
	const RunnerClass = testRunnerRegistry.get(destinationId);
	if (!RunnerClass) {
		return null;
	}
	return new RunnerClass(destinationId);
}

export function getRegisteredTestRunners(): string[] {
	return Array.from(testRunnerRegistry.keys());
}

// Main test service for SDK
export class DestinationTestService {
	async testDestination(config: DestinationTestConfig): Promise<TestResult> {
		const runner = getDestinationTestRunner(config.destinationId);
		if (!runner) {
			return {
				details: {
					destination: config.destinationId,
					metadata: { config },
					testType: 'validation',
				},
				error: 'Test runner not found',
				message: `No test runner found for destination: ${config.destinationId}`,
				success: false,
			};
		}

		const trace = config.sampleTrace || SAMPLE_TRACE_DATA;
		const testType = config.testType || 'delivery';

		switch (testType) {
			case 'connection':
				return runner.testConnection(config.config);
			case 'delivery':
				return runner.testDelivery(config.config, trace);
			case 'validation':
				return runner.validateConfig(config.config);
			default:
				return runner.testDelivery(config.config, trace);
		}
	}

	async testConnection(
		destinationId: string,
		config: Record<string, unknown>,
	): Promise<TestResult> {
		const runner = getDestinationTestRunner(destinationId);
		if (!runner) {
			return {
				details: {
					destination: destinationId,
					metadata: { config },
					testType: 'connection',
				},
				error: 'Test runner not found',
				message: `No test runner found for destination: ${destinationId}`,
				success: false,
			};
		}
		return runner.testConnection(config);
	}

	async testDelivery(
		destinationId: string,
		config: Record<string, unknown>,
		trace: Record<string, unknown> = SAMPLE_TRACE_DATA,
	): Promise<TestResult> {
		const runner = getDestinationTestRunner(destinationId);
		if (!runner) {
			return {
				details: {
					destination: destinationId,
					metadata: { config, trace },
					testType: 'delivery',
				},
				error: 'Test runner not found',
				message: `No test runner found for destination: ${destinationId}`,
				success: false,
			};
		}
		return runner.testDelivery(config, trace);
	}

	async validateConfig(
		destinationId: string,
		config: Record<string, unknown>,
	): Promise<TestResult> {
		const runner = getDestinationTestRunner(destinationId);
		if (!runner) {
			return {
				details: {
					destination: destinationId,
					metadata: { config },
					testType: 'validation',
				},
				error: 'Test runner not found',
				message: `No test runner found for destination: ${destinationId}`,
				success: false,
			};
		}
		return runner.validateConfig(config);
	}
}

export function createDestinationTestService(): DestinationTestService {
	return new DestinationTestService();
}
