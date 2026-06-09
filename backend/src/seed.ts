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

export interface ScenarioData {
  locations: SeedLocation[];
  zones: SeedZone[];
  guards: SeedGuard[];
  shifts: SeedShift[];
  shiftGuards: SeedShiftGuard[];
}

// ─── Berghain Saturday Night ─────────────────────────────────────────────────

const berghain: ScenarioData = {
  locations: [
    {
      id: 'loc-berghain',
      name: 'Berghain',
      address: 'Am Wriezener Bahnhof, 10243 Berlin, Germany',
      type: 'nightclub',
      capacity: 1500,
    },
  ],
  zones: [
    { id: 'zone-b-entrance', locationId: 'loc-berghain', label: 'Main Entrance',  lat: 52.51082, lng: 13.44278, sensitivity: 'public',     authorizedHoursStart: 22, authorizedHoursEnd: 12 },
    { id: 'zone-b-berghain', locationId: 'loc-berghain', label: 'Berghain Floor', lat: 52.51118, lng: 13.44298, sensitivity: 'public',     authorizedHoursStart: 22, authorizedHoursEnd: 12 },
    { id: 'zone-b-panorama', locationId: 'loc-berghain', label: 'Panorama Bar',   lat: 52.51152, lng: 13.44287, sensitivity: 'public',     authorizedHoursStart: 22, authorizedHoursEnd: 12 },
    { id: 'zone-b-bar',      locationId: 'loc-berghain', label: 'Bar Area',       lat: 52.51100, lng: 13.44330, sensitivity: 'controlled', authorizedHoursStart: 22, authorizedHoursEnd: 12 },
    { id: 'zone-b-garten',   locationId: 'loc-berghain', label: 'Garten',         lat: 52.51055, lng: 13.44315, sensitivity: 'controlled', authorizedHoursStart: 22, authorizedHoursEnd: 12 },
    { id: 'zone-b-staff',    locationId: 'loc-berghain', label: 'Staff Area',     lat: 52.51138, lng: 13.44252, sensitivity: 'restricted', authorizedHoursStart: 0,  authorizedHoursEnd: 24 },
  ],
  guards: [
    { id: 'guard-001', name: 'Sven Richter', gender: 'male',   experienceYears: 11, armed: false, role: 'door_supervisor'  },
    { id: 'guard-002', name: 'Lena Fischer', gender: 'female', experienceYears: 6,  armed: false, role: 'floor_patrol'     },
    { id: 'guard-003', name: 'Tobias Klein', gender: 'male',   experienceYears: 4,  armed: false, role: 'bar_security'     },
    { id: 'guard-004', name: 'Mia Hoffmann', gender: 'female', experienceYears: 9,  armed: false, role: 'shift_supervisor' },
  ],
  shifts: [
    {
      id: 'shift-berghain-saturday',
      locationId: 'loc-berghain',
      goal: 'Maintain safe and respectful environment across all floors during Saturday peak session. Enforce door policy and capacity limits, prevent unauthorized access to Panorama Bar and staff areas, monitor crowd density on Berghain floor, respond swiftly to medical incidents or altercations, and coordinate safe egress at close.',
      guardType: 'bouncer',
      expectedActivity: 'peak',
      active: true,
    },
  ],
  shiftGuards: [
    { shiftId: 'shift-berghain-saturday', guardId: 'guard-001', startingZoneId: 'zone-b-entrance' },
    { shiftId: 'shift-berghain-saturday', guardId: 'guard-002', startingZoneId: 'zone-b-berghain' },
    { shiftId: 'shift-berghain-saturday', guardId: 'guard-003', startingZoneId: 'zone-b-bar'      },
    { shiftId: 'shift-berghain-saturday', guardId: 'guard-004', startingZoneId: 'zone-b-entrance' },
  ],
};

// ─── Summer Open Air Festival (Tempelhof Grounds, Berlin) ─────────────────────

const festival: ScenarioData = {
  locations: [
    {
      id: 'loc-tempelhof',
      name: 'Tempelhof Open Air',
      address: 'Tempelhofer Damm, 12101 Berlin, Germany',
      type: 'festival',
      capacity: 8000,
    },
  ],
  zones: [
    { id: 'zone-f-gates',    locationId: 'loc-tempelhof', label: 'Entry Gates',      lat: 52.47250, lng: 13.40050, sensitivity: 'public',     authorizedHoursStart: 12, authorizedHoursEnd: 2  },
    { id: 'zone-f-main',     locationId: 'loc-tempelhof', label: 'Main Stage',       lat: 52.47380, lng: 13.40140, sensitivity: 'public',     authorizedHoursStart: 12, authorizedHoursEnd: 2  },
    { id: 'zone-f-second',   locationId: 'loc-tempelhof', label: 'Second Stage',     lat: 52.47280, lng: 13.40300, sensitivity: 'public',     authorizedHoursStart: 12, authorizedHoursEnd: 2  },
    { id: 'zone-f-vip',      locationId: 'loc-tempelhof', label: 'VIP Area',         lat: 52.47450, lng: 13.40200, sensitivity: 'controlled', authorizedHoursStart: 12, authorizedHoursEnd: 2  },
    { id: 'zone-f-medical',  locationId: 'loc-tempelhof', label: 'Medical Station',  lat: 52.47350, lng: 13.40080, sensitivity: 'controlled', authorizedHoursStart: 10, authorizedHoursEnd: 3  },
    { id: 'zone-f-backstage',locationId: 'loc-tempelhof', label: 'Backstage',        lat: 52.47480, lng: 13.40150, sensitivity: 'restricted', authorizedHoursStart: 0,  authorizedHoursEnd: 24 },
  ],
  guards: [
    { id: 'guard-f-01', name: 'Klaus Bauer',    gender: 'male',   experienceYears: 14, armed: false, role: 'event_supervisor'  },
    { id: 'guard-f-02', name: 'Sofia Andreou',  gender: 'female', experienceYears: 7,  armed: false, role: 'crowd_management'  },
    { id: 'guard-f-03', name: 'Dante Ferraro',  gender: 'male',   experienceYears: 5,  armed: false, role: 'vip_security'      },
    { id: 'guard-f-04', name: 'Yara Osei',      gender: 'female', experienceYears: 3,  armed: false, role: 'floor_patrol'      },
  ],
  shifts: [
    {
      id: 'shift-festival-saturday',
      locationId: 'loc-tempelhof',
      goal: 'Secure an 8000-capacity outdoor festival across two stages and VIP area. Manage crowd flow and prevent dangerous density near the main stage, protect backstage and VIP access from unauthorised entry, respond rapidly to medical incidents and crowd disturbances, and maintain clear emergency egress routes.',
      guardType: 'event',
      expectedActivity: 'peak',
      active: true,
    },
  ],
  shiftGuards: [
    { shiftId: 'shift-festival-saturday', guardId: 'guard-f-01', startingZoneId: 'zone-f-gates'    },
    { shiftId: 'shift-festival-saturday', guardId: 'guard-f-02', startingZoneId: 'zone-f-main'     },
    { shiftId: 'shift-festival-saturday', guardId: 'guard-f-03', startingZoneId: 'zone-f-vip'      },
    { shiftId: 'shift-festival-saturday', guardId: 'guard-f-04', startingZoneId: 'zone-f-second'   },
  ],
};

// ─── Neue Mitte Office Complex — Overnight Construction Patrol ────────────────

const construction: ScenarioData = {
  locations: [
    {
      id: 'loc-construction',
      name: 'Neue Mitte Office Complex',
      address: 'Potsdamer Platz, 10785 Berlin, Germany',
      type: 'construction_site',
      capacity: 50,
    },
  ],
  zones: [
    { id: 'zone-c-entrance', locationId: 'loc-construction', label: 'Site Entrance',       lat: 52.50960, lng: 13.37590, sensitivity: 'public',     authorizedHoursStart: 0,  authorizedHoursEnd: 24 },
    { id: 'zone-c-build',    locationId: 'loc-construction', label: 'Main Build Zone',     lat: 52.51000, lng: 13.37650, sensitivity: 'restricted', authorizedHoursStart: 6,  authorizedHoursEnd: 18 },
    { id: 'zone-c-storage',  locationId: 'loc-construction', label: 'Materials Storage',   lat: 52.50980, lng: 13.37700, sensitivity: 'restricted', authorizedHoursStart: 6,  authorizedHoursEnd: 18 },
    { id: 'zone-c-office',   locationId: 'loc-construction', label: 'Site Office',         lat: 52.50940, lng: 13.37620, sensitivity: 'controlled', authorizedHoursStart: 6,  authorizedHoursEnd: 18 },
    { id: 'zone-c-crane',    locationId: 'loc-construction', label: 'Crane Area',          lat: 52.51020, lng: 13.37680, sensitivity: 'restricted', authorizedHoursStart: 0,  authorizedHoursEnd: 24 },
  ],
  guards: [
    { id: 'guard-c-01', name: 'Marco Bianchi', gender: 'male',   experienceYears: 9, armed: false, role: 'patrol_supervisor' },
    { id: 'guard-c-02', name: 'Hana Kovář',    gender: 'female', experienceYears: 2, armed: false, role: 'patrol_guard'      },
  ],
  shifts: [
    {
      id: 'shift-construction-night',
      locationId: 'loc-construction',
      goal: 'Overnight patrol of active construction site closed to workers 18:00–06:00. Prevent trespassing, copper wire theft, and equipment vandalism. Enforce restricted zone access, document any incidents with photographic evidence, and ensure crane and heavy machinery areas remain undisturbed.',
      guardType: 'patrol',
      expectedActivity: 'low',
      active: true,
    },
  ],
  shiftGuards: [
    { shiftId: 'shift-construction-night', guardId: 'guard-c-01', startingZoneId: 'zone-c-entrance' },
    { shiftId: 'shift-construction-night', guardId: 'guard-c-02', startingZoneId: 'zone-c-build'    },
  ],
};

// ─── Scenario registry ────────────────────────────────────────────────────────

export const scenarios: Record<string, ScenarioData> = {
  berghain,
  festival,
  construction,
};

// Legacy named exports kept for any existing direct imports
export const SEED_LOCATIONS  = berghain.locations;
export const SEED_ZONES      = berghain.zones;
export const SEED_GUARDS     = berghain.guards;
export const SEED_SHIFTS     = berghain.shifts;
export const SEED_SHIFT_GUARDS = berghain.shiftGuards;
