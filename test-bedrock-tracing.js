#!/usr/bin/env node

// Test script to verify Bedrock tracing works
import { generateClaudeResponse } from './sdks/js/examples/nextjs/src/app/bedrock-actions.js';

async function testBedrockTracing() {
  console.log('Testing Bedrock tracing...');

  try {
    const result = await generateClaudeResponse(
      'Hello, this is a test message',
      'claude-3-5-sonnet',
    );

    console.log('Result:', result);

    if (result.success) {
      console.log('✅ Bedrock tracing test successful!');
      console.log('Response:', result.text);
    } else {
      console.log('❌ Bedrock tracing test failed:', result.error);
    }
  } catch (error) {
    console.error('❌ Error during Bedrock tracing test:', error);
  }
}

testBedrockTracing();
