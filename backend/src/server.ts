import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { simulator, start } from './simulator.js';
import type { GpsEvent, WearableEvent, GuardMessage, PanicEvent, SecurityEvent } from './events.js';
import { randomUUID } from 'crypto';
import { saveEvent, saveDecision, saveGuardMemo, loadGuardMemos, saveShiftMemo, loadShiftMemo, appendVenueNote, loadRecentVenueNotes, getRecentHistory, seedIfEmpty, loadActiveShifts } from './db.js';
import type { GuardProfile, LoadedShift } from './db.js';

let loadedShifts: LoadedShift[] = [];
import { analyzeEvent, type GuardContext } from './agent.js';

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

// --- dispatch ---

const dispatch = (event: SecurityEvent) => {
  const state = getGuardState(event.guardId);
  const sState = state.shiftId ? shiftState.get(state.shiftId) ?? null : null;
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
    })
    .catch(err => app.log.error({ err }, 'Agent analysis failed'));
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
    event.heartRateBpm > 90;

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

// --- health ---

app.get('/health', () => ({ ok: true }));

// --- boot ---

await app.listen({ port: 3000 });
console.log('Server running on http://localhost:3000');

seedIfEmpty();
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
}

start(loadedShifts);
