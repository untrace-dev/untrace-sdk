import {
  cached,
  errorHandler,
  init,
  llmOperation,
  metric,
  timed,
  trace,
} from '@untrace/sdk';

// Initialize Untrace SDK
init({
  apiKey: process.env.UNTRACE_API_KEY || 'demo-api-key',
});

/**
 * Example service demonstrating basic decorator usage
 */
class DataProcessingService {
  /**
   * Basic traced method
   */
  @trace({ name: 'processData' })
  async processData(data: string[]): Promise<number> {
    console.log('Processing data...');
    // Simulate some processing
    await new Promise((resolve) => setTimeout(resolve, 100));
    return data.length;
  }

  /**
   * Method with automatic metrics recording
   */
  @metric({ recordDuration: true })
  async analyzeData(
    data: string[],
  ): Promise<{ total: number; average: number }> {
    const total = data.reduce((sum, item) => sum + item.length, 0);
    const average = total / data.length;

    // Simulate analysis work
    await new Promise((resolve) => setTimeout(resolve, 50));

    return { average, total };
  }

  /**
   * Cached computation
   */
  @cached({ ttl: 5000 }) // Cache for 5 seconds
  @trace()
  async expensiveCalculation(input: number): Promise<number> {
    console.log(`Calculating for input: ${input}`);
    // Simulate expensive work
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return input * Math.PI * Math.E;
  }

  /**
   * Error handling example
   */
  @errorHandler({ rethrow: true })
  @trace({ attributes: { 'operation.type': 'validation' } })
  async validateData(data: unknown): Promise<boolean> {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid data: must be an object');
    }

    if (!('id' in data)) {
      throw new Error('Invalid data: missing required field "id"');
    }

    return true;
  }

  /**
   * Simple timing example
   */
  @timed('DataTransformation')
  async transformData(input: string[]): Promise<string[]> {
    return input.map((item) => item.toUpperCase());
  }

  /**
   * Multiple decorators example
   */
  @metric({ recordDuration: true })
  @trace({ kind: 2, name: 'aggregateResults' })
  @cached({ ttl: 10000 })
  async aggregateResults(datasets: string[][]): Promise<{
    totalItems: number;
    totalDatasets: number;
    averageSize: number;
  }> {
    console.log('Aggregating results...');
    await new Promise((resolve) => setTimeout(resolve, 200));

    const totalItems = datasets.reduce(
      (sum, dataset) => sum + dataset.length,
      0,
    );
    const totalDatasets = datasets.length;
    const averageSize = totalItems / totalDatasets;

    return {
      averageSize,
      totalDatasets,
      totalItems,
    };
  }
}

/**
 * Mock LLM service for demonstration
 */
class MockLLMService {
  @llmOperation({
    extractCost: (result: unknown) => {
      const res = result as { tokens: number };
      const cost = res.tokens * 0.0001; // $0.0001 per token
      return {
        input: cost * 0.7,
        model: 'mock-model',
        output: cost * 0.3,
        provider: 'mock-provider',
        total: cost,
      };
    },
    extractTokenUsage: (result: unknown) => {
      const res = result as { tokens: number };
      return {
        completionTokens: res.tokens * 0.3,
        model: 'mock-model',
        promptTokens: res.tokens * 0.7,
        provider: 'mock-provider',
        totalTokens: res.tokens,
      };
    },
    model: 'mock-model',
    provider: 'mock-provider',
    type: 'completion',
  })
  async complete(prompt: string): Promise<{ text: string; tokens: number }> {
    // Simulate LLM processing
    await new Promise((resolve) => setTimeout(resolve, 300));

    return {
      text: `Completed: ${prompt}`,
      tokens: prompt.length * 1.5,
    };
  }
}

// Example usage
async function main() {
  const dataService = new DataProcessingService();
  const llmService = new MockLLMService();

  console.log('=== Basic Decorator Examples ===\n');

  try {
    // 1. Basic tracing
    console.log('1. Tracing example:');
    const count = await dataService.processData(['apple', 'banana', 'cherry']);
    console.log(`Processed ${count} items\n`);

    // 2. Metrics recording
    console.log('2. Metrics example:');
    const analysis = await dataService.analyzeData(['hello', 'world', 'test']);
    console.log('Analysis result:', analysis, '\n');

    // 3. Caching demonstration
    console.log('3. Caching example:');
    console.time('First call');
    const result1 = await dataService.expensiveCalculation(42);
    console.timeEnd('First call');
    console.log(`Result: ${result1}`);

    console.time('Second call (cached)');
    const result2 = await dataService.expensiveCalculation(42);
    console.timeEnd('Second call (cached)');
    console.log(`Result: ${result2}\n`);

    // 4. Error handling
    console.log('4. Error handling example:');
    try {
      await dataService.validateData(null);
    } catch (error) {
      console.log(`Validation error caught: ${(error as Error).message}`);
    }

    try {
      await dataService.validateData({ name: 'test' });
    } catch (error) {
      console.log(`Validation error caught: ${(error as Error).message}\n`);
    }

    // 5. Timing decorator
    console.log('5. Timing example:');
    const transformed = await dataService.transformData(['foo', 'bar', 'baz']);
    console.log('Transformed:', transformed, '\n');

    // 6. Multiple decorators
    console.log('6. Multiple decorators example:');
    const aggregated = await dataService.aggregateResults([
      ['a', 'b', 'c'],
      ['d', 'e'],
      ['f', 'g', 'h', 'i'],
    ]);
    console.log('Aggregated:', aggregated, '\n');

    // 7. LLM operation
    console.log('7. LLM operation example:');
    const completion = await llmService.complete('Tell me about decorators');
    console.log('LLM response:', completion, '\n');
  } catch (error) {
    console.error('Error in main:', error);
  }

  console.log('=== Examples completed ===');
}

// Run the examples
if (require.main === module) {
  main().catch(console.error);
}
