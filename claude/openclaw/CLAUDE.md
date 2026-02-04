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

### Combined Workflows
```bash
npm run workflow:create   # collect + new
npm run workflow:publish  # publish + moltbook:share
npm run workflow:feedback # moltbook:feedback + moltbook:analyze
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

**CLI** (`src/cli/`)
- Commander.js-based with commands in `src/cli/commands/`
- Entry point: `src/cli/index.ts`

### Directory Structure
```
src/                    # TypeScript source
  agents/               # External integrations (collector, moltbook)
  cli/commands/         # CLI command implementations
  generator/            # Content generation (ollama, prompts)
  images/               # Unsplash integration
  seo/                  # SEO optimization utilities
blog/                   # Hugo blog
  content/posts/        # Published posts (travel/, culture/)
  static/images/        # Post images
  hugo.toml             # Hugo config
config/                 # Runtime config (content-strategy.json)
data/                   # Collected API data, feedback analysis
drafts/                 # Posts awaiting review
```

### Data Flow
```
External APIs → data/collected/ → src/generator → drafts/ → blog/content/posts/
                                                     ↓
                              Moltbook feedback → config/content-strategy.json
```

## Environment Variables

Required:
- `OLLAMA_HOST` - Ollama server URL (default: `http://localhost:11434`)
- `OLLAMA_MODEL` - Model name (default: `qwen3:8b`)

Optional:
- `UNSPLASH_ACCESS_KEY` - Image search (cover images)
- `GEMINI_API_KEY` - Gemini AI image generation (inline images)
- `GEMINI_IMAGE_ENABLED` - Enable inline image generation (default: `false`)
- `HUGO_BASE_URL` - Hugo path prefix (default: `/travel-blog`)
- `KTO_API_KEY` - Korean Tourism API
- `CULTURE_API_KEY` - Culture Portal API

## Content Types

Two primary content categories with different prompt strategies:
- **travel** - Practical info (location, transport, cost), personal tone
- **culture** - Artist/work details, viewing highlights, audience recommendations

Length options: short (1500-2000), medium (2500-3500), long (4000-5000) characters

## Key Patterns

- Ollama generation uses `/no_think` suffix for qwen3 model optimization
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
