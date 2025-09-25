'use client';

import { useState } from 'react';
import {
  compareClaudeModels,
  generateClaudeResponse,
  streamClaudeResponse,
} from '../bedrock-actions';

type ClaudeModel =
  | 'claude-sonnet-4'
  | 'claude-3-haiku'
  | 'claude-3-5-sonnet'
  | 'claude-3-5-haiku'
  | 'claude-3-sonnet'
  | 'claude-3-opus';

export function BedrockClaudeChat() {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedModel, setSelectedModel] =
    useState<ClaudeModel>('claude-3-5-sonnet');
  const [streamingResponse, setStreamingResponse] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [comparisonResults, setComparisonResults] = useState<Array<{
    model: string;
    success: boolean;
    response: { success: boolean; text?: string; model?: string } | null;
    error: unknown;
  }> | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setIsLoading(true);
    setError('');
    setResponse('');

    try {
      const result = await generateClaudeResponse(prompt, selectedModel);

      if (result.success) {
        setResponse(result.text || '');
      } else {
        setError(result.error || 'Failed to generate response');
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStreamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setIsStreaming(true);
    setError('');
    setStreamingResponse('');

    try {
      const result = await streamClaudeResponse(prompt, selectedModel);

      if (result.success && result.stream) {
        // Handle streaming response
        const reader = result.stream.textStream.getReader();
        let fullText = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            fullText += value;
            setStreamingResponse(fullText);
          }
        } finally {
          reader.releaseLock();
        }
      } else {
        setError(result.error || 'Failed to generate streaming response');
      }
    } catch {
      setError('An unexpected error occurred during streaming');
    } finally {
      setIsStreaming(false);
    }
  };

  const handleCompareModels = async () => {
    if (!prompt.trim()) return;

    setIsLoading(true);
    setError('');
    setComparisonResults(null);

    try {
      const result = await compareClaudeModels(prompt);

      if (result.success && result.responses) {
        setComparisonResults(result.responses);
      } else {
        setError(result.error || 'Failed to compare models');
      }
    } catch {
      setError('An unexpected error occurred during comparison');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">
        AWS Bedrock + Anthropic Claude
      </h2>
      <p className="text-sm text-gray-600 mb-6">
        Powered by Vercel AI SDK with Untrace observability
      </p>

      {/* Model Selection */}
      <div className="mb-6">
        <label
          className="block text-sm font-medium text-gray-700 mb-2"
          htmlFor="model-select"
        >
          Select Claude Model:
        </label>
        <select
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          id="model-select"
          onChange={(e) => setSelectedModel(e.target.value as ClaudeModel)}
          value={selectedModel}
        >
          <option value="claude-sonnet-4">Claude Sonnet 4 (Latest)</option>
          <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
          <option value="claude-3-5-haiku">Claude 3.5 Haiku</option>
          <option value="claude-3-haiku">Claude 3 Haiku (Fastest)</option>
          <option value="claude-3-sonnet">Claude 3 Sonnet</option>
          <option value="claude-3-opus">Claude 3 Opus (Most Capable)</option>
        </select>
      </div>

      {/* Input Form */}
      <form className="mb-6" onSubmit={handleSubmit}>
        <div className="flex gap-2 mb-4">
          <input
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading || isStreaming}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ask Claude anything..."
            type="text"
            value={prompt}
          />
          <button
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoading || isStreaming || !prompt.trim()}
            type="submit"
          >
            {isLoading ? 'Generating...' : 'Generate'}
          </button>
        </div>
      </form>

      {/* Action Buttons */}
      <div className="flex gap-2 mb-6">
        <button
          className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isLoading || isStreaming || !prompt.trim()}
          onClick={handleStreamSubmit}
          type="button"
        >
          {isStreaming ? 'Streaming...' : 'Stream Response'}
        </button>
        <button
          className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isLoading || isStreaming || !prompt.trim()}
          onClick={handleCompareModels}
          type="button"
        >
          Compare All Models
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
          Error: {error}
        </div>
      )}

      {/* Regular Response */}
      {response && (
        <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <h3 className="font-semibold mb-2 text-gray-700">
            Claude Response ({selectedModel}):
          </h3>
          <p className="text-gray-600 whitespace-pre-wrap">{response}</p>
        </div>
      )}

      {/* Streaming Response */}
      {streamingResponse && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-semibold mb-2 text-gray-700">
            Streaming Response ({selectedModel}):
          </h3>
          <p className="text-gray-600 whitespace-pre-wrap">
            {streamingResponse}
          </p>
          {isStreaming && (
            <div className="mt-2 text-blue-600 text-sm">Streaming...</div>
          )}
        </div>
      )}

      {/* Model Comparison Results */}
      {comparisonResults && (
        <div className="mb-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <h3 className="font-semibold mb-2 text-gray-700">
            Model Comparison:
          </h3>
          <div className="space-y-3">
            {comparisonResults.map((result, index) => (
              <div
                className="p-3 bg-white rounded border"
                key={`${result.model}-${index}`}
              >
                <h4 className="font-medium text-gray-800">{result.model}</h4>
                {result.success && result.response?.success ? (
                  <p className="text-gray-600 text-sm mt-1">
                    {result.response.text?.substring(0, 200)}...
                  </p>
                ) : (
                  <p className="text-red-600 text-sm mt-1">
                    Error:{' '}
                    {String(result.error) || 'Failed to generate response'}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loading State */}
      {(isLoading || isStreaming) && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-blue-600">
            {isLoading ? 'Generating response...' : 'Streaming response...'}
          </p>
        </div>
      )}

      {/* AWS Bedrock Setup Instructions */}
      <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <h3 className="font-semibold mb-2 text-gray-700">
          AWS Bedrock Setup Required:
        </h3>
        <div className="text-sm text-gray-600 space-y-1">
          <p>
            1. Configure AWS credentials (AWS_ACCESS_KEY_ID,
            AWS_SECRET_ACCESS_KEY, AWS_REGION)
          </p>
          <p>2. Request access to Anthropic models in AWS Bedrock console</p>
          <p>3. Install dependencies: npm install ai @ai-sdk/amazon-bedrock</p>
          <p>4. Ensure your AWS region supports the selected Claude models</p>
        </div>
      </div>
    </div>
  );
}
