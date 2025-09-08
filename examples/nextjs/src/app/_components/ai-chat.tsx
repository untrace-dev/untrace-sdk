'use client';

import { useState } from 'react';
import { generateAIResponse } from '../actions';

export function AIChat() {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setIsLoading(true);
    setError('');
    setResponse('');

    try {
      const result = await generateAIResponse(prompt);

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

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">AI Chat</h2>

      <form className="mb-6" onSubmit={handleSubmit}>
        <div className="flex gap-2">
          <input
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ask me anything..."
            type="text"
            value={prompt}
          />
          <button
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoading || !prompt.trim()}
            type="submit"
          >
            {isLoading ? 'Sending...' : 'Send'}
          </button>
        </div>
      </form>

      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
          Error: {error}
        </div>
      )}

      {response && (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <h3 className="font-semibold mb-2 text-gray-700">AI Response:</h3>
          <p className="text-gray-600 whitespace-pre-wrap">{response}</p>
        </div>
      )}

      {isLoading && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-blue-600">Generating response...</p>
        </div>
      )}
    </div>
  );
}
