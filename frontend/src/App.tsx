import { useEffect, useRef, useState } from 'react';
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels';
import { Link, useLocation } from 'wouter';
import type { SecurityEvent, Decision, ShiftInfo, GuardMemo, ShiftMemo, VenueNote, AgentAction, Incident, GpsEvent, WearableEvent, GuardMessage, PanicEvent, RobotGpsEvent, RobotTelemetryEvent, RobotAlertEvent } from './types';
import LiveFeed from './components/LiveFeed';
import ShiftPanel from './components/ShiftPanel';
import MapView from './components/MapView';

const App = () => {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [decisions, setDecisions] = useState<Map<string, Decision>>(new Map());
  const [shift, setShift] = useState<ShiftInfo | null>(null);
  const [memos, setMemos] = useState<Map<string, GuardMemo>>(new Map());
  const [shiftMemo, setShiftMemo] = useState<ShiftMemo | null>(null);
  const [venueNotes, setVenueNotes] = useState<VenueNote[]>([]);
  const [agentActions, setAgentActions] = useState<AgentAction[]>([]);
  const [incidents, setIncidents] = useState<Map<string, Incident>>(new Map());
  const [connected, setConnected] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    fetch('http://localhost:3000/history')
      .then(r => r.json())
      .then((history: { event: SecurityEvent; decision: Decision | null }[]) => {
        setEvents(history.map(h => h.event));
        const dec = new Map<string, Decision>();
        history.forEach(h => { if (h.decision) dec.set(h.event.id, h.decision); });
        setDecisions(dec);
      })
      .catch(() => {});

    fetch('http://localhost:3000/shift')
      .then(r => r.json())
      .then((shifts: ShiftInfo[]) => { if (shifts[0]) setShift(shifts[0]); })
      .catch(() => {});

    fetch('http://localhost:3000/memos')
      .then(r => r.json())
      .then((data: Record<string, { content: string; updatedAt: string }>) => {
        const map = new Map<string, GuardMemo>();
        for (const [guardId, memo] of Object.entries(data)) {
          map.set(guardId, { guardId, shiftId: '', content: memo.content, updatedAt: memo.updatedAt });
        }
        setMemos(map);
      })
      .catch(() => {});

    fetch('http://localhost:3000/shift-memo')
      .then(r => r.json())
      .then((data: Record<string, { content: string; updatedAt: string }>) => {
        const entries = Object.entries(data);
        if (entries[0]) {
          const [shiftId, memo] = entries[0];
          setShiftMemo({ shiftId, content: memo.content, updatedAt: memo.updatedAt });
        }
      })
      .catch(() => {});

    fetch('http://localhost:3000/venue-notes')
      .then(r => r.json())
      .then((notes: VenueNote[]) => setVenueNotes(notes))
      .catch(() => {});

    fetch('http://localhost:3000/agent-actions')
      .then(r => r.json())
      .then((actions: AgentAction[]) => setAgentActions(actions))
      .catch(() => {});

    fetch('http://localhost:3000/incidents')
      .then(r => r.json())
      .then((list: Incident[]) => {
        const map = new Map<string, Incident>();
        list.forEach(i => map.set(i.agentActionId, i));
        setIncidents(map);
      })
      .catch(() => {});

    const es = new EventSource('http://localhost:3000/events');
    esRef.current = es;

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    const addEvent = (event: SecurityEvent) => {
      setEvents(prev => {
        if (prev.some(e => e.id === event.id)) return prev;
        return [event, ...prev].slice(0, 200);
      });
    };

    es.addEventListener('gps',             (e) => addEvent(JSON.parse((e as MessageEvent).data) as GpsEvent));
    es.addEventListener('wearable',        (e) => addEvent(JSON.parse((e as MessageEvent).data) as WearableEvent));
    es.addEventListener('message',         (e) => addEvent(JSON.parse((e as MessageEvent).data) as GuardMessage));
    es.addEventListener('panic',           (e) => addEvent(JSON.parse((e as MessageEvent).data) as PanicEvent));
    es.addEventListener('robot_gps',       (e) => addEvent(JSON.parse((e as MessageEvent).data) as RobotGpsEvent));
    es.addEventListener('robot_telemetry', (e) => addEvent(JSON.parse((e as MessageEvent).data) as RobotTelemetryEvent));
    es.addEventListener('robot_alert',     (e) => addEvent(JSON.parse((e as MessageEvent).data) as RobotAlertEvent));

    es.addEventListener('decision', (e) => {
      const decision = JSON.parse((e as MessageEvent).data) as Decision;
      setDecisions(prev => new Map(prev).set(decision.eventId, decision));
    });

    es.addEventListener('memo', (e) => {
      const memo = JSON.parse((e as MessageEvent).data) as GuardMemo;
      setMemos(prev => new Map(prev).set(memo.guardId, memo));
    });

    es.addEventListener('shift_memo', (e) => {
      const sm = JSON.parse((e as MessageEvent).data) as ShiftMemo;
      setShiftMemo(sm);
    });

    es.addEventListener('venue_note', (e) => {
      const note = JSON.parse((e as MessageEvent).data) as VenueNote;
      setVenueNotes(prev => [note, ...prev].slice(0, 20));
    });

    es.addEventListener('agent_action', (e) => {
      const action = JSON.parse((e as MessageEvent).data) as AgentAction;
      setAgentActions(prev => [action, ...prev].slice(0, 100));
    });

    es.addEventListener('incident_created', (e) => {
      const incident = JSON.parse((e as MessageEvent).data) as Incident;
      setIncidents(prev => new Map(prev).set(incident.agentActionId, incident));
    });

    es.addEventListener('incident_update', (e) => {
      const update = JSON.parse((e as MessageEvent).data) as { id: string; agentActionId: string; status: Incident['status']; resolvedAt: string };
      setIncidents(prev => {
        const next = new Map(prev);
        const existing = next.get(update.agentActionId);
        if (existing) next.set(update.agentActionId, { ...existing, status: update.status, resolvedAt: update.resolvedAt });
        return next;
      });
    });

    return () => es.close();
  }, []);

  const [location] = useLocation();
  const venueName = shift?.venueName ?? events.find(e => e.venueName)?.venueName ?? 'Security Stream';

  // Only meaningful events in the log: messages, panics, robot alerts, and wearables/telemetry that triggered a decision
  const logEvents = events.filter(e =>
    e.type === 'message' ||
    e.type === 'panic' ||
    e.type === 'robot_alert' ||
    (e.type === 'wearable' && decisions.has(e.id)) ||
    (e.type === 'robot_telemetry' && decisions.has(e.id))
  );

  return (
    <div className="flex flex-col h-dvh bg-slate-900 text-slate-100">
      <header className="flex items-center justify-between px-5 py-3 border-b border-slate-700/50 shrink-0">
        <span className="text-sm font-semibold text-slate-100 tracking-wide">{venueName}</span>
        <nav className="flex gap-1">
          <Link href="/" className={`text-xs px-3 py-1.5 rounded transition-colors cursor-pointer ${location === '/' ? 'bg-slate-700 text-slate-200' : 'text-slate-500 hover:text-slate-300'}`}>
            Dashboard
          </Link>
          <Link href="/sim" className={`text-xs px-3 py-1.5 rounded transition-colors cursor-pointer ${location === '/sim' ? 'bg-slate-700 text-slate-200' : 'text-slate-500 hover:text-slate-300'}`}>
            Simulator
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${connected ? 'bg-green-400' : 'bg-slate-600'}`} />
          <span className="text-xs text-slate-400">{connected ? 'Live' : 'Connecting…'}</span>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Left: map + compact log (vertically resizable) */}
        <PanelGroup orientation="vertical" className="flex-1 min-w-0 min-h-0">
          <Panel defaultSize={65} minSize={25}>
            <div className="h-full overflow-hidden">
              <MapView
                events={events}
                shift={shift}
                selectedUnitId={selectedUnitId}
                onSelectUnit={setSelectedUnitId}
              />
            </div>
          </Panel>
          <PanelResizeHandle className="resize-handle-v" />
          <Panel defaultSize={35} minSize={10}>
            <LiveFeed events={logEvents} decisions={decisions} agentActions={agentActions} />
          </Panel>
        </PanelGroup>

        {/* Right: shift panel */}
        <div className="w-[380px] shrink-0 min-h-0 bg-slate-900">
          <ShiftPanel
            shift={shift}
            events={events}
            memos={memos}
            shiftMemo={shiftMemo}
            venueNotes={venueNotes}
            agentActions={agentActions}
            incidents={incidents}
            selectedUnitId={selectedUnitId}
            onSelectUnit={setSelectedUnitId}
          />
        </div>
      </div>
    </div>
  );
};

export default App;
