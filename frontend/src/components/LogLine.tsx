import { useState } from 'react';
import { Shield, Bot, ChevronDown, ChevronUp } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { GuardReport, RobotReport, ReportWithDecision } from '@/types';

const PRIORITY_COLOR: Record<number, string> = {
  1: 'text-slate-500',
  2: 'text-slate-400',
  3: 'text-yellow-500',
  4: 'text-orange-400',
  5: 'text-red-400',
};

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

const guardSummary = (r: GuardReport): { text: string; anomaly: boolean } => {
  const flags: string[] = [];
  if (r.panicPressed) flags.push('PANIC');
  if (r.sensors.audioAlert !== 'none') flags.push(r.sensors.audioAlert.replace(/_/g, ' '));
  if (r.sensors.movement === 'running' || r.sensors.movement === 'fall_detected')
    flags.push(r.sensors.movement.replace('_', ' '));
  if (r.sensors.heartRateBpm > 90) flags.push(`HR ${r.sensors.heartRateBpm} bpm`);
  if (flags.length === 0) return { text: r.dutyStatus.replace(/_/g, ' '), anomaly: false };
  return { text: flags.join(' · '), anomaly: true };
};

const robotSummary = (r: RobotReport): { text: string; anomaly: boolean } => {
  const flags: string[] = [];
  if (r.sensors.personDetected) flags.push('person detected');
  if (r.sensors.thermalAnomaly) flags.push('thermal anomaly');
  if (r.sensors.soundLevelDb > 55) flags.push(`${r.sensors.soundLevelDb} dB`);
  if (r.patrolStatus === 'investigating') flags.push('investigating');
  if (flags.length === 0) return { text: r.patrolStatus.replace(/_/g, ' '), anomaly: false };
  return { text: flags.join(' · '), anomaly: true };
};

interface Props {
  report: ReportWithDecision['report'];
  decision: ReportWithDecision['decision'];
}

const LogLine = ({ report, decision }: Props) => {
  const [thinkingOpen, setThinkingOpen] = useState(false);
  const summary = report.agentType === 'guard' ? guardSummary(report) : robotSummary(report);

  return (
    <div className="py-1 font-mono text-xs leading-relaxed border-b border-slate-800/60 last:border-0">
      {/* Sensor report line */}
      <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
        <span className="text-slate-600 shrink-0">[{formatTime(report.timestamp)}]</span>
        {report.agentType === 'guard'
          ? <Shield className="h-3 w-3 text-slate-500 shrink-0" />
          : <Bot className="h-3 w-3 text-slate-500 shrink-0" />}
        <span className="text-slate-200 shrink-0">{report.agentName}</span>
        <span className="text-slate-700 shrink-0">@</span>
        <span className="text-slate-500">{report.location.label}</span>
        <span className="text-slate-700 shrink-0">·</span>
        <span className={summary.anomaly ? 'text-amber-400' : 'text-slate-500'}>
          {summary.text}
        </span>
        {report.outOfHours && (
          <span className="text-amber-500 shrink-0">[out-of-hours]</span>
        )}
      </div>

      {/* AI decision line */}
      {decision && (
        <div className="mt-0.5 space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-rose-400 font-semibold shrink-0">→ {decision.action}</span>
            <span className={`shrink-0 font-semibold ${PRIORITY_COLOR[decision.priority] ?? 'text-slate-400'}`}>
              P{decision.priority}
            </span>
            <span className="text-rose-300/70">{decision.reasoning}</span>
          </div>

          {decision.thinking && (
            <Collapsible open={thinkingOpen} onOpenChange={setThinkingOpen}>
              <CollapsibleTrigger className="flex items-center gap-1 text-slate-600 hover:text-slate-400 transition-colors text-[11px]">
                {thinkingOpen ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
                {thinkingOpen ? 'hide thinking' : 'show thinking'}
              </CollapsibleTrigger>
              <CollapsibleContent>
                <pre className="mt-1 text-[11px] text-slate-500 whitespace-pre-wrap bg-slate-900/60 rounded p-2 max-h-40 overflow-y-auto leading-relaxed">
                  {decision.thinking}
                </pre>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      )}
    </div>
  );
};

export default LogLine;
