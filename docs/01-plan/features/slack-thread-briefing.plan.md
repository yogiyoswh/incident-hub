# Plan: slack-thread-briefing

## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | slack-thread-briefing |
| 시작일 | 2026-03-14 |
| 목표 완료 | 2026-03-21 |
| 기간 | ~1주 |

### Value Delivered (4-Perspective)

| 관점 | 내용 |
|------|------|
| **Problem** | 장애 대응 중 Slack 스레드 메시지를 수동으로 복사해 분석 요청해야 하는 마찰 비용이 높다 |
| **Solution** | Slack 스레드 URL 하나만 입력하면 AI가 자동으로 메시지를 수집해 브리핑을 생성한다 |
| **Function UX Effect** | URL 붙여넣기 → 브리핑 생성까지 3클릭 이내로 단축; 장애 인지 직후 즉시 활용 가능 |
| **Core Value** | 장애 초동 대응 속도 향상 — 브리핑 작성 시간을 10분 → 30초로 단축 |

---

## 1. 개요

### 1.1 배경 및 목적

현재 인시던트 모니터링 시스템은 `/api/analyze` 엔드포인트가 `messages` 배열을 클라이언트에서 직접 전달해야 한다. 이는 다음 문제를 야기한다:

- 장애 대응 중 Slack 메시지를 수동으로 복사/가공해야 하는 추가 작업
- 비개발자(PM, CS)가 직접 시스템을 활용하기 어려움
- 스레드 URL이 있는 상황에서 불필요한 중간 단계 존재

**목적**: Slack 스레드 URL을 입력받아 자동으로 메시지를 수집하고 AI 브리핑을 생성하는 엔드포인트 및 UI 플로우를 추가한다.

### 1.2 범위 (Scope)

**포함 (In-Scope)**:
- Slack 스레드 URL 파싱 (채널 ID + 스레드 ts 추출)
- Slack API를 통한 스레드 메시지 수집 (`conversations.replies`)
- 수집된 메시지로 기존 `generateBriefing` 호출
- 신규 API 엔드포인트: `POST /api/analyze/slack-thread`
- 대시보드 UI: URL 입력 폼 + 브리핑 결과 표시

**제외 (Out-of-Scope)**:
- 타임라인 자동 생성 (별도 기능으로 분리, 선택적 확장)
- Slack OAuth 인증 UI (환경 변수로 토큰 관리)
- 비공개 채널 권한 처리 (MVP는 봇이 참여한 채널만 대상)

---

## 2. 요구사항

### 2.1 기능 요구사항 (FR)

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-01 | Slack 스레드 URL을 입력받아 채널 ID와 스레드 ts를 파싱한다 | Must |
| FR-02 | Slack `conversations.replies` API로 스레드 메시지를 수집한다 | Must |
| FR-03 | 수집된 메시지로 기존 `generateBriefing` 함수를 호출해 브리핑을 생성한다 | Must |
| FR-04 | `POST /api/analyze/slack-thread` 엔드포인트를 통해 기능을 노출한다 | Must |
| FR-05 | 대시보드 UI에 URL 입력 → 브리핑 생성 플로우를 제공한다 | Must |
| FR-06 | URL 형식 검증 및 에러 메시지 표시 (잘못된 URL, 빈 스레드, API 실패) | Should |
| FR-07 | 생성된 브리핑을 인시던트로 저장하는 옵션 제공 | Could |

### 2.2 비기능 요구사항 (NFR)

| ID | 요구사항 | 기준 |
|----|---------|------|
| NFR-01 | 브리핑 생성 응답 시간 | ≤ 30초 (Slack API + Claude 처리 포함) |
| NFR-02 | Slack API 토큰 보안 | 서버 환경 변수로만 관리, 클라이언트 미노출 |
| NFR-03 | 타입 안전성 | TypeScript strict mode, `any` 금지 |

---

## 3. 기술 접근법

### 3.1 Slack URL 파싱

Slack 스레드 URL 형식:
```
https://{workspace}.slack.com/archives/{channelId}/p{threadTs}
```

예시:
```
https://yogiyo.slack.com/archives/C02PJ2TNKKP/p1773390773382349
→ channelId: C02PJ2TNKKP
→ threadTs: 1773390773.382349  (p 제거 후 6자리 앞에 . 삽입)
```

### 3.2 신규 API 엔드포인트

```
POST /api/analyze/slack-thread
Body: {
  slackThreadUrl: string       // Slack 스레드 permalink
  severity?: IncidentSeverity  // 기본값: 'medium'
  title?: string               // 기본값: AI가 메시지에서 추론
}
Response: {
  success: true,
  data: {
    briefing: BriefingPromptResult
    messageCount: number
    channelId: string
    threadTs: string
  }
}
```

### 3.3 Slack 메시지 수집

- Slack SDK `@slack/web-api` 또는 직접 API 호출
- 환경 변수: `SLACK_BOT_TOKEN`
- API: `conversations.replies(channel, ts)`
- `SlackMessage` 타입으로 변환 (ts, user, text)

### 3.4 기존 코드 재사용

- `src/lib/claude.ts`: `generateBriefing()` 그대로 활용
- `src/types/incident.ts`: `SlackMessage`, `BriefingPromptResult` 타입 재사용
- 신규 추가: `src/lib/slack.ts` — Slack API 클라이언트 및 URL 파싱 유틸

---

## 4. 파일 변경 계획

### 신규 파일
| 파일 | 역할 |
|------|------|
| `src/lib/slack.ts` | Slack URL 파싱, 메시지 수집 로직 |
| `src/app/api/analyze/slack-thread/route.ts` | 신규 API 엔드포인트 |
| `src/components/SlackThreadInput.tsx` | URL 입력 UI 컴포넌트 |
| `src/components/BriefingResult.tsx` | 브리핑 결과 표시 컴포넌트 |

### 기존 파일 변경
| 파일 | 변경 내용 |
|------|---------|
| `src/types/incident.ts` | `SlackThreadAnalyzeRequest` 타입 추가 |
| `src/app/page.tsx` 또는 dashboard | SlackThreadInput 컴포넌트 통합 |

---

## 5. 승인 기준 (Acceptance Criteria)

- [ ] Slack 스레드 URL 입력 시 메시지 자동 수집 및 브리핑 생성
- [ ] 잘못된 URL 입력 시 명확한 에러 메시지 표시
- [ ] `SLACK_BOT_TOKEN` 미설정 시 서버에서 명확한 에러 반환
- [ ] TypeScript 타입 에러 없음 (`pnpm typecheck` 통과)
- [ ] 빈 스레드(메시지 없음) 케이스 처리

---

## 6. 의존성

- `@slack/web-api` 패키지 추가 필요 (또는 fetch로 직접 호출)
- `SLACK_BOT_TOKEN` 환경 변수 설정 필요
- 기존 `generateBriefing` 함수 (변경 없음)
