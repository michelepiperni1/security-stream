export interface LLMDecision {
  priority: number;
  action: string;
  reasoning: string;
  confidence: number;
  memo?: string;
  shiftMemo?: string;
  venueNote?: string;
  thinking?: string;
  dispatchGuardId?: string;
  dispatchRobotId?: string;
  dispatchMessage?: string;
}

export interface LLMProvider {
  analyze(systemPrompt: string, userMessage: string): Promise<LLMDecision>;
}
