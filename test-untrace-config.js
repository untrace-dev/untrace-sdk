// Test script to verify Untrace configuration
import { init } from '@untrace/sdk';

async function testUntraceConfig() {
  try {
    console.log('Testing Untrace configuration...');
    console.log(
      'UNTRACE_API_KEY:',
      process.env.UNTRACE_API_KEY ? 'Set' : 'Not set',
    );
    console.log(
      'UNTRACE_BASE_URL:',
      process.env.UNTRACE_BASE_URL || 'Using default: http://localhost:3000',
    );

    const untrace = init({
      apiKey: process.env.UNTRACE_API_KEY ?? 'usk-seed-key',
      baseUrl: process.env.UNTRACE_BASE_URL || 'http://localhost:3000',
      debug: true,
      exportIntervalMs: 1000,
      maxBatchSize: 1,
    });

    console.log('✅ Untrace SDK initialized successfully');

    // Test creating a span
    const tracer = untrace.getTracer();
    const span = tracer.startSpan({
      attributes: {
        'test.key': 'test-value',
      },
      name: 'test-span',
    });

    span.setAttributes({
      'test.status': 'success',
    });

    span.end();

    console.log('✅ Test span created successfully');

    // Test flush
    await untrace.flush();
    console.log('✅ Untrace flush completed successfully');
  } catch (error) {
    console.error('❌ Error:', error.message);

    if (error.message.includes('401')) {
      console.log(
        '💡 Solution: Check your UNTRACE_API_KEY and UNTRACE_BASE_URL',
      );
    } else if (error.message.includes('network')) {
      console.log(
        '💡 Solution: Check your internet connection and API endpoint',
      );
    }
  }
}

testUntraceConfig();
