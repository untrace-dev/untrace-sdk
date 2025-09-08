import { defineConfig } from 'tsup';

export default defineConfig({
  clean: true,
  dts: true,
  entry: {
    index: 'src/index.ts',
    'providers/openai': 'src/providers/openai.ts',
    // TODO: Add these as they are implemented
    // 'providers/ai-sdk': 'src/providers/ai-sdk.ts',
    // 'providers/anthropic': 'src/providers/anthropic.ts',
    // 'providers/bedrock': 'src/providers/bedrock.ts',
    // 'providers/cohere': 'src/providers/cohere.ts',
    // 'providers/langchain': 'src/providers/langchain.ts',
    // 'providers/llamaindex': 'src/providers/llamaindex.ts',
    // 'providers/mistral': 'src/providers/mistral.ts',
    // 'providers/vertex-ai': 'src/providers/vertex-ai.ts',
  },
  esbuildOptions(options, { format }) {
    if (format === 'cjs') {
      options.footer = {
        js: 'if (module.exports.default) module.exports = module.exports.default;',
      };
    }
  },
  external: [
    'openai',
    '@anthropic-ai/sdk',
    'cohere-ai',
    'ai',
    'langchain',
    'llamaindex',
    '@aws-sdk/client-bedrock-runtime',
    '@google-cloud/vertexai',
    '@mistralai/mistralai',
  ],
  format: ['esm', 'cjs'],
  sourcemap: true,
  splitting: false,
  treeshake: true,
});
