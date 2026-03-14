# Plan: IncidentHub Dashboard

> **버전**: v1.0
> **작성일**: 2026-03-14
> **작성자**: Plan Plus (bkit)
> **상태**: Plan 완료 → `/pdca design incident-hub-dashboard` 다음 단계

---

## Executive Summary

| 항목 | 내용 |
|------|------|
| 프로젝트 | IncidentHub Dashboard |
| 단계 | Plan |
| 작성일 | 2026-03-14 |
| V1 목표 | Auto Briefing + Live Timeline 구현 |
| 아키텍처 | Next.js + MCP(Slack/Jira) + Claude API |

### Value Delivered (4관점)

| 관점 | 내용 |
|------|------|
| **Problem** | Slack·Zoom·Jira에 흩어진 장애 정보로 Situational Awareness 부재, 인지 과부하, 합류자 온보딩 비용 발생 |
| **Solution** | AI가 각 도구에서 사실/결정/행동을 자동 수집해 브리핑 → 타임라인으로 단일 화면에 구조화 |
| **Function UX Effect** | 장애 인지 즉시 1페이지 브리핑 고정 → 분 단위 타임라인 자동 생성 → 합류자 5분 이내 컨텍스트 파악 |
| **Core Value** | 장애 대응의 Single Source of Truth — 도구를 대체하지 않고 허브로서 정보를 응집 |

---

## 1. 사용자 의도 분석 (Intent Discovery)

### 핵심 문제

| 병목 | 현상 | 측정 가능한 손실 |
|------|------|-----------------|
| A. 정보 파편화 | Slack 스레드/Zoom 구두 결정/Jira 사후 기록이 분리 | "지금의 정답"이 사람 머릿속에만 존재 |
| B. 컨텍스트 스위칭 | 조치하면서 동시에 상황 공유/질문 답변 | 조치 속도 저하 + 커뮤니케이션 누락 |
| C. 합류자 온보딩 | 새 투입 인원이 현황 파악에 시간 소요 | 합류 늦을수록 전체 대응 효율 급락 |

### 타깃 사용자

- **Primary**: 인시던트 대응 엔지니어 (On-call, 코드/설정 조치 담당)
- **Secondary**: 중간 합류자 (맥락 파악이 필요한 PO, CS, 관련 팀)
- **Tertiary**: 인시던트 리더 (전체 상황 조율)

### 성공 기준 (V1)

- [ ] Slack 채널 입력 → 2분 이내 AI 브리핑 생성
- [ ] 브리핑 3-section (인지 방법 / 고객 관점 / 운영 관점) 구조화
- [ ] 타임라인 항목 ACTION/DECISION/HYPOTHESIS/VERIFY/RESULT 5가지 태그 자동 분류
- [ ] 합류자가 대시보드만 열면 5분 이내 현황 파악 가능

---

## 2. 제품 포지셔닝

```
Slack / Zoom / Jira   ←  기존 도구 (대체 불가)
         |
         | AI가 자동으로 "사실/결정/행동" 추출
         ↓
   IncidentHub          ← Single Source of Truth
   (중앙 허브 대시보드)
         |
    ┌────┴────┐
  브리핑    타임라인
```

---

## 3. V1 범위 (YAGNI 검토 결과)

### V1 포함 ✅

| 기능 | 설명 |
|------|------|
| **Auto Briefing** | Slack 스레드 → AI 분석 → 3-section 브리핑 (인지/고객/운영) |
| **Live Timeline** | 메시지 자동 수집 → ACTION/DECISION/HYPOTHESIS/VERIFY/RESULT 분류 |
| **대시보드 UI** | 목업 기반 다크 테마, 기능 중심 구현 |

### V2 미룸 ⏸️

| 기능 | 사유 |
|------|------|
| Auto Wrap-up (Jira 초안 + Slack 공지) | V1 검증 후 추가 |
| Zoom 회의록 연동 | Zoom API 복잡도 높음 |
| Grafana/Datadog 알림 자동 인지 | 외부 연동 범위 확장 |
| 다중 인시던트 동시 관리 | V1은 단일 인시던트 집중 |

---

## 4. 아키텍처 (Architecture)

### 선택된 접근법: Claude Code + MCP + Next.js

```
사용자 (로컬 Claude Code CLI)
         │
         │ /incident start [slack-channel] [jira-id]
         ↓
  ┌──────────────────────────────────┐
  │         Claude Code              │
  │  ┌─────────┐  ┌──────────────┐  │
  │  │ Slack   │  │   Jira MCP   │  │
  │  │  MCP    │  │  (선택적)    │  │
  │  └────┬────┘  └──────┬───────┘  │
  │       └──────┬────────┘          │
  │         Claude AI                │
  │      (브리핑/타임라인 생성)      │
  └──────────────┬───────────────────┘
                 │ JSON 저장
                 ↓
         data/incidents/*.json
                 │
                 ↓
    ┌─────────────────────────┐
    │    Next.js Dashboard    │
    │    (파일 읽기 + 표시)   │
    └─────────────────────────┘
```

### 기술 스택

| 레이어 | 기술 |
|--------|------|
| Frontend | Next.js App Router + TypeScript + Tailwind CSS |
| AI Engine | Claude Code (로컬) + Anthropic SDK |
| Data Connector | Slack MCP (`mcp__mcpyo__slack_*`) + Jira MCP |
| Data Store | 로컬 JSON 파일 (`data/incidents/`) |
| 패키지 매니저 | pnpm |

### 데이터 흐름

```
1. 인시던트 시작
   입력: Slack 채널 ID + (선택) Jira 티켓 ID
   출력: data/incidents/{id}.json 생성

2. AI 브리핑 생성
   입력: Slack 메시지 배열
   Claude API 프롬프트 → 3-section 구조 추출
   출력: briefing { detection, customer, ops }

3. 타임라인 업데이트
   입력: 신규 Slack 메시지
   Claude API 프롬프트 → 태그 분류 + 핵심 내용 추출
   출력: timeline[] 항목 추가

4. 대시보드 표시
   Next.js API Route: GET /api/incidents/[id]
   파일 읽기 → JSON 반환 → UI 렌더링
```

---

## 5. 데이터 스키마 (초안)

```typescript
type IncidentSeverity = 'critical' | 'high' | 'medium' | 'low';
type IncidentStatus = 'open' | 'investigating' | 'resolved' | 'closed';
type TimelineTag = 'ACTION' | 'DECISION' | 'HYPOTHESIS' | 'VERIFY' | 'RESULT';

type Incident = {
  id: string;                    // "INC-2026-0147"
  title: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  slackChannel: string;
  jiraTicketId?: string;
  createdAt: string;             // UTC ISO 8601
  updatedAt: string;
  briefing: Briefing;
  timeline: TimelineItem[];
  responders: Responder[];
  impact?: ImpactSummary;
};

type Briefing = {
  detection: string;             // 인지 방법
  customerImpact: string;        // 고객 관점 현상
  opsImpact: string;             // 운영 관점 현상
  generatedAt: string;
  sourceChannel: string;
};

type TimelineItem = {
  id: string;
  time: string;                  // UTC ISO 8601
  tag: TimelineTag;
  actor: string;
  content: string;
  source: 'slack' | 'zoom' | 'manual';
};
```

---

## 6. UI 설계 (목업 기반)

### 목업 위치
`/Users/a202205052/Downloads/장애대응_중앙허브_대시보드_목업.html`

### 주요 컴포넌트

| 컴포넌트 | 설명 |
|----------|------|
| TopBar | 로고, 인시던트 셀렉터, LIVE 뱃지, 경과 시간, 대응 인원 아바타 |
| PhaseIndicator | 3단계 진행바 (AI 브리핑 생성 → 실시간 타임라인 → 마무리 리포트) |
| BriefingCard | 3-column 그리드 (인지/고객/운영), AI Generated 뱃지 |
| Timeline | 세로 타임라인, 도트 색상별 태그, 출처 표시 |
| Sidebar | 영향도 요약, 대응 인원, 연동 도구, AI 산출물 버튼 |

### 디자인 시스템

```css
--bg-primary: #0a0e17    /* 메인 배경 */
--bg-card:    #1a2035    /* 카드 배경 */
Font: JetBrains Mono (코드/수치) + Noto Sans KR (본문)
```

---

## 7. 프로젝트 구조 (예상)

```
src/
  app/
    page.tsx                    # 대시보드 메인
    api/
      incidents/
        [id]/route.ts           # GET 인시던트 데이터
      analyze/route.ts          # POST AI 분석 트리거
  components/
    TopBar.tsx
    PhaseIndicator.tsx
    BriefingCard.tsx
    Timeline.tsx
    Sidebar.tsx
  lib/
    claude.ts                   # Anthropic SDK 래퍼
    slack.ts                    # Slack MCP 유틸
    incidents.ts                # 인시던트 CRUD
  types/
    incident.ts                 # 공통 타입 정의
data/
  incidents/                    # 인시던트 JSON 파일 저장
```

---

## 8. 구현 순서 (V1)

```
1단계: 프로젝트 초기화
   → pnpm create next-app + 목업 HTML을 Next.js 컴포넌트로 변환

2단계: 데이터 레이어
   → types/incident.ts 정의
   → data/incidents/ JSON 파일 구조 구현

3단계: AI 브리핑
   → Slack MCP로 메시지 수집
   → Claude API로 3-section 브리핑 생성

4단계: 타임라인
   → 메시지별 태그 자동 분류
   → 실시간 업데이트 (polling or 수동 갱신)

5단계: 대시보드 UI
   → 목업 기반 컴포넌트 구현
   → API Route 연결
```

---

## 9. 대안 탐색 기록 (Alternatives Explored)

| 접근법 | 결정 | 사유 |
|--------|------|------|
| 수동 붙여넣기 방식 | ❌ 미채택 | MCP 연동이 더 자연스러운 워크플로우 |
| Next.js API Route에서 Claude API 직접 호출 | ✅ 채택 가능 (하이브리드) | V2에서 검토 |
| Claude Code CLI만으로 처리 | ✅ V1 채택 | 빠른 구현, 별도 서버 불필요 |
| 실시간 AI 스트리밍 | ❌ 미채택 | 온디맨드로 비용 예측 가능 |

---

## 10. 다음 단계

```
완료: /plan-plus incident-hub-dashboard ✅

다음: /pdca design incident-hub-dashboard
  → API 스키마 상세 설계
  → Claude 프롬프트 설계
  → 컴포넌트 구조 확정
```
