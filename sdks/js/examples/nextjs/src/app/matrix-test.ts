/**
 * Test file to demonstrate the matrix-based auto-instrumentation approach
 *
 * This shows how the new system can handle different SDK-Provider combinations
 * without relying on URL patterns or custom configurations.
 */

'use server';

import { bedrock } from '@ai-sdk/amazon-bedrock';
import { openai } from '@ai-sdk/openai';
import { init } from '@untrace/sdk';
import { generateText } from 'ai';

// Initialize Untrace with matrix-based auto-instrumentation
init({
	apiKey: process.env.UNTRACE_API_KEY || 'usk-seed-key',
	baseUrl: process.env.UNTRACE_BASE_URL || 'http://localhost:3000',
	debug: true,
	disableAutoInstrumentation: false, // Enable the new matrix-based approach
	exportIntervalMs: 1000,
	maxBatchSize: 1,
});

/**
 * Test AI SDK with Bedrock (should be instrumented via SDK-level)
 */
export async function testAISDKWithBedrock(prompt: string) {
	console.log('[Matrix Test] Testing AI SDK + Bedrock combination');

	try {
		const result = await generateText({
			maxOutputTokens: 100,
			model: bedrock('anthropic.claude-3-5-sonnet-20241022-v2:0'),
			prompt,
		});

		console.log('[Matrix Test] AI SDK + Bedrock result:', result.text);
		return { success: true, text: result.text };
	} catch (error) {
		console.error('[Matrix Test] AI SDK + Bedrock error:', error);
		return {
			error: error instanceof Error ? error.message : 'Unknown error',
			success: false,
		};
	}
}

/**
 * Test AI SDK with OpenAI (should be instrumented via SDK-level)
 */
export async function testAISDKWithOpenAI(prompt: string) {
	console.log('[Matrix Test] Testing AI SDK + OpenAI combination');

	try {
		const result = await generateText({
			maxOutputTokens: 100,
			model: openai('gpt-4o-mini'),
			prompt,
		});

		console.log('[Matrix Test] AI SDK + OpenAI result:', result.text);
		return { success: true, text: result.text };
	} catch (error) {
		console.error('[Matrix Test] AI SDK + OpenAI error:', error);
		return {
			error: error instanceof Error ? error.message : 'Unknown error',
			success: false,
		};
	}
}

/**
 * Test with custom base URL (should still work via HTTP-level fallback)
 */
export async function testCustomBaseURL(prompt: string) {
	console.log('[Matrix Test] Testing custom base URL scenario');

	try {
		// This would use a custom base URL if configured
		const result = await generateText({
			maxOutputTokens: 100,
			model: openai('gpt-4o-mini'),
			prompt,
		});

		console.log('[Matrix Test] Custom base URL result:', result.text);
		return { success: true, text: result.text };
	} catch (error) {
		console.error('[Matrix Test] Custom base URL error:', error);
		return {
			error: error instanceof Error ? error.message : 'Unknown error',
			success: false,
		};
	}
}

/**
 * Test multiple combinations in sequence
 */
export async function testMultipleCombinations(prompt: string) {
	console.log('[Matrix Test] Testing multiple SDK-Provider combinations');

	const results = {
		aiSdkBedrock: await testAISDKWithBedrock(prompt),
		aiSdkOpenAI: await testAISDKWithOpenAI(prompt),
		// customBaseURL: await testCustomBaseURL(prompt), // Commented out as it requires custom proxy
	};

	console.log('[Matrix Test] All combinations tested:', results);
	return results;
}

/**
 * Get instrumentation status
 */
export async function getInstrumentationStatus() {
	console.log('[Matrix Test] Getting instrumentation status');

	// This would show which SDK-Provider combinations are currently instrumented
	// and which strategy is being used for each
	return {
		message: 'Matrix-based auto-instrumentation is active',
		note: 'Check the Untrace dashboard to see traces for each SDK-Provider combination',
	};
}
