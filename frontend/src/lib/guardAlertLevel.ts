import type { SecurityEvent, WearableEvent } from '@/types';

export interface GuardStatus {
  lastZone: string | null;
  lastHr: number | null;
  lastMovement: WearableEvent['movement'] | null;
  batteryPct: number | null;
  lastLat: number | null;
  lastLng: number | null;
}

export type AlertLevel = 'normal' | 'elevated' | 'critical';

export const getAlertLevel = (s: GuardStatus): AlertLevel => {
  if (s.lastMovement === 'fall_detected' || (s.lastHr ?? 0) > 130) return 'critical';
  if (s.lastMovement === 'running' || (s.lastHr ?? 0) > 90) return 'elevated';
  return 'normal';
};

export const ALERT_DOT: Record<AlertLevel, string> = {
  normal:   'bg-green-500',
  elevated: 'bg-amber-400',
  critical: 'bg-red-500 animate-pulse',
};

export const ALERT_HR_COLOR: Record<AlertLevel, string> = {
  normal:   'text-slate-500',
  elevated: 'text-amber-400',
  critical: 'text-red-400',
};

export const ALERT_HEX: Record<AlertLevel, string> = {
  normal:   '#22c55e',
  elevated: '#fbbf24',
  critical: '#ef4444',
};

export const buildGuardStatusMap = (
  guardIds: string[],
  events: SecurityEvent[],
): Map<string, GuardStatus> => {
  const map = new Map<string, GuardStatus>();
  for (const id of guardIds) {
    map.set(id, { lastZone: null, lastHr: null, lastMovement: null, batteryPct: null, lastLat: null, lastLng: null });
  }
  for (const e of events) {
    if (e.type === 'gps') {
      const s = map.get(e.guardId);
      if (s && s.lastZone === null) {
        s.lastZone = e.location.label;
        s.lastLat  = e.location.lat;
        s.lastLng  = e.location.lng;
      }
    }
    if (e.type === 'wearable') {
      const s = map.get(e.guardId);
      if (s && s.lastHr === null) {
        s.lastHr       = e.heartRateBpm;
        s.lastMovement = e.movement;
        s.batteryPct   = e.batteryPct;
      }
    }
  }
  return map;
};
