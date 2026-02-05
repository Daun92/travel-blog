# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OpenClaw is an AI-powered travel/culture blog automation system. It generates SEO-optimized content using local LLM (Ollama), integrates community feedback via Moltbook, and publishes to a Hugo static site hosted on GitHub Pages.

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
npm run new -- -t "제주도 숨은 카페" --type travel  # Generate post
npm run new -- -t "서울 전시회" --type culture -k "현대미술"
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
1. Generate → 2. Enhance → 3. Factcheck → 4. Quality → 5. AEO → 6. Image → 7. Publish+Moltbook
```

### Step 1: 콘텐츠 생성 (Generate)
```bash
npm run new -- -t "주제" --type travel    # 초안 생성
npm run drafts                             # 드래프트 목록 확인
```

### Step 2: 콘텐츠 향상 (Enhance) ⭐ NEW
페르소나 기반 품질 향상 - 클리셰 제거, 디테일 강화, 개성 부여
```bash
npm run enhance:analyze -- -f <file>       # 분석만 (변경 없음)
npm run enhance -- -f <file>               # 향상 적용
npm run enhance -- --all                   # 모든 드래프트 향상
npm run enhance:dry-run -- -f <file>       # 미리보기 (저장 안함)
```

**페르소나**: "주말탈출러" (config/persona.json)
- 금요일 퇴근 후 ~ 일요일 저녁, 48시간 여행자 관점
- 클리셰 자동 감지: "힐링 여행", "인생샷", "감성 카페" 등 → 구체적 표현으로 대체
- 디테일 강화: 구체적 숫자, 실패담, 비교 분석 추가

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
# 이미지 포함 생성 시
npm run new -- -t "주제" --type travel --inline-images --image-count 3
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

### ⚠️ 절대 하지 말 것
1. **드래프트 직접 발행 금지**: enhance, factcheck 없이 publish 실행
2. **팩트체크 스킵 금지**: AI 생성 정보는 오류 가능성 있음
3. **AEO 스킵 금지**: 검색 엔진 최적화 필수
4. **Moltbook 스킵 금지**: 커뮤니티 피드백 → 전략 자동 조정

### 워크플로우 체크리스트
```
□ 1. npm run new -- 드래프트 생성
□ 2. npm run enhance -- 페르소나 기반 향상
□ 3. npm run factcheck -- 70% 이상 확인
□ 4. npm run validate -- 품질 검증
□ 5. npm run aeo --apply -- FAQ/Schema 추가
□ 6. 이미지 경로 확인 (/travel-blog/ prefix)
□ 7. npm run publish -- 발행
□ 8. npm run moltbook:share -- 커뮤니티 공유
```

## Architecture

### Core Systems

**Content Generation Pipeline** (`src/generator/`)
- `index.ts` - Orchestrates: validate Ollama → create prompt → generate → parse SEO → write markdown
- `ollama.ts` - RESTful client for local Ollama API with streaming support
- `prompts.ts` - Specialized prompts for travel vs. culture content types
- `frontmatter.ts` - Generates Hugo-compatible YAML frontmatter

**Data Collection** (`src/agents/collector.ts`)
- Integrates Korean Tourism API, Culture Portal API
- Falls back to mock data when APIs unavailable
- Outputs JSON to `data/collected/`

**Moltbook Feedback Loop** (`src/agents/moltbook/index.ts`)
- `MoltbookShareAgent` - Posts to travel/culture submolts
- `FeedbackCollector` - Gathers comments, votes, sentiment
- `FeedbackAnalyzer` - Identifies top topics, improvement areas
- `StrategyAdjuster` - Updates `config/content-strategy.json` automatically

**Draft Enhancer** (`src/agents/draft-enhancer/`) ⭐ NEW
- `index.ts` - 페르소나 기반 콘텐츠 향상 에이전트
- `cliche-filter.ts` - 클리셰 감지 및 대체 제안 (severity: high/medium/low)
- `detail-analyzer.ts` - 디테일 수준 분석 (숫자, 실패담, 비교)
- `persona-loader.ts` - 페르소나 설정 로드 (config/persona.json)

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
  persona.json          # ⭐ "주말탈출러" 페르소나 설정
data/                   # Collected API data, feedback analysis
drafts/                 # Posts awaiting review
```

### Data Flow
```
External APIs → data/collected/ → src/generator → drafts/
                                                     ↓
                                              [Enhance] 페르소나 적용
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
- Frontmatter includes SEO fields, tags, categories, and custom metadata (location, visitDate, budget)
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
