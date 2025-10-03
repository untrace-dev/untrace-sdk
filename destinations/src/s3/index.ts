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

// S3 provider configuration schema
const S3ConfigSchema = z.object({
	apiKey: z.string().optional(),
	enabled: z.boolean().default(true),
	endpoint: z.string().optional(),
	options: z
		.object({
			accessKeyId: z.string().optional(),
			batchSize: z.number().min(1).max(1000).default(100),
			bucket: z.string().min(1, 'Bucket name is required'),
			compression: z.boolean().default(true),
			flushInterval: z.number().min(60000).max(3600000).default(300000), // 5 minutes
			format: z.enum(['json', 'jsonl', 'parquet']).default('jsonl'),
			prefix: z.string().default('untrace'),
			region: z.string().default('us-east-1'),
			secretAccessKey: z.string().optional(),
		})
		.optional(),
});

export class S3Provider extends BaseIntegrationProvider {
	readonly name = 'Amazon S3';
	readonly destinationId = 's3';

	private bucket: string;
	private region: string;
	private accessKeyId?: string;
	private secretAccessKey?: string;
	private prefix: string;
	private compression: boolean;
	private format: 'json' | 'jsonl' | 'parquet';
	private batchSize: number;
	private flushInterval: number;
	private dataBuffer: Array<{
		trace: TraceData;
		context: TraceContext;
		timestamp: string;
	}> = [];
	private flushTimer?: NodeJS.Timeout;

	constructor(config: ProviderConfig, destinationId: string) {
		super(config, destinationId);
		this.bucket = (config.options?.bucket as string) || '';
		this.region = (config.options?.region as string) || 'us-east-1';
		this.accessKeyId = config.options?.accessKeyId as string;
		this.secretAccessKey = config.options?.secretAccessKey as string;
		this.prefix = (config.options?.prefix as string) || 'untrace';
		this.compression = (config.options?.compression as boolean) ?? true;
		this.format =
			(config.options?.format as 'json' | 'jsonl' | 'parquet') || 'jsonl';
		this.batchSize = (config.options?.batchSize as number) || 100;
		this.flushInterval = (config.options?.flushInterval as number) || 300000; // 5 minutes

		if (!this.bucket) {
			throw new Error('S3 bucket name is required');
		}

		// Set up automatic flushing
		this.setupAutoFlush();
	}

	async sendTrace(trace: TraceData, context: TraceContext): Promise<void> {
		if (!this.bucket) {
			throw new Error('S3 bucket name is required');
		}

		// Add trace to buffer
		this.addTraceToBuffer(trace, context);
	}

	async sendBatch(traces: TraceData[], context: TraceContext): Promise<void> {
		if (!this.bucket) {
			throw new Error('S3 bucket name is required');
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
			S3ConfigSchema.parse(config);
			return { success: true };
		} catch (error) {
			return {
				error: error instanceof Error ? error.message : 'Invalid configuration',
				success: false,
			};
		}
	}

	getConfigSchema(): z.ZodSchema {
		return S3ConfigSchema;
	}

	private addTraceToBuffer(trace: TraceData, context: TraceContext): void {
		this.dataBuffer.push({
			context,
			timestamp: new Date().toISOString(),
			trace,
		});

		// Flush if buffer is full
		if (this.dataBuffer.length >= this.batchSize) {
			this.flushToS3();
		}
	}

	private async flushToS3(): Promise<void> {
		if (this.dataBuffer.length === 0) {
			return;
		}

		const dataToFlush = [...this.dataBuffer];
		this.dataBuffer = [];

		try {
			await this.uploadBatchToS3(dataToFlush);
		} catch (error) {
			console.error('[S3Provider] Failed to flush data to S3:', error);
			// Re-add data to buffer for retry
			this.dataBuffer.unshift(...dataToFlush);
		}
	}

	private async uploadBatchToS3(
		data: Array<{
			trace: TraceData;
			context: TraceContext;
			timestamp: string;
		}>,
	): Promise<void> {
		const timestamp = new Date().toISOString();
		const date = timestamp.split('T')[0]; // YYYY-MM-DD
		const time =
			timestamp.split('T')[1]?.split('.')[0]?.replace(/:/g, '-') || '00-00-00'; // HH-MM-SS

		// Create S3 key
		const key = `${this.prefix}/traces/${date}/${time}-traces.${this.getFileExtension()}`;

		// Serialize data
		const body = this.serializeData(data);
		const contentType = this.getContentType();

		// Upload to S3
		await this.uploadToS3(key, body, contentType);
	}

	private async uploadToS3(
		key: string,
		body: string | Buffer,
		contentType: string,
	): Promise<void> {
		const url = `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;

		const headers: Record<string, string> = {
			'Content-Type': contentType,
			'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
			'x-amz-date': this.getAmzDate(),
		};

		// Add compression header if enabled
		if (this.compression) {
			headers['Content-Encoding'] = 'gzip';
		}

		// Add authorization header if credentials are provided
		if (this.accessKeyId && this.secretAccessKey) {
			headers.Authorization = this.generateAuthHeader(key, headers);
		}

		const response = await this.makeRequest(url, {
			body: typeof body === 'string' ? body : body.toString(),
			headers,
			method: 'PUT',
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(
				`S3 upload failed: ${response.status} ${response.statusText} - ${errorText}`,
			);
		}
	}

	private serializeData(
		data: Array<{
			trace: TraceData;
			context: TraceContext;
			timestamp: string;
		}>,
	): string | Buffer {
		let serialized: string;

		switch (this.format) {
			case 'json':
				serialized = JSON.stringify(data, null, 2);
				break;
			case 'jsonl':
				serialized = data.map((item) => JSON.stringify(item)).join('\n');
				break;
			case 'parquet':
				// For parquet, we would need a parquet library
				// For now, fall back to JSONL
				serialized = data.map((item) => JSON.stringify(item)).join('\n');
				break;
			default:
				serialized = JSON.stringify(data, null, 2);
		}

		// Compress if enabled
		if (this.compression) {
			return this.compressData(serialized);
		}

		return serialized;
	}

	private compressData(data: string): Buffer {
		// Note: In a real implementation, you would use a compression library
		// For now, we'll return the data as-is
		return Buffer.from(data, 'utf-8');
	}

	private getFileExtension(): string {
		switch (this.format) {
			case 'json':
				return 'json';
			case 'jsonl':
				return 'jsonl';
			case 'parquet':
				return 'parquet';
			default:
				return 'json';
		}
	}

	private getContentType(): string {
		switch (this.format) {
			case 'json':
				return 'application/json';
			case 'jsonl':
				return 'application/x-ndjson';
			case 'parquet':
				return 'application/octet-stream';
			default:
				return 'application/json';
		}
	}

	private getAmzDate(): string {
		return new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
	}

	private generateAuthHeader(
		_key: string,
		headers: Record<string, string>,
	): string {
		// Note: This is a simplified implementation
		// In a real implementation, you would use AWS Signature Version 4
		const credential = `${this.accessKeyId}/${this.getAmzDate().substring(0, 8)}/${this.region}/s3/aws4_request`;
		const signedHeaders = Object.keys(headers).sort().join(';');
		const signature = 'simplified-signature'; // Would be actual AWS signature

		return `AWS4-HMAC-SHA256 Credential=${credential}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
	}

	private setupAutoFlush(): void {
		this.flushTimer = setInterval(() => {
			this.flushToS3();
		}, this.flushInterval);
	}

	async destroy(): Promise<void> {
		if (this.flushTimer) {
			clearInterval(this.flushTimer);
			this.flushTimer = undefined;
		}
		await this.flushToS3();
	}
}

// S3 provider factory
export class S3ProviderFactory implements ProviderFactory {
	createProvider(config: ProviderConfig, destinationId: string): S3Provider {
		return new S3Provider(config, destinationId);
	}

	getDestinationId(): string {
		return 's3';
	}

	getConfigSchema(): z.ZodSchema {
		return S3ConfigSchema;
	}
}

// S3 test runner
export class S3TestRunner extends BaseDestinationTestRunner {
	async testConnection(config: Record<string, unknown>): Promise<TestResult> {
		try {
			const bucket = config.bucket as string;
			const region = (config.region as string) || 'us-east-1';
			const accessKeyId = config.accessKeyId as string;
			const secretAccessKey = config.secretAccessKey as string;

			if (!bucket) {
				return {
					details: {
						destination: this.destinationId,
						metadata: { config },
						testType: 'connection',
					},
					error: 'Missing required field: bucket',
					message: 'Bucket name is required for S3 destinations',
					success: false,
				};
			}

			// Test connection by making a HEAD request to the bucket
			const testUrl = `https://${bucket}.s3.${region}.amazonaws.com/`;
			const headers: Record<string, string> = {
				'x-amz-date': new Date().toISOString().replace(/[:-]|\.\d{3}/g, ''),
			};

			// Add authorization if credentials are provided
			if (accessKeyId && secretAccessKey) {
				headers.Authorization =
					'AWS4-HMAC-SHA256 Credential=test/test/test/s3/aws4_request, SignedHeaders=x-amz-date, Signature=test';
			}

			const response = await fetch(testUrl, {
				headers,
				method: 'HEAD',
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
					message: `S3 connection test failed: ${response.status} ${response.statusText}`,
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
				message: `S3 connection test to ${bucket} successful`,
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
				message: `S3 connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
				success: false,
			};
		}
	}

	async testDelivery(
		config: Record<string, unknown>,
		trace: Record<string, unknown>,
	): Promise<TestResult> {
		try {
			const bucket = config.bucket as string;
			const region = (config.region as string) || 'us-east-1';
			const prefix = (config.prefix as string) || 'untrace';

			if (!bucket) {
				return {
					details: {
						destination: this.destinationId,
						metadata: { config, trace },
						testType: 'delivery',
					},
					error: 'Missing required field: bucket',
					message: 'Bucket name is required for S3 destinations',
					success: false,
				};
			}

			// Test delivery by uploading a test file
			const timestamp = new Date().toISOString();
			const testKey = `${prefix}/test/${timestamp}-test.json`;
			const testUrl = `https://${bucket}.s3.${region}.amazonaws.com/${testKey}`;

			const response = await fetch(testUrl, {
				body: JSON.stringify({
					test: true,
					timestamp,
					trace,
				}),
				headers: {
					'Content-Type': 'application/json',
					'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
					'x-amz-date': new Date().toISOString().replace(/[:-]|\.\d{3}/g, ''),
				},
				method: 'PUT',
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
					message: `S3 delivery test failed: ${response.status} ${response.statusText}`,
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
				message: `S3 delivery test to ${bucket} successful`,
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
				message: `S3 delivery test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
				success: false,
			};
		}
	}

	async validateConfig(config: Record<string, unknown>): Promise<TestResult> {
		try {
			const bucket = config.bucket as string;
			const region = config.region as string;
			const format = config.format as string;

			if (!bucket) {
				return {
					details: {
						destination: this.destinationId,
						metadata: { config },
						testType: 'validation',
					},
					error: 'Missing required field: bucket',
					message: 'Bucket name is required for S3 destinations',
					success: false,
				};
			}

			// Validate format if provided
			if (format && !['json', 'jsonl', 'parquet'].includes(format)) {
				return {
					details: {
						destination: this.destinationId,
						metadata: { config },
						testType: 'validation',
					},
					error: 'Invalid format value',
					message: 'Format must be one of: json, jsonl, parquet',
					success: false,
				};
			}

			return {
				details: {
					destination: this.destinationId,
					metadata: { config },
					testType: 'validation',
				},
				message: 'S3 destination configuration is valid',
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

// Register the S3 provider and test runner
registerProvider(new S3ProviderFactory());
registerDestinationTestRunner('s3', S3TestRunner);
