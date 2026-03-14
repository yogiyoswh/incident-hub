import { spawn } from 'child_process';
import type {
  SlackMessage,
  BriefingPromptResult,
  TimelinePromptResult,
} from '@/types/incident';
import { logger } from '@/lib/logger';

function callClaude(prompt: string, allowedTools?: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = ['-p', prompt];
    if (allowedTools?.length) {
      args.push('--allowedTools', allowedTools.join(','));
    }

    const proc = spawn('claude', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    proc.stdin.end();

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error('claude CLI timeout (120s)'));
    }, 120_000);

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        // 응답에서 JSON 객체 부분만 추출 (bkit 리포트 등 불필요한 텍스트 제거)
        const jsonMatch = stdout.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          reject(new Error(`JSON을 찾을 수 없음. 응답: ${stdout.slice(0, 200)}`));
          return;
        }
        resolve(jsonMatch[0]);
      } else {
        reject(new Error(`claude CLI 실패 (exit ${code}): ${stderr || stdout}`));
      }
    });
  });
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

  const prompt = `${BRIEFING_SYSTEM_PROMPT}\n\n${JSON.stringify(messages)}`;
  const text = await callClaude(prompt);
  const result = JSON.parse(text) as BriefingPromptResult;
  logger.info('generateBriefing done', { channelId });
  return result;
}

export async function generateTimeline(
  messages: SlackMessage[],
): Promise<TimelinePromptResult> {
  logger.info('generateTimeline start', { messageCount: messages.length });

  const prompt = `${TIMELINE_SYSTEM_PROMPT}\n\n${JSON.stringify(messages)}`;
  const text = await callClaude(prompt);
  const result = JSON.parse(text) as TimelinePromptResult;
  logger.info('generateTimeline done', { itemCount: result.items.length });
  return result;
}

const SLACK_THREAD_PROMPT = (slackThreadUrl: string) => `당신은 장애 대응 전문가입니다.

지금 즉시 mcp__mcpyo__slack_collect_channel_messages 도구를 호출하여 아래 URL의 메시지를 가져오세요.
- 스레드 URL(/p로 끝나는 경우): thread_ts 파라미터도 함께 전달
- 채널 URL: after_date를 30일 전으로 설정하여 충분한 메시지 수집

URL: ${slackThreadUrl}

반드시 아래 JSON 형식으로만 응답하세요. JSON 외 다른 텍스트는 절대 포함하지 마세요.

{
  "briefing": {
    "detection": "인지 방법 (2~3문장)",
    "customerImpact": "고객 관점 현상 (2~3문장)",
    "opsImpact": "서비스 운영 관점 현상 (2~3문장)"
  },
  "timeline": {
    "items": [
      {
        "datetime": "YYYY-MM-DD HH:MM (메시지의 datetime 필드 그대로)",
        "time": "HH:MM",
        "tag": "ACTION|DECISION|HYPOTHESIS|VERIFY|RESULT",
        "actor": "행위자 display_name",
        "content": "메시지에 실제로 쓰여진 내용만 요약. 추측/해석 금지.",
        "sourceUrl": "https://[workspace].slack.com/archives/[channelId]/p[ts에서 점 제거]"
      }
    ]
  }
}

규칙:
- content는 메시지에 명시된 사실만 기술. 추측, 해석, 없는 내용 추가 절대 금지.
- datetime은 mcpyo가 반환한 메시지의 datetime 필드 값을 그대로 사용
- sourceUrl은 해당 메시지의 ts 값에서 점(.)을 제거하고 p를 앞에 붙여 permalink 생성
  예) ts=1773391681.097519 → p1773391681097519
- 한국어로 작성
- channel_join, channel_leave 등 시스템 메시지는 타임라인에서 제외
- 장애와 직접 관련 없는 메시지는 제외
- 시간 순서 정렬`;

export type SlackThreadAnalysisResult = {
  briefing: BriefingPromptResult;
  timeline: TimelinePromptResult;
};

export async function analyzeSlackThread(
  slackThreadUrl: string,
): Promise<SlackThreadAnalysisResult> {
  logger.info('analyzeSlackThread start', { slackThreadUrl });

  const text = await callClaude(SLACK_THREAD_PROMPT(slackThreadUrl), [
    'mcp__mcpyo__slack_collect_channel_messages',
  ]);

  const result = JSON.parse(text) as { briefing: BriefingPromptResult; timeline: TimelinePromptResult };
  logger.info('analyzeSlackThread done', { slackThreadUrl });
  return result;
}
