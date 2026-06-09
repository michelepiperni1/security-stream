import { useState } from 'react';
import { MapPin, Heart, MessageSquare, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { SecurityEvent, Decision, GpsEvent, WearableEvent, GuardMessage, PanicEvent } from '@/types';

const PRIORITY_COLOR: Record<number, string> = {
  1: 'text-slate-500',
  2: 'text-slate-400',
  3: 'text-yellow-500',
  4: 'text-orange-400',
  5: 'text-red-400',
};

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

// --- per-type renderers ---

const GpsLine = ({ event }: { event: GpsEvent }) => (
  <div className="flex items-center gap-1.5 flex-wrap">
    <span className="text-slate-600 shrink-0">[{formatTime(event.timestamp)}]</span>
    <MapPin className="h-3 w-3 text-slate-700 shrink-0" />
    <span className="text-slate-600">{event.guardName}</span>
    <span className="text-slate-700 shrink-0">@</span>
    <span className="text-slate-600">{event.location.label}</span>
    {event.outOfHours && <span className="text-amber-600 shrink-0">[out-of-hours]</span>}
  </div>
);

const WearableLine = ({ event }: { event: WearableEvent }) => {
  const anomaly = event.movement === 'fall_detected' || event.movement === 'running' || event.heartRateBpm > 90;
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-slate-600 shrink-0">[{formatTime(event.timestamp)}]</span>
      <Heart className="h-3 w-3 text-slate-600 shrink-0" />
      <span className={anomaly ? 'text-slate-400' : 'text-slate-600'}>{event.guardName}</span>
      <span className="text-slate-700 shrink-0">·</span>
      <span className={event.heartRateBpm > 90 ? 'text-amber-400' : 'text-slate-600'}>
        HR {event.heartRateBpm} bpm
      </span>
      <span className="text-slate-700 shrink-0">·</span>
      <span className={event.movement !== 'stationary' && event.movement !== 'walking' ? 'text-amber-400' : 'text-slate-600'}>
        {event.movement.replace('_', ' ')}
      </span>
    </div>
  );
};

const MessageLine = ({ event }: { event: GuardMessage }) => {
  const urgent = event.messageType === 'request_backup' || event.messageType === 'suspicious_activity';
  return (
    <div className="flex items-start gap-1.5 flex-wrap">
      <span className="text-slate-500 shrink-0">[{formatTime(event.timestamp)}]</span>
      <MessageSquare className="h-3 w-3 text-slate-400 shrink-0 mt-[1px]" />
      <span className="text-slate-300 shrink-0">{event.guardName}</span>
      <span className="text-slate-600 shrink-0">·</span>
      <span className={urgent ? 'text-slate-200' : 'text-slate-400'}>&ldquo;{event.content}&rdquo;</span>
    </div>
  );
};

const PanicLine = ({ event }: { event: PanicEvent }) => (
  <div className="flex items-center gap-1.5 flex-wrap">
    <span className="text-red-600 shrink-0">[{formatTime(event.timestamp)}]</span>
    <AlertTriangle className="h-3 w-3 text-red-400 shrink-0" />
    <span className="text-red-300 font-semibold shrink-0">{event.guardName}</span>
    <span className="text-red-500 shrink-0">·</span>
    <span className="text-red-400 font-semibold">PANIC</span>
    <span className="text-red-600 shrink-0">@</span>
    <span className="text-red-400">{event.location.label}</span>
  </div>
);

// --- decision line ---

const DecisionLine = ({ decision }: { decision: Decision }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-0.5 space-y-0.5">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-rose-400 font-semibold shrink-0">→ {decision.action}</span>
        <span className={`shrink-0 font-semibold ${PRIORITY_COLOR[decision.priority] ?? 'text-slate-400'}`}>
          P{decision.priority}
        </span>
        <span className="text-rose-300/70">{decision.reasoning}</span>
      </div>

      {decision.thinking && (
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger className="flex items-center gap-1 text-slate-600 hover:text-slate-400 transition-colors text-[11px]">
            {open ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
            {open ? 'hide thinking' : 'show thinking'}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <pre className="mt-1 text-[11px] text-slate-500 whitespace-pre-wrap bg-slate-900/60 rounded p-2 max-h-40 overflow-y-auto leading-relaxed">
              {decision.thinking}
            </pre>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
};

// --- main ---

interface Props {
  event: SecurityEvent;
  decision: Decision | null;
}

const LogLine = ({ event, decision }: Props) => (
  <div className="py-1 font-mono text-xs leading-relaxed border-b border-slate-800/60 last:border-0">
    {event.type === 'gps'      && <GpsLine     event={event} />}
    {event.type === 'wearable' && <WearableLine event={event} />}
    {event.type === 'message'  && <MessageLine  event={event} />}
    {event.type === 'panic'    && <PanicLine    event={event} />}
    {decision && <DecisionLine decision={decision} />}
  </div>
);

export default LogLine;
