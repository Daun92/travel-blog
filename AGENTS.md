# AGENTS.md - 멀티 에이전트 협업 레지스트리

## 모듈 경계 레지스트리

| 모듈 | 스코프 | 주요 파일 | Owner |
|------|--------|-----------|-------|
| generator | 콘텐츠 생성 | `src/generator/` | - |
| factcheck | 사실 검증 + 자동 수정 | `src/factcheck/` | - |
| quality | 품질 게이트 | `src/quality/` | - |
| enhancer | 드래프트 향상 | `src/agents/draft-enhancer/` | - |
| moltbook | 피드백 루프 + 큐 + 서베이 | `src/agents/moltbook/` | - |
| aeo | FAQ/Schema.org | `src/aeo/` | - |
| workflow | 파이프라인 오케스트레이터 | `src/workflow/` | - |
| images | 이미지 생성/관리 | `src/images/` | - |
| monitoring | 성과 모니터링 | `src/monitoring/` | - |
| cli | CLI 래퍼 (commands/) | `src/cli/commands/` | - |
| config | 설정 파일 | `config/` | - |
| scripts | 자동화 스크립트 | `scripts/` | - |
| scheduler | Windows Task Scheduler | `scheduler/` | - |
| data | 런타임 상태 데이터 | `data/` | - |

## 공유 상태 파일 쓰기 규칙

| 데이터 파일 | 허용 Writer | 비고 |
|-------------|-------------|------|
| `data/moltbook-share-state.json` | moltbook 모듈, `scripts/moltbook-auto-share.mts` | ShareQueue 상태 |
| `config/content-strategy.json` | moltbook StrategyAdjuster | 피드백 기반 전략 |
| `data/monitoring/performance.json` | monitoring 모듈 | 성과 데이터 |
| `data/discovery-cache.json` | moltbook topic-discovery | 주제 발굴 캐시 |
| `data/survey-insights-db.json` | moltbook survey-insights-db | 서베이 누적 DB |
| `data/feedback/share-records.json` | moltbook MoltbookShareAgent | Moltbook 공유 기록 |
| `data/feedback/survey-result.json` | moltbook survey-scheduler | 서베이 수집 결과 |
| `data/human-review-queue.json` | factcheck, workflow | 사람 검토 큐 |
| `data/gemini-usage.json` | generator | API 사용량 추적 |
| `config/topic-queue.json` | cli queue 명령, pipeline | 주제 큐 |
| `data/factcheck-fixes/` | factcheck auto-fixer | 자동 수정 결과 |

**원칙**: 하나의 데이터 파일에는 하나의 Writer만 (1-writer rule). 읽기는 자유.

## 모듈 의존성 맵

A → B = A가 B를 import. 수정 시 B를 먼저 수정해야 A가 깨지지 않음.

```
cli/commands → workflow, factcheck, quality, aeo, images, generator,
               moltbook, draft-enhancer, monitoring, events
workflow     → factcheck, quality, aeo, images, draft-enhancer, moltbook
generator    → images, draft-enhancer
quality      → factcheck
aeo          → generator
images       → generator
draft-enhancer → generator
monitoring   → moltbook
scripts      → images, generator, moltbook, moltbook/share-queue
factcheck    → quality/human-review
moltbook     → (독립 — 외부 import 없음)
events       → (독립 — 외부 import 없음)
```

**병렬 안전 조합** (서로 import 관계 없음):
- moltbook + factcheck + images + events + monitoring
- aeo + factcheck (둘 다 generator를 읽기만 함)
- scripts + quality (겹치지 않음)

**순차 필수 조합** (import 방향 준수):
- generator 변경 → aeo, images, draft-enhancer 확인 필요
- factcheck 변경 → quality, workflow 확인 필요
- moltbook 변경 → monitoring, workflow, scripts 확인 필요

## Active Work Log

현재 작업 중인 에이전트 세션:

| 에이전트 | 작업 내용 | 시작 | 상태 |
|----------|-----------|------|------|
| (없음) | - | - | - |

## Recently Completed

| 에이전트 | 작업 내용 | 완료일 | 변경 파일 |
|----------|-----------|--------|-----------|
| Claude Opus 4.6 | 코드 정렬 + 협업 프레임워크 구축 | 2026-02-07 | .gitignore, .gitattributes, data/*.json, AGENTS.md, CONVENTIONS.md, CLAUDE.md |

## 작업 시작 체크리스트

새로운 에이전트 세션을 시작할 때:

1. `AGENTS.md` Active Work Log에 자신의 작업 등록
2. `git status` 확인 — 충돌 가능한 미커밋 파일 확인
3. `npm run build` 통과 확인
4. 작업 대상 모듈의 경계 확인 (위 레지스트리 참조)

## 작업 완료 체크리스트

1. `npm run build` 통과 확인
2. 변경한 모듈과 관련된 공유 상태 파일 정합성 확인
3. `AGENTS.md` Active Work Log 업데이트 → Recently Completed로 이동
4. 새로운 모듈이나 export를 추가했으면 레지스트리 업데이트
