# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OpenClaw is an AI-powered travel/culture blog automation system. It generates SEO-optimized content using Gemini API, integrates community feedback via Moltbook, and publishes to a Hugo static site hosted on GitHub Pages.

3인 에이전트 필명 시스템으로 운영되는 팀 블로그 형태:
- **조회영** (viral) - 바이럴/공유 유도, 순위/비교 콘텐츠
- **김주말** (friendly) - 직장인 주말 여행, 솔직 체험 후기
- **한교양** (informative) - 교양/해설, 깊이 있는 문화 콘텐츠

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

## 🌟 Premium Content Workflow (권장)

고품질 콘텐츠 발행을 위한 **완전한 콘텐츠 라이프사이클**입니다. 단계를 건너뛰지 마세요.

### 전체 파이프라인 개요
```
┌─ Phase A: 주제 발굴 ──────────────────────────────────────────────────┐
│  0. Survey → Topic Discovery → Queue                                  │
│     (서베이 수집 → 인사이트 분석 → 주제 큐 자동 편성)                 │
└───────────────────────────────────────────────────────────────────────┘
        ↓
┌─ Phase B: 콘텐츠 생산 ──────────────────────────────────────────────────┐
│  1. Agent+Generate → 2. Enhance → 3. Factcheck → 4. Quality → 5. AEO  │
│         ↑                                                               │
│    에이전트 자동/수동 배정                                               │
│    (조회영 | 김주말 | 한교양)                                            │
└───────────────────────────────────────────────────────────────────────┘
        ↓
┌─ Phase C: 발행 + 피드백 루프 ─────────────────────────────────────────┐
│  6. Image → 7. Publish → 8. Moltbook Share → 9. Feedback+Survey      │
│                                                      ↓                │
│                                           content-strategy.json 갱신  │
│                                                      ↓                │
│                                           → Phase A로 순환 ───────────┘
└───────────────────────────────────────────────────────────────────────┘
```

### Step 0: 주제 발굴 (Survey + Topic Discovery)

서베이로 커뮤니티 수요를 파악하고, 주제 큐를 데이터 기반으로 편성합니다.
**이 단계는 주기적(주 1회 권장)으로 실행하며, 매 포스트마다 필수는 아닙니다.**

```bash
# 0-1. 서베이 발행 (Moltbook 커뮤니티에 설문 게시)
npm run moltbook:culture-survey

# 0-2. 응답 수집 (30분 간격, 최대 3시간 자동 폴링)
npm run moltbook:survey-scheduler

# 0-3. 인사이트 DB 적재 (누적 데이터 축적, 중복 방지)
npm run survey ingest

# 0-4. 현황 확인 + 전략 반영
npm run survey status                     # 인기 주제/포맷/지역 확인
npm run survey boost                      # 주제별 점수 부스트 확인
npm run survey apply-strategy             # content-strategy.json 자동 갱신

# 0-5. 주제 큐 편성 (서베이 부스트 반영)
npm run queue discover --auto --gaps      # 갭 분석 + 서베이 반영 자동 발굴
npm run queue list                        # 편성된 주제 큐 확인
```

**서베이 인사이트가 주제 발굴에 미치는 영향**:
- 서베이에서 인기 높은 키워드 → 주제 발굴 점수 +0~30점 부스트
- 인기 포맷(리뷰/큐레이션/코스/비교) → 콘텐츠 전략에 반영
- 관심 지역 → focusAreas로 자동 설정
- 부스트된 주제에 `[서베이]` 태그 자동 부여

**서베이 수집 데이터 구조**:
| 수집 항목 | 설명 | 저장 위치 |
|-----------|------|-----------|
| 주제 수요 (8개 문화 카테고리) | 가중 투표 집계 | `data/survey-insights-db.json` |
| 포맷 선호 (리뷰/큐레이션/코스/비교) | A-D 선택 집계 | `data/survey-insights-db.json` |
| 지역 관심 (40+ 지역) | 언급 빈도 집계 | `data/survey-insights-db.json` |
| 자유 의견 | 원문 보존 | `data/survey-insights-db.json` |
| 수집 원본 | 파싱된 응답 | `data/feedback/survey-result.json` |

### Step 1: 에이전트 배정 + 콘텐츠 생성 (Agent + Generate)

주제와 프레이밍에 따라 에이전트가 자동 배정됩니다. `--agent` 플래그로 수동 지정도 가능합니다.

```bash
# 자동 배정 (키워드 매칭으로 에이전트 결정)
npm run new -- -t "서울 핫플 TOP 5" --type travel        # → 조회영 (TOP, 핫플)
npm run new -- -t "경복궁 역사 산책" --type culture       # → 한교양 (역사)
npm run new -- -t "강릉 주말 1박2일" --type travel        # → 김주말 (주말, 1박2일)

# data.go.kr API 데이터 자동 수집 후 생성 (권장)
npm run new -- -t "제주도 카페" --type travel --auto-collect   # API 데이터 → 프롬프트 주입
npm run new -- -t "서울 전시" --type culture --auto-collect -y # 비대화 + 자동 수집

# 수동 지정
npm run new -- -t "제주도 카페" --type travel --agent viral        # → 조회영 강제
npm run new -- -t "제주도 카페" --type travel --agent informative  # → 한교양 강제
npm run new -- -t "제주도 카페" --type travel --agent friendly     # → 김주말 강제

# 이미지 포함 생성
npm run new -- -t "주제" --type travel --inline-images --image-count 3

npm run drafts                             # 드래프트 목록 확인
```

**에이전트 자동 배정 알고리즘** - 주제가 아니라 **프레이밍**으로 결정:
| 에이전트 | 트리거 키워드 | 프레이밍 |
|----------|--------------|----------|
| 조회영 (viral) | TOP, BEST, 순위, 비교, vs, 최고, 최악, 핫플, 트렌드, SNS, 난리, 화제, 논란, 꼭, 필수 | 순위/비교/화제성 |
| 한교양 (informative) | 역사, 건축, 미술사, 작가, 작품, 해설, 교양, 유네스코, 의미, 배경, 유래, 입문, 가이드, 에티켓 | 깊이/교양/해설 |
| 김주말 (friendly) | 주말, 1박2일, 2박3일, 당일치기, 가성비, 퇴근, 후기, 코스, 웨이팅, 솔직, 실제, 비용 | 체험/실용/주말 |

매칭 없으면 **김주말** 기본값. 같은 "제주도 카페"도 프레이밍에 따라 다른 에이전트가 배정됩니다.

**생성 결과 frontmatter 예시**:
```yaml
author: "조회영 (OpenClaw)"
personaId: "viral"
```

### Step 2: 콘텐츠 향상 (Enhance)
에이전트 페르소나 기반 품질 향상 - 클리셰 제거, 디테일 강화, 개성 부여
```bash
npm run enhance:analyze -- -f <file>       # 분석만 (변경 없음)
npm run enhance -- -f <file>               # 향상 적용
npm run enhance -- --all                   # 모든 드래프트 향상
npm run enhance:dry-run -- -f <file>       # 미리보기 (저장 안함)
```

**3인 에이전트 페르소나** (`config/personas/`):

| 필명 | 역할 | 톤 | 문체 |
|------|------|-----|------|
| **조회영** | 바이럴, 공유 유도 | 도발적, 단정적, 흥분 | 해요체+반말 혼용 |
| **김주말** | 친근감, 장기 팬층 | 솔직, 현실적, 투덜 | 해요체 |
| **한교양** | 유익함, 교양 | 차분, 지적, 해설사 | 합니다체 |

- 클리셰 자동 감지: 각 에이전트별 `never_say` 목록에 따라 감지 및 대체
- 디테일 강화: 에이전트별 `detailing_rules`에 맞춰 숫자, 비교, 구조 강화

### Step 3: 팩트체크 (Factcheck)
AI 생성 콘텐츠의 사실 검증 - **70% 이상 통과 필수**
```bash
npm run factcheck -- -f <file>             # 단일 파일 검증
npm run factcheck -- --drafts              # 모든 드래프트 검증
```

⚠️ **70% 미만 점수**: 부정확한 정보 포함 가능성 높음 → 수동 검토 필요

### Step 4: 품질 검증 (Quality)
SEO, 가독성, 구조 종합 검증
```bash
npm run validate -- -f <file>              # 품질 검증
npm run review                             # SEO 리뷰
```

### Step 5: AEO 적용 (AI Engine Optimization)
FAQ 섹션 + Schema.org 구조화 데이터 추가
```bash
npm run aeo -- -f <file>                   # AEO 분석
npm run aeo -- -f <file> --apply           # AEO 자동 적용
```

**AEO 요소**:
- FAQ 5개 (자주 묻는 질문)
- Schema.org: Article, FAQPage, BreadcrumbList

### Step 6: 이미지 검증/생성 (Image)
커버 이미지 + 인라인 이미지 확인
```bash
# Step 1에서 --inline-images로 이미 생성했으면 경로만 확인
# 이미지 경로가 /travel-blog/ prefix를 포함하는지 검증
```

### Step 7: 발행 (Publish)
```bash
npm run publish                            # Hugo 블로그에 발행
```

### Step 8: Moltbook 공유 + 피드백 수집 (Share + Feedback Loop)
발행 후 커뮤니티에 공유하고, 피드백을 수집하여 다음 콘텐츠 전략에 반영합니다.
```bash
npm run moltbook:share                     # Moltbook 커뮤니티 공유
npm run moltbook:feedback                  # 피드백 수집
npm run moltbook:analyze                   # 전략 자동 조정
```

**피드백 루프 → Phase A 순환**:
- 발행 포스트에 대한 커뮤니티 반응 수집
- `config/content-strategy.json` 자동 갱신
- 다음 서베이/주제 발굴에 반영 → Step 0으로 순환

### 🚀 통합 명령어 (추천)
```bash
# 프리미엄 워크플로우 (전체 파이프라인)
npm run workflow:premium -- -f <file>

# 또는 개별 실행
npm run workflow full -- -f <file> --enhance --apply
```

### 📅 에이전트별 콘텐츠 편성 예시
같은 주제라도 에이전트에 따라 완전히 다른 콘텐츠가 됩니다:

| 주제 | 조회영 | 김주말 | 한교양 |
|------|--------|--------|--------|
| 제주도 카페 | "제주 카페 TOP 10, 인스타 vs 현실" | "퇴근 후 비행기 타고 간 제주 카페 실제 비용" | "제주 카페 건축 이야기, 알면 3배 재미" |
| 국립현대미술관 | "입장료 아깝지 않은 전시 vs 돈낭비 전시" | "퇴근 후 야간개장으로 본 전시, 솔직 후기" | "이건희 컬렉션 핵심 작품 5점의 미술사적 의미" |
| 전주 한옥마을 | "전주 맛집 현지인 vs 관광객, 진짜 승자는?" | "전주 1박2일 총 비용, 웨이팅 포함 현실 후기" | "전주 비빔밥의 역사: 왜 전주여야 하는가" |

### ⚠️ 절대 하지 말 것
1. **드래프트 직접 발행 금지**: enhance, factcheck 없이 publish 실행
2. **팩트체크 스킵 금지**: AI 생성 정보는 오류 가능성 있음
3. **AEO 스킵 금지**: 검색 엔진 최적화 필수
4. **Moltbook 스킵 금지**: 커뮤니티 피드백 → 전략 자동 조정
5. **에이전트 무시 금지**: 반드시 에이전트 필명으로 발행 (author 필드)
6. **서베이 무시 금지**: 주기적 서베이 → 데이터 기반 주제 발굴의 핵심

### 워크플로우 체크리스트

**Phase A: 주제 발굴 (주 1회 권장)**
```
□ 0-1. npm run moltbook:culture-survey         (서베이 발행)
□ 0-2. npm run moltbook:survey-scheduler        (응답 수집, 자동 3시간)
□ 0-3. npm run survey ingest                    (인사이트 DB 적재)
□ 0-4. npm run survey apply-strategy            (전략 자동 갱신)
□ 0-5. npm run queue discover --auto --gaps     (주제 큐 편성)
```

**Phase B: 콘텐츠 생산 (매 포스트)**
```
□ 1. npm run new -- -t "주제" --type travel     (에이전트 자동 배정 확인)
     또는 --agent viral|friendly|informative    (수동 지정)
□ 2. npm run enhance -- -f <file>               (에이전트 페르소나 기반 향상)
□ 3. npm run factcheck -- -f <file>             (70% 이상 확인)
□ 4. npm run validate -- -f <file>              (품질 검증)
□ 5. npm run aeo -- -f <file> --apply           (FAQ/Schema 추가)
□ 6. 이미지 경로 확인                            (/travel-blog/ prefix)
□ 7. frontmatter 확인                            (author, personaId 올바른지)
```

**Phase C: 발행 + 피드백 (매 포스트)**
```
□ 8. npm run publish                             (발행)
□ 9. npm run moltbook:share                      (커뮤니티 공유)
□ 10. npm run moltbook:feedback                  (피드백 수집)
□ 11. npm run moltbook:analyze                   (전략 자동 조정 → Phase A 순환)
```

## Architecture

### Core Systems

**Content Generation Pipeline** (`src/generator/`)
- `index.ts` - Orchestrates: select persona → create prompt → generate → parse SEO → write markdown
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
  images/               # Unsplash integration
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

## Image System (Hybrid)

**Cover Images**: Unsplash API (real photos)
**Inline Images**: Gemini AI generation (illustrated infographics)

```bash
# Generate post with inline images
npm run new -- -t "주제" --type travel --inline-images --image-count 3
```

### Image Styles
- `infographic` - 여행 다이어리 페이지 스타일
- `diagram` - 보물지도 여정 스타일
- `map` - 친구가 그려준 약도 스타일
- `comparison` - 카페 칠판 메뉴판 스타일
- `moodboard` - 감성 콜라주
- `bucketlist` - 게이미피케이션 체크리스트

## Critical Development Rules

### 1. Hugo Image Paths (IMPORTANT)
All image paths MUST include the Hugo baseURL prefix:
```markdown
# CORRECT
image: "/travel-blog/images/cover-xxx.jpg"
![alt](/travel-blog/images/inline-xxx.jpeg)

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

## Troubleshooting Reference

See `WORKLOG.md` for detailed:
- Development history and decisions
- Problem resolution records
- Development guidelines and checklists
- API usage tracking
