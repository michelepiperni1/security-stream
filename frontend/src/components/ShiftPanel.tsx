import { useMemo, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronDown, ChevronUp, MapPin, Heart, BrainCircuit, History } from 'lucide-react';
import type { ShiftInfo, SecurityEvent, GuardMessage, GuardMemo, ShiftMemo, VenueNote } from '@/types';
import { buildGuardStatusMap, getAlertLevel, ALERT_DOT, ALERT_HR_COLOR } from '@/lib/guardAlertLevel';

interface Props {
  shift: ShiftInfo | null;
  events: SecurityEvent[];
  memos: Map<string, GuardMemo>;
  shiftMemo: ShiftMemo | null;
  venueNotes: VenueNote[];
  selectedGuardId: string | null;
  onSelectGuard: (id: string | null) => void;
}

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

const ShiftPanel = ({ shift, events, memos, shiftMemo, venueNotes, selectedGuardId, onSelectGuard }: Props) => {
  const [goalExpanded, setGoalExpanded] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(false);

  const guardStatus = useMemo(
    () => buildGuardStatusMap(shift?.guards.map(g => g.id) ?? [], events),
    [shift, events],
  );

  const messages = useMemo(
    () =>
      events
        .filter((e): e is GuardMessage => e.type === 'message')
        .filter(e => selectedGuardId === null || e.guardId === selectedGuardId),
    [events, selectedGuardId],
  );

  if (!shift) {
    return (
      <div className="flex items-center justify-center h-full border-l border-slate-700/50 bg-slate-900">
        <p className="text-xs text-slate-600">Loading shift…</p>
      </div>
    );
  }

  const selectedGuard = shift.guards.find(g => g.id === selectedGuardId) ?? null;
  const selectedMemo = selectedGuardId ? memos.get(selectedGuardId) ?? null : null;
  const selectedLevel = selectedGuardId ? getAlertLevel(guardStatus.get(selectedGuardId)!) : 'normal';

  return (
    <div className="flex flex-col h-full min-h-0 border-l border-slate-700/50 bg-slate-900">

      {/* Shift info */}
      <div className="px-4 pt-3 pb-3 border-b border-slate-700/50 shrink-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">Shift</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${ACTIVITY_BADGE[shift.expectedActivity] ?? ACTIVITY_BADGE.normal}`}>
            {shift.expectedActivity}
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
            const selected = selectedGuardId === guard.id;
            const hasMemo = memos.has(guard.id);
            return (
              <button
                key={guard.id}
                onClick={() => onSelectGuard(selected ? null : guard.id)}
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
            {selectedGuard && (
              <span className="normal-case font-normal text-slate-600 ml-1">· {selectedGuard.name}</span>
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
              {selectedGuardId ? 'No messages from this guard' : 'No messages yet'}
            </p>
          )}
          {messages.map(msg => (
            <div key={msg.id} className="text-[11px] leading-relaxed">
              <span className="font-mono text-slate-600 mr-1.5">{fmtTime(msg.timestamp)}</span>
              {selectedGuardId === null && (
                <span className="font-medium text-slate-400 mr-1">
                  {msg.guardName.split(' ')[0]}
                </span>
              )}
              <span className={MSG_COLOR[msg.messageType]}>{msg.content}</span>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

export default ShiftPanel;
