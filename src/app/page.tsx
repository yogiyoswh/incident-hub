import { listIncidents, getIncident } from '@/lib/incidents';
import { TopBar } from '@/components/TopBar';
import { PhaseIndicator } from '@/components/PhaseIndicator';
import { BriefingCard } from '@/components/BriefingCard';
import { Timeline } from '@/components/Timeline';
import { Sidebar } from '@/components/Sidebar';
import { SlackThreadInput } from '@/components/SlackThreadInput';

type PageProps = {
  searchParams: Promise<{ id?: string }>;
};

export default async function Home({ searchParams }: PageProps) {
  const { id } = await searchParams;

  const incidents = await listIncidents();

  if (incidents.length === 0) {
    return (
      <main className="min-h-screen bg-bg-primary text-text-primary flex items-center justify-center p-8">
        <div className="w-full max-w-2xl">
          <p className="font-mono text-text-muted text-sm mb-4 text-center">
            Slack 스레드 URL로 AI 브리핑을 생성하세요
          </p>
          <SlackThreadInput />
        </div>
      </main>
    );
  }

  const currentId = id ?? incidents[0].id;
  const incident = (await getIncident(currentId)) ?? incidents[0];

  const elapsedMinutes = Math.floor(
    (Date.now() - new Date(incident.createdAt).getTime()) / 60_000,
  );

  return (
    <main className="min-h-screen bg-bg-primary text-text-primary">
      <TopBar
        incidents={incidents.map((i) => ({ id: i.id, title: i.title, status: i.status }))}
        currentId={incident.id}
        elapsed={elapsedMinutes}
        responders={incident.responders}
      />

      <div className="flex" style={{ minHeight: 'calc(100vh - 56px)' }}>
        <div className="flex-1 p-8">
          <details className="mb-6 group">
            <summary className="cursor-pointer text-xs font-mono text-text-muted hover:text-text-secondary list-none flex items-center gap-1">
              <span className="group-open:hidden">▶</span>
              <span className="hidden group-open:inline">▼</span>
              새 브리핑 생성 (Slack 스레드 URL)
            </summary>
            <div className="mt-3">
              <SlackThreadInput />
            </div>
          </details>

          <PhaseIndicator
            status={incident.status}
            hasBriefing={!!incident.briefing.detection}
            hasTimeline={incident.timeline.length > 0}
          />
          <BriefingCard briefing={incident.briefing} />
          <Timeline incidentId={incident.id} initialItems={incident.timeline} />
        </div>

        <Sidebar
          impact={incident.impact}
          responders={incident.responders}
          jiraTicketId={incident.jiraTicketId}
          slackChannel={incident.slackChannel}
        />
      </div>
    </main>
  );
}
