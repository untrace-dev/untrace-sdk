import { init } from '@untrace/sdk';
import OpenAI from 'openai';

// Initialize Untrace SDK
const untrace = init({
  apiKey: 'usk-seed-key',
  baseUrl: 'http://localhost:3000',
  debug: true,
});

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'your-openai-api-key-here',
});
untrace.instrument('openai', openai);

// Test function that makes an OpenAI chat completion call
async function testOpenAIChatCompletion() {
  try {
    console.log('Starting OpenAI chat completion test...');

    const completion = await openai.chat.completions.create({
      max_tokens: 100,
      messages: [
        {
          content: 'Hello! Can you tell me a short joke?',
          role: 'user',
        },
      ],
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
    });

    console.log('OpenAI Response:', completion.choices[0]?.message?.content);
    console.log('Usage:', completion.usage);

    return completion;
  } catch (error) {
    console.error('Error in OpenAI chat completion:', error);
    throw error;
  }
}

// Test function that makes multiple calls to demonstrate tracing
async function testMultipleCalls() {
  try {
    console.log('\n=== Testing Multiple OpenAI Calls ===');

    const promises = [
      testOpenAIChatCompletion(),
      // testOpenAIChatCompletion(),
      // testOpenAIChatCompletion(),
    ];

    const results = await Promise.all(promises);
    console.log(`Completed ${results.length} calls successfully`);

    return results;
  } catch (error) {
    console.error('Error in multiple calls test:', error);
    throw error;
  }
}

// Main test function
async function runBasicTest() {
  try {
    console.log('=== Untrace SDK Basic Test ===');
    console.log(
      'SDK initialized with API key:',
      'usk-test-300nYp2JItCuoiHhaioQv82QHwo',
    );

    // Test single call
    await testOpenAIChatCompletion();

    // Wait a bit between calls
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Test multiple calls
    await testMultipleCalls();

    // Flush any pending spans
    await untrace.flush();

    console.log('\n=== Test Completed Successfully ===');
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  runBasicTest().catch(console.error);
}

export { testOpenAIChatCompletion, testMultipleCalls, runBasicTest };
