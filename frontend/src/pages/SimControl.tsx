import { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { MapPin, Heart, AlertTriangle } from 'lucide-react';
import type { ShiftInfo } from '@/types';

const API = 'http://localhost:3000';

const post = (path: string, body: object) =>
  fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(r => r.json());

type Movement = 'stationary' | 'walking' | 'running' | 'fall_detected';

const SimControl = () => {
  const [location] = useLocation();
  const [shift, setShift] = useState<ShiftInfo | null>(null);
  const [simPaused, setSimPaused] = useState(false);
  const [selectedGuardId, setSelectedGuardId] = useState<string | null>(null);

  // GPS
  const [zoneId, setZoneId] = useState('');

  // Wearable
  const [heartRate, setHeartRate] = useState(80);
  const [movement, setMovement] = useState<Movement>('walking');

  // Message
  const [msgContent, setMsgContent] = useState('');

  // Feedback
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/shift`)
      .then(r => r.json())
      .then((shifts: ShiftInfo[]) => {
        if (shifts[0]) {
          setShift(shifts[0]);
          setSelectedGuardId(shifts[0].guards[0]?.id ?? null);
          setZoneId(shifts[0].zones[0]?.id ?? '');
        }
      })
      .catch(() => {});

    fetch(`${API}/sim/status`)
      .then(r => r.json())
      .then((d: { paused: boolean }) => setSimPaused(d.paused))
      .catch(() => {});
  }, []);

  const flash = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 1800);
  };

  const toggleSim = async () => {
    await post(simPaused ? '/sim/resume' : '/sim/pause', {});
    setSimPaused(v => !v);
  };

  const sendEvent = async (body: object) => {
    if (!selectedGuardId) return;
    await post('/sim/event', { guardId: selectedGuardId, ...body });
    flash('Sent');
  };

  const venueName = shift?.venueName ?? 'Security Stream';
  const selectedGuard = shift?.guards.find(g => g.id === selectedGuardId) ?? null;

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
        <div className="w-24" />
      </header>

      {/* Sim status bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-700/50 bg-slate-800/40 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">Auto-Sim</span>
          <span className={`flex items-center gap-1.5 text-xs font-medium ${simPaused ? 'text-amber-400' : 'text-green-400'}`}>
            <span className={`h-2 w-2 rounded-full ${simPaused ? 'bg-amber-400' : 'bg-green-400 animate-pulse'}`} />
            {simPaused ? 'Paused' : 'Running'}
          </span>
        </div>
        <button
          onClick={toggleSim}
          className={`text-xs px-4 py-1.5 rounded font-medium transition-colors cursor-pointer ${
            simPaused
              ? 'bg-green-700/40 text-green-300 hover:bg-green-700/60'
              : 'bg-amber-700/40 text-amber-300 hover:bg-amber-700/60'
          }`}
        >
          {simPaused ? 'Resume' : 'Pause'}
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Guard list */}
        <div className="w-56 shrink-0 border-r border-slate-700/50 flex flex-col">
          <div className="px-4 pt-3 pb-2 border-b border-slate-700/30 shrink-0">
            <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">Guards</span>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
            {!shift && <p className="text-xs text-slate-600 pt-2">Loading…</p>}
            {shift?.guards.map(guard => {
              const selected = selectedGuardId === guard.id;
              return (
                <button
                  key={guard.id}
                  onClick={() => setSelectedGuardId(guard.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-md transition-colors cursor-pointer ${
                    selected ? 'bg-slate-700 ring-1 ring-slate-500' : 'bg-slate-800/50 hover:bg-slate-800'
                  }`}
                >
                  <p className="text-xs font-medium text-slate-200 truncate">{guard.name}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {guard.role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Event injection panel */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {!selectedGuard ? (
            <p className="text-sm text-slate-600">Select a guard to inject events.</p>
          ) : (
            <div className="max-w-lg space-y-6">

              {/* Selected guard label */}
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-200">{selectedGuard.name}</h2>
                {feedback && (
                  <span className="text-xs text-green-400 font-medium">{feedback}</span>
                )}
              </div>

              {/* GPS */}
              <section className="bg-slate-800/50 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                  <MapPin className="h-3 w-3" /> Location
                </div>
                <div className="flex gap-2">
                  <select
                    value={zoneId}
                    onChange={e => setZoneId(e.target.value)}
                    className="flex-1 bg-slate-700 border border-slate-600 text-slate-200 text-xs rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-500 cursor-pointer"
                  >
                    {shift?.zones.map(z => (
                      <option key={z.id} value={z.id}>{z.label}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => sendEvent({ type: 'gps', zoneId })}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded font-medium transition-colors cursor-pointer"
                  >
                    Move
                  </button>
                </div>
              </section>

              {/* Wearable */}
              <section className="bg-slate-800/50 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                  <Heart className="h-3 w-3" /> Wearable
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-xs text-slate-400 shrink-0">HR</label>
                  <input
                    type="range"
                    min={40}
                    max={180}
                    value={heartRate}
                    onChange={e => setHeartRate(Number(e.target.value))}
                    className="flex-1 accent-slate-400 cursor-pointer"
                  />
                  <span className="text-xs font-mono text-slate-300 w-12 text-right">{heartRate} bpm</span>
                </div>
                <div className="flex gap-2">
                  <select
                    value={movement}
                    onChange={e => setMovement(e.target.value as Movement)}
                    className="flex-1 bg-slate-700 border border-slate-600 text-slate-200 text-xs rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-500 cursor-pointer"
                  >
                    <option value="stationary">Stationary</option>
                    <option value="walking">Walking</option>
                    <option value="running">Running</option>
                    <option value="fall_detected">Fall detected</option>
                  </select>
                  <button
                    onClick={() => sendEvent({ type: 'wearable', heartRateBpm: heartRate, movement })}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded font-medium transition-colors cursor-pointer"
                  >
                    Send
                  </button>
                </div>
              </section>

              {/* Message */}
              <section className="bg-slate-800/50 rounded-lg p-4 space-y-3">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Message</div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={msgContent}
                    onChange={e => setMsgContent(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && msgContent.trim()) {
                        sendEvent({ type: 'message', content: msgContent.trim(), messageType: 'status_update' });
                        setMsgContent('');
                      }
                    }}
                    placeholder="Type a message…"
                    className="flex-1 bg-slate-700 border border-slate-600 text-slate-200 text-xs rounded px-3 py-2 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  />
                  <button
                    disabled={!msgContent.trim()}
                    onClick={() => {
                      sendEvent({ type: 'message', content: msgContent.trim(), messageType: 'status_update' });
                      setMsgContent('');
                    }}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 text-xs rounded font-medium transition-colors cursor-pointer"
                  >
                    Send
                  </button>
                </div>
              </section>

              {/* Panic */}
              <section className="bg-slate-800/50 rounded-lg p-4">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-3">
                  <AlertTriangle className="h-3 w-3" /> Panic
                </div>
                <button
                  onClick={() => sendEvent({ type: 'panic' })}
                  className="w-full py-3 bg-red-900/40 hover:bg-red-900/60 border border-red-700/40 text-red-300 text-sm font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  Trigger Panic
                </button>
              </section>

            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SimControl;
