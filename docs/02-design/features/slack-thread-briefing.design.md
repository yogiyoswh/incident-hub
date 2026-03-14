# Design: slack-thread-briefing

> Plan 참조: `docs/01-plan/features/slack-thread-briefing.plan.md`

---

## 1. 아키텍처 개요

### 1.1 데이터 흐름

```
[User] Slack 스레드 URL 입력
    │
    ▼
[SlackThreadInput Component]  ← 'use client'
    │  POST /api/analyze/slack-thread
    │  { slackThreadUrl }
    ▼
[API Route] /api/analyze/slack-thread/route.ts
    │
    ├─ parseSlackThreadUrl(url)  ─→  { channelId, threadTs }
    │
    ├─ fetchThreadMessages(channelId, threadTs)  ─→  SlackMessage[]
    │     (Slack Web API: conversations.replies)
    │
    └─ generateBriefing(messages, channelId)  ─→  BriefingPromptResult
         (기존 src/lib/claude.ts 재사용)
    │
    ▼
Response: { success: true, data: { briefing, messageCount, channelId, threadTs } }
    │
    ▼
[SlackThreadInput] 결과 표시 (BriefingResult 인라인)
```

### 1.2 기존 코드와의 관계

```
src/lib/claude.ts          ← 변경 없음 (generateBriefing 재사용)
src/types/incident.ts      ← SlackThreadBriefingRequest 타입 추가
src/lib/slack.ts           ← 신규: URL 파싱 + Slack API 호출
src/app/api/analyze/
  slack-thread/route.ts    ← 신규: API 엔드포인트
src/components/
  SlackThreadInput.tsx     ← 신규: URL 입력 + 결과 표시 컴포넌트
src/app/page.tsx           ← SlackThreadInput 통합 (빈 상태 + 상단 버튼)
```

---

## 2. 타입 설계

### 2.1 `src/types/incident.ts` 추가 타입

```typescript
// 신규 추가
export type SlackThreadBriefingRequest = {
  slackThreadUrl: string;
};

export type SlackThreadBriefingResponse = {
  briefing: BriefingPromptResult;
  messageCount: number;
  channelId: string;
  threadTs: string;
};

export type ParsedSlackThread = {
  channelId: string;
  threadTs: string;
};
```

---

## 3. `src/lib/slack.ts` 설계

### 3.1 함수 목록

| 함수 | 시그니처 | 역할 |
|------|---------|------|
| `parseSlackThreadUrl` | `(url: string) => ParsedSlackThread` | URL → channelId + threadTs |
| `fetchThreadMessages` | `(channelId: string, threadTs: string) => Promise<SlackMessage[]>` | Slack API 호출 |

### 3.2 `parseSlackThreadUrl` 상세

```
입력: "https://yogiyo.slack.com/archives/C02PJ2TNKKP/p1773390773382349"

패턴: /\/archives\/([A-Z0-9]+)\/p(\d+)/
캡처:
  channelId = "C02PJ2TNKKP"
  rawTs     = "1773390773382349"

threadTs 변환:
  rawTs의 길이 - 6 위치에 '.' 삽입
  "1773390773382349" → "1773390773.382349"

유효성 검사:
  - URL 형식 불일치 → throw Error('올바른 Slack 스레드 URL이 아닙니다')
  - 채널 ID 패턴 불일치 → throw Error
```

### 3.3 `fetchThreadMessages` 상세

```
Slack Web API: GET https://slack.com/api/conversations.replies
Query params:
  channel: channelId
  ts: threadTs
  limit: 100  (스레드 최대 메시지 수 기준)

Headers:
  Authorization: Bearer ${process.env.SLACK_BOT_TOKEN}

응답 매핑 (Slack message → SlackMessage):
  ts:   message.ts
  user: message.user ?? message.username ?? 'unknown'
  text: message.text + (attachments가 있으면 attachment.text 추가)

필터링:
  - text가 빈 문자열이고 attachments도 없는 메시지 제외
  - subtype이 'bot_message'인 메시지는 attachment text만 추출

예외 처리:
  - SLACK_BOT_TOKEN 미설정 → throw Error('SLACK_BOT_TOKEN 환경변수가 설정되지 않았습니다')
  - API ok=false → throw Error(response.error)
  - 메시지 0개 → throw Error('스레드에 메시지가 없습니다')
```

---

## 4. API Route 설계

### 4.1 `src/app/api/analyze/slack-thread/route.ts`

```
POST /api/analyze/slack-thread

Request Body:
  { slackThreadUrl: string }

처리 순서:
  1. body 파싱 및 slackThreadUrl 존재 여부 검증
  2. parseSlackThreadUrl(slackThreadUrl) → { channelId, threadTs }
  3. fetchThreadMessages(channelId, threadTs) → messages[]
  4. generateBriefing(messages, channelId) → briefing
  5. 응답 반환

Success Response (200):
  {
    success: true,
    data: {
      briefing: { detection, customerImpact, opsImpact },
      messageCount: number,
      channelId: string,
      threadTs: string
    }
  }

Error Responses:
  400: slackThreadUrl 누락 또는 URL 파싱 실패
  500: Slack API 실패 또는 Claude 처리 실패

에러 응답 형식: ApiResponse<never> (기존 타입 재사용)
```

---

## 5. UI 컴포넌트 설계

### 5.1 `src/components/SlackThreadInput.tsx`

**종류**: `'use client'` 컴포넌트

**상태 (useState)**:
```typescript
url: string              // 입력된 URL
status: 'idle' | 'loading' | 'success' | 'error'
briefing: BriefingPromptResult | null
error: string | null
messageCount: number
```

**UI 레이아웃**:
```
┌─────────────────────────────────────────────────┐
│  🔗 Slack 스레드 URL로 브리핑 생성               │
│                                                   │
│  [ https://yogiyo.slack.com/archives/...   ] [분석] │
│                                                   │
│  ⚡ URL을 붙여넣으면 AI가 자동으로 장애를 분석합니다  │
└─────────────────────────────────────────────────┘

→ 로딩 중:
┌─────────────────────────────────────────────────┐
│  [●●●] Slack 메시지 수집 중...                   │
└─────────────────────────────────────────────────┘

→ 완료 시: 기존 BriefingCard 컴포넌트 재사용하여 결과 표시
  + "인시던트로 저장" 버튼 (FR-07, optional)
```

**Props**:
```typescript
type SlackThreadInputProps = {
  className?: string;
};
```

**이벤트 처리**:
- form submit → `fetch('/api/analyze/slack-thread', { method: 'POST', body: JSON.stringify({ slackThreadUrl: url }) })`
- Enter 키 제출 지원
- URL 변경 시 기존 결과/에러 초기화

### 5.2 `src/app/page.tsx` 통합

**두 가지 진입점**:

1. **빈 상태** (인시던트 없음): 현재 "인시던트가 없습니다" 텍스트 → `SlackThreadInput` 컴포넌트로 교체

2. **인시던트 있는 상태**: TopBar 하단 또는 메인 영역 상단에 접힌 형태로 `SlackThreadInput` 추가
   - 기본: 접힌 상태 (버튼만 노출 "새 브리핑 생성")
   - 클릭 시: 인라인 확장

---

## 6. 환경 변수

| 변수명 | 필수 | 설명 |
|--------|------|------|
| `SLACK_BOT_TOKEN` | 필수 | Slack Bot User OAuth Token (`xoxb-...`) |

`.env.local` 예시:
```
SLACK_BOT_TOKEN=xoxb-your-token-here
```

---

## 7. 구현 순서

| 순서 | 파일 | 작업 |
|------|------|------|
| 1 | `src/types/incident.ts` | 3개 타입 추가 |
| 2 | `src/lib/slack.ts` | URL 파싱 + API 호출 구현 |
| 3 | `src/app/api/analyze/slack-thread/route.ts` | API 엔드포인트 구현 |
| 4 | `src/components/SlackThreadInput.tsx` | UI 컴포넌트 구현 |
| 5 | `src/app/page.tsx` | 빈 상태 교체 + 기존 화면 통합 |

---

## 8. 엣지 케이스 처리

| 케이스 | 처리 방법 |
|--------|---------|
| 잘못된 URL 형식 | parseSlackThreadUrl에서 throw → API 400 → UI 에러 표시 |
| SLACK_BOT_TOKEN 미설정 | fetchThreadMessages에서 throw → API 500 → UI "서버 설정 오류" |
| 봇이 채널에 없음 | Slack API `channel_not_found` 에러 → UI 안내 메시지 |
| 스레드 메시지 0개 | 수집 후 0개 체크 → API 400 → UI "메시지가 없는 스레드입니다" |
| Claude 파싱 실패 | JSON.parse 예외 → API 500 → UI "브리핑 생성 실패" |
| 네트워크 타임아웃 | Next.js 기본 타임아웃(30s) 활용 |

---

## 9. 승인 기준 매핑

| Plan FR | Design 구현체 |
|---------|-------------|
| FR-01 | `parseSlackThreadUrl()` in `slack.ts` |
| FR-02 | `fetchThreadMessages()` in `slack.ts` |
| FR-03 | `generateBriefing()` in `claude.ts` (재사용) |
| FR-04 | `POST /api/analyze/slack-thread/route.ts` |
| FR-05 | `SlackThreadInput.tsx` + `page.tsx` 통합 |
| FR-06 | 각 함수의 예외 처리 + UI error state |
| FR-07 | `SlackThreadInput`의 "인시던트로 저장" 버튼 (선택) |
