import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { simulator, start, pauseSimulator, resumeSimulator, isSimulatorPaused } from './simulator.js';
import type { GpsEvent, WearableEvent, GuardMessage, PanicEvent, RobotGpsEvent, RobotTelemetryEvent, RobotAlertEvent, SecurityEvent } from './events.js';
import { randomUUID } from 'crypto';
import { saveEvent, saveDecision, saveGuardMemo, loadGuardMemos, saveRobotMemo, loadRobotMemos, saveRobotEvent, saveShiftMemo, loadShiftMemo, appendVenueNote, loadRecentVenueNotes, saveAgentAction, loadRecentAgentActions, loadAgentAction, saveIncident, resolveIncident, loadIncident, loadRecentIncidents, getRecentHistory, seedIfEmpty, loadActiveShifts } from './db.js';
import type { GuardProfile, RobotProfile, LoadedShift } from './db.js';
import { scenarios } from './seed.js';

let loadedShifts: LoadedShift[] = [];
import { analyzeEvent, analyzeRobotEvent, type GuardContext, type RobotContext, type DecisionWithThinking } from './agent.js';

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

// --- SSE ---

const clients = new Set<{ write: (data: string) => void }>();

const broadcast = (event: string, data: unknown) => {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) client.write(payload);
};

// --- guard context state ---

interface GuardState {
  lastGps: GpsEvent | null;
  recentWearable: WearableEvent[];
  profile: GuardProfile | null;
  shiftGoal: string;
  venueName: string;
  venueType: string;
  expectedActivity: string;
  currentMemo: string | null;
  memoUpdatedAt: string | null;
  shiftId: string;
}

const guardState = new Map<string, GuardState>();

// --- robot context state ---

interface RobotState {
  lastGps: RobotGpsEvent | null;
  recentTelemetry: RobotTelemetryEvent[];
  profile: RobotProfile | null;
  shiftGoal: string;
  venueName: string;
  venueType: string;
  expectedActivity: string;
  currentMemo: string | null;
  memoUpdatedAt: string | null;
  shiftId: string;
}

const robotState = new Map<string, RobotState>();

// --- shift-level state ---

interface ShiftState {
  locationId: string;
  shiftMemo: string | null;
  shiftMemoUpdatedAt: string | null;
  venueHistory: string[]; // last 5 notes, newest first
}

const shiftState = new Map<string, ShiftState>();

const getGuardState = (guardId: string): GuardState => {
  if (!guardState.has(guardId)) {
    guardState.set(guardId, {
      lastGps: null,
      recentWearable: [],
      profile: null,
      shiftGoal: '',
      venueName: '',
      venueType: '',
      expectedActivity: '',
      currentMemo: null,
      memoUpdatedAt: null,
      shiftId: '',
    });
  }
  return guardState.get(guardId)!;
};

const getRobotState = (robotId: string): RobotState => {
  if (!robotState.has(robotId)) {
    robotState.set(robotId, {
      lastGps: null,
      recentTelemetry: [],
      profile: null,
      shiftGoal: '',
      venueName: '',
      venueType: '',
      expectedActivity: '',
      currentMemo: null,
      memoUpdatedAt: null,
      shiftId: '',
    });
  }
  return robotState.get(robotId)!;
};

// --- dispatch ---

const dispatch = (event: GpsEvent | WearableEvent | GuardMessage | PanicEvent) => {
  const state = getGuardState(event.guardId);
  const sState = state.shiftId ? shiftState.get(state.shiftId) ?? null : null;

  const availableGuards = [...guardState.entries()]
    .filter(([id]) => id !== event.guardId)
    .map(([id, gs]) => ({
      id,
      name: gs.profile?.name ?? id,
      role: gs.profile?.role ?? 'unknown',
      lastKnownZone: gs.lastGps?.location.label ?? null,
    }));

  const context: GuardContext = {
    lastGps: state.lastGps,
    recentWearable: state.recentWearable,
    profile: state.profile,
    shiftGoal: state.shiftGoal,
    venueName: state.venueName,
    venueType: state.venueType,
    expectedActivity: state.expectedActivity,
    currentMemo: state.currentMemo,
    shiftMemo: sState?.shiftMemo ?? null,
    venueHistory: sState?.venueHistory ?? [],
    availableGuards,
  };

  analyzeEvent(event, context)
    .then(decision => {
      if (!decision) return;
      saveDecision(decision);
      broadcast('decision', decision);

      const now = new Date().toISOString();

      if (decision.memo && state.shiftId) {
        state.currentMemo = decision.memo;
        state.memoUpdatedAt = now;
        saveGuardMemo(event.guardId, state.shiftId, decision.memo, now);
        broadcast('memo', { guardId: event.guardId, shiftId: state.shiftId, content: decision.memo, updatedAt: now });
      }

      if (decision.shiftMemo && state.shiftId && sState) {
        sState.shiftMemo = decision.shiftMemo;
        sState.shiftMemoUpdatedAt = now;
        saveShiftMemo(state.shiftId, decision.shiftMemo, now);
        broadcast('shift_memo', { shiftId: state.shiftId, content: decision.shiftMemo, updatedAt: now });
      }

      if (decision.venueNote && decision.priority >= 4 && state.shiftId && sState) {
        const noteId = randomUUID();
        appendVenueNote(noteId, sState.locationId, decision.venueNote, now);
        sState.venueHistory = [decision.venueNote, ...sState.venueHistory].slice(0, 5);
        broadcast('venue_note', { id: noteId, locationId: sState.locationId, content: decision.venueNote, occurredAt: now });
      }

      executeAction(decision, sState, now);
    })
    .catch(err => app.log.error({ err }, 'Agent analysis failed'));
};

// --- shared action execution ---

const executeAction = (decision: DecisionWithThinking, sState: ShiftState | null, now: string) => {
  const action = decision.action;
  const locationId = sState?.locationId ?? '';
  const createIncident = (agentActionId: string) => {
    if (!locationId) return;
    saveIncident({ id: randomUUID(), agentActionId, locationId, timestamp: now, status: 'open' });
  };

  if (action === 'message_guard' && decision.dispatchGuardId && decision.dispatchMessage) {
    const targetState = guardState.get(decision.dispatchGuardId);
    const agentAction = {
      id: randomUUID(), decisionId: decision.id, timestamp: now,
      type: 'message_guard',
      guardId: decision.dispatchGuardId,
      guardName: targetState?.profile?.name ?? decision.dispatchGuardId,
      content: decision.dispatchMessage,
    };
    saveAgentAction(agentAction);
    createIncident(agentAction.id);
    broadcast('agent_action', agentAction);
  } else if (action === 'broadcast_alert' && decision.dispatchMessage) {
    const agentAction = {
      id: randomUUID(), decisionId: decision.id, timestamp: now,
      type: 'broadcast_alert',
      content: decision.dispatchMessage,
    };
    saveAgentAction(agentAction);
    createIncident(agentAction.id);
    broadcast('agent_action', agentAction);
  } else if (action === 'call_police') {
    const agentAction = {
      id: randomUUID(), decisionId: decision.id, timestamp: now,
      type: 'call_police',
      content: decision.reasoning,
    };
    saveAgentAction(agentAction);
    createIncident(agentAction.id);
    broadcast('agent_action', agentAction);
  } else if (action === 'dispatch_robot' && decision.dispatchRobotId && decision.dispatchMessage) {
    const targetRobot = robotState.get(decision.dispatchRobotId);
    const agentAction = {
      id: randomUUID(), decisionId: decision.id, timestamp: now,
      type: 'dispatch_robot',
      guardId: decision.dispatchRobotId,
      guardName: targetRobot?.profile?.name ?? decision.dispatchRobotId,
      content: decision.dispatchMessage,
    };
    saveAgentAction(agentAction);
    createIncident(agentAction.id);
    broadcast('agent_action', agentAction);
  } else if (action === 'dispatch_robot' || action === 'investigate') {
    const agentAction = {
      id: randomUUID(), decisionId: decision.id, timestamp: now,
      type: action,
      content: decision.reasoning,
    };
    saveAgentAction(agentAction);
    createIncident(agentAction.id);
    broadcast('agent_action', agentAction);
  }
};

// --- robot dispatch ---

const dispatchRobot = (event: RobotGpsEvent | RobotTelemetryEvent | RobotAlertEvent) => {
  const state = getRobotState(event.robotId);
  const sState = state.shiftId ? shiftState.get(state.shiftId) ?? null : null;

  const availableGuards = [...guardState.entries()]
    .map(([id, gs]) => ({
      id,
      name: gs.profile?.name ?? id,
      role: gs.profile?.role ?? 'unknown',
      lastKnownZone: gs.lastGps?.location.label ?? null,
    }));

  const context: RobotContext = {
    lastGps: state.lastGps,
    recentTelemetry: state.recentTelemetry,
    profile: state.profile,
    shiftGoal: state.shiftGoal,
    venueName: state.venueName,
    venueType: state.venueType,
    expectedActivity: state.expectedActivity,
    currentMemo: state.currentMemo,
    shiftMemo: sState?.shiftMemo ?? null,
    venueHistory: sState?.venueHistory ?? [],
    availableGuards,
  };

  analyzeRobotEvent(event, context)
    .then(decision => {
      if (!decision) return;
      saveDecision(decision);
      broadcast('decision', decision);

      const now = new Date().toISOString();

      if (decision.memo && state.shiftId) {
        state.currentMemo = decision.memo;
        state.memoUpdatedAt = now;
        saveRobotMemo(event.robotId, state.shiftId, decision.memo, now);
        broadcast('memo', { guardId: event.robotId, shiftId: state.shiftId, content: decision.memo, updatedAt: now });
      }

      if (decision.shiftMemo && state.shiftId && sState) {
        sState.shiftMemo = decision.shiftMemo;
        sState.shiftMemoUpdatedAt = now;
        saveShiftMemo(state.shiftId, decision.shiftMemo, now);
        broadcast('shift_memo', { shiftId: state.shiftId, content: decision.shiftMemo, updatedAt: now });
      }

      if (decision.venueNote && decision.priority >= 4 && state.shiftId && sState) {
        const noteId = randomUUID();
        appendVenueNote(noteId, sState.locationId, decision.venueNote, now);
        sState.venueHistory = [decision.venueNote, ...sState.venueHistory].slice(0, 5);
        broadcast('venue_note', { id: noteId, locationId: sState.locationId, content: decision.venueNote, occurredAt: now });
      }

      executeAction(decision, sState, now);
    })
    .catch(err => app.log.error({ err }, 'Robot agent analysis failed'));
};

// --- event handlers ---

simulator.on('gps', (event: GpsEvent) => {
  saveEvent(event);
  broadcast('gps', event);
  getGuardState(event.guardId).lastGps = event;
});

simulator.on('wearable', (event: WearableEvent) => {
  saveEvent(event);
  broadcast('wearable', event);

  const state = getGuardState(event.guardId);
  state.recentWearable = [event, ...state.recentWearable].slice(0, 3);

  const triggered =
    event.movement === 'fall_detected' ||
    event.movement === 'running' ||
    event.heartRateBpm > 160;

  if (triggered) dispatch(event);
});

simulator.on('message', (event: GuardMessage) => {
  saveEvent(event);
  broadcast('message', event);
  dispatch(event);
});

simulator.on('panic', (event: PanicEvent) => {
  saveEvent(event);
  broadcast('panic', event);
  dispatch(event);
});

simulator.on('robot_gps', (event: RobotGpsEvent) => {
  saveRobotEvent(event);
  broadcast('robot_gps', event);
  getRobotState(event.robotId).lastGps = event;
});

simulator.on('robot_telemetry', (event: RobotTelemetryEvent) => {
  saveRobotEvent(event);
  broadcast('robot_telemetry', event);

  const state = getRobotState(event.robotId);
  state.recentTelemetry = [event, ...state.recentTelemetry].slice(0, 3);

  if (event.batteryPct < 20 || event.status === 'fault') dispatchRobot(event);
});

simulator.on('robot_alert', (event: RobotAlertEvent) => {
  saveRobotEvent(event);
  broadcast('robot_alert', event);
  dispatchRobot(event);
});

// --- SSE route ---

app.get('/events', (req, reply) => {
  const origin = req.headers.origin ?? '*';
  reply.raw.setHeader('Access-Control-Allow-Origin', origin);
  reply.raw.setHeader('Content-Type', 'text/event-stream');
  reply.raw.setHeader('Cache-Control', 'no-cache');
  reply.raw.setHeader('Connection', 'keep-alive');
  reply.raw.flushHeaders();

  const client = { write: (data: string) => reply.raw.write(data) };
  clients.add(client);
  req.raw.on('close', () => clients.delete(client));
});

// --- history ---

app.get('/history', () => getRecentHistory(100));

// --- shift ---

app.get('/shift', () => loadedShifts);

// --- memos ---

app.get('/memos', () => {
  const result: Record<string, { content: string; updatedAt: string }> = {};
  for (const [guardId, state] of guardState.entries()) {
    if (state.currentMemo) result[guardId] = { content: state.currentMemo, updatedAt: state.memoUpdatedAt ?? '' };
  }
  for (const [robotId, state] of robotState.entries()) {
    if (state.currentMemo) result[robotId] = { content: state.currentMemo, updatedAt: state.memoUpdatedAt ?? '' };
  }
  return result;
});

// --- shift memo ---

app.get('/shift-memo', () => {
  const result: Record<string, { content: string; updatedAt: string }> = {};
  for (const [shiftId, state] of shiftState.entries()) {
    if (state.shiftMemo) result[shiftId] = { content: state.shiftMemo, updatedAt: state.shiftMemoUpdatedAt ?? '' };
  }
  return result;
});

// --- venue notes ---

app.get('/venue-notes', () => {
  const notes: Array<{ id: string; locationId: string; content: string; occurredAt: string }> = [];
  for (const state of shiftState.values()) {
    const recent = loadRecentVenueNotes(state.locationId, 10);
    notes.push(...recent.map(n => ({ ...n, locationId: state.locationId })));
  }
  notes.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  return notes;
});

// --- agent actions ---

app.get('/agent-actions', () => loadRecentAgentActions(50));

// --- incidents ---

app.get('/incidents', () => loadRecentIncidents(50));

app.post('/incidents/:id/resolve', async (req, reply) => {
  const { id } = req.params as { id: string };
  const { status, notes } = req.body as { status: string; notes?: string };

  const incident = loadIncident(id);
  if (!incident) return reply.code(404).send({ error: 'Incident not found' });

  const now = new Date().toISOString();
  resolveIncident(id, status, notes ?? null, now);

  const agentAction = loadAgentAction(incident.agentActionId);
  const label = agentAction?.guardName ?? 'all guards';
  const noteContent = `${agentAction?.type ?? 'action'} outcome (${label}): ${status}.${notes ? ' ' + notes : ''}`;
  const noteId = randomUUID();
  appendVenueNote(noteId, incident.locationId, noteContent, now);

  for (const [shiftId, ss] of shiftState.entries()) {
    if (ss.locationId === incident.locationId) {
      ss.venueHistory = [noteContent, ...ss.venueHistory].slice(0, 5);
      broadcast('venue_note', { id: noteId, locationId: incident.locationId, content: noteContent, occurredAt: now });
      break;
    }
  }

  broadcast('incident_update', { id, agentActionId: incident.agentActionId, status, resolvedAt: now });
  return { ok: true };
});

// --- simulator control ---

app.get('/sim/status', () => ({ paused: isSimulatorPaused() }));

app.post('/sim/pause', () => { pauseSimulator(); return { paused: true }; });

app.post('/sim/resume', () => { resumeSimulator(); return { paused: false }; });

app.post('/sim/event', (req) => {
  const body = req.body as Record<string, unknown>;
  const { type } = body as { type: string };

  if (type === 'robot_gps' || type === 'robot_telemetry' || type === 'robot_alert') {
    const { robotId } = body as { robotId: string };
    const state = robotState.get(robotId);
    if (!state) return { error: 'Unknown robot' };

    const shift = loadedShifts.find(s => s.id === state.shiftId);
    if (!shift) return { error: 'Robot has no active shift' };

    const now = new Date().toISOString();
    const id = randomUUID();
    const name = state.profile?.name ?? robotId;

    if (type === 'robot_gps') {
      const zone = shift.zones.find(z => z.id === (body.zoneId as string)) ?? shift.zones[0];
      simulator.emit('robot_gps', {
        id, type: 'robot_gps', timestamp: now,
        robotId, robotName: name, shiftId: state.shiftId, venueName: state.venueName,
        location: { label: zone.label, lat: zone.lat, lng: zone.lng, sensitivity: zone.sensitivity },
        outOfHours: false,
      });
    } else if (type === 'robot_telemetry') {
      simulator.emit('robot_telemetry', {
        id, type: 'robot_telemetry', timestamp: now,
        robotId, robotName: name, shiftId: state.shiftId, venueName: state.venueName,
        batteryPct: body.batteryPct as number,
        status: body.status as RobotTelemetryEvent['status'],
      });
    } else {
      simulator.emit('robot_alert', {
        id, type: 'robot_alert', timestamp: now,
        robotId, robotName: name, shiftId: state.shiftId, venueName: state.venueName,
        content: body.content as string,
        alertType: (body.alertType as RobotAlertEvent['alertType']) ?? 'status_update',
      });
    }

    return { ok: true };
  }

  const { guardId } = body as { guardId: string };

  const state = guardState.get(guardId);
  if (!state) return { error: 'Unknown guard' };

  const shift = loadedShifts.find(s => s.id === state.shiftId);
  if (!shift) return { error: 'Guard has no active shift' };

  const now = new Date().toISOString();
  const id = randomUUID();
  const name = state.profile?.name ?? guardId;

  if (type === 'gps') {
    const zone = shift.zones.find(z => z.id === (body.zoneId as string)) ?? shift.zones[0];
    simulator.emit('gps', {
      id, type: 'gps', timestamp: now,
      guardId, guardName: name, shiftId: state.shiftId, venueName: state.venueName,
      location: { label: zone.label, lat: zone.lat, lng: zone.lng, sensitivity: zone.sensitivity },
      outOfHours: false,
    });
  } else if (type === 'wearable') {
    simulator.emit('wearable', {
      id, type: 'wearable', timestamp: now,
      guardId, guardName: name, shiftId: state.shiftId, venueName: state.venueName,
      heartRateBpm: body.heartRateBpm as number,
      movement: body.movement as WearableEvent['movement'],
      batteryPct: 100,
    });
  } else if (type === 'message') {
    simulator.emit('message', {
      id, type: 'message', timestamp: now,
      guardId, guardName: name, shiftId: state.shiftId, venueName: state.venueName,
      content: body.content as string,
      messageType: body.messageType as GuardMessage['messageType'],
    });
  } else if (type === 'panic') {
    const loc = state.lastGps?.location ?? { label: shift.zones[0].label, lat: shift.zones[0].lat, lng: shift.zones[0].lng };
    simulator.emit('panic', {
      id, type: 'panic', timestamp: now,
      guardId, guardName: name, shiftId: state.shiftId, venueName: state.venueName,
      location: loc,
    });
  } else {
    return { error: 'Unknown event type' };
  }

  return { ok: true };
});

// --- health ---

app.get('/health', () => ({ ok: true }));

// --- boot ---

await app.listen({ port: 3000 });
const scenarioName = process.env.SCENARIO ?? 'berghain';
console.log(`Server running on http://localhost:3000 [scenario: ${scenarioName}]`);

seedIfEmpty(scenarios[scenarioName] ?? scenarios.berghain);
loadedShifts = loadActiveShifts();

for (const shift of loadedShifts) {
  const savedShiftMemo = loadShiftMemo(shift.id);
  const recentVenueNotes = loadRecentVenueNotes(shift.locationId, 5);
  shiftState.set(shift.id, {
    locationId: shift.locationId,
    shiftMemo: savedShiftMemo?.content ?? null,
    shiftMemoUpdatedAt: savedShiftMemo?.updatedAt ?? null,
    venueHistory: recentVenueNotes.map(n => n.content),
  });

  const memos = loadGuardMemos(shift.id);
  for (const guard of shift.guards) {
    const saved = memos.get(guard.id);
    guardState.set(guard.id, {
      lastGps: null,
      recentWearable: [],
      profile: guard,
      shiftGoal: shift.goal,
      venueName: shift.venueName,
      venueType: shift.venueType,
      expectedActivity: shift.expectedActivity,
      currentMemo: saved?.content ?? null,
      memoUpdatedAt: saved?.updatedAt ?? null,
      shiftId: shift.id,
    });
  }

  const robotMemos = loadRobotMemos(shift.id);
  for (const robot of shift.robots) {
    const saved = robotMemos.get(robot.id);
    robotState.set(robot.id, {
      lastGps: null,
      recentTelemetry: [],
      profile: robot,
      shiftGoal: shift.goal,
      venueName: shift.venueName,
      venueType: shift.venueType,
      expectedActivity: shift.expectedActivity,
      currentMemo: saved?.content ?? null,
      memoUpdatedAt: saved?.updatedAt ?? null,
      shiftId: shift.id,
    });
  }
}

start(loadedShifts);
