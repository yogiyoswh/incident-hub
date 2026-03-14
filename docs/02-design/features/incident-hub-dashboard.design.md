# Design: IncidentHub Dashboard

> **버전**: v1.0
> **작성일**: 2026-03-14
> **작성자**: PDCA Design (bkit)
> **상태**: Design 완료 → `/pdca do incident-hub-dashboard` 다음 단계
> **참조 Plan**: `docs/01-plan/features/incident-hub-dashboard.plan.md`

---

## Executive Summary

| 항목 | 내용 |
|------|------|
| 프로젝트 | IncidentHub Dashboard |
| 단계 | Design |
| 작성일 | 2026-03-14 |
| 구현 범위 | Next.js App Router + Anthropic SDK + Slack MCP + 로컬 JSON 스토어 |
| 핵심 설계 결정 | Claude API on-demand 호출 / 파일 기반 상태 / 5개 컴포넌트 분리 |

### Value Delivered (4관점)

| 관점 | 내용 |
|------|------|
| **Problem** | 흩어진 Slack 메시지에서 구조화된 브리핑·타임라인을 수동으로 만드는 데 시간 낭비 |
| **Solution** | Claude API가 Slack 메시지 배열을 받아 브리핑 3섹션 + 타임라인 태그를 JSON으로 반환 |
| **Function UX Effect** | TopBar·PhaseIndicator·BriefingCard·Timeline·Sidebar 5개 컴포넌트로 단일 화면 구성, 다크 테마 |
| **Core Value** | API Route + 파일 스토어로 서버 없이 로컬에서 완전 동작하는 Single Source of Truth |

---

## 1. 파일/폴더 구조

```
incident-monitoring-claude/
├── src/
│   ├── app/
│   │   ├── page.tsx                        # 대시보드 메인 (Server Component)
│   │   ├── layout.tsx                      # 루트 레이아웃 (폰트 설정)
│   │   └── api/
│   │       ├── incidents/
│   │       │   ├── route.ts                # GET /api/incidents (목록)
│   │       │   └── [id]/
│   │       │       └── route.ts            # GET /api/incidents/[id]
│   │       └── analyze/
│   │           └── route.ts                # POST /api/analyze (AI 분석 트리거)
│   ├── components/
│   │   ├── TopBar.tsx                      # 'use client' - 인시던트 셀렉터 상호작용
│   │   ├── PhaseIndicator.tsx              # Server Component - 현재 페이즈 표시
│   │   ├── BriefingCard.tsx                # Server Component - AI 브리핑 3섹션
│   │   ├── Timeline.tsx                    # 'use client' - 실시간 폴링
│   │   └── Sidebar.tsx                     # Server Component - 영향도/대응인원/연동도구
│   ├── lib/
│   │   ├── claude.ts                       # Anthropic SDK 래퍼 + 프롬프트
│   │   ├── incidents.ts                    # 인시던트 CRUD (파일 I/O)
│   │   └── logger.ts                       # 로거 유틸 (console.log 대체)
│   └── types/
│       └── incident.ts                     # 공통 TypeScript 타입 정의
├── data/
│   └── incidents/                          # 인시던트 JSON 파일 저장소
│       └── .gitkeep
├── docs/
│   ├── 01-plan/features/
│   └── 02-design/features/
└── tailwind.config.ts
```

---

## 2. 타입 정의 (types/incident.ts)

```typescript
// 도메인 타입
type IncidentSeverity = 'critical' | 'high' | 'medium' | 'low';
type IncidentStatus = 'open' | 'investigating' | 'resolved' | 'closed';
type TimelineTag = 'ACTION' | 'DECISION' | 'HYPOTHESIS' | 'VERIFY' | 'RESULT';
type TimelineSource = 'slack' | 'zoom' | 'manual';

type Briefing = {
  detection: string;        // 인지 방법
  customerImpact: string;   // 고객 관점 현상
  opsImpact: string;        // 운영 관점 현상
  generatedAt: string;      // UTC ISO 8601
  sourceChannel: string;    // Slack 채널 ID
};

type TimelineItem = {
  id: string;               // uuid
  time: string;             // UTC ISO 8601
  tag: TimelineTag;
  actor: string;            // Slack 사용자명
  content: string;          // 핵심 내용 요약 (1~2문장)
  source: TimelineSource;
};

type Responder = {
  name: string;
  role: 'LEAD' | 'OWNER' | 'OPS' | 'CS' | 'DEV';
  avatarColor: string;      // hex color
};

type ImpactSummary = {
  affectedCount?: number;   // 영향 건수
  durationMinutes?: number; // 영향 시간 (분)
  currentSuccessRate?: number; // 현재 성공률 (0~100)
};

type Incident = {
  id: string;               // "INC-2026-0147"
  title: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  slackChannel: string;
  jiraTicketId?: string;
  createdAt: string;        // UTC ISO 8601
  updatedAt: string;        // UTC ISO 8601
  briefing: Briefing;
  timeline: TimelineItem[];
  responders: Responder[];
  impact?: ImpactSummary;
};

// API 응답 타입
type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// Claude API 입/출력 타입
type SlackMessage = {
  ts: string;               // Slack timestamp
  user: string;             // 사용자명
  text: string;
};

type BriefingPromptResult = {
  detection: string;
  customerImpact: string;
  opsImpact: string;
};

type TimelinePromptResult = {
  items: Array<{
    time: string;
    tag: TimelineTag;
    actor: string;
    content: string;
  }>;
};
```

---

## 3. API Route 설계

### 3.1 GET /api/incidents

```
Request: -
Response: ApiResponse<Incident[]>
  - data: incidents 배열 (updatedAt DESC 정렬)
  - 파일 없으면 빈 배열 반환
```

### 3.2 GET /api/incidents/[id]

```
Request: path param id (e.g. "INC-2026-0147")
Response: ApiResponse<Incident>
  - 404: { success: false, error: "Incident not found" }
```

### 3.3 POST /api/analyze

```
Request Body:
{
  slackChannel: string,       // Slack 채널 ID (예: "C07ABC123")
  jiraTicketId?: string,      // 선택
  incidentTitle: string,
  severity: IncidentSeverity
}

처리 순서:
1. Slack MCP로 채널 메시지 수집 (최근 200개)
2. Claude API로 브리핑 생성 (generateBriefing)
3. Claude API로 타임라인 생성 (generateTimeline)
4. Incident JSON 파일 저장
5. Incident ID 반환

Response: ApiResponse<{ incidentId: string }>
  - 오류: { success: false, error: string }
```

---

## 4. Claude 프롬프트 설계 (lib/claude.ts)

### 4.1 브리핑 생성 프롬프트

```typescript
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

// 사용자 프롬프트: Slack 메시지 JSON 배열을 전달
```

### 4.2 타임라인 분류 프롬프트

```typescript
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
```

### 4.3 Claude API 호출 함수 시그니처

```typescript
// lib/claude.ts
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic(); // ANTHROPIC_API_KEY 환경변수 자동 사용

async function generateBriefing(
  messages: SlackMessage[],
  channelId: string
): Promise<BriefingPromptResult>

async function generateTimeline(
  messages: SlackMessage[]
): Promise<TimelinePromptResult>
```

---

## 5. 컴포넌트 설계

### 5.1 TopBar (use client)

```typescript
type TopBarProps = {
  incidents: Pick<Incident, 'id' | 'title' | 'status'>[];
  currentId: string;
  elapsed: number; // 분
  responders: Responder[];
};
```

- 인시던트 셀렉터: `<select>` → URL 파라미터 변경 (`?id=INC-2026-0147`)
- LIVE 뱃지: `status === 'open' || 'investigating'`일 때만 표시
- 경과 시간: `createdAt` 기준 계산, 1분 interval 갱신

### 5.2 PhaseIndicator (Server Component)

```typescript
type PhaseIndicatorProps = {
  status: IncidentStatus;
  hasBriefing: boolean;
  hasTimeline: boolean;
};
```

| 페이즈 | 조건 | 상태 |
|--------|------|------|
| ① AI 브리핑 생성 | `hasBriefing` | done/active/pending |
| ② 실시간 타임라인 | `hasTimeline` | done/active/pending |
| ③ 마무리 리포트 | `status === 'resolved'` | done/active/pending |

### 5.3 BriefingCard (Server Component)

```typescript
type BriefingCardProps = {
  briefing: Briefing;
};
```

- 3-column 그리드: 인지방법(파란색) / 고객관점(빨간색) / 운영관점(주황색)
- 상단 `AI Generated` 뱃지 + 생성 시각 표시
- 상단 gradient bar: `linear-gradient(90deg, #ef4444, #f59e0b)`

### 5.4 Timeline (use client)

```typescript
type TimelineProps = {
  incidentId: string;
  initialItems: TimelineItem[];
};
```

- 초기 데이터: SSR에서 전달 (`initialItems`)
- 폴링: 30초 interval로 `GET /api/incidents/[id]` 호출, `timeline` 필드 갱신
- 태그별 도트 색상 매핑:

| 태그 | 색상 |
|------|------|
| ACTION | `#3b82f6` (blue) |
| DECISION | `#a78bfa` (purple) |
| HYPOTHESIS | `#f59e0b` (orange) |
| VERIFY | `#06b6d4` (cyan) |
| RESULT | `#22c55e` (green) |

- 마지막 항목: `current` 스타일 (pulse 애니메이션)

### 5.5 Sidebar (Server Component)

```typescript
type SidebarProps = {
  impact?: ImpactSummary;
  responders: Responder[];
  jiraTicketId?: string;
  slackChannel: string;
};
```

- 영향도 요약: `impact` 있을 때만 렌더링
- AI 자동 산출물 버튼 (V2 scope - disabled 상태로 표시):
  - Jira 티켓 초안 생성
  - Slack 완료 공지 생성

---

## 6. 데이터 레이어 설계 (lib/incidents.ts)

```typescript
// 파일 경로: data/incidents/{id}.json
const DATA_DIR = path.join(process.cwd(), 'data', 'incidents');

async function getIncident(id: string): Promise<Incident | null>
async function listIncidents(): Promise<Incident[]>
async function saveIncident(incident: Incident): Promise<void>
async function updateIncident(id: string, updates: Partial<Incident>): Promise<Incident>
```

- `saveIncident`: JSON.stringify + fs.writeFile (UTF-8)
- `listIncidents`: DATA_DIR glob → 파일 읽기 → `updatedAt` DESC 정렬
- 동시 쓰기 방지: 단일 인시던트 단위 파일 분리로 자연스럽게 회피

---

## 7. 디자인 시스템 (Tailwind 커스텀)

### 색상 토큰 (tailwind.config.ts)

```typescript
colors: {
  'bg-primary': '#0a0e17',
  'bg-secondary': '#111827',
  'bg-card': '#1a2035',
  'bg-card-hover': '#1f2847',
  'border-base': '#2a3454',
  'border-active': '#3b4f7a',
  'text-primary': '#e8ecf4',
  'text-secondary': '#8892a8',
  'text-muted': '#5a6478',
}
```

### 폰트 (layout.tsx)

```typescript
import { JetBrains_Mono, Noto_Sans_KR } from 'next/font/google';
// JetBrains Mono: 코드/수치/태그
// Noto Sans KR: 본문
```

### 레이아웃 구조

```
TopBar (sticky, h-14)
└── Main (grid: 1fr 380px)
    ├── Content (padding: 28px 32px)
    │   ├── PhaseIndicator
    │   ├── BriefingCard
    │   └── Timeline
    └── Sidebar (width: 380px, border-left)
```

---

## 8. 환경 변수 (.env.local)

```bash
ANTHROPIC_API_KEY=sk-ant-...   # Claude API 키 (필수)
```

---

## 9. 구현 순서 (Do 단계 체크리스트)

```
1단계: 프로젝트 초기화 & 기반 설정
  [ ] Next.js 프로젝트 생성 (pnpm create next-app)
  [ ] Tailwind 색상 토큰 설정
  [ ] 폰트 설정 (layout.tsx)
  [ ] types/incident.ts 작성
  [ ] lib/logger.ts 작성

2단계: 데이터 레이어
  [ ] data/incidents/ 디렉토리 + .gitkeep
  [ ] lib/incidents.ts (CRUD 함수)
  [ ] data/incidents/INC-2026-0001.json (목업 데이터)

3단계: AI 레이어
  [ ] pnpm add @anthropic-ai/sdk
  [ ] lib/claude.ts (generateBriefing, generateTimeline)
  [ ] POST /api/analyze route.ts

4단계: API Routes
  [ ] GET /api/incidents route.ts
  [ ] GET /api/incidents/[id] route.ts

5단계: UI 컴포넌트 (목업 HTML → React 변환)
  [ ] TopBar.tsx
  [ ] PhaseIndicator.tsx
  [ ] BriefingCard.tsx
  [ ] Timeline.tsx (use client, 폴링)
  [ ] Sidebar.tsx

6단계: 페이지 통합
  [ ] app/page.tsx (Server Component, 컴포넌트 조합)
  [ ] URL 파라미터 ?id 처리
```

---

## 10. 다음 단계

```
완료: /pdca design incident-hub-dashboard ✅

다음: /pdca do incident-hub-dashboard
  → 위 구현 순서 체크리스트 기반으로 단계별 구현 시작
  → 목업 HTML을 React 컴포넌트로 변환하는 것이 핵심
```
