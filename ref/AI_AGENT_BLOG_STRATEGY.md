# AI Agent 블로그 주인장 전략 (Moltbook 커뮤니티 피드백 통합)

> **버전**: 1.0  
> **작성일**: 2026-02-05  
> **플랫폼**: Hugo + GitHub Pages + OpenClaw + Ollama (qwen3:8b)  
> **커뮤니티**: Moltbook (AI 에이전트 소셜 네트워크)

---

## 📋 목차

1. [핵심 전략](#핵심-전략)
2. [불편한 진실](#불편한-진실)
3. [블로그 컨셉](#블로그-컨셉)
4. [시스템 아키텍처](#시스템-아키텍처)
5. [AI Agent 워크플로우](#ai-agent-워크플로우)
6. [Moltbook 피드백 루프](#moltbook-피드백-루프)
7. [콘텐츠 전략](#콘텐츠-전략)
8. [SEO 전략](#seo-전략)
9. [4개월 로드맵](#4개월-로드맵)
10. [구현 가이드](#구현-가이드)

---

## 핵심 전략

### 목표
- **월간 방문자**: 1,000명 (4개월 내)
- **포스팅 빈도**: 주 3-4개 (자동화)
- **비용**: 완전 무료
- **차별화**: 데이터 큐레이션 + 커뮤니티 검증

### 핵심 원칙
```
AI 생성 콘텐츠만으로는 실패
↓
데이터 집계 + 커뮤니티 피드백 = 성공
```

---

## 불편한 진실

### AI 단독 운영의 한계

**절대 이길 수 없는 것들**
- ❌ 직접 경험 블로그 (실제 방문 후기)
- ❌ 실시간 정보 (오늘 영업하는지, 가격 변동)
- ❌ 감성적 공감 (여행의 설렘, 실망)

**AI가 이길 수 있는 영역**
- ✅ 정보 집계/큐레이션 ("서울 전시회 일정 총정리")
- ✅ 데이터 분석 ("2026년 인기 여행지 TOP 20")
- ✅ 가이드/팁 ("제주도 렌터카 가격 비교")
- ✅ 역사/문화 해설 ("경복궁 건축 양식 분석")

### 해결책: 커뮤니티 검증

Moltbook에서 AI 에이전트 커뮤니티의 피드백을 받아 콘텐츠 품질을 개선합니다.

---

## 블로그 컨셉

### 포지셔닝
```
기존: "내가 다녀온 여행 후기" ❌
개선: "AI 큐레이터가 정리한 여행 & 문화예술 데이터베이스" ✅
```

### 슬로건
> "1,000개 블로그를 읽고 정리했습니다"

### 투명성 = 신뢰
```markdown
## About 페이지

**우리는 AI입니다.**

사람이 직접 여행을 다니진 않지만, 대신:
- 1,000개 블로그의 정보를 집계합니다
- 공식 데이터를 실시간으로 확인합니다
- 가격, 시간, 위치를 정확하게 정리합니다
- 매일 정보를 업데이트합니다
- Moltbook 커뮤니티에서 검증받습니다

**우리가 제공하는 가치:**
✅ 공식 데이터 기반 정확성
✅ 다수의 후기를 종합한 인사이트
✅ AI 에이전트 커뮤니티의 검증
✅ 매일 업데이트되는 최신 정보
```

---

## 시스템 아키텍처

```
┌──────────────────────────────────────────────────────────────┐
│                   Blog Automation System                     │
│                  + Moltbook Feedback Loop                    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  1. 데이터 수집    2. 콘텐츠 생성    3. 커뮤니티 검증       │
│  ┌────────────┐   ┌────────────┐   ┌────────────┐           │
│  │ 공공 API   │ → │ Ollama     │ → │ Moltbook   │           │
│  │ 블로그크롤 │   │ qwen3:8b   │   │ 피드백     │           │
│  └────────────┘   └────────────┘   └────────────┘           │
│                                          ↓                   │
│  6. 분석/개선      5. 자동 배포     4. 피드백 반영           │
│  ┌────────────┐   ┌────────────┐   ┌────────────┐           │
│  │ 성과 측정  │ ← │ GitHub     │ ← │ 콘텐츠     │           │
│  │ 전략 조정  │   │ Actions    │   │ 개선       │           │
│  └────────────┘   └────────────┘   └────────────┘           │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## AI Agent 워크플로우

### Phase 1: 데이터 수집 Agent

```javascript
// src/agents/collector.ts

const CollectorAgent = {
  sources: [
    '한국관광공사 API',           // 공식 여행 정보
    '문화체육관광부 API',         // 전시회/행사
    '네이버 블로그 검색 API',     // 실제 후기 트렌드
    '인스타그램 해시태그',        // 핫플 감지
    'Unsplash/Pexels API',       // 무료 이미지
    '기상청 API',                 // 날씨 기반 추천
  ],
  
  workflow: async (keyword) => {
    // 1. 키워드로 다중 소스 검색
    const tourismData = await fetchKTO(keyword)
    const blogTrends = await searchNaverBlogs(keyword)
    const images = await fetchUnsplash(keyword)
    
    // 2. 데이터 검증
    const verified = await verifyFacts(tourismData)
    
    // 3. Ollama에 전달
    return {
      factData: verified,
      trendData: blogTrends,
      images: images
    }
  }
}
```

**CLI 사용 예시:**
```bash
$ npm run collect -- --keyword "서울 전시회"

🔍 데이터 수집 중...
├─ 한국관광공사: 12개 전시회 발견
├─ 문화포털: 8개 추가 정보
├─ 네이버 블로그: 상위 20개 분석
│  └─ 공통 키워드: "무료입장", "주차", "사진촬영"
├─ 이미지: 15장 다운로드 완료
└─ 완료 (8.2초)

📊 수집 결과:
- 전시회 목록: 20개
- 평균 관람 시간: 1.5시간
- 평균 입장료: 12,000원
- 무료 전시회: 5개
```

### Phase 2: 콘텐츠 생성 Agent

```javascript
// src/agents/writer.ts

const WriterPrompt = `
당신은 여행/문화 정보 큐레이터입니다.

**역할:**
- 수집된 데이터를 정리하고 분석
- 객관적이고 실용적인 정보 제공
- 개인 경험이 아닌 "큐레이션"으로 가치 제공

**금지사항:**
- "제가 직접 가봤는데..." 같은 거짓 경험담 ❌
- 확인되지 않은 정보 ❌
- 과장된 표현 ❌

**작성 형식:**
1. 핵심 요약 (3줄)
2. 상세 정보 (표 형식)
3. 실용 팁 (5가지)
4. 관련 링크 (공식 사이트)
5. 출처 명시 (데이터 출처)

**데이터:**
${JSON.stringify(collectedData)}

**키워드:** ${keyword}

위 데이터를 바탕으로 1,500자 분량의 블로그 포스트를 작성하세요.
`;
```

### Phase 3: 검증 Agent

```javascript
// src/agents/verifier.ts

const VerificationChecklist = {
  // 1. 날짜/시간 검증
  dateCheck: (content) => {
    const dates = extractDates(content)
    return dates.every(d => d > new Date())
  },
  
  // 2. 가격 정보 출처
  priceCheck: (content) => {
    const prices = extractPrices(content)
    return prices.every(p => p.source !== null)
  },
  
  // 3. 링크 유효성
  linkCheck: async (content) => {
    const links = extractLinks(content)
    for (let link of links) {
      const status = await fetch(link)
      if (status !== 200) return false
    }
    return true
  },
  
  // 4. AI 감별 회피
  humanizationCheck: (content) => {
    return {
      hasTables: true,
      hasNumbers: true,
      hasSourceLinks: true,
      noFirstPerson: true,
      hasDataAttribution: true
    }
  }
}
```

---

## Moltbook 피드백 루프

### 1. Moltbook 등록

```bash
# AI Agent 등록
curl -X POST https://www.moltbook.com/api/v1/agents/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "TravelCuratorKR",
    "description": "한국 여행/문화 정보를 큐레이션하는 AI 에이전트"
  }'

# 응답에서 API 키 저장
# ~/.config/moltbook/credentials.json
```

### 2. 피드백 수집 워크플로우

```javascript
// src/agents/moltbook.ts

const MoltbookFeedbackLoop = {
  // 단계 1: 블로그 포스트를 Moltbook에 공유
  shareToMoltbook: async (blogPost) => {
    const response = await fetch('https://www.moltbook.com/api/v1/posts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MOLTBOOK_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        submolt: 'travel',  // 또는 'culture'
        title: blogPost.title,
        url: blogPost.url,
        content: blogPost.summary
      })
    })
    
    return response.json()
  },
  
  // 단계 2: 피드백 수집 (4시간마다)
  collectFeedback: async () => {
    // 내 포스트 가져오기
    const myPosts = await fetch('https://www.moltbook.com/api/v1/agents/me', {
      headers: { 'Authorization': `Bearer ${MOLTBOOK_API_KEY}` }
    })
    
    const feedback = []
    
    for (let post of myPosts.recentPosts) {
      // 댓글 가져오기
      const comments = await fetch(
        `https://www.moltbook.com/api/v1/posts/${post.id}/comments`,
        { headers: { 'Authorization': `Bearer ${MOLTBOOK_API_KEY}` } }
      )
      
      feedback.push({
        postId: post.id,
        blogUrl: post.url,
        upvotes: post.upvotes,
        downvotes: post.downvotes,
        engagement: post.upvotes + post.comments.length,
        comments: comments.data,
        topics: extractTopics(post.title),
        sentiment: analyzeSentiment(comments.data)
      })
    }
    
    return feedback
  },
  
  // 단계 3: 피드백 분석
  analyzeFeedback: (feedbackData) => {
    const insights = {
      // 가장 인기 있는 주제
      topTopics: feedbackData
        .sort((a, b) => b.engagement - a.engagement)
        .slice(0, 5)
        .map(f => f.topics),
      
      // 가장 많은 upvote 받은 콘텐츠 유형
      topContentTypes: analyzeContentTypes(feedbackData),
      
      // 커뮤니티가 원하는 정보
      requestedInfo: extractRequests(feedbackData.flatMap(f => f.comments)),
      
      // 개선이 필요한 영역
      improvementAreas: findCriticism(feedbackData.flatMap(f => f.comments)),
      
      // 성공 패턴
      successPatterns: {
        avgUpvotes: average(feedbackData.map(f => f.upvotes)),
        bestPostingTime: findBestTime(feedbackData),
        optimalLength: findOptimalLength(feedbackData)
      }
    }
    
    return insights
  },
  
  // 단계 4: 전략 조정
  adjustStrategy: (insights) => {
    // 콘텐츠 전략 업데이트
    const newStrategy = {
      priorityTopics: insights.topTopics,
      contentFormat: insights.topContentTypes[0],
      focusAreas: insights.requestedInfo,
      improvementPlan: insights.improvementAreas
    }
    
    // 설정 파일 업데이트
    fs.writeFileSync(
      './config/content-strategy.json',
      JSON.stringify(newStrategy, null, 2)
    )
    
    return newStrategy
  }
}
```

### 3. 자동화된 피드백 루프

```javascript
// src/agents/heartbeat.ts

const MoltbookHeartbeat = {
  // 4시간마다 실행
  schedule: '0 */4 * * *',
  
  tasks: async () => {
    // 1. 새 댓글/반응 확인
    const feed = await fetch('https://www.moltbook.com/api/v1/feed?sort=new', {
      headers: { 'Authorization': `Bearer ${MOLTBOOK_API_KEY}` }
    })
    
    // 2. 내 포스트에 달린 댓글에 응답
    const myPosts = await getMyRecentPosts()
    for (let post of myPosts) {
      const newComments = await getUnrepliedComments(post.id)
      
      for (let comment of newComments) {
        // AI가 자동 응답 생성
        if (shouldReply(comment)) {
          const reply = await generateReply(comment)
          await postComment(post.id, reply, comment.id)
        }
      }
    }
    
    // 3. 트렌딩 포스트에서 인사이트 수집
    const trending = await fetch(
      'https://www.moltbook.com/api/v1/posts?sort=hot&limit=20',
      { headers: { 'Authorization': `Bearer ${MOLTBOOK_API_KEY}` } }
    )
    
    const trendingTopics = trending.data
      .filter(p => p.submolt === 'travel' || p.submolt === 'culture')
      .map(p => extractTopics(p.title + ' ' + p.content))
    
    // 4. 시맨틱 검색으로 관련 토론 찾기
    const relevantDiscussions = await fetch(
      'https://www.moltbook.com/api/v1/search?q=여행 정보 추천&type=posts&limit=10',
      { headers: { 'Authorization': `Bearer ${MOLTBOOK_API_KEY}` } }
    )
    
    // 5. 피드백 데이터 저장
    saveFeedbackData({
      timestamp: new Date(),
      trendingTopics,
      relevantDiscussions: relevantDiscussions.results,
      communityRequests: extractRequests(relevantDiscussions.results)
    })
  }
}
```

### 4. CLI 명령어

```json
{
  "scripts": {
    // Moltbook 관련
    "moltbook:register": "ts-node src/agents/moltbook/register.ts",
    "moltbook:share": "ts-node src/agents/moltbook/share.ts",
    "moltbook:feedback": "ts-node src/agents/moltbook/collect-feedback.ts",
    "moltbook:analyze": "ts-node src/agents/moltbook/analyze.ts",
    "moltbook:heartbeat": "ts-node src/agents/moltbook/heartbeat.ts",
    
    // 통합 워크플로우
    "workflow:full": "npm run collect && npm run generate && npm run verify && npm run publish && npm run moltbook:share",
    "workflow:feedback": "npm run moltbook:feedback && npm run moltbook:analyze"
  }
}
```

### 5. 피드백 대시보드

```javascript
// src/analytics/moltbook-dashboard.ts

const MoltbookDashboard = {
  generate: async () => {
    const feedback = await loadFeedbackData()
    
    return {
      // 커뮤니티 반응 요약
      community: {
        totalPosts: feedback.length,
        avgUpvotes: average(feedback.map(f => f.upvotes)),
        avgEngagement: average(feedback.map(f => f.engagement)),
        topPost: feedback.sort((a, b) => b.upvotes - a.upvotes)[0],
        worstPost: feedback.sort((a, b) => a.upvotes - b.upvotes)[0]
      },
      
      // 주제별 성과
      topicPerformance: groupBy(feedback, 'topics'),
      
      // 시간대별 분석
      timeAnalysis: {
        bestDay: findBestDay(feedback),
        bestHour: findBestHour(feedback)
      },
      
      // 액션 아이템
      actionItems: [
        ...generateActionItems(feedback),
        ...extractCommunityRequests(feedback)
      ],
      
      // 다음 포스트 추천
      nextPostSuggestions: recommendNextTopics(feedback)
    }
  }
}
```

### 6. 실시간 리포트 예시

```bash
$ npm run moltbook:analyze

🦞 Moltbook 피드백 분석 (2026-02-05)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 커뮤니티 반응
├─ 포스트 수: 8개
├─ 평균 upvotes: 12.5
├─ 평균 engagement: 18.3
└─ 최고 인기: "제주 렌터카 가격 비교" (34 upvotes)

🔥 인기 주제 TOP 5
1. 렌터카 가격 비교 (34 upvotes, 12 comments)
2. 서울 무료 전시회 (28 upvotes, 8 comments)
3. 부산 카페 추천 (23 upvotes, 15 comments)
4. 제주 한달살기 비용 (19 upvotes, 6 comments)
5. 경주 1박2일 코스 (15 upvotes, 4 comments)

💬 커뮤니티 요청사항
- "강릉 커피 축제 정보 더 주세요" (3명)
- "전시회 할인 받는 법 알려주세요" (2명)
- "겨울 여행지 추천해주세요" (5명)

⚠️  개선 필요
- "가격 정보가 오래됐네요" (제주 렌터카 포스트)
- "이미지가 더 있으면 좋겠어요" (부산 카페 포스트)

📈 성공 패턴
- 최적 포스팅 시간: 오전 9-10시
- 최적 글자수: 1,800-2,200자
- 효과적 포맷: 비교표 + 실용팁

🎯 다음 포스트 추천
1. "강릉 커피 축제 완벽 가이드" (수요 3명)
2. "겨울 여행지 TOP 10 비교" (수요 5명)
3. "전시회 할인 총정리" (수요 2명)
```

---

## 콘텐츠 전략

### 콘텐츠 유형별 전략

#### 1. 데이터 집계형 (승률 90%)

**주제 예시:**
- "제주도 렌터카 가격 비교 2026"
- "서울 박물관 입장료 총정리"
- "전국 벚꽃 개화 시기 예측"

**데이터 소스:**
```javascript
{
  sources: [
    '렌터카 업체 10곳 크롤링',
    '네이버 블로그 후기 50개 분석',
    '시즌별 가격 변동 그래프'
  ],
  output: {
    format: '비교표 + 그래프 + 선택 가이드',
    tone: '객관적, 데이터 중심'
  }
}
```

**Moltbook 공유 전략:**
- Submolt: `travel-data` 또는 `culture-info`
- 제목: "렌터카 가격 완전 비교 - 10개 업체 데이터"
- 요약: 핵심 인사이트 3줄
- 링크: 블로그 전체 글

**기대 피드백:**
- "가격이 정확한가요?"
- "시즌별 차이가 더 크네요"
- "이 데이터 최신인가요?"

**개선 방향:**
- 정기 업데이트 (월 1회)
- 출처 더 명확히 표시
- 시각화 개선

#### 2. 일정 큐레이션형 (승률 80%)

**주제 예시:**
- "서울 1박2일 문화예술 코스"
- "부산 주말 여행 최적 경로"

**데이터 소스:**
```javascript
{
  sources: [
    '구글 맵 API (거리/소요시간)',
    '전시회 일정 (문화포털)',
    '맛집 데이터 (네이버 플레이스)'
  ],
  output: {
    format: '시간표 + 지도 + 예산',
    tone: '실용적, 친절한'
  }
}
```

**Moltbook 공유 전략:**
- Submolt: `travel-guides`
- 제목: "서울 1박2일 문화코스 - 동선 최적화"
- 댓글 유도: "어떤 코스가 가장 궁금하신가요?"

**기대 피드백:**
- "비 오면 어떻게 하나요?"
- "대중교통으로도 가능한가요?"
- "주차는 어디에?"

**개선 방향:**
- 날씨별 대안 추가
- 대중교통 옵션
- 주차 정보 상세화

#### 3. 분석/인사이트형 (승률 70%)

**주제 예시:**
- "2026년 2월 가장 핫한 여행지 TOP 10"
- "요즘 뜨는 카페 트렌드 분석"

**데이터 소스:**
```javascript
{
  sources: [
    '인스타그램 해시태그 증가율',
    '네이버 검색량 추이',
    '항공권 예약 증가율'
  ],
  output: {
    format: '순위 + 트렌드 그래프 + 추천 시기',
    tone: '분석적, 인사이트 제공'
  }
}
```

**Moltbook 공유 전략:**
- Submolt: `travel-trends`
- 제목: "2월 핫플 데이터 분석 - 검색량 기준"
- 토론 유도: "여러분이 생각하는 핫플은?"

**기대 피드백:**
- "예상과 다르네요"
- "이유가 뭘까요?"
- "다음 달 예측도 해주세요"

**개선 방향:**
- 매달 시리즈화
- 예측 정확도 추적
- 커뮤니티 투표 반영

---

## SEO 전략

### Google AI 감별 우회

```javascript
// src/seo/humanizer.ts

const HumanizationTechniques = {
  structure: [
    '표/차트 먼저 (30%)',
    '데이터 해석 (40%)',
    '실용 팁 (20%)',
    '출처/링크 (10%)'
  ],
  
  imperfections: {
    varyLength: true,      // 문장 길이 다양화
    useColloquial: true,   // 구어체 섞기
    addCaveats: true       // 모호함 추가
  },
  
  attribution: {
    every_fact: "~에 따르면",
    every_number: "(출처: ~)",
    link_original: "자세한 내용"
  },
  
  freshness: {
    header: "정보 업데이트: YYYY.MM.DD",
    footer: "가격/운영시간은 변경될 수 있습니다"
  }
}
```

### 비교: AI vs 큐레이션

```markdown
❌ AI 티나는 글:
"제주도는 아름다운 자연경관으로 유명합니다. 
한라산, 성산일출봉 등 다양한 명소가 있습니다."

✅ 데이터 기반 큐레이션:
"네이버 검색량 분석 결과, 2월 제주 여행객의 68%가 
'한라산 눈꽃' 키워드로 검색합니다. (출처: 네이버 데이터랩)

| 명소 | 2월 검색 비중 | 평균 체류시간 |
|------|--------------|--------------|
| 한라산 | 34% | 4.2시간 |
| 성산일출봉 | 28% | 1.5시간 |
| 우도 | 18% | 3시간 |

*데이터 기준: 2026.01.01~01.31, 표본 10만건"
```

---

## 4개월 로드맵

### 1개월: 인프라 구축 + 초기 콘텐츠 (목표: 일 50명)

```bash
Week 1: 시스템 구축
├─ Hugo 블로그 세팅
├─ GitHub Actions 배포 자동화
├─ 데이터 수집 Agent 개발
├─ Ollama qwen3:8b 프롬프트 최적화
└─ Moltbook 등록 및 첫 포스트

Week 2: 데이터 소스 연동
├─ 한국관광공사 API 연동
├─ 문화포털 API 연동
├─ 네이버 검색 API 연동
├─ Unsplash 이미지 API 연동
└─ 크롤링 봇 구축

Week 3-4: 콘텐츠 생산 (50개)
├─ 일 2개 포스트 자동 생성
├─ 키워드: 정보성 ("총정리", "비교", "가격")
├─ Moltbook 매일 공유
└─ 피드백 수집 시작

Moltbook 전략:
- 매일 1개 포스트 공유
- m/travel, m/culture 커뮤니티 활동
- 다른 agent 포스트에 댓글 (주 5회)
- 피드백 주간 분석
```

### 2개월: 롱테일 확장 + 피드백 반영 (목표: 일 300명)

```bash
Week 5-8: 콘텐츠 대량 생산 (추가 70개, 총 120개)

전략: 롱테일 키워드 조합
- "지역 + 시설 + 정보"
- 예: "강릉 카페 주차 가능한 곳"

자동화:
$ npm run generate-longtail -- --region 강릉 --type 카페
> 30개 키워드 조합 생성
> 각 키워드당 포스트 자동 생성

Moltbook 피드백 활용:
1. 주간 피드백 분석
2. 인기 주제 파악
3. 요청사항 우선 생산
4. 개선 사항 즉시 반영

예시:
- 피드백: "가격이 오래됐어요" 
→ 자동 업데이트 스크립트 실행
- 피드백: "이미지 더 필요" 
→ 이미지 개수 5→10개 증가
- 피드백: "주차 정보 추가해주세요" 
→ 주차 정보 섹션 템플릿 추가
```

### 3개월: 시즌 키워드 + 커뮤니티 협업 (목표: 일 700명)

```bash
Week 9-12: 시즌 콘텐츠 (40개)

3월 키워드:
- "벚꽃 명소 2026"
- "봄 축제 일정"
- "3월 가볼만한 곳"

Moltbook 커뮤니티 협업:
1. m/travel-guides submolt 생성
2. 다른 agent와 협업 포스트
   - 예: "5명의 AI가 추천하는 봄 여행지"
3. 커뮤니티 투표 활용
   - "다음 주제 투표" 포스트
4. 인기 댓글 내용화
   - 좋은 질문→새 포스트로 확장

시맨틱 검색 활용:
$ curl "https://www.moltbook.com/api/v1/search?q=여행 정보 추천 필요&type=posts"
→ 사람들이 원하는 정보 파악
→ 즉시 콘텐츠 생성
```

### 4개월: 최적화 + 확장 (목표: 일 1,200명)

```bash
Week 13-16: 업데이트 + 백링크 + 다각화

전략 1: 기존 콘텐츠 업데이트
├─ 2개월 전 포스트 자동 재검증
├─ 가격/운영시간 변경사항 반영
└─ "업데이트: 2026.04.XX" 명시

전략 2: Moltbook 영향력 확대
├─ 월간 "베스트 큐레이션" 시리즈
├─ 다른 agent 멘션/협업
├─ 커뮤니티 이벤트 주최
│  예: "최고의 숨은 명소 투표"
└─ 우수 댓글 포상 (블로그 메인 노출)

전략 3: 외부 링크
├─ Moltbook 인기 포스트→다른 플랫폼 공유
├─ 커뮤니티 요청으로 나무위키 기여
└─ 오픈 데이터 포털 제공

측정 지표:
- Moltbook karma 점수
- 평균 upvotes/post
- 댓글 engagement rate
- 블로그 유입 중 Moltbook 비율
```

---

## 구현 가이드

### 디렉토리 구조

```
openclaw-blog/
├── blog/                      # Hugo 블로그
│   ├── content/posts/
│   │   ├── travel/
│   │   └── culture/
│   ├── static/images/
│   ├── themes/
│   └── config.toml
│
├── src/
│   ├── agents/
│   │   ├── collector.ts       # 데이터 수집
│   │   ├── writer.ts          # 콘텐츠 생성
│   │   ├── verifier.ts        # 검증
│   │   └── moltbook/
│   │       ├── register.ts
│   │       ├── share.ts
│   │       ├── feedback.ts
│   │       └── heartbeat.ts
│   │
│   ├── analytics/
│   │   ├── blog-dashboard.ts
│   │   └── moltbook-dashboard.ts
│   │
│   ├── seo/
│   │   └── optimizer.ts
│   │
│   └── cli/
│       └── commands/
│
├── config/
│   ├── content-strategy.json   # 피드백 기반 전략
│   ├── moltbook-credentials.json
│   └── api-keys.json
│
├── data/
│   ├── feedback/               # Moltbook 피드백 데이터
│   ├── analytics/              # 분석 데이터
│   └── cache/                  # API 캐시
│
├── templates/
│   ├── travel.md
│   └── culture.md
│
└── package.json
```

### 핵심 CLI 명령어

```json
{
  "scripts": {
    // 콘텐츠 생성
    "collect": "ts-node src/agents/collector.ts",
    "generate": "ts-node src/agents/writer.ts",
    "verify": "ts-node src/agents/verifier.ts",
    "publish": "ts-node src/cli/publish.ts",
    
    // Moltbook 통합
    "moltbook:setup": "ts-node src/agents/moltbook/register.ts",
    "moltbook:share": "ts-node src/agents/moltbook/share.ts",
    "moltbook:feedback": "ts-node src/agents/moltbook/feedback.ts",
    "moltbook:analyze": "ts-node src/agents/moltbook/analyze.ts",
    "moltbook:heartbeat": "ts-node src/agents/moltbook/heartbeat.ts",
    
    // 전체 워크플로우
    "workflow:create": "npm run collect && npm run generate && npm run verify",
    "workflow:publish": "npm run publish && npm run moltbook:share",
    "workflow:feedback": "npm run moltbook:feedback && npm run moltbook:analyze",
    
    // 분석 & 리포트
    "report:blog": "ts-node src/analytics/blog-dashboard.ts",
    "report:moltbook": "ts-node src/analytics/moltbook-dashboard.ts",
    "report:full": "npm run report:blog && npm run report:moltbook",
    
    // 유지보수
    "update:old": "ts-node src/maintenance/update-outdated.ts",
    "check:links": "ts-node src/maintenance/check-links.ts"
  }
}
```

### 일일 자동화 스케줄

```yaml
# .github/workflows/daily.yml

name: Daily Automation

on:
  schedule:
    # 매일 오전 9시: 새 콘텐츠 생성
    - cron: '0 0 * * *'  # UTC 00:00 = KST 09:00
    
    # 4시간마다: Moltbook 체크
    - cron: '0 */4 * * *'

jobs:
  morning_content:
    runs-on: ubuntu-latest
    steps:
      - name: Generate new content
        run: npm run workflow:create
      
      - name: Publish to blog & Moltbook
        run: npm run workflow:publish
  
  moltbook_heartbeat:
    runs-on: ubuntu-latest
    steps:
      - name: Check Moltbook
        run: npm run moltbook:heartbeat
      
      - name: Collect feedback
        run: npm run moltbook:feedback
      
      - name: Analyze & adjust
        run: npm run moltbook:analyze
```

---

## 측정 지표

### 블로그 성과

```javascript
{
  traffic: {
    daily: 45,
    weekly: 280,
    monthly: 1050,
    sources: {
      organic: 850,      // 검색
      direct: 120,       // 직접
      moltbook: 80       // Moltbook 유입
    }
  },
  seo: {
    indexedPages: 87,
    avgPosition: 24.5,
    topKeywords: [...]
  }
}
```

### Moltbook 성과

```javascript
{
  community: {
    karma: 245,          // 총 karma
    posts: 32,
    avgUpvotes: 12.5,
    avgComments: 4.2,
    followers: 28
  },
  engagement: {
    responseRate: 0.85,   // 댓글 응답률
    postFrequency: 1.2,   // 일일 포스트
    bestTime: '09:00',
    bestDay: 'Wednesday'
  },
  impact: {
    blogTrafficFromMoltbook: 80,  // 일일
    conversionRate: 0.08,          // 클릭→방문
    topReferringPost: {
      title: "제주 렌터카 비교",
      clicks: 156
    }
  }
}
```

### 통합 대시보드

```bash
$ npm run report:full

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   통합 성과 리포트 (2026-02-05)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 블로그 트래픽
├─ 오늘: 45명
├─ 이번 주: 280명
├─ 이번 달: 1,050명 (목표 대비 105%)
└─ 유입: 검색 81% | 직접 11% | Moltbook 8%

🦞 Moltbook 커뮤니티
├─ Karma: 245 (상위 15%)
├─ 포스트: 32개 (평균 upvotes: 12.5)
├─ 팔로워: 28명 (+3 이번 주)
└─ 댓글 응답률: 85%

🔗 Moltbook → 블로그 유입
├─ 클릭: 156회
├─ 방문: 80명
├─ 전환율: 8%
└─ 최고 포스트: "제주 렌터카 비교"

🎯 액션 아이템 (피드백 기반)
1. "강릉 커피 축제" 콘텐츠 생성 (요청 3회)
2. "제주 렌터카" 포스트 가격 업데이트 (오래됨)
3. "겨울 여행지" 시리즈 시작 (트렌드 상승)

📈 다음 주 목표
├─ 블로그: 일 60명 (+33%)
├─ Moltbook: 평균 upvotes 15+ (현재 12.5)
└─ 신규 콘텐츠: 7개 (피드백 반영)
```

---

## 성공 체크리스트

### Week 1
- [ ] Hugo 블로그 배포 완료
- [ ] GitHub Actions 자동화
- [ ] Moltbook 등록 및 claim
- [ ] 첫 포스트 3개 발행
- [ ] Moltbook에 첫 공유

### Week 4
- [ ] 포스트 50개 달성
- [ ] Moltbook karma 50+
- [ ] 블로그 일 방문자 50명
- [ ] 첫 피드백 분석 완료
- [ ] 전략 1차 조정

### Week 8
- [ ] 포스트 120개 달성
- [ ] Moltbook karma 150+
- [ ] 블로그 일 방문자 300명
- [ ] Moltbook 팔로워 20명+
- [ ] 피드백 기반 개선 5건

### Week 12
- [ ] 포스트 160개 달성
- [ ] Moltbook karma 250+
- [ ] 블로그 일 방문자 700명
- [ ] Submolt 운영 중
- [ ] 협업 포스트 3건

### Week 16
- [ ] **목표 달성: 월 1,000명**
- [ ] Moltbook karma 400+
- [ ] 커뮤니티 영향력 상위 10%
- [ ] 외부 백링크 20개
- [ ] 지속 가능한 자동화 완성

---

## FAQ

### Q1. Moltbook 없이도 되나요?
A. 가능하지만 비추천. Moltbook은:
- 실시간 피드백으로 콘텐츠 품질 개선
- AI 에이전트 간 네트워킹
- 초기 트래픽 확보
- 트렌드 파악

### Q2. 하루에 몇 시간 필요한가요?
A. 초기 세팅 후:
- 자동화된 콘텐츠 생성: 0시간
- Moltbook 커뮤니티 활동: 30분/일
- 피드백 검토 및 전략 조정: 1시간/주

### Q3. API 비용은?
A. 거의 무료:
- Ollama (로컬): 무료
- 한국관광공사 API: 무료
- GitHub Pages: 무료
- Moltbook: 무료
- Unsplash API: 무료 (월 50회)

### Q4. SEO는 언제부터 효과?
A. 타임라인:
- 1개월: 구글 색인 시작
- 2개월: 롱테일 키워드 노출
- 3개월: 트래픽 가시화
- 4개월: 목표 달성

### Q5. AI 감별 우회 가능한가요?
A. 가능:
- 데이터 중심 작성 (경험담 아님)
- 출처 명시 (신뢰도)
- 표/차트 활용
- 커뮤니티 검증 (Moltbook)
- 정기 업데이트

---

## 다음 단계

1. **지금 바로**
   ```bash
   # 1. Hugo 설치
   brew install hugo
   
   # 2. 프로젝트 생성
   hugo new site my-travel-blog
   cd my-travel-blog
   
   # 3. 테마 설치
   git clone https://github.com/adityatelange/hugo-PaperMod themes/PaperMod
   
   # 4. Ollama qwen3 설치
   ollama pull qwen3:8b
   
   # 5. Moltbook 등록
   curl -X POST https://www.moltbook.com/api/v1/agents/register \
     -H "Content-Type: application/json" \
     -d '{"name":"TravelCuratorKR","description":"한국 여행 큐레이터"}'
   ```

2. **1주일 내**
   - GitHub Actions 설정
   - 첫 10개 포스트 생성
   - Moltbook claim 완료
   - 피드백 루프 테스트

3. **1개월 내**
   - 50개 포스트 달성
   - Moltbook 커뮤니티 활동
   - 첫 피드백 분석
   - 전략 조정

---

## 결론

AI Agent 블로그의 성공은 **품질**과 **커뮤니티**에 달려 있습니다.

- ✅ 데이터 기반 큐레이션
- ✅ Moltbook 커뮤니티 검증
- ✅ 지속적인 피드백 반영
- ✅ 투명한 AI 정체성

이 조합으로 월 1,000명은 충분히 달성 가능합니다.

**시작하세요. 피드백받으세요. 개선하세요. 반복하세요.** 🦞

---

**문의 & 피드백**
- Moltbook: @TravelCuratorKR
- GitHub: [프로젝트 저장소]
- Blog: [블로그 URL]
