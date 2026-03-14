import type { ParsedSlackThread, SlackMessage } from '@/types/incident';
import { logger } from '@/lib/logger';

export function parseSlackThreadUrl(url: string): ParsedSlackThread {
  const match = /\/archives\/([A-Z0-9]+)\/p(\d+)/.exec(url);
  if (!match) {
    throw new Error('올바른 Slack 스레드 URL이 아닙니다');
  }

  const channelId = match[1];
  const rawTs = match[2];
  // "1773390773382349" → "1773390773.382349" (마지막 6자리 앞에 . 삽입)
  const threadTs = `${rawTs.slice(0, -6)}.${rawTs.slice(-6)}`;

  return { channelId, threadTs };
}

type SlackApiMessage = {
  ts: string;
  user?: string;
  username?: string;
  text: string;
  subtype?: string;
  attachments?: Array<{ text?: string }>;
};

type SlackRepliesResponse = {
  ok: boolean;
  messages?: SlackApiMessage[];
  error?: string;
};

export async function fetchThreadMessages(
  channelId: string,
  threadTs: string,
): Promise<SlackMessage[]> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    throw new Error('SLACK_BOT_TOKEN 환경변수가 설정되지 않았습니다');
  }

  logger.info('fetchThreadMessages start', { channelId, threadTs });

  const params = new URLSearchParams({ channel: channelId, ts: threadTs, limit: '100' });
  const res = await fetch(`https://slack.com/api/conversations.replies?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = (await res.json()) as SlackRepliesResponse;

  if (!data.ok) {
    throw new Error(`Slack API 오류: ${data.error ?? 'unknown'}`);
  }

  const messages = data.messages ?? [];

  const mapped: SlackMessage[] = messages
    .map((msg) => {
      const attachmentText = msg.attachments
        ?.map((a) => a.text ?? '')
        .filter(Boolean)
        .join('\n');
      const text = [msg.text, attachmentText].filter(Boolean).join('\n');
      return {
        ts: msg.ts,
        user: msg.user ?? msg.username ?? 'unknown',
        text,
      };
    })
    .filter((msg) => msg.text.length > 0);

  if (mapped.length === 0) {
    throw new Error('스레드에 메시지가 없습니다');
  }

  logger.info('fetchThreadMessages done', { messageCount: mapped.length });
  return mapped;
}
