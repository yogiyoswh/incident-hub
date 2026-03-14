# Design: incident-channel-monitor

> Plan 참조: `docs/01-plan/features/incident-channel-monitor.plan.md`

---

## 1. 아키텍처 개요

### 1.1 핵심 발견: Timeline 컴포넌트의 기존 폴링

`Timeline.tsx`가 이미 `'use client'` 컴포넌트로서 **30초마다** `/api/incidents/[id]`를 호출해 타임라인을 갱신한다.

```
[SlackChannelMonitor]  ──60초마다──▶  POST /api/.../slack-channel/sync
                                              │
                                              ▼
                                       Claude CLI 실행
                                       (mcp__mcpyo__slack_collect_channel_messages)
                                              │
                                              ▼
                                       Incident 파일 업데이트 (timeline append)
                                              │
[Timeline] ──30초마다──▶  GET /api/incidents/[id] ──▶ 갱신된 timeline 표시
```

**결론**: 별도의 타임라인 리렌더 로직 불필요. `SlackChannelMonitor`가 60초마다 sync를 서버에 요청하면, `Timeline`이 30초 이내에 새 항목을 자동으로 표시한다.

### 1.2 전체 데이터 흐름

```
사용자: Slack 채널 URL/ID 입력
    │
    ▼
POST /api/incidents/[id]/slack-channel
    │  channelId 저장 → Incident.slackChannel 업데이트
    ▼
SlackChannelMonitor: setInterval(60_000) 시작
    │
    ▼ (매 60초)
POST /api/incidents/[id]/slack-channel/sync
    │  Claude CLI → mcp__mcpyo__slack_collect_channel_messages
    │  (channel_id + after_date = slackChannelLastSyncTs)
    │  → 신규 메시지 → generateChannelTimeline()
    │  → appendTimelineItems() → Incident 파일 저장
    │  → slackChannelLastSyncTs 업데이트
    ▼
GET /api/incidents/[id]  (Timeline의 기존 30초 폴링)
    │
    ▼
Timeline: 새 항목 표시
```

---

## 2. 타입 변경

### 2.1 `src/types/incident.ts`

```typescript
// 기존 Incident 타입에 필드 추가
export type Incident = {
  // ... 기존 필드 유지 ...
  slackChannel: string;
  slackChannelLastSyncTs?: string;  // 추가: 마지막 동기화 ISO 8601
  // ...
};

// 추가 타입
export type SlackChannelSyncResult = {
  newItemCount: number;
  latestTs: string | null;
};
```

**변경 최소화**: `slackChannel`은 기존 필드. `slackChannelLastSyncTs`만 신규 추가.

---

## 3. 신규 파일

### 3.1 `src/app/api/incidents/[id]/slack-channel/route.ts`

```typescript
// POST: 채널 연결
// body: { channelId: string }
// → updateIncident(id, { slackChannel: channelId })
// → 200 { success: true, data: { channelId } }

// DELETE: 채널 연결 해제
// → updateIncident(id, { slackChannel: '', slackChannelLastSyncTs: undefined })
// → 200 { success: true }
```

**파싱 규칙** (채널 URL → 채널 ID):
```
https://{workspace}.slack.com/archives/{channelId}  → channelId
C04AB12XYZ  → 그대로 사용
```
정규식: `/\/archives\/([A-Z0-9]+)/` 또는 `/^[A-Z0-9]{9,11}$/`

### 3.2 `src/app/api/incidents/[id]/slack-channel/sync/route.ts`

```typescript
// POST: 채널 동기화 트리거
// → incident.slackChannel이 없으면 400
// → generateChannelTimeline(channelId, lastSyncTs) 호출
// → appendTimelineItems(id, newItems) 호출
// → updateIncident(id, { slackChannelLastSyncTs: latestTs }) 호출
// → 200 { success: true, data: SlackChannelSyncResult }
```

### 3.3 `src/components/SlackChannelMonitor.tsx`

**역할**: 채널 연결 UI + 60초 폴링 트리거 (Client Component)

**Props**:
```typescript
type Props = {
  incidentId: string;
  slackChannel: string;         // 현재 연결된 채널 ID (빈 문자열이면 미연결)
  lastSyncTs?: string;          // 마지막 동기화 시각
};
```

**UI 상태 전환**:
```
[미연결 상태]
  ┌─────────────────────────────────┐
  │ 장애대응 채널 연결               │
  │ [채널 URL 또는 ID 입력____] [연결] │
  └─────────────────────────────────┘

[연결 후 상태]
  ┌─────────────────────────────────┐
  │ ● 모니터링 중: #incident-20260314 │
  │ 마지막 동기화: 방금 전            │
  │                       [연결 해제] │
  └─────────────────────────────────┘
```

**폴링 로직**:
```typescript
useEffect(() => {
  if (!channelId) return;        // 미연결 시 폴링 없음
  const run = () => {
    fetch(`/api/incidents/${incidentId}/slack-channel/sync`, { method: 'POST' })
      .then(() => setLastSyncDisplay(new Date()))
      .catch(() => {});           // 폴링 실패 시 무시
  };
  run();                          // 연결 즉시 1회 실행
  const id = setInterval(run, 60_000);
  return () => clearInterval(id);
}, [incidentId, channelId]);
```

---

## 4. 기존 파일 변경

### 4.1 `src/lib/claude.ts` — `generateChannelTimeline()` 추가

기존 `analyzeSlackThread`와 동일한 패턴. `callClaude()` 재사용.

**프롬프트 설계**:
```
CHANNEL_SYNC_PROMPT(channelId, since):
  mcp__mcpyo__slack_collect_channel_messages 도구로
  channel_id={channelId}, after_date={since} 메시지 수집 후
  타임라인 JSON 반환 (TIMELINE_SYSTEM_PROMPT 규칙 적용)
```

**반환 타입**: `TimelinePromptResult` (기존 타입 재사용)

**추가 함수 시그니처**:
```typescript
export async function generateChannelTimeline(
  channelId: string,
  since: string,  // ISO 8601 또는 Slack ts
): Promise<TimelinePromptResult>
```

### 4.2 `src/lib/incidents.ts` — `appendTimelineItems()` 추가

```typescript
export async function appendTimelineItems(
  id: string,
  newItems: TimelineItem[],
): Promise<Incident>
// 기존 타임라인에 newItems append
// id 중복 방지: item.id (UUID 생성) 또는 item.datetime 기준
```

### 4.3 `src/components/Sidebar.tsx`

```typescript
// Props 변경
type SidebarProps = {
  impact?: ImpactSummary;
  responders: Responder[];
  jiraTicketId?: string;
  incidentId: string;           // 추가
  slackChannel: string;
  slackChannelLastSyncTs?: string;  // 추가
};

// 연동 도구 섹션: 기존 slackChannel 텍스트 → SlackChannelMonitor 컴포넌트로 교체
```

### 4.4 `src/app/page.tsx`

```typescript
// Sidebar에 추가 props 전달
<Sidebar
  impact={incident.impact}
  responders={incident.responders}
  jiraTicketId={incident.jiraTicketId}
  incidentId={incident.id}                          // 추가
  slackChannel={incident.slackChannel}
  slackChannelLastSyncTs={incident.slackChannelLastSyncTs}  // 추가
/>
```

---

## 5. 중복 방지 전략

타임라인 항목 중복 추가를 막기 위해:

1. `slackChannelLastSyncTs` 업데이트: sync 성공 시 가장 최신 메시지의 datetime을 저장
2. 다음 sync 요청 시 `since = slackChannelLastSyncTs` 로 `after_date` 설정
3. `appendTimelineItems` 내부에서 `item.datetime` 기준 중복 체크 (이미 있는 datetime이면 skip)

---

## 6. 에러 처리

| 상황 | 처리 |
|------|------|
| 채널 ID 없이 sync 요청 | 400 반환, 폴링 중단 |
| Claude CLI 타임아웃 | sync API 500 반환, 클라이언트 다음 주기에 재시도 |
| 메시지 없음 (신규 없음) | `newItemCount: 0` 반환, `lastSyncTs` 업데이트, 정상 처리 |
| 잘못된 채널 URL 형식 | 연결 버튼 클릭 시 즉시 UI 에러 표시 |
| `SLACK_BOT_TOKEN` 미설정 | Claude CLI 실패 → sync API 500 반환 |

---

## 7. 구현 순서

1. **타입 변경** `src/types/incident.ts` — `slackChannelLastSyncTs` 추가
2. **incidents.ts** — `appendTimelineItems()` 추가
3. **claude.ts** — `generateChannelTimeline()` 추가
4. **채널 연결 API** `src/app/api/incidents/[id]/slack-channel/route.ts`
5. **채널 동기화 API** `src/app/api/incidents/[id]/slack-channel/sync/route.ts`
6. **SlackChannelMonitor 컴포넌트** `src/components/SlackChannelMonitor.tsx`
7. **Sidebar 통합** — props 추가 + SlackChannelMonitor 삽입
8. **page.tsx** — Sidebar에 신규 props 전달

---

## 8. 파일 변경 요약

| 파일 | 변경 종류 | 변경 규모 |
|------|-----------|---------|
| `src/types/incident.ts` | 타입 추가 | 소 (+5줄) |
| `src/lib/incidents.ts` | 함수 추가 | 소 (+15줄) |
| `src/lib/claude.ts` | 함수 추가 | 중 (+30줄) |
| `src/app/api/incidents/[id]/slack-channel/route.ts` | 신규 | 중 (~40줄) |
| `src/app/api/incidents/[id]/slack-channel/sync/route.ts` | 신규 | 중 (~35줄) |
| `src/components/SlackChannelMonitor.tsx` | 신규 | 중 (~80줄) |
| `src/components/Sidebar.tsx` | props + 통합 | 소 (+10줄) |
| `src/app/page.tsx` | props 전달 | 소 (+3줄) |
