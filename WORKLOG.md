# OpenClaw 작업 기록 (Worklog)

## 프로젝트 개요

**프로젝트명:** OpenClaw - AI 기반 여행/문화 블로그 자동화 시스템
**목표:** 월 1,000명 방문자 달성 (4개월 내)
**기술 스택:** TypeScript, Hugo, Gemini API (텍스트/이미지), Unsplash API, Windows Task Scheduler

---

## 개발 이력

### 2026-02-08: 기존 26개 포스트 WebSearch 기반 팩트체크 전수 재검증

#### 배경
품질 게이트 강화(factcheckScore ≥ 70 배포 필수) 이후, 기존 26개 포스트에 factcheckScore를 일괄 부여했으나 **실제 WebSearch 검증 없이 가짜 점수(80~92)를 할당**한 문제 발견. 사용자가 "익선동에 국립현대미술관이 있어?"라고 질문하면서 AI 할루시네이션 문제가 드러남.

#### Phase 1: 익선동 한옥 카페 포스트 (culture/2026-02-07-post.md)

**발견된 AI 할루시네이션:**
- "국립현대미술관 서울 - 익선동 한옥 카페 골목 관련 전시회" → **존재하지 않는 가짜 전시**
- "예술의전당 익선동 한옥 카페 골목 특별전" → **존재하지 않는 가짜 전시**
- MMCA 서울은 삼청로 30(삼청동)에 위치, 익선동과 무관

**수정 내용:**
- MMCA 관련 섹션 전체 삭제 (description, summary, tags, keywords, FAQ, Schema.org, 본문 섹션 2개)
- 섹션 번호 재정렬 (3→2, 4→3, 5→4, 6→5)
- 비용 테이블에서 전시 항목 삭제
- factcheckScore: 85 → 70 → **100** (MMCA 제거 후 남은 8개 클레임 전부 verified)

#### Phase 2: 전체 25개 포스트 병렬 WebSearch 재검증

8개 서브에이전트를 병렬 실행하여 모든 포스트의 주요 클레임을 실검증.

**심각한 AI 할루시네이션 발견 (draft: true 처리):**

| 포스트 | 점수 | 문제 |
|--------|------|------|
| 뮤지컬 BEST 5 | **30** | 5개 중 1개(물랑루즈!)만 실제 공연 중. 오페라의유령/레미제라블/하데스타운/웃는남자 2026년 공연 미확인 |
| 현대무용 3선 | **40** | 묵향=2023년 마지막 공연, 정글=장소 틀림(예술의전당→김포아트홀) |
| 성수동 팝업스토어 | **50** | 메인 추천 무신사 뷰티 페스타가 2025년 8-9월 과거 행사 |

**내용 오류 수정 (3개 포스트):**

| 포스트 | 오류 | 수정 | 점수 |
|--------|------|------|------|
| MMCA 기획전 | 건축가 민현식(오류) | 민현준으로 수정 | 68→**83** |
| | 통합권 10,000원 | 7,000원으로 수정 (2026.3월 인상 예정) | |
| 리움미술관 | Anish Kapoor '큰 나무와 눈' 있다고 기술 | 2023년 철거→에버랜드 이전 사실 반영 | 75→**85** |
| 이색 박물관 | 뮤지엄김치간 20,000원 | **5,000원**으로 수정 (성인 기준) | 55→**82** |

**참고:** 뮤지엄김치간 가격 이력
- 2026-02-05 최초 생성: Gemini가 5,000원으로 생성
- 2026-02-05 수동 팩트체크: 20,000원으로 수정 (오류)
- 2026-02-08 1차 재검증: 무료로 수정 (무료 김치학교 프로그램과 혼동)
- 2026-02-08 최종 확정: **5,000원** (공식 사이트 기준 성인 입장료)

#### Phase 3: 전체 factcheckScore 업데이트

26개 포스트의 factcheckScore를 실검증 결과 기반으로 일괄 재설정.

| 등급 | 포스트 수 | 점수 범위 |
|------|----------|-----------|
| draft: true | 3개 | 30, 40, 50 |
| 배포 가능 | 23개 | 72~100 |
| 양호 (85+) | 12개 | 85~100 |
| 수정 권장 (70-84) | 11개 | 72~83 |

**최종 점수 분포:**
```
100: 익선동 한옥 카페
 92: 통영 인문여행
 90: 북한산, 수원 화성
 88: 대구 근대골목
 87: 제주 카페 7
 85: 강릉, 서울2박3일, 리움, 북촌, 템플스테이, 강추위TOP5
 83: MMCA 기획전
 82: 독립서점, 이색박물관, 전주, 당일치기, 부산맛집
 80: 경주, 파주
 78: 여수, 겨울여행
 72: 오지 TOP 5
 50: 성수동 팝업 (draft)
 40: 현대무용 3선 (draft)
 30: 뮤지컬 BEST 5 (draft)
```

#### 발견된 AI 할루시네이션 패턴

1. **존재하지 않는 전시/공연 날조**: 실제 장소 + 가짜 이벤트 조합 (MMCA 익선동 전시, 예술의전당 특별전)
2. **과거 이벤트를 현재로 제시**: 2025년 행사를 2026년 2월 추천으로 기술 (무신사 뷰티 페스타)
3. **공연/이벤트 일정 허구**: 실존 공연을 잘못된 날짜/장소로 기술 (묵향, 정글)
4. **가격 정보 부정확**: 방향 다양 — 높게(뮤지엄김치간 20K→5K), 낮게(청양 9K→12K), 시의성(MMCA 7K→10K)
5. **철거된 시설 기술**: 2023년 철거된 Anish Kapoor 조각을 있다고 기술

**핵심 교훈:**
- culture 카테고리(특히 시의성 있는 전시/공연)가 travel(영구적 장소)보다 할루시네이션 위험 높음
- 팩트체크 시스템이 추출된 클레임(주소, 가격)은 검증하지만 **섹션 자체의 존재 여부**는 검증 못 함
- WebSearch 기반 실검증이 필수 — 자동 스코어링만으로는 AI 날조 감지 불가

#### 수정된 파일 (26개)

**blog/content/posts/culture/** (9개)
- `2026-02-07-post.md` — MMCA 섹션 전체 삭제, 100점
- `2026-02-07-vs.md` — draft: true, 50점
- `2026-02-07-2-3.md` — draft: true, 40점
- `2026-02-05-2026-best-5.md` — draft: true, 30점
- `2026-02-04-mmca-exhibition.md` — 건축가명+입장료 수정, 83점
- `2026-02-05-post.md` — Kapoor 조각 서술 수정, 85점
- `2026-02-05-seoul-museum.md` — 뮤지엄김치간 5,000원 수정, 82점
- `2026-02-06-post.md` — 80점
- `2026-02-07-7.md` — 82점

**blog/content/posts/travel/** (17개)
- 모든 travel 포스트 factcheckScore 실검증 결과 반영

---

### 2026-02-07 (야간): blog repo main→master 브랜치 전환 유실 분석

#### 배경
blog repo에서 main→master 브랜치 전환 시, master가 main에서 분기(branch)하지 않고 **공통 조상 없이 새로 생성**됨.
결과적으로 main 브랜치의 일부 자산이 master로 이전되지 않았음.

#### 원인 분석
- `52aadec` (master 최초 커밋)이 포스트 5개 + hugo.toml만으로 새 히스토리 시작
- `f706dd5` (master 2번째 커밋)에서 "전체 포스트 복구 및 master 브랜치 동기화" 수행했으나 **불완전**
- `git merge-base main master` → **공통 조상 없음** 확인
- main 브랜치와 stash(`stash@{0}`)는 모두 건재

#### 브랜치 상태 비교

| 항목 | main | master (현재) |
|------|------|---------------|
| 포스트 수 | 7개 | 28개 |
| layouts/ 커스텀 | **없음** | 8개 파일 (404, single, comments, extend_head/footer, related, series-nav, rawhtml) |
| hugo.toml | 초기 설정 | 개선됨 (env=production, giscus, schema, OG, favicon.svg) |
| about.md | **없음** | 있음 (AI 에이전트 소개) |
| og-default.jpg | **없음** | 있음 |
| deploy.yml | **없음** | 있음 |
| 소스코드 (src/) | 있음 (git root 이전 잔재) | **없음** (정상 — openclaw repo에 존재) |
| config/ | 있음 (git root 이전 잔재) | **없음** (정상 — openclaw repo에 존재) |

#### 유실 분류

**A. ~~실제 유실~~ 의도적 삭제 — 포스트 5개 (복구 불필요)**

| 파일 | 제목 | 비고 |
|------|------|------|
| `culture/2026-02-07-2026-ddp-2026.md` | DDP '미래도시 2026' 전시 솔직 후기 | 사용자 확인: 삭제 의도 |
| `culture/2026-02-07-2026-ktx-1.md` | 2026 강릉 KTX 1박 2일 현실 여행기 | 〃 |
| `travel/2026-02-07-1-2-30.md` | 부산 1박 2일, 30만 원 직장인 생존 여행 | 〃 |
| `travel/2026-02-07-1-2-kt.md` | 경주 1박 2일 황리단길 웨이팅+KTX 총정리 | 〃 |
| `travel/2026-02-07-2-3.md` | 제주도 2박 3일 직장인 현실 지출과 동선 | 〃 |

→ main 브랜치에 아카이브로 남아있음. 필요 시 복구 가능.

**B. 정상 분리 (복구 불필요)**
- `src/`, `config/`, `package.json`, `scripts/` 등 소스코드 → openclaw 메인 repo에 정상 존재
- `064722a chore: git root를 openclaw/ 디렉토리로 이전` 이전 구조의 잔재였을 뿐

**C. master에서 새로 추가된 것 (유실 아님)**
- `layouts/` 커스텀 8개 파일 (404, Giscus 댓글, extend_head SEO/JSON-LD, extend_footer 라이트박스/스크롤, 관련포스트, 시리즈)
- 포스트 21개 신규 (3-agent 다양성 포스트, 익선동, 통영, 북한산 등)
- about.md, og-default.jpg, deploy.yml, 이미지 다수

**D. 히어로 섹션 관련**
- main/master 양쪽 모두 `layouts/` 기반 히어로 커스텀 **없음**
- hugo.toml의 `homeInfoParams` + `socialIcons` (github, rss)가 기본 히어로 구성
- 이전에 히어로 섹션을 개선했다면 **커밋되지 않은 로컬 작업이 유실**된 것으로 추정

#### 복구 계획

| 우선순위 | 작업 | 위험도 | 방법 |
|----------|------|--------|------|
| ~~P1~~ | ~~포스트 5개 복구~~ | — | 의도적 삭제 확인. 복구 불필요 |
| ~~P1~~ | ~~복구 포스트 인라인 이미지 확인~~ | — | 상동 |
| P2 | 히어로 섹션 재설계 | YELLOW | `layouts/partials/home_info.html` 커스텀 또는 profileMode 전환 |
| P2 | socialIcons 정리 | GREEN | hugo.toml 수정 (github URL 실제화 또는 제거) |
| P3 | main 브랜치 stash 내용 확인 | GREEN | `git stash show -p stash@{0}` |
| P3 | main 브랜치 아카이브 여부 결정 | GREEN | 사용자 판단 |

#### 교훈
- 브랜치 전환 시 `git merge` 또는 `cherry-pick`으로 히스토리 연결 필수
- 공통 조상 없는 브랜치 전환은 유실 위험 높음 — `--allow-unrelated-histories` 사용 시 주의
- 커스텀 레이아웃, 설정 변경은 반드시 커밋 후 브랜치 전환

---

### 2026-02-07: 5대 핵심 개선사항 구현 (링크/팩트체크/큐잉/리라이트/스케줄러)

#### 개요
평균 54점 저성과 포스트 문제와 운영 안정성 병목 5가지를 해결하는 대규모 개선 작업.
16개 발행 포스트의 품질 향상과 무인 자동화 인프라 안정화가 목표.

#### 개선 1: 링크 프로세서 AI 장소 추출 재설계

**문제점:**
- AI 장소 추출 실패 시 빈 배열 반환 (에러 로깅 없음)
- 한국어 `\b` 워드 바운더리가 CJK에서 미동작 → 부분 매칭 발생
- frontmatter 파싱이 `---\n` 고정 → Windows `\r\n`에서 깨짐

**수정 내용 (`src/generator/link-processor.ts`):**
- gray-matter 기반 frontmatter 파싱 (크로스플랫폼 호환)
- 마커 정규식에 `gi` 플래그 추가 (대소문자 무관 매칭)
- `isValidUrl()` URL 검증 헬퍼 추가
- `processAllLinks()` 에러 격리: 각 단계 try-catch, `errors: string[]` 반환
- AI 추출 재설계: `safeParseJSON()`, `parseAIResponse()` 3단계 파싱, `deduplicatePlaces()`
- `extractPlacesWithAIInternal()` → `AIExtractionResult` 반환 (places, truncated, error)
- 기존 `extractPlacesWithAI()` 래퍼로 유지 (하위호환)
- `isInsideMarkdownLink()` — `[text](url)` 내부 매칭 방지
- `addLinkToPlace()` 재설계: 위치 기반 스캔 (한국어 호환), frontmatter 제외, 2자 미만 스킵
- `enhanceWithLinks()` — `truncated?`, `error?` 필드 추가, 개별 장소 try-catch
- temperature 0.3→0.2, 프롬프트에 중복 금지 규칙 추가

#### 개선 2: 팩트체크 자동 수정 (`--auto-fix`)

**문제점:**
- `FactCheckReport.corrections[]`에 수정 제안 생성되지만 실제 적용 안 됨
- `--auto-fix` 플래그가 미구현 상태

**수정 내용:**

| 파일 | 변경 |
|------|------|
| `src/factcheck/types.ts` | `AppliedCorrection`, `DiffEntry`, `AutoFixReport`, `AutoFixAuditLog` 인터페이스 추가 |
| `src/factcheck/auto-fixer.ts` | **신규** — `applyAutoFix()` 엔진 + `formatDiff()` |
| `src/factcheck/index.ts` | 신규 타입/함수 export |
| `src/cli/commands/factcheck.ts` | `--auto-fix`, `--dry-run` 플래그 추가 |
| `src/workflow/stages.ts` | `autoFix` 옵션 실제 연결 |

**안전 장치:**
- critical 심각도 → 절대 자동 수정 안 함 → `addReviewCase()` 경유
- `--dry-run`: 파일 쓰기 생략, diff만 출력
- 매칭 0회 → 스킵, 매칭 2회+ → 첫 번째만 적용 + 경고
- 감사 로그: `data/factcheck-fixes/{date}-{slug}.json` (before/after 해시 기록)
- 수정 순서: lineNumber 역순 (하단→상단, 오프셋 밀림 방지)

#### 개선 3: Moltbook 배치 공유 큐잉 시스템

**문제점:**
- 우선순위 없는 단순 순차 공유
- 실패 시 재시도 없음
- 경로 구분자 혼재 (`/` vs `\`) → 중복 감지 실패

**수정 내용:**

| 파일 | 변경 |
|------|------|
| `src/agents/moltbook/share-queue.ts` | **신규** — `ShareQueue` 클래스 (~350줄) |
| `scripts/moltbook-auto-share.mts` | ShareQueue 기반 리팩터링 |
| `src/cli/commands/moltbook.ts` | `queue` 액션 + 대시보드 |

**우선순위 점수 (0-100):**
| 요소 | 배점 | 산출 |
|------|------|------|
| 신선도 | 0-30 | 24시간 내 30점, 14일에 걸쳐 0으로 감소 |
| 품질 점수 | 0-30 | quality gates 점수 반영 |
| 카테고리 다양성 | 0-20 | 최근 공유에서 부족한 카테고리 보너스 |
| 서베이 관련성 | 0-20 | survey-insights-db 부스트 반영 |

**재시도:** 지수 백오프 [30, 60, 120, 240, 480분], 최대 5회, 4xx 에러는 재시도 안 함
**경로 정규화:** `normalizePath()` — 모든 경로 `replace(/\\/g, '/')`
**V1→V2 마이그레이션:** 첫 로드 시 자동 변환, 기존 `sharedPosts[]` 보존

#### 개선 4: 저성과 포스트 리라이트 자동화

**대상:** performance.json에서 score ≤ 51점 포스트 (5개: 48~51점)

**수정 내용:**

| 파일 | 변경 |
|------|------|
| `scripts/rewrite-low-performers.mts` | **신규** — 저성과 감지 + 리라이트 파이프라인 (~200줄) |

**파이프라인:** enhance → factcheck --auto-fix → validate → aeo --apply → links --enhance
**CLI:** `--threshold` (기본 51), `--dry-run`, `--file` 옵션
**리포트:** `reports/rewrite-{date}.md` 마크다운 생성 (포스트별 단계 성공/실패 추적)

#### 개선 5: Windows Task Scheduler 연동

**문제점:**
- PM2가 Windows에서 불안정 (리부트 후 수동 재시작 필요)
- 헬스체크/장애 알림 없음

**생성된 파일 구조:**
```
scheduler/
  tasks/
    openclaw-daily-morning.xml        # 매일 06:00 포스트 생성
    openclaw-daily-evening.xml        # 매일 21:00 포스트 생성
    openclaw-moltbook-share.xml       # 30분 간격 (09:00-22:00)
    openclaw-survey-weekly.xml        # 일요일 10:00 서베이
    openclaw-monitor-daily.xml        # 매일 23:00 모니터링
    openclaw-health-check.xml         # 2시간 간격 헬스체크
  scripts/
    run-daily-posts.ps1               # pipeline --schedule
    run-moltbook-share.ps1            # once 모드 공유
    run-survey-collect.ps1            # 서베이 전체 파이프라인
    run-monitor.ps1                   # 성과 모니터링
    health-check.ps1                  # 헬스체크 + Windows Toast 알림
  install.ps1                         # 태스크 등록 (-Force, -NoPM2)
  uninstall.ps1                       # 태스크 제거
  status.ps1                          # 상태 대시보드
```

**주요 설계:**
- `StartWhenAvailable: true` — 부팅 후 놓친 스케줄 자동 실행
- `RunOnlyIfNetworkAvailable: true` — 네트워크 없으면 건너뜀
- `MultipleInstancesPolicy: IgnoreNew` — 중복 실행 방지
- `%PROJECT_DIR%` 플레이스홀더 → install 시 실제 경로 치환
- health-check: Node.js, .env, 로그, 공유 상태, 태스크 등록, 디스크 확인 + Toast 알림

#### 검증 결과

| # | 항목 | 결과 |
|---|------|------|
| 1 | TypeScript 컴파일 (`npx tsc --noEmit`) | ✅ 0 errors |
| 2 | 기존 테스트 (18개) | ✅ 전체 통과 |
| 3 | 하위호환성 (기존 인터페이스 유지) | ✅ |

#### 생성/수정 파일 총괄

**신규 파일 (15개):**
```
src/factcheck/auto-fixer.ts           (~200줄) 자동 수정 엔진
src/agents/moltbook/share-queue.ts    (~350줄) 공유 큐 시스템
scripts/rewrite-low-performers.mts    (~200줄) 저성과 리라이트
scheduler/tasks/*.xml                 (6개) Task Scheduler 정의
scheduler/scripts/*.ps1               (5개) PowerShell 래퍼
scheduler/install.ps1                 태스크 등록
scheduler/uninstall.ps1               태스크 제거
scheduler/status.ps1                  상태 대시보드
```

**수정 파일 (8개):**
```
src/generator/link-processor.ts       링크 프로세서 전면 재설계
src/factcheck/types.ts                4개 인터페이스 추가
src/factcheck/index.ts                신규 export 추가
src/cli/commands/factcheck.ts         --auto-fix, --dry-run 플래그
src/workflow/stages.ts                autoFix 옵션 연결
scripts/moltbook-auto-share.mts       ShareQueue 기반 리팩터링
src/cli/commands/moltbook.ts          queue 액션 추가
package.json                          4개 스크립트 추가
```

#### 추가된 npm 스크립트
```json
"moltbook:queue": "tsx src/cli/index.ts moltbook queue",
"factcheck:fix": "tsx src/cli/index.ts factcheck --auto-fix",
"factcheck:fix:dry": "tsx src/cli/index.ts factcheck --auto-fix --dry-run",
"rewrite:low": "tsx scripts/rewrite-low-performers.mts"
```

#### 교훈
- 한국어(CJK) 텍스트에서 `\b` 워드 바운더리 사용 금지 → 위치 기반 스캔으로 대체
- 파일 경로 정규화는 모든 경로 입출력 지점에서 적용 필수 (Windows `\` ↔ POSIX `/`)
- 자동 수정 시 반드시 역순 적용 (하단→상단) — 오프셋 밀림 방지
- critical 심각도 claims는 자동화 대상에서 무조건 제외 → human review 필수
- Task Scheduler XML에서 `%PROJECT_DIR%` 플레이스홀더 패턴이 이식성에 유리
- V1→V2 마이그레이션은 첫 로드 시 자동 수행이 가장 자연스러움

---

### 2026-02-06 (심야): 서베이 인사이트 DB 구축 및 워크플로우 통합

#### 개요
Moltbook 서베이 결과가 단발성으로 끝나는 문제 해결. 서베이 데이터를 누적 DB로 관리하고, 주제 발굴(topic-discovery) → 큐(topic-queue) → 콘텐츠 생성(daily-posts) 파이프라인에 자동 반영되도록 통합.

#### 구현 내용 (5 Phase)

**Phase 1: 서베이 인사이트 DB 모듈**
- `SurveyInsightsDBManager` 클래스 신규 생성 (~280줄)
- surveyId 기반 중복 방지 (멱등성 보장)
- 부스트 스코어 공식: `min(30, (weightedVotes / maxVotes) * 20 + surveyAppearances * 5)`
- 주제ID → 키워드 매핑 (8개 카테고리)

**Phase 2: CLI 명령어**
- `survey ingest` — survey-result.json → DB 적재
- `survey status` — DB 요약 (인기 주제, 선호 형식, 관심 지역)
- `survey boost` — discovery 스코어 부스트 맵 출력
- `survey apply-strategy` — content-strategy.json 자동 업데이트

**Phase 3: Discovery 파이프라인 통합**
- `TopicRecommendation.source`에 `'survey_demand'` 타입 추가
- `generateRecommendations()`에 surveyBoosts 파라미터 추가
- `discoverEnhanced()`에서 SurveyInsightsDB 자동 로드 및 부스트 적용
- `VotePostScanner`에서 실제 서베이 데이터 로드 시도 추가

**Phase 4: 큐 메타데이터 강화**
- `TopicItem`에 meta 필드 추가 (score, source, surveyRelevance, keywords)
- `queue list`에서 메타 정보 표시 (점수, 소스, 서베이 관련도)
- `daily-posts`에서 서베이 관련도 높은 주제 우선 생성

**Phase 5: 전략 자동 업데이트 & 스케줄러 연동**
- `StrategyAdjuster.adjust()`에서 서베이 추천 자동 머지
- `moltbook-survey-scheduler`에서 saveResult() 후 DB 자동 갱신

#### 버그 발견 및 수정

**레이스 컨디션 (queue discover --auto)**
- **증상**: `autoPopulateQueue`가 파일 저장 후, 외부 `queueCommand`가 구 데이터로 덮어쓰기
- **원인**: `loadQueue()` 시점과 `saveQueue()` 시점 사이에 `autoPopulateQueue`가 별도 저장
- **수정**: `autoPopulateQueue` 완료 후 `loadQueue()`로 최신 데이터 재로드
```typescript
// 수정 전: queue.discovered = result.recommendations; (stale data)
// 수정 후:
const refreshed = await loadQueue();
refreshed.discovered = result.recommendations;
await saveQueue(refreshed);
```

#### 검증 결과 (8개 테스트)

| # | 테스트 | 결과 | 비고 |
|---|--------|------|------|
| 1 | survey ingest 멱등성 | ✅ | 3회 실행 → 1회 적재 + 2회 스킵 |
| 2 | survey status/boost 정확도 | ✅ | 투표수 일치, 부스트 공식 검증 (25/15점) |
| 3 | queue discover 서베이 부스트 | ✅ | 15개 키워드 부스트 적용 확인 |
| 4 | queue list 메타 표시 | ✅ | `(점수:100, gap_analysis)` 형식 출력 |
| 5 | daily preview 우선순위 | ✅ | meta.score 내림차순 정렬 (제주 100 > 벚꽃 0) |
| 6 | apply-strategy 업데이트 | ✅ | 서베이 주제/형식/지역 반영 |
| 7 | 하위 호환성 (DB 삭제) | ✅ | DB 없이 모든 명령어 정상 동작 |
| 8 | TypeScript 컴파일 | ✅ | `npm run build` 클린 통과 |

#### 생성/수정 파일

**신규 파일:**
```
src/agents/moltbook/survey-insights-db.ts   (~280줄) 서베이 인사이트 DB 모듈
src/cli/commands/survey.ts                  (~130줄) CLI 명령어
data/survey-insights-db.json                (런타임 생성) 누적 DB
```

**수정 파일:**
```
src/agents/moltbook/topic-discovery.ts      source 타입 확장, 부스트 로직
src/cli/commands/queue.ts                   메타 필드, 레이스 컨디션 수정
scripts/daily-posts.mts                     서베이 관련도 정렬
src/agents/moltbook/index.ts                StrategyAdjuster 서베이 머지
scripts/moltbook-survey-scheduler.mts       자동 DB 갱신
src/cli/index.ts                            survey 커맨드 등록
package.json                                survey 스크립트 5개 추가
```

#### 추가된 npm 스크립트
```json
"survey": "tsx src/cli/index.ts survey",
"survey:ingest": "tsx src/cli/index.ts survey ingest",
"survey:status": "tsx src/cli/index.ts survey status",
"survey:boost": "tsx src/cli/index.ts survey boost",
"survey:strategy": "tsx src/cli/index.ts survey apply-strategy"
```

#### 교훈
- 파일 기반 큐 시스템에서 **여러 함수가 동일 파일을 읽고 쓰면 레이스 컨디션** 발생
- 해결 패턴: 외부 저장 후 반드시 `reload` → 최신 데이터로 추가 작업
- 서베이 DB는 멱등성이 핵심 — surveyId 기반 중복 체크로 안전한 재실행 보장
- 하위 호환성 테스트 필수 — DB 파일 없어도 모든 기존 워크플로우 동작 확인

---

### 2026-02-06 (야간): 리움미술관 포스트 인라인 이미지 재생성

#### 문제
- 리움미술관 포스트(`2026-02-05-post.md`)의 인라인 이미지가 Gemini API 이슈로 미생성
- Unsplash 외부 URL 4개가 임시로 삽입된 상태
- 기존 로컬 파일(`inline-2026-02-05-post-*.jpeg`)은 **국립중앙박물관** 이미지로 오매칭

#### 해결 과정
1. 전용 이미지 생성 스크립트 작성 (`scripts/regenerate-leeum-images.mts`)
2. Gemini API로 리움미술관 전용 이미지 3개 생성
3. 포스트에서 Unsplash URL 4개 제거 → 로컬 이미지 3개로 교체
4. Hugo 빌드 검증 후 배포

#### 생성된 이미지

| # | 스타일 | 내용 | 배치 위치 |
|---|--------|------|-----------|
| 1 | moodboard | 건축(테라코타/스틸/블랙박스) + 예술 감성 | 도입부 뒤 |
| 2 | diagram | 블랙박스→M1→M2→야외 조각공원 관람 동선 | 컬렉션 섹션 뒤 |
| 3 | infographic | 운영시간, 요금, 교통, 예약 실용 정보 | 실용 정보 섹션 |

#### 생성 파일
```
blog/static/images/
├── inline-leeum-museum-1.jpeg  (무드보드)
├── inline-leeum-museum-2.jpeg  (관람 동선)
└── inline-leeum-museum-3.jpeg  (실용 정보)
```

#### Git 커밋
```
37f831e fix: 리움미술관 포스트 인라인 이미지 재생성 및 교체
```

#### 교훈
- 이미지 생성 실패 시 Unsplash 폴백이 아닌 **재생성** 필요
- 파일명만으로 이미지 내용을 판단하지 말고 **시각적 검증** 필수
- 포스트별 전용 slug 사용(`inline-leeum-museum-*`)이 관리에 유리

---

### 2026-02-06: 포스트카드 커버 이미지 경로 문제 조사

#### 문제 현상
- localhost에서 포스트카드 커버 이미지 404 에러 발생
- 브라우저 콘솔: `GET http://localhost:5315/images/cover-xxx.jpg 404`

#### 원인 분석

**Hugo의 `absURL` 함수 동작 방식:**
- frontmatter `image: /images/xxx.jpg` + `absURL` → `http://host/images/xxx.jpg`
- baseURL의 경로 부분(`/travel-blog`)이 **포함되지 않음**

**올바른 경로:**
- frontmatter에 `/travel-blog/images/xxx.jpg` 형식으로 **전체 경로 명시 필요**
- `absURL`이 host만 붙이고 경로는 그대로 유지

#### 검증된 사항

| 경로 방식 | absURL 결과 | 정상 여부 |
|-----------|-------------|-----------|
| `/images/xxx.jpg` | `http://host/images/xxx.jpg` | ❌ 404 |
| `/travel-blog/images/xxx.jpg` | `http://host/travel-blog/images/xxx.jpg` | ✅ 정상 |

#### 결론
- **현재 방식이 올바름**: frontmatter에 `/travel-blog/images/...` 전체 경로 사용
- PaperMod 테마의 cover.html이 `absURL` 사용하므로 이 방식 유지 필요
- `gemini-imagen.ts`, `new.ts` 등 이미지 경로 생성 코드에서도 `/travel-blog/` prefix 유지

#### 추가 발견
- 사용자가 `localhost:5315`로 접속했으나 Hugo 서버는 `localhost:1315`에서 실행 중
- 포트 불일치로 인한 혼란 가능성 → 올바른 URL 확인 필요

---

### 2026-02-05 (심야 4): 국립중앙박물관 Premium Workflow 발행

#### 워크플로우 실행 결과

| 단계 | 상태 | 결과 |
|------|------|------|
| Enhance 분석 | ✅ | 클리셰 85/100, 디테일 76/100, 페르소나 적합도 70% |
| Factcheck | ✅ | **85% 통과** (기준 70% 이상) |
| AEO 적용 | ✅ | FAQ 5개 + Schema.org 3종 |
| Publish | ✅ | GitHub Pages 배포 완료 |
| Moltbook | ✅ | 커뮤니티 공유 등록 (총 9개) |

#### AEO 요소 (수동 적용)
- **FAQ 5개**: 무료 입장, 야간 개장, 사유의 방 위치, 예약 필요 여부, 주차장
- **Schema.org**: FAQPage, Article, BreadcrumbList

#### 포스트 정보
- **제목**: 국립중앙박물관 완벽 가이드: 필수 관람 코스와 숨은 명품 투어
- **파일**: `blog/content/posts/culture/2026-02-05-post.md`
- **인라인 이미지**: 3장 (무드보드, 여행 가이드, 여정 일러스트)

#### Git 커밋
```
e7ad81e feat: 국립중앙박물관 완벽 가이드 발행 (AEO 포함)
```

#### 배포 URL
- https://daun92.github.io/travel-blog/posts/culture/2026-02-05-post/

---

### 2026-02-05 (심야 3): 2026-02-04 포스트 커버 이미지 포맷 수정

#### 문제
- 황리단길, 부산 해운대 맛집, 2월 겨울 국내여행 등 커버 이미지 미노출

#### 원인
- PaperMod 테마는 `cover:` 중첩 구조만 인식
- 기존 포맷: `image:/imageAlt:/imageCredit:` (플랫)
- 필요 포맷: `cover: { image:, alt:, caption: }` (중첩)

#### 수정된 포스트 (5개)
| 포스트 | 파일명 |
|--------|--------|
| 경주 여행 (황리단길) | 2026-02-04-1.md |
| 2월 겨울 국내여행 | 2026-02-04-2-5.md |
| 부산 해운대 맛집 | 2026-02-04-4.md |
| 서울 북촌한옥마을 | 2026-02-04-seoul-hanok-village.md |
| 국립현대미술관 서울 | 2026-02-04-mmca-exhibition.md |

#### Git 커밋
```
89865dc fix: 2026-02-04 포스트 커버 이미지 포맷 수정 (PaperMod 호환)
```

---

### 2026-02-05 (심야 2): 7개 포스트 인라인 이미지 생성 및 삽입

#### 작업 내용

1. **Gemini AI 인라인 이미지 14개 생성**
   - `scripts/generate-7posts-images.mts` 스크립트 작성
   - Gemini 3.0 Pro Preview API 사용
   - 5초 간격 Rate limit 대응

2. **이미지 삽입 완료 (7개 포스트)**

   | 포스트 | 이미지 1 | 이미지 2 |
   |--------|----------|----------|
   | 대구 여행 | 코스 지도 | 서문시장 먹거리 가이드 |
   | 강릉 카페 | 카페 투어 지도 | 바다뷰 카페 비교 |
   | 서울 박물관 | 박물관 위치 지도 | 5곳 비교 가이드 |
   | 전주 한옥마을 | 당일치기 코스 지도 | 먹거리 가이드 |
   | 여수 밤바다 | 야경 명소 지도 | 여행 정보 인포그래픽 |
   | 제주 카페 | 카페 투어 지도 | 오션뷰 카페 비교 |
   | 2026 뮤지컬 | BEST 5 비교 가이드 | 공연장 지도 |

3. **커버 이미지 교체 (2개)**
   - 국립중앙박물관: 반가사유불상 관련 이미지로 교체
   - 강릉 카페: 오션뷰 카페 이미지로 교체

4. **PaperMod 테마 호환 포맷 수정 (7개 포스트)**
   - `image:/imageAlt:/imageCredit:` → `cover:` 중첩 구조로 변환

#### 생성된 이미지 파일
```
blog/static/images/
├── inline-daegu-course-map.jpeg
├── inline-daegu-food-guide.jpeg
├── inline-gangneung-cafe-map.jpeg
├── inline-gangneung-cafe-compare.jpeg
├── inline-seoul-museum-map.jpeg
├── inline-seoul-museum-compare.jpeg
├── inline-jeonju-course-map.jpeg
├── inline-jeonju-food-guide.jpeg
├── inline-yeosu-night-map.jpeg
├── inline-yeosu-info.jpeg
├── inline-jeju-cafe-map.jpeg
├── inline-jeju-cafe-compare.jpeg
├── inline-musical-guide.jpeg
└── inline-musical-venue-map.jpeg
```

#### Git 커밋
```
a384ab2 feat: 7개 포스트 Gemini AI 인라인 이미지 추가
```

#### 배포
- GitHub Pages 푸시 완료
- URL: https://daun92.github.io/travel-blog

---

### 2026-02-05 (심야): 블로그 이미지 포맷 수정 및 About 페이지 현행화

#### 작업 내용

1. **커버 이미지 포맷 통일 (6개 포스트)**
   - PaperMod 테마 호환 포맷으로 변환
   - `cover:` 중첩 → `image:` 플랫 포맷

   | 포스트 | 상태 |
   |--------|------|
   | 경주 여행 | ✅ 수정 |
   | 겨울 국내여행 | ✅ 수정 |
   | 부산 해운대 맛집 | ✅ 수정 |
   | 북촌한옥마을 | ✅ 수정 |
   | 국립현대미술관 | ✅ 수정 |
   | 국립중앙박물관 | ✅ 수정 |

2. **About 페이지 현행화**
   - AI 엔진: Ollama → Gemini API 반영
   - "주말탈출러" 페르소나 설명 추가
   - 팩트체크 & AEO 시스템 설명 추가
   - AI 에이전트 정체성 투명성 유지

#### 이미지 포맷 변환 예시
```yaml
# 수정 전 (이미지 미표시)
cover:
  image: "/travel-blog/images/xxx.jpg"
  alt: "description"

# 수정 후 (이미지 표시됨)
image: /travel-blog/images/xxx.jpg
imageAlt: description
imageCredit: Photo by...
```

#### About 페이지 핵심 변경
```markdown
# 정체성 (투명성)
"우리는 AI 에이전트입니다"

# 페르소나 (글쓰기 스타일)
"주말탈출러"라는 페르소나로 글을 씁니다.
```

#### Git 커밋
```
67ce5bb fix: 커버 이미지 포맷 통일 (PaperMod 테마 호환)
9c2c88d docs: About 페이지 현행화
b2797f8 fix: About 페이지 AI 에이전트 정체성 복원
```

---

### 2026-02-05 (저녁): Premium Content Workflow 구축 및 팩트체크 오류 수정

#### 작업 내용

1. **Draft Enhancer 에이전트 개발**
   - 페르소나 기반 콘텐츠 향상 시스템
   - 클리셰 자동 감지/대체 (severity: high/medium/low)
   - 디테일 수준 분석 (숫자, 실패담, 비교)

2. **Premium Content Workflow 7단계 프로세스 정립**
   ```
   Generate → Enhance → Factcheck → Quality → AEO → Image → Publish+Moltbook
   ```

3. **발행된 포스트 팩트체크 오류 수정**

   | 포스트 | 오류 내용 | 수정 |
   |--------|----------|------|
   | 서울 이색 박물관 | 뮤지엄김치간 5,000원 | → 20,000원 |
   | | 위치 "안녕인사동 6층" | → "인사동마루 4~6층" |
   | | 이동시간 주장 | → 검증 불가 문구 제거 |
   | 국립중앙박물관 | 경천사 "사층"석탑 | → "십층"석탑 |
   | | 소장품 "30만 점" | → "약 44만 점(2024년 기준)" |
   | | 건축가 최욱 | → "최욱(원오원아키텍스 대표)" |

4. **AEO 일괄 적용 (7개 포스트)**
   - FAQ 5개 + Schema.org 3개 (Article, FAQPage, BreadcrumbList)

5. **Moltbook 공유 시작**
   - 여수 밤바다 포스트 공유 완료
   - Rate limit으로 인해 나머지 포스트 순차 공유 예정

#### 생성된 파일
- `src/agents/draft-enhancer/index.ts` - 메인 에이전트
- `src/agents/draft-enhancer/cliche-filter.ts` - 클리셰 필터
- `src/agents/draft-enhancer/detail-analyzer.ts` - 디테일 분석기
- `src/agents/draft-enhancer/persona-loader.ts` - 페르소나 로더
- `src/cli/commands/enhance.ts` - CLI 명령어
- `config/persona.json` - "주말탈출러" 페르소나 설정

#### 수정된 파일
- `CLAUDE.md` - Premium Workflow 문서화
- `src/cli/index.ts` - enhance 명령어 등록
- `src/cli/commands/workflow.ts` - enhance 단계 통합
- `package.json` - enhance 관련 스크립트 추가
- `blog/content/posts/culture/2026-02-05-seoul-museum.md` - 팩트체크 수정
- `blog/content/posts/culture/2026-02-05-post.md` - 팩트체크 수정

#### 페르소나 설정 (config/persona.json)
```json
{
  "name": "주말탈출러",
  "tagline": "금요일 퇴근 후부터 일요일 저녁까지, 48시간의 가능성",
  "voice": {
    "never_say": ["힐링 여행", "인생샷", "감성 카페", "숨은 명소", ...],
    "signature_phrases": ["퇴근하고 바로 출발하면", "솔직히 다시 갈지는 모르겠지만", ...]
  },
  "detailing_rules": {
    "failure_story_required": true,
    "comparison_required": true
  }
}
```

#### 팩트체크 결과
| 포스트 | 수정 전 | 수정 후 |
|--------|---------|---------|
| 국립중앙박물관 | 60% | **100%** ✅ |
| 서울 이색 박물관 | 16% | 수정 완료 (경험담 위주로 자동검증 한계) |

#### Git 커밋
```
3bc842f docs: Premium Content Workflow 7단계 프로세스 문서화
441ceab fix: 서울 이색 박물관 팩트체크 오류 수정
e96f78e fix: 국립중앙박물관 가이드 팩트체크 오류 수정
bbd002c fix: 국립중앙박물관 정보 정확도 개선
9d87579 fix: 서울 이색 박물관 검증 불가 주장 제거
```

---

### 2026-02-05 (오후): 주간 콘텐츠 생성 및 검증 시스템 개선

#### 작업 내용

1. **주간 블로그 초안 7개 생성**
   - Gemini API (`gemini-3.0-flash`) 사용
   - 기존 발행 콘텐츠와 중복 없이 새로운 지역/주제 선정

2. **검증 로직 버그 수정**
   - 글자수 계산 오류 수정 (`src/quality/gates.ts`)
   - 민감 키워드 오탐 수정 (`src/quality/human-review.ts`)

3. **커버 이미지 7개 추가**
   - Unsplash API 활용
   - 자동화 스크립트 작성 (`scripts/add-cover-images.mts`)

#### 생성된 드래프트

| 파일명 | 카테고리 | 제목 | SEO | Content |
|--------|----------|------|-----|---------|
| `2026-02-05-7.md` | travel | 제주도 감성 카페 베스트 7 | 85% | 94% |
| `2026-02-05-jeonju-hanok.md` | travel | 전주 한옥마을 완벽 가이드 | 95% | 94% |
| `2026-02-05-2026-best-5.md` | culture | 2026 봄 뮤지컬 추천 BEST 5 | 85% | 94% |
| `2026-02-05-gangneung-cafe.md` | travel | 강릉 커피거리 & 안목해변 카페 투어 | 95% | 94% |
| `2026-02-05-daegu-alley.md` | travel | 대구 근대골목 역사 탐방 | 95% | 94% |
| `2026-02-05-seoul-museum.md` | culture | 서울 이색 박물관 베스트 5 | 85% | 94% |
| `2026-02-05-yeosu-night.md` | travel | 여수 밤바다 낭만 여행 | 95% | 94% |

#### 버그 수정 상세

**1. 글자수 계산 오류 (`src/quality/gates.ts:159-170`)**
```typescript
// 수정 전 (버그)
const koreanChars = content.replace(/[^가-힣]/g, '').length;
const wordCount = Math.round(koreanChars / 2);  // 한글만 추출 후 2로 나눔 → 실제의 절반

// 수정 후
const textOnly = content.replace(/[#*\-\[\]()_`~>|]/g, '').replace(/\s+/g, ' ');
const charCount = textOnly.replace(/\s/g, '').length;  // 전체 텍스트 글자수
```
- **영향:** content 점수 64% → 94%로 개선

**2. 민감 키워드 오탐 (`src/quality/human-review.ts:54-63`)**
```typescript
// 수정 전 (오탐 발생)
const SENSITIVE_KEYWORDS = ['문제', '절', '사건', ...];  // 일반 단어 포함

// 수정 후
const SENSITIVE_KEYWORDS = ['정치적 논란', '종교 갈등', '심각한 사고', ...];  // 구체적 표현만
```
- **영향:** "검토 필요" → "통과" 상태로 변경

#### 생성된 파일
- `scripts/gen-jeju-cafe.mts` - 제주 카페 포스트 생성
- `scripts/gen-jeonju.mts` - 전주 한옥마을 포스트 생성
- `scripts/gen-gangneung.mts` - 강릉 카페 포스트 생성
- `scripts/gen-remaining.mts` - 나머지 포스트 일괄 생성
- `scripts/gen-weekly-posts.mts` - 주간 포스트 일괄 생성
- `scripts/add-cover-images.mts` - 커버 이미지 일괄 추가

#### 수정된 파일
- `src/quality/gates.ts` - 글자수 계산 로직 수정
- `src/quality/human-review.ts` - 민감 키워드 목록 수정
- `src/cli/commands/moltbook.ts` - 미사용 case 제거 (빌드 오류 수정)
- `src/aeo/faq-generator.ts` - 타입 오류 수정

#### 추가된 커버 이미지
| 파일명 | 검색어 |
|--------|--------|
| `cover-musical-*.jpg` | musical theater stage |
| `cover-jeju-cafe-*.jpg` | jeju island cafe ocean view |
| `cover-daegu-*.jpg` | korean traditional alley street |
| `cover-gangneung-*.jpg` | gangneung korea beach cafe |
| `cover-jeonju-*.jpg` | jeonju hanok village korea |
| `cover-museum-*.jpg` | seoul museum interior |
| `cover-yeosu-*.jpg` | yeosu night view korea sea |

---

### 2026-02-05: 하이브리드 이미지 시스템 구현

#### 작업 내용
1. **Gemini AI 이미지 생성 모듈 개발**
   - `src/images/gemini-imagen.ts`: Gemini API 클라이언트
   - 일일 사용량 관리 (기본 50장, 경고 80%)
   - 6가지 이미지 스타일 지원

2. **이미지 프롬프트 전략 수립**
   - `src/generator/image-prompts.ts`: 스타일별 프롬프트 템플릿
   - 정보 전달 → 감성적 매력 + 공유 유도로 전환

   | 스타일 | 컨셉 | 용도 |
   |--------|------|------|
   | `infographic` | 여행 다이어리 페이지 | 정보 요약 |
   | `diagram` | 보물지도 여정 | 교통/동선 |
   | `map` | 친구가 그려준 지도 | 코스 안내 |
   | `comparison` | 카페 칠판 메뉴 | 맛집 비교 |
   | `moodboard` | 감성 콜라주 | 분위기 전달 |
   | `bucketlist` | 게이미피케이션 체크리스트 | 경험 목록 |

3. **콘텐츠 파서 개발**
   - `src/generator/content-parser.ts`: 마커 추출/삽입
   - 마커 형식: `[IMAGE:style:description]`
   - 자동 마커 삽입 기능

4. **CLI 옵션 추가**
   ```bash
   npm run new -- -t "주제" --type travel --inline-images --image-count 3
   ```

5. **이미지 경로 문제 해결**
   - Hugo baseURL (`/travel-blog/`) 호환성 수정
   - 모든 이미지 경로: `/travel-blog/images/...`

#### 생성된 파일
- `src/images/gemini-imagen.ts` (신규)
- `src/generator/image-prompts.ts` (신규)
- `src/generator/content-parser.ts` (신규)
- `scripts/add-images.mts` (유틸리티)

#### 수정된 파일
- `src/generator/index.ts` - 이미지 생성 플로우 통합
- `src/generator/prompts.ts` - 이미지 마커 가이드라인
- `src/cli/commands/new.ts` - CLI 옵션
- `src/cli/index.ts` - 명령어 정의
- `.env.example` - 환경변수 추가

---

## 포스팅 현황

### 발행된 포스트 (blog/content/posts/)

| 날짜 | 카테고리 | 제목 | 커버 | 인라인 이미지 |
|------|----------|------|------|---------------|
| 2026-02-04 | travel | 경주 여행 완벽 가이드 | ✓ | 3장 |
| 2026-02-04 | travel | 2월 겨울 국내여행 추천 베스트 5 | ✓ | - |
| 2026-02-04 | travel | 부산 해운대 맛집 베스트 4 | ✓ | - |
| 2026-02-04 | travel | 서울 북촌한옥마을 완벽 가이드 | ✓ | - |
| 2026-02-04 | culture | 국립현대미술관 서울 2026 기획전 | ✓ | 2장 |

### 발행 완료 (blog/content/posts/) - 2026-02-06 업데이트

| 파일명 | 카테고리 | 상태 | 커버 | 인라인 |
|--------|----------|------|------|--------|
| 2026-02-06-post.md | culture | ✔ 발행 | ✓ | 3장 (파주 출판도시/헤이리) |
| 2026-02-05-post.md | culture | ✔ 발행 | ✓ | 3장 (리움미술관 - **재생성**) |
| 2026-02-05-7.md | travel | ✔ 발행 | ✓ | 2장 |
| 2026-02-05-jeonju-hanok.md | travel | ✔ 발행 | ✓ | 2장 |
| 2026-02-05-2026-best-5.md | culture | ✔ 발행 | ✓ | 2장 |
| 2026-02-05-gangneung-cafe.md | travel | ✔ 발행 | ✓ | 2장 |
| 2026-02-05-daegu-alley.md | travel | ✔ 발행 | ✓ | 2장 |
| 2026-02-05-seoul-museum.md | culture | ✔ 발행 | ✓ | 2장 |
| 2026-02-05-yeosu-night.md | travel | ✔ 발행 | ✓ | 2장 |

---

## 이미지 자산

### 생성된 이미지 (blog/static/images/)

#### 2026-02-06 신규 (6장)
| 파일명 | 용도 |
|--------|------|
| inline-2026-02-06-post-1.jpeg | 파주 출판도시/헤이리 무드보드 |
| inline-2026-02-06-post-2.jpeg | 파주 주요 건축물 갤러리 지도 |
| inline-2026-02-06-post-3.jpeg | 파주 갤러리 추천 관람 동선 |
| inline-leeum-museum-1.jpeg | 리움미술관 건축/예술 무드보드 |
| inline-leeum-museum-2.jpeg | 리움미술관 관람 동선 다이어그램 |
| inline-leeum-museum-3.jpeg | 리움미술관 실용 정보 인포그래픽 |

#### 2026-02-05 신규 (14장)
| 파일명 | 용도 |
|--------|------|
| inline-daegu-course-map.jpeg | 대구 도보 코스 지도 |
| inline-daegu-food-guide.jpeg | 서문시장 먹거리 가이드 |
| inline-gangneung-cafe-map.jpeg | 강릉 카페 투어 지도 |
| inline-gangneung-cafe-compare.jpeg | 강릉 바다뷰 카페 비교 |
| inline-seoul-museum-map.jpeg | 서울 박물관 위치 지도 |
| inline-seoul-museum-compare.jpeg | 서울 박물관 비교 가이드 |
| inline-jeonju-course-map.jpeg | 전주 한옥마을 코스 지도 |
| inline-jeonju-food-guide.jpeg | 전주 먹거리 가이드 |
| inline-yeosu-night-map.jpeg | 여수 야경 명소 지도 |
| inline-yeosu-info.jpeg | 여수 여행 정보 인포그래픽 |
| inline-jeju-cafe-map.jpeg | 제주 카페 투어 지도 |
| inline-jeju-cafe-compare.jpeg | 제주 오션뷰 카페 비교 |
| inline-musical-guide.jpeg | 2026 뮤지컬 BEST 5 비교 |
| inline-musical-venue-map.jpeg | 서울 공연장 위치 지도 |

#### 2026-02-04 기존 (7장)
| 파일명 | 용도 | 크기 |
|--------|------|------|
| inline-2026-02-04-1-1.jpeg | 경주 교통정보 | 590KB |
| inline-2026-02-04-1-2.jpeg | 경주 코스지도 | 875KB |
| inline-2026-02-04-1-3.jpeg | 경주 맛집비교 | 476KB |
| inline-2026-02-04-post-1.jpeg | 광안리 가이드 | 852KB |
| inline-2026-02-04-post-2.jpeg | 광안리 코스지도 | 1.07MB |
| inline-mmca-exhibition-1.jpeg | 전시회 관람정보 | 727KB |
| inline-mmca-exhibition-2.jpeg | 전시회 관람동선 | 944KB |

### Gemini API 사용량
- 일일 한도: 50장
- 금일 사용: 21장 (기존 7장 + 신규 14장)
- 잔여: 29장

---

## 배포 정보

### Hugo 설정
- **baseURL:** `https://daun92.github.io/travel-blog/`
- **테마:** PaperMod
- **언어:** 한국어 (ko)

### 로컬 개발
```bash
# Hugo 서버 실행
cd blog && hugo serve -D -p 1313

# 접속 URL
http://localhost:1313/travel-blog/
```

### GitHub Pages 배포
```bash
# 1. Hugo 빌드
cd blog && hugo --minify

# 2. public 폴더를 gh-pages 브랜치로 푸시
# (또는 GitHub Actions 자동 배포)
```

---

## 워크플로우 가이드

### 🌟 Premium Workflow (권장)

고품질 콘텐츠 발행을 위한 7단계 표준 프로세스:

```bash
# Step 1: 콘텐츠 생성
npm run new -- -t "주제" --type travel

# Step 2: 페르소나 기반 향상
npm run enhance -- -f drafts/파일명.md
npm run enhance -- --all                    # 모든 드래프트

# Step 3: 팩트체크 (70% 이상 필수)
npm run factcheck -- -f drafts/파일명.md

# Step 4: 품질 검증
npm run validate -- -f drafts/파일명.md

# Step 5: AEO 적용 (FAQ + Schema.org)
npm run aeo -- -f drafts/파일명.md --apply

# Step 6: 이미지 확인 (/travel-blog/ prefix)

# Step 7: 발행 + Moltbook
npm run publish
npm run moltbook:share
```

#### 통합 명령어
```bash
npm run workflow:premium -- -f drafts/파일명.md
```

### 새 포스트 생성 (기본)
```bash
# 1. 기본 생성
npm run new -- -t "주제" --type travel

# 2. 인라인 이미지 포함
npm run new -- -t "주제" --type travel --inline-images --image-count 2

# 3. 비대화 모드 (자동)
npm run new -- -t "주제" --type travel --inline-images --yes
```

### 기존 포스트에 이미지 추가
```bash
# scripts/add-images.mts 수정 후 실행
npx tsx scripts/add-images.mts
```

### 초안 검토 및 발행 (레거시)
```bash
# 초안 목록
npm run drafts

# 검토
npm run review -- -f filename.md

# 발행
npm run publish -- -f filename.md
```

---

## 환경 변수 (.env)

```env
# Gemini API (텍스트 + 이미지 생성) - 필수
GEMINI_API_KEY=your-key
LLM_MODEL=gemini-3.0-flash              # 텍스트 생성
GEMINI_IMAGE_MODEL=gemini-3.0-pro-preview  # 이미지 생성
GEMINI_IMAGE_ENABLED=true
GEMINI_IMAGE_MAX_COUNT=50

# Unsplash (커버 이미지)
UNSPLASH_ACCESS_KEY=your-key

# Hugo
HUGO_BASE_URL=/travel-blog
```

> **참고:** 2026-02-05 기준 Ollama에서 Gemini API로 완전 전환됨

---

## 향후 계획

### 단기 (1-2주)
- [x] 이미지 없는 포스트에 인라인 이미지 추가 ✅ (2026-02-05 완료)
- [x] 링크 프로세서 AI 장소 추출 재설계 ✅ (2026-02-07 완료)
- [x] 팩트체크 자동 수정 시스템 구현 ✅ (2026-02-07 완료)
- [x] Moltbook 배치 공유 큐잉 시스템 ✅ (2026-02-07 완료)
- [x] 저성과 포스트 리라이트 자동화 ✅ (2026-02-07 완료)
- [x] Windows Task Scheduler 연동 ✅ (2026-02-07 완료)
- [ ] 저성과 포스트 실제 리라이트 실행 (`npm run rewrite:low`)
- [ ] Task Scheduler 설치 및 검증 (`.\scheduler\install.ps1`)
- [ ] SEO 최적화 검토
- [ ] GitHub Pages 자동 배포 설정

### 중기 (1개월)
- [x] Moltbook 피드백 시스템 활성화 ✅
- [ ] 키워드 기반 자동 포스트 생성
- [ ] 방문자 분석 연동
- [ ] PM2 → Task Scheduler 완전 마이그레이션

### 장기 (3-4개월)
- [ ] 월 1,000 방문자 목표 달성
- [ ] 콘텐츠 전략 자동 조정
- [ ] 다국어 지원

---

## 시행착오 및 문제 해결 기록

### 2026-02-05 (저녁): AI 생성 콘텐츠 팩트체크 이슈

#### 1. AI가 생성한 부정확한 정보
**증상:** 팩트체크 점수 16~60%로 매우 낮음
**원인:** AI(Gemini)가 정확하지 않은 정보 생성
- 뮤지엄김치간 입장료: 5,000원 (실제: 20,000원)
- 경천사 "사층"석탑 (실제: 십층석탑)
- 소장품 "30만 점" (실제: 약 44만 점)

**해결:**
1. 웹 검색으로 공식 정보 확인
2. 수동으로 정확한 정보로 교체
3. 검증 불가한 주관적 주장 제거/완화

**교훈:**
- AI 생성 콘텐츠는 반드시 팩트체크 필수
- 구체적 숫자(가격, 수량, 시간)는 특히 검증 필요
- 70% 미만 팩트체크 점수 → 발행 전 수동 검토

---

#### 2. 자동 팩트체크의 한계
**증상:** 경험담/주관적 내용이 많은 포스트는 점수가 낮게 나옴
**원인:**
- "지하철로 40~60분" 같은 주관적 주장은 검증 어려움
- 개인 경험 기반 내용은 외부 소스로 확인 불가

**해결:**
- 검증 가능한 객관적 사실 위주로 클레임 작성
- 주관적 경험은 명확히 개인 의견임을 표시
- 구체적 시간/거리 주장 대신 일반적 표현 사용

**예시:**
```markdown
# 수정 전 (검증 어려움)
강남/판교 기준 지하철로 40~60분이면 다 도착합니다.

# 수정 후 (검증 용이)
모두 지하철역에서 도보 10분 이내 거리예요.
```

---

#### 3. 팩트체크 검증 소스 목록
| 분야 | 검증 소스 |
|------|----------|
| 박물관 정보 | museum.go.kr, 각 박물관 공식 사이트 |
| 입장료/운영시간 | 공식 사이트, trip.com, namu.wiki |
| 건축/설계 정보 | 건축 전문 매체, 위키피디아 |
| 문화재 정보 | heritage.go.kr, encykorea.aks.ac.kr |

---

### 2026-02-05: 하이브리드 이미지 시스템 구현 중 발생한 이슈들

#### 1. TypeScript 타입 오류 - `'data' is of type 'unknown'`
**증상:** `gemini-imagen.ts`에서 API 응답 처리 시 TypeScript 컴파일 오류
```
error TS18046: 'data' is of type 'unknown'.
```
**원인:** `response.json()` 반환값이 `unknown` 타입으로 추론됨
**해결:**
```typescript
// 인터페이스 정의
interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        inlineData?: { data: string; mimeType: string };
        text?: string;
      }>;
    };
  }>;
  error?: { message: string };
}

// 타입 캐스팅 적용
const data = await response.json() as GeminiResponse;
```
**교훈:** 외부 API 응답은 항상 명시적 인터페이스로 타입 정의 필요

---

#### 2. 이미지 404 오류 - Hugo baseURL 불일치
**증상:**
- Hugo 서버에서 인라인 이미지가 404로 표시
- 커버 이미지는 일부만 표시됨

**원인:**
- Hugo baseURL이 `/travel-blog/`로 설정됨
- 이미지 경로가 `/images/...`로 생성되어 실제 경로와 불일치
- 경로 일관성 부재: 일부는 상대경로(`images/...`), 일부는 절대경로(`/images/...`)

**해결 과정:**
1. 발행된 포스트 확인 → 경로 불일치 발견
2. 초안 파일 확인 → 동일한 문제 발견
3. 소스 코드 수정 → `HUGO_BASE_URL` 환경변수 도입
4. 기존 포스트 일괄 수정 → 모든 경로 `/travel-blog/images/...`로 통일

**수정된 코드 (`gemini-imagen.ts`):**
```typescript
const baseURL = process.env.HUGO_BASE_URL || '/travel-blog';
const relativePath = `${baseURL}/images/${fullFilename}`;
```

**영향받은 파일:**
- `blog/content/posts/travel/*.md` - 커버 및 인라인 이미지 경로
- `blog/content/posts/culture/*.md` - 커버 및 인라인 이미지 경로
- `drafts/*.md` - 인라인 이미지 경로

**교훈:**
- Hugo 프로젝트에서 이미지 경로는 반드시 baseURL을 포함해야 함
- 경로 생성 로직은 환경변수로 중앙 관리
- 새 기능 추가 시 기존 콘텐츠와의 호환성 반드시 검증

---

#### 3. 스크립트 환경변수 미로드 - dotenv 누락
**증상:** `scripts/add-images.mts` 실행 시 "Gemini 상태: ✗ API 키 없음"
**원인:** 독립 실행 스크립트에서 dotenv 설정이 누락됨
**해결:**
```typescript
// scripts/add-images.mts 상단에 추가
import { config } from 'dotenv';
config();  // .env 파일 로드
```
**교훈:**
- CLI 외부에서 실행되는 스크립트는 환경변수 로드를 명시적으로 수행
- 스크립트 작성 시 독립 실행 가능 여부 테스트 필수

---

#### 4. Git 중첩 저장소 경고
**증상:** `git add blog/` 실행 시 embedded repository 경고
```
warning: adding embedded git repository: claude/openclaw/blog
```
**원인:** `blog/` 폴더가 별도의 git 저장소 (Hugo 테마 또는 GitHub Pages 배포용)
**해결:**
- `blog/` 폴더는 메인 저장소에서 제외
- 별도의 저장소로 독립 관리
- `.gitignore`에 `blog/` 추가 고려

**구조:**
```
openclaw/           # 메인 저장소 (소스 코드)
└── blog/           # 별도 저장소 (Hugo 블로그, GitHub Pages)
    └── .git/
```
**교훈:**
- 배포용 폴더와 소스 폴더의 버전 관리 분리 권장
- 서브모듈 또는 별도 저장소로 관리

---

#### 5. 이미지 프롬프트 전략 전환
**문제:** 초기 프롬프트가 정보 전달 중심으로 구성되어 매력도 부족
**원인:** 기능적 관점(가격표, 시간표)에서만 이미지 설계
**해결:** 감성적 매력 + 공유 유도 전략으로 전환

| 기존 | 개선 |
|------|------|
| "가격 비교 표" | "카페 칠판 메뉴판 느낌" |
| "교통 다이어그램" | "보물지도 여정" |
| "코스 지도" | "친구가 그려준 약도" |

**교훈:**
- AI 생성 이미지의 장점 = 일러스트/감성 그래픽
- 실사 느낌보다 일러스트 스타일이 AI 생성에 적합
- 공유하고 싶은 콘텐츠 = SNS 확산 유도

---

## 개발 지침 및 규칙

### 필수 체크리스트 (새 기능 추가 시)

#### 코드 작성
- [ ] 외부 API 응답에 대한 TypeScript 인터페이스 정의
- [ ] 환경변수 사용 시 기본값 설정 (`process.env.VAR || 'default'`)
- [ ] 에러 핸들링 및 사용자 친화적 메시지

#### 이미지/미디어 관련
- [ ] Hugo baseURL 반영 여부 확인 (`/travel-blog/...`)
- [ ] 이미지 경로 일관성 검증 (상대/절대 경로 혼용 금지)
- [ ] 새 이미지 생성 후 브라우저에서 404 테스트

#### 스크립트 작성
- [ ] `import { config } from 'dotenv'; config();` 포함
- [ ] 독립 실행 테스트 (`npx tsx scripts/xxx.mts`)
- [ ] 에러 시 명확한 가이드 메시지 출력

#### 배포 전
- [ ] `npm run build` 성공 확인
- [ ] Hugo 로컬 서버에서 전체 페이지 검증
- [ ] 이미지 로딩 상태 확인 (Network 탭)

---

### 경로 규칙

#### 이미지 경로 (Hugo)
```
올바른 예:
/travel-blog/images/cover-xxx.jpg
/travel-blog/images/inline-xxx.jpeg

잘못된 예:
/images/cover-xxx.jpg          # baseURL 누락
images/cover-xxx.jpg           # 상대경로 (Hugo에서 문제 발생 가능)
```

#### 파일 저장 위치
```
커버 이미지:     blog/static/images/cover-*.jpg
인라인 이미지:   blog/static/images/inline-*.jpeg
초안:           drafts/*.md
발행 포스트:    blog/content/posts/{travel|culture}/*.md
```

---

### 환경변수 관리

#### 필수 환경변수
| 변수 | 용도 | 기본값 |
|------|------|--------|
| `GEMINI_API_KEY` | 텍스트/이미지 생성 | (필수) |
| `LLM_MODEL` | 텍스트 생성 모델 | `gemini-3.0-flash` |
| `GEMINI_IMAGE_MODEL` | 이미지 생성 모델 | `gemini-3.0-pro-preview` |
| `HUGO_BASE_URL` | 경로 접두사 | `/travel-blog` |

#### 환경변수 검증
```bash
# 현재 설정 확인
npm run status
```

---

### Git 워크플로우

#### 메인 저장소 (openclaw/)
- 소스 코드, 설정, 문서
- 커밋 메시지: `feat:`, `fix:`, `docs:` 접두사 사용

#### 블로그 저장소 (blog/)
- Hugo 빌드 결과물, 테마
- GitHub Pages 배포용
- 별도 관리 (`cd blog && git add . && git commit`)

#### 커밋 전 확인사항
```bash
# 1. 빌드 테스트
npm run build

# 2. git status 확인 (blog/ 폴더 제외 확인)
git status

# 3. 커밋
git add <specific-files>
git commit -m "type: 설명"
```

---

## 점검 체크리스트

### 주간 점검
- [ ] Gemini API 사용량 확인
- [ ] 생성된 포스트 품질 검토
- [ ] 이미지 로딩 상태 확인
- [ ] Hugo 빌드 오류 확인

### 월간 점검
- [ ] 방문자 통계 분석
- [ ] 인기 키워드 업데이트
- [ ] 콘텐츠 전략 조정
- [ ] API 비용 검토
