import { randomUUID } from 'crypto';
import { EventEmitter } from 'events';
import type { GpsEvent, WearableEvent, GuardMessage, PanicEvent, RobotGpsEvent, RobotTelemetryEvent, RobotAlertEvent } from './events.js';
import type { Zone, LoadedShift } from './db.js';

export type { GpsEvent, WearableEvent, GuardMessage, PanicEvent, RobotGpsEvent, RobotTelemetryEvent, RobotAlertEvent, SecurityEvent } from './events.js';

export const simulator = new EventEmitter();

let paused = true;
export const pauseSimulator = () => { paused = true; };
export const resumeSimulator = () => { paused = false; };
export const isSimulatorPaused = () => paused;

// --- helpers ---

const randInt = (min: number, max: number) =>
  Math.round(min + Math.random() * (max - min));

const jitter = (n: number, delta: number) =>
  Number((n + (Math.random() - 0.5) * delta).toFixed(6));

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const isOutOfHours = (zone: Zone): boolean => {
  const hour = new Date().getHours();
  if (zone.authorizedHoursStart <= zone.authorizedHoursEnd) {
    return hour < zone.authorizedHoursStart || hour >= zone.authorizedHoursEnd;
  }
  return hour >= zone.authorizedHoursEnd && hour < zone.authorizedHoursStart;
};

// --- message templates ---

const pickMessage = (alertness: number, location: string): Pick<GuardMessage, 'content' | 'messageType'> => {
  if (alertness > 0.65) {
    return {
      content: pick([
        `Requesting backup at ${location}`,
        `Situation escalating at ${location}`,
        `Physical altercation at ${location} — need assistance`,
        `Multiple subjects involved at ${location}`,
      ]),
      messageType: 'request_backup',
    };
  }
  if (alertness > 0.35) {
    return {
      content: pick([
        `Suspicious individual at ${location}`,
        `Crowd getting rowdy near ${location}`,
        `Minor disturbance at ${location} — monitoring`,
        `Checking incident at ${location}`,
      ]),
      messageType: 'suspicious_activity',
    };
  }
  if (Math.random() < 0.35) {
    return { content: `All clear at ${location}`, messageType: 'all_clear' };
  }
  return {
    content: pick([
      `On patrol — ${location}`,
      `Routine check complete at ${location}`,
      `Position nominal — ${location}`,
      `All clear, continuing patrol`,
    ]),
    messageType: 'status_update',
  };
};

// --- robot alert templates ---

const pickRobotAlert = (anomalyLevel: number, location: string): Pick<RobotAlertEvent, 'content' | 'alertType'> => {
  if (anomalyLevel > 0.7 && Math.random() < 0.15) {
    return {
      content: pick([
        `System fault detected — sensor array offline near ${location}`,
        `Critical error — navigation module unresponsive near ${location}`,
        `Self-diagnostic failure at ${location}`,
      ]),
      alertType: 'system_fault',
    };
  }
  if (anomalyLevel > 0.5) {
    return {
      content: pick([
        `Perimeter breach detected near ${location}`,
        `Unidentified motion detected at ${location}`,
        `Thermal anomaly flagged at ${location}`,
        `Camera feed obstructed at ${location}`,
      ]),
      alertType: pick(['perimeter_breach', 'motion_detected', 'thermal_anomaly', 'camera_obstruction']),
    };
  }
  if (anomalyLevel > 0.25) {
    return {
      content: pick([
        `Motion detected at ${location} — verifying`,
        `Minor thermal variance at ${location}`,
      ]),
      alertType: pick(['motion_detected', 'thermal_anomaly']),
    };
  }
  return {
    content: pick([
      `Patrol checkpoint reached — ${location}`,
      `Sector clear — ${location}`,
      `All sensors nominal — ${location}`,
    ]),
    alertType: 'status_update',
  };
};

// --- guard simulation state ---

interface GuardSimState {
  id: string;
  name: string;
  shiftId: string;
  venueName: string;
  zones: Zone[];
  currentZoneIndex: number;
  alertness: number;
  alertnessTicksRemaining: number;
  batteryPct: number;
}

const startGuard = (state: GuardSimState): void => {
  const zone = () => state.zones[state.currentZoneIndex];

  const emitGps = () => {
    const z = zone();
    simulator.emit('gps', {
      id: randomUUID(),
      type: 'gps',
      timestamp: new Date().toISOString(),
      guardId: state.id,
      guardName: state.name,
      shiftId: state.shiftId,
      venueName: state.venueName,
      location: {
        label: z.label,
        lat: jitter(z.lat, 0.0003),
        lng: jitter(z.lng, 0.0003),
        sensitivity: z.sensitivity,
      },
      outOfHours: isOutOfHours(z),
    } satisfies GpsEvent);
  };

  // GPS — ~5s per tick
  const gpsTick = () => {
    if (!paused) emitGps();
    setTimeout(gpsTick, 5000 * (0.7 + Math.random() * 0.6));
  };

  const emitWearable = () => {
    const a = state.alertness;
    const baseHr = 68 + Math.round(a * 72);
    const heartRateBpm = Math.min(180, Math.max(50, baseHr + randInt(-6, 6)));

    let movement: WearableEvent['movement'];
    if (a > 0.75 && Math.random() < 0.25) movement = 'fall_detected';
    else if (a > 0.45) movement = 'running';
    else if (a > 0.18) movement = 'walking';
    else movement = Math.random() < 0.35 ? 'stationary' : 'walking';

    simulator.emit('wearable', {
      id: randomUUID(),
      type: 'wearable',
      timestamp: new Date().toISOString(),
      guardId: state.id,
      guardName: state.name,
      shiftId: state.shiftId,
      venueName: state.venueName,
      heartRateBpm,
      movement,
      batteryPct: state.batteryPct,
    } satisfies WearableEvent);
  };

  // Wearable — ~3s per tick
  const wearableTick = () => {
    if (!paused) emitWearable();
    setTimeout(wearableTick, 3000 * (0.7 + Math.random() * 0.6));
  };

  // Slow tick — ~20s: alertness management + discrete events
  const slowTick = () => {
    if (Math.random() < 0.1) {
      state.currentZoneIndex = Math.floor(Math.random() * state.zones.length);
    }

    if (state.alertnessTicksRemaining > 0) {
      state.alertnessTicksRemaining--;
    } else if (state.alertness > 0.05) {
      state.alertness *= 0.55;
    } else if (Math.random() < 0.12) {
      state.alertness = 0.6 + Math.random() * 0.4;
      state.alertnessTicksRemaining = randInt(2, 6);
    }

    if (Math.random() < 0.3) state.batteryPct = Math.max(10, state.batteryPct - 1);

    const z = zone();

    if (!paused) {
      if (state.alertness > 0.78 && Math.random() < 0.08) {
        simulator.emit('panic', {
          id: randomUUID(),
          type: 'panic',
          timestamp: new Date().toISOString(),
          guardId: state.id,
          guardName: state.name,
          shiftId: state.shiftId,
          venueName: state.venueName,
          location: { label: z.label, lat: z.lat, lng: z.lng },
        } satisfies PanicEvent);
      }

      const msgChance = state.alertness > 0.5 ? 0.55 : 0.25;
      if (Math.random() < msgChance) {
        const { content, messageType } = pickMessage(state.alertness, z.label);
        simulator.emit('message', {
          id: randomUUID(),
          type: 'message',
          timestamp: new Date().toISOString(),
          guardId: state.id,
          guardName: state.name,
          shiftId: state.shiftId,
          venueName: state.venueName,
          content,
          messageType,
        } satisfies GuardMessage);
      }
    }

    setTimeout(slowTick, 20000 * (0.6 + Math.random() * 0.8));
  };

  // Seed an initial position/vitals reading so the map has data even while paused
  emitGps();
  emitWearable();

  setTimeout(gpsTick, Math.random() * 2000);
  setTimeout(wearableTick, Math.random() * 1500);
  setTimeout(slowTick, 8000 + Math.random() * 8000);
};

// --- robot simulation state ---

interface RobotSimState {
  id: string;
  name: string;
  shiftId: string;
  venueName: string;
  zones: Zone[];
  currentZoneIndex: number;
  batteryPct: number;
  status: RobotTelemetryEvent['status'];
  anomalyLevel: number;
  anomalyTicksRemaining: number;
}

const startRobot = (state: RobotSimState): void => {
  const emitRobotGps = (z: Zone) => {
    simulator.emit('robot_gps', {
      id: randomUUID(),
      type: 'robot_gps',
      timestamp: new Date().toISOString(),
      robotId: state.id,
      robotName: state.name,
      shiftId: state.shiftId,
      venueName: state.venueName,
      location: {
        label: z.label,
        lat: jitter(z.lat, 0.0003),
        lng: jitter(z.lng, 0.0003),
        sensitivity: z.sensitivity,
      },
      outOfHours: isOutOfHours(z),
    } satisfies RobotGpsEvent);
  };

  // GPS — ~6s per tick, sequential patrol loop
  const robotGpsTick = () => {
    if (!paused && state.status === 'patrolling') {
      state.currentZoneIndex = (state.currentZoneIndex + 1) % state.zones.length;
      emitRobotGps(state.zones[state.currentZoneIndex]);
    }
    setTimeout(robotGpsTick, 6000 * (0.7 + Math.random() * 0.6));
  };

  const emitRobotTelemetry = () => {
    simulator.emit('robot_telemetry', {
      id: randomUUID(),
      type: 'robot_telemetry',
      timestamp: new Date().toISOString(),
      robotId: state.id,
      robotName: state.name,
      shiftId: state.shiftId,
      venueName: state.venueName,
      batteryPct: state.batteryPct,
      status: state.status,
    } satisfies RobotTelemetryEvent);
  };

  // Telemetry — ~4s per tick: battery drain/charge + status transitions
  const robotTelemetryTick = () => {
    if (!paused) {
      if (state.status === 'patrolling') {
        state.batteryPct = Math.max(0, state.batteryPct - 1);
        if (state.batteryPct < 20) state.status = 'charging';
        else if (Math.random() < 0.005) state.status = 'fault';
      } else if (state.status === 'charging') {
        state.batteryPct = Math.min(100, state.batteryPct + 2);
        if (state.batteryPct >= 95) state.status = 'patrolling';
      } else if (state.status === 'fault') {
        if (Math.random() < 0.3) state.status = 'patrolling';
      }

      emitRobotTelemetry();
    }
    setTimeout(robotTelemetryTick, 4000 * (0.7 + Math.random() * 0.6));
  };

  // Slow tick — ~25s: anomaly management + alert events
  const robotSlowTick = () => {
    if (state.anomalyTicksRemaining > 0) {
      state.anomalyTicksRemaining--;
    } else if (state.anomalyLevel > 0.05) {
      state.anomalyLevel *= 0.5;
    } else if (Math.random() < 0.1) {
      state.anomalyLevel = 0.4 + Math.random() * 0.6;
      state.anomalyTicksRemaining = randInt(1, 3);
    }

    if (!paused) {
      const z = state.zones[state.currentZoneIndex];
      const alertChance = state.anomalyLevel > 0.5 ? 0.6 : 0.35;
      if (Math.random() < alertChance) {
        const { content, alertType } = pickRobotAlert(state.anomalyLevel, z.label);
        simulator.emit('robot_alert', {
          id: randomUUID(),
          type: 'robot_alert',
          timestamp: new Date().toISOString(),
          robotId: state.id,
          robotName: state.name,
          shiftId: state.shiftId,
          venueName: state.venueName,
          content,
          alertType,
        } satisfies RobotAlertEvent);
      }
    }

    setTimeout(robotSlowTick, 25000 * (0.6 + Math.random() * 0.8));
  };

  // Seed an initial position/telemetry reading so the map has data even while paused
  emitRobotGps(state.zones[state.currentZoneIndex]);
  emitRobotTelemetry();

  setTimeout(robotGpsTick, Math.random() * 2000);
  setTimeout(robotTelemetryTick, Math.random() * 1500);
  setTimeout(robotSlowTick, 8000 + Math.random() * 8000);
};

export const start = (shifts: LoadedShift[]): void => {
  for (const shift of shifts) {
    for (const guard of shift.guards) {
      startGuard({
        id: guard.id,
        name: guard.name,
        shiftId: shift.id,
        venueName: shift.venueName,
        zones: shift.zones,
        currentZoneIndex: Math.max(0, guard.startingZoneIndex),
        alertness: 0,
        alertnessTicksRemaining: 0,
        batteryPct: randInt(60, 100),
      });
    }

    for (const robot of shift.robots) {
      startRobot({
        id: robot.id,
        name: robot.name,
        shiftId: shift.id,
        venueName: shift.venueName,
        zones: shift.zones,
        currentZoneIndex: Math.max(0, robot.startingZoneIndex),
        batteryPct: randInt(70, 100),
        status: 'patrolling',
        anomalyLevel: 0,
        anomalyTicksRemaining: 0,
      });
    }
  }
};
