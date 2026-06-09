// Pure seed data — no DB imports. Used only by db.ts.

export interface SeedLocation {
  id: string;
  name: string;
  address: string;
  type: string;
  capacity: number;
}

export interface SeedZone {
  id: string;
  locationId: string;
  label: string;
  lat: number;
  lng: number;
  sensitivity: 'public' | 'controlled' | 'restricted';
  authorizedHoursStart: number;
  authorizedHoursEnd: number;
}

export interface SeedGuard {
  id: string;
  name: string;
  gender: 'male' | 'female' | 'non_binary';
  experienceYears: number;
  armed: boolean;
  role: string;
}

export interface SeedShift {
  id: string;
  locationId: string;
  goal: string;
  guardType: 'bouncer' | 'patrol' | 'event' | 'private';
  expectedActivity: 'none' | 'low' | 'normal' | 'high' | 'peak';
  active: boolean;
}

export interface SeedShiftGuard {
  shiftId: string;
  guardId: string;
  startingZoneId: string;
}

// --- Berghain Saturday Night ---

export const SEED_LOCATIONS: SeedLocation[] = [
  {
    id: 'loc-berghain',
    name: 'Berghain',
    address: 'Am Wriezener Bahnhof, 10243 Berlin, Germany',
    type: 'nightclub',
    capacity: 1500,
  },
];

// Zones mapped to the real building footprint (former power plant, ~100m × 60m)
export const SEED_ZONES: SeedZone[] = [
  { id: 'zone-b-entrance',  locationId: 'loc-berghain', label: 'Main Entrance',  lat: 52.51082, lng: 13.44278, sensitivity: 'public',     authorizedHoursStart: 22, authorizedHoursEnd: 12 },
  { id: 'zone-b-berghain',  locationId: 'loc-berghain', label: 'Berghain Floor', lat: 52.51118, lng: 13.44298, sensitivity: 'public',     authorizedHoursStart: 22, authorizedHoursEnd: 12 },
  { id: 'zone-b-panorama',  locationId: 'loc-berghain', label: 'Panorama Bar',   lat: 52.51152, lng: 13.44287, sensitivity: 'public',     authorizedHoursStart: 22, authorizedHoursEnd: 12 },
  { id: 'zone-b-bar',       locationId: 'loc-berghain', label: 'Bar Area',       lat: 52.51100, lng: 13.44330, sensitivity: 'controlled', authorizedHoursStart: 22, authorizedHoursEnd: 12 },
  { id: 'zone-b-garten',    locationId: 'loc-berghain', label: 'Garten',         lat: 52.51055, lng: 13.44315, sensitivity: 'controlled', authorizedHoursStart: 22, authorizedHoursEnd: 12 },
  { id: 'zone-b-staff',     locationId: 'loc-berghain', label: 'Staff Area',     lat: 52.51138, lng: 13.44252, sensitivity: 'restricted', authorizedHoursStart: 0,  authorizedHoursEnd: 24 },
];

export const SEED_GUARDS: SeedGuard[] = [
  { id: 'guard-001', name: 'Sven Richter',  gender: 'male',        experienceYears: 11, armed: false, role: 'door_supervisor'  },
  { id: 'guard-002', name: 'Lena Fischer',  gender: 'female',      experienceYears: 6,  armed: false, role: 'floor_patrol'     },
  { id: 'guard-003', name: 'Tobias Klein',  gender: 'male',        experienceYears: 4,  armed: false, role: 'bar_security'     },
  { id: 'guard-004', name: 'Mia Hoffmann',  gender: 'female',      experienceYears: 9,  armed: false, role: 'shift_supervisor' },
];

export const SEED_SHIFTS: SeedShift[] = [
  {
    id: 'shift-berghain-saturday',
    locationId: 'loc-berghain',
    goal: 'Maintain safe and respectful environment across all floors during Saturday peak session. Enforce door policy and capacity limits, prevent unauthorized access to Panorama Bar and staff areas, monitor crowd density on Berghain floor, respond swiftly to medical incidents or altercations, and coordinate safe egress at close.',
    guardType: 'bouncer',
    expectedActivity: 'peak',
    active: true,
  },
];

export const SEED_SHIFT_GUARDS: SeedShiftGuard[] = [
  { shiftId: 'shift-berghain-saturday', guardId: 'guard-001', startingZoneId: 'zone-b-entrance' },
  { shiftId: 'shift-berghain-saturday', guardId: 'guard-002', startingZoneId: 'zone-b-berghain' },
  { shiftId: 'shift-berghain-saturday', guardId: 'guard-003', startingZoneId: 'zone-b-bar'      },
  { shiftId: 'shift-berghain-saturday', guardId: 'guard-004', startingZoneId: 'zone-b-entrance' },
];
