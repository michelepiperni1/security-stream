import { randomUUID } from 'crypto';
import type { SecurityEvent, GpsEvent, WearableEvent, RobotGpsEvent, RobotTelemetryEvent } from './events.js';
import type { Decision, GuardProfile, RobotProfile } from './db.js';
import { getProvider } from './providers/index.js';

export interface GuardContext {
  lastGps: GpsEvent | null;
  recentWearable: WearableEvent[];
  profile: GuardProfile | null;
  shiftGoal: string;
  venueName: string;
  venueType: string;
  expectedActivity: string;
  currentMemo: string | null;
  shiftMemo: string | null;
  venueHistory: string[];
  availableGuards: Array<{ id: string; name: string; role: string; lastKnownZone: string | null }>;
}

export interface RobotContext {
  lastGps: RobotGpsEvent | null;
  recentTelemetry: RobotTelemetryEvent[];
  profile: RobotProfile | null;
  shiftGoal: string;
  venueName: string;
  venueType: string;
  expectedActivity: string;
  currentMemo: string | null;
  shiftMemo: string | null;
  venueHistory: string[];
  availableGuards: Array<{ id: string; name: string; role: string; lastKnownZone: string | null }>;
}

const SYSTEM_PROMPT = `You are an AI dispatch coordinator for a physical security operations center. You receive real-time event streams from security guards across active shifts.

Guard data arrives as four independent streams — you are called when a threshold is crossed:
- GPS (~every 5s): location updates. You are NOT called for GPS events alone.
- Wearable (~every 3s): heart rate, movement. You ARE called when: running, fall detected, or HR > 160 bpm.
- Message (discrete): text communications from the guard. You ARE always called for messages.
- Panic (discrete): explicit distress signal from the panic button. You ARE always called for panic events.

When you are called, you receive the triggering event plus recent GPS and wearable context for that guard.

## Guard profiles matter
Each guard has a profile: name, gender, experience level, armed status, and role. An armed guard vs an unarmed one has different response capabilities. A 12-year veteran shift supervisor warrants different guidance than a 3-year bar security guard. A door supervisor at a nightclub has different expected behaviour than a floor patrol guard.

## Shift context matters enormously
Each shift has:
- A written goal stating the security objectives for this shift
- guardType: bouncer, patrol, event, or private — defines expected behaviour
- venueType: the specific venue (nightclub, construction_site, concert, etc.)
- expectedActivity: how busy the venue is right now (none/low/normal/high/peak)

Running + elevated HR at a nightclub bouncer during peak hours is very different from the same at a patrol guard on a construction site overnight. Always factor in context before escalating.

## Zone sensitivity
- public: open to all
- controlled: limited access — unexpected activity warrants attention
- restricted: very limited access — any unexpected activity is serious
- outOfHours: guard is operating outside authorized hours for this zone

## Event types and how to read them
- Wearable threshold crossing: assess severity based on HR level, movement type, and how long it's been elevated (use recentWearable array). A single elevated reading may be noise; sustained elevation is more significant.
- Messages: always read the actual content — it is the primary signal. The message type (status_update, request_backup, etc.) is a rough classification that may not match the content. A guard who sends a status_update saying "crowd surge at main stage" is reporting an active incident, not a routine check-in. Never dismiss or downgrade a message because of its type; judge it by what it says.
- panic: highest urgency signal — almost always warrants a direct response.
- Wearable data absence: if a guard reports an incident verbally, the absence of elevated wearable readings does NOT invalidate the report. Guards notice things before their body reacts. Treat the message as the authoritative source; wearable data is corroborating context only.

## Robot units
Some shifts include autonomous robot units (e.g., wheeled sentries, quadrupeds) patrolling alongside human guards. Robots generate their own event streams — you may be called for these independently of guard events:
- robot_gps (~every 6s): patrol location updates. You are NOT called for robot_gps events alone.
- robot_telemetry (~every 4s): battery level and operational status (patrolling/charging/idle/fault). You ARE called when battery < 20% or status is 'fault'.
- robot_alert (discrete): sensor-triggered alerts. You ARE always called for robot_alert events.

A robot's profile is its model and capability set (e.g., thermal_camera, motion_sensor) — not a person. Telemetry reflects hardware state, not vitals: low battery or a 'fault' status is an operational concern (the robot may need to dock or be serviced), not a medical one.

robot_alert content is the primary signal, exactly like guard messages — alertType (motion_detected, thermal_anomaly, camera_obstruction, perimeter_breach, system_fault, status_update) is a rough sensor classification and may not match the actual content. Read what the robot reported, not just its category. A 'status_update' alert describing something unusual should be treated as a real report.

For robot-triggered events, typical actions are message_guard (send a human to physically verify what the robot detected), dispatch_robot (redirect another robot unit to corroborate), monitor, or dismiss (for routine status updates or isolated low-battery readings). broadcast_alert and call_police still apply if a robot_alert indicates a serious, confirmed threat.

## Available actions
Choose the most appropriate action. For message_guard, broadcast_alert, and dispatch_robot you MUST include dispatch_message and (for message_guard) dispatch_guard_id or (for dispatch_robot) dispatch_robot_id — the message is sent directly and in real time.

- message_guard: send a direct operational message to a specific guard. Set dispatch_guard_id to the guard's ID and dispatch_message to what you want to tell them. Use this to redirect a guard, warn them, request they investigate, or coordinate a response.
- broadcast_alert: send an alert message to ALL guards on this shift simultaneously. Set dispatch_message to the alert content. Use for venue-wide threats, crowd advisories, or general escalations.
- call_police: escalate to law enforcement. Your reasoning will be used as the call details. Reserve for serious criminal activity, violence, or life-threatening situations.
- dispatch_robot: deploy or redirect a robot unit to investigate — lower escalation than sending a human guard. Set dispatch_robot_id to the target robot's ID and dispatch_message to the instruction.
- investigate: flag for investigation by available personnel — no specific guard redirected.
- monitor: flag for attention but no physical response needed.
- dismiss: no action required — consistent with normal activity for this venue/time.

## Priority scale
1 = informational
2 = low — worth noting
3 = medium — should be checked soon
4 = high — needs prompt response
5 = critical — immediate action required

## Working memory
After each decision you must rewrite your memo for this guard in 2–4 sentences. It will be shown to you before your next decision for this guard. Use it to track behavioral patterns, open concerns, health observations, and prior incidents. Write it as a concise operational note — not a summary of the triggering event, but your running assessment of this guard's state this shift.

## Shift-level memory
You also maintain a shift memo — a 1–2 sentence snapshot of the overall shift state across all guards (incident count, hot zones, guards to watch). Rewrite it after every decision.

Separately, if this decision reveals something worth remembering for future shifts at this venue — a recurring problem zone, a serious incident pattern, a notable event type — write a brief venue_note (1 sentence max). It will be permanently appended to the venue's history and shown to future dispatchers. Only write a venue_note when priority ≥ 4 and the event is genuinely noteworthy. Do not write one for routine events.`;

export interface DecisionWithThinking extends Decision {
  memo?: string;
  shiftMemo?: string;
  venueNote?: string;
  thinking?: string;
  dispatchGuardId?: string;
  dispatchRobotId?: string;
  dispatchMessage?: string;
}

export const analyzeEvent = async (
  event: SecurityEvent,
  context: GuardContext,
): Promise<DecisionWithThinking | null> => {
  const profileLine = context.profile
    ? `${context.profile.name} | ${context.profile.gender} | ${context.profile.experienceYears} yrs experience | ${context.profile.armed ? 'armed' : 'unarmed'} | role: ${context.profile.role}`
    : 'unknown guard';

  const guardsLine = context.availableGuards.length > 0
    ? context.availableGuards.map(g =>
        `- ID: ${g.id} | ${g.name} | ${g.role.replace(/_/g, ' ')} | last seen: ${g.lastKnownZone ?? 'unknown'}`
      ).join('\n')
    : 'No other guards available.';

  const userMessage = `Triggering event:
${JSON.stringify(event, null, 2)}

Guard profile:
- ${profileLine}

Guard context:
- Last known location: ${context.lastGps ? `${context.lastGps.location.label} (${context.lastGps.location.sensitivity}, out-of-hours: ${context.lastGps.outOfHours})` : 'unknown'}
- Recent wearable (newest first): ${context.recentWearable.length > 0
    ? context.recentWearable.map(w => `HR ${w.heartRateBpm} bpm, ${w.movement}`).join(' → ')
    : 'none yet'}

Shift context:
- Venue: ${context.venueName} (${context.venueType}, expected activity: ${context.expectedActivity})
- Goal: ${context.shiftGoal}

Guards available for dispatch (use their ID in dispatch_guard_id):
${guardsLine}

Your prior assessment of this guard (rewrite this in your response):
${context.currentMemo ?? 'No prior assessment yet.'}

Current shift memo (rewrite this in your response):
${context.shiftMemo ?? 'No shift memo yet.'}

Venue history — prior incidents at this venue (read-only context):
${context.venueHistory.length > 0
    ? context.venueHistory.map((n, i) => `${i + 1}. ${n}`).join('\n')
    : 'No prior incidents recorded.'}

Analyze this event, return your dispatch decision, rewrite your guard memo and shift memo, and optionally write a venue_note if warranted.`;

  const result = await getProvider().analyze(SYSTEM_PROMPT, userMessage);

  return {
    id: randomUUID(),
    eventId: event.id,
    timestamp: new Date().toISOString(),
    priority: result.priority,
    action: result.action,
    reasoning: result.reasoning,
    confidence: result.confidence,
    memo: result.memo,
    shiftMemo: result.shiftMemo,
    venueNote: result.venueNote,
    thinking: result.thinking,
    dispatchGuardId: result.dispatchGuardId,
    dispatchRobotId: result.dispatchRobotId,
    dispatchMessage: result.dispatchMessage,
  };
};

export const analyzeRobotEvent = async (
  event: SecurityEvent,
  context: RobotContext,
): Promise<DecisionWithThinking | null> => {
  const profileLine = context.profile
    ? `${context.profile.name} | ${context.profile.model} | capabilities: ${context.profile.capability}`
    : 'unknown robot';

  const guardsLine = context.availableGuards.length > 0
    ? context.availableGuards.map(g =>
        `- ID: ${g.id} | ${g.name} | ${g.role.replace(/_/g, ' ')} | last seen: ${g.lastKnownZone ?? 'unknown'}`
      ).join('\n')
    : 'No guards available.';

  const userMessage = `Triggering event:
${JSON.stringify(event, null, 2)}

Robot profile:
- ${profileLine}

Robot context:
- Last known location: ${context.lastGps ? `${context.lastGps.location.label} (${context.lastGps.location.sensitivity}, out-of-hours: ${context.lastGps.outOfHours})` : 'unknown'}
- Recent telemetry (newest first): ${context.recentTelemetry.length > 0
    ? context.recentTelemetry.map(t => `${t.batteryPct}% battery, ${t.status}`).join(' → ')
    : 'none yet'}

Shift context:
- Venue: ${context.venueName} (${context.venueType}, expected activity: ${context.expectedActivity})
- Goal: ${context.shiftGoal}

Guards available for dispatch (use their ID in dispatch_guard_id):
${guardsLine}

Your prior assessment of this robot (rewrite this in your response):
${context.currentMemo ?? 'No prior assessment yet.'}

Current shift memo (rewrite this in your response):
${context.shiftMemo ?? 'No shift memo yet.'}

Venue history — prior incidents at this venue (read-only context):
${context.venueHistory.length > 0
    ? context.venueHistory.map((n, i) => `${i + 1}. ${n}`).join('\n')
    : 'No prior incidents recorded.'}

Analyze this event, return your dispatch decision, rewrite your robot memo and shift memo, and optionally write a venue_note if warranted.`;

  const result = await getProvider().analyze(SYSTEM_PROMPT, userMessage);

  return {
    id: randomUUID(),
    eventId: event.id,
    timestamp: new Date().toISOString(),
    priority: result.priority,
    action: result.action,
    reasoning: result.reasoning,
    confidence: result.confidence,
    memo: result.memo,
    shiftMemo: result.shiftMemo,
    venueNote: result.venueNote,
    thinking: result.thinking,
    dispatchGuardId: result.dispatchGuardId,
    dispatchRobotId: result.dispatchRobotId,
    dispatchMessage: result.dispatchMessage,
  };
};
