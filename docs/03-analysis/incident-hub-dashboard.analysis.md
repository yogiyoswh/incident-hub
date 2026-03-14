# Gap Analysis: IncidentHub Dashboard

> **버전**: v1.0
> **작성일**: 2026-03-14
> **단계**: Check (Gap Analysis)
> **참조 Design**: `docs/02-design/features/incident-hub-dashboard.design.md`

---

## 1. 분석 요약

| 항목 | 값 |
|------|-----|
| **Match Rate** | **12.5%** (2/16) |
| **구현 완료** | 2개 파일 |
| **미구현 Gap** | 14개 항목 |
| **현재 단계** | 1단계 (프로젝트 초기화) 완료 |

---

## 2. 구현 현황

### ✅ 구현 완료 (2/16)

| # | 파일 | 내용 | 평가 |
|---|------|------|------|
| 1 | `src/app/layout.tsx` | JetBrains Mono + Noto Sans KR 폰트, metadata | 설계 일치 |
| 2 | `tailwind.config.ts` | 색상 토큰 9종 (`bg-primary` 등), 폰트 CSS 변수 | 설계 일치 |

### 인프라 (기반 파일) — 구현 완료

| 파일 | 상태 |
|------|------|
| `package.json` (Next.js 16.1.6, React 19) | ✅ |
| `tsconfig.json` | ✅ |
| `next.config.ts` | ✅ |
| `postcss.config.mjs` | ✅ |
| `src/app/globals.css` | ✅ |

---

## 3. Gap 목록 (14개)

### 3.1 타입 & 유틸 레이어

| # | 파일 | 설계 요구사항 | 상태 |
|---|------|--------------|------|
| G-01 | `src/types/incident.ts` | Incident, Briefing, TimelineItem, Responder 등 12개 타입 | ❌ 미구현 |
| G-02 | `src/lib/logger.ts` | console.log 대체 로거 유틸 | ❌ 미구현 |

### 3.2 데이터 레이어

| # | 파일 | 설계 요구사항 | 상태 |
|---|------|--------------|------|
| G-03 | `data/incidents/.gitkeep` | 인시던트 JSON 파일 저장소 디렉토리 | ❌ 미구현 |
| G-04 | `src/lib/incidents.ts` | getIncident, listIncidents, saveIncident, updateIncident | ❌ 미구현 |
| G-05 | `data/incidents/INC-2026-0001.json` | 목업 인시던트 데이터 | ❌ 미구현 |

### 3.3 AI 레이어

| # | 파일 | 설계 요구사항 | 상태 |
|---|------|--------------|------|
| G-06 | `src/lib/claude.ts` | generateBriefing, generateTimeline (Anthropic SDK) | ❌ 미구현 |
| G-07 | `src/app/api/analyze/route.ts` | POST /api/analyze — Slack 수집 → Claude 분석 → JSON 저장 | ❌ 미구현 |

### 3.4 API Routes

| # | 파일 | 설계 요구사항 | 상태 |
|---|------|--------------|------|
| G-08 | `src/app/api/incidents/route.ts` | GET /api/incidents — 목록 (updatedAt DESC) | ❌ 미구현 |
| G-09 | `src/app/api/incidents/[id]/route.ts` | GET /api/incidents/[id] — 단건 조회 | ❌ 미구현 |

### 3.5 UI 컴포넌트

| # | 파일 | 설계 요구사항 | 상태 |
|---|------|--------------|------|
| G-10 | `src/components/TopBar.tsx` | use client, 인시던트 셀렉터, LIVE 뱃지, 경과 시간 | ❌ 미구현 |
| G-11 | `src/components/PhaseIndicator.tsx` | Server Component, 3단계 페이즈 표시 | ❌ 미구현 |
| G-12 | `src/components/BriefingCard.tsx` | Server Component, 3-column 그리드 (감지/고객/운영) | ❌ 미구현 |
| G-13 | `src/components/Timeline.tsx` | use client, 30초 폴링, 태그별 도트 색상 | ❌ 미구현 |
| G-14 | `src/components/Sidebar.tsx` | Server Component, 영향도/대응인원/연동도구 | ❌ 미구현 |

### 3.6 페이지 통합

| # | 파일 | 설계 요구사항 | 상태 |
|---|------|--------------|------|
| G-15 | `src/app/page.tsx` | Server Component, ?id URL 파라미터, 컴포넌트 조합 | ❌ 플레이스홀더 |

---

## 4. 구현 우선순위

```
Priority 1 (블로커 해소):
  G-01 types/incident.ts    ← 모든 파일의 기반
  G-02 lib/logger.ts        ← CLAUDE.md 금지 규칙 준수

Priority 2 (데이터 레이어):
  G-03 data/incidents/
  G-04 lib/incidents.ts
  G-05 INC-2026-0001.json

Priority 3 (AI 레이어):
  G-06 lib/claude.ts
  G-07 api/analyze/route.ts

Priority 4 (API Routes):
  G-08 api/incidents/route.ts
  G-09 api/incidents/[id]/route.ts

Priority 5 (UI + 통합):
  G-10~G-14 컴포넌트 5개
  G-15 page.tsx 통합
```

---

## 5. 다음 액션

```
현재 Match Rate: 12.5% — 자동 개선 실행 권장

/pdca iterate incident-hub-dashboard
  → Gap G-01 ~ G-15 순서대로 자동 구현
  → 목표: Match Rate ≥ 90%
```
