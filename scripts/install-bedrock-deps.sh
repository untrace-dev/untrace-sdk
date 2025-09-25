#!/bin/bash

# Install AWS Bedrock + Anthropic Claude dependencies for Next.js example
echo "Installing AWS Bedrock + Anthropic Claude dependencies..."

# Navigate to the Next.js example directory
cd "$(dirname "$0")/sdks/js/examples/nextjs"

# Install the required packages
echo "Installing @ai-sdk/amazon-bedrock and ai packages..."
bun add @ai-sdk/amazon-bedrock ai

echo "Dependencies installed successfully!"
echo ""
echo "Next steps:"
echo "1. Set up your AWS credentials:"
echo "   export AWS_ACCESS_KEY_ID=your_access_key_id"
echo "   export AWS_SECRET_ACCESS_KEY=your_secret_access_key"
echo "   export AWS_REGION=us-west-2"
echo ""
echo "2. Request access to Anthropic models in AWS Bedrock console"
echo "3. Update the bedrock-actions.ts file to use the actual imports instead of mocks"
echo "4. Run the development server: bun run dev"
echo "5. Visit http://localhost:3000/bedrock to test the integration"
