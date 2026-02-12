# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OpenClaw is an AI-powered travel/culture blog automation system. It generates SEO-optimized content using Gemini API, integrates community feedback via Moltbook, and publishes to a Hugo static site hosted on GitHub Pages.

4인 에이전트 필명 시스템으로 운영되는 팀 블로그 형태:
- **조회영** (viral) - 바이럴/공유 유도, 순위/비교 콘텐츠
- **김주말** (friendly) - 직장인 주말 여행, 솔직 체험 후기
- **한교양** (informative) - 교양/해설, 깊이 있는 문화 콘텐츠
- **오덕우** (niche) - 취향 디깅, 숨은 발견, 다층 탐구 콘텐츠

**Goal**: Achieve 1,000 monthly visitors within 4 months through data-driven content curation.

## Common Commands

### Development
```bash
npm install              # Install dependencies
npm run build            # Compile TypeScript to dist/
npm run dev              # Watch mode with tsx
npm run status           # Check system health (Ollama, directories)
npm test                 # Run Vitest tests
```

### Content Generation Workflow
```bash
npm run collect -- -k "제주도 카페"     # Collect data from APIs
npm run new -- -t "제주도 숨은 카페" --type travel  # Generate post (에이전트 자동 배정)
npm run new -- -t "서울 전시회" --type culture -k "현대미술"
npm run new -- -t "경주 역사" --type travel --agent informative  # 에이전트 수동 지정
npm run drafts           # List drafts
npm run review           # SEO review & edit
npm run publish          # Git commit & push to blog
npm run keywords         # AI keyword recommendations
npm run keywords -- -c travel   # Category-specific keywords
```

### Moltbook Integration
```bash
npm run moltbook:setup   # Initial setup
npm run moltbook:share   # Share post to community
npm run moltbook:feedback   # Collect feedback
npm run moltbook:analyze    # View strategy adjustments
```

### Hugo Blog
```bash
npm run hugo:serve       # Local preview at localhost:1313
npm run hugo:build       # Production build with minification
```

### Quality Validation (NEW)
```bash
npm run factcheck -- -f <file>     # Fact-check a post
npm run factcheck -- --drafts      # Fact-check all drafts
npm run validate -- -f <file>      # Full quality validation
npm run validate -- --all          # Validate all drafts
npm run review:human               # View human review queue
npm run aeo -- -f <file>           # Add FAQ & Schema.org
npm run aeo -- -f <file> --apply   # Apply AEO to file
```

### Claude Code 네이티브 팩트체크 (API 키 불필요)
```bash
npm run factcheck:extract -- -f <file>   # Step 1: 클레임 추출 (JSON 출력)
npm run factcheck:report -- -i <file>    # Step 3: 보고서 생성
npm run factcheck:report -- -i <file> --auto-fix         # 자동 수정 포함
npm run factcheck:report -- -i <file> --auto-fix --dry-run  # 미리보기
```

### Integrated Workflow (NEW)
```bash
npm run workflow full              # Full pipeline (factcheck + SEO + AEO + image)
npm run workflow quick             # Quick mode (factcheck only)
npm run workflow full --draft      # Include Moltbook draft feedback
npm run workflow full --apply      # Auto-apply AEO elements
```

### Moltbook Draft Feedback
```bash
npm run moltbook:draft             # Share draft for feedback (before publish)
npm run moltbook:draft-feedback    # Collect draft feedback
npm run moltbook:draft-status      # Check pending drafts
```

### Survey & Topic Discovery
```bash
npm run moltbook:culture-survey           # Moltbook에 서베이 발행
npm run moltbook:survey-scheduler         # 응답 수집 (30분 간격, 최대 3시간)
npm run survey ingest                     # 수집 결과 → 인사이트 DB 적재
npm run survey status                     # 누적 인사이트 현황 조회
npm run survey boost                      # 주제 발굴 점수 부스트 확인
npm run survey apply-strategy             # content-strategy.json 자동 갱신
npm run queue discover --auto --gaps      # 서베이 반영된 주제 자동 발굴
```

### Legacy Combined Workflows
```bash
npm run workflow:create   # collect + new
npm run workflow:publish  # publish + moltbook:share
npm run workflow:feedback # moltbook:feedback + moltbook:analyze
```

## 포스트 관리 레이어

고품질 콘텐츠 발행을 위한 **4-Layer 라이프사이클**. 단계를 건너뛰지 마세요.

### Layer 1: Discovery (주제 발굴) — 주 1회 권장
```bash
npm run moltbook:culture-survey           # 서베이 발행
npm run moltbook:survey-scheduler         # 응답 수집 (30분x6)
npm run survey ingest                     # 인사이트 DB 적재
npm run survey apply-strategy             # content-strategy.json 갱신
npm run queue discover --auto --gaps      # 주제 큐 편성 (서베이 부스트 +0~30)
```

서베이 인사이트: 인기 키워드 → 점수 부스트, 인기 포맷 → 전략 반영, 관심 지역 → focusAreas

### Layer 2: Generation (콘텐츠 생산) — 매 포스트
```bash
# 풀 옵션 권장: 에이전트 자동배정 + KTO 실사진 + AI 일러스트
npm run new -- -t "경주 불국사" --type travel --auto-collect --inline-images --image-count 4 -y
# 수동 에이전트: --agent viral|friendly|informative|niche
```

**에이전트 자동 배정** — **프레이밍**으로 결정 (기본값: 김주말):
| 에이전트 | 트리거 키워드 | 프레이밍 |
|----------|--------------|----------|
| 조회영 (viral) | TOP, BEST, 순위, 비교, vs, 핫플, 트렌드, 난리, 화제, 필수 | 순위/비교/화제성 |
| 한교양 (informative) | 역사, 건축, 미술사, 해설, 교양, 유네스코, 배경, 유래, 입문, 에티켓 | 깊이/교양/해설 |
| 오덕우 (niche) | 숨은, 로컬, 골목, 현지인, 비밀, 디깅, 취향, 덕질, 찐, 인디, 동네, 소문, 발견 | 취향 디깅/숨은 발견 |
| 김주말 (friendly) | 주말, 1박2일, 당일치기, 가성비, 퇴근, 후기, 코스, 웨이팅, 솔직, 비용 | 체험/실용/주말 |

**4인 페르소나** (`config/personas/`):
| 필명 | 톤 | 문체 |
|------|-----|------|
| **조회영** | 도발적, 단정적, 흥분 | 해요체+반말 혼용 |
| **김주말** | 솔직, 현실적, 투덜 | 해요체 |
| **한교양** | 차분, 지적, 해설사 | 합니다체 |
| **오덕우** | 속삭임+흥분 폭주, 덕질 에너지 | 해요체+흥분시 반말 |

### Layer 3: Validation (품질 검증) — 매 포스트
```bash
npm run enhance -- -f <file>               # 페르소나 기반 향상 (클리셰 제거, 디테일 강화)
npm run factcheck -- -f <file>             # 팩트체크 (70% 이상 필수)
npm run validate -- -f <file>              # 품질+이미지 검증
npm run aeo -- -f <file> --apply           # FAQ/Schema.org 추가
# 통합: npm run workflow full -- -f <file> --enhance --apply
```

### Layer 4: Publish + Feedback (발행 + 피드백 루프) — 매 포스트
```bash
npm run publish                            # Hugo 블로그 발행
npm run moltbook:share                     # 커뮤니티 공유
npm run moltbook:feedback                  # 피드백 수집
npm run moltbook:analyze                   # 전략 자동 조정 → Layer 1 순환
```

### 워크플로우 체크리스트

**Layer 1: Discovery (주 1회)**
```
□ npm run moltbook:culture-survey → survey-scheduler → survey ingest
□ npm run survey apply-strategy → queue discover --auto --gaps
```

**Layer 2+3: Generation + Validation (매 포스트)**
```
□ npm run new -- -t "주제" --type travel --auto-collect --inline-images -y
□ npm run enhance -- -f <file>
□ npm run factcheck -- -f <file>             (70% 이상)
□ npm run validate -- -f <file>
□ npm run aeo -- -f <file> --apply
□ 커버 이미지 9-Point 평가 (5+ FAIL → npm run covers:refresh --posts <file>)
□ 인라인 이미지 역할 확인: 도입/마감=일러스트, 본문=스틸컷 또는 KTO
□ 마커 잔존 검사: [LINK: / [IMAGE: 패턴이 본문에 남아있으면 안 됨
□ 이미지 파일 존재 검증: ![](path)의 모든 경로가 blog/static/images/에 실존
□ KTO 이미지-컨텍스트 매칭: 본문 시점/계절/장면과 KTO 자동 선택 이미지가 일치하는지 확인
□ 캡션 품질: "AI 생성 ~" 기계적 표현 → 맥락 연결 내러티브로 교체
□ 페르소나 이름 교차 오염: 본문 내 필명이 해당 포스트의 personaId와 일치하는지 확인
□ frontmatter 확인: author, personaId, dataSources, cover.caption
```

**Layer 4: Publish + Feedback (매 포스트)**
```
□ npm run publish → moltbook:share → moltbook:feedback → moltbook:analyze
```

### 절대 하지 말 것
1. enhance/factcheck 없이 publish 실행 금지
2. 팩트체크 70% 미만 발행 금지
3. AEO/Moltbook 스킵 금지
4. 에이전트 필명(author) 누락 금지
5. 주기적 서베이 생략 금지
6. `[LINK:` / `[IMAGE:` 미처리 마커가 남은 채 발행 금지
7. 본문 `![]()` 참조 이미지가 실제 파일로 존재하지 않는 채 발행 금지
8. 본문 섹션에 맥락 무관한 범용 일러스트 사용 금지 (스틸컷 또는 KTO 실사 사용)
9. 프롬프트 few-shot 예시에 실존 장소/기관/공연명 하드코딩 금지 (`{플레이스홀더}` 사용)
10. 다른 페르소나 필명이 본문에 혼입되는 것 금지 (personaId와 필명 1:1 매칭 확인)

## Architecture

### Core Systems

**Content Generation Pipeline** (`src/generator/`)
- `index.ts` - Orchestrates: select persona → create prompt → generate → parse SEO → inline images → write markdown
- `ollama.ts` - Gemini API client (파일명은 레거시, 실제 Gemini API 사용)
- `prompts.ts` - 에이전트 페르소나 기반 프롬프트 (travel/culture x persona 조합)
- `frontmatter.ts` - Hugo-compatible YAML frontmatter (author, personaId 포함)

**Data Collection** (`src/agents/collector.ts`)
- Integrates Korean Tourism API, Culture Portal API
- Falls back to mock data when APIs unavailable
- Outputs JSON to `data/collected/`

**Moltbook Feedback Loop** (`src/agents/moltbook/index.ts`)
- `MoltbookShareAgent` - Posts to travel/culture submolts
- `FeedbackCollector` - Gathers comments, votes, sentiment
- `FeedbackAnalyzer` - Identifies top topics, improvement areas
- `StrategyAdjuster` - Updates `config/content-strategy.json` automatically

**Draft Enhancer** (`src/agents/draft-enhancer/`)
- `index.ts` - 페르소나 기반 콘텐츠 향상 에이전트
- `cliche-filter.ts` - 클리셰 감지 및 대체 제안 (severity: high/medium/low)
- `detail-analyzer.ts` - 디테일 수준 분석 (숫자, 실패담, 비교)
- `persona-loader.ts` - 멀티 페르소나 로더 (레지스트리, 자동 배정, ID별 로드)

**Multi-Agent Persona System** (`config/personas/`)
- `index.json` - 페르소나 레지스트리 + 자동배정 키워드 규칙
- `viral.json` - 조회영: 바이럴, 순위/비교, 해요체+반말
- `friendly.json` - 김주말: 솔직 체험, 주말 여행, 해요체
- `informative.json` - 한교양: 교양/해설, 역사/문화, 합니다체
- `niche.json` - 오덕우: 취향 디깅, 숨은 발견, 해요체+흥분시 반말

**Survey & Topic Discovery** (`src/agents/moltbook/`)
- `survey-insights-db.ts` - 서베이 인사이트 누적 DB (가중 투표, 부스트 점수 계산)
- `topic-discovery.ts` - 주제 발굴 (서베이 부스트 반영, 갭 분석)
- 서베이 파이프라인: 발행 → 수집(30분x6) → 적재 → 전략 갱신 → 주제 큐 편성

**CLI** (`src/cli/`)
- Commander.js-based with commands in `src/cli/commands/`
- Entry point: `src/cli/index.ts`

### Directory Structure
```
src/                    # TypeScript source
  api/                  # 외부 API 클라이언트 모듈
    data-go-kr/         # ⭐ data.go.kr 공유 API 클라이언트 (KorService2)
  agents/               # External integrations
    collector.ts        # API data collection (KorService2 via 공유 클라이언트)
    moltbook/           # Moltbook feedback loop
    draft-enhancer/     # ⭐ 페르소나 기반 콘텐츠 향상
  cli/commands/         # CLI command implementations
  generator/            # Content generation (Gemini API)
  images/               # 이미지 오케스트레이터 + 소스 (KTO + Unsplash + Gemini AI)
  seo/                  # SEO optimization utilities
  aeo/                  # AI Engine Optimization (FAQ, Schema)
  factcheck/            # Fact verification system (KorService2 via 공유 클라이언트)
  quality/              # Quality validation
blog/                   # Hugo blog (별도 Git 저장소)
  content/posts/        # Published posts (travel/, culture/)
  static/images/        # Post images
  hugo.toml             # Hugo config
config/                 # Runtime config
  content-strategy.json # Moltbook 피드백 기반 전략
  persona.json          # 레거시 페르소나 (friendly 폴백용)
  personas/             # 멀티 에이전트 페르소나 시스템
    index.json          #   레지스트리 + 자동배정 규칙
    viral.json          #   조회영 (바이럴)
    friendly.json       #   김주말 (친근감)
    informative.json    #   한교양 (교양)
data/                   # Collected API data, feedback analysis
  api-cache/            # data.go.kr API 응답 캐시
  api-usage.json        # data.go.kr 일일 쿼터 추적
  survey-insights-db.json # 서베이 누적 인사이트 DB
  feedback/             # Moltbook 피드백 데이터
    survey-records.json #   발행된 서베이 메타데이터
    survey-result.json  #   최근 수집 결과
drafts/                 # Posts awaiting review
```

### Data Flow
```
┌─────────────────────── Phase A: 주제 발굴 ───────────────────────────┐
│  Moltbook 서베이 → data/feedback/survey-result.json                   │
│        ↓                                                              │
│  survey ingest → data/survey-insights-db.json (누적)                  │
│        ↓                                                              │
│  survey apply-strategy → config/content-strategy.json                 │
│        ↓                                                              │
│  queue discover → 주제 큐 (서베이 부스트 +0~30점 반영)                │
└───────────────────────────────────────────────────────────────────────┘
        ↓
┌─────────────────────── Phase B: 콘텐츠 생산 ─────────────────────────┐
│  config/personas/index.json                                           │
│        ↓ (자동배정 규칙)                                              │
│  External APIs → data/collected/ → [Agent 선택] → src/generator       │
│                                    조회영|김주말|한교양     ↓          │
│                                                         drafts/       │
│                                                           ↓           │
│                                                  Enhance → Factcheck  │
│                                                           ↓           │
│                                                    Quality → AEO      │
└───────────────────────────────────────────────────────────────────────┘
        ↓
┌─────────────────────── Phase C: 발행 + 피드백 ───────────────────────┐
│  blog/content/posts/ → Moltbook share                                 │
│        ↓                                                              │
│  Moltbook feedback → config/content-strategy.json → Phase A 순환      │
└───────────────────────────────────────────────────────────────────────┘
```

## Environment Variables

Required:
- `GEMINI_API_KEY` - Google Gemini API key (텍스트 및 이미지 생성)
- `LLM_MODEL` - LLM model name (default: `gemini-3.0-flash`)

Optional:
- `GEMINI_IMAGE_MODEL` - Image generation model (default: `gemini-3.0-pro-preview`)
- `GEMINI_IMAGE_ENABLED` - Enable inline image generation (default: `true`)
- `GEMINI_IMAGE_MAX_COUNT` - Max images per post (default: `30`)
- `UNSPLASH_ACCESS_KEY` - Image search (cover images)
- `HUGO_BASE_URL` - Hugo path prefix (default: `/travel-blog`)
- `KTO_API_KEY` - Korean Tourism API
- `CULTURE_API_KEY` - Culture Portal API

## Content Types

Two primary content categories with different prompt strategies:
- **travel** - Practical info (location, transport, cost), personal tone
- **culture** - Artist/work details, viewing highlights, audience recommendations

Length options: short (1500-2000), medium (2500-3500), long (4000-5000) characters

## Key Patterns

- Gemini API 사용 (텍스트: gemini-3.0-flash, 이미지: gemini-3.0-pro-preview)
- Posts follow Hugo permalink structure: `/posts/:year/:month/:slug/`
- Frontmatter includes SEO fields, tags, categories, custom metadata, **author** (에이전트 필명), **personaId**
- 에이전트 자동 배정: 주제 키워드 매칭 → 조회영/김주말/한교양 중 선택 (기본값: 김주말)
- 에이전트 수동 지정: `--agent viral|friendly|informative` CLI 플래그
- Moltbook feedback automatically adjusts content strategy without manual intervention
- 서베이 인사이트 누적 DB: 중복 방지(surveyId), 가중 투표(upvote x0.5), 부스트 점수(0~30)
- 서베이 → 전략 → 주제 발굴 → 콘텐츠 생산 → 피드백 순환 루프

## 이미지 생성 원칙

### 3-Source Hybrid 우선순위
1. **KTO 실사진** — `--auto-collect` 시 최우선, 출처 표기 법적 의무
2. **Unsplash** — KTO 없을 때 커버 폴백, scoring+registry 기반
3. **Gemini AI** — 인라인 나머지 슬롯, 역할별 스타일 분리

### 이미지 역할 분리 원칙 (Image Role Separation)

| 영역 | 적합 타입 | 스타일 | 이유 |
|------|-----------|--------|------|
| **커버** | AI 포토리얼리스틱 + 관인 | `cover_photo` | 첫인상, 에이전트 브랜딩 |
| **도입/마감** | AI 일러스트 | `diagram`/`bucketlist`/`moodboard` | 구조 시각화, 감성 요약 |
| **본문 섹션** | 스틸컷 또는 KTO 실사 | `cover_photo` (포토리얼) | 맥락 연결, 디테일 증거 |

**스틸컷 프롬프트 설계 프로토콜** (페르소나×포스트 타입 공통):

1. **피사체 추출** — 해당 섹션 본문에서 구체적 피사체를 추출한다. 추출 전략은 페르소나별로 다름 (아래 표 참조)
2. **`cover_photo` 스타일** 사용 (포토리얼리즘 강제)
3. **프롬프트 3파트 구조**: SUBJECT (피사체) → ATMOSPHERE (분위기) → PHOTOGRAPHY STYLE (촬영)
4. **페르소나 비주얼 아이덴티티** 적용 — `cover-styles.ts`의 `AGENT_VISUAL_IDENTITIES`에서 촬영 지시 참조
5. 섹션의 핵심 "한 장면"을 포착 — 페르소나의 시선으로 본 순간

**페르소나별 피사체 추출 전략**:

| 페르소나 | 추출 대상 | 예시 |
|---------|----------|------|
| **조회영** (viral) | 화제성·임팩트 장면: 인파, 대비되는 요소, "이건 봐야 해" 순간 | 줄 선 맛집, 야경 뷰포인트, 비교 대상 나란히 |
| **김주말** (friendly) | 체험 현장: 음식, 길거리, 숙소, "직접 해봤다" 순간 | 테이블 위 음식, 산책로 풍경, 체크인 장면 |
| **한교양** (informative) | 구조·디테일: 건축 요소, 문양, 전시 작품, 해설 대상 | 기둥 양식, 단청 패턴, 전시실 전경 |
| **오덕우** (niche) | 발견한 디테일: 미시적 관찰, 시간 흔적, 숨겨진 패턴 | 맨홀 뚜껑 각인, 간판 글씨체, 바닥 타일 |

**페르소나별 촬영 스타일** (`cover-styles.ts` 기반):

| 페르소나 | 촬영 스타일 | 구도 | 색감 |
|---------|-----------|------|------|
| **조회영** | 에디토리얼 매거진 — 강한 그림자, 극적 조명 | 대각선, 히어로 프레이밍, 과감한 원근 | 고대비, 강한 채도, 깊은 블랙 |
| **김주말** | 라이프스타일 — 골든아워 온기, 소프트 보케 | 눈높이, 따뜻한 비네팅, 중심 배치 | 웜톤, 골든 하이라이트, 부드러운 섀도 |
| **한교양** | 건축 사진 — 균일 조명, 디테일 주의 | 좌우 대칭, 삼분할, 기하학적 프레이밍 | 균형 노출, 쿨 섀도, 뉴트럴 미드톤 |
| **오덕우** | 인디 스트릿 — 필름 그레인, 클로즈업, 캔디드 | 타이트 클로즈업, 비중심 피사체, 얕은 심도 | 뮤트 톤, 필름 에뮬레이션, 비네팅 |

**포스트 타입별 ATMOSPHERE 방향**:

| 타입 | 분위기 키워드 | 시간대 |
|------|-------------|--------|
| **travel** | 현장감, 공간의 공기, 계절감, 빛의 변화 | 본문에서 묘사된 시간대 반영 |
| **culture** | 고요함, 집중, 지적 호기심, 전시장 조명 | 실내 인공조명 또는 자연광 혼합 |

**캡션 가이드라인**:
- "AI 생성 여정 일러스트" 같은 기계적 표현 금지
- 맥락 연결 내러티브: *{장소/소재}의 {시간/감성} — {본문 디테일 요약}*
- 페르소나 톤 반영:
  - 조회영: 짧고 강렬 — *한옥마을 야경 — 이 뷰, 리얼임*
  - 김주말: 솔직 체험 — *시장통 점심 — 8,000원에 이 정도면 인정*
  - 한교양: 해설적 — *종묘 어칸 구조 — 19칸 연속 배치의 건축적 의미*
  - 오덕우: 발견 서사 — *철제가구거리의 시간 — 장인의 손끝에서 태어나는 1mm의 정밀함*

### 핵심 규칙
- 모든 이미지 경로: `/travel-blog/images/` prefix 필수
- KTO 사용 시: frontmatter `dataSources: ["한국관광공사"]` 필수
- 인라인 최소: travel 2개, culture 1개
- 중복 방지: `data/image-registry.json`으로 관리

### 모듈 구조
- `image-orchestrator.ts` — 커버+인라인 통합 진입점
- `kto-images.ts` — 관광공사 API 연동
- `unsplash.ts` — 스코어링+후보풀 기반 검색
- `gemini-imagen.ts` — AI 일러스트 생성 (6스타일)
- `image-validator.ts` — 품질 게이트

### 커버 이미지 시스템 (Gemini AI 생성)
- `cover-styles.ts` — 에이전트 시각 아이덴티티 + 3-Layer 커버 프롬프트 빌더
- `cover-overlay.ts` — 관인(落款) 스타일 워터마크 오버레이 (Sharp SVG 합성)
- `reference-analyzer.ts` — Unsplash→Gemini Flash 레퍼런스 시각 분석

## 이미지 시스템 상세

### 시나리오별 결과 매트릭스

| CLI 플래그 | 커버 | 인라인 |
|-----------|------|--------|
| `--auto-collect --inline-images` | KTO → Unsplash | KTO + AI 하이브리드 |
| `--auto-collect` (inline 미사용) | KTO → Unsplash | 없음 |
| `--inline-images` (auto-collect 없음) | Unsplash | AI 100% |
| (둘 다 없음) | Unsplash | 없음 |

### AI 이미지 스타일 (Gemini)

**일러스트 (도입/마감용)**: `infographic` (다이어리), `diagram` (보물지도), `map` (약도), `comparison` (칠판 메뉴), `moodboard` (콜라주), `bucketlist` (체크리스트)
**스틸컷 (본문 섹션용)**: `cover_photo` 스타일로 생성 — 페르소나별 피사체 추출 전략 + 비주얼 아이덴티티 촬영 지시 (위 프로토콜 참조)

### 이미지 레지스트리 (`data/image-registry.json`)
KTO와 Unsplash 이미지를 통합 관리하여 중복 사용 방지:
```json
{ "source": "kto", "ktoContentId": "12345", "ktoUrl": "...", "postSlug": "...", "query": "..." }
{ "source": "unsplash", "unsplashId": "abc123", "postSlug": "...", "query": "..." }
```

### 파일 출력 구조
```
blog/static/images/
  kto-{slug}-0.jpg          ← 커버 (KTO)
  kto-{slug}-1.jpg          ← 인라인 (KTO 실사진)
  inline-{slug}-1.png       ← 인라인 (AI 일러스트)
```

### API 쿼터 영향
- KTO 이미지 다운로드: API call 아님 (순수 HTTP fetch)
- 총: ~38-48 API 호출/포스트 (검색 + detail enrichment + 축제 이미지)

## 커버 이미지 생성 시스템 (Gemini AI)

기존 포스트 또는 신규 포스트의 커버 이미지를 Gemini 포토리얼리스틱 생성 + 관인 오버레이로 처리합니다.

### CLI 명령
```bash
npm run covers:dry-run                     # 샘플 포스트 미리보기 (변경 없음)
npm run covers:sample                      # 샘플 8개 포스트 커버 재생성
npm run covers:all                         # 전체 포스트 커버 재생성
npm run covers:overlay-only                # 기존 이미지에 관인만 재적용 (API 0)
npx tsx scripts/refresh-covers.mts --posts travel/2026-02-09-top-5.md  # 특정 포스트
```

### 3-Layer 프롬프트 구조 (`cover-styles.ts`)

| 레이어 | 역할 | 예시 |
|--------|------|------|
| **Layer 1: WHAT TO SHOW** | 구체적 피사체 지시 + **본문 contentHints** | "성수동 리퍼브 공장 건물" + 본문 ## 헤딩 목록 |
| **Layer 2: CREATIVE DIRECTION** | 에이전트별 크리에이티브 방향 | viral→매거진 표지, friendly→브이로그 썸네일, informative→다큐 포스터 |
| **Layer 3: PHOTOGRAPHY STYLE** | 에이전트별 촬영 스타일 | 조명, 컬러 그레이딩, 구도, 분위기 |

**contentHints** (CRITICAL): `refresh-covers.mts`가 포스트 본문의 `##` 헤딩을 파싱하여 실제 장소/키워드 목록을 Layer 1에 주입합니다. 제목만으로는 TOP 5 리스티클 등에서 Gemini가 스테레오타입 이미지를 생성하므로, **반드시 본문 힌트를 전달**해야 포스트 내용과 일치하는 커버가 나옵니다.

에이전트별 크리에이티브 디렉션:
- **조회영 (viral)**: 매거진 표지 / 인기 유튜브 썸네일 — 강렬한 히어로 샷, "멈춰서 봐야 하는" 구도
- **김주말 (friendly)**: 여행 브이로거 썸네일 — 눈높이 시점, 현장감, 따뜻한 일상 분위기
- **한교양 (informative)**: 다큐멘터리 포스터 / 전시 도록 — 건축적 우아함, 시네마틱 프레이밍
- **오덕우 (niche)**: 인디 zine / 스트릿 스냅 — 디테일 클로즈업, 필름 그레인, 발견의 순간

### 관인(落款) 오버레이 (`cover-overlay.ts`)

동양 미술의 낙관 스타일 워터마크. 에이전트별 식별 스탬프.

```
위치: 우하단, 패딩 30px | 크기: 70×70px | 회전: -5° | 불투명도: 0.82
이중 테두리: 외곽 3px + 내곽 1.5px (gap 3px)
배경: 반투명 흰색 (0.12) | 폰트: Batang, Nanum Myeongjo, serif 24px
```

| 에이전트 | 컬러 | 관인 텍스트 |
|---------|------|-----------|
| 조회영 (viral) | `#FF3B30` 레드 | 회영 |
| 김주말 (friendly) | `#FF9500` 오렌지 | 주말 |
| 한교양 (informative) | `#007AFF` 블루 | 교양 |
| 오덕우 (niche) | `#0D9488` 틸 | 소문 |

### 캡션 시스템

| 이미지 소스 | caption 형식 | 예시 |
|------------|-------------|------|
| KTO 실사진 | `출처: 한국관광공사` | 기존 그대로 |
| AI 생성 | `작성자: {에이전트} · {주제≤15자} {한마디}` | `작성자: 조회영 · 발렌타인 여행지 이건 꼭 봐야 됨` |

에이전트별 한마디:
- 조회영: "이건 꼭 봐야 됨"
- 김주말: "직접 다녀왔어요"
- 한교양: "알면 더 깊은 여행"
- 오덕우: "파면 팔수록 빠져들어요"

### 커버 이미지 평가 기준 (9-Point Checklist)

발행 전 커버 이미지 품질을 다음 9개 항목으로 평가합니다. 5개 이상 FAIL이면 재생성 권장.

| # | 항목 | 기준 |
|---|------|------|
| 1 | **포토리얼리즘** | 실제 사진과 구분 불가, 일러스트/3D/카툰 아님 |
| 2 | **한국 분위기** | 한글 간판, 한국 건축, 한국적 풍경이 보임 |
| 3 | **관인 오버레이** | 우하단에 에이전트 컬러 관인 스탬프 존재 |
| 4 | **에이전트 스타일** | 조회영=드라마틱, 김주말=따뜻, 한교양=정갈, 오덕우=인디/캔디드 |
| 5 | **크리에이티브 느낌** | 매거진/썸네일/다큐/인디zine 느낌이 전달됨 |
| 6 | **주제 적합성** | 포스트 제목과 이미지가 직접적으로 연결됨 |
| 7 | **계절 일치** | 발행 시기와 이미지 계절감이 맞음 |
| 8 | **장소 인식** | 특정 장소가 즉시 인식 가능 (범용 풍경 ✗) |
| 9 | **분위기 일치** | 포스트 톤(로맨틱/활기/차분)과 이미지 무드 일치 |

### 파이프라인 흐름
```
포스트 본문 → ## 헤딩 파싱 → contentHints[]
    ↓
analyzeReference() → getCoverPhotoPrompt(title, type, agent, ref, contentHints)
    → Gemini 이미지 생성 → applyOverlayToBase64() (관인 합성)
    → frontmatter 업데이트 (cover.image, cover.caption)
```

### 커버 이미지 문제 해결 가이드

| 증상 | 원인 | 해결 |
|------|------|------|
| 포스트에 없는 장소가 커버에 표시 | contentHints 미전달 또는 ## 헤딩 부재 | 본문에 ## 헤딩 확인, refresh-covers 재실행 |
| 범용적인 "예쁜 한국 풍경" | Layer 1 피사체 지시 약함 | 제목에 구체적 장소명 포함 or contentHints 의존 |
| 일러스트/카툰 스타일 | Gemini 프롬프트 가드레일 미작동 | CRITICAL REQUIREMENTS 확인, 재생성 |
| 관인이 안 보임 | overlay skip 또는 파일 누락 | `--skip-overlay` 없이 재실행 |

## Critical Development Rules

### 1. Hugo Image Paths (IMPORTANT)
All image paths MUST include the Hugo baseURL prefix:
```markdown
# CORRECT
image: "/travel-blog/images/cover-xxx.jpg"
image: "/travel-blog/images/kto-slug-0.jpg"
![alt](/travel-blog/images/inline-xxx.jpeg)
![alt](/travel-blog/images/kto-slug-1.jpg)

# WRONG - will cause 404
image: "/images/cover-xxx.jpg"
image: "images/cover-xxx.jpg"
```

### 2. TypeScript API Responses
Always define interfaces for external API responses:
```typescript
// Define response type
interface ApiResponse {
  data?: { ... };
  error?: { message: string };
}

// Cast response
const data = await response.json() as ApiResponse;
```

### 3. Standalone Scripts
Scripts in `scripts/` must load environment variables:
```typescript
import { config } from 'dotenv';
config();  // Load .env at the top
```

### 4. Git Repository Structure
- `openclaw/` - Main repository (source code, NOT blog/)
- `blog/` - Separate repository (Hugo site for GitHub Pages)

Do NOT add `blog/` folder to main git staging.

## 요청 트리아지 프로토콜 (자동 분류)

**모든 작업 요청에 대해** 코드를 수정하기 전에 아래 트리아지를 먼저 수행한다.
사용자가 명시적으로 분류하지 않아도, 에이전트가 자동으로 분석하여 실행 계획을 제시한다.

### Step 1: 영향 범위 식별

요청을 읽고 아래 모듈 의존성 맵에서 **터치 대상 모듈**을 식별한다.

```
모듈 의존성 맵 (A → B = A가 B를 import):

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
```

### Step 2: 위험 등급 판정

| 등급 | 조건 | 행동 |
|------|------|------|
| **GREEN** | 단일 모듈, 데이터 파일 미접근 | 즉시 실행 |
| **YELLOW** | 2-3개 모듈, 의존 방향 일치 (상류→하류) | 실행 계획 1줄 요약 후 실행 |
| **RED** | 타입 변경, 공유 데이터 파일 수정, 4+개 모듈, 순환 의존 | 상세 계획 제시 → 승인 후 실행 |

### Step 3: 실행 전략 결정

```
단일 모듈?
  └─ YES → 바로 실행 (GREEN)
  └─ NO → 모듈 간 의존성 확인
           └─ 독립적? → 병렬 실행
           └─ A가 B를 import? → B 먼저 수정 (순차)
           └─ 타입 변경 포함? → types.ts 먼저, 나머지 후속
           └─ 공유 데이터 파일? → AGENTS.md writer 규칙 확인
```

### Step 4: 트리아지 결과 출력 형식

```
📋 트리아지
  모듈: factcheck, workflow
  위험: YELLOW (2개 모듈, factcheck → workflow 방향)
  계획: factcheck 수정 → build 확인 → workflow 연동 수정
  데이터 파일: 없음
```

RED인 경우에만 상세 계획을 제시하고 승인을 요청한다. GREEN/YELLOW는 요약만 보여주고 바로 진행한다.

### 멀티 태스크 자동 분리

하나의 요청에 독립적인 작업이 여러 개 포함되어 있으면:

1. 각 작업의 터치 모듈을 식별
2. 모듈이 겹치지 않으면 → Task 도구로 병렬 서브에이전트 실행
3. 모듈이 겹치면 → 의존 순서대로 순차 실행
4. 타입 변경이 포함되면 → 타입 먼저 (Phase 1) → 나머지 (Phase 2)

예시:
```
요청: "factcheck에 요약 리포트 추가하고, monitoring 대시보드에 차트 넣어줘"

📋 트리아지
  작업 A: factcheck (모듈: factcheck)
  작업 B: monitoring 대시보드 (모듈: monitoring)
  교차: 없음 → 병렬 실행 가능
  → Task A, Task B 동시 실행
```

## Multi-Agent Collaboration Rules

여러 에이전트가 병렬로 작업할 때의 규칙. 자세한 내용은 `AGENTS.md` 참조.

### 작업 전
- **트리아지 프로토콜 수행** (위 섹션)
- `AGENTS.md` Active Work Log 확인 — 다른 에이전트가 동일 모듈 작업 중인지 확인
- `git status` 확인 — 미커밋 변경 사항과 충돌 가능성 확인
- `npm run build` 통과 확인

### 작업 중
- **모듈 경계 준수**: `AGENTS.md` 레지스트리의 모듈 스코프를 벗어나지 않기
- **공유 데이터 파일 1-writer 원칙**: 한 데이터 파일에는 하나의 writer만 (`AGENTS.md` 참조)
- **CONVENTIONS.md 준수**: 에러 핸들링 패턴, import 규칙, 네이밍 규칙 따르기
- **타입은 append-only**: 기존 인터페이스 필드 삭제/변경 금지 (새 필드 추가만 허용)
- **CLI 명령은 additive**: 기존 명령 동작 변경 금지 (새 명령/옵션 추가만 허용)

### 커밋 전
- `npm run build` 통과 확인
- `AGENTS.md` Recently Completed에 작업 기록
- 새 모듈이나 export 추가 시 `AGENTS.md` 레지스트리 업데이트

### 충돌 방지 원칙
- 데이터 파일(`data/`)은 1-writer 원칙 — 동시 수정 금지
- 타입 파일(`types.ts`)은 append-only — 기존 필드 삭제 금지
- CLI 명령(`src/cli/commands/`)은 additive — 기존 동작 변경 금지
- `config/content-strategy.json`은 StrategyAdjuster만 수정

## data.go.kr 공공 API 사용 규칙

### API 키 처리 (CRITICAL - 반드시 준수)
- **ServiceKey를 URLSearchParams에 넣지 마세요**: data.go.kr 키에 +, =, / 문자가 포함되어 이중 인코딩 오류 발생
- URL 문자열에 직접 삽입: `?serviceKey=${rawKey}&${otherParams}`
- 다른 파라미터는 URLSearchParams 사용 가능
- 공유 클라이언트 사용: `import { getDataGoKrClient } from '../api/data-go-kr/index.js'`

### 일일 쿼터 (CRITICAL)
- 개발 계정: **1,000건/일** (자정 KST 리셋)
- `npm run api:usage`로 사용량 확인 후 배치 작업 실행
- 80%(800건)에서 경고, 100%에서 차단
- factcheck --drafts, collect 등 대량 호출 시 쿼터 소진 주의

### 레이트 리밋
- 요청 간 최소 200ms 딜레이 (DataGoKrClient가 자동 관리)
- 병렬 호출 금지 → 순차 처리만 허용
- 싱글턴 클라이언트(`getDataGoKrClient()`)로 모듈 간 공유

### 응답 처리 주의사항
- resultCode === '0000' 확인 필수
- 빈 결과: items가 빈 문자열('') → 빈 배열 아님
- 단일 결과: items.item이 객체 → 배열이 아님 → `normalizeItems()` 사용
- contentTypeId: 12=관광지, 14=문화시설, 15=축제, 25=여행코스, 32=숙박, 39=음식점

### 캐싱
- 모든 API 응답은 data/api-cache/에 파일 캐시
- 기본 TTL: 검색 60분, 상세정보 6시간, 지역코드 30일, 축제 30분
- `npm run api:cache-clear`로 수동 삭제

### 데이터 정확성 경고
- 축제/행사 일정: API 데이터 지연 가능 → detailCommon2로 최신 확인 후 발행
- 가격 정보: 변동 잦음 → factcheck에서 minor severity로 취급
- 운영시간: 계절별 변경 → "확인 필요" 문구 권장

### 출처 표기 (법적 의무)
- 관광 데이터 사용 시: "출처: 한국관광공사" 표기
- 문화 데이터 사용 시: "출처: 문화체육관광부" 표기
- frontmatter의 dataSources 필드에 기록

### API 모듈 구조
```
src/api/data-go-kr/
  types.ts          # 응답/요청 인터페이스, 에러 클래스, 상수
  rate-limiter.ts   # 일일 쿼터 추적 (data/api-usage.json)
  cache.ts          # 파일 기반 응답 캐시 (data/api-cache/)
  client.ts         # 핵심 API 클라이언트 (DataGoKrClient)
  index.ts          # getDataGoKrClient() 싱글턴 팩토리
```

## Claude Code 팩트체크 워크플로우

API 키 없이 Claude Code 세션 내에서 팩트체크를 수행하는 3단계 프로토콜입니다.
기존 `npm run factcheck` (Gemini API 방식)과 병행 사용 가능합니다.

### Step 1: 클레임 추출

```bash
npm run factcheck:extract -- -f drafts/2026-02-07-post.md
```

stdout에 JSON 출력 — `claims[]` 배열에 검증 대상 목록이 포함됩니다.

### Step 2: Claude Code가 직접 검증

추출된 각 claim을 WebSearch + Claude 지식으로 검증합니다.

**claim.type별 검증 전략**:
| type | 전략 | 이유 |
|------|------|------|
| venue_exists | WebSearch | 장소 존재 확인 |
| location | WebSearch | 주소 정확성 |
| hours | WebSearch | 시의성 중요 |
| event_period | WebSearch | 전시/이벤트 기간 |
| price | WebSearch | 현재 가격 |
| contact | WebSearch | 연락처 |
| transport | Claude 지식 | 안정적 정보 (지하철역 등) |
| facilities | Claude 지식 + WebSearch | 시설 정보 |

**검증 결과 JSON 형식** (`data/factcheck-claude/<slug>-results.json`):

```json
{
  "filePath": "drafts/2026-02-07-post.md",
  "title": "포스트 제목",
  "claims": [],
  "results": [
    {
      "claimId": "ct-0",
      "status": "verified",
      "confidence": 90,
      "source": "web_search",
      "sourceUrl": "https://example.com",
      "details": "검증 근거 설명"
    }
  ]
}
```

`claims` 필드는 Step 1에서 출력된 `claims` 배열을 그대로 복사합니다.

**confidence 기준**:
- 90-100: 공식 사이트에서 직접 확인
- 70-89: 신뢰할 수 있는 출처에서 확인
- 50-69: 간접적 출처 또는 부분 일치
- 0-49: 확인 불가능

**status 값**: `"verified"` | `"false"` | `"unknown"`
- `"false"`인 경우 `correctValue` 필드에 정확한 값을 기록

### Step 3: 보고서 생성

```bash
npm run factcheck:report -- -i data/factcheck-claude/results.json
npm run factcheck:report -- -i data/factcheck-claude/results.json --auto-fix
```

기존 scoring/quality-gate 로직을 그대로 적용하여 FactCheckReport를 생성합니다.
`--auto-fix` 옵션으로 자동 수정도 지원합니다.

## Troubleshooting Reference

See `WORKLOG.md` for detailed:
- Development history and decisions
- Problem resolution records
- Development guidelines and checklists
- API usage tracking
