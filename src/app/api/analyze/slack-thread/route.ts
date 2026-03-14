import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import type {
  ApiResponse,
  Incident,
  SlackThreadBriefingRequest,
  SlackThreadBriefingResponse,
} from '@/types/incident';
import { analyzeSlackThread } from '@/lib/claude';
import { saveIncident } from '@/lib/incidents';
import { logger } from '@/lib/logger';

export async function POST(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<SlackThreadBriefingResponse>>> {
  try {
    const body = (await request.json()) as SlackThreadBriefingRequest;
    const { slackThreadUrl, severity = 'medium' } = body;

    if (!slackThreadUrl) {
      return NextResponse.json(
        { success: false, error: 'slackThreadUrl이 필요합니다' },
        { status: 400 },
      );
    }

    if (!/slack\.com\/archives\/[A-Z0-9]+/.test(slackThreadUrl)) {
      return NextResponse.json(
        { success: false, error: 'Slack URL 형식이 아닙니다 (예: https://...slack.com/archives/...)' },
        { status: 400 },
      );
    }

    logger.info('slack-thread analyze start', { slackThreadUrl });

    const { briefing, timeline } = await analyzeSlackThread(slackThreadUrl);

    const now = new Date().toISOString();
    const incidentId = `INC-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;

    const incident: Incident = {
      id: incidentId,
      title: briefing.detection.slice(0, 60),
      severity,
      status: 'open',
      slackChannel: slackThreadUrl,
      createdAt: now,
      updatedAt: now,
      briefing: {
        ...briefing,
        generatedAt: now,
        sourceChannel: slackThreadUrl,
      },
      timeline: timeline.items.map((item) => ({
        id: randomUUID(),
        time: item.time,
        datetime: item.datetime,
        tag: item.tag,
        actor: item.actor,
        content: item.content,
        source: 'slack' as const,
        sourceUrl: item.sourceUrl,
      })),
      responders: [],
    };

    await saveIncident(incident);
    logger.info('slack-thread analyze done', { incidentId });

    return NextResponse.json({
      success: true,
      data: { incidentId, messageCount: timeline.items.length },
    });
  } catch (err) {
    logger.error('slack-thread analyze error', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
