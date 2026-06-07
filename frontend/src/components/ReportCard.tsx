import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { AgentReport, Decision, GuardReport, RobotReport } from '@/types';
import { ChevronDown, ChevronUp, Shield, Bot } from 'lucide-react';

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

const SENSITIVITY_STYLES: Record<string, string> = {
  public: 'bg-slate-700 text-slate-300',
  controlled: 'bg-blue-900/50 text-blue-300',
  restricted: 'bg-purple-900/50 text-purple-300',
};

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

const GuardSensorSummary = ({ report }: { report: GuardReport }) => {
  const flags = [];
  if (report.panicPressed) flags.push(<span key="panic" className="text-red-400 font-semibold">PANIC BUTTON</span>);
  if (report.sensors.movement !== 'walking' && report.sensors.movement !== 'stationary')
    flags.push(<span key="mov" className="text-orange-300">{report.sensors.movement.replace('_', ' ')}</span>);
  if (report.sensors.audioAlert !== 'none')
    flags.push(<span key="audio" className="text-yellow-300">{report.sensors.audioAlert.replace('_', ' ')}</span>);
  if (report.sensors.heartRateBpm > 90)
    flags.push(<span key="hr" className="text-orange-300">HR {report.sensors.heartRateBpm} bpm</span>);

  if (flags.length === 0)
    return <p className="text-slate-500 text-xs">{report.sensors.movement} · HR {report.sensors.heartRateBpm} bpm</p>;

  return <div className="flex flex-wrap gap-2 text-xs">{flags}</div>;
};

const RobotSensorSummary = ({ report }: { report: RobotReport }) => {
  const flags = [];
  if (report.sensors.personDetected) flags.push(<span key="person" className="text-red-400 font-semibold">Person detected</span>);
  if (report.sensors.thermalAnomaly) flags.push(<span key="thermal" className="text-orange-300">Thermal anomaly</span>);
  if (report.sensors.soundLevelDb > 55) flags.push(<span key="sound" className="text-yellow-300">{report.sensors.soundLevelDb} dB</span>);
  if (report.patrolStatus === 'investigating') flags.push(<span key="inv" className="text-yellow-300">Investigating</span>);

  if (flags.length === 0)
    return <p className="text-slate-500 text-xs">{report.patrolStatus} · {report.sensors.soundLevelDb} dB</p>;

  return <div className="flex flex-wrap gap-2 text-xs">{flags}</div>;
};

interface Props {
  report: AgentReport;
  decision: Decision | null;
}

const ReportCard = ({ report, decision }: Props) => {
  const [thinkingOpen, setThinkingOpen] = useState(false);

  return (
    <div className="rounded-lg bg-slate-800 border border-slate-700/50 p-3 space-y-2">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {report.agentType === 'guard'
            ? <Shield className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            : <Bot className="h-3.5 w-3.5 text-slate-400 shrink-0" />}
          <span className="font-medium text-sm text-slate-100 truncate">{report.agentName}</span>
          <span className="text-slate-500 text-xs shrink-0">·</span>
          <span className="text-slate-300 text-xs truncate">{report.location.label}</span>
        </div>
        <span className="text-slate-500 text-xs shrink-0">{formatTime(report.timestamp)}</span>
      </div>

      {/* Venue + badges */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-slate-400 text-xs">{report.shiftContext.venueName}</span>
        <Badge className={`text-[10px] px-1.5 py-0 ${SENSITIVITY_STYLES[report.location.sensitivity]}`}>
          {report.location.sensitivity}
        </Badge>
        {report.outOfHours && (
          <Badge className="text-[10px] px-1.5 py-0 bg-amber-900/50 text-amber-300 border border-amber-700/50">
            OUT OF HOURS
          </Badge>
        )}
      </div>

      {/* Sensor summary */}
      {report.agentType === 'guard'
        ? <GuardSensorSummary report={report} />
        : <RobotSensorSummary report={report} />}

      {/* Decision */}
      {decision && (
        <div className="pt-2 border-t border-slate-700/50 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded ${PRIORITY_STYLES[decision.priority] ?? PRIORITY_STYLES[2]}`}>
              P{decision.priority}
            </span>
            <span className="text-xs font-medium text-slate-200">{ACTION_LABELS[decision.action]}</span>
            <span className="text-xs text-slate-500 ml-auto">{Math.round(decision.confidence * 100)}% confidence</span>
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
      )}
    </div>
  );
};

export default ReportCard;
