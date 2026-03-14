import { execFile } from 'child_process';
import { promisify } from 'util';
import type {
  SlackMessage,
  BriefingPromptResult,
  TimelinePromptResult,
} from '@/types/incident';
import { logger } from '@/lib/logger';

const execFileAsync = promisify(execFile);

async function callClaude(systemPrompt: string, userContent: string): Promise<string> {
  const fullPrompt = `${systemPrompt}\n\n${userContent}`;
  const { stdout } = await execFileAsync('claude', ['-p', fullPrompt], {
    maxBuffer: 10 * 1024 * 1024,
  });
  return stdout.trim();
}

const BRIEFING_SYSTEM_PROMPT = `당신은 장애 대응 전문가입니다.
Slack 메시지 배열을 분석하여 다음 3가지 관점으로 브리핑을 작성하세요.
반드시 아래 JSON 형식으로만 응답하세요.

{
  "detection": "인지 방법 (어떻게 알게 되었는지, 2~3문장)",
  "customerImpact": "고객 관점 현상 (사용자에게 어떻게 보이는지, 2~3문장)",
  "opsImpact": "서비스 운영 관점 현상 (에러율, 영향 서비스 등, 2~3문장)"
}

규칙:
- 사실만 기술 (추측 금지)
- 각 섹션 2~3문장 이내
- 한국어로 작성`;

const TIMELINE_SYSTEM_PROMPT = `당신은 장애 대응 전문가입니다.
Slack 메시지를 분석하여 타임라인 항목으로 변환하세요.
각 항목은 다음 태그 중 하나로 분류됩니다:

- ACTION: 실제로 수행한 조치
- DECISION: 결정 사항
- HYPOTHESIS: 가설/추측
- VERIFY: 확인/검증 시도
- RESULT: 결과/성과

반드시 아래 JSON 형식으로만 응답하세요:
{
  "items": [
    {
      "time": "HH:MM (메시지 시각)",
      "tag": "ACTION|DECISION|HYPOTHESIS|VERIFY|RESULT",
      "actor": "행위자 이름",
      "content": "핵심 내용 1~2문장"
    }
  ]
}

규칙:
- 중요하지 않은 메시지는 제외
- 시간 순서 정렬
- 한국어로 작성`;

export async function generateBriefing(
  messages: SlackMessage[],
  channelId: string,
): Promise<BriefingPromptResult> {
  logger.info('generateBriefing start', { channelId, messageCount: messages.length });

  const text = await callClaude(BRIEFING_SYSTEM_PROMPT, JSON.stringify(messages));
  const result = JSON.parse(text) as BriefingPromptResult;
  logger.info('generateBriefing done', { channelId });
  return result;
}

export async function generateTimeline(
  messages: SlackMessage[],
): Promise<TimelinePromptResult> {
  logger.info('generateTimeline start', { messageCount: messages.length });

  const text = await callClaude(TIMELINE_SYSTEM_PROMPT, JSON.stringify(messages));
  const result = JSON.parse(text) as TimelinePromptResult;
  logger.info('generateTimeline done', { itemCount: result.items.length });
  return result;
}
