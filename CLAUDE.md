# Incident Monitoring - Claude Code Guide

## 프로젝트 개요

인시던트 모니터링 시스템 - TypeScript + Next.js App Router

## 패키지 관리

- **항상 `pnpm` 사용** (없으면 `npm`)
- 새 패키지 설치: `pnpm add <package>`
- 개발 의존성: `pnpm add -D <package>`

## 개발 순서

1. 변경 사항 작성
2. 타입체크: `pnpm typecheck`
3. 린트: `pnpm lint`
4. 테스트: `pnpm test`
5. 빌드: `pnpm build`

## 프로젝트 구조

```
src/
  app/           # Next.js App Router pages
  components/    # 재사용 가능한 UI 컴포넌트
  lib/           # 유틸리티, 헬퍼 함수
  hooks/         # 커스텀 React hooks
  types/         # 공통 TypeScript 타입 정의
  services/      # 외부 API 연동 서비스
```

## 코딩 컨벤션

- `type` 선호, `interface` 최소화
- `enum` 금지 -> 문자열 리터럴 유니온 사용
- `any` 타입 금지 -> `unknown` 또는 명확한 타입 사용
- 컴포넌트는 named export 사용
- Server Component 기본, 필요시에만 `'use client'`

## 금지 사항

- `console.log` 직접 사용 금지 -> 로거 유틸 사용
- `any` 타입 사용 금지
- `// @ts-ignore` 사용 금지 -> 타입 문제 근본 해결

## 인시던트 도메인 규칙

- 인시던트 심각도: `'critical' | 'high' | 'medium' | 'low'`
- 인시던트 상태: `'open' | 'investigating' | 'resolved' | 'closed'`
- 날짜/시간은 항상 UTC ISO 8601 형식 사용
