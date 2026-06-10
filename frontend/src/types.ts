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

export interface RobotGpsEvent {
  id: string;
  type: 'robot_gps';
  timestamp: string;
  robotId: string;
  robotName: string;
  shiftId: string;
  venueName: string;
  location: { label: string; lat: number; lng: number; sensitivity: string; };
  outOfHours: boolean;
}

export interface RobotTelemetryEvent {
  id: string;
  type: 'robot_telemetry';
  timestamp: string;
  robotId: string;
  robotName: string;
  shiftId: string;
  venueName: string;
  batteryPct: number;
  status: 'patrolling' | 'charging' | 'idle' | 'fault';
}

export interface RobotAlertEvent {
  id: string;
  type: 'robot_alert';
  timestamp: string;
  robotId: string;
  robotName: string;
  shiftId: string;
  venueName: string;
  content: string;
  alertType: 'motion_detected' | 'thermal_anomaly' | 'camera_obstruction' | 'perimeter_breach' | 'system_fault' | 'status_update';
}

export type SecurityEvent = GpsEvent | WearableEvent | GuardMessage | PanicEvent | RobotGpsEvent | RobotTelemetryEvent | RobotAlertEvent;

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

export interface ShiftInfo {
  id: string;
  goal: string;
  venueName: string;
  venueAddress: string;
  venueType: string;
  venueCapacity: number;
  guardType: string;
  expectedActivity: string;
  zones: Array<{
    id: string;
    label: string;
    lat: number;
    lng: number;
    sensitivity: string;
  }>;
  guards: GuardProfile[];
  robots: RobotProfile[];
}

export interface Decision {
  id: string;
  eventId: string;
  timestamp: string;
  priority: number;
  action: string;
  reasoning: string;
  confidence: number;
  thinking?: string;
}

export interface AgentAction {
  id: string;
  decisionId: string;
  timestamp: string;
  type: string;
  guardId?: string;
  guardName?: string;
  content?: string;
}

export interface GuardMemo {
  guardId: string;
  shiftId: string;
  content: string;
  updatedAt: string;
}

export interface ShiftMemo {
  shiftId: string;
  content: string;
  updatedAt: string;
}

export interface VenueNote {
  id: string;
  locationId: string;
  content: string;
  occurredAt: string;
}

export interface Incident {
  id: string;
  agentActionId: string;
  locationId: string;
  timestamp: string;
  status: 'open' | 'resolved' | 'false_alarm' | 'escalated';
  outcomeNotes?: string;
  resolvedAt?: string;
}
