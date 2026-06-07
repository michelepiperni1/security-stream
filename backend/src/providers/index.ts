import type { LLMProvider } from './types.js';
import { ClaudeProvider } from './claude.js';
import { OllamaProvider } from './ollama.js';

let _provider: LLMProvider | null = null;

export const getProvider = (): LLMProvider => {
  if (_provider) return _provider;
  const name = process.env.LLM_PROVIDER ?? 'claude';
  _provider = name === 'ollama' ? new OllamaProvider() : new ClaudeProvider();
  console.log(`LLM provider: ${name}${name === 'ollama' ? ` (model: ${process.env.OLLAMA_MODEL ?? 'llama3.2'})` : ' (claude-opus-4-8)'}`);
  return _provider;
};
