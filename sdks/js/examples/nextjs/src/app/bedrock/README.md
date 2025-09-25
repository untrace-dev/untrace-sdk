# AWS Bedrock + Anthropic Claude Integration

This example demonstrates how to integrate Anthropic's Claude models hosted on AWS Bedrock using the Vercel AI SDK in a TypeScript/Next.js application with full observability through the Untrace SDK.

## Features

- **Multiple Claude Models**: Support for Claude 3 Haiku, Sonnet, Opus, and 3.5 Sonnet
- **Streaming Responses**: Real-time streaming for better user experience
- **Model Comparison**: Compare responses across different Claude models
- **Full Observability**: Complete tracing and monitoring with Untrace SDK
- **Error Handling**: Comprehensive error handling and user feedback

## Prerequisites

### 1. AWS Account Setup

You need an AWS account with access to Amazon Bedrock:

1. **AWS Account**: Sign up for an AWS account if you don't have one
2. **Bedrock Access**: Ensure your AWS account has access to Amazon Bedrock services
3. **Model Access**: Request access to Anthropic models in the AWS Bedrock console

### 2. AWS Credentials Configuration

Configure your AWS credentials using one of these methods:

#### Option A: Environment Variables
```bash
export AWS_ACCESS_KEY_ID=your_access_key_id
export AWS_SECRET_ACCESS_KEY=your_secret_access_key
export AWS_REGION=us-west-2
```

#### Option B: AWS CLI
```bash
aws configure
```

#### Option C: IAM Roles (for AWS deployments)
If deploying to AWS, use IAM roles instead of access keys for better security.

### 3. Model Access Request

1. Go to the [AWS Bedrock Console](https://console.aws.amazon.com/bedrock/)
2. Navigate to "Model access" in the left sidebar
3. Request access to the following Anthropic models:
   - Claude 3 Haiku
   - Claude 3 Sonnet
   - Claude 3 Opus
   - Claude 3.5 Sonnet

**Note**: Model availability varies by region. Common regions with Anthropic models:
- `us-east-1` (N. Virginia)
- `us-west-2` (Oregon)
- `eu-west-1` (Ireland)
- `ap-southeast-1` (Singapore)

## Installation

Install the required dependencies:

```bash
npm install ai @ai-sdk/amazon-bedrock
```

## Usage

### Basic Text Generation

```typescript
import { bedrock } from '@ai-sdk/amazon-bedrock';
import { generateText } from 'ai';

const { text } = await generateText({
  model: bedrock('anthropic.claude-3-sonnet-20240229-v1:0'),
  prompt: 'Write a haiku about artificial intelligence.',
  maxTokens: 1000,
  temperature: 0.7,
});

console.log(text);
```

### Streaming Responses

```typescript
import { bedrock } from '@ai-sdk/amazon-bedrock';
import { streamText } from 'ai';

const result = await streamText({
  model: bedrock('anthropic.claude-3-sonnet-20240229-v1:0'),
  prompt: 'Explain quantum computing in simple terms.',
  maxTokens: 1000,
  temperature: 0.7,
});

// Handle streaming
const reader = result.textStream.getReader();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  console.log(value);
}
```

### With Untrace Observability

```typescript
import { init } from '@untrace/sdk';
import { bedrock } from '@ai-sdk/amazon-bedrock';
import { generateText } from 'ai';

const untrace = init({
  apiKey: 'your-untrace-api-key',
  baseUrl: 'https://your-untrace-endpoint',
});

export async function generateClaudeResponse(prompt: string) {
  const span = untrace.startSpan('claude.generate', {
    'claude.model': 'claude-3-sonnet',
    'claude.provider': 'aws-bedrock',
  });

  try {
    const { text } = await generateText({
      model: bedrock('anthropic.claude-3-sonnet-20240229-v1:0'),
      prompt,
      maxTokens: 1000,
      temperature: 0.7,
    });

    span.setAttributes({
      'claude.response_length': text.length,
      'claude.success': true,
    });

    span.end();
    await untrace.flush();

    return { success: true, text };
  } catch (error) {
    span.setAttributes({
      'claude.error': error instanceof Error ? error.message : 'Unknown error',
      'claude.success': false,
    });
    span.end();
    throw error;
  }
}
```

## Available Models

| Model | Model ID | Description |
|-------|----------|-------------|
| Claude 3 Haiku | `anthropic.claude-3-haiku-20240307-v1:0` | Fastest, most cost-effective |
| Claude 3 Sonnet | `anthropic.claude-3-sonnet-20240229-v1:0` | Balanced performance and cost |
| Claude 3 Opus | `anthropic.claude-3-opus-20240229-v1:0` | Most capable, highest cost |
| Claude 3.5 Sonnet | `anthropic.claude-3-5-sonnet-20241022-v2:0` | Latest model with improved capabilities |

## Error Handling

The integration includes comprehensive error handling for common scenarios:

- **Authentication Errors**: Invalid AWS credentials
- **Model Access Errors**: Model not available in your region or account
- **Rate Limiting**: API rate limit exceeded
- **Network Errors**: Connection issues with AWS Bedrock
- **Invalid Parameters**: Malformed requests

## Best Practices

1. **Environment Variables**: Store AWS credentials securely using environment variables
2. **Model Selection**: Choose the appropriate model based on your use case:
   - Haiku: Fast, simple tasks
   - Sonnet: Balanced performance for most tasks
   - Opus: Complex reasoning tasks
   - 3.5 Sonnet: Latest capabilities with improved performance
3. **Error Handling**: Implement proper error handling and user feedback
4. **Observability**: Use the Untrace SDK to monitor performance and debug issues
5. **Streaming**: Use streaming for better user experience with longer responses

## Troubleshooting

### Common Issues

1. **"Model not found" error**: Ensure you have requested access to the model in AWS Bedrock console
2. **"Access denied" error**: Check your AWS credentials and permissions
3. **"Region not supported" error**: Verify the model is available in your selected AWS region
4. **Slow responses**: Consider using Claude 3 Haiku for faster responses

### Debug Mode

Enable debug logging in the Untrace SDK:

```typescript
const untrace = init({
  apiKey: 'your-api-key',
  debug: true,
  exportIntervalMs: 1000,
  maxBatchSize: 1,
});
```

## Security Considerations

1. **Never commit AWS credentials** to version control
2. **Use IAM roles** when deploying to AWS for better security
3. **Implement proper access controls** for your application
4. **Monitor usage** to prevent unexpected costs
5. **Use least privilege principle** for AWS permissions

## Cost Optimization

1. **Choose appropriate models** based on your needs
2. **Implement caching** for repeated requests
3. **Set reasonable token limits** to control costs
4. **Monitor usage** through AWS CloudWatch
5. **Use streaming** to provide better user experience without waiting for complete responses
