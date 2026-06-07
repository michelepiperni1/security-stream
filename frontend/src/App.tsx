import { useEffect, useRef, useState } from 'react';
import type { AgentReport, Decision, ReportWithDecision } from './types';
import LiveFeed from './components/LiveFeed';
import Incidents from './components/Incidents';

const App = () => {
  const [reports, setReports] = useState<ReportWithDecision[]>([]);
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    fetch('http://localhost:3000/history')
      .then(r => r.json())
      .then((history: ReportWithDecision[]) => {
        setReports(history.slice(0, 100));
      })
      .catch(() => {});

    const es = new EventSource('http://localhost:3000/events');
    esRef.current = es;

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    es.addEventListener('report', (e: MessageEvent) => {
      const report = JSON.parse(e.data) as AgentReport;
      setReports(prev => {
        if (prev.some(r => r.report.id === report.id)) return prev;
        return [{ report, decision: null }, ...prev].slice(0, 100);
      });
    });

    es.addEventListener('decision', (e: MessageEvent) => {
      const decision = JSON.parse(e.data) as Decision;
      setReports(prev =>
        prev.map(r =>
          r.report.id === decision.reportId ? { ...r, decision } : r
        )
      );
    });

    return () => es.close();
  }, []);

  const venueName = reports[0]?.report.shiftContext.venueName ?? 'Security Stream';

  const incidents = reports
    .filter(r => r.decision && r.decision.priority >= 3)
    .sort((a, b) => b.decision!.priority - a.decision!.priority);

  return (
    <div className="flex flex-col h-dvh bg-slate-900 text-slate-100">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-slate-700/50 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-slate-100 tracking-wide">{venueName}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${connected ? 'bg-green-400' : 'bg-slate-600'}`} />
          <span className="text-xs text-slate-400">{connected ? 'Live' : 'Connecting…'}</span>
        </div>
      </header>

      {/* Split layout */}
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 min-h-0">
          <LiveFeed reports={reports} />
        </div>
        <div className="w-[420px] shrink-0 min-h-0">
          <Incidents incidents={incidents} />
        </div>
      </div>
    </div>
  );
};

export default App;
