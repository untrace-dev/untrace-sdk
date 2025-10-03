'use server';

import { bedrock } from '@ai-sdk/amazon-bedrock';
import { init } from '@untrace/sdk';
import { generateText } from 'ai';
import OpenAI from 'openai';

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
	// No need to specify providers - HTTP instrumentation captures ALL LLM requests automatically
});

// Create OpenAI client
const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
});

// Available models for different providers
const MODELS = {
	bedrock: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
	openai: 'gpt-3.5-turbo',
} as const;

type Provider = keyof typeof MODELS;

/**
 * Generate text using any provider - auto-instrumentation handles tracing automatically
 */
export async function generateTextWithProvider(
	prompt: string,
	provider: Provider = 'openai',
) {
	try {
		let text: string;

		if (provider === 'openai') {
			// OpenAI provider - auto-instrumentation captures all attributes
			const completion = await openai.chat.completions.create({
				messages: [{ content: prompt, role: 'user' }],
				model: MODELS.openai,
			});
			text = completion.choices[0]?.message?.content || '';
		} else if (provider === 'bedrock') {
			// Bedrock via AI SDK - auto-instrumentation captures all attributes
			const { text: bedrockText } = await generateText({
				maxOutputTokens: 1000,
				model: bedrock(MODELS.bedrock),
				prompt,
				temperature: 0.7,
			});
			text = bedrockText;
		} else {
			throw new Error(`Unsupported provider: ${provider}`);
		}

		// Force flush spans to see them exported immediately
		console.log('[Untrace] Calling flush()...');
		await untrace.flush();
		console.log('[Untrace] Flush completed');

		return { provider, success: true, text };
	} catch (error) {
		console.error(`Error generating text with ${provider}:`, error);
		return {
			error: error instanceof Error ? error.message : 'Unknown error occurred',
			provider,
			success: false,
		};
	}
}

/**
 * Compare responses from multiple providers - each call is automatically traced
 */
export async function compareProviders(prompt: string) {
	try {
		const providers: Provider[] = ['openai', 'bedrock'];

		// Auto-instrumentation will handle tracing for each individual call
		const results = await Promise.allSettled(
			providers.map(async (provider) => {
				const result = await generateTextWithProvider(prompt, provider);
				return { provider, result };
			}),
		);

		const responses = results.map((result, index) => ({
			error: result.status === 'rejected' ? result.reason : null,
			provider: providers[index] || 'unknown',
			response: result.status === 'fulfilled' ? result.value.result : null,
			success: result.status === 'fulfilled',
		}));

		// Force flush spans to see them exported immediately
		console.log('[Untrace] Calling flush()...');
		await untrace.flush();
		console.log('[Untrace] Flush completed');

		return { responses, success: true };
	} catch (error) {
		console.error('Error comparing providers:', error);
		return {
			error: error instanceof Error ? error.message : 'Unknown error occurred',
			success: false,
		};
	}
}
