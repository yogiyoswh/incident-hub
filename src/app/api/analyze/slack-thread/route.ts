import { NextRequest, NextResponse } from 'next/server';
import type {
  ApiResponse,
  SlackThreadBriefingRequest,
  SlackThreadBriefingResponse,
} from '@/types/incident';
import { parseSlackThreadUrl, fetchThreadMessages } from '@/lib/slack';
import { generateBriefing } from '@/lib/claude';
import { logger } from '@/lib/logger';

export async function POST(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<SlackThreadBriefingResponse>>> {
  try {
    const body = (await request.json()) as SlackThreadBriefingRequest;
    const { slackThreadUrl } = body;

    if (!slackThreadUrl) {
      return NextResponse.json(
        { success: false, error: 'slackThreadUrl이 필요합니다' },
        { status: 400 },
      );
    }

    let channelId: string;
    let threadTs: string;
    try {
      ({ channelId, threadTs } = parseSlackThreadUrl(slackThreadUrl));
    } catch (err) {
      return NextResponse.json(
        { success: false, error: err instanceof Error ? err.message : '올바른 Slack 스레드 URL이 아닙니다' },
        { status: 400 },
      );
    }

    logger.info('slack-thread analyze start', { channelId, threadTs });

    const messages = await fetchThreadMessages(channelId, threadTs);
    const briefing = await generateBriefing(messages, channelId);

    logger.info('slack-thread analyze done', { channelId, messageCount: messages.length });

    return NextResponse.json({
      success: true,
      data: { briefing, messageCount: messages.length, channelId, threadTs },
    });
  } catch (err) {
    logger.error('slack-thread analyze error', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
