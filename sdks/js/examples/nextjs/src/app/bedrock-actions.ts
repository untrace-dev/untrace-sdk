'use server';

import { init } from '@untrace/sdk';
import { bedrock } from '@ai-sdk/amazon-bedrock';
import { generateText, streamText } from 'ai';

// Initialize SDK once at module level (following OpenTelemetry best practices)
const untraceApiKey = process.env.UNTRACE_API_KEY;
const untraceBaseUrl = process.env.UNTRACE_BASE_URL || 'http://localhost:3000';

// Initialize Untrace SDK
const untrace = init({
	apiKey: untraceApiKey || 'usk-seed-key',
	baseUrl: untraceBaseUrl,
	debug: true, // Enable debug logging
	exportIntervalMs: 1000, // Export every 1 second for testing
	maxBatchSize: 1, // Export immediately when 1 span is ready
	disableAutoInstrumentation: true, // Disable auto-instrumentation for now
});

// Available Anthropic Claude models on AWS Bedrock
// Using system-defined inference profile ARNs for newer models
const CLAUDE_MODELS = {
	'claude-sonnet-4': 'arn:aws:bedrock:us-east-2:912606813959:inference-profile/global.anthropic.claude-sonnet-4-20250514-v1:0',
	'claude-3-haiku': process.env.CLAUDE_3_HAIKU_PROFILE_ARN || 'anthropic.claude-3-haiku-20240307-v1:0',
	'claude-3-5-sonnet': process.env.CLAUDE_3_5_SONNET_PROFILE_ARN || 'anthropic.claude-3-5-sonnet-20241022-v2:0',
	'claude-3-5-haiku': process.env.CLAUDE_3_5_HAIKU_PROFILE_ARN || 'anthropic.claude-3-5-haiku-20241022-v1:0',
	'claude-3-sonnet': process.env.CLAUDE_3_SONNET_PROFILE_ARN || 'anthropic.claude-3-sonnet-20240229-v1:0',
	'claude-3-opus': process.env.CLAUDE_3_OPUS_PROFILE_ARN || 'anthropic.claude-3-opus-20240229-v1:0',
} as const;

type ClaudeModel = keyof typeof CLAUDE_MODELS;

export async function generateClaudeResponse(
	prompt: string,
	model: ClaudeModel = 'claude-3-5-sonnet',
) {
	try {
		// Create a span with proper OpenTelemetry LLM attributes
		const span = untrace.getTracer().startSpan({
			attributes: {
				'llm.provider': 'aws-bedrock',
				'llm.model': model,
				'llm.operation.type': 'chat',
				'llm.messages': JSON.stringify([{ role: 'user', content: prompt }]),
				'llm.temperature': 0.7,
				'llm.max_tokens': 1000,
			},
			name: 'ai-sdk.generateText',
		});

		try {
			const { text } = await generateText({
				model: bedrock(CLAUDE_MODELS[model]),
				prompt,
				maxOutputTokens: 1000,
				temperature: 0.7,
			});

			// Set response attributes
			span.setAttributes({
				'llm.choices': JSON.stringify([{ message: { role: 'assistant', content: text } }]),
				'llm.total.tokens': text.length, // Approximate token count
				'llm.completion.tokens': text.length,
				'llm.prompt.tokens': prompt.length,
			});

			span.end();

			// Force flush spans to see them exported immediately
			console.log('[Untrace] Calling flush()...');
			await untrace.flush();
			console.log('[Untrace] Flush completed');

			return { model, success: true, text };
		} catch (error) {
			span.setAttributes({
				'llm.error': error instanceof Error ? error.message : 'Unknown error',
				'llm.error.type': 'api_error',
			});
			span.end();
			throw error;
		}
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
		// Create a span with proper OpenTelemetry LLM attributes
		const span = untrace.getTracer().startSpan({
			attributes: {
				'llm.provider': 'aws-bedrock',
				'llm.model': model,
				'llm.operation.type': 'chat',
				'llm.messages': JSON.stringify([{ role: 'user', content: prompt }]),
				'llm.temperature': 0.7,
				'llm.max_tokens': 1000,
				'llm.stream': true,
			},
			name: 'ai-sdk.streamText',
		});

		try {
			const result = await streamText({
				model: bedrock(CLAUDE_MODELS[model]),
				prompt,
				maxOutputTokens: 1000,
				temperature: 0.7,
			});

			// For streaming, we can't easily extract the full response
			span.setAttributes({
				'llm.stream': true,
				'llm.total.tokens': prompt.length, // Approximate for streaming
			});

			span.end();

			// Force flush spans to see them exported immediately
			console.log('[Untrace] Calling flush()...');
			await untrace.flush();
			console.log('[Untrace] Flush completed');

			return { model, stream: result, success: true };
		} catch (error) {
			span.setAttributes({
				'llm.error': error instanceof Error ? error.message : 'Unknown error',
				'llm.error.type': 'api_error',
			});
			span.end();
			throw error;
		}
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
