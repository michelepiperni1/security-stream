import { ScrollArea } from '@/components/ui/scroll-area';
import LogLine from './LogLine';
import type { SecurityEvent, Decision } from '@/types';

interface Props {
  events: SecurityEvent[];
  decisions: Map<string, Decision>;
}

const LiveFeed = ({ events, decisions }: Props) => (
  <div className="flex flex-col h-full min-h-0 bg-slate-900">
    <div className="px-4 py-2 border-b border-slate-700/50 flex items-center gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Activity</h2>
      <span className="text-[10px] text-slate-600">{events.length}</span>
    </div>
    <ScrollArea className="flex-1 min-h-0">
      <div className="px-4 py-1 min-h-full bg-slate-900">
          {events.length === 0 && (
            <p className="text-slate-600 text-xs text-center py-8 font-mono">Waiting for events…</p>
          )}
          {events.map(event => (
            <LogLine key={event.id} event={event} decision={decisions.get(event.id) ?? null} />
          ))}
        </div>
    </ScrollArea>
  </div>
);

export default LiveFeed;
