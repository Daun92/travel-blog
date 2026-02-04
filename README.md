# 여행/문화예술 블로그 자동화 시스템

> "1,000개 블로그를 읽고 정리했습니다"

AI 기반 블로그 콘텐츠 생성 + Moltbook 커뮤니티 피드백 시스템

## 핵심 전략

```
AI 생성 콘텐츠만으로는 실패
↓
데이터 집계 + 커뮤니티 피드백 = 성공
```

## 목표
- 월간 방문자 **1,000명** (4개월 내)
- 주 **3-4개** 포스트 발행
- **완전 무료** 운영
- **데이터 큐레이션** + **커뮤니티 검증**

## 기술 스택

| 구성요소 | 기술 |
|---------|------|
| 블로그 엔진 | Hugo + PaperMod 테마 |
| 호스팅 | GitHub Pages (무료) |
| AI 엔진 | Ollama (qwen3:8b) |
| 데이터 수집 | 한국관광공사 API, 문화포털 API |
| 이미지 | Unsplash API |
| 커뮤니티 | Moltbook |

## 빠른 시작

### 1. 설치

```bash
# 의존성 설치
npm install

# 환경 변수 설정
cp .env.example .env
# .env 파일을 편집하여 API 키 설정
```

### 2. Ollama 시작

```bash
# Ollama가 설치되어 있어야 합니다
ollama serve

# 모델 다운로드 (최초 1회)
ollama pull qwen3:8b
```

### 3. 시스템 상태 확인

```bash
npm run status
```

### 4. (선택) Moltbook 설정

```bash
npm run moltbook:setup
```

## CLI 명령어

### 콘텐츠 생성

```bash
# 데이터 수집
npm run collect -- -k "제주도 카페"

# 새 포스트 생성
npm run new -- -t "제주도 숨은 카페" --type travel

# 키워드와 함께 생성
npm run new -- -t "서울 전시회 2026" --type culture -k "현대미술,무료전시"
```

### 초안 관리

```bash
# 초안 목록
npm run drafts

# 초안 검토 (SEO 분석 포함)
npm run review

# 발행
npm run publish
```

### 키워드 추천

```bash
# 전체 키워드 추천
npm run keywords

# 카테고리별 추천
npm run keywords -- -c travel
npm run keywords -- -c culture
```

### Moltbook 커뮤니티

```bash
# 초기 설정
npm run moltbook:setup

# 포스트 공유
npm run moltbook:share

# 피드백 수집 & 분석
npm run moltbook:feedback

# 빠른 상태 체크 (4시간마다)
npm run moltbook:heartbeat

# 현재 전략 확인
npm run moltbook:analyze
```

### 통합 워크플로우

```bash
# 데이터 수집 + 포스트 생성
npm run workflow:create

# 발행 + Moltbook 공유
npm run workflow:publish

# 피드백 수집 + 분석
npm run workflow:feedback
```

### Hugo 로컬 서버

```bash
# 로컬 미리보기
npm run hugo:serve

# 빌드
npm run hugo:build
```

## 디렉토리 구조

```
openclaw/
├── blog/                      # Hugo 블로그
│   ├── content/posts/         # 포스트
│   │   ├── travel/            # 여행
│   │   └── culture/           # 문화예술
│   ├── static/images/         # 이미지
│   └── hugo.toml              # Hugo 설정
├── src/
│   ├── agents/
│   │   ├── collector.ts       # 데이터 수집 Agent
│   │   └── moltbook/          # Moltbook 통합
│   ├── generator/             # 콘텐츠 생성
│   ├── cli/                   # CLI 도구
│   ├── images/                # 이미지 처리
│   └── seo/                   # SEO 최적화
├── config/
│   ├── content-strategy.json  # 피드백 기반 전략
│   └── moltbook-credentials.json
├── data/
│   ├── feedback/              # Moltbook 피드백
│   └── collected/             # 수집 데이터
├── templates/                 # 포스트 템플릿
├── drafts/                    # 검토 대기 초안
├── VISION.md                  # 프로젝트 비전
└── package.json
```

## 일일 워크플로우

```
1. 키워드 선정       npm run keywords
       ↓
2. 데이터 수집       npm run collect -- -k "키워드"
       ↓
3. 콘텐츠 생성       npm run new -- -t "주제" --type travel
       ↓
4. 검토/편집         npm run review
       ↓
5. 발행             npm run publish
       ↓
6. Moltbook 공유    npm run moltbook:share
       ↓
7. 피드백 분석       npm run moltbook:feedback
       ↓
8. 전략 조정         (자동)
```

## 콘텐츠 전략

### 이길 수 있는 영역

| 콘텐츠 유형 | 성공률 | 예시 |
|------------|--------|------|
| 데이터 집계형 | 90% | "제주도 렌터카 가격 비교 2026" |
| 일정 큐레이션형 | 80% | "서울 1박2일 문화예술 코스" |
| 분석/인사이트형 | 70% | "2026년 인기 여행지 TOP 10" |

### SEO 최적화

- **제목**: 30-60자, 구체적 숫자/장소 포함
- **메타 설명**: 100-160자
- **본문**: 1,500자 이상
- **소제목**: H2 3-5개
- **출처 명시**: 모든 데이터에 출처 표기

## 4개월 로드맵

| 기간 | 목표 | 전략 |
|------|------|------|
| 1개월 | 일 50명 | 구글 인덱싱, 기본 콘텐츠 50개 |
| 2개월 | 일 300명 | 롱테일 키워드, Moltbook 피드백 |
| 3개월 | 일 700명 | 시즌 키워드, 커뮤니티 협업 |
| 4개월 | 월 1,000명 | 콘텐츠 업데이트, 백링크 |

## 환경 변수

| 변수 | 설명 | 필수 |
|------|------|------|
| `OLLAMA_HOST` | Ollama 서버 주소 | O |
| `OLLAMA_MODEL` | 사용할 모델 | O |
| `UNSPLASH_ACCESS_KEY` | Unsplash API 키 | X |
| `KTO_API_KEY` | 한국관광공사 API 키 | X |
| `CULTURE_API_KEY` | 문화포털 API 키 | X |

## Moltbook이란?

AI 에이전트 소셜 네트워크입니다.
블로그 포스트를 공유하고 다른 AI 에이전트들의 피드백을 받아 콘텐츠 품질을 개선할 수 있습니다.

**피드백 루프**:
```
블로그 포스트 → Moltbook 공유 → 커뮤니티 피드백 → 전략 자동 조정
```

## FAQ

### Q: Moltbook 없이도 되나요?
A: 가능합니다. 하지만 Moltbook을 사용하면:
- 실시간 피드백으로 콘텐츠 품질 개선
- AI 에이전트 간 네트워킹
- 초기 트래픽 확보
- 트렌드 파악

### Q: 하루에 몇 시간 필요한가요?
A: 초기 세팅 후:
- 자동화된 콘텐츠 생성: 0시간
- 검토 및 편집: 30분/일
- Moltbook 활동: 30분/일
- 피드백 검토: 1시간/주

### Q: API 비용은?
A: 거의 무료:
- Ollama (로컬): 무료
- 한국관광공사 API: 무료
- GitHub Pages: 무료
- Moltbook: 무료
- Unsplash API: 무료 (월 50회)

## 라이선스

MIT License

---

**시작하세요. 피드백받으세요. 개선하세요. 반복하세요.** 🦞
