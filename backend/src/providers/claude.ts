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
              action:           { type: 'string', enum: ['message_guard', 'broadcast_alert', 'call_police', 'dispatch_robot', 'investigate', 'monitor', 'dismiss'] },
              reasoning:        { type: 'string' },
              confidence:       { type: 'number' },
              memo:             { type: 'string' },
              shift_memo:       { type: 'string' },
              venue_note:       { type: 'string' },
              dispatch_guard_id: { type: 'string' },
              dispatch_robot_id: { type: 'string' },
              dispatch_message:  { type: 'string' },
            },
            required: ['priority', 'action', 'reasoning', 'confidence', 'memo', 'shift_memo'],
            additionalProperties: false,
          },
        },
      },
    });

    let thinking: string | undefined;
    let parsed: { priority: number; action: string; reasoning: string; confidence: number; memo: string; shift_memo: string; venue_note?: string; dispatch_guard_id?: string; dispatch_robot_id?: string; dispatch_message?: string } | undefined;

    for (const block of response.content) {
      if (block.type === 'thinking') thinking = block.thinking;
      else if (block.type === 'text') parsed = JSON.parse(block.text);
    }

    if (!parsed) throw new Error('Claude returned no text block');

    return {
      priority: parsed.priority,
      action: parsed.action,
      reasoning: parsed.reasoning,
      confidence: parsed.confidence,
      memo: parsed.memo,
      shiftMemo: parsed.shift_memo,
      venueNote: parsed.venue_note,
      thinking,
      dispatchGuardId: parsed.dispatch_guard_id,
      dispatchRobotId: parsed.dispatch_robot_id,
      dispatchMessage: parsed.dispatch_message,
    };
  }
}
