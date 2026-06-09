import { useEffect, useRef, useState } from 'react';
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels';
import type { SecurityEvent, Decision, ShiftInfo, GuardMemo, ShiftMemo, VenueNote, GpsEvent, WearableEvent, GuardMessage, PanicEvent } from './types';
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
  const [connected, setConnected] = useState(false);
  const [selectedGuardId, setSelectedGuardId] = useState<string | null>(null);
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

    es.addEventListener('gps',      (e) => addEvent(JSON.parse((e as MessageEvent).data) as GpsEvent));
    es.addEventListener('wearable', (e) => addEvent(JSON.parse((e as MessageEvent).data) as WearableEvent));
    es.addEventListener('message',  (e) => addEvent(JSON.parse((e as MessageEvent).data) as GuardMessage));
    es.addEventListener('panic',    (e) => addEvent(JSON.parse((e as MessageEvent).data) as PanicEvent));

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

    return () => es.close();
  }, []);

  const venueName = shift?.venueName ?? events.find(e => e.venueName)?.venueName ?? 'Security Stream';

  // Only meaningful events in the log: messages, panics, and wearables that triggered a decision
  const logEvents = events.filter(e =>
    e.type === 'message' ||
    e.type === 'panic' ||
    (e.type === 'wearable' && decisions.has(e.id))
  );

  return (
    <div className="flex flex-col h-dvh bg-slate-900 text-slate-100">
      <header className="flex items-center justify-between px-5 py-3 border-b border-slate-700/50 shrink-0">
        <span className="text-sm font-semibold text-slate-100 tracking-wide">{venueName}</span>
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
                selectedGuardId={selectedGuardId}
                onSelectGuard={setSelectedGuardId}
              />
            </div>
          </Panel>
          <PanelResizeHandle className="resize-handle-v" />
          <Panel defaultSize={35} minSize={10}>
            <LiveFeed events={logEvents} decisions={decisions} />
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
            selectedGuardId={selectedGuardId}
            onSelectGuard={setSelectedGuardId}
          />
        </div>
      </div>
    </div>
  );
};

export default App;
