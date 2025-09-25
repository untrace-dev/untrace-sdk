import { BedrockClaudeChat } from '../_components/bedrock-claude-chat';

export default function BedrockPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <main className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              AWS Bedrock + Anthropic Claude
            </span>
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Experience Anthropic's Claude models on AWS Bedrock with full
            observability
          </p>
        </div>

        {/* Bedrock Claude Chat Section */}
        <div className="mb-12">
          <BedrockClaudeChat />
        </div>

        {/* Features Section */}
        <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-6 mb-12">
          <div className="p-6 bg-white rounded-lg shadow-lg">
            <h3 className="text-lg font-semibold mb-2 text-gray-800">
              Multiple Models
            </h3>
            <p className="text-gray-600 text-sm">
              Compare Claude 3.5 Sonnet, Haiku, Claude 3 Sonnet, Opus, and Haiku
              models side by side
            </p>
          </div>
          <div className="p-6 bg-white rounded-lg shadow-lg">
            <h3 className="text-lg font-semibold mb-2 text-gray-800">
              Streaming Support
            </h3>
            <p className="text-gray-600 text-sm">
              Real-time streaming responses for better user experience
            </p>
          </div>
          <div className="p-6 bg-white rounded-lg shadow-lg">
            <h3 className="text-lg font-semibold mb-2 text-gray-800">
              Full Observability
            </h3>
            <p className="text-gray-600 text-sm">
              Complete tracing and monitoring with Untrace SDK
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
