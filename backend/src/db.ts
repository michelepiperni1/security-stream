import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { SecurityEvent, GpsEvent, WearableEvent, GuardMessage, PanicEvent } from './events.js';
import {
  SEED_LOCATIONS, SEED_ZONES, SEED_GUARDS, SEED_SHIFTS, SEED_SHIFT_GUARDS,
} from './seed.js';

const dataDir = join(dirname(fileURLToPath(import.meta.url)), '../data');
mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(join(dataDir, 'security.db'));

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
    event_id   TEXT NOT NULL REFERENCES events(id),
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
}

// --- decision type ---

export interface Decision {
  id: string;
  eventId: string;
  timestamp: string;
  priority: number;
  action: 'dispatch_guard' | 'dispatch_robot' | 'escalate' | 'monitor' | 'dismiss';
  reasoning: string;
  confidence: number;
}

// --- seed ---

export const seedIfEmpty = (): void => {
  const count = (db.prepare('SELECT COUNT(*) AS n FROM locations').get() as { n: number }).n;
  if (count > 0) return;

  for (const loc of SEED_LOCATIONS) {
    db.prepare(`INSERT INTO locations (id, name, address, type, capacity) VALUES (?, ?, ?, ?, ?)`)
      .run(loc.id, loc.name, loc.address, loc.type, loc.capacity);
  }

  for (const z of SEED_ZONES) {
    db.prepare(`INSERT INTO location_zones (id, location_id, label, lat, lng, sensitivity, authorized_hours_start, authorized_hours_end) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(z.id, z.locationId, z.label, z.lat, z.lng, z.sensitivity, z.authorizedHoursStart, z.authorizedHoursEnd);
  }

  for (const g of SEED_GUARDS) {
    db.prepare(`INSERT INTO guards (id, name, gender, experience_years, armed, role) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(g.id, g.name, g.gender, g.experienceYears, g.armed ? 1 : 0, g.role);
  }

  for (const s of SEED_SHIFTS) {
    db.prepare(`INSERT INTO shifts (id, location_id, goal, guard_type, expected_activity, active) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(s.id, s.locationId, s.goal, s.guardType, s.expectedActivity, s.active ? 1 : 0);
  }

  for (const sg of SEED_SHIFT_GUARDS) {
    db.prepare(`INSERT INTO shift_guards (shift_id, guard_id, starting_zone_id) VALUES (?, ?, ?)`)
      .run(sg.shiftId, sg.guardId, sg.startingZoneId);
  }

  console.log(`Seeded ${SEED_GUARDS.length} guards across ${SEED_SHIFTS.length} shift(s) at ${SEED_LOCATIONS.length} venue(s)`);
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

const baseFields = (event: SecurityEvent) => ({
  id: event.id, type: event.type, guardId: event.guardId,
  guardName: event.guardName, shiftId: event.shiftId,
  venueName: event.venueName, timestamp: event.timestamp,
});

export const saveEvent = (event: SecurityEvent): void => {
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

export const getRecentHistory = (limit = 100): { event: SecurityEvent; decision: Decision | null }[] => {
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
