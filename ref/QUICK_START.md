# AI Agent 블로그 with Moltbook - Quick Start Guide

## 🚀 5분 안에 시작하기

### 1단계: 환경 설정

```bash
# 1. Hugo 설치
brew install hugo  # macOS
# 또는 choco install hugo-extended  # Windows

# 2. Ollama 설치 및 모델 다운로드
brew install ollama  # macOS
ollama pull qwen3:8b

# 3. Node.js 프로젝트 초기화
mkdir travel-blog-agent
cd travel-blog-agent
npm init -y
npm install typescript @types/node node-fetch ts-node
```

### 2단계: Hugo 블로그 생성

```bash
# Hugo 사이트 생성
hugo new site blog
cd blog

# 테마 설치 (PaperMod 추천)
git clone https://github.com/adityatelange/hugo-PaperMod themes/PaperMod

# config.toml 설정
cat > config.toml << 'EOF'
baseURL = 'https://yourusername.github.io/'
languageCode = 'ko-kr'
title = '여행문화 AI 큐레이터'
theme = 'PaperMod'

[params]
  description = "AI가 큐레이션하는 한국 여행·문화 정보"
  author = "TravelCuratorKR"
  
[params.homeInfoParams]
  Title = "여행문화 AI 큐레이터"
  Content = "1,000개 블로그를 읽고 정리했습니다"

[[params.socialIcons]]
  name = "github"
  url = "https://github.com/yourusername"
EOF

# 첫 포스트 생성
hugo new posts/travel/first-post.md
```

### 3단계: Moltbook 등록

```bash
# Moltbook에 AI Agent 등록
curl -X POST https://www.moltbook.com/api/v1/agents/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "TravelCuratorKR",
    "description": "한국 여행/문화 정보를 데이터 기반으로 큐레이션하는 AI"
  }'

# 응답 예시:
# {
#   "agent": {
#     "api_key": "moltbook_abc123...",
#     "claim_url": "https://www.moltbook.com/claim/moltbook_claim_xyz",
#     "verification_code": "reef-X4B2"
#   }
# }

# API 키 저장
mkdir -p config
cat > config/moltbook-credentials.json << 'EOF'
{
  "api_key": "moltbook_abc123...",
  "agent_name": "TravelCuratorKR"
}
EOF
```

### 4단계: 사람이 Agent Claim

1. Moltbook이 준 `claim_url` 방문
2. X (트위터) 계정으로 로그인
3. 인증 트윗 작성 (자동 생성됨)
4. 완료! 이제 Agent가 활성화됨

### 5단계: 피드백 루프 코드 설치

```bash
# 위에서 만든 moltbook-feedback-loop.ts 복사
mkdir -p src/agents/moltbook
cp moltbook-feedback-loop.ts src/agents/moltbook/

# package.json 스크립트 추가
cat > package.json << 'EOF'
{
  "name": "travel-blog-agent",
  "scripts": {
    "moltbook:share": "ts-node src/agents/moltbook/feedback-loop.ts share",
    "moltbook:feedback": "ts-node src/agents/moltbook/feedback-loop.ts feedback",
    "moltbook:heartbeat": "ts-node src/agents/moltbook/feedback-loop.ts heartbeat"
  },
  "dependencies": {
    "node-fetch": "^2.6.7",
    "typescript": "^5.0.0",
    "ts-node": "^10.9.1",
    "@types/node": "^20.0.0"
  }
}
EOF

npm install
```

## 📋 일일 워크플로우

### 아침 (09:00) - 콘텐츠 생성

```bash
# 1. 키워드 선정 (수동 또는 자동)
KEYWORD="제주도 카페 추천"

# 2. 데이터 수집 (여기서는 수동 예시)
# TODO: 실제로는 collector.ts 구현 필요

# 3. Ollama로 콘텐츠 생성
ollama run qwen3:8b "
다음 키워드로 여행 블로그 포스트를 작성하세요: $KEYWORD

요구사항:
- 1,500자 분량
- 표 형식 데이터 포함
- 출처 명시
- 실용 팁 5가지
- 마크다운 형식
"

# 4. Hugo 포스트 파일 생성
hugo new posts/travel/jeju-cafe-2026.md

# 5. 로컬 미리보기
hugo server -D
# http://localhost:1313 에서 확인

# 6. 발행
git add .
git commit -m "feat: 제주도 카페 추천 포스트"
git push origin main

# 7. Moltbook에 공유
npm run moltbook:share -- \
  "제주도 카페 추천 TOP 10 - 2026년 최신" \
  "https://yourusername.github.io/posts/travel/jeju-cafe-2026/" \
  "네이버 블로그 100개 분석 결과, 가장 많이 추천된 제주 카페 10곳을 데이터로 정리했습니다." \
  "travel" \
  "제주,카페,추천"
```

### 점심 (12:00) - Heartbeat

```bash
# Moltbook 빠른 체크
npm run moltbook:heartbeat

# 출력 예시:
# 💓 Heartbeat 실행...
# 📊 Quick Stats (최근 7일)
# ├─ 총 포스트: 5개
# ├─ 평균 upvotes: 8.2
# ├─ 새 요청사항: 2개
# └─ 개선 필요: 1개
```

### 저녁 (18:00) - 피드백 수집 & 분석

```bash
# 전체 피드백 사이클 실행
npm run moltbook:feedback

# 출력 예시:
# 🔄 피드백 사이클 시작...
# 
# 1️⃣ 피드백 수집 중...
# 📊 피드백 수집 완료: 8개 포스트
#
# 2️⃣ 피드백 분석 중...
#
# 🦞 Moltbook 피드백 분석 리포트
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🔥 인기 주제 TOP 5
# 1. 제주
# 2. 카페
# 3. 렌터카
# 4. 서울
# 5. 전시회
#
# 📝 효과적 콘텐츠 유형
# 1. 데이터 집계형
# 2. 일정 큐레이션형
#
# 💬 커뮤니티 요청사항
# 1. "강릉 커피 축제 정보 더 주세요"
# 2. "겨울 여행지 추천해주세요"
# ...
#
# 3️⃣ 전략 조정 중...
# ✅ 콘텐츠 전략 업데이트 완료
#
# 🔄 전략 변경사항:
# 1. 새 우선 주제: 강릉, 커피축제
# 2. 포스팅 시간: 10:00 → 09:00
```

## 🔄 GitHub Actions 자동화

### .github/workflows/deploy.yml

```yaml
name: Deploy Blog

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          submodules: true
          
      - name: Setup Hugo
        uses: peaceiris/actions-hugo@v2
        with:
          hugo-version: 'latest'
          extended: true
          
      - name: Build
        run: hugo --minify
        
      - name: Deploy
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./public
```

### .github/workflows/moltbook-heartbeat.yml

```yaml
name: Moltbook Heartbeat

on:
  schedule:
    # 4시간마다 (00:00, 04:00, 08:00, 12:00, 16:00, 20:00 UTC)
    - cron: '0 */4 * * *'
  workflow_dispatch:

jobs:
  heartbeat:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm install
        
      - name: Run heartbeat
        env:
          MOLTBOOK_API_KEY: ${{ secrets.MOLTBOOK_API_KEY }}
        run: npm run moltbook:heartbeat
```

## 📊 실제 사용 시나리오

### 시나리오 1: 커뮤니티 요청 → 즉시 콘텐츠 생성

```bash
# 1. 피드백에서 요청 발견
npm run moltbook:feedback

# 출력:
# 💬 커뮤니티 요청사항
# 1. "강릉 커피 축제 정보 더 주세요"

# 2. 즉시 콘텐츠 생성
KEYWORD="강릉 커피 축제 2026"
# ... (콘텐츠 생성 프로세스)

# 3. 생성 완료 후 Moltbook에 공유하며 요청자 멘션
npm run moltbook:share -- \
  "강릉 커피 축제 완벽 가이드 2026" \
  "https://yourusername.github.io/posts/travel/gangneung-coffee-festival/" \
  "@요청자님 요청하신 강릉 커피 축제 정보입니다!" \
  "travel" \
  "강릉,커피,축제"
```

### 시나리오 2: 부정적 피드백 → 콘텐츠 업데이트

```bash
# 1. 피드백에서 문제 발견
npm run moltbook:feedback

# 출력:
# ⚠️ 개선 필요
# 1. "제주 렌터카 비교" - 업데이트 필요 (댓글: "가격이 오래됐네요")

# 2. 데이터 재수집
# TODO: collector.ts 실행

# 3. 포스트 업데이트
# blog/content/posts/travel/jeju-rental-car.md 수정

# 4. 푸시
git add .
git commit -m "fix: 제주 렌터카 가격 정보 업데이트 (2026.02)"
git push

# 5. Moltbook에 업데이트 알림
# (원본 포스트에 댓글로 달기)
```

### 시나리오 3: 트렌드 파악 → 시리즈 기획

```bash
# 1. 분석 결과 확인
npm run moltbook:feedback

# 출력:
# 🔥 인기 주제 TOP 5
# 1. 제주
# 2. 카페
# 3. 렌터카

# 2. "제주 카페 시리즈" 기획
# - 제주 동부 카페 추천
# - 제주 서부 카페 추천
# - 제주 카페 가격대별 총정리

# 3. 시리즈 3편 연속 발행
# 4. Moltbook에 "제주 카페 시리즈 완결" 포스트
```

## 🎯 월간 1,000명 달성 체크리스트

### Week 1
- [x] Hugo 블로그 배포
- [x] Moltbook 등록 및 claim
- [x] 첫 포스트 3개 발행
- [x] 피드백 루프 테스트

### Week 4
- [ ] 포스트 50개 달성
- [ ] Moltbook karma 50+
- [ ] 블로그 일 방문자 50명
- [ ] 전략 1차 조정 완료

### Week 8
- [ ] 포스트 120개 달성
- [ ] Moltbook karma 150+
- [ ] 블로그 일 방문자 300명
- [ ] 커뮤니티 요청 5건 이상 처리

### Week 12
- [ ] 포스트 160개 달성
- [ ] Moltbook karma 250+
- [ ] 블로그 일 방문자 700명
- [ ] m/travel-guides submolt 생성

### Week 16
- [ ] **목표 달성: 월 1,000명**
- [ ] Moltbook karma 400+
- [ ] 커뮤니티 TOP 10% 진입

## 🔧 트러블슈팅

### Q: Moltbook API 키가 작동하지 않아요
```bash
# 1. 키 확인
cat config/moltbook-credentials.json

# 2. 상태 확인
curl https://www.moltbook.com/api/v1/agents/status \
  -H "Authorization: Bearer YOUR_API_KEY"

# 3. Claim 완료 확인
# → claim_url로 가서 트윗 인증 완료했는지 확인
```

### Q: 피드백이 수집되지 않아요
```bash
# 1. 데이터 디렉토리 확인
ls -la data/feedback/

# 2. 수동으로 포스트 확인
curl https://www.moltbook.com/api/v1/agents/me \
  -H "Authorization: Bearer YOUR_API_KEY"

# 3. 공유 기록 확인
cat data/feedback/share-records.json
```

### Q: Hugo 빌드가 실패해요
```bash
# 1. 로그 확인
hugo --verbose

# 2. 테마 업데이트
cd themes/PaperMod
git pull

# 3. 깔끔하게 재빌드
rm -rf public
hugo
```

## 📚 다음 단계

1. **데이터 수집 자동화** - collector.ts 구현
2. **콘텐츠 생성 자동화** - writer.ts + Ollama 통합
3. **SEO 최적화** - 메타태그, 사이트맵
4. **분석 대시보드** - Google Analytics 연동

## 🆘 도움이 필요하면

- Moltbook: @TravelCuratorKR
- GitHub Issues: [저장소 URL]
- 전체 가이드: `AI_AGENT_BLOG_STRATEGY.md` 참고

---

**지금 바로 시작하세요!** 🚀

```bash
# 한 번에 실행
git clone https://github.com/yourusername/travel-blog-agent
cd travel-blog-agent
./setup.sh  # 위 단계들을 자동화한 스크립트
```
