import type { Briefing } from '@/types/incident';

type BriefingCardProps = {
  briefing: Briefing;
};

function Section({
  label,
  content,
  accent,
}: {
  label: string;
  content: string;
  accent: string;
}) {
  return (
    <div className="bg-bg-secondary rounded-lg p-4 border border-border-base">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-1 h-4 rounded-full" style={{ backgroundColor: accent }} />
        <span className="text-xs font-mono text-text-secondary uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-sm text-text-primary leading-relaxed">{content}</p>
    </div>
  );
}

export function BriefingCard({ briefing }: BriefingCardProps) {
  const generatedAt = new Date(briefing.generatedAt).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });

  return (
    <div className="mb-6">
      <div
        className="h-1 rounded-t-lg"
        style={{ background: 'linear-gradient(90deg, #ef4444, #f59e0b)' }}
      />
      <div className="bg-bg-card border border-t-0 border-border-base rounded-b-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs font-mono px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded">
            AI Generated
          </span>
          <span className="text-xs font-mono text-text-muted">{generatedAt} UTC</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Section label="인지 방법" content={briefing.detection} accent="#3b82f6" />
          <Section label="고객 관점" content={briefing.customerImpact} accent="#ef4444" />
          <Section label="운영 관점" content={briefing.opsImpact} accent="#f59e0b" />
        </div>
      </div>
    </div>
  );
}
