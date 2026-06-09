import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { simulator, start } from './simulator.js';
import type { GpsEvent, WearableEvent, GuardMessage, PanicEvent, SecurityEvent } from './events.js';
import { saveEvent, saveDecision, getRecentHistory, seedIfEmpty, loadActiveShifts } from './db.js';
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
}

const guardState = new Map<string, GuardState>();

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
    });
  }
  return guardState.get(guardId)!;
};

// --- dispatch ---

const dispatch = (event: SecurityEvent) => {
  const state = getGuardState(event.guardId);
  const context: GuardContext = {
    lastGps: state.lastGps,
    recentWearable: state.recentWearable,
    profile: state.profile,
    shiftGoal: state.shiftGoal,
    venueName: state.venueName,
    venueType: state.venueType,
    expectedActivity: state.expectedActivity,
  };

  analyzeEvent(event, context)
    .then(decision => {
      if (!decision) return;
      saveDecision(decision);
      broadcast('decision', decision);
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

// --- health ---

app.get('/health', () => ({ ok: true }));

// --- boot ---

await app.listen({ port: 3000 });
console.log('Server running on http://localhost:3000');

seedIfEmpty();
loadedShifts = loadActiveShifts();

for (const shift of loadedShifts) {
  for (const guard of shift.guards) {
    guardState.set(guard.id, {
      lastGps: null,
      recentWearable: [],
      profile: guard,
      shiftGoal: shift.goal,
      venueName: shift.venueName,
      venueType: shift.venueType,
      expectedActivity: shift.expectedActivity,
    });
  }
}

start(loadedShifts);
