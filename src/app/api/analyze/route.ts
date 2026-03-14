import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import type { ApiResponse, Incident, IncidentSeverity, SlackMessage } from '@/types/incident';
import { generateBriefing, generateTimeline } from '@/lib/claude';
import { saveIncident } from '@/lib/incidents';
import { logger } from '@/lib/logger';

type AnalyzeRequest = {
  slackChannel: string;
  jiraTicketId?: string;
  incidentTitle: string;
  severity: IncidentSeverity;
  messages: SlackMessage[];
};

export async function POST(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<{ incidentId: string }>>> {
  try {
    const body = (await request.json()) as AnalyzeRequest;
    const { slackChannel, jiraTicketId, incidentTitle, severity, messages } = body;

    if (!slackChannel || !incidentTitle || !severity || !messages?.length) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    logger.info('analyze start', { slackChannel, incidentTitle });

    const [briefingResult, timelineResult] = await Promise.all([
      generateBriefing(messages, slackChannel),
      generateTimeline(messages),
    ]);

    const now = new Date().toISOString();
    const incidentId = `INC-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;

    const incident: Incident = {
      id: incidentId,
      title: incidentTitle,
      severity,
      status: 'open',
      slackChannel,
      ...(jiraTicketId && { jiraTicketId }),
      createdAt: now,
      updatedAt: now,
      briefing: {
        ...briefingResult,
        generatedAt: now,
        sourceChannel: slackChannel,
      },
      timeline: timelineResult.items.map((item) => ({
        id: randomUUID(),
        time: item.time,
        tag: item.tag,
        actor: item.actor,
        content: item.content,
        source: 'slack' as const,
      })),
      responders: [],
    };

    await saveIncident(incident);
    logger.info('analyze complete', { incidentId });

    return NextResponse.json({ success: true, data: { incidentId } });
  } catch (err) {
    logger.error('analyze error', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
