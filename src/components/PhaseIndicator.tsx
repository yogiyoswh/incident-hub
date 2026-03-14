import type { IncidentStatus } from '@/types/incident';

type PhaseIndicatorProps = {
  status: IncidentStatus;
  hasBriefing: boolean;
  hasTimeline: boolean;
};

type PhaseState = 'done' | 'active' | 'pending';

function PhaseStep({
  label,
  state,
  index,
}: {
  label: string;
  state: PhaseState;
  index: number;
}) {
  const colors: Record<PhaseState, string> = {
    done: 'bg-green-500 text-white',
    active: 'bg-blue-500 text-white animate-pulse',
    pending: 'bg-bg-card text-text-muted border border-border-base',
  };

  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono ${colors[state]}`}
      >
        {state === 'done' ? '✓' : index}
      </div>
      <span
        className={`text-sm font-mono ${state === 'pending' ? 'text-text-muted' : 'text-text-primary'}`}
      >
        {label}
      </span>
    </div>
  );
}

export function PhaseIndicator({ status, hasBriefing, hasTimeline }: PhaseIndicatorProps) {
  const briefingState: PhaseState = hasBriefing ? 'done' : 'active';
  const timelineState: PhaseState = hasTimeline ? 'done' : hasBriefing ? 'active' : 'pending';
  const reportState: PhaseState = status === 'resolved' || status === 'closed' ? 'done' : 'pending';

  return (
    <div className="flex items-center gap-6 px-4 py-3 bg-bg-card rounded-lg border border-border-base mb-6">
      <PhaseStep label="AI 브리핑 생성" state={briefingState} index={1} />
      <span className="text-text-muted">→</span>
      <PhaseStep label="실시간 타임라인" state={timelineState} index={2} />
      <span className="text-text-muted">→</span>
      <PhaseStep label="마무리 리포트" state={reportState} index={3} />
    </div>
  );
}
