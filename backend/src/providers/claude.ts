import Anthropic from '@anthropic-ai/sdk';
import type { LLMDecision, LLMProvider } from './types.js';

const client = new Anthropic();

export class ClaudeProvider implements LLMProvider {
  async analyze(systemPrompt: string, userMessage: string): Promise<LLMDecision> {
    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 4000,
      thinking: { type: 'adaptive' },
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      output_config: {
        format: {
          type: 'json_schema',
          schema: {
            type: 'object',
            properties: {
              priority:   { type: 'integer' },
              action:     { type: 'string', enum: ['dispatch_guard', 'dispatch_robot', 'escalate', 'monitor', 'dismiss'] },
              reasoning:  { type: 'string' },
              confidence: { type: 'number' },
            },
            required: ['priority', 'action', 'reasoning', 'confidence'],
            additionalProperties: false,
          },
        },
      },
    });

    let thinking: string | undefined;
    let parsed: { priority: number; action: string; reasoning: string; confidence: number } | undefined;

    for (const block of response.content) {
      if (block.type === 'thinking') thinking = block.thinking;
      else if (block.type === 'text') parsed = JSON.parse(block.text);
    }

    if (!parsed) throw new Error('Claude returned no text block');

    return {
      priority: parsed.priority,
      action: parsed.action as LLMDecision['action'],
      reasoning: parsed.reasoning,
      confidence: parsed.confidence,
      thinking,
    };
  }
}
