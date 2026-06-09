import { useState } from 'react';
import { MapPin, Heart, MessageSquare, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { SecurityEvent, Decision, GpsEvent, WearableEvent, GuardMessage, PanicEvent } from '@/types';

const PRIORITY_STYLES: Record<number, string> = {
  1: 'bg-slate-700 text-slate-300',
  2: 'bg-slate-600 text-slate-200',
  3: 'bg-yellow-900/60 text-yellow-300 border border-yellow-700/50',
  4: 'bg-orange-900/60 text-orange-300 border border-orange-700/50',
  5: 'bg-red-900/60 text-red-300 border border-red-700/50',
};

const ACTION_LABELS: Record<string, string> = {
  dispatch_guard: 'Dispatch Guard',
  dispatch_robot: 'Dispatch Robot',
  escalate: 'Escalate',
  monitor: 'Monitor',
  dismiss: 'Dismiss',
};

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

const EventSummary = ({ event }: { event: SecurityEvent }) => {
  const gps = event as GpsEvent;
  const wearable = event as WearableEvent;
  const msg = event as GuardMessage;
  const panic = event as PanicEvent;

  if (event.type === 'gps') {
    return (
      <div className="flex items-center gap-2">
        <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
        <span className="text-sm text-slate-200 font-medium">{gps.guardName}</span>
        <span className="text-xs text-slate-400">@ {gps.location.label}</span>
        {gps.outOfHours && <span className="text-xs text-amber-400">[out-of-hours]</span>}
      </div>
    );
  }

  if (event.type === 'wearable') {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <Heart className="h-3.5 w-3.5 text-slate-400 shrink-0" />
        <span className="text-sm text-slate-200 font-medium">{wearable.guardName}</span>
        <span className="text-xs text-amber-400">HR {wearable.heartRateBpm} bpm</span>
        <span className="text-xs text-amber-400">{wearable.movement.replace('_', ' ')}</span>
      </div>
    );
  }

  if (event.type === 'message') {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <span className="text-sm text-slate-200 font-medium">{msg.guardName}</span>
          <span className="text-xs text-slate-500">{msg.messageType.replace('_', ' ')}</span>
        </div>
        <p className="text-xs text-slate-300 pl-5">&ldquo;{msg.content}&rdquo;</p>
      </div>
    );
  }

  // panic
  return (
    <div className="flex items-center gap-2">
      <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />
      <span className="text-sm text-red-300 font-semibold">{panic.guardName}</span>
      <span className="text-xs text-red-400 font-semibold">PANIC @ {panic.location.label}</span>
    </div>
  );
};

interface Props {
  event: SecurityEvent;
  decision: Decision;
}

const IncidentCard = ({ event, decision }: Props) => {
  const [thinkingOpen, setThinkingOpen] = useState(false);

  return (
    <div className="rounded-lg bg-slate-800 border border-slate-700/50 p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <EventSummary event={event} />
        <span className="text-slate-500 text-xs shrink-0">{formatTime(event.timestamp)}</span>
      </div>

      <div className="pt-2 border-t border-slate-700/50 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded ${PRIORITY_STYLES[decision.priority] ?? PRIORITY_STYLES[2]}`}>
            P{decision.priority}
          </span>
          <span className="text-xs font-medium text-slate-200">{ACTION_LABELS[decision.action]}</span>
          <span className="text-xs text-slate-500 ml-auto">{Math.round(decision.confidence * 100)}% conf</span>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">{decision.reasoning}</p>

        {decision.thinking && (
          <Collapsible open={thinkingOpen} onOpenChange={setThinkingOpen}>
            <CollapsibleTrigger className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors">
              {thinkingOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {thinkingOpen ? 'Hide' : 'Show'} thinking
            </CollapsibleTrigger>
            <CollapsibleContent>
              <pre className="mt-2 text-[11px] text-slate-400 whitespace-pre-wrap font-mono bg-slate-900/50 rounded p-2 max-h-48 overflow-y-auto leading-relaxed">
                {decision.thinking}
              </pre>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </div>
  );
};

export default IncidentCard;
