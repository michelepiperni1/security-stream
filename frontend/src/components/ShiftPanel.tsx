import { useMemo, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronDown, ChevronUp, MapPin, Heart, Battery, BrainCircuit, History, Send, Radio, PhoneCall, Bot, Zap } from 'lucide-react';
import type { ShiftInfo, SecurityEvent, GuardMessage, GuardMemo, ShiftMemo, VenueNote, AgentAction, Incident } from '@/types';
import { buildGuardStatusMap, getAlertLevel, ALERT_DOT, ALERT_HR_COLOR, buildRobotStatusMap, getRobotAlertLevel } from '@/lib/guardAlertLevel';

interface Props {
  shift: ShiftInfo | null;
  events: SecurityEvent[];
  memos: Map<string, GuardMemo>;
  shiftMemo: ShiftMemo | null;
  venueNotes: VenueNote[];
  agentActions: AgentAction[];
  incidents: Map<string, Incident>;
  selectedUnitId: string | null;
  onSelectUnit: (id: string | null) => void;
}

const ACTION_ICON: Record<string, React.ReactNode> = {
  message_guard:   <Send      className="h-3 w-3 shrink-0 text-teal-400" />,
  broadcast_alert: <Radio     className="h-3 w-3 shrink-0 text-amber-400" />,
  call_police:     <PhoneCall className="h-3 w-3 shrink-0 text-red-400" />,
  dispatch_robot:  <Bot       className="h-3 w-3 shrink-0 text-slate-400" />,
  investigate:     <Zap       className="h-3 w-3 shrink-0 text-blue-400" />,
};

const ACTION_LABEL: Record<string, string> = {
  message_guard:   'text-teal-300',
  broadcast_alert: 'text-amber-300',
  call_police:     'text-red-300',
  dispatch_robot:  'text-slate-400',
  investigate:     'text-blue-300',
};

const MSG_COLOR: Record<GuardMessage['messageType'], string> = {
  status_update: 'text-slate-300',
  all_clear: 'text-green-400',
  suspicious_activity: 'text-amber-300',
  request_backup: 'text-red-400',
};

const ACTIVITY_BADGE: Record<string, string> = {
  none:   'bg-slate-700/60 text-slate-500',
  low:    'bg-slate-700/60 text-slate-400',
  normal: 'bg-blue-900/40 text-blue-300',
  high:   'bg-amber-900/40 text-amber-300',
  peak:   'bg-red-900/40 text-red-300',
};

const MEMO_BORDER: Record<string, string> = {
  normal:   'border-slate-600',
  elevated: 'border-amber-500/60',
  critical: 'border-red-500/60',
};

const fmt = (role: string) =>
  role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

const fmtTime = (ts: string) =>
  new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

const fmtRelative = (ts: string): string => {
  if (!ts) return '';
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return fmtTime(ts);
};

const fmtDate = (ts: string): string => {
  const d = new Date(ts);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + fmtTime(ts);
};

const INCIDENT_DOT: Record<Incident['status'], string> = {
  open:        'bg-orange-400',
  resolved:    'bg-green-400',
  false_alarm: 'bg-red-400',
  escalated:   'bg-amber-400',
};

const ShiftPanel = ({ shift, events, memos, shiftMemo, venueNotes, agentActions, incidents, selectedUnitId, onSelectUnit }: Props) => {
  const [goalExpanded, setGoalExpanded] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [dispatchExpanded, setDispatchExpanded] = useState(false);
  const [resolvingActionId, setResolvingActionId] = useState<string | null>(null);
  const [resolveNotes, setResolveNotes] = useState('');

  const resolveIncident = async (incidentId: string, status: string) => {
    await fetch(`http://localhost:3000/incidents/${incidentId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, notes: resolveNotes.trim() || undefined }),
    }).catch(() => {});
    setResolvingActionId(null);
    setResolveNotes('');
  };

  const guardStatus = useMemo(
    () => buildGuardStatusMap(shift?.guards.map(g => g.id) ?? [], events),
    [shift, events],
  );

  const robotStatus = useMemo(
    () => buildRobotStatusMap(shift?.robots.map(r => r.id) ?? [], events),
    [shift, events],
  );

  const guardMessages = useMemo(
    () =>
      events
        .filter((e): e is GuardMessage => e.type === 'message')
        .filter(e => selectedUnitId === null || e.guardId === selectedUnitId),
    [events, selectedUnitId],
  );

  type MessageFeedItem =
    | { kind: 'guard'; msg: GuardMessage; ts: string }
    | { kind: 'ai'; action: AgentAction; ts: string };

  const messages = useMemo((): MessageFeedItem[] => {
    const guardItems: MessageFeedItem[] = guardMessages.map(m => ({ kind: 'guard', msg: m, ts: m.timestamp }));
    const aiItems: MessageFeedItem[] = agentActions
      .filter(a => a.type === 'message_guard' || a.type === 'broadcast_alert')
      .filter(a => selectedUnitId === null || a.guardId === selectedUnitId || !a.guardId)
      .map(a => ({ kind: 'ai', action: a, ts: a.timestamp }));
    return [...guardItems, ...aiItems].sort((a, b) => b.ts.localeCompare(a.ts));
  }, [guardMessages, agentActions, selectedUnitId]);

  if (!shift) {
    return (
      <div className="flex items-center justify-center h-full border-l border-slate-700/50 bg-slate-900">
        <p className="text-xs text-slate-600">Loading shift…</p>
      </div>
    );
  }

  const selectedGuard = shift.guards.find(g => g.id === selectedUnitId) ?? null;
  const selectedRobot = shift.robots.find(r => r.id === selectedUnitId) ?? null;
  const selectedMemo = selectedUnitId ? memos.get(selectedUnitId) ?? null : null;
  const selectedLevel = selectedGuard
    ? getAlertLevel(guardStatus.get(selectedGuard.id)!)
    : selectedRobot
    ? getRobotAlertLevel(robotStatus.get(selectedRobot.id)!)
    : 'normal';

  const filteredActions = agentActions.filter(a =>
    selectedUnitId === null || a.guardId === selectedUnitId || !a.guardId
  );
  const visibleActions = dispatchExpanded ? filteredActions : filteredActions.slice(0, 5);

  return (
    <div className="flex flex-col h-full min-h-0 border-l border-slate-700/50 bg-slate-900">

      {/* Shift info */}
      <div className="px-4 pt-3 pb-3 border-b border-slate-700/50 shrink-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">Shift</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${ACTIVITY_BADGE[shift.expectedActivity] ?? ACTIVITY_BADGE.normal}`}>
            Activity: {shift.expectedActivity}
          </span>
        </div>
        <p className="text-sm font-semibold text-slate-100">{shift.venueName}</p>
        <p className="text-[11px] text-slate-500 mt-0.5">{shift.venueAddress}</p>

        <div className="mt-2">
          <p className={`text-[11px] text-slate-400 leading-relaxed ${goalExpanded ? '' : 'line-clamp-2'}`}>
            {shift.goal}
          </p>
          <button
            onClick={() => setGoalExpanded(v => !v)}
            className="flex items-center gap-0.5 mt-0.5 text-[10px] text-slate-600 hover:text-slate-400 transition-colors cursor-pointer"
          >
            {goalExpanded
              ? <><ChevronUp className="h-3 w-3" />less</>
              : <><ChevronDown className="h-3 w-3" />more</>}
          </button>
        </div>

        {/* Venue history toggle */}
        {venueNotes.length > 0 && (
          <div className="mt-2">
            <button
              onClick={() => setHistoryExpanded(v => !v)}
              className="flex items-center gap-1.5 text-[10px] text-slate-500 hover:text-slate-300 transition-colors cursor-pointer w-full"
            >
              <History className="h-3 w-3 shrink-0" />
              <span>Venue history</span>
              <span className="ml-auto text-slate-600">{venueNotes.length}</span>
              {historyExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            {historyExpanded && (
              <div className="mt-1.5 space-y-1.5 max-h-32 overflow-y-auto pr-1">
                {venueNotes.map(note => (
                  <div key={note.id} className="flex gap-2 text-[10px]">
                    <span className="text-slate-600 shrink-0 font-mono">{fmtDate(note.occurredAt)}</span>
                    <span className="text-slate-400 leading-relaxed">{note.content}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Shift Intel (AI shift memo) */}
      {shiftMemo && (
        <div className="px-4 pt-2.5 pb-2.5 border-b border-slate-700/50 shrink-0">
          <div className="flex items-center justify-between mb-1">
            <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              <BrainCircuit className="h-3 w-3" />
              Shift Intel
            </span>
            <span className="text-[10px] text-slate-600">{fmtRelative(shiftMemo.updatedAt)}</span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">{shiftMemo.content}</p>
        </div>
      )}

      {/* Dispatch Log */}
      {filteredActions.length > 0 && (
        <div className="px-4 pt-2.5 pb-2.5 border-b border-slate-700/50 shrink-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              <Zap className="h-3 w-3" />
              Dispatch Log
            </span>
            <span className="text-[10px] text-slate-600">{filteredActions.length}</span>
          </div>
          <div className="space-y-1.5">
            {visibleActions.map(action => {
              const incident = incidents.get(action.id);
              const isResolving = resolvingActionId === action.id;
              return (
                <div key={action.id}>
                  <div className="flex items-start gap-2 text-[10px]">
                    <span className="text-slate-600 font-mono shrink-0 pt-px">{fmtTime(action.timestamp)}</span>
                    <span className="shrink-0 pt-px">{ACTION_ICON[action.type] ?? <Zap className="h-3 w-3 shrink-0 text-slate-500" />}</span>
                    <div className="min-w-0 flex-1">
                      {action.guardName && (
                        <span className={`font-medium mr-1 ${ACTION_LABEL[action.type] ?? 'text-slate-400'}`}>
                          {action.type === 'broadcast_alert' ? 'All guards' : action.guardName}
                        </span>
                      )}
                      {!action.guardName && action.type === 'call_police' && (
                        <span className="font-medium mr-1 text-red-300">Police</span>
                      )}
                      {action.content && (
                        <span className="text-slate-400 leading-relaxed">&ldquo;{action.content}&rdquo;</span>
                      )}
                    </div>
                    {incident && (
                      <button
                        title={incident.status === 'open' ? 'Mark outcome' : incident.status.replace('_', ' ')}
                        onClick={() => {
                          if (incident.status !== 'open') return;
                          setResolvingActionId(isResolving ? null : action.id);
                          setResolveNotes('');
                        }}
                        className={`h-2 w-2 rounded-full shrink-0 mt-1 transition-opacity ${INCIDENT_DOT[incident.status]} ${incident.status === 'open' ? 'cursor-pointer hover:opacity-70' : 'cursor-default opacity-80'}`}
                      />
                    )}
                  </div>
                  {isResolving && incident && (
                    <div className="mt-1.5 ml-10 p-2 rounded bg-slate-800 border border-slate-700/60 space-y-1.5">
                      <div className="flex gap-1.5">
                        <button onClick={() => resolveIncident(incident.id, 'resolved')} className="flex-1 text-[10px] py-1 rounded bg-green-900/40 hover:bg-green-900/70 text-green-300 border border-green-800/50 transition-colors cursor-pointer">✓ Resolved</button>
                        <button onClick={() => resolveIncident(incident.id, 'false_alarm')} className="flex-1 text-[10px] py-1 rounded bg-slate-700/40 hover:bg-slate-700/70 text-slate-300 border border-slate-600/50 transition-colors cursor-pointer">✗ False alarm</button>
                        <button onClick={() => resolveIncident(incident.id, 'escalated')} className="flex-1 text-[10px] py-1 rounded bg-amber-900/40 hover:bg-amber-900/70 text-amber-300 border border-amber-800/50 transition-colors cursor-pointer">↑ Escalated</button>
                      </div>
                      <input
                        type="text"
                        value={resolveNotes}
                        onChange={e => setResolveNotes(e.target.value)}
                        placeholder="Notes (optional)"
                        className="w-full text-[10px] bg-slate-900 border border-slate-700/60 rounded px-2 py-1 text-slate-300 placeholder-slate-600 focus:outline-none focus:border-slate-500"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {filteredActions.length > 5 && (
            <button
              onClick={() => setDispatchExpanded(v => !v)}
              className="flex items-center gap-0.5 mt-1.5 text-[10px] text-slate-600 hover:text-slate-400 transition-colors cursor-pointer"
            >
              {dispatchExpanded
                ? <><ChevronUp className="h-3 w-3" />show less</>
                : <><ChevronDown className="h-3 w-3" />{filteredActions.length - 5} more</>}
            </button>
          )}
        </div>
      )}

      {/* Guards */}
      <div className="px-4 pt-3 pb-2 shrink-0 border-b border-slate-700/50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">Guards</span>
          <span className="text-[10px] text-slate-600">{shift.guards.length} active</span>
        </div>
        <div className="space-y-1">
          {shift.guards.map(guard => {
            const status = guardStatus.get(guard.id)!;
            const lv = getAlertLevel(status);
            const selected = selectedUnitId === guard.id;
            const hasMemo = memos.has(guard.id);
            return (
              <button
                key={guard.id}
                onClick={() => onSelectUnit(selected ? null : guard.id)}
                className={`w-full text-left px-3 py-2 rounded-md transition-colors cursor-pointer ${
                  selected
                    ? 'bg-slate-700 ring-1 ring-slate-500'
                    : 'bg-slate-800/50 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full shrink-0 ${ALERT_DOT[lv]}`} />
                  <span className="text-xs font-medium text-slate-200 flex-1 truncate">{guard.name}</span>
                  {hasMemo && <BrainCircuit className="h-3 w-3 text-slate-500 shrink-0" />}
                  <span className="text-[10px] text-slate-500 shrink-0">{fmt(guard.role)}</span>
                </div>
                <div className="flex items-center gap-3 mt-0.5 pl-4">
                  {status.lastZone && (
                    <span className="flex items-center gap-0.5 text-[10px] text-slate-500">
                      <MapPin className="h-2.5 w-2.5" />
                      {status.lastZone}
                    </span>
                  )}
                  {status.lastHr !== null && (
                    <span className={`flex items-center gap-0.5 text-[10px] ${ALERT_HR_COLOR[lv]}`}>
                      <Heart className="h-2.5 w-2.5" />
                      {status.lastHr} bpm
                    </span>
                  )}
                  {status.lastMovement && (
                    <span className="text-[10px] text-slate-600">
                      {status.lastMovement.replace('_', ' ')}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Robots */}
      {shift.robots.length > 0 && (
        <div className="px-4 pt-3 pb-2 shrink-0 border-b border-slate-700/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">Robots</span>
            <span className="text-[10px] text-slate-600">{shift.robots.length} active</span>
          </div>
          <div className="space-y-1">
            {shift.robots.map(robot => {
              const status = robotStatus.get(robot.id)!;
              const lv = getRobotAlertLevel(status);
              const selected = selectedUnitId === robot.id;
              const hasMemo = memos.has(robot.id);
              return (
                <button
                  key={robot.id}
                  onClick={() => onSelectUnit(selected ? null : robot.id)}
                  className={`w-full text-left px-3 py-2 rounded-md transition-colors cursor-pointer ${
                    selected
                      ? 'bg-slate-700 ring-1 ring-slate-500'
                      : 'bg-slate-800/50 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full shrink-0 ${ALERT_DOT[lv]}`} />
                    <span className="text-xs font-medium text-slate-200 flex-1 truncate">{robot.name}</span>
                    {hasMemo && <BrainCircuit className="h-3 w-3 text-slate-500 shrink-0" />}
                    <span className="text-[10px] text-slate-500 shrink-0">{robot.model}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 pl-4">
                    {status.lastZone && (
                      <span className="flex items-center gap-0.5 text-[10px] text-slate-500">
                        <MapPin className="h-2.5 w-2.5" />
                        {status.lastZone}
                      </span>
                    )}
                    {status.batteryPct !== null && (
                      <span className={`flex items-center gap-0.5 text-[10px] ${ALERT_HR_COLOR[lv]}`}>
                        <Battery className="h-2.5 w-2.5" />
                        {status.batteryPct}%
                      </span>
                    )}
                    {status.status && (
                      <span className="text-[10px] text-slate-600">
                        {status.status}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* AI Assessment — shown when a guard with a memo is selected */}
      {selectedMemo && (
        <div className="px-4 pt-3 pb-3 shrink-0 border-b border-slate-700/50">
          <div className="flex items-center justify-between mb-1.5">
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-slate-400">
              <BrainCircuit className="h-3.5 w-3.5" />
              AI Assessment
            </span>
            <span className="text-[10px] text-slate-600">{fmtRelative(selectedMemo.updatedAt)}</span>
          </div>
          <div className={`border-l-2 pl-3 ${MEMO_BORDER[selectedLevel]}`}>
            <p className="text-[11px] text-slate-300 leading-relaxed">{selectedMemo.content}</p>
          </div>
        </div>
      )}

      {/* Messages header */}
      <div className="px-4 pt-3 pb-1 shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Messages
            {(selectedGuard || selectedRobot) && (
              <span className="normal-case font-normal text-slate-600 ml-1">· {(selectedGuard ?? selectedRobot)!.name}</span>
            )}
          </span>
          {messages.length > 0 && (
            <span className="text-[10px] text-slate-600">{messages.length}</span>
          )}

        </div>
      </div>

      {/* Messages feed */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-4 pb-3 pt-1 space-y-1.5 min-h-full bg-slate-900">
          {messages.length === 0 && (
            <p className="text-[11px] text-slate-600 pt-1">
              {selectedUnitId ? 'No messages from this guard' : 'No messages yet'}
            </p>
          )}
          {messages.map(item => {
            if (item.kind === 'guard') {
              const msg = item.msg;
              return (
                <div key={msg.id} className="text-[11px] leading-relaxed">
                  <span className="font-mono text-slate-600 mr-1.5">{fmtTime(msg.timestamp)}</span>
                  {selectedUnitId === null && (
                    <span className="font-medium text-slate-400 mr-1">
                      {msg.guardName.split(' ')[0]}
                    </span>
                  )}
                  <span className={MSG_COLOR[msg.messageType]}>{msg.content}</span>
                </div>
              );
            }
            const a = item.action;
            const label = a.type === 'broadcast_alert' ? 'All guards' : (a.guardName?.split(' ')[0] ?? 'Guard');
            return (
              <div key={a.id} className="text-[11px] leading-relaxed border-l-2 border-teal-700/50 pl-2 -ml-2">
                <span className="font-mono text-slate-600 mr-1.5">{fmtTime(a.timestamp)}</span>
                <Send className="h-2.5 w-2.5 inline text-teal-500 mr-1 -mt-px" />
                <span className="font-medium text-teal-400 mr-1">Dispatcher → {label}</span>
                <span className="text-slate-300">&ldquo;{a.content}&rdquo;</span>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};

export default ShiftPanel;
