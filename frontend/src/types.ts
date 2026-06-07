export interface ReportLocation {
  label: string;
  lat: number;
  lng: number;
  sensitivity: 'public' | 'controlled' | 'restricted';
}

export interface ShiftContext {
  shiftId: string;
  guardType: 'bouncer' | 'patrol' | 'event' | 'private';
  venueType: string;
  venueName: string;
  expectedActivity: 'none' | 'low' | 'normal' | 'high' | 'peak';
}

export interface GuardSensors {
  movement: 'stationary' | 'walking' | 'running' | 'fall_detected';
  audioAlert: 'none' | 'raised_voices' | 'glass_break' | 'alarm' | 'gunshot';
  heartRateBpm: number;
  batteryPct: number;
}

export interface RobotSensors {
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
  location: ReportLocation;
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
  location: ReportLocation;
  outOfHours: boolean;
  sensors: RobotSensors;
  patrolStatus: 'patrolling' | 'investigating' | 'docked' | 'error';
  shiftContext: ShiftContext;
}

export type AgentReport = GuardReport | RobotReport;

export interface Decision {
  id: string;
  reportId: string;
  timestamp: string;
  priority: number;
  action: 'dispatch_guard' | 'dispatch_robot' | 'escalate' | 'monitor' | 'dismiss';
  reasoning: string;
  confidence: number;
  thinking?: string;
}

export interface ReportWithDecision {
  report: AgentReport;
  decision: Decision | null;
}
