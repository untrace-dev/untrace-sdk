import Link from 'next/link';
import { AIChat } from './_components/ai-chat';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <main className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              LLM Observability Fatigue
            </span>
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
            Comprehensive observability for all your AI models and providers
          </p>
        </div>

        {/* Example Navigation */}
        <div className="flex justify-center gap-4 mb-12">
          <Link
            className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            href="/"
          >
            OpenAI Example
          </Link>
          <Link
            className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
            href="/bedrock"
          >
            AWS Bedrock + Claude
          </Link>
        </div>

        {/* AI Chat Section */}
        <div className="mb-12">
          <AIChat />
        </div>
      </main>

      {/* Footer */}
    </div>
  );
}
