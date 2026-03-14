# Plan: incident-channel-monitor

## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | incident-channel-monitor |
| 시작일 | 2026-03-14 |
| 목표 완료 | 2026-03-21 |
| 기간 | ~1주 |

### Value Delivered (4-Perspective)

| 관점 | 내용 |
|------|------|
| **Problem** | 장애 대응 채널에서 실시간으로 오가는 메시지를 수동으로 확인해 대시보드에 반영해야 하는 마찰이 높다 |
| **Solution** | 장애 대응 Slack 채널을 대시보드에 연결하면 1분마다 새 메시지를 자동 수집해 타임라인에 반영한다 |
| **Function UX Effect** | 채널 URL 입력 한 번으로 비동기 폴링 활성화; 새 메시지가 타임라인으로 자동 추가되어 대시보드가 살아있는 상태를 유지 |
| **Core Value** | 장애 대응 중 컨텍스트 스위칭 제거 — 채널 확인 없이 대시보드 하나로 전체 상황 파악 가능 |

---

## 1. 개요

### 1.1 배경 및 목적

현재 인시던트 대시보드는 최초 브리핑 생성 이후 정적이다. 장애 대응이 진행되는 동안 Slack 채널에서 오가는 중요한 메시지(조치 결과, 원인 분석, 의사결정 등)는 대시보드에 반영되지 않아, 상황을 파악하려면 채널을 직접 확인해야 한다.

**목적**: 인시던트 생성 후 대시보드에서 장애대응 Slack 채널을 연결하고, 1분마다 비동기로 새 메시지를 수집해 타임라인 및 브리핑을 자동 업데이트하는 기능을 추가한다.

### 1.2 범위 (Scope)

**포함 (In-Scope)**:
- 대시보드 UI: 장애대응 채널 연결 입력 폼 (Slack 채널 URL 또는 채널 ID)
- 채널 저장: `Incident.slackChannel`에 연결된 채널 ID 저장
- 채널 연결 API: `POST /api/incidents/[id]/slack-channel`
- 메시지 동기화 API: `GET /api/incidents/[id]/slack-channel/sync`
  - 채널의 신규 메시지 수집 (`conversations.history` 사용)
  - 신규 메시지를 AI로 분석해 타임라인 항목 생성
  - 인시던트 타임라인에 추가
- 클라이언트 폴링: 60초 간격으로 sync API 호출 (React `useEffect` + `setInterval`)
- 폴링 상태 표시: 마지막 동기화 시각, 활성/비활성 상태 표시

**제외 (Out-of-Scope)**:
- WebSocket / SSE 기반 실시간 스트리밍 (폴링으로 충분)
- 채널 메시지 기반 브리핑 전체 재생성 (타임라인 추가만)
- 여러 채널 동시 연결 (채널 1개만)
- 메시지 삭제/수정 동기화

---

## 2. 요구사항

### 2.1 기능 요구사항 (FR)

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-01 | 대시보드에서 Slack 채널 URL 또는 채널 ID를 입력해 장애대응 채널을 연결할 수 있다 | Must |
| FR-02 | `POST /api/incidents/[id]/slack-channel`로 채널 ID를 인시던트에 저장한다 | Must |
| FR-03 | `GET /api/incidents/[id]/slack-channel/sync`로 채널의 신규 메시지를 수집하고 타임라인에 추가한다 | Must |
| FR-04 | 클라이언트에서 60초 간격으로 sync API를 비동기 호출해 대시보드를 자동 업데이트한다 | Must |
| FR-05 | 마지막 동기화 시각과 폴링 활성 상태를 UI에 표시한다 | Should |
| FR-06 | 채널 연결 해제 기능을 제공한다 (채널 ID 초기화) | Could |
| FR-07 | 잘못된 채널 URL/ID 입력 시 명확한 에러 메시지를 표시한다 | Should |

### 2.2 비기능 요구사항 (NFR)

| ID | 요구사항 | 기준 |
|----|---------|------|
| NFR-01 | 폴링 간격 | 60초 고정 (브라우저 탭 비활성화 시에도 유지) |
| NFR-02 | 중복 타임라인 방지 | `ts` 기준 신규 메시지만 추가 (마지막 수집 ts 저장) |
| NFR-03 | 타입 안전성 | TypeScript strict mode, `any` 금지 |
| NFR-04 | Slack 토큰 보안 | 서버 환경 변수로만 관리, 클라이언트 미노출 |

---

## 3. 기술 접근법

### 3.1 채널 URL 파싱

Slack 채널 URL 형식:
```
https://{workspace}.slack.com/archives/{channelId}
```

채널 ID만 입력하는 경우도 허용:
```
C04AB12XYZ  →  그대로 사용
```

### 3.2 API 설계

#### 채널 연결
```
POST /api/incidents/[id]/slack-channel
Body: { channelId: string }
Response: { success: true, data: { channelId: string } }
```

#### 채널 동기화 (폴링 대상)
```
GET /api/incidents/[id]/slack-channel/sync
Query: { since?: string }  // ISO 8601, 없으면 최근 1시간
Response: {
  success: true,
  data: {
    newItems: TimelineItem[]
    latestTs: string  // 다음 폴링의 since로 사용
    messageCount: number
  }
}
```

### 3.3 신규 메시지 → 타임라인 변환

- `conversations.history(channel, oldest)` API로 `since` 이후 메시지 수집
- 수집된 메시지를 Claude로 분석해 `TimelineItem[]` 생성
  - 기존 `generateTimeline()` 패턴 재사용 (src/lib/claude.ts)
- 생성된 아이템을 인시던트 타임라인에 append

### 3.4 클라이언트 폴링 아키텍처

```
SlackChannelMonitor (Client Component)
  ├── 마운트 시: 채널 연결 여부 확인
  ├── 채널 연결된 경우: setInterval(60_000) 시작
  ├── 60초마다: GET /api/incidents/[id]/slack-channel/sync 호출
  ├── 신규 아이템 있으면: router.refresh() 또는 상태 업데이트
  └── 언마운트 시: clearInterval
```

`Timeline` 컴포넌트는 현재 Server Component이므로, 클라이언트 폴링 후 `router.refresh()`를 호출해 전체 페이지 데이터를 재검증하는 방식 사용 (Next.js App Router 패턴).

### 3.5 중복 방지 전략

- 인시던트에 `slackChannelLastSyncTs: string` 필드 추가
- sync API에서 `oldest = lastSyncTs` 로 설정해 이후 메시지만 수집
- 동기화 성공 시 `lastSyncTs` 업데이트

---

## 4. 파일 변경 계획

### 신규 파일

| 파일 | 역할 |
|------|------|
| `src/app/api/incidents/[id]/slack-channel/route.ts` | 채널 연결 POST API |
| `src/app/api/incidents/[id]/slack-channel/sync/route.ts` | 채널 동기화 GET API |
| `src/components/SlackChannelMonitor.tsx` | 채널 연결 UI + 폴링 Client Component |

### 기존 파일 변경

| 파일 | 변경 내용 |
|------|---------|
| `src/types/incident.ts` | `Incident`에 `slackChannelLastSyncTs?: string` 추가; `SlackChannelConnectRequest` 타입 추가 |
| `src/lib/incidents.ts` | `updateSlackChannel()`, `appendTimelineItems()` 함수 추가 |
| `src/lib/slack.ts` | `fetchChannelMessages(channelId, since)` 함수 추가 |
| `src/components/Sidebar.tsx` | `SlackChannelMonitor` 컴포넌트 통합 (연동 도구 섹션) |
| `src/app/page.tsx` | `incidentId` prop을 `SlackChannelMonitor`에 전달 |

---

## 5. 승인 기준 (Acceptance Criteria)

- [ ] 대시보드에서 Slack 채널 URL 또는 채널 ID를 입력해 연결 가능
- [ ] 연결 후 60초마다 자동으로 채널 동기화 (폴링)
- [ ] 신규 메시지가 타임라인에 자동 추가됨
- [ ] 마지막 동기화 시각이 UI에 표시됨
- [ ] 중복 타임라인 항목 없음 (같은 메시지 두 번 추가 안 됨)
- [ ] 잘못된 채널 입력 시 에러 메시지 표시
- [ ] `pnpm typecheck` 통과

---

## 6. 의존성

- 기존 `SLACK_BOT_TOKEN` 환경 변수 (slack-thread-briefing에서 이미 설정)
- 기존 `src/lib/slack.ts` — `fetchChannelMessages` 함수 추가 필요
- 기존 `src/lib/claude.ts` — `generateTimeline()` 재사용 (신규 메시지 분석용)
- Next.js `router.refresh()` (App Router 클라이언트 갱신 패턴)
