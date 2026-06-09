import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Tooltip, ZoomControl, useMap } from 'react-leaflet';
import type { ShiftInfo, SecurityEvent } from '@/types';
import { buildGuardStatusMap, getAlertLevel, ALERT_HEX } from '@/lib/guardAlertLevel';

interface Props {
  events: SecurityEvent[];
  shift: ShiftInfo | null;
  selectedGuardId: string | null;
  onSelectGuard: (id: string | null) => void;
}

interface GuardPosition {
  guardId: string;
  guardName: string;
  role: string;
  lat: number;
  lng: number;
  level: 'normal' | 'elevated' | 'critical';
  lastZone: string | null;
  lastHr: number | null;
}

const makeGuardIcon = (
  level: GuardPosition['level'],
  guardName: string,
  selected: boolean,
): L.DivIcon => {
  const color = ALERT_HEX[level];
  const ring = selected
    ? `outline: 2.5px solid #f1f5f9; outline-offset: 2px;`
    : '';
  const pulse = level === 'critical'
    ? `animation: guard-pulse 1s ease-in-out infinite alternate;`
    : '';
  const firstName = guardName.split(' ')[0];
  return L.divIcon({
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    tooltipAnchor: [0, -16],
    html: `
      <div style="
        width:28px;height:28px;border-radius:50%;
        background:${color};border:2px solid rgba(255,255,255,0.25);
        display:flex;align-items:center;justify-content:center;
        cursor:pointer;position:relative;${ring}${pulse}
      ">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
          fill="none" stroke="white" stroke-width="2.5"
          stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
      </div>
      <div style="
        position:absolute;top:31px;left:50%;transform:translateX(-50%);
        white-space:nowrap;font-size:10px;font-weight:700;
        color:#1e293b;text-shadow:0 0 4px rgba(255,255,255,0.9),0 0 4px rgba(255,255,255,0.9);
        pointer-events:none;letter-spacing:0.01em;
      ">${firstName}</div>
    `,
  });
};

const makeZoneIcon = (): L.DivIcon =>
  L.divIcon({
    className: '',
    iconSize: [10, 10],
    iconAnchor: [5, 5],
    tooltipAnchor: [0, -7],
    html: `<div style="
      width:10px;height:10px;border-radius:50%;
      background:rgba(100,116,139,0.2);
      border:1px solid rgba(100,116,139,0.4);
    "></div>`,
  });

const ZONE_ICON = makeZoneIcon();

// Calls invalidateSize whenever the map container is resized (e.g. panel drag).
const MapResizer = () => {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el);
    return () => ro.disconnect();
  }, [map]);
  return null;
};

// Fits bounds once when guard positions are first available, then leaves the map alone.
const BoundsController = ({ positions }: { positions: Array<{ lat: number; lng: number }> }) => {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current || positions.length === 0) return;
    const bounds = L.latLngBounds(positions.map(p => [p.lat, p.lng] as L.LatLngTuple));
    map.fitBounds(bounds, { padding: [70, 70], maxZoom: 19, animate: true });
    fitted.current = true;
  }, [map, positions]);
  return null;
};

const FALLBACK_CENTER: L.LatLngTuple = [52.5110, 13.4428];

const MapView = ({ events, shift, selectedGuardId, onSelectGuard }: Props) => {
  const guardPositions = useMemo((): GuardPosition[] => {
    if (!shift) return [];
    const statusMap = buildGuardStatusMap(shift.guards.map(g => g.id), events);
    return shift.guards.flatMap(g => {
      const s = statusMap.get(g.id)!;
      if (s.lastLat === null || s.lastLng === null) return [];
      return [{
        guardId: g.id,
        guardName: g.name,
        role: g.role,
        lat: s.lastLat,
        lng: s.lastLng,
        level: getAlertLevel(s),
        lastZone: s.lastZone,
        lastHr: s.lastHr,
      }];
    });
  }, [shift, events]);

  const guardIcons = useMemo(
    () => new Map(
      guardPositions.map(p => [
        p.guardId,
        makeGuardIcon(p.level, p.guardName, selectedGuardId === p.guardId),
      ]),
    ),
    [guardPositions, selectedGuardId],
  );

  const hasPositions = guardPositions.length > 0;

  return (
    <div className="relative h-full w-full dark-map overflow-hidden">
      {!hasPositions && (
        <div className="absolute inset-0 flex items-center justify-center z-[500] bg-slate-900/70 pointer-events-none">
          <p className="text-xs text-slate-500">Waiting for GPS data…</p>
        </div>
      )}

      <MapContainer
        center={FALLBACK_CENTER}
        zoom={18}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={20}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />

        <ZoomControl position="bottomright" />

        <MapResizer />
        <BoundsController positions={guardPositions} />

        {/* Zone reference markers */}
        {shift?.zones.map(zone => (
          <Marker
            key={zone.id}
            position={[zone.lat, zone.lng]}
            icon={ZONE_ICON}
            interactive={false}
          >
            <Tooltip
              permanent
              direction="top"
              className="zone-label"
              offset={[0, -5]}
            >
              {zone.label}
            </Tooltip>
          </Marker>
        ))}

        {/* Guard markers */}
        {guardPositions.map(p => (
          <Marker
            key={p.guardId}
            position={[p.lat, p.lng]}
            icon={guardIcons.get(p.guardId)!}
            eventHandlers={{
              click: () => onSelectGuard(selectedGuardId === p.guardId ? null : p.guardId),
            }}
          >
            <Tooltip direction="top" offset={[0, -16]}>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>{p.guardName}</div>
                {p.lastZone && <div>{p.lastZone}</div>}
                {p.lastHr   && <div>HR {p.lastHr} bpm · {p.level}</div>}
              </div>
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default MapView;
