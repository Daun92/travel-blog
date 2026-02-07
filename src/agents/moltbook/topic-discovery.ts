/**
 * Moltbook 트렌드 기반 주제 발굴 시스템
 */

import { readFile, writeFile, mkdir, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { loadMoltbookConfig, MoltbookConfig } from './index.js';
import SurveyInsightsDBManager from './survey-insights-db.js';

// ============================================================================
// 타입 정의
// ============================================================================

export interface MoltbookTrendingTopic {
  topic: string;
  submolt: 'travel' | 'culture';
  engagementScore: number;
  postCount: number;
  avgUpvotes: number;
  trendDirection: 'rising' | 'stable' | 'declining';
  keywords: string[];
  lastUpdated: string;
}

export interface TopicGap {
  topic: string;
  moltbookEngagement: number;
  blogCoverage: 'none' | 'partial' | 'outdated';
  recommendedPriority: 'high' | 'medium' | 'low';
  suggestedAngles: string[];
  lastBlogPost?: string;
  daysSinceLastPost?: number;
}

export interface TopicRecommendation {
  topic: string;
  type: 'travel' | 'culture';
  score: number;  // 0-200 (enhanced) or 0-100 (legacy)
  source: 'moltbook_trending' | 'gap_analysis' | 'community_request' | 'survey_demand' | 'event_calendar';
  reasoning: string;
  suggestedTitle: string;
  keywords: string[];
  discoveredAt: string;
  /** 점수 내역 (enhanced scorer 사용 시) */
  scoreBreakdown?: {
    base: number;
    surveyBoost: number;
    eventBoost: number;
    seasonalMultiplier: number;
    timeDecay: number;
    performanceFeedback: number;
    final: number;
  };
  /** 자동 배정된 페르소나 */
  personaId?: 'viral' | 'friendly' | 'informative';
  /** 이벤트 연결 메타데이터 */
  eventMeta?: {
    eventId: string;
    eventTitle: string;
    contentType: string;
  };
}

export interface DiscoveryResult {
  trending: MoltbookTrendingTopic[];
  gaps: TopicGap[];
  recommendations: TopicRecommendation[];
  discoveredAt: string;
}

// ============================================================================
// 설정
// ============================================================================

const MOLTBOOK_API = 'https://www.moltbook.com/api/v1';
const DATA_DIR = join(process.cwd(), 'data');
const DISCOVERY_CACHE_PATH = join(DATA_DIR, 'discovery-cache.json');
const BLOG_POSTS_DIR = join(process.cwd(), 'blog/content/posts');

// OpenClaw 블로그 식별 패턴
const OPENCLAW_PATTERNS = [
  'daun92.github.io/travel-blog',
  'openclaw',
  'OpenClaw',
  '오픈클로'
];

// 한국 여행/문화 관련 키워드
const TRAVEL_KEYWORDS = [
  '제주', '서울', '부산', '강릉', '경주', '전주', '대구', '인천', '여수', '속초',
  '카페', '맛집', '여행', '숙소', '렌터카', '코스', '일정', '가격', '비용',
  '드라이브', '야경', '바다', '산', '호텔', '펜션', '캠핑'
];

const CULTURE_KEYWORDS = [
  '전시회', '미술관', '박물관', '공연', '콘서트', '뮤지컬', '연극', '페스티벌',
  '갤러리', '아트', '현대미술', '서점', '북카페', '도서관', '문화센터'
];

// ============================================================================
// OpenClaw 포스트 피드백 타입
// ============================================================================

export interface OpenClawPostFeedback {
  moltbookPostId: string;
  blogUrl: string;
  title: string;
  upvotes: number;
  commentsCount: number;
  sentimentScore: number;  // -100 ~ 100
  topFeedback: string[];
  topicRequests: string[];
  qualityFeedback: string[];
  lastChecked: string;
}

export interface VotePostResult {
  postId: string;
  question: string;
  voteType: 'topic_request' | 'quality_feedback' | 'content_gap' | 'general';
  options: Array<{
    text: string;
    votes: number;
  }>;
  comments: string[];
  extractedTopics: string[];
  extractedAt: string;
}

// ============================================================================
// OpenClaw 포스트 스캐너 (차원 1: 우리 블로그 반응 추적)
// ============================================================================

export class OpenClawPostScanner {
  private config: MoltbookConfig | null;

  constructor(config?: MoltbookConfig | null) {
    this.config = config || null;
  }

  /**
   * Moltbook에서 OpenClaw 관련 포스트 검색
   */
  async scanOpenClawPosts(): Promise<OpenClawPostFeedback[]> {
    const feedbacks: OpenClawPostFeedback[] = [];

    if (!this.config?.apiKey) {
      console.log('⚠️ Moltbook API 키 없음 - 시뮬레이션 데이터 반환');
      return this.generateSimulatedFeedback();
    }

    let apiSuccess = false;

    try {
      // OpenClaw 링크가 포함된 포스트 검색
      for (const pattern of OPENCLAW_PATTERNS) {
        const response = await fetch(
          `${MOLTBOOK_API}/search?q=${encodeURIComponent(pattern)}&type=posts&limit=20`,
          { headers: { 'Authorization': `Bearer ${this.config.apiKey}` } }
        );

        if (!response.ok) continue;

        apiSuccess = true;

        interface SearchResponse {
          posts: Array<{
            id: string;
            title: string;
            content: string;
            upvotes: number;
            comments_count: number;
          }>;
        }

        const data = await response.json() as SearchResponse;
        const posts = data.posts || [];

        for (const post of posts) {
          // 블로그 URL 추출
          const urlMatch = post.content.match(/https?:\/\/daun92\.github\.io\/travel-blog[^\s)]*/);
          if (!urlMatch) continue;

          // 댓글에서 피드백 추출
          const feedback = await this.extractPostFeedback(post.id, urlMatch[0], post);
          if (feedback) {
            feedbacks.push(feedback);
          }
        }
      }
    } catch (error) {
      console.log(`⚠️ OpenClaw 포스트 검색 오류: ${error}`);
      return this.generateSimulatedFeedback();
    }

    // API 성공했지만 결과 없으면 시뮬레이션 데이터 사용
    if (!apiSuccess || feedbacks.length === 0) {
      console.log('   ℹ️ 실제 데이터 없음 - 시뮬레이션 데이터 사용');
      return this.generateSimulatedFeedback();
    }

    return feedbacks;
  }

  /**
   * 특정 포스트의 피드백 추출
   */
  private async extractPostFeedback(
    postId: string,
    blogUrl: string,
    post: { title: string; upvotes: number; comments_count: number }
  ): Promise<OpenClawPostFeedback | null> {
    if (!this.config?.apiKey) return null;

    try {
      const response = await fetch(
        `${MOLTBOOK_API}/posts/${postId}/comments?limit=50`,
        { headers: { 'Authorization': `Bearer ${this.config.apiKey}` } }
      );

      if (!response.ok) return null;

      interface CommentResponse {
        comments: Array<{
          content: string;
          upvotes: number;
        }>;
      }

      const data = await response.json() as CommentResponse;
      const comments = data.comments || [];

      // 감성 분석
      const sentimentScore = this.analyzeSentiment(comments);

      // 피드백 분류
      const topFeedback: string[] = [];
      const topicRequests: string[] = [];
      const qualityFeedback: string[] = [];

      for (const comment of comments) {
        const content = comment.content;

        // 주제 요청 패턴
        if (this.isTopicRequest(content)) {
          topicRequests.push(content.substring(0, 100));
        }
        // 품질 피드백 패턴
        else if (this.isQualityFeedback(content)) {
          qualityFeedback.push(content.substring(0, 100));
        }
        // 일반 피드백 (upvotes 높은 것)
        else if (comment.upvotes >= 2) {
          topFeedback.push(content.substring(0, 100));
        }
      }

      return {
        moltbookPostId: postId,
        blogUrl,
        title: post.title,
        upvotes: post.upvotes,
        commentsCount: post.comments_count,
        sentimentScore,
        topFeedback: topFeedback.slice(0, 5),
        topicRequests: topicRequests.slice(0, 5),
        qualityFeedback: qualityFeedback.slice(0, 5),
        lastChecked: new Date().toISOString()
      };
    } catch {
      return null;
    }
  }

  /**
   * 감성 점수 분석
   */
  private analyzeSentiment(comments: Array<{ content: string; upvotes: number }>): number {
    const positiveWords = ['좋아요', '최고', '굿', '추천', '유용', '도움', '감사', '완벽', '대박'];
    const negativeWords = ['별로', '아쉽', '부족', '틀렸', '오류', '실망', '구리', '쓰레기'];

    let score = 0;
    for (const comment of comments) {
      const content = comment.content;
      const weight = Math.min(3, 1 + comment.upvotes * 0.5);

      for (const word of positiveWords) {
        if (content.includes(word)) score += 10 * weight;
      }
      for (const word of negativeWords) {
        if (content.includes(word)) score -= 10 * weight;
      }
    }

    return Math.max(-100, Math.min(100, score));
  }

  /**
   * 주제 요청 패턴 확인
   */
  private isTopicRequest(content: string): boolean {
    const patterns = [
      /다음에.*다뤄/, /다음.*주제/, /추가.*글/, /더.*알고/,
      /다른.*지역/, /비슷한.*곳/, /관련.*포스팅/, /후속/
    ];
    return patterns.some(p => p.test(content));
  }

  /**
   * 품질 피드백 패턴 확인
   */
  private isQualityFeedback(content: string): boolean {
    const patterns = [
      /정보.*부족/, /사진.*더/, /자세히/, /업데이트/,
      /정확하지/, /오래된/, /링크.*깨/, /수정/
    ];
    return patterns.some(p => p.test(content));
  }

  /**
   * 시뮬레이션 피드백 생성
   */
  private generateSimulatedFeedback(): OpenClawPostFeedback[] {
    return [
      {
        moltbookPostId: 'sim-001',
        blogUrl: 'https://daun92.github.io/travel-blog/posts/2026/02/seoul-museum/',
        title: '서울 박물관 추천',
        upvotes: 15,
        commentsCount: 8,
        sentimentScore: 45,
        topFeedback: ['사진이 예뻐요', '유용한 정보 감사합니다'],
        topicRequests: ['대구 박물관도 다뤄주세요', '어린이 동반 코스 추천'],
        qualityFeedback: ['입장료 정보 업데이트 필요'],
        lastChecked: new Date().toISOString()
      },
      {
        moltbookPostId: 'sim-002',
        blogUrl: 'https://daun92.github.io/travel-blog/posts/2026/02/gangneung-cafe/',
        title: '강릉 카페 투어',
        upvotes: 22,
        commentsCount: 12,
        sentimentScore: 72,
        topFeedback: ['바다뷰 카페 리스트 최고', '덕분에 여행 잘 다녀왔어요'],
        topicRequests: ['속초 카페도 부탁드려요', '양양 서핑 카페 추천'],
        qualityFeedback: ['주차 정보 추가해주세요'],
        lastChecked: new Date().toISOString()
      }
    ];
  }

  /**
   * 피드백에서 주제 추천 추출
   */
  extractTopicRecommendations(feedbacks: OpenClawPostFeedback[]): TopicRecommendation[] {
    const recommendations: TopicRecommendation[] = [];

    for (const fb of feedbacks) {
      // 주제 요청에서 추천 생성
      for (const request of fb.topicRequests) {
        const topic = this.extractTopicFromText(request);
        if (topic) {
          recommendations.push({
            topic,
            type: this.inferType(topic),
            score: 80 + Math.min(10, fb.upvotes / 2),
            source: 'community_request',
            reasoning: `OpenClaw 포스트 댓글 요청 (upvotes: ${fb.upvotes})`,
            suggestedTitle: `${topic} 완벽 가이드`,
            keywords: this.extractRelatedKeywords(topic),
            discoveredAt: new Date().toISOString()
          });
        }
      }
    }

    return recommendations;
  }

  private extractTopicFromText(text: string): string | null {
    const allKeywords = [...TRAVEL_KEYWORDS, ...CULTURE_KEYWORDS];
    for (const keyword of allKeywords) {
      if (text.includes(keyword)) return keyword;
    }
    return null;
  }

  private inferType(topic: string): 'travel' | 'culture' {
    if (CULTURE_KEYWORDS.some(k => topic.includes(k))) return 'culture';
    return 'travel';
  }

  private extractRelatedKeywords(topic: string): string[] {
    return [topic, '여행', '추천', '가이드'];
  }
}

// ============================================================================
// Vote Post 스캐너 (차원 2: 투표/설문 피드백)
// ============================================================================

export class VotePostScanner {
  private config: MoltbookConfig | null;

  constructor(config?: MoltbookConfig | null) {
    this.config = config || null;
  }

  /**
   * Vote/Poll 포스트 검색 및 분석
   */
  async scanVotePosts(submolt?: 'travel' | 'culture'): Promise<VotePostResult[]> {
    const results: VotePostResult[] = [];
    const submolts = submolt ? [submolt] : ['travel', 'culture'] as const;

    if (!this.config?.apiKey) {
      console.log('⚠️ Moltbook API 키 없음 - 로컬 서베이 데이터 확인');
      const localResults = await this.loadActualSurveyResults();
      if (localResults.length > 0) {
        console.log(`   ✓ 로컬 서베이 데이터 ${localResults.length}건 로드`);
        return localResults;
      }
      console.log('   ℹ️ 로컬 데이터 없음 - 시뮬레이션 데이터 반환');
      return this.generateSimulatedVotePosts();
    }

    let apiSuccess = false;

    // 투표/설문 관련 검색어
    const voteQueries = [
      '어떤 주제', '어떤 콘텐츠', '뭐가 궁금', '피드백',
      '설문', '투표', '의견', '원하시는'
    ];

    for (const sub of submolts) {
      for (const query of voteQueries) {
        try {
          const response = await fetch(
            `${MOLTBOOK_API}/submolts/${sub}/search?q=${encodeURIComponent(query)}&limit=10`,
            { headers: { 'Authorization': `Bearer ${this.config.apiKey}` } }
          );

          if (!response.ok) continue;

          apiSuccess = true;

          interface SearchResponse {
            posts: Array<{
              id: string;
              title: string;
              content: string;
            }>;
          }

          const data = await response.json() as SearchResponse;
          const posts = data.posts || [];

          for (const post of posts) {
            if (this.isVotePost(post.title, post.content)) {
              const result = await this.analyzeVotePost(post);
              if (result) results.push(result);
            }
          }
        } catch (error) {
          console.log(`⚠️ Vote 포스트 검색 오류: ${error}`);
        }
      }
    }

    // 중복 제거
    const uniqueResults = results.filter((r, i, arr) =>
      arr.findIndex(x => x.postId === r.postId) === i
    );

    // API 성공했지만 결과 없으면 로컬 데이터 → 시뮬레이션 순서로 폴백
    if (!apiSuccess || uniqueResults.length === 0) {
      const localResults = await this.loadActualSurveyResults();
      if (localResults.length > 0) {
        console.log(`   ✓ 로컬 서베이 데이터 ${localResults.length}건 로드`);
        return localResults;
      }
      console.log('   ℹ️ 실제 데이터 없음 - 시뮬레이션 데이터 사용');
      return this.generateSimulatedVotePosts();
    }

    return uniqueResults;
  }

  /**
   * 투표 포스트인지 확인
   */
  private isVotePost(title: string, content: string): boolean {
    const votePatterns = [
      /어떤.*(주제|콘텐츠|글)/,
      /뭐가.*(궁금|알고\s*싶|보고\s*싶)/,
      /피드백.*부탁/,
      /의견.*주세요/,
      /투표|설문|poll/i,
      /원하시는.*(주제|정보|콘텐츠)/,
      /추천.*해주세요/
    ];

    const combined = title + ' ' + content;
    return votePatterns.some(p => p.test(combined));
  }

  /**
   * Vote 포스트 분석
   */
  private async analyzeVotePost(
    post: { id: string; title: string; content: string }
  ): Promise<VotePostResult | null> {
    // 투표 타입 결정
    const voteType = this.determineVoteType(post.title, post.content);

    // 옵션 추출 (리스트 형태)
    const options = this.extractVoteOptions(post.content);

    // 댓글에서 추가 피드백 수집
    const comments = await this.fetchPostComments(post.id);

    // 주제 추출
    const extractedTopics = this.extractTopicsFromVote(post.content, comments);

    return {
      postId: post.id,
      question: post.title,
      voteType,
      options,
      comments: comments.slice(0, 10),
      extractedTopics,
      extractedAt: new Date().toISOString()
    };
  }

  /**
   * 투표 타입 결정
   */
  private determineVoteType(
    title: string,
    content: string
  ): VotePostResult['voteType'] {
    const combined = title + ' ' + content;

    if (/주제|콘텐츠|글.*원하/.test(combined)) return 'topic_request';
    if (/퀄리티|품질|만족/.test(combined)) return 'quality_feedback';
    if (/부족|없는|필요한/.test(combined)) return 'content_gap';
    return 'general';
  }

  /**
   * 투표 옵션 추출
   */
  private extractVoteOptions(
    content: string
  ): Array<{ text: string; votes: number }> {
    const options: Array<{ text: string; votes: number }> = [];

    // 번호 매겨진 리스트
    const numberedMatches = content.matchAll(/(\d+)[.)]\s*(.+?)(?=\d+[.)]|\n\n|$)/g);
    for (const match of numberedMatches) {
      options.push({ text: match[2].trim(), votes: 0 });
    }

    // 불릿 리스트
    if (options.length === 0) {
      const bulletMatches = content.matchAll(/[-•]\s*(.+?)(?=[-•]|\n\n|$)/g);
      for (const match of bulletMatches) {
        options.push({ text: match[1].trim(), votes: 0 });
      }
    }

    return options.slice(0, 10);
  }

  /**
   * 포스트 댓글 가져오기
   */
  private async fetchPostComments(postId: string): Promise<string[]> {
    if (!this.config?.apiKey) return [];

    try {
      const response = await fetch(
        `${MOLTBOOK_API}/posts/${postId}/comments?limit=30`,
        { headers: { 'Authorization': `Bearer ${this.config.apiKey}` } }
      );

      if (!response.ok) return [];

      interface CommentResponse {
        comments: Array<{ content: string }>;
      }

      const data = await response.json() as CommentResponse;
      return (data.comments || []).map(c => c.content);
    } catch {
      return [];
    }
  }

  /**
   * 투표 내용과 댓글에서 주제 추출
   */
  private extractTopicsFromVote(content: string, comments: string[]): string[] {
    const allKeywords = [...TRAVEL_KEYWORDS, ...CULTURE_KEYWORDS];
    const topics = new Set<string>();

    const allText = content + ' ' + comments.join(' ');

    for (const keyword of allKeywords) {
      if (allText.includes(keyword)) {
        topics.add(keyword);
      }
    }

    return Array.from(topics).slice(0, 10);
  }

  /**
   * 로컬 survey-result.json에서 실제 서베이 데이터 로드
   */
  private async loadActualSurveyResults(): Promise<VotePostResult[]> {
    const surveyPath = join(process.cwd(), 'data', 'feedback', 'survey-result.json');
    if (!existsSync(surveyPath)) return [];

    try {
      const raw = await readFile(surveyPath, 'utf-8');
      const data = JSON.parse(raw) as {
        postId: string;
        title: string;
        totalResponses: number;
        aggregated: {
          topicVotes: Record<string, number>;
          freeTexts: string[];
        };
      };

      if (data.totalResponses === 0) return [];

      const options = Object.entries(data.aggregated.topicVotes)
        .map(([text, votes]) => ({ text, votes }));

      const extractedTopics = options
        .filter(o => o.votes > 0)
        .map(o => o.text.replace(/^\d+\.\s*/, ''));

      return [{
        postId: data.postId,
        question: data.title,
        voteType: 'topic_request' as const,
        options,
        comments: data.aggregated.freeTexts || [],
        extractedTopics,
        extractedAt: new Date().toISOString()
      }];
    } catch {
      return [];
    }
  }

  /**
   * 시뮬레이션 Vote 포스트 생성
   */
  private generateSimulatedVotePosts(): VotePostResult[] {
    return [
      {
        postId: 'vote-001',
        question: '어떤 주제의 여행 콘텐츠를 원하시나요?',
        voteType: 'topic_request',
        options: [
          { text: '숨은 맛집 투어', votes: 45 },
          { text: '가성비 숙소 리뷰', votes: 38 },
          { text: '야경 명소', votes: 32 },
          { text: '현지인 추천 코스', votes: 28 }
        ],
        comments: [
          '대전 맛집도 다뤄주세요',
          '캠핑장 정보가 부족해요',
          '반려동물 동반 여행 정보도 있으면 좋겠어요'
        ],
        extractedTopics: ['맛집', '숙소', '야경', '대전', '캠핑'],
        extractedAt: new Date().toISOString()
      },
      {
        postId: 'vote-002',
        question: '블로그 콘텐츠 퀄리티 어때요?',
        voteType: 'quality_feedback',
        options: [
          { text: '정보가 유용해요', votes: 52 },
          { text: '사진이 예뻐요', votes: 41 },
          { text: '더 자세했으면', votes: 18 },
          { text: '업데이트 필요', votes: 12 }
        ],
        comments: [
          '가격 정보가 오래된 것 같아요',
          '영업시간 확인 부탁드려요',
          '교통편 정보 추가해주세요'
        ],
        extractedTopics: ['가격', '대중교통'],
        extractedAt: new Date().toISOString()
      },
      {
        postId: 'vote-003',
        question: '어떤 문화 콘텐츠가 부족하다고 느끼시나요?',
        voteType: 'content_gap',
        options: [
          { text: '전시회 리뷰', votes: 35 },
          { text: '공연 정보', votes: 28 },
          { text: '북카페/서점', votes: 22 },
          { text: '페스티벌', votes: 19 }
        ],
        comments: [
          '뮤지컬 후기 더 많이 부탁드려요',
          '지방 전시회 정보도 필요해요',
          '인디밴드 공연 정보 있으면 좋겠어요'
        ],
        extractedTopics: ['전시회', '공연', '서점', '뮤지컬', '페스티벌'],
        extractedAt: new Date().toISOString()
      }
    ];
  }

  /**
   * Vote 결과에서 주제 추천 생성
   */
  generateRecommendationsFromVotes(votes: VotePostResult[]): TopicRecommendation[] {
    const recommendations: TopicRecommendation[] = [];

    for (const vote of votes) {
      // 옵션별 추천 생성 (투표 수 기반)
      for (const option of vote.options) {
        if (option.votes >= 20) {
          const topic = this.extractMainTopic(option.text);
          if (topic) {
            recommendations.push({
              topic,
              type: this.inferContentType(topic),
              score: Math.min(95, 60 + option.votes / 2),
              source: 'community_request',
              reasoning: `Vote 포스트 인기 옵션 (${option.votes} votes): "${vote.question}"`,
              suggestedTitle: this.generateTitle(topic, option.text),
              keywords: [topic, '추천', '가이드'],
              discoveredAt: new Date().toISOString()
            });
          }
        }
      }

      // 댓글에서 추가 추천
      for (const comment of vote.comments) {
        const topic = this.extractMainTopic(comment);
        if (topic) {
          recommendations.push({
            topic,
            type: this.inferContentType(topic),
            score: 70,
            source: 'community_request',
            reasoning: `Vote 포스트 댓글 요청: "${comment.substring(0, 50)}"`,
            suggestedTitle: `${topic} 가이드`,
            keywords: [topic],
            discoveredAt: new Date().toISOString()
          });
        }
      }
    }

    // 중복 제거 및 점수순 정렬
    const uniqueMap = new Map<string, TopicRecommendation>();
    for (const rec of recommendations) {
      const existing = uniqueMap.get(rec.topic);
      if (!existing || rec.score > existing.score) {
        uniqueMap.set(rec.topic, rec);
      }
    }

    return Array.from(uniqueMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 15);
  }

  private extractMainTopic(text: string): string | null {
    const allKeywords = [...TRAVEL_KEYWORDS, ...CULTURE_KEYWORDS];
    for (const keyword of allKeywords) {
      if (text.includes(keyword)) return keyword;
    }
    return null;
  }

  private inferContentType(topic: string): 'travel' | 'culture' {
    if (CULTURE_KEYWORDS.some(k => topic.includes(k))) return 'culture';
    return 'travel';
  }

  private generateTitle(topic: string, context: string): string {
    if (context.includes('맛집')) return `${topic} 현지인 추천 맛집 베스트`;
    if (context.includes('숙소') || context.includes('호텔')) return `${topic} 가성비 숙소 추천`;
    if (context.includes('야경')) return `${topic} 야경 명소 총정리`;
    if (context.includes('카페')) return `${topic} 감성 카페 투어`;
    return `${topic} 완벽 가이드`;
  }
}

// ============================================================================
// Moltbook 트렌드 스캐너
// ============================================================================

export class MoltbookTrendScanner {
  private config: MoltbookConfig | null;

  constructor(config?: MoltbookConfig | null) {
    this.config = config || null;
  }

  /**
   * Moltbook에서 트렌딩 토픽 스캔
   */
  async scanTrending(submolt?: 'travel' | 'culture'): Promise<MoltbookTrendingTopic[]> {
    const topics: MoltbookTrendingTopic[] = [];

    // travel과 culture 두 서브몰트 스캔
    const submolts = submolt ? [submolt] : ['travel', 'culture'] as const;

    for (const sub of submolts) {
      const trending = await this.fetchTrendingFromSubmolt(sub);
      topics.push(...trending);
    }

    // engagement 점수로 정렬
    topics.sort((a, b) => b.engagementScore - a.engagementScore);

    return topics;
  }

  /**
   * 특정 서브몰트에서 트렌딩 포스트 가져오기
   */
  private async fetchTrendingFromSubmolt(
    submolt: 'travel' | 'culture'
  ): Promise<MoltbookTrendingTopic[]> {
    if (!this.config?.apiKey) {
      // API 없으면 시뮬레이션 데이터 반환
      return this.generateSimulatedTrending(submolt);
    }

    try {
      const response = await fetch(
        `${MOLTBOOK_API}/submolts/${submolt}/posts?sort=hot&limit=20`,
        { headers: { 'Authorization': `Bearer ${this.config.apiKey}` } }
      );

      if (!response.ok) {
        console.log(`⚠️ Moltbook API 오류: ${response.statusText}`);
        return this.generateSimulatedTrending(submolt);
      }

      interface MoltbookPostResponse {
        posts: Array<{
          id: string;
          title: string;
          upvotes: number;
          comments_count: number;
          created_at: string;
        }>;
      }

      const data = await response.json() as MoltbookPostResponse;
      const posts = data.posts || [];

      // 포스트에서 토픽 추출
      const topicMap = new Map<string, {
        count: number;
        totalEngagement: number;
        keywords: Set<string>;
      }>();

      for (const post of posts) {
        const keywords = this.extractKeywords(post.title, submolt);
        const engagement = post.upvotes + (post.comments_count || 0) * 2;

        for (const keyword of keywords) {
          const existing = topicMap.get(keyword);
          if (existing) {
            existing.count++;
            existing.totalEngagement += engagement;
            keywords.forEach(k => existing.keywords.add(k));
          } else {
            topicMap.set(keyword, {
              count: 1,
              totalEngagement: engagement,
              keywords: new Set(keywords)
            });
          }
        }
      }

      // 토픽으로 변환
      const trending: MoltbookTrendingTopic[] = [];
      for (const [topic, data] of topicMap) {
        if (data.count >= 2) { // 최소 2개 포스트에서 언급
          trending.push({
            topic,
            submolt,
            engagementScore: data.totalEngagement,
            postCount: data.count,
            avgUpvotes: Math.round(data.totalEngagement / data.count),
            trendDirection: this.calculateTrendDirection(data.totalEngagement),
            keywords: Array.from(data.keywords),
            lastUpdated: new Date().toISOString()
          });
        }
      }

      return trending;
    } catch (error) {
      console.log(`⚠️ Moltbook 트렌드 스캔 오류: ${error}`);
      return this.generateSimulatedTrending(submolt);
    }
  }

  /**
   * 키워드 추출
   */
  private extractKeywords(title: string, submolt: 'travel' | 'culture'): string[] {
    const keywords = submolt === 'travel' ? TRAVEL_KEYWORDS : CULTURE_KEYWORDS;
    return keywords.filter(k => title.includes(k));
  }

  /**
   * 트렌드 방향 계산
   */
  private calculateTrendDirection(
    engagement: number
  ): 'rising' | 'stable' | 'declining' {
    // 실제로는 시계열 데이터 분석 필요
    if (engagement > 50) return 'rising';
    if (engagement > 20) return 'stable';
    return 'declining';
  }

  /**
   * 시뮬레이션 트렌딩 데이터 생성
   */
  private generateSimulatedTrending(submolt: 'travel' | 'culture'): MoltbookTrendingTopic[] {
    const now = new Date();
    const month = now.getMonth();

    // 계절별 인기 주제
    const seasonalTopics: Record<string, MoltbookTrendingTopic[]> = {
      travel: [
        // 겨울 (11, 0, 1월)
        ...(month >= 11 || month <= 1 ? [
          { topic: '강릉', submolt: 'travel' as const, engagementScore: 85, postCount: 12, avgUpvotes: 7, trendDirection: 'rising' as const, keywords: ['강릉', '바다', '카페'], lastUpdated: now.toISOString() },
          { topic: '여수', submolt: 'travel' as const, engagementScore: 75, postCount: 8, avgUpvotes: 9, trendDirection: 'stable' as const, keywords: ['여수', '야경', '바다'], lastUpdated: now.toISOString() },
          { topic: '제주', submolt: 'travel' as const, engagementScore: 90, postCount: 15, avgUpvotes: 6, trendDirection: 'rising' as const, keywords: ['제주', '렌터카', '카페'], lastUpdated: now.toISOString() },
        ] : []),
        // 봄 (2, 3, 4월)
        ...(month >= 2 && month <= 4 ? [
          { topic: '경주', submolt: 'travel' as const, engagementScore: 88, postCount: 10, avgUpvotes: 9, trendDirection: 'rising' as const, keywords: ['경주', '벚꽃', '야경'], lastUpdated: now.toISOString() },
          { topic: '전주', submolt: 'travel' as const, engagementScore: 82, postCount: 11, avgUpvotes: 7, trendDirection: 'stable' as const, keywords: ['전주', '한옥마을', '맛집'], lastUpdated: now.toISOString() },
        ] : []),
        // 기본 인기 주제
        { topic: '서울', submolt: 'travel' as const, engagementScore: 70, postCount: 20, avgUpvotes: 4, trendDirection: 'stable' as const, keywords: ['서울', '카페', '맛집'], lastUpdated: now.toISOString() },
        { topic: '부산', submolt: 'travel' as const, engagementScore: 78, postCount: 14, avgUpvotes: 6, trendDirection: 'stable' as const, keywords: ['부산', '바다', '맛집'], lastUpdated: now.toISOString() },
      ],
      culture: [
        { topic: '미술관', submolt: 'culture' as const, engagementScore: 72, postCount: 8, avgUpvotes: 9, trendDirection: 'rising' as const, keywords: ['미술관', '전시회', '현대미술'], lastUpdated: now.toISOString() },
        { topic: '박물관', submolt: 'culture' as const, engagementScore: 68, postCount: 6, avgUpvotes: 11, trendDirection: 'stable' as const, keywords: ['박물관', '전시'], lastUpdated: now.toISOString() },
        { topic: '서점', submolt: 'culture' as const, engagementScore: 65, postCount: 7, avgUpvotes: 9, trendDirection: 'rising' as const, keywords: ['서점', '북카페'], lastUpdated: now.toISOString() },
        { topic: '공연', submolt: 'culture' as const, engagementScore: 60, postCount: 5, avgUpvotes: 12, trendDirection: 'stable' as const, keywords: ['공연', '뮤지컬', '연극'], lastUpdated: now.toISOString() },
      ]
    };

    return seasonalTopics[submolt] || [];
  }
}

// ============================================================================
// 토픽 갭 분석기
// ============================================================================

export class TopicGapAnalyzer {
  /**
   * 블로그 커버리지와 Moltbook 트렌드 간 갭 분석
   */
  async analyzeGaps(trending: MoltbookTrendingTopic[]): Promise<TopicGap[]> {
    const gaps: TopicGap[] = [];
    const blogPosts = await this.loadBlogPosts();

    for (const trend of trending) {
      const coverage = this.checkBlogCoverage(trend.topic, blogPosts);

      // 갭이 있는 경우만 추가
      if (coverage.status !== 'covered') {
        const priority = this.calculatePriority(trend, coverage);

        gaps.push({
          topic: trend.topic,
          moltbookEngagement: trend.engagementScore,
          blogCoverage: coverage.status as 'none' | 'partial' | 'outdated',
          recommendedPriority: priority,
          suggestedAngles: this.suggestAngles(trend),
          lastBlogPost: coverage.lastPost,
          daysSinceLastPost: coverage.daysSince
        });
      }
    }

    // 우선순위로 정렬
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    gaps.sort((a, b) => priorityOrder[a.recommendedPriority] - priorityOrder[b.recommendedPriority]);

    return gaps;
  }

  /**
   * 블로그 포스트 로드
   */
  private async loadBlogPosts(): Promise<Array<{
    path: string;
    title: string;
    date: string;
    keywords: string[];
  }>> {
    const posts: Array<{
      path: string;
      title: string;
      date: string;
      keywords: string[];
    }> = [];

    if (!existsSync(BLOG_POSTS_DIR)) {
      return posts;
    }

    const categories = ['travel', 'culture'];

    for (const cat of categories) {
      const catDir = join(BLOG_POSTS_DIR, cat);
      if (!existsSync(catDir)) continue;

      try {
        const files = await readdir(catDir);
        for (const file of files) {
          if (!file.endsWith('.md')) continue;

          const filePath = join(catDir, file);
          const content = await readFile(filePath, 'utf-8');

          // frontmatter 파싱
          const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
          if (!frontmatterMatch) continue;

          const frontmatter = frontmatterMatch[1];
          const titleMatch = frontmatter.match(/title:\s*["']?(.+?)["']?\n/);
          const dateMatch = frontmatter.match(/date:\s*(\d{4}-\d{2}-\d{2})/);
          const tagsMatch = frontmatter.match(/tags:\s*\[(.*?)\]/);

          posts.push({
            path: filePath,
            title: titleMatch?.[1] || file,
            date: dateMatch?.[1] || '2000-01-01',
            keywords: tagsMatch?.[1]?.split(',').map(t => t.trim().replace(/["']/g, '')) || []
          });
        }
      } catch (error) {
        // 디렉토리 읽기 실패 무시
      }
    }

    return posts;
  }

  /**
   * 블로그 커버리지 확인
   */
  private checkBlogCoverage(
    topic: string,
    posts: Array<{ path: string; title: string; date: string; keywords: string[] }>
  ): { status: string; lastPost?: string; daysSince?: number } {
    const relevantPosts = posts.filter(p =>
      p.title.includes(topic) || p.keywords.some(k => k.includes(topic))
    );

    if (relevantPosts.length === 0) {
      return { status: 'none' };
    }

    // 가장 최근 포스트 찾기
    const sorted = relevantPosts.sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    const lastPost = sorted[0];
    const daysSince = Math.floor(
      (Date.now() - new Date(lastPost.date).getTime()) / (1000 * 60 * 60 * 24)
    );

    // 30일 이상이면 outdated, 아니면 covered
    if (daysSince > 30) {
      return {
        status: 'outdated',
        lastPost: lastPost.title,
        daysSince
      };
    }

    // 1개만 있으면 partial
    if (relevantPosts.length === 1) {
      return {
        status: 'partial',
        lastPost: lastPost.title,
        daysSince
      };
    }

    return { status: 'covered' };
  }

  /**
   * 우선순위 계산
   */
  private calculatePriority(
    trend: MoltbookTrendingTopic,
    coverage: { status: string; daysSince?: number }
  ): 'high' | 'medium' | 'low' {
    // engagement가 높고 커버리지가 없으면 high
    if (trend.engagementScore >= 70 && coverage.status === 'none') {
      return 'high';
    }

    // rising 트렌드는 medium 이상
    if (trend.trendDirection === 'rising') {
      return coverage.status === 'none' ? 'high' : 'medium';
    }

    // outdated는 업데이트 필요
    if (coverage.status === 'outdated' && (coverage.daysSince || 0) > 60) {
      return 'high';
    }

    if (trend.engagementScore >= 50) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * 콘텐츠 앵글 제안
   */
  private suggestAngles(trend: MoltbookTrendingTopic): string[] {
    const angles: string[] = [];

    if (trend.submolt === 'travel') {
      angles.push(
        `${trend.topic} 1박2일 완벽 코스`,
        `${trend.topic} 현지인 추천 맛집`,
        `${trend.topic} 인스타 핫플 투어`
      );

      if (trend.keywords.includes('카페')) {
        angles.push(`${trend.topic} 감성 카페 베스트`);
      }
      if (trend.keywords.includes('야경')) {
        angles.push(`${trend.topic} 로맨틱 야경 명소`);
      }
    } else {
      angles.push(
        `${trend.topic} 입문자 가이드`,
        `${trend.topic} 숨은 명소`,
        `${trend.topic} 데이트 코스`
      );

      if (trend.keywords.includes('전시회')) {
        angles.push(`${trend.topic} 현재 진행 전시 총정리`);
      }
    }

    return angles.slice(0, 3);
  }
}

// ============================================================================
// 토픽 추천기
// ============================================================================

export class TopicRecommender {
  /**
   * 종합 토픽 추천 생성
   */
  generateRecommendations(
    trending: MoltbookTrendingTopic[],
    gaps: TopicGap[],
    communityRequests: string[] = [],
    surveyBoosts?: Record<string, number>,
    eventRecommendations?: TopicRecommendation[]
  ): TopicRecommendation[] {
    const recommendations: TopicRecommendation[] = [];

    // 1. 갭 기반 추천 (최우선)
    for (const gap of gaps.slice(0, 5)) {
      const score = this.calculateScore(gap);

      if (score >= 50) {
        recommendations.push({
          topic: gap.topic,
          type: this.inferType(gap.topic),
          score,
          source: 'gap_analysis',
          reasoning: `블로그 커버리지 ${gap.blogCoverage}, Moltbook engagement ${gap.moltbookEngagement}`,
          suggestedTitle: gap.suggestedAngles[0] || `${gap.topic} 완벽 가이드`,
          keywords: this.extractRelatedKeywords(gap.topic),
          discoveredAt: new Date().toISOString()
        });
      }
    }

    // 2. 트렌딩 기반 추천
    for (const trend of trending.slice(0, 5)) {
      // 이미 갭에서 추천된 토픽은 제외
      if (recommendations.some(r => r.topic === trend.topic)) continue;

      const score = Math.min(100, trend.engagementScore + (trend.trendDirection === 'rising' ? 15 : 0));

      if (score >= 60) {
        recommendations.push({
          topic: trend.topic,
          type: trend.submolt,
          score,
          source: 'moltbook_trending',
          reasoning: `${trend.trendDirection} 트렌드, 평균 ${trend.avgUpvotes} upvotes`,
          suggestedTitle: this.generateTitle(trend),
          keywords: trend.keywords,
          discoveredAt: new Date().toISOString()
        });
      }
    }

    // 3. 커뮤니티 요청 기반 추천
    for (const request of communityRequests.slice(0, 3)) {
      const topic = this.extractTopicFromRequest(request);
      if (!topic) continue;

      // 이미 추천된 토픽은 제외
      if (recommendations.some(r => r.topic === topic)) continue;

      recommendations.push({
        topic,
        type: this.inferType(topic),
        score: 75, // 커뮤니티 요청은 기본 75점
        source: 'community_request',
        reasoning: `커뮤니티 요청: "${request.substring(0, 50)}"`,
        suggestedTitle: `${topic} 가이드: 커뮤니티 추천`,
        keywords: this.extractRelatedKeywords(topic),
        discoveredAt: new Date().toISOString()
      });
    }

    // 서베이 부스트 적용
    if (surveyBoosts && Object.keys(surveyBoosts).length > 0) {
      for (const rec of recommendations) {
        const allKeywords = [rec.topic, ...rec.keywords].join(' ');
        for (const [keyword, boost] of Object.entries(surveyBoosts)) {
          if (allKeywords.includes(keyword)) {
            rec.score = Math.min(200, rec.score + boost);
            rec.reasoning += ` | 서베이 수요 반영 (+${boost})`;
            break; // 키워드당 1회만 부스트
          }
        }
      }
    }

    // 이벤트 기반 추천 병합
    if (eventRecommendations && eventRecommendations.length > 0) {
      for (const eventRec of eventRecommendations) {
        const existing = recommendations.find(r => r.topic === eventRec.topic);
        if (!existing) {
          recommendations.push(eventRec);
        } else if (eventRec.score > existing.score) {
          // 이벤트 점수가 높으면 대체
          Object.assign(existing, {
            score: eventRec.score,
            scoreBreakdown: eventRec.scoreBreakdown,
            personaId: eventRec.personaId,
            eventMeta: eventRec.eventMeta,
            reasoning: `${eventRec.reasoning} | ${existing.reasoning}`
          });
        }
      }
    }

    // 점수로 정렬
    recommendations.sort((a, b) => b.score - a.score);

    return recommendations;
  }

  /**
   * 갭 기반 점수 계산
   */
  private calculateScore(gap: TopicGap): number {
    let score = 50; // 기본 점수

    // engagement 반영
    score += Math.min(30, gap.moltbookEngagement / 3);

    // 커버리지 상태 반영
    if (gap.blogCoverage === 'none') {
      score += 20;
    } else if (gap.blogCoverage === 'outdated') {
      score += 10;
    }

    // 우선순위 반영
    if (gap.recommendedPriority === 'high') {
      score += 10;
    }

    return Math.min(100, score);
  }

  /**
   * 토픽 유형 추론
   */
  private inferType(topic: string): 'travel' | 'culture' {
    if (CULTURE_KEYWORDS.some(k => topic.includes(k))) {
      return 'culture';
    }
    return 'travel';
  }

  /**
   * 관련 키워드 추출
   */
  private extractRelatedKeywords(topic: string): string[] {
    const keywords: string[] = [topic];

    // 연관 키워드 매핑
    const associations: Record<string, string[]> = {
      '제주': ['렌터카', '카페', '바다', '여행'],
      '강릉': ['바다', '카페', '겨울'],
      '전주': ['한옥마을', '맛집', '비빔밥'],
      '경주': ['역사', '야경', '벚꽃'],
      '부산': ['바다', '맛집', '해운대'],
      '미술관': ['전시회', '현대미술', '데이트'],
      '박물관': ['전시', '역사', '문화'],
      '서점': ['북카페', '독서', '취미']
    };

    if (associations[topic]) {
      keywords.push(...associations[topic]);
    }

    return keywords.slice(0, 5);
  }

  /**
   * 제목 생성
   */
  private generateTitle(trend: MoltbookTrendingTopic): string {
    const templates = trend.submolt === 'travel'
      ? [
          `${trend.topic} 여행 완벽 가이드: 현지인 추천 코스`,
          `${trend.topic} 가볼 만한 곳 베스트 10`,
          `${trend.topic} 1박2일 추천 일정`,
        ]
      : [
          `${trend.topic} 입문자를 위한 완벽 가이드`,
          `${trend.topic} 숨은 명소 베스트`,
          `${trend.topic} 데이트 코스 추천`,
        ];

    return templates[Math.floor(Math.random() * templates.length)];
  }

  /**
   * 요청에서 토픽 추출
   */
  private extractTopicFromRequest(request: string): string | null {
    const allKeywords = [...TRAVEL_KEYWORDS, ...CULTURE_KEYWORDS];

    for (const keyword of allKeywords) {
      if (request.includes(keyword)) {
        return keyword;
      }
    }

    return null;
  }
}

// ============================================================================
// 통합 발굴 클래스
// ============================================================================

export interface EnhancedDiscoveryResult extends DiscoveryResult {
  openclawFeedback: OpenClawPostFeedback[];
  votePosts: VotePostResult[];
}

export class TopicDiscovery {
  private scanner: MoltbookTrendScanner;
  private gapAnalyzer: TopicGapAnalyzer;
  private recommender: TopicRecommender;
  private openclawScanner: OpenClawPostScanner;
  private voteScanner: VotePostScanner;

  constructor(config?: MoltbookConfig | null) {
    this.scanner = new MoltbookTrendScanner(config);
    this.gapAnalyzer = new TopicGapAnalyzer();
    this.recommender = new TopicRecommender();
    this.openclawScanner = new OpenClawPostScanner(config);
    this.voteScanner = new VotePostScanner(config);
  }

  /**
   * 전체 발굴 프로세스 실행 (기본)
   */
  async discover(options: {
    submolt?: 'travel' | 'culture';
    includeGaps?: boolean;
    communityRequests?: string[];
    surveyBoosts?: Record<string, number>;
    eventRecommendations?: TopicRecommendation[];
  } = {}): Promise<DiscoveryResult> {
    console.log('🔍 Moltbook 트렌드 스캔 중...');

    // 1. 트렌딩 스캔
    const trending = await this.scanner.scanTrending(options.submolt);
    console.log(`   ✓ ${trending.length}개 트렌딩 토픽 발견`);

    // 2. 갭 분석 (옵션)
    let gaps: TopicGap[] = [];
    if (options.includeGaps !== false) {
      console.log('📊 갭 분석 중...');
      gaps = await this.gapAnalyzer.analyzeGaps(trending);
      console.log(`   ✓ ${gaps.length}개 콘텐츠 갭 발견`);
    }

    // 3. 추천 생성 (이벤트 추천 포함)
    console.log('💡 추천 생성 중...');
    const recommendations = this.recommender.generateRecommendations(
      trending,
      gaps,
      options.communityRequests || [],
      options.surveyBoosts,
      options.eventRecommendations
    );
    console.log(`   ✓ ${recommendations.length}개 주제 추천`);

    const result: DiscoveryResult = {
      trending,
      gaps,
      recommendations,
      discoveredAt: new Date().toISOString()
    };

    // 캐시 저장
    await this.saveCache(result);

    return result;
  }

  /**
   * 2차원 강화 발굴 프로세스 (NEW)
   * - 차원 1: OpenClaw 포스트 피드백 분석
   * - 차원 2: Vote/Poll 포스트 피드백 분석
   */
  async discoverEnhanced(options: {
    submolt?: 'travel' | 'culture';
    includeGaps?: boolean;
    includeOpenClaw?: boolean;
    includeVotePosts?: boolean;
    communityRequests?: string[];
  } = {}): Promise<EnhancedDiscoveryResult> {
    console.log('\n═══════════════════════════════════════════════════');
    console.log('   📡 2차원 강화 주제 발굴 시작');
    console.log('═══════════════════════════════════════════════════\n');

    // 서베이 인사이트 DB 로드
    const surveyDb = new SurveyInsightsDBManager();
    await surveyDb.load();
    const surveyBoosts = surveyDb.getSurveyScoreBoosts();
    if (Object.keys(surveyBoosts).length > 0) {
      console.log(`📊 서베이 부스트 로드: ${Object.keys(surveyBoosts).length}개 키워드`);
    }

    // 기본 발굴 (서베이 부스트 포함)
    const baseResult = await this.discover({
      submolt: options.submolt,
      includeGaps: options.includeGaps,
      communityRequests: options.communityRequests,
      surveyBoosts
    });

    let openclawFeedback: OpenClawPostFeedback[] = [];
    let votePosts: VotePostResult[] = [];
    const additionalRecommendations: TopicRecommendation[] = [];

    // 차원 1: OpenClaw 포스트 피드백 분석
    if (options.includeOpenClaw !== false) {
      console.log('\n🦞 차원 1: OpenClaw 포스트 피드백 분석');
      console.log('──────────────────────────────────────────────────');

      openclawFeedback = await this.openclawScanner.scanOpenClawPosts();
      console.log(`   ✓ ${openclawFeedback.length}개 OpenClaw 포스트 피드백 수집`);

      // 피드백에서 추천 생성
      const openclawRecs = this.openclawScanner.extractTopicRecommendations(openclawFeedback);
      additionalRecommendations.push(...openclawRecs);
      console.log(`   ✓ ${openclawRecs.length}개 주제 요청 추출`);

      // 피드백 요약 출력
      if (openclawFeedback.length > 0) {
        const avgSentiment = openclawFeedback.reduce((sum, f) => sum + f.sentimentScore, 0) / openclawFeedback.length;
        console.log(`   📊 평균 감성 점수: ${avgSentiment.toFixed(0)}/100`);

        const topRequests = openclawFeedback.flatMap(f => f.topicRequests).slice(0, 3);
        if (topRequests.length > 0) {
          console.log(`   💬 주요 주제 요청:`);
          topRequests.forEach(r => console.log(`      • ${r}`));
        }
      }
    }

    // 차원 2: Vote/Poll 포스트 분석
    if (options.includeVotePosts !== false) {
      console.log('\n🗳️  차원 2: Vote/Poll 포스트 피드백 분석');
      console.log('──────────────────────────────────────────────────');

      votePosts = await this.voteScanner.scanVotePosts(options.submolt);
      console.log(`   ✓ ${votePosts.length}개 Vote 포스트 분석`);

      // Vote에서 추천 생성
      const voteRecs = this.voteScanner.generateRecommendationsFromVotes(votePosts);
      additionalRecommendations.push(...voteRecs);
      console.log(`   ✓ ${voteRecs.length}개 투표 기반 주제 추출`);

      // Vote 요약 출력
      if (votePosts.length > 0) {
        const topicRequests = votePosts.filter(v => v.voteType === 'topic_request');
        const qualityFeedback = votePosts.filter(v => v.voteType === 'quality_feedback');
        const contentGaps = votePosts.filter(v => v.voteType === 'content_gap');

        console.log(`   📊 Vote 유형별 현황:`);
        console.log(`      • 주제 요청: ${topicRequests.length}개`);
        console.log(`      • 품질 피드백: ${qualityFeedback.length}개`);
        console.log(`      • 콘텐츠 갭: ${contentGaps.length}개`);

        // 인기 옵션 출력
        const allOptions = votePosts.flatMap(v => v.options)
          .sort((a, b) => b.votes - a.votes)
          .slice(0, 3);
        if (allOptions.length > 0) {
          console.log(`   🔥 인기 투표 옵션:`);
          allOptions.forEach(o => console.log(`      • ${o.text} (${o.votes} votes)`));
        }
      }
    }

    // 서베이 고수요 주제 추가 추천 (기존에 없는 것만)
    const surveyRecs = surveyDb.getStrategyRecommendations();
    const existingTopics = new Set([
      ...baseResult.recommendations.map(r => r.topic),
      ...additionalRecommendations.map(r => r.topic)
    ]);
    for (const topicLabel of surveyRecs.priorityTopics.slice(0, 3)) {
      if (!existingTopics.has(topicLabel)) {
        additionalRecommendations.push({
          topic: topicLabel,
          type: 'culture',
          score: 70,
          source: 'survey_demand',
          reasoning: `서베이 고수요 주제`,
          suggestedTitle: `${topicLabel} 완벽 가이드`,
          keywords: topicLabel.split('/').map(k => k.trim()),
          discoveredAt: new Date().toISOString()
        });
      }
    }

    // 추천 통합 및 중복 제거
    console.log('\n📦 추천 통합 중...');
    const allRecommendations = this.mergeRecommendations(
      baseResult.recommendations,
      additionalRecommendations
    );
    console.log(`   ✓ 총 ${allRecommendations.length}개 통합 추천 생성`);

    const enhancedResult: EnhancedDiscoveryResult = {
      ...baseResult,
      recommendations: allRecommendations,
      openclawFeedback,
      votePosts
    };

    // 캐시 저장
    await this.saveEnhancedCache(enhancedResult);

    // 요약 출력
    console.log('\n═══════════════════════════════════════════════════');
    console.log('   📊 2차원 강화 발굴 완료');
    console.log('═══════════════════════════════════════════════════');
    console.log(`   • 트렌딩 토픽: ${enhancedResult.trending.length}개`);
    console.log(`   • 콘텐츠 갭: ${enhancedResult.gaps.length}개`);
    console.log(`   • OpenClaw 피드백: ${enhancedResult.openclawFeedback.length}개`);
    console.log(`   • Vote 포스트: ${enhancedResult.votePosts.length}개`);
    console.log(`   • 최종 추천: ${enhancedResult.recommendations.length}개`);
    console.log('═══════════════════════════════════════════════════\n');

    return enhancedResult;
  }

  /**
   * 추천 병합 (중복 제거, 점수 통합)
   */
  private mergeRecommendations(
    base: TopicRecommendation[],
    additional: TopicRecommendation[]
  ): TopicRecommendation[] {
    const merged = new Map<string, TopicRecommendation>();

    // 기본 추천 추가
    for (const rec of base) {
      merged.set(rec.topic, rec);
    }

    // 추가 추천 병합 (점수가 높으면 대체)
    for (const rec of additional) {
      const existing = merged.get(rec.topic);
      if (!existing) {
        merged.set(rec.topic, rec);
      } else if (rec.score > existing.score) {
        // 점수가 높으면 대체하되, 소스 정보 추가
        merged.set(rec.topic, {
          ...rec,
          reasoning: `${rec.reasoning} | ${existing.reasoning}`
        });
      }
    }

    return Array.from(merged.values())
      .sort((a, b) => b.score - a.score);
  }

  /**
   * 강화 캐시 저장
   */
  private async saveEnhancedCache(result: EnhancedDiscoveryResult): Promise<void> {
    try {
      await mkdir(DATA_DIR, { recursive: true });
      await writeFile(
        join(DATA_DIR, 'discovery-enhanced-cache.json'),
        JSON.stringify(result, null, 2)
      );
    } catch (error) {
      console.log(`⚠️ 강화 캐시 저장 실패: ${error}`);
    }
  }

  /**
   * 강화 캐시 로드
   */
  async loadEnhancedCache(): Promise<EnhancedDiscoveryResult | null> {
    try {
      const cachePath = join(DATA_DIR, 'discovery-enhanced-cache.json');
      if (!existsSync(cachePath)) return null;

      const content = await readFile(cachePath, 'utf-8');
      return JSON.parse(content) as EnhancedDiscoveryResult;
    } catch {
      return null;
    }
  }

  /**
   * 캐시 저장
   */
  private async saveCache(result: DiscoveryResult): Promise<void> {
    try {
      await mkdir(DATA_DIR, { recursive: true });
      await writeFile(DISCOVERY_CACHE_PATH, JSON.stringify(result, null, 2));
    } catch (error) {
      console.log(`⚠️ 캐시 저장 실패: ${error}`);
    }
  }

  /**
   * 캐시 로드
   */
  async loadCache(): Promise<DiscoveryResult | null> {
    try {
      if (!existsSync(DISCOVERY_CACHE_PATH)) {
        return null;
      }

      const content = await readFile(DISCOVERY_CACHE_PATH, 'utf-8');
      return JSON.parse(content) as DiscoveryResult;
    } catch {
      return null;
    }
  }

  /**
   * 추천을 큐에 추가
   */
  async autoPopulateQueue(
    recommendations: TopicRecommendation[],
    minScore: number = 70,
    maxItems: number = 5
  ): Promise<number> {
    const queuePath = join(process.cwd(), 'config/topic-queue.json');

    // 큐 로드
    let queue: {
      queue: Array<{ title: string; type: 'travel' | 'culture'; meta?: Record<string, unknown> }>;
      discovered?: TopicRecommendation[];
      completed: Array<{ title: string; type: 'travel' | 'culture' }>;
      settings: Record<string, unknown>;
    };

    try {
      const content = await readFile(queuePath, 'utf-8');
      queue = JSON.parse(content);
    } catch {
      queue = {
        queue: [],
        discovered: [],
        completed: [],
        settings: {
          postsPerDay: 2,
          deployDelayHours: 6,
          defaultLength: 'medium',
          enableInlineImages: true,
          inlineImageCount: 3
        }
      };
    }

    // 기존 큐 제목들
    const existingTitles = new Set([
      ...queue.queue.map(t => t.title),
      ...queue.completed.map(t => t.title)
    ]);

    // 적합한 추천 필터링
    const suitable = recommendations.filter(r =>
      r.score >= minScore && !existingTitles.has(r.suggestedTitle)
    );

    // 추가
    let added = 0;
    for (const rec of suitable.slice(0, maxItems)) {
      queue.queue.push({
        title: rec.suggestedTitle,
        type: rec.type,
        meta: {
          score: rec.score,
          source: rec.source,
          discoveredAt: rec.discoveredAt,
          keywords: rec.keywords
        }
      });
      added++;
    }

    // discovered 배열 업데이트
    queue.discovered = recommendations;

    // 저장
    await writeFile(queuePath, JSON.stringify(queue, null, 2));

    return added;
  }
}

export default TopicDiscovery;
