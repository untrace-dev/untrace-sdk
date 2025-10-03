'use client';

import { useState } from 'react';
import {
  getInstrumentationStatus,
  testAISDKWithBedrock,
  testAISDKWithOpenAI,
  testMultipleCombinations,
} from '../matrix-test';

export default function MatrixTestPage() {
  const [prompt, setPrompt] = useState(
    'Explain the benefits of matrix-based auto-instrumentation for LLM observability.',
  );
  const [results, setResults] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<Record<string, unknown> | null>(null);

  const handleTest = async (testType: string) => {
    setLoading(true);
    setResults(null);

    try {
      let result: Record<string, unknown>;
      switch (testType) {
        case 'bedrock':
          result = await testAISDKWithBedrock(prompt);
          break;
        case 'openai':
          result = await testAISDKWithOpenAI(prompt);
          break;
        case 'multiple':
          result = await testMultipleCombinations(prompt);
          break;
        default:
          result = { error: 'Unknown test type', success: false };
      }
      setResults(result);
    } catch (error) {
      setResults({
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGetStatus = async () => {
    try {
      const result = await getInstrumentationStatus();
      setStatus(result);
    } catch (error) {
      setStatus({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">
        Matrix-Based Auto-Instrumentation Test
      </h1>

      <div className="mb-6">
        <p className="text-gray-600 mb-4">
          This page demonstrates the new matrix-based auto-instrumentation
          approach that handles different LLM SDK-Provider combinations without
          relying on URL patterns or custom configurations.
        </p>

        <div className="bg-blue-50 p-4 rounded-lg mb-4">
          <h3 className="font-semibold text-blue-900 mb-2">How it works:</h3>
          <ul className="text-blue-800 text-sm space-y-1">
            <li>
              • <strong>SDK-level instrumentation:</strong> Wraps AI SDK
              functions (generateText, streamText)
            </li>
            <li>
              • <strong>Provider-level instrumentation:</strong> Wraps provider
              SDKs (OpenAI, Anthropic)
            </li>
            <li>
              • <strong>HTTP-level fallback:</strong> Intercepts HTTP requests
              for custom configurations
            </li>
            <li>
              • <strong>Matrix-based strategy:</strong> Chooses the best
              approach for each SDK-Provider combination
            </li>
          </ul>
        </div>
      </div>

      <div className="mb-6">
        <label
          className="block text-sm font-medium text-gray-700 mb-2"
          htmlFor="prompt"
        >
          Test Prompt:
        </label>
        <textarea
          className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          id="prompt"
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter your test prompt here..."
          rows={3}
          value={prompt}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <button
          type="button"
          className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={loading}
          onClick={() => handleTest('bedrock')}
        >
          {loading ? 'Testing...' : 'Test AI SDK + Bedrock'}
        </button>

        <button
          type="button"
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={loading}
          onClick={() => handleTest('openai')}
        >
          {loading ? 'Testing...' : 'Test AI SDK + OpenAI'}
        </button>

        <button
          type="button"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={loading}
          onClick={() => handleTest('multiple')}
        >
          {loading ? 'Testing...' : 'Test Multiple Combinations'}
        </button>

        <button
          type="button"
          className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          onClick={handleGetStatus}
        >
          Get Status
        </button>
      </div>

      {status && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold text-gray-900 mb-2">
            Instrumentation Status:
          </h3>
          <pre className="text-sm text-gray-700 whitespace-pre-wrap">
            {JSON.stringify(status, null, 2)}
          </pre>
        </div>
      )}

      {results && (
        <div className="p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold text-gray-900 mb-2">Test Results:</h3>
          <pre className="text-sm text-gray-700 whitespace-pre-wrap">
            {JSON.stringify(results, null, 2)}
          </pre>
        </div>
      )}

      <div className="mt-8 p-4 bg-yellow-50 rounded-lg">
        <h3 className="font-semibold text-yellow-900 mb-2">What to check:</h3>
        <ul className="text-yellow-800 text-sm space-y-1">
          <li>• Check the browser console for instrumentation logs</li>
          <li>
            • Check the Untrace dashboard for traces with proper OpenInference
            attributes
          </li>
          <li>
            • Verify that each SDK-Provider combination is instrumented
            correctly
          </li>
          <li>
            • Confirm that custom base URLs are handled via HTTP-level fallback
          </li>
        </ul>
      </div>
    </div>
  );
}
