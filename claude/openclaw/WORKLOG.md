# OpenClaw 작업 기록 (Worklog)

## 프로젝트 개요

**프로젝트명:** OpenClaw - AI 기반 여행/문화 블로그 자동화 시스템
**목표:** 월 1,000명 방문자 달성 (4개월 내)
**기술 스택:** TypeScript, Hugo, Ollama (로컬 LLM), Gemini API, Unsplash API

---

## 개발 이력

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

### 초안 (drafts/)

| 파일명 | 상태 | 인라인 이미지 |
|--------|------|---------------|
| 2026-02-04-1.md | 검토 대기 | 3장 |
| 2026-02-04-post.md | 검토 대기 | 2장 |
| 2026-02-04-2-5.md | 검토 대기 | - |
| 2026-02-04-4.md | 검토 대기 | - |
| 2026-02-04-5.md | 검토 대기 | - |
| 2026-02-04-best-5-2024.md | 검토 대기 | - |

---

## 이미지 자산

### 생성된 이미지 (blog/static/images/)

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
- 현재 사용: 7장
- 잔여: 43장

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

### 새 포스트 생성
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

### 초안 검토 및 발행
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
# Ollama (필수)
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=qwen3:8b

# Unsplash (커버 이미지)
UNSPLASH_ACCESS_KEY=your-key

# Gemini (인라인 이미지)
GEMINI_API_KEY=your-key
GEMINI_IMAGE_ENABLED=true
GEMINI_IMAGE_MAX_COUNT=50
GEMINI_IMAGE_MODEL=gemini-2.0-flash-exp

# Hugo
HUGO_BASE_URL=/travel-blog
```

---

## 향후 계획

### 단기 (1-2주)
- [ ] 이미지 없는 포스트에 인라인 이미지 추가
- [ ] SEO 최적화 검토
- [ ] GitHub Pages 자동 배포 설정

### 중기 (1개월)
- [ ] Moltbook 피드백 시스템 활성화
- [ ] 키워드 기반 자동 포스트 생성
- [ ] 방문자 분석 연동

### 장기 (3-4개월)
- [ ] 월 1,000 방문자 목표 달성
- [ ] 콘텐츠 전략 자동 조정
- [ ] 다국어 지원

---

## 시행착오 및 문제 해결 기록

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
| `OLLAMA_HOST` | LLM 서버 | `http://localhost:11434` |
| `OLLAMA_MODEL` | LLM 모델 | `qwen3:8b` |
| `GEMINI_API_KEY` | 이미지 생성 | (필수) |
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
