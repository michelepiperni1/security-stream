import { randomUUID } from 'crypto';
import { EventEmitter } from 'events';

export const simulator = new EventEmitter();

// --- types ---

interface ShiftContext {
  shiftId: string;
  guardType: 'bouncer' | 'patrol' | 'event' | 'private';
  venueType:
    | 'nightclub' | 'bar' | 'shopping_centre' | 'construction_site'
    | 'residential_building' | 'commercial_building'
    | 'concert' | 'sports' | 'festival' | 'corporate_event';
  venueName: string;
  expectedActivity: 'none' | 'low' | 'normal' | 'high' | 'peak';
}

interface Location {
  label: string;
  lat: number;
  lng: number;
  sensitivity: 'public' | 'controlled' | 'restricted';
  authorizedHoursStart: number;
  authorizedHoursEnd: number;
}

interface GuardSensors {
  movement: 'stationary' | 'walking' | 'running' | 'fall_detected';
  audioAlert: 'none' | 'raised_voices' | 'glass_break' | 'alarm' | 'gunshot';
  heartRateBpm: number;
  batteryPct: number;
}

interface RobotSensors {
  personDetected: boolean;
  motionDetected: boolean;
  thermalAnomaly: boolean;
  soundLevelDb: number;
  batteryPct: number;
}

export interface GuardReport {
  id: string;
  timestamp: string;
  agentType: 'guard';
  agentId: string;
  agentName: string;
  location: Location;
  outOfHours: boolean;
  sensors: GuardSensors;
  dutyStatus: 'patrolling' | 'responding' | 'escorting' | 'on_break';
  panicPressed: boolean;
  shiftContext: ShiftContext;
}

export interface RobotReport {
  id: string;
  timestamp: string;
  agentType: 'robot';
  agentId: string;
  agentName: string;
  location: Location;
  outOfHours: boolean;
  sensors: RobotSensors;
  patrolStatus: 'patrolling' | 'investigating' | 'docked' | 'error';
  shiftContext: ShiftContext;
}

export type AgentReport = GuardReport | RobotReport;

// --- agents ---

interface GuardAgent {
  type: 'guard';
  id: string;
  name: string;
  zoneIndex: number;
  dutyStatus: GuardReport['dutyStatus'];
}

interface RobotAgent {
  type: 'robot';
  id: string;
  name: string;
  zoneIndex: number;
}

type Agent = GuardAgent | RobotAgent;

interface Shift {
  id: string;
  context: ShiftContext;
  zones: Location[];
  agents: Agent[];
}

// --- shifts ---

const SHIFTS: Shift[] = [
  // --- active shift ---
  {
    id: 'shift-skybar',
    context: {
      shiftId: 'shift-skybar',
      guardType: 'bouncer',
      venueType: 'nightclub',
      venueName: 'Skybar',
      expectedActivity: 'peak',
    },
    zones: [
      { label: 'Main Door',    lat: 37.7749, lng: -122.4194, sensitivity: 'public',     authorizedHoursStart: 20, authorizedHoursEnd: 4  },
      { label: 'Bar Area',     lat: 37.7750, lng: -122.4192, sensitivity: 'public',     authorizedHoursStart: 20, authorizedHoursEnd: 4  },
      { label: 'Dance Floor',  lat: 37.7751, lng: -122.4191, sensitivity: 'public',     authorizedHoursStart: 20, authorizedHoursEnd: 4  },
      { label: 'VIP Section',  lat: 37.7751, lng: -122.4189, sensitivity: 'restricted', authorizedHoursStart: 20, authorizedHoursEnd: 4  },
      { label: 'Rear Exit',    lat: 37.7748, lng: -122.4196, sensitivity: 'controlled', authorizedHoursStart: 20, authorizedHoursEnd: 4  },
    ],
    agents: [
      { type: 'guard', id: 'g-sky-001', name: 'Officer Reeves', zoneIndex: 0, dutyStatus: 'patrolling' },
      { type: 'guard', id: 'g-sky-002', name: 'Officer Marsh',  zoneIndex: 2, dutyStatus: 'patrolling' },
    ],
  },
  // --- inactive shifts (uncomment to enable) ---
  // {
  //   id: 'shift-riverside',
  //   context: {
  //     shiftId: 'shift-riverside',
  //     guardType: 'patrol',
  //     venueType: 'construction_site',
  //     venueName: 'Riverside Development',
  //     expectedActivity: 'none',
  //   },
  //   zones: [
  //     { label: 'Site Office',        lat: 37.7760, lng: -122.4180, sensitivity: 'controlled', authorizedHoursStart: 7, authorizedHoursEnd: 18 },
  //     { label: 'Equipment Storage',  lat: 37.7762, lng: -122.4178, sensitivity: 'restricted', authorizedHoursStart: 7, authorizedHoursEnd: 18 },
  //     { label: 'Active Build Zone',  lat: 37.7764, lng: -122.4175, sensitivity: 'restricted', authorizedHoursStart: 7, authorizedHoursEnd: 18 },
  //     { label: 'North Perimeter',    lat: 37.7768, lng: -122.4180, sensitivity: 'controlled', authorizedHoursStart: 0, authorizedHoursEnd: 24 },
  //     { label: 'South Perimeter',    lat: 37.7755, lng: -122.4180, sensitivity: 'controlled', authorizedHoursStart: 0, authorizedHoursEnd: 24 },
  //   ],
  //   agents: [
  //     { type: 'guard', id: 'g-rv-001', name: 'Officer Chen',    zoneIndex: 3, dutyStatus: 'patrolling' },
  //     { type: 'robot', id: 'r-rv-001', name: 'Robot Alpha',     zoneIndex: 4 },
  //   ],
  // },
  // {
  //   id: 'shift-arena',
  //   context: {
  //     shiftId: 'shift-arena',
  //     guardType: 'event',
  //     venueType: 'concert',
  //     venueName: 'Arena North',
  //     expectedActivity: 'high',
  //   },
  //   zones: [
  //     { label: 'Entry Gates',      lat: 37.7730, lng: -122.4210, sensitivity: 'public',     authorizedHoursStart: 16, authorizedHoursEnd: 23 },
  //     { label: 'GA Floor',         lat: 37.7732, lng: -122.4208, sensitivity: 'public',     authorizedHoursStart: 16, authorizedHoursEnd: 23 },
  //     { label: 'Stage Barrier',    lat: 37.7733, lng: -122.4207, sensitivity: 'controlled', authorizedHoursStart: 16, authorizedHoursEnd: 23 },
  //     { label: 'VIP / Backstage',  lat: 37.7734, lng: -122.4205, sensitivity: 'restricted', authorizedHoursStart: 14, authorizedHoursEnd: 23 },
  //     { label: 'Parking',          lat: 37.7726, lng: -122.4215, sensitivity: 'public',     authorizedHoursStart: 14, authorizedHoursEnd: 24 },
  //   ],
  //   agents: [
  //     { type: 'guard', id: 'g-ar-001', name: 'Officer Williams', zoneIndex: 0, dutyStatus: 'patrolling' },
  //     { type: 'guard', id: 'g-ar-002', name: 'Officer Patel',    zoneIndex: 2, dutyStatus: 'patrolling' },
  //     { type: 'robot', id: 'r-ar-001', name: 'Robot Beta',       zoneIndex: 4 },
  //   ],
  // },
];

// --- helpers ---

const pick = <T>(arr: readonly T[]): T =>
  arr[Math.floor(Math.random() * arr.length)];

const randInt = (min: number, max: number): number =>
  Math.round(min + Math.random() * (max - min));

const jitter = (n: number, delta: number): number =>
  Number((n + (Math.random() - 0.5) * delta).toFixed(6));

const isOutOfHours = (zone: Location): boolean => {
  const hour = new Date().getHours();
  if (zone.authorizedHoursStart <= zone.authorizedHoursEnd) {
    return hour < zone.authorizedHoursStart || hour >= zone.authorizedHoursEnd;
  }
  // spans midnight (e.g. 20–4)
  return hour >= zone.authorizedHoursEnd && hour < zone.authorizedHoursStart;
};

// --- report generators ---

const generateGuardReport = (agent: GuardAgent, shift: Shift): GuardReport => {
  const isAlert = Math.random() < 0.12;
  const zone = shift.zones[agent.zoneIndex];

  return {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    agentType: 'guard',
    agentId: agent.id,
    agentName: agent.name,
    location: { ...zone, lat: jitter(zone.lat, 0.0003), lng: jitter(zone.lng, 0.0003) },
    outOfHours: isOutOfHours(zone),
    sensors: {
      movement: isAlert
        ? pick(['running', 'running', 'fall_detected'] as const)
        : pick(['stationary', 'walking', 'walking'] as const),
      audioAlert: isAlert
        ? pick(['raised_voices', 'glass_break', 'alarm', 'gunshot'] as const)
        : 'none',
      heartRateBpm: isAlert ? randInt(95, 145) : randInt(62, 82),
      batteryPct: randInt(35, 100),
    },
    dutyStatus: agent.dutyStatus,
    panicPressed: isAlert && Math.random() < 0.25,
    shiftContext: shift.context,
  };
};

const generateRobotReport = (agent: RobotAgent, shift: Shift): RobotReport => {
  const isAlert = Math.random() < 0.12;
  const zone = shift.zones[agent.zoneIndex];

  return {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    agentType: 'robot',
    agentId: agent.id,
    agentName: agent.name,
    location: zone,
    outOfHours: isOutOfHours(zone),
    sensors: {
      personDetected: isAlert,
      motionDetected: isAlert || Math.random() < 0.15,
      thermalAnomaly: isAlert && Math.random() < 0.4,
      soundLevelDb: isAlert ? randInt(58, 88) : randInt(18, 42),
      batteryPct: randInt(35, 100),
    },
    patrolStatus: isAlert
      ? 'investigating'
      : pick(['patrolling', 'patrolling', 'patrolling', 'docked'] as const),
    shiftContext: shift.context,
  };
};

const generateReport = (shift: Shift): AgentReport => {
  const agent = pick(shift.agents);
  if (Math.random() < 0.15) {
    agent.zoneIndex = Math.floor(Math.random() * shift.zones.length);
  }
  return agent.type === 'guard'
    ? generateGuardReport(agent, shift)
    : generateRobotReport(agent, shift);
};

// --- simulator ---

export const start = (intervalMs = 3000): void => {
  const next = (): void => {
    const shift = pick(SHIFTS);
    const report = generateReport(shift);
    simulator.emit('report', report);
    setTimeout(next, intervalMs * (0.5 + Math.random()));
  };

  next();
};
