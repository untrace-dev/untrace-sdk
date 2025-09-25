// Test script to verify AWS Bedrock access
import { bedrock } from '@ai-sdk/amazon-bedrock';
import { generateText } from 'ai';

async function testBedrockAccess() {
  try {
    console.log('Testing AWS Bedrock access...');
    console.log('AWS Region:', process.env.AWS_REGION);
    console.log(
      'AWS Access Key ID:',
      process.env.AWS_ACCESS_KEY_ID ? 'Set' : 'Not set',
    );

    // Try with Claude Sonnet 4 inference profile ARN
    const modelId =
      'arn:aws:bedrock:us-east-2:912606813959:inference-profile/global.anthropic.claude-sonnet-4-20250514-v1:0';
    console.log('Using model ID:', modelId);

    const result = await generateText({
      maxOutputTokens: 50,
      model: bedrock(modelId),
      prompt: 'Hello, can you respond with "Bedrock access working!"?',
    });

    console.log('✅ Success! Response:', result.text);
    console.log('✅ AWS Bedrock is properly configured');
  } catch (error) {
    console.error('❌ Error:', error.message);

    if (error.message.includes('AccessDenied')) {
      console.log('💡 Solution: Enable model access in AWS Bedrock console');
    } else if (error.message.includes('InvalidSignature')) {
      console.log('💡 Solution: Check your AWS credentials');
    } else if (error.message.includes('region')) {
      console.log("💡 Solution: Make sure you're using the correct AWS region");
    } else if (error.message.includes('inference profile')) {
      console.log(
        '💡 Solution: Create an inference profile in AWS Bedrock console',
      );
      console.log('   - Go to AWS Bedrock Console > Inference profiles');
      console.log(
        '   - Create a profile for anthropic.claude-3-haiku-20240307-v1:0',
      );
      console.log(
        '   - Set CLAUDE_3_HAIKU_PROFILE_ARN environment variable with the ARN',
      );
    }
  }
}

testBedrockAccess();
