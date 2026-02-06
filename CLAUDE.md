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

### Moltbook Draft Feedback (NEW)
```bash
npm run moltbook:draft             # Share draft for feedback (before publish)
npm run moltbook:draft-feedback    # Collect draft feedback
npm run moltbook:draft-status      # Check pending drafts
```

### Legacy Combined Workflows
```bash
npm run workflow:create   # collect + new
npm run workflow:publish  # publish + moltbook:share
npm run workflow:feedback # moltbook:feedback + moltbook:analyze
```

## 🌟 Premium Content Workflow (권장)

고품질 콘텐츠 발행을 위한 **7단계 표준 프로세스**입니다. 단계를 건너뛰지 마세요.

### 전체 파이프라인 개요
```
1. Agent+Generate → 2. Enhance → 3. Factcheck → 4. Quality → 5. AEO → 6. Image → 7. Publish+Moltbook
       ↑
  에이전트 자동/수동 배정
  (조회영 | 김주말 | 한교양)
```

### Step 1: 에이전트 배정 + 콘텐츠 생성 (Agent + Generate)

주제와 프레이밍에 따라 에이전트가 자동 배정됩니다. `--agent` 플래그로 수동 지정도 가능합니다.

```bash
# 자동 배정 (키워드 매칭으로 에이전트 결정)
npm run new -- -t "서울 핫플 TOP 5" --type travel        # → 조회영 (TOP, 핫플)
npm run new -- -t "경복궁 역사 산책" --type culture       # → 한교양 (역사)
npm run new -- -t "강릉 주말 1박2일" --type travel        # → 김주말 (주말, 1박2일)

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

### Step 7: 발행 + Moltbook (Publish)
```bash
npm run publish                            # Hugo 블로그에 발행
npm run moltbook:share                     # Moltbook 커뮤니티 공유
```

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

### 워크플로우 체크리스트
```
□ 1. npm run new -- -t "주제" --type travel    (에이전트 자동 배정 확인)
      또는 --agent viral|friendly|informative   (수동 지정)
□ 2. npm run enhance -- -f <file>              (에이전트 페르소나 기반 향상)
□ 3. npm run factcheck -- -f <file>            (70% 이상 확인)
□ 4. npm run validate -- -f <file>             (품질 검증)
□ 5. npm run aeo -- -f <file> --apply          (FAQ/Schema 추가)
□ 6. 이미지 경로 확인                           (/travel-blog/ prefix)
□ 7. frontmatter 확인                           (author, personaId 올바른지)
□ 8. npm run publish                            (발행)
□ 9. npm run moltbook:share                     (커뮤니티 공유)
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

**CLI** (`src/cli/`)
- Commander.js-based with commands in `src/cli/commands/`
- Entry point: `src/cli/index.ts`

### Directory Structure
```
src/                    # TypeScript source
  agents/               # External integrations
    collector.ts        # API data collection
    moltbook/           # Moltbook feedback loop
    draft-enhancer/     # ⭐ 페르소나 기반 콘텐츠 향상
  cli/commands/         # CLI command implementations
  generator/            # Content generation (Gemini API)
  images/               # Unsplash integration
  seo/                  # SEO optimization utilities
  aeo/                  # AI Engine Optimization (FAQ, Schema)
  factcheck/            # Fact verification system
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
drafts/                 # Posts awaiting review
```

### Data Flow
```
                      config/personas/index.json
                              ↓ (자동배정 규칙)
External APIs → data/collected/ → [Agent 선택] → src/generator → drafts/
                                  조회영|김주말|한교양              ↓
                                                          [Enhance] 에이전트 페르소나 적용
                                                                   ↓
                                                          [Factcheck] 사실 검증
                                                                   ↓
                                                          [AEO] FAQ + Schema
                                                                   ↓
                                                          blog/content/posts/
                                                                   ↓
                                          Moltbook feedback → config/content-strategy.json
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

## Troubleshooting Reference

See `WORKLOG.md` for detailed:
- Development history and decisions
- Problem resolution records
- Development guidelines and checklists
- API usage tracking
