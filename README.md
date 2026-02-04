# 여행 블로그 ✈️

> AI가 생성한 SEO 최적화 여행/문화 콘텐츠 블로그

**블로그 URL:** https://daun92.github.io/travel-blog/

---

## 소개

국내 여행지와 문화 공간을 소개하는 블로그입니다. AI 기술을 활용하여 실용적인 여행 정보와 감성적인 일러스트 이미지를 제공합니다.

### 특징

- 📍 **실용적인 여행 정보**: 교통, 비용, 소요시간 등 계획에 필요한 핵심 정보
- 🗺️ **AI 생성 일러스트**: 코스 지도, 맛집 비교, 버킷리스트 등 맞춤형 인포그래픽
- 🔍 **SEO 최적화**: 검색 엔진에 최적화된 콘텐츠 구조
- 📱 **반응형 디자인**: 모바일, 태블릿, 데스크톱 모두 지원

---

## 콘텐츠

### 여행 (Travel)

| 포스트 | 주요 내용 | AI 이미지 |
|--------|----------|-----------|
| **경주 여행 완벽 가이드** | 황리단길, 대릉원, 동궁과월지 1박2일 코스 | 교통/예산 인포그래픽, 코스 지도, 맛집 가이드 |
| **부산 해운대 맛집 베스트 4** | 오복돼지국밥, 가야밀면, 해성막창, 타이가텐푸라 | 맛집 위치 지도, 메뉴 비교표 |
| **2월 겨울 국내여행 베스트 5** | 평창 눈꽃, 울진 온천, 청양 얼음축제, 제주, 인제 | 전국 지도, 버킷리스트 |
| **서울 북촌한옥마을 가이드** | 북촌 8경, 삼청동 카페, 포토스팟 | 산책 코스 지도, 카페 가이드 |

### 문화 (Culture)

| 포스트 | 주요 내용 | AI 이미지 |
|--------|----------|-----------|
| **국립현대미술관 서울 2026 기획전** | 전시 정보, 관람 포인트, 추천 동선 | 관람 정보, 동선 가이드 |

---

## 기술 스택

### 콘텐츠 생성
- **텍스트**: [Ollama](https://ollama.ai/) + qwen3:8b (로컬 LLM)
- **커버 이미지**: [Unsplash API](https://unsplash.com/developers) (실사 사진)
- **인라인 이미지**: [Google Gemini](https://ai.google.dev/) (AI 생성 인포그래픽)

### 블로그
- **정적 사이트**: [Hugo](https://gohugo.io/)
- **테마**: [PaperMod](https://github.com/adityatelange/hugo-PaperMod)
- **호스팅**: [GitHub Pages](https://pages.github.com/)

### 자동화
- **CLI**: TypeScript + Commander.js
- **워크플로우**: OpenClaw 자동화 시스템

---

## 로컬 실행

```bash
# 1. 저장소 클론
git clone https://github.com/Daun92/travel-blog.git
cd travel-blog

# 2. Hugo 설치 (https://gohugo.io/installation/)
# macOS: brew install hugo
# Windows: choco install hugo-extended

# 3. 로컬 서버 실행
hugo serve -D

# 4. 브라우저에서 접속
# http://localhost:1313/travel-blog/
```

---

## 이미지 스타일

블로그에서 사용하는 AI 생성 이미지 스타일:

| 스타일 | 설명 | 용도 |
|--------|------|------|
| `infographic` | 여행 다이어리 페이지 | 교통, 비용, 시간 요약 |
| `map` | 친구가 그려준 약도 | 추천 코스, 동선 안내 |
| `comparison` | 카페 칠판 메뉴판 | 맛집, 메뉴 비교 |
| `bucketlist` | 게이미피케이션 체크리스트 | 여행 경험 목록 |
| `diagram` | 보물지도 여정 | 교통편, 이동 경로 |
| `moodboard` | 감성 콜라주 | 여행지 분위기 |

---

## 프로젝트 구조

```
travel-blog/
├── hugo.toml           # Hugo 설정
├── content/
│   └── posts/
│       ├── travel/     # 여행 포스트
│       └── culture/    # 문화 포스트
├── static/
│   └── images/         # 커버 및 인라인 이미지
├── themes/
│   └── PaperMod/       # 블로그 테마
└── public/             # 빌드 결과물 (배포용)
```

---

## 라이선스

- **콘텐츠**: CC BY-NC 4.0
- **코드**: MIT License

---

## 관련 프로젝트

- [OpenClaw](https://github.com/Daun92/openclaw) - AI 블로그 자동화 시스템

---

**Made with ❤️ and AI**
