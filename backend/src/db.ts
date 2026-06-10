import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { SecurityEvent, GpsEvent, WearableEvent, GuardMessage, PanicEvent, RobotGpsEvent, RobotTelemetryEvent, RobotAlertEvent } from './events.js';
import type { ScenarioData } from './seed.js';

const dataDir = join(dirname(fileURLToPath(import.meta.url)), '../data');
mkdirSync(dataDir, { recursive: true });

const scenarioName = process.env.SCENARIO ?? 'berghain';
const db = new DatabaseSync(join(dataDir, `${scenarioName}.db`));

db.exec(`
  -- Entity tables
  CREATE TABLE IF NOT EXISTS locations (
    id       TEXT PRIMARY KEY,
    name     TEXT NOT NULL,
    address  TEXT NOT NULL,
    type     TEXT NOT NULL,
    capacity INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS location_zones (
    id                     TEXT PRIMARY KEY,
    location_id            TEXT NOT NULL REFERENCES locations(id),
    label                  TEXT NOT NULL,
    lat                    REAL NOT NULL,
    lng                    REAL NOT NULL,
    sensitivity            TEXT NOT NULL,
    authorized_hours_start INTEGER NOT NULL,
    authorized_hours_end   INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS guards (
    id               TEXT PRIMARY KEY,
    name             TEXT NOT NULL,
    gender           TEXT NOT NULL,
    experience_years INTEGER NOT NULL,
    armed            INTEGER NOT NULL DEFAULT 0,
    role             TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS shifts (
    id                TEXT PRIMARY KEY,
    location_id       TEXT NOT NULL REFERENCES locations(id),
    goal              TEXT NOT NULL,
    guard_type        TEXT NOT NULL,
    expected_activity TEXT NOT NULL,
    active            INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS shift_guards (
    shift_id         TEXT NOT NULL REFERENCES shifts(id),
    guard_id         TEXT NOT NULL REFERENCES guards(id),
    starting_zone_id TEXT NOT NULL REFERENCES location_zones(id),
    PRIMARY KEY (shift_id, guard_id)
  );

  -- Event stream tables
  CREATE TABLE IF NOT EXISTS events (
    id         TEXT PRIMARY KEY,
    type       TEXT NOT NULL,
    guard_id   TEXT NOT NULL,
    guard_name TEXT NOT NULL,
    shift_id   TEXT NOT NULL,
    venue_name TEXT NOT NULL,
    timestamp  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS gps_events (
    event_id       TEXT PRIMARY KEY REFERENCES events(id),
    lat            REAL NOT NULL,
    lng            REAL NOT NULL,
    location_label TEXT NOT NULL,
    sensitivity    TEXT NOT NULL,
    out_of_hours   INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS wearable_events (
    event_id       TEXT PRIMARY KEY REFERENCES events(id),
    heart_rate_bpm INTEGER NOT NULL,
    movement       TEXT NOT NULL,
    battery_pct    INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS messages (
    event_id     TEXT PRIMARY KEY REFERENCES events(id),
    content      TEXT NOT NULL,
    message_type TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS panic_events (
    event_id       TEXT PRIMARY KEY REFERENCES events(id),
    lat            REAL NOT NULL,
    lng            REAL NOT NULL,
    location_label TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS decisions (
    id         TEXT PRIMARY KEY,
    event_id   TEXT NOT NULL,
    timestamp  TEXT NOT NULL,
    priority   INTEGER NOT NULL,
    action     TEXT NOT NULL,
    reasoning  TEXT NOT NULL,
    confidence REAL NOT NULL
  );

  CREATE TABLE IF NOT EXISTS guard_memos (
    guard_id   TEXT NOT NULL,
    shift_id   TEXT NOT NULL,
    content    TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (guard_id, shift_id)
  );

  CREATE TABLE IF NOT EXISTS shift_memos (
    shift_id   TEXT PRIMARY KEY,
    content    TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS venue_notes (
    id          TEXT PRIMARY KEY,
    location_id TEXT NOT NULL,
    content     TEXT NOT NULL,
    occurred_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS agent_actions (
    id          TEXT PRIMARY KEY,
    decision_id TEXT NOT NULL,
    timestamp   TEXT NOT NULL,
    type        TEXT NOT NULL,
    guard_id    TEXT,
    guard_name  TEXT,
    content     TEXT
  );

  CREATE TABLE IF NOT EXISTS incidents (
    id              TEXT PRIMARY KEY,
    agent_action_id TEXT NOT NULL,
    location_id     TEXT NOT NULL,
    timestamp       TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'open',
    outcome_notes   TEXT,
    resolved_at     TEXT
  );

  -- Robot entity tables
  CREATE TABLE IF NOT EXISTS robots (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    model      TEXT NOT NULL,
    capability TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS shift_robots (
    shift_id         TEXT NOT NULL REFERENCES shifts(id),
    robot_id         TEXT NOT NULL REFERENCES robots(id),
    starting_zone_id TEXT NOT NULL REFERENCES location_zones(id),
    PRIMARY KEY (shift_id, robot_id)
  );

  -- Robot event stream tables
  CREATE TABLE IF NOT EXISTS robot_events (
    id         TEXT PRIMARY KEY,
    type       TEXT NOT NULL,
    robot_id   TEXT NOT NULL,
    robot_name TEXT NOT NULL,
    shift_id   TEXT NOT NULL,
    venue_name TEXT NOT NULL,
    timestamp  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS robot_gps_events (
    event_id       TEXT PRIMARY KEY REFERENCES robot_events(id),
    lat            REAL NOT NULL,
    lng            REAL NOT NULL,
    location_label TEXT NOT NULL,
    sensitivity    TEXT NOT NULL,
    out_of_hours   INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS robot_telemetry_events (
    event_id    TEXT PRIMARY KEY REFERENCES robot_events(id),
    battery_pct INTEGER NOT NULL,
    status      TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS robot_alert_events (
    event_id   TEXT PRIMARY KEY REFERENCES robot_events(id),
    content    TEXT NOT NULL,
    alert_type TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS robot_memos (
    robot_id   TEXT NOT NULL,
    shift_id   TEXT NOT NULL,
    content    TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (robot_id, shift_id)
  );
`);

// --- entity types ---

export interface Zone {
  id: string;
  label: string;
  lat: number;
  lng: number;
  sensitivity: 'public' | 'controlled' | 'restricted';
  authorizedHoursStart: number;
  authorizedHoursEnd: number;
}

export interface GuardProfile {
  id: string;
  name: string;
  gender: string;
  experienceYears: number;
  armed: boolean;
  role: string;
  startingZoneIndex: number;
}

export interface RobotProfile {
  id: string;
  name: string;
  model: string;
  capability: string;
  startingZoneIndex: number;
}

export interface LoadedShift {
  id: string;
  locationId: string;
  goal: string;
  venueName: string;
  venueAddress: string;
  venueType: string;
  venueCapacity: number;
  guardType: string;
  expectedActivity: string;
  zones: Zone[];
  guards: GuardProfile[];
  robots: RobotProfile[];
}

// --- decision type ---

export interface Decision {
  id: string;
  eventId: string;
  timestamp: string;
  priority: number;
  action: string;
  reasoning: string;
  confidence: number;
}

// --- agent action type ---

export interface AgentAction {
  id: string;
  decisionId: string;
  timestamp: string;
  type: string;
  guardId?: string;
  guardName?: string;
  content?: string;
}

// --- incident type ---

export interface Incident {
  id: string;
  agentActionId: string;
  locationId: string;
  timestamp: string;
  status: 'open' | 'resolved' | 'false_alarm' | 'escalated';
  outcomeNotes?: string;
  resolvedAt?: string;
}

// --- seed ---

export const seedIfEmpty = (data: ScenarioData): void => {
  const count = (db.prepare('SELECT COUNT(*) AS n FROM locations').get() as { n: number }).n;
  if (count > 0) return;

  for (const loc of data.locations) {
    db.prepare(`INSERT INTO locations (id, name, address, type, capacity) VALUES (?, ?, ?, ?, ?)`)
      .run(loc.id, loc.name, loc.address, loc.type, loc.capacity);
  }

  for (const z of data.zones) {
    db.prepare(`INSERT INTO location_zones (id, location_id, label, lat, lng, sensitivity, authorized_hours_start, authorized_hours_end) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(z.id, z.locationId, z.label, z.lat, z.lng, z.sensitivity, z.authorizedHoursStart, z.authorizedHoursEnd);
  }

  for (const g of data.guards) {
    db.prepare(`INSERT INTO guards (id, name, gender, experience_years, armed, role) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(g.id, g.name, g.gender, g.experienceYears, g.armed ? 1 : 0, g.role);
  }

  for (const s of data.shifts) {
    db.prepare(`INSERT INTO shifts (id, location_id, goal, guard_type, expected_activity, active) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(s.id, s.locationId, s.goal, s.guardType, s.expectedActivity, s.active ? 1 : 0);
  }

  for (const sg of data.shiftGuards) {
    db.prepare(`INSERT INTO shift_guards (shift_id, guard_id, starting_zone_id) VALUES (?, ?, ?)`)
      .run(sg.shiftId, sg.guardId, sg.startingZoneId);
  }

  for (const r of data.robots ?? []) {
    db.prepare(`INSERT INTO robots (id, name, model, capability) VALUES (?, ?, ?, ?)`)
      .run(r.id, r.name, r.model, r.capability);
  }

  for (const sr of data.shiftRobots ?? []) {
    db.prepare(`INSERT INTO shift_robots (shift_id, robot_id, starting_zone_id) VALUES (?, ?, ?)`)
      .run(sr.shiftId, sr.robotId, sr.startingZoneId);
  }

  const robotSummary = data.robots?.length ? ` and ${data.robots.length} robot(s)` : '';
  console.log(`[${scenarioName}] Seeded ${data.guards.length} guards${robotSummary} across ${data.shifts.length} shift(s) at ${data.locations.length} venue(s)`);
};

// --- load active shifts ---

export const loadActiveShifts = (): LoadedShift[] => {
  const shifts = db.prepare(`
    SELECT s.id, s.location_id, s.goal, s.guard_type, s.expected_activity,
           l.name AS venue_name, l.address AS venue_address, l.type AS venue_type, l.capacity AS venue_capacity
    FROM shifts s
    JOIN locations l ON l.id = s.location_id
    WHERE s.active = 1
  `).all() as Array<{
    id: string; location_id: string; goal: string; guard_type: string; expected_activity: string;
    venue_name: string; venue_address: string; venue_type: string; venue_capacity: number;
  }>;

  return shifts.map(shift => {
    const zones = db.prepare(`
      SELECT z.id, z.label, z.lat, z.lng, z.sensitivity, z.authorized_hours_start, z.authorized_hours_end
      FROM location_zones z
      JOIN locations l ON l.id = z.location_id
      JOIN shifts s ON s.location_id = l.id
      WHERE s.id = ?
      ORDER BY z.rowid
    `).all(shift.id) as Array<{
      id: string; label: string; lat: number; lng: number; sensitivity: string;
      authorized_hours_start: number; authorized_hours_end: number;
    }>;

    const guardRows = db.prepare(`
      SELECT g.id, g.name, g.gender, g.experience_years, g.armed, g.role, sg.starting_zone_id
      FROM guards g
      JOIN shift_guards sg ON sg.guard_id = g.id
      WHERE sg.shift_id = ?
    `).all(shift.id) as Array<{
      id: string; name: string; gender: string; experience_years: number;
      armed: number; role: string; starting_zone_id: string;
    }>;

    const guards: GuardProfile[] = guardRows.map(g => ({
      id: g.id,
      name: g.name,
      gender: g.gender,
      experienceYears: g.experience_years,
      armed: g.armed === 1,
      role: g.role,
      startingZoneIndex: zones.findIndex(z => z.id === g.starting_zone_id),
    }));

    const robotRows = db.prepare(`
      SELECT r.id, r.name, r.model, r.capability, sr.starting_zone_id
      FROM robots r
      JOIN shift_robots sr ON sr.robot_id = r.id
      WHERE sr.shift_id = ?
    `).all(shift.id) as Array<{
      id: string; name: string; model: string; capability: string; starting_zone_id: string;
    }>;

    const robots: RobotProfile[] = robotRows.map(r => ({
      id: r.id,
      name: r.name,
      model: r.model,
      capability: r.capability,
      startingZoneIndex: zones.findIndex(z => z.id === r.starting_zone_id),
    }));

    return {
      id: shift.id,
      locationId: shift.location_id,
      goal: shift.goal,
      venueName: shift.venue_name,
      venueAddress: shift.venue_address,
      venueType: shift.venue_type,
      venueCapacity: shift.venue_capacity,
      guardType: shift.guard_type,
      expectedActivity: shift.expected_activity,
      zones: zones.map(z => ({
        id: z.id,
        label: z.label,
        lat: z.lat,
        lng: z.lng,
        sensitivity: z.sensitivity as Zone['sensitivity'],
        authorizedHoursStart: z.authorized_hours_start,
        authorizedHoursEnd: z.authorized_hours_end,
      })),
      guards,
      robots,
    };
  });
};

// --- event stream prepared statements ---

const insertBase = db.prepare(`
  INSERT OR IGNORE INTO events (id, type, guard_id, guard_name, shift_id, venue_name, timestamp)
  VALUES (:id, :type, :guardId, :guardName, :shiftId, :venueName, :timestamp)
`);

const insertGps = db.prepare(`
  INSERT OR IGNORE INTO gps_events (event_id, lat, lng, location_label, sensitivity, out_of_hours)
  VALUES (:eventId, :lat, :lng, :locationLabel, :sensitivity, :outOfHours)
`);

const insertWearable = db.prepare(`
  INSERT OR IGNORE INTO wearable_events (event_id, heart_rate_bpm, movement, battery_pct)
  VALUES (:eventId, :heartRateBpm, :movement, :batteryPct)
`);

const insertMessage = db.prepare(`
  INSERT OR IGNORE INTO messages (event_id, content, message_type)
  VALUES (:eventId, :content, :messageType)
`);

const insertPanic = db.prepare(`
  INSERT OR IGNORE INTO panic_events (event_id, lat, lng, location_label)
  VALUES (:eventId, :lat, :lng, :locationLabel)
`);

const insertDecision = db.prepare(`
  INSERT INTO decisions (id, event_id, timestamp, priority, action, reasoning, confidence)
  VALUES (:id, :eventId, :timestamp, :priority, :action, :reasoning, :confidence)
`);

const insertRobotBase = db.prepare(`
  INSERT OR IGNORE INTO robot_events (id, type, robot_id, robot_name, shift_id, venue_name, timestamp)
  VALUES (:id, :type, :robotId, :robotName, :shiftId, :venueName, :timestamp)
`);

const insertRobotGps = db.prepare(`
  INSERT OR IGNORE INTO robot_gps_events (event_id, lat, lng, location_label, sensitivity, out_of_hours)
  VALUES (:eventId, :lat, :lng, :locationLabel, :sensitivity, :outOfHours)
`);

const insertRobotTelemetry = db.prepare(`
  INSERT OR IGNORE INTO robot_telemetry_events (event_id, battery_pct, status)
  VALUES (:eventId, :batteryPct, :status)
`);

const insertRobotAlert = db.prepare(`
  INSERT OR IGNORE INTO robot_alert_events (event_id, content, alert_type)
  VALUES (:eventId, :content, :alertType)
`);

type GuardEvent = GpsEvent | WearableEvent | GuardMessage | PanicEvent;

const baseFields = (event: GuardEvent) => ({
  id: event.id, type: event.type, guardId: event.guardId,
  guardName: event.guardName, shiftId: event.shiftId,
  venueName: event.venueName, timestamp: event.timestamp,
});

export const saveEvent = (event: GuardEvent): void => {
  insertBase.run(baseFields(event));

  if (event.type === 'gps') {
    const e = event as GpsEvent;
    insertGps.run({ eventId: e.id, lat: e.location.lat, lng: e.location.lng, locationLabel: e.location.label, sensitivity: e.location.sensitivity, outOfHours: e.outOfHours ? 1 : 0 });
  } else if (event.type === 'wearable') {
    const e = event as WearableEvent;
    insertWearable.run({ eventId: e.id, heartRateBpm: e.heartRateBpm, movement: e.movement, batteryPct: e.batteryPct });
  } else if (event.type === 'message') {
    const e = event as GuardMessage;
    insertMessage.run({ eventId: e.id, content: e.content, messageType: e.messageType });
  } else if (event.type === 'panic') {
    const e = event as PanicEvent;
    insertPanic.run({ eventId: e.id, lat: e.location.lat, lng: e.location.lng, locationLabel: e.location.label });
  }
};

const robotBaseFields = (event: RobotGpsEvent | RobotTelemetryEvent | RobotAlertEvent) => ({
  id: event.id, type: event.type, robotId: event.robotId,
  robotName: event.robotName, shiftId: event.shiftId,
  venueName: event.venueName, timestamp: event.timestamp,
});

export const saveRobotEvent = (event: RobotGpsEvent | RobotTelemetryEvent | RobotAlertEvent): void => {
  insertRobotBase.run(robotBaseFields(event));

  if (event.type === 'robot_gps') {
    insertRobotGps.run({ eventId: event.id, lat: event.location.lat, lng: event.location.lng, locationLabel: event.location.label, sensitivity: event.location.sensitivity, outOfHours: event.outOfHours ? 1 : 0 });
  } else if (event.type === 'robot_telemetry') {
    insertRobotTelemetry.run({ eventId: event.id, batteryPct: event.batteryPct, status: event.status });
  } else if (event.type === 'robot_alert') {
    insertRobotAlert.run({ eventId: event.id, content: event.content, alertType: event.alertType });
  }
};

export const saveDecision = (decision: Decision): void => {
  insertDecision.run({ id: decision.id, eventId: decision.eventId, timestamp: decision.timestamp, priority: decision.priority, action: decision.action, reasoning: decision.reasoning, confidence: decision.confidence });
};

export const saveGuardMemo = (guardId: string, shiftId: string, content: string, updatedAt: string): void => {
  db.prepare(`
    INSERT INTO guard_memos (guard_id, shift_id, content, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT (guard_id, shift_id) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at
  `).run(guardId, shiftId, content, updatedAt);
};

export const loadGuardMemos = (shiftId: string): Map<string, { content: string; updatedAt: string }> => {
  const rows = db.prepare(`SELECT guard_id, content, updated_at FROM guard_memos WHERE shift_id = ?`).all(shiftId) as Array<{ guard_id: string; content: string; updated_at: string }>;
  const map = new Map<string, { content: string; updatedAt: string }>();
  for (const row of rows) map.set(row.guard_id, { content: row.content, updatedAt: row.updated_at });
  return map;
};

export const saveRobotMemo = (robotId: string, shiftId: string, content: string, updatedAt: string): void => {
  db.prepare(`
    INSERT INTO robot_memos (robot_id, shift_id, content, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT (robot_id, shift_id) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at
  `).run(robotId, shiftId, content, updatedAt);
};

export const loadRobotMemos = (shiftId: string): Map<string, { content: string; updatedAt: string }> => {
  const rows = db.prepare(`SELECT robot_id, content, updated_at FROM robot_memos WHERE shift_id = ?`).all(shiftId) as Array<{ robot_id: string; content: string; updated_at: string }>;
  const map = new Map<string, { content: string; updatedAt: string }>();
  for (const row of rows) map.set(row.robot_id, { content: row.content, updatedAt: row.updated_at });
  return map;
};

export const saveShiftMemo = (shiftId: string, content: string, updatedAt: string): void => {
  db.prepare(`
    INSERT INTO shift_memos (shift_id, content, updated_at) VALUES (?, ?, ?)
    ON CONFLICT (shift_id) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at
  `).run(shiftId, content, updatedAt);
};

export const loadShiftMemo = (shiftId: string): { content: string; updatedAt: string } | null => {
  const row = db.prepare(`SELECT content, updated_at FROM shift_memos WHERE shift_id = ?`).get(shiftId) as { content: string; updated_at: string } | undefined;
  return row ? { content: row.content, updatedAt: row.updated_at } : null;
};

export const appendVenueNote = (id: string, locationId: string, content: string, occurredAt: string): void => {
  db.prepare(`INSERT INTO venue_notes (id, location_id, content, occurred_at) VALUES (?, ?, ?, ?)`).run(id, locationId, content, occurredAt);
};

export const loadRecentVenueNotes = (locationId: string, limit = 5): Array<{ id: string; content: string; occurredAt: string }> => {
  const rows = db.prepare(`SELECT id, content, occurred_at FROM venue_notes WHERE location_id = ? ORDER BY occurred_at DESC LIMIT ?`).all(locationId, limit) as Array<{ id: string; content: string; occurred_at: string }>;
  return rows.map(r => ({ id: r.id, content: r.content, occurredAt: r.occurred_at }));
};

export const saveAgentAction = (action: AgentAction): void => {
  db.prepare(`
    INSERT INTO agent_actions (id, decision_id, timestamp, type, guard_id, guard_name, content)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(action.id, action.decisionId, action.timestamp, action.type, action.guardId ?? null, action.guardName ?? null, action.content ?? null);
};

export const loadRecentAgentActions = (limit = 50): AgentAction[] => {
  const rows = db.prepare(`
    SELECT id, decision_id, timestamp, type, guard_id, guard_name, content
    FROM agent_actions ORDER BY timestamp DESC LIMIT ?
  `).all(limit) as Array<{ id: string; decision_id: string; timestamp: string; type: string; guard_id: string | null; guard_name: string | null; content: string | null }>;
  return rows.map(r => ({
    id: r.id,
    decisionId: r.decision_id,
    timestamp: r.timestamp,
    type: r.type,
    guardId: r.guard_id ?? undefined,
    guardName: r.guard_name ?? undefined,
    content: r.content ?? undefined,
  }));
};

export const loadAgentAction = (id: string): AgentAction | null => {
  const r = db.prepare(`SELECT id, decision_id, timestamp, type, guard_id, guard_name, content FROM agent_actions WHERE id = ?`).get(id) as { id: string; decision_id: string; timestamp: string; type: string; guard_id: string | null; guard_name: string | null; content: string | null } | undefined;
  if (!r) return null;
  return { id: r.id, decisionId: r.decision_id, timestamp: r.timestamp, type: r.type, guardId: r.guard_id ?? undefined, guardName: r.guard_name ?? undefined, content: r.content ?? undefined };
};

export const saveIncident = (incident: Incident): void => {
  db.prepare(`
    INSERT INTO incidents (id, agent_action_id, location_id, timestamp, status)
    VALUES (?, ?, ?, ?, ?)
  `).run(incident.id, incident.agentActionId, incident.locationId, incident.timestamp, incident.status);
};

export const resolveIncident = (id: string, status: string, notes: string | null, resolvedAt: string): void => {
  db.prepare(`
    UPDATE incidents SET status = ?, outcome_notes = ?, resolved_at = ? WHERE id = ?
  `).run(status, notes, resolvedAt, id);
};

export const loadIncident = (id: string): Incident | null => {
  const r = db.prepare(`SELECT id, agent_action_id, location_id, timestamp, status, outcome_notes, resolved_at FROM incidents WHERE id = ?`).get(id) as { id: string; agent_action_id: string; location_id: string; timestamp: string; status: string; outcome_notes: string | null; resolved_at: string | null } | undefined;
  if (!r) return null;
  return { id: r.id, agentActionId: r.agent_action_id, locationId: r.location_id, timestamp: r.timestamp, status: r.status as Incident['status'], outcomeNotes: r.outcome_notes ?? undefined, resolvedAt: r.resolved_at ?? undefined };
};

export const loadRecentIncidents = (limit = 50): Incident[] => {
  const rows = db.prepare(`SELECT id, agent_action_id, location_id, timestamp, status, outcome_notes, resolved_at FROM incidents ORDER BY timestamp DESC LIMIT ?`).all(limit) as Array<{ id: string; agent_action_id: string; location_id: string; timestamp: string; status: string; outcome_notes: string | null; resolved_at: string | null }>;
  return rows.map(r => ({ id: r.id, agentActionId: r.agent_action_id, locationId: r.location_id, timestamp: r.timestamp, status: r.status as Incident['status'], outcomeNotes: r.outcome_notes ?? undefined, resolvedAt: r.resolved_at ?? undefined }));
};

// --- history query ---

type HistoryRow = {
  id: string; type: string; guard_id: string; guard_name: string;
  shift_id: string; venue_name: string; timestamp: string;
  lat: number | null; lng: number | null; location_label: string | null;
  sensitivity: string | null; out_of_hours: number | null;
  heart_rate_bpm: number | null; movement: string | null; battery_pct: number | null;
  content: string | null; message_type: string | null;
  p_lat: number | null; p_lng: number | null; p_location_label: string | null;
  d_id: string | null; d_event_id: string | null; d_ts: string | null;
  d_priority: number | null; d_action: string | null;
  d_reasoning: string | null; d_confidence: number | null;
};

const rowToEvent = (row: HistoryRow): SecurityEvent => {
  const base = { id: row.id, guardId: row.guard_id, guardName: row.guard_name, shiftId: row.shift_id, venueName: row.venue_name, timestamp: row.timestamp };
  if (row.type === 'gps')      return { ...base, type: 'gps',      location: { label: row.location_label!, lat: row.lat!, lng: row.lng!, sensitivity: row.sensitivity! }, outOfHours: row.out_of_hours === 1 } as GpsEvent;
  if (row.type === 'wearable') return { ...base, type: 'wearable', heartRateBpm: row.heart_rate_bpm!, movement: row.movement as WearableEvent['movement'], batteryPct: row.battery_pct! } as WearableEvent;
  if (row.type === 'message')  return { ...base, type: 'message',  content: row.content!, messageType: row.message_type as GuardMessage['messageType'] } as GuardMessage;
  return { ...base, type: 'panic', location: { label: row.p_location_label!, lat: row.p_lat!, lng: row.p_lng! } } as PanicEvent;
};

const getRecentGuardHistory = (limit: number): { event: SecurityEvent; decision: Decision | null }[] => {
  const rows = db.prepare(`
    SELECT e.id, e.type, e.guard_id, e.guard_name, e.shift_id, e.venue_name, e.timestamp,
           g.lat, g.lng, g.location_label, g.sensitivity, g.out_of_hours,
           w.heart_rate_bpm, w.movement, w.battery_pct,
           m.content, m.message_type,
           p.lat AS p_lat, p.lng AS p_lng, p.location_label AS p_location_label,
           d.id AS d_id, d.event_id AS d_event_id, d.timestamp AS d_ts,
           d.priority AS d_priority, d.action AS d_action,
           d.reasoning AS d_reasoning, d.confidence AS d_confidence
    FROM events e
    LEFT JOIN gps_events      g ON g.event_id = e.id
    LEFT JOIN wearable_events w ON w.event_id = e.id
    LEFT JOIN messages        m ON m.event_id = e.id
    LEFT JOIN panic_events    p ON p.event_id = e.id
    LEFT JOIN decisions       d ON d.event_id = e.id
    ORDER BY e.timestamp DESC
    LIMIT :limit
  `).all({ limit }) as HistoryRow[];

  return rows.map(row => ({
    event: rowToEvent(row),
    decision: row.d_id ? {
      id: row.d_id, eventId: row.d_event_id!, timestamp: row.d_ts!,
      priority: row.d_priority!, action: row.d_action as Decision['action'],
      reasoning: row.d_reasoning!, confidence: row.d_confidence!,
    } : null,
  }));
};

type RobotHistoryRow = {
  id: string; type: string; robot_id: string; robot_name: string;
  shift_id: string; venue_name: string; timestamp: string;
  lat: number | null; lng: number | null; location_label: string | null;
  sensitivity: string | null; out_of_hours: number | null;
  battery_pct: number | null; status: string | null;
  content: string | null; alert_type: string | null;
  d_id: string | null; d_event_id: string | null; d_ts: string | null;
  d_priority: number | null; d_action: string | null;
  d_reasoning: string | null; d_confidence: number | null;
};

const robotRowToEvent = (row: RobotHistoryRow): SecurityEvent => {
  const base = { id: row.id, robotId: row.robot_id, robotName: row.robot_name, shiftId: row.shift_id, venueName: row.venue_name, timestamp: row.timestamp };
  if (row.type === 'robot_gps')       return { ...base, type: 'robot_gps', location: { label: row.location_label!, lat: row.lat!, lng: row.lng!, sensitivity: row.sensitivity! }, outOfHours: row.out_of_hours === 1 } as RobotGpsEvent;
  if (row.type === 'robot_telemetry') return { ...base, type: 'robot_telemetry', batteryPct: row.battery_pct!, status: row.status as RobotTelemetryEvent['status'] } as RobotTelemetryEvent;
  return { ...base, type: 'robot_alert', content: row.content!, alertType: row.alert_type as RobotAlertEvent['alertType'] } as RobotAlertEvent;
};

const getRecentRobotHistory = (limit: number): { event: SecurityEvent; decision: Decision | null }[] => {
  const rows = db.prepare(`
    SELECT e.id, e.type, e.robot_id, e.robot_name, e.shift_id, e.venue_name, e.timestamp,
           g.lat, g.lng, g.location_label, g.sensitivity, g.out_of_hours,
           t.battery_pct, t.status,
           a.content, a.alert_type,
           d.id AS d_id, d.event_id AS d_event_id, d.timestamp AS d_ts,
           d.priority AS d_priority, d.action AS d_action,
           d.reasoning AS d_reasoning, d.confidence AS d_confidence
    FROM robot_events e
    LEFT JOIN robot_gps_events       g ON g.event_id = e.id
    LEFT JOIN robot_telemetry_events t ON t.event_id = e.id
    LEFT JOIN robot_alert_events     a ON a.event_id = e.id
    LEFT JOIN decisions              d ON d.event_id = e.id
    ORDER BY e.timestamp DESC
    LIMIT :limit
  `).all({ limit }) as RobotHistoryRow[];

  return rows.map(row => ({
    event: robotRowToEvent(row),
    decision: row.d_id ? {
      id: row.d_id, eventId: row.d_event_id!, timestamp: row.d_ts!,
      priority: row.d_priority!, action: row.d_action as Decision['action'],
      reasoning: row.d_reasoning!, confidence: row.d_confidence!,
    } : null,
  }));
};

export const getRecentHistory = (limit = 100): { event: SecurityEvent; decision: Decision | null }[] => {
  const merged = [...getRecentGuardHistory(limit), ...getRecentRobotHistory(limit)];
  merged.sort((a, b) => b.event.timestamp.localeCompare(a.event.timestamp));
  return merged.slice(0, limit);
};
