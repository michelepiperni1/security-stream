import type { LLMDecision, LLMProvider } from './types.js';

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'llama3.2';

const JSON_REMINDER = `
Respond with ONLY a JSON object — no markdown, no explanation. Schema:
{
  "thinking": <string, step-by-step reasoning before reaching your conclusion>,
  "priority": <integer 1-5>,
  "action": <"dispatch_guard" | "dispatch_robot" | "escalate" | "monitor" | "dismiss">,
  "reasoning": <string, 2-3 sentences summarising your decision>,
  "confidence": <float 0.0-1.0>
}`;

export class OllamaProvider implements LLMProvider {
  async analyze(systemPrompt: string, userMessage: string): Promise<LLMDecision> {
    const res = await fetch(`${OLLAMA_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage + JSON_REMINDER },
        ],
        response_format: { type: 'json_object' },
        temperature: 0,
        stream: false,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Ollama request failed (${res.status}): ${text}`);
    }

    const body = await res.json() as {
      choices: Array<{ message: { content: string } }>;
    };

    const content = body.choices[0]?.message?.content;
    if (!content) throw new Error('Ollama returned empty content');

    const parsed = JSON.parse(content) as {
      thinking?: string;
      priority: number;
      action: string;
      reasoning: string;
      confidence: number;
    };

    return {
      thinking: parsed.thinking,
      priority: parsed.priority,
      action: parsed.action as LLMDecision['action'],
      reasoning: parsed.reasoning,
      confidence: parsed.confidence,
    };
  }
}
