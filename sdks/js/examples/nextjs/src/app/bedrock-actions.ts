'use server';

import { bedrock } from '@ai-sdk/amazon-bedrock';
import { init } from '@untrace/sdk';
import { generateText, streamText } from 'ai';

// Initialize SDK once at module level (following OpenTelemetry best practices)
const untraceApiKey = process.env.UNTRACE_API_KEY;
const untraceBaseUrl = process.env.UNTRACE_BASE_URL || 'http://localhost:3000';

// Initialize Untrace SDK with HTTP-based auto-instrumentation
const untrace = init({
	apiKey: untraceApiKey || 'usk-seed-key',
	baseUrl: untraceBaseUrl,
	debug: true, // Enable debug logging
	disableAutoInstrumentation: false, // Enable auto-instrumentation
	exportIntervalMs: 1000, // Export every 1 second for testing
	maxBatchSize: 1, // Export immediately when 1 span is ready
	// No need to specify providers - HTTP instrumentation captures all LLM requests automatically
});

// Available Anthropic Claude models on AWS Bedrock
// Using system-defined inference profile ARNs for newer models
const CLAUDE_MODELS = {
	'claude-3-5-haiku':
		process.env.CLAUDE_3_5_HAIKU_PROFILE_ARN ||
		'anthropic.claude-3-5-haiku-20241022-v1:0',
	'claude-3-5-sonnet':
		process.env.CLAUDE_3_5_SONNET_PROFILE_ARN ||
		'anthropic.claude-3-5-sonnet-20241022-v2:0',
	'claude-3-haiku':
		process.env.CLAUDE_3_HAIKU_PROFILE_ARN ||
		'anthropic.claude-3-haiku-20240307-v1:0',
	'claude-3-opus':
		process.env.CLAUDE_3_OPUS_PROFILE_ARN ||
		'anthropic.claude-3-opus-20240229-v1:0',
	'claude-3-sonnet':
		process.env.CLAUDE_3_SONNET_PROFILE_ARN ||
		'anthropic.claude-3-sonnet-20240229-v1:0',
	'claude-sonnet-4':
		'arn:aws:bedrock:us-east-2:912606813959:inference-profile/global.anthropic.claude-sonnet-4-20250514-v1:0',
} as const;

type ClaudeModel = keyof typeof CLAUDE_MODELS;

export async function generateClaudeResponse(
	prompt: string,
	model: ClaudeModel = 'claude-3-5-sonnet',
) {
	try {
		// Auto-instrumentation will handle tracing automatically
		const { text } = await generateText({
			maxOutputTokens: 1000,
			model: bedrock(CLAUDE_MODELS[model]),
			prompt,
			temperature: 0.7,
		});

		// Force flush spans to see them exported immediately
		console.log('[Untrace] Calling flush()...');
		await untrace.flush();
		console.log('[Untrace] Flush completed');

		return { model, success: true, text };
	} catch (error) {
		console.error('Error generating Claude response:', error);
		return {
			error: error instanceof Error ? error.message : 'Unknown error occurred',
			success: false,
		};
	}
}

export async function streamClaudeResponse(
	prompt: string,
	model: ClaudeModel = 'claude-3-5-sonnet',
) {
	try {
		// Auto-instrumentation will handle tracing automatically
		const result = streamText({
			maxOutputTokens: 1000,
			model: bedrock(CLAUDE_MODELS[model]),
			prompt,
			temperature: 0.7,
		});

		// Force flush spans to see them exported immediately
		console.log('[Untrace] Calling flush()...');
		await untrace.flush();
		console.log('[Untrace] Flush completed');

		return { model, stream: result, success: true };
	} catch (error) {
		console.error('Error streaming Claude response:', error);
		return {
			error: error instanceof Error ? error.message : 'Unknown error occurred',
			success: false,
		};
	}
}

export async function compareClaudeModels(prompt: string) {
	try {
		const models: ClaudeModel[] = [
			'claude-sonnet-4',
			'claude-3-haiku',
			'claude-3-5-sonnet',
			'claude-3-5-haiku',
			'claude-3-sonnet',
		];

		// Auto-instrumentation will handle tracing for each individual call
		const results = await Promise.allSettled(
			models.map(async (model) => {
				const result = await generateClaudeResponse(prompt, model);
				return { model, result };
			}),
		);

		const responses = results.map((result, index) => ({
			error: result.status === 'rejected' ? result.reason : null,
			model: models[index] || 'unknown',
			response: result.status === 'fulfilled' ? result.value.result : null,
			success: result.status === 'fulfilled',
		}));

		// Force flush spans to see them exported immediately
		console.log('[Untrace] Calling flush()...');
		await untrace.flush();
		console.log('[Untrace] Flush completed');

		return { responses, success: true };
	} catch (error) {
		console.error('Error comparing Claude models:', error);
		return {
			error: error instanceof Error ? error.message : 'Unknown error occurred',
			success: false,
		};
	}
}
