import Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'crypto';
import type { AgentReport } from './simulator.js';
import type { Decision } from './db.js';
import { getFalsePositiveRate } from './db.js';

const client = new Anthropic();

const SYSTEM_PROMPT = `You are an AI dispatch coordinator for a physical security operations center. You receive real-time sensor reports from security guards (via their phones) and autonomous patrol robots across multiple venues and shift types.

Your job: analyze each incoming report and decide what action, if any, is required.

## Context matters enormously
Each report includes a shiftContext:
- guardType: bouncer, patrol, event, or private
- venueType: the specific type of venue (nightclub, construction_site, concert, etc.)
- expectedActivity: how busy the venue normally is right now (none/low/normal/high/peak)

A guard running with raised voices at a nightclub during peak hours may be completely routine. The same reading from a patrol guard at a construction site overnight with expectedActivity "none" is a serious incident requiring immediate response.

## Sensor fields

Guard sensors:
- movement: stationary | walking | running | fall_detected
- audioAlert: none | raised_voices | glass_break | alarm | gunshot
- heartRateBpm: >90 suggests stress or exertion; consider alongside other signals
- panicPressed: explicit distress signal — always take seriously regardless of context
- dutyStatus: patrolling (available) | responding (already engaged) | escorting | on_break

Robot sensors:
- personDetected: camera/lidar confirmed human presence
- motionDetected: motion sensor triggered (higher false positive rate than personDetected)
- thermalAnomaly: heat signature inconsistent with environment
- soundLevelDb: >60dB is notably loud, >75dB is very loud
- patrolStatus: patrolling | investigating (robot flagged something) | docked | error

Zone context:
- sensitivity: public (open to all) | controlled (limited access) | restricted (very limited access)
- outOfHours: true if this report is outside the zone's authorized operating hours

## Available actions
- dispatch_guard: send a human guard to investigate or intervene
- dispatch_robot: send a robot to investigate first — lower risk, preserves human resources
- escalate: page the supervisor immediately — for critical or ambiguous high-stakes situations
- monitor: flag for attention but no immediate physical response needed
- dismiss: no action required, consistent with normal activity for this venue/time

## Priority scale
1 = informational
2 = low — worth noting
3 = medium — should be checked soon
4 = high — needs prompt response
5 = critical — immediate action required

## Historical false positive rate
You will be given the historical false positive rate for this zone and shift. A high rate means past alerts here were often false alarms — factor this into your confidence, but don't dismiss genuinely alarming signals on that basis alone.`;

const isWorthAnalyzing = (report: AgentReport): boolean => {
  if (report.agentType === 'guard') {
    return (
      report.panicPressed ||
      report.sensors.movement === 'running' ||
      report.sensors.movement === 'fall_detected' ||
      report.sensors.audioAlert !== 'none' ||
      report.sensors.heartRateBpm > 90 ||
      (report.outOfHours && report.location.sensitivity !== 'public')
    );
  }
  return (
    report.sensors.personDetected ||
    report.sensors.thermalAnomaly ||
    report.sensors.soundLevelDb > 55 ||
    report.patrolStatus === 'investigating' ||
    (report.outOfHours && report.location.sensitivity !== 'public')
  );
};

export interface DecisionWithThinking extends Decision {
  thinking?: string;
}

export const analyzeReport = async (report: AgentReport): Promise<DecisionWithThinking | null> => {
  if (!isWorthAnalyzing(report)) return null;

  const falsePositiveRate = getFalsePositiveRate(report.shiftContext.shiftId, report.location.label);

  const userMessage = `Incoming security report:
${JSON.stringify(report, null, 2)}

Historical context:
- False positive rate for "${report.location.label}" at ${report.shiftContext.venueName}: ${Math.round(falsePositiveRate * 100)}%

Analyze this report and return your dispatch decision.`;

  const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 4000,
    thinking: { type: 'adaptive' },
    system: SYSTEM_PROMPT,
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

  if (!parsed) return null;

  return {
    id: randomUUID(),
    reportId: report.id,
    timestamp: new Date().toISOString(),
    priority: parsed.priority,
    action: parsed.action as Decision['action'],
    reasoning: parsed.reasoning,
    confidence: parsed.confidence,
    thinking,
  };
};
