import type { ImpactSummary, Responder } from '@/types/incident';

type SidebarProps = {
  impact?: ImpactSummary;
  responders: Responder[];
  jiraTicketId?: string;
  slackChannel: string;
};

const ROLE_LABELS: Record<Responder['role'], string> = {
  LEAD: '리드',
  OWNER: '오너',
  OPS: '운영',
  CS: 'CS',
  DEV: '개발',
};

export function Sidebar({ impact, responders, jiraTicketId, slackChannel }: SidebarProps) {
  return (
    <aside className="w-[380px] border-l border-border-base bg-bg-secondary p-6 flex flex-col gap-6">
      {impact && (
        <section>
          <h3 className="font-mono text-xs text-text-muted uppercase tracking-wider mb-3">
            영향도
          </h3>
          <div className="space-y-2">
            {impact.affectedCount !== undefined && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-text-secondary">영향 건수</span>
                <span className="font-mono text-sm text-text-primary">
                  {impact.affectedCount.toLocaleString()}건
                </span>
              </div>
            )}
            {impact.durationMinutes !== undefined && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-text-secondary">영향 시간</span>
                <span className="font-mono text-sm text-text-primary">
                  {impact.durationMinutes}분
                </span>
              </div>
            )}
            {impact.currentSuccessRate !== undefined && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-text-secondary">현재 성공률</span>
                <span
                  className={`font-mono text-sm ${impact.currentSuccessRate >= 95 ? 'text-green-400' : impact.currentSuccessRate >= 80 ? 'text-yellow-400' : 'text-red-400'}`}
                >
                  {impact.currentSuccessRate}%
                </span>
              </div>
            )}
          </div>
        </section>
      )}

      <section>
        <h3 className="font-mono text-xs text-text-muted uppercase tracking-wider mb-3">
          대응 인원
        </h3>
        <div className="space-y-2">
          {responders.map((r) => (
            <div key={r.name} className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-mono text-white flex-shrink-0"
                style={{ backgroundColor: r.avatarColor }}
              >
                {r.name[0]}
              </div>
              <span className="text-sm text-text-primary">{r.name}</span>
              <span className="ml-auto font-mono text-xs text-text-muted">
                {ROLE_LABELS[r.role]}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="font-mono text-xs text-text-muted uppercase tracking-wider mb-3">
          연동 도구
        </h3>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <span className="font-mono text-xs">Slack</span>
            <span className="font-mono text-xs text-text-muted">{slackChannel}</span>
          </div>
          {jiraTicketId && (
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <span className="font-mono text-xs">Jira</span>
              <span className="font-mono text-xs text-text-muted">{jiraTicketId}</span>
            </div>
          )}
        </div>
      </section>

      <section>
        <h3 className="font-mono text-xs text-text-muted uppercase tracking-wider mb-3">
          AI 자동 산출물
        </h3>
        <div className="space-y-2">
          <button
            disabled
            className="w-full text-left text-sm text-text-muted px-3 py-2 rounded border border-border-base opacity-50 cursor-not-allowed font-mono"
          >
            Jira 티켓 초안 생성 (V2)
          </button>
          <button
            disabled
            className="w-full text-left text-sm text-text-muted px-3 py-2 rounded border border-border-base opacity-50 cursor-not-allowed font-mono"
          >
            Slack 완료 공지 생성 (V2)
          </button>
        </div>
      </section>
    </aside>
  );
}
