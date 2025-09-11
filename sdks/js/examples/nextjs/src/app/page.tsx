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
