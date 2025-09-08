'use server';

import { init } from '@untrace/sdk';
import OpenAI from 'openai';

// Initialize SDK once at module level (following OpenTelemetry best practices)
const untrace = init({
  apiKey: 'usk-live-x0441z0y3c7t9up9db0longh',
  baseUrl: 'http://localhost:3000',
  debug: true, // Enable debug logging
  exportIntervalMs: 1000, // Export every 1 second for testing
  maxBatchSize: 1, // Export immediately when 1 span is ready
});

// Create and instrument OpenAI client once at module level
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const instrumentedOpenAI = untrace.instrument('openai', openai);

export async function generateAIResponse(prompt: string) {
  try {
    const completion = await instrumentedOpenAI.chat.completions.create({
      messages: [
        {
          content: prompt,
          role: 'user',
        },
      ],
      model: 'gpt-3.5-turbo',
    });

    const text = completion.choices[0]?.message?.content || '';

    // Force flush spans to see them exported immediately
    console.log('[Untrace] Calling flush()...');
    await untrace.flush();
    console.log('[Untrace] Flush completed');

    return { success: true, text };
  } catch (error) {
    console.error('Error generating AI response:', error);
    return {
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      success: false,
    };
  }
}
