import { useMemo } from 'react';
import { Send, Radio, PhoneCall, Bot, Zap } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import LogLine from './LogLine';
import type { SecurityEvent, Decision, AgentAction } from '@/types';

interface Props {
  events: SecurityEvent[];
  decisions: Map<string, Decision>;
  agentActions: AgentAction[];
}

type FeedItem =
  | { kind: 'event'; event: SecurityEvent; decision: Decision | null; ts: string }
  | { kind: 'action'; action: AgentAction; ts: string };

const ACTION_ICON: Record<string, React.ReactNode> = {
  message_guard:   <Send      className="h-3 w-3 shrink-0 text-teal-400" />,
  broadcast_alert: <Radio     className="h-3 w-3 shrink-0 text-amber-400" />,
  call_police:     <PhoneCall className="h-3 w-3 shrink-0 text-red-400" />,
  dispatch_robot:  <Bot       className="h-3 w-3 shrink-0 text-slate-400" />,
  investigate:     <Zap       className="h-3 w-3 shrink-0 text-blue-400" />,
};

const ACTION_NAME_COLOR: Record<string, string> = {
  message_guard:   'text-teal-300',
  broadcast_alert: 'text-amber-300',
  call_police:     'text-red-300',
  dispatch_robot:  'text-slate-400',
  investigate:     'text-blue-300',
};

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

const AgentActionLine = ({ action }: { action: AgentAction }) => {
  const icon = ACTION_ICON[action.type] ?? <Zap className="h-3 w-3 shrink-0 text-slate-500" />;
  const nameColor = ACTION_NAME_COLOR[action.type] ?? 'text-slate-400';

  const label =
    action.type === 'call_police'   ? 'Police' :
    action.type === 'broadcast_alert' ? 'All guards' :
    action.guardName ?? 'Guard';

  return (
    <div className="py-1 font-mono text-xs leading-relaxed border-b border-slate-800/60 last:border-0">
      <div className="flex items-start gap-1.5 flex-wrap">
        <span className="text-slate-600 shrink-0">[{fmtTime(action.timestamp)}]</span>
        {icon}
        <span className="text-slate-500 shrink-0">Dispatcher</span>
        <span className="text-slate-700 shrink-0">→</span>
        <span className={`font-medium shrink-0 ${nameColor}`}>{label}</span>
        {action.content && (
          <>
            <span className="text-slate-700 shrink-0">·</span>
            <span className="text-slate-300">&ldquo;{action.content}&rdquo;</span>
          </>
        )}
      </div>
    </div>
  );
};

const LiveFeed = ({ events, decisions, agentActions }: Props) => {
  const items = useMemo((): FeedItem[] => {
    const eventItems: FeedItem[] = events.map(e => ({
      kind: 'event', event: e, decision: decisions.get(e.id) ?? null, ts: e.timestamp,
    }));
    const actionItems: FeedItem[] = agentActions.map(a => ({
      kind: 'action', action: a, ts: a.timestamp,
    }));
    return [...eventItems, ...actionItems].sort((a, b) => b.ts.localeCompare(a.ts));
  }, [events, decisions, agentActions]);

  return (
    <div className="flex flex-col h-full min-h-0 bg-slate-900">
      <div className="px-4 py-2 border-b border-slate-700/50 flex items-center gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Activity</h2>
        <span className="text-[10px] text-slate-600">{items.length}</span>
      </div>
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-4 py-1 min-h-full bg-slate-900">
          {items.length === 0 && (
            <p className="text-slate-600 text-xs text-center py-8 font-mono">Waiting for events…</p>
          )}
          {items.map(item =>
            item.kind === 'event'
              ? <LogLine key={item.event.id} event={item.event} decision={item.decision} />
              : <AgentActionLine key={item.action.id} action={item.action} />
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default LiveFeed;
