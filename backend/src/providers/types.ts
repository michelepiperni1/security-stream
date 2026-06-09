export interface LLMDecision {
  priority: number;
  action: 'dispatch_guard' | 'dispatch_robot' | 'escalate' | 'monitor' | 'dismiss';
  reasoning: string;
  confidence: number;
  memo?: string;
  shiftMemo?: string;
  venueNote?: string;
  thinking?: string;
}

export interface LLMProvider {
  analyze(systemPrompt: string, userMessage: string): Promise<LLMDecision>;
}
