import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import type { AgentReport } from './simulator.js';

const dataDir = join(dirname(fileURLToPath(import.meta.url)), '../data');
mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(join(dataDir, 'security.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS reports (
    id             TEXT PRIMARY KEY,
    timestamp      TEXT NOT NULL,
    agent_type     TEXT NOT NULL,
    agent_id       TEXT NOT NULL,
    agent_name     TEXT NOT NULL,
    shift_id       TEXT NOT NULL,
    venue_name     TEXT NOT NULL,
    venue_type     TEXT NOT NULL,
    guard_type     TEXT NOT NULL,
    location_label TEXT NOT NULL,
    sensitivity    TEXT NOT NULL,
    out_of_hours   INTEGER NOT NULL,
    raw            TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS decisions (
    id          TEXT PRIMARY KEY,
    report_id   TEXT NOT NULL REFERENCES reports(id),
    timestamp   TEXT NOT NULL,
    priority    INTEGER NOT NULL,
    action      TEXT NOT NULL,
    reasoning   TEXT NOT NULL,
    confidence  REAL NOT NULL
  );

  CREATE TABLE IF NOT EXISTS outcomes (
    id          TEXT PRIMARY KEY,
    decision_id TEXT NOT NULL REFERENCES decisions(id),
    timestamp   TEXT NOT NULL,
    outcome     TEXT NOT NULL
  );
`);

// --- types ---

export interface Decision {
  id: string;
  reportId: string;
  timestamp: string;
  priority: number;
  action: 'dispatch_guard' | 'dispatch_robot' | 'escalate' | 'monitor' | 'dismiss';
  reasoning: string;
  confidence: number;
}

// --- prepared statements ---

const insertReport = db.prepare(`
  INSERT OR IGNORE INTO reports
    (id, timestamp, agent_type, agent_id, agent_name, shift_id, venue_name, venue_type, guard_type, location_label, sensitivity, out_of_hours, raw)
  VALUES
    (:id, :timestamp, :agentType, :agentId, :agentName, :shiftId, :venueName, :venueType, :guardType, :locationLabel, :sensitivity, :outOfHours, :raw)
`);

const insertDecision = db.prepare(`
  INSERT INTO decisions (id, report_id, timestamp, priority, action, reasoning, confidence)
  VALUES (:id, :reportId, :timestamp, :priority, :action, :reasoning, :confidence)
`);

const insertOutcome = db.prepare(`
  INSERT INTO outcomes (id, decision_id, timestamp, outcome)
  VALUES (:id, :decisionId, :timestamp, :outcome)
`);

// --- exports ---

export const saveReport = (report: AgentReport): void => {
  insertReport.run({
    id: report.id,
    timestamp: report.timestamp,
    agentType: report.agentType,
    agentId: report.agentId,
    agentName: report.agentName,
    shiftId: report.shiftContext.shiftId,
    venueName: report.shiftContext.venueName,
    venueType: report.shiftContext.venueType,
    guardType: report.shiftContext.guardType,
    locationLabel: report.location.label,
    sensitivity: report.location.sensitivity,
    outOfHours: report.outOfHours ? 1 : 0,
    raw: JSON.stringify(report),
  });
};

export const saveDecision = (decision: Decision): void => {
  insertDecision.run({
    id: decision.id,
    reportId: decision.reportId,
    timestamp: decision.timestamp,
    priority: decision.priority,
    action: decision.action,
    reasoning: decision.reasoning,
    confidence: decision.confidence,
  });
};

export const saveOutcome = (decisionId: string, outcome: 'confirmed' | 'false_alarm'): void => {
  insertOutcome.run({
    id: randomUUID(),
    decisionId,
    timestamp: new Date().toISOString(),
    outcome,
  });
};

export const getFalsePositiveRate = (shiftId: string, locationLabel: string): number => {
  const row = db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN o.outcome = 'false_alarm' THEN 1 ELSE 0 END) AS false_alarms
    FROM outcomes o
    JOIN decisions d ON o.decision_id = d.id
    JOIN reports r ON d.report_id = r.id
    WHERE r.shift_id = :shiftId AND r.location_label = :locationLabel
  `).get({ shiftId, locationLabel }) as { total: number; false_alarms: number } | undefined;

  if (!row || row.total === 0) return 0;
  return row.false_alarms / row.total;
};

export const getRecentReports = (limit = 50): AgentReport[] => {
  const rows = db.prepare(
    'SELECT raw FROM reports ORDER BY timestamp DESC LIMIT :limit'
  ).all({ limit }) as { raw: string }[];
  return rows.map(r => JSON.parse(r.raw) as AgentReport);
};
