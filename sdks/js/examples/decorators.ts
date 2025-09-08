import {
  cached,
  errorHandler,
  init,
  llmOperation,
  metric,
  timed,
  trace,
} from '@untrace/sdk';
import OpenAI from 'openai';

// Type for OpenAI chat completion response
interface ChatCompletionResponse {
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

// Initialize Untrace SDK
init({
  apiKey: process.env.UNTRACE_API_KEY as string,
  environment: 'development',
  serviceName: 'decorator-example',
});

/**
 * Example service showing decorator usage
 */
class AIAssistantService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Chat method with automatic LLM operation tracking
   */
  @llmOperation({
    extractCost: (result: unknown) => {
      const response = result as ChatCompletionResponse;
      // GPT-4 pricing: $0.03/1K prompt tokens, $0.06/1K completion tokens
      const promptCost = (response.usage.prompt_tokens / 1000) * 0.03;
      const completionCost = (response.usage.completion_tokens / 1000) * 0.06;
      const totalCost = promptCost + completionCost;
      return {
        input: promptCost,
        model: 'gpt-4',
        output: completionCost,
        provider: 'openai',
        total: totalCost,
      };
    },
    extractTokenUsage: (result: unknown) => {
      const response = result as ChatCompletionResponse;
      return {
        completionTokens: response.usage.completion_tokens,
        model: 'gpt-4',
        promptTokens: response.usage.prompt_tokens,
        provider: 'openai',
        totalTokens: response.usage.total_tokens,
      };
    },
    model: 'gpt-4',
    provider: 'openai',
    type: 'chat',
  })
  async chat(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  ) {
    return (await this.openai.chat.completions.create({
      messages,
      model: 'gpt-4',
    })) as unknown as ChatCompletionResponse;
  }

  /**
   * Summarize method with caching
   */
  @cached({ ttl: 3600000 }) // Cache for 1 hour
  @llmOperation({
    model: 'gpt-3.5-turbo',
    provider: 'openai',
    type: 'completion',
  })
  async summarize(text: string) {
    return await this.openai.chat.completions.create({
      messages: [
        { content: 'Summarize the following text concisely.', role: 'system' },
        { content: text, role: 'user' },
      ],
      model: 'gpt-3.5-turbo',
    });
  }

  /**
   * User data fetching with tracing
   */
  @trace({
    attributes: { 'db.system': 'postgresql' },
    name: 'fetchUserProfile',
  })
  async getUserProfile(userId: string) {
    // Simulate database call
    await new Promise((resolve) => setTimeout(resolve, 100));

    return {
      id: userId,
      name: 'John Doe',
      preferences: {
        language: 'en',
        theme: 'dark',
      },
    };
  }

  /**
   * Process request with automatic metrics
   */
  @metric({ recordDuration: true })
  @trace({ kind: 2 }) // SpanKind.SERVER
  async processUserRequest(userId: string, query: string) {
    // Get user profile
    const userProfile = await this.getUserProfile(userId);

    // Prepare messages with user context
    const messages: Array<{
      role: 'system' | 'user' | 'assistant';
      content: string;
    }> = [
      {
        content: `You are helping user ${userProfile.name}. Their preferred language is ${userProfile.preferences.language}.`,
        role: 'system',
      },
      { content: query, role: 'user' },
    ];

    // Get AI response
    const response = await this.chat(messages);

    return {
      response: response.choices[0]?.message.content || 'No response generated',
      user: userProfile,
    };
  }

  /**
   * Risky operation with error handling
   */
  @errorHandler({ rethrow: true })
  @trace()
  async performRiskyOperation(data: { isValid?: boolean } | null) {
    if (!data || !data.isValid) {
      throw new Error('Invalid data provided');
    }

    // Process data...
    return { processed: data, success: true };
  }

  /**
   * Debug slow operations
   */
  @timed('SlowOperation')
  async analyzeDocument(document: string) {
    // Simulate slow processing
    await new Promise((resolve) => setTimeout(resolve, 2000));

    return {
      sentiment: 'positive',
      wordCount: document.split(' ').length,
    };
  }
}

// Example usage
async function main() {
  const assistant = new AIAssistantService();

  try {
    // Example 1: Process user request (uses multiple decorators)
    console.log('Processing user request...');
    const result = await assistant.processUserRequest(
      'user-123',
      'What is the weather like today?',
    );
    console.log('Response:', result.response);

    // Example 2: Cached summarization
    console.log('\nSummarizing text (first call)...');
    const _summary1 = await assistant.summarize(
      'This is a long text that needs summarization...',
    );

    console.log('Summarizing text (cached)...');
    const _summary2 = await assistant.summarize(
      'This is a long text that needs summarization...',
    );

    // Example 3: Error handling
    console.log('\nTesting error handling...');
    try {
      await assistant.performRiskyOperation(null);
    } catch (error) {
      console.error('Caught error:', (error as Error).message);
    }

    // Example 4: Timed operation
    console.log('\nAnalyzing document...');
    await assistant.analyzeDocument('This is a sample document for analysis.');
  } catch (error) {
    console.error('Error in main:', error);
  }
}

// Run example if this file is executed directly
if (require.main === module) {
  main();
}
