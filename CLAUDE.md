# CLAUDE.md

OpenClaw — AI 여행/문화 블로그 자동화 시스템. Gemini API + Hugo + GitHub Pages.

4인 에이전트 필명: **조회영**(viral), **김주말**(friendly), **한교양**(informative), **오덕우**(niche).
목표: 4개월 내 월 1,000 방문자 달성.

## Common Commands

```bash
# 개발
npm run build            # TypeScript → dist/
npm run dev              # Watch mode
npm test                 # Vitest

# 콘텐츠 생성
npm run new -- -t "주제" --type travel --auto-collect --inline-images -y
npm run new -- -t "주제" --type culture --agent informative
npm run collect -- -k "키워드"

# 검증 + 발행
npm run enhance -- -f <file>           # 페르소나 향상
npm run factcheck -- -f <file>         # 팩트체크 (≥70% 필수)
npm run validate -- -f <file>          # 품질+이미지 검증
npm run aeo -- -f <file> --apply       # FAQ/Schema.org
npm run workflow full -- -f <file> --enhance --apply  # 통합
npm run publish                        # Hugo 발행

# 서베이 + 피드백
npm run moltbook:culture-survey        # 서베이 발행
npm run moltbook:survey-scheduler      # 응답 수집
npm run survey ingest                  # 인사이트 적재
npm run queue discover --auto --gaps   # 주제 큐 편성

# 커버 이미지
npm run covers:sample                  # 샘플 커버 재생성
npm run covers:overlay-only            # 관인만 재적용 (API 0)

# 유틸리티
npm run api:usage                      # API 쿼터 확인
npm run hugo:serve                     # 로컬 프리뷰
```

## 5-Phase 발행 파이프라인 (요약)

```
Phase 1(발굴) → Phase 2(생성) → Phase 3(보강) → Phase 4(검증) → Phase 5(발행)
```

각 Phase 상세는 스킬로 호출: `/publish-pipeline`, `/phase3-enhance`, `/factcheck-claude`, `/survey-cycle`, `/post-edit`

## Architecture

```
src/
  api/data-go-kr/       # 공유 API 클라이언트 (KorService2) — docs/api-rules.md 참조
  api/kopis/            # KOPIS 공연 API — docs/api-rules.md 참조
  api/common/           # 8-API 공유 인프라
  agents/collector.ts   # API 데이터 수집
  agents/moltbook/      # 피드백 루프 + 서베이
  agents/draft-enhancer/ # 페르소나 기반 향상
  generator/            # Gemini 콘텐츠 생성
  images/               # 이미지 오케스트레이터 (KTO+Unsplash+Gemini Batch API)
  cli/commands/         # CLI 명령
  factcheck/            # 팩트체크 시스템
  quality/              # 품질 검증
  seo/ aeo/             # SEO/AEO 최적화
config/personas/        # 4인 에이전트 페르소나 (index.json + 개별 JSON)
data/                   # 수집 데이터, 캐시, 피드백, 레지스트리
blog/                   # Hugo (별도 Git — 절대 메인 repo에 stage 금지)
```

## Environment Variables

- `GEMINI_API_KEY` (필수) — 텍스트+이미지 생성
- `LLM_MODEL` — 기본 `gemini-3.0-flash`
- `GEMINI_IMAGE_MODEL` — 기본 `gemini-3.0-pro-preview`
- `GEMINI_BATCH_ENABLED` — 인라인 이미지 Batch API 사용 (`false`로 순차 모드 전환, 기본: 활성)
- `KTO_API_KEY` — 한국관광공사 API
- `KOPIS_API_KEY` — 공연예술통합전산망 (재발급 필요)
- `UNSPLASH_ACCESS_KEY` — 커버 이미지 폴백

## Critical Rules

### 1. Hugo 이미지 경로 — 반드시 baseURL prefix 포함
```markdown
image: "/travel-blog/images/cover-xxx.jpg"    # CORRECT
![alt](/travel-blog/images/kto-slug-1.jpg)     # CORRECT
image: "/images/cover-xxx.jpg"                 # WRONG — 404
```

### 2. TypeScript — 외부 API 응답은 반드시 인터페이스 정의
### 3. Standalone 스크립트 — `import { config } from 'dotenv'; config();` 필수
### 4. Git 구조 — `openclaw/`(메인 repo) + `blog/`(별도 repo). blog/ 절대 메인 staging 금지
### 5. ESM — `"type": "module"`, import에 `.js` 확장자 필수

## 에이전트 시스템

**자동 배정** — 프레이밍 키워드로 결정 (기본값: 김주말):

| 에이전트 | 트리거 키워드 |
|---------|-------------|
| 조회영 (viral) | TOP, BEST, 순위, 비교, 핫플, 트렌드, 필수 |
| 한교양 (informative) | 역사, 건축, 미술사, 해설, 교양, 유네스코 |
| 오덕우 (niche) | 숨은, 로컬, 골목, 현지인, 디깅, 취향, 발견 |
| 김주말 (friendly) | 주말, 당일치기, 가성비, 후기, 코스, 솔직 |

## 절대 하지 말 것 (17개 가드레일)

1. 범용 slug(`post-1`) 사용 금지 — LLM SEO slug로 자동 생성 (`prompts.ts` slug 규칙 참조)
2. author / personaId 누락 금지
3. 프롬프트에 실존 장소/공연명 하드코딩 금지 (`{플레이스홀더}` 사용)
4. LLM 생성 직후 검증 없이 다음 단계 금지 (Phase 3-A 필수)
5. KTO Tier 2(상위 지명) 없이 "KTO 0장" 판정 금지
6. 본문 미언급 장소 이미지를 "같은 지역이니까" 배치 금지
7. 다른 지역 KTO 이미지 배치 금지 (geo-context 검증)
8. 본문 섹션에 맥락 무관 범용 일러스트 사용 금지
9. enhance/factcheck 없이 publish 금지
10. 팩트체크 70% 미만 발행 금지
11. AEO 스킵 금지
12. `[LINK:` / `[IMAGE:` 미처리 마커 잔존 발행 금지
13. `![]()` 경로의 이미지 파일 미존재 발행 금지
14. "AI 생성 ~" 기계적 캡션 금지 → 페르소나 톤 내러티브
15. 다른 페르소나 필명 본문 혼입 금지
16. 주기적 서베이(Phase 1) 생략 금지
17. Moltbook 피드백 루프(Phase 5) 스킵 금지

## 요청 트리아지 프로토콜

모든 작업 요청에 코드 수정 전 자동 분류 수행.

**모듈 의존성**: `cli/commands → workflow, factcheck, quality, aeo, images, generator, moltbook, draft-enhancer` / `generator → images, draft-enhancer` / `moltbook → (독립)`

| 등급 | 조건 | 행동 |
|------|------|------|
| GREEN | 단일 모듈 | 즉시 실행 |
| YELLOW | 2-3개 모듈, 의존 방향 일치 | 1줄 요약 후 실행 |
| RED | 타입 변경, 공유 데이터, 4+개 모듈 | 상세 계획 → 승인 후 실행 |

독립 작업 → Task 병렬 실행. 교차 모듈 → 의존 순서 순차 실행.

## Multi-Agent Collaboration Rules

- 트리아지 수행 후 작업 시작
- `AGENTS.md` Active Work Log 확인 — 동일 모듈 충돌 방지
- 모듈 경계 준수, 타입 append-only, CLI additive
- 데이터 파일 1-writer 원칙
- 커밋 전 `npm run build` 통과 확인

## 상세 레퍼런스 (필요 시 Read 또는 스킬 호출)

| 주제 | 위치 |
|------|------|
| API 규칙 (data.go.kr, KOPIS, 8-API) | `docs/api-rules.md` |
| 5-Phase 파이프라인 상세 | `/publish-pipeline` 스킬 |
| Phase 3 보강 (KTO, 이미지, 검증) | `/phase3-enhance` 스킬 |
| 팩트체크 프로토콜 | `/factcheck-claude` 스킬 |
| 서베이 사이클 | `/survey-cycle` 스킬 |
| 포스트 수정 동기화 | `/post-edit` 스킬 |
| 이미지 시스템 상세 | `phase3-enhance` 스킬 내 `image-matching.md`, `kto-strategy.md` |
| 커버 이미지 시스템 | `src/images/cover-styles.ts`, `cover-overlay.ts` |
| 개발 이력/트러블슈팅 | `WORKLOG.md` |
