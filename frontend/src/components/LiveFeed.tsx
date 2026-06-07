import { ScrollArea } from '@/components/ui/scroll-area';
import ReportCard from './ReportCard';
import type { ReportWithDecision } from '@/types';

interface Props {
  reports: ReportWithDecision[];
}

const LiveFeed = ({ reports }: Props) => (
  <div className="flex flex-col h-full min-h-0 bg-slate-900">
    <div className="px-4 py-3 border-b border-slate-700/50">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Live Feed</h2>
      <p className="text-xs text-slate-600 mt-0.5">{reports.length} reports</p>
    </div>
    <ScrollArea className="flex-1 bg-slate-900">
      <div className="p-3 space-y-2">
        {reports.length === 0 && (
          <p className="text-slate-600 text-xs text-center py-8">Waiting for events…</p>
        )}
        {reports.map(({ report, decision }) => (
          <ReportCard key={report.id} report={report} decision={decision} />
        ))}
      </div>
    </ScrollArea>
  </div>
);

export default LiveFeed;
