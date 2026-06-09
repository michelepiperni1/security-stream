import { ScrollArea } from '@/components/ui/scroll-area';
import IncidentCard from './IncidentCard';
import type { SecurityEvent, Decision } from '@/types';
import { AlertTriangle } from 'lucide-react';

interface Props {
  incidents: Array<{ event: SecurityEvent; decision: Decision | null }>;
}

const Incidents = ({ incidents }: Props) => (
  <div className="flex flex-col h-full min-h-0 border-l border-slate-700/50 bg-slate-900">
    <div className="px-4 py-3 border-b border-slate-700/50">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Active Incidents</h2>
      <p className="text-xs text-slate-600 mt-0.5">Priority 3+ · sorted by severity</p>
    </div>
    <ScrollArea className="flex-1 bg-slate-900">
      <div className="p-3 space-y-2">
        {incidents.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <AlertTriangle className="h-6 w-6 text-slate-700" />
            <p className="text-slate-600 text-xs">No active incidents</p>
          </div>
        )}
        {incidents.map(({ event, decision }) =>
          decision ? (
            <IncidentCard key={event.id} event={event} decision={decision} />
          ) : null
        )}
      </div>
    </ScrollArea>
  </div>
);

export default Incidents;
