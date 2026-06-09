// SecurityEvent type definitions — imported by both simulator.ts and db.ts
// Kept separate to avoid circular dependency between those two modules.

export interface GpsEvent {
  id: string;
  type: 'gps';
  timestamp: string;
  guardId: string;
  guardName: string;
  shiftId: string;
  venueName: string;
  location: { label: string; lat: number; lng: number; sensitivity: string; };
  outOfHours: boolean;
}

export interface WearableEvent {
  id: string;
  type: 'wearable';
  timestamp: string;
  guardId: string;
  guardName: string;
  shiftId: string;
  venueName: string;
  heartRateBpm: number;
  movement: 'stationary' | 'walking' | 'running' | 'fall_detected';
  batteryPct: number;
}

export interface GuardMessage {
  id: string;
  type: 'message';
  timestamp: string;
  guardId: string;
  guardName: string;
  shiftId: string;
  venueName: string;
  content: string;
  messageType: 'status_update' | 'request_backup' | 'suspicious_activity' | 'all_clear';
}

export interface PanicEvent {
  id: string;
  type: 'panic';
  timestamp: string;
  guardId: string;
  guardName: string;
  shiftId: string;
  venueName: string;
  location: { label: string; lat: number; lng: number; };
}

export type SecurityEvent = GpsEvent | WearableEvent | GuardMessage | PanicEvent;
