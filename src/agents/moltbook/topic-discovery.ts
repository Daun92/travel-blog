/**
 * Moltbook 트렌드 기반 주제 발굴 시스템
 */

import { readFile, writeFile, mkdir, readdir } from 'fs/promises';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { loadMoltbookConfig, MoltbookConfig } from './index.js';
import type { DiversityTargets } from './index.js';
import SurveyInsightsDBManager from './survey-insights-db.js';
import { ContentBalancer } from './content-balancer.js';
import type { WorkflowEventBus } from '../../workflow/event-bus.js';

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

/** 콘텐츠 프레이밍 유형 — 제목/앵글의 접근 방식 분류 */
export type FramingType =
  | 'list_ranking'   // 순위/리스트 (TOP N, 베스트, vs)
  | 'deep_dive'      // 심층 탐구 (역사, 의미, 해설)
  | 'experience'     // 체험/후기 (1박2일, 솔직 후기, 비용)
  | 'seasonal'       // 시즌/시의성 (2월, 겨울, 벚꽃)
  | 'comparison'     // 비교/분석 (vs, 장단점, 현실 vs 기대)
  | 'local_story'    // 로컬 스토리 (주민 인터뷰, 숨은 골목, 동네 이야기)
  | 'niche_digging'; // 취향 디깅 (다층 탐구, 숨은 디테일, 매니아 시점)

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
  personaId?: 'viral' | 'friendly' | 'informative' | 'niche';
  /** 콘텐츠 프레이밍 유형 */
  framingType?: FramingType;
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
// Seed Pool 타입 정의
// ============================================================================

export interface TopicSeedPool {
  locations: Record<string, SeedLocation>;
  concepts: ConceptTheme[];
}

export interface SeedLocation {
  name: string;
  region: string;
  tier: 'mainstream' | 'secondary' | 'niche';
  nameQualifier?: string;
  angles: SeedAngle[];
}

export interface SeedAngle {
  title: string;
  framingType: string;
  type: 'travel' | 'culture';
  suggestedAgents: string[];
  keywords: string[];
  seasonalRelevance: string | null;
}

export interface ConceptTheme {
  id: string;
  titleTemplate: string;
  type: 'travel' | 'culture';
  framingType: string;
  locations: string[];
  keywords: string[];
  suggestedAgents: string[];
  minLocations: number;
  description: string;
}

// ============================================================================
// Event Seeds 확장 타입
// ============================================================================

interface HolidayTheme {
  title: string;
  type: 'travel' | 'culture';
  framingType: string;
  agents: string[];
}

interface Holiday {
  date: string;
  name: string;
  themes: HolidayTheme[];
}

interface Anniversary {
  date: string;
  name: string;
  yearStarted: number;
  themes: HolidayTheme[];
}

interface EventSeeds {
  annualEvents: unknown[];
  seasonalTemplates: unknown[];
  holidays?: Holiday[];
  anniversaries?: Anniversary[];
  monthlyHooks?: Record<string, string[]>;
}

// ============================================================================
// Seed Pool 로더 (lazy, cached)
// ============================================================================

let _seedPoolCache: TopicSeedPool | null = null;
let _eventSeedsCache: EventSeeds | null = null;

function loadSeedPool(): TopicSeedPool {
  if (_seedPoolCache) return _seedPoolCache;
  try {
    const raw = readFileSync(join(process.cwd(), 'config/topic-seed-pool.json'), 'utf-8');
    _seedPoolCache = JSON.parse(raw) as TopicSeedPool;
    return _seedPoolCache;
  } catch {
    _seedPoolCache = { locations: {}, concepts: [] };
    return _seedPoolCache;
  }
}

function loadEventSeeds(): EventSeeds {
  if (_eventSeedsCache) return _eventSeedsCache;
  try {
    const raw = readFileSync(join(process.cwd(), 'config/event-seeds.json'), 'utf-8');
    _eventSeedsCache = JSON.parse(raw) as EventSeeds;
    return _eventSeedsCache;
  } catch {
    _eventSeedsCache = { annualEvents: [], seasonalTemplates: [] };
    return _eventSeedsCache;
  }
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

// 일반 여행 키워드 (지역명은 seed pool에서 동적 추출)
const GENERIC_TRAVEL_KEYWORDS = [
  '카페', '맛집', '여행', '숙소', '렌터카', '코스', '일정', '가격', '비용',
  '드라이브', '야경', '바다', '산', '호텔', '펜션', '캠핑'
];

/** seed pool에서 전체 지역명을 추출하여 GENERIC과 합산 */
function getExpandedTravelKeywords(): string[] {
  const pool = loadSeedPool();
  const locationNames = Object.values(pool.locations).map(loc => loc.name);
  // 중복 제거
  return [...new Set([...locationNames, ...GENERIC_TRAVEL_KEYWORDS])];
}

// 하위 호환: 기존 TRAVEL_KEYWORDS 참조를 유지
const TRAVEL_KEYWORDS = getExpandedTravelKeywords();

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
            suggestedTitle: `${topic} 솔직 탐방기`,
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
   * 시뮬레이션 트렌딩 데이터 생성 — seed pool 기반 다양성 샘플링
   */
  private generateSimulatedTrending(submolt: 'travel' | 'culture'): MoltbookTrendingTopic[] {
    const now = new Date();
    const month = now.getMonth();
    const pool = loadSeedPool();
    const locations = Object.values(pool.locations);

    if (submolt === 'culture') {
      // culture는 기존 카테고리 기반 유지
      return [
        { topic: '미술관', submolt: 'culture', engagementScore: 72, postCount: 8, avgUpvotes: 9, trendDirection: 'rising', keywords: ['미술관', '전시회', '현대미술'], lastUpdated: now.toISOString() },
        { topic: '박물관', submolt: 'culture', engagementScore: 68, postCount: 6, avgUpvotes: 11, trendDirection: 'stable', keywords: ['박물관', '전시'], lastUpdated: now.toISOString() },
        { topic: '서점', submolt: 'culture', engagementScore: 65, postCount: 7, avgUpvotes: 9, trendDirection: 'rising', keywords: ['서점', '북카페'], lastUpdated: now.toISOString() },
        { topic: '공연', submolt: 'culture', engagementScore: 60, postCount: 5, avgUpvotes: 12, trendDirection: 'stable', keywords: ['공연', '뮤지컬', '연극'], lastUpdated: now.toISOString() },
      ];
    }

    // travel: seed pool 기반 다양성 샘플링
    const seasonMap: Record<string, number[]> = {
      winter: [11, 0, 1],
      spring: [2, 3, 4],
      summer: [5, 6, 7],
      autumn: [8, 9, 10],
    };

    const currentSeason = Object.entries(seasonMap).find(([, months]) =>
      months.includes(month)
    )?.[0] || 'spring';

    const results: MoltbookTrendingTopic[] = [];
    const usedRegions = new Set<string>();

    // 1. 계절 부스트 지역 2~3개
    const seasonalLocs = locations.filter(loc =>
      loc.angles.some(a => a.seasonalRelevance === currentSeason && a.type === 'travel')
    );
    const shuffledSeasonal = shuffleArray([...seasonalLocs]);
    for (const loc of shuffledSeasonal.slice(0, 3)) {
      if (usedRegions.has(loc.region)) continue;
      usedRegions.add(loc.region);
      const angle = loc.angles.find(a => a.seasonalRelevance === currentSeason && a.type === 'travel')!;
      results.push({
        topic: loc.name, submolt: 'travel',
        engagementScore: 80 + Math.floor(Math.random() * 15),
        postCount: 8 + Math.floor(Math.random() * 8),
        avgUpvotes: 6 + Math.floor(Math.random() * 5),
        trendDirection: 'rising',
        keywords: angle.keywords,
        lastUpdated: now.toISOString(),
      });
    }

    // 2. 메인스트림 2개 (미사용 리전에서)
    const mainstream = locations.filter(loc =>
      loc.tier === 'mainstream' && !usedRegions.has(loc.region)
    );
    for (const loc of shuffleArray([...mainstream]).slice(0, 2)) {
      usedRegions.add(loc.region);
      const angle = loc.angles.find(a => a.type === 'travel') || loc.angles[0];
      results.push({
        topic: loc.name, submolt: 'travel',
        engagementScore: 70 + Math.floor(Math.random() * 15),
        postCount: 10 + Math.floor(Math.random() * 10),
        avgUpvotes: 4 + Math.floor(Math.random() * 5),
        trendDirection: 'stable',
        keywords: angle.keywords,
        lastUpdated: now.toISOString(),
      });
    }

    // 3. 니치 2~3개 (미사용 리전에서)
    const niche = locations.filter(loc =>
      (loc.tier === 'niche' || loc.tier === 'secondary') && !usedRegions.has(loc.region)
    );
    for (const loc of shuffleArray([...niche]).slice(0, 3)) {
      if (usedRegions.has(loc.region)) continue;
      usedRegions.add(loc.region);
      const angle = loc.angles.find(a => a.type === 'travel') || loc.angles[0];
      results.push({
        topic: loc.name, submolt: 'travel',
        engagementScore: 55 + Math.floor(Math.random() * 25),
        postCount: 3 + Math.floor(Math.random() * 7),
        avgUpvotes: 5 + Math.floor(Math.random() * 8),
        trendDirection: Math.random() > 0.5 ? 'rising' : 'stable',
        keywords: angle.keywords,
        lastUpdated: now.toISOString(),
      });
    }

    return results;
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
   * 콘텐츠 앵글 제안 — 프레이밍 유형별 다양한 앵글
   */
  private suggestAngles(trend: MoltbookTrendingTopic): string[] {
    const t = trend.topic;
    const angles: string[] = [];

    if (trend.submolt === 'travel') {
      // 6가지 프레이밍 유형별 1개씩 → 셔플 후 3개 선택
      const pool = [
        `${t} 현지인만 아는 골목 맛집과 뷰포인트`,              // local_story
        `${t} 1박2일 실제 다녀온 비용과 솔직 후기`,             // experience
        `${t}의 숨은 역사: 알고 가면 3배 재미`,                 // deep_dive
        `${t} 겨울에 오히려 좋은 이유`,                         // seasonal
        `${t} 기대 vs 현실: 과대평가된 곳 vs 진짜 명소`,       // comparison
      ];
      if (trend.keywords.includes('카페')) {
        pool.push(`${t} 로컬 카페 vs SNS 핫플: 진짜 갈 만한 곳`);
      }
      if (trend.keywords.includes('야경')) {
        pool.push(`${t} 야경 명소 비교: 어디서 봐야 가장 예쁠까`);
      }
      // 셔플
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      angles.push(...pool);
    } else {
      const pool = [
        `${t}, 처음 가는 사람이 알아야 할 배경지식`,            // deep_dive
        `${t} 다녀온 솔직 후기: 기대 이상 vs 기대 이하`,       // comparison
        `${t} 숨은 동네에서 만난 예술가 이야기`,                // local_story
        `${t} 이번 달 놓치면 안 되는 프로그램`,                 // seasonal
        `${t} 첫 방문 체험기: 2시간이면 충분할까?`,             // experience
      ];
      if (trend.keywords.includes('전시회')) {
        pool.push(`${t} 현재 전시 비교: 어디가 더 볼 만할까`);
      }
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      angles.push(...pool);
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
          suggestedTitle: gap.suggestedAngles[0] || `${gap.topic} 첫 방문 전 알아야 할 것들`,
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
        suggestedTitle: `${topic}: 커뮤니티가 궁금해한 이야기`,
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
   * 제목 생성 — 프레이밍 유형별 다양한 템플릿
   */
  private generateTitle(trend: MoltbookTrendingTopic): string {
    const t = trend.topic;
    const templates = trend.submolt === 'travel'
      ? [
          `${t} 1박2일 실제 비용과 솔직 후기`,                   // experience
          `${t}의 역사 산책: 알고 가면 다르게 보인다`,           // deep_dive
          `${t} 현지인 단골 가게와 숨은 골목`,                   // local_story
          `${t} 기대 vs 현실: 진짜 가볼 만한 곳`,               // comparison
          `이번 달 ${t}이 특별한 이유`,                          // seasonal
          `${t} 여행 체크리스트: 놓치기 쉬운 5가지`,             // list_ranking (mild)
        ]
      : [
          `${t} 첫 방문 체험기: 2시간이면 충분할까?`,            // experience
          `${t}이 특별한 이유: 배경을 알면 3배 재미`,            // deep_dive
          `${t} 숨은 공간에서 만난 예술가 이야기`,               // local_story
          `${t} 기대 이상 vs 기대 이하: 솔직 비교`,             // comparison
          `이번 달 ${t} 놓치면 안 되는 프로그램`,                // seasonal
          `${t} 입문 체크리스트: 미리 알면 좋은 것들`,           // list_ranking (mild)
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

/** 프레이밍↔페르소나 친화도 매트릭스 타입 */
interface FramingAffinityEntry {
  primary: string;
  secondary: string;
}

/** 지역 매핑 타입 */
interface RegionMappingEntry {
  places: string[];
  nicheAngles: string[];
}

export class TopicDiscovery {
  private scanner: MoltbookTrendScanner;
  private gapAnalyzer: TopicGapAnalyzer;
  private recommender: TopicRecommender;
  private openclawScanner: OpenClawPostScanner;
  private voteScanner: VotePostScanner;
  private eventBus?: WorkflowEventBus;

  constructor(config?: MoltbookConfig | null, eventBus?: WorkflowEventBus) {
    this.scanner = new MoltbookTrendScanner(config);
    this.gapAnalyzer = new TopicGapAnalyzer();
    this.recommender = new TopicRecommender();
    this.openclawScanner = new OpenClawPostScanner(config);
    this.voteScanner = new VotePostScanner(config);
    this.eventBus = eventBus;
  }

  /**
   * framingAffinity 로드 — 프레이밍 유형별 최적 에이전트 매핑
   */
  private async loadFramingAffinity(): Promise<Record<string, FramingAffinityEntry>> {
    try {
      const raw = await readFile(join(process.cwd(), 'config/personas/index.json'), 'utf-8');
      const data = JSON.parse(raw) as { framingAffinity?: Record<string, FramingAffinityEntry> };
      return data.framingAffinity || {};
    } catch {
      return {};
    }
  }

  /**
   * region-mapping.json 로드
   */
  private async loadRegionMapping(): Promise<Record<string, RegionMappingEntry>> {
    try {
      const raw = await readFile(join(process.cwd(), 'config/region-mapping.json'), 'utf-8');
      return JSON.parse(raw) as Record<string, RegionMappingEntry>;
    } catch {
      return {};
    }
  }

  /**
   * framingAffinity 기반 페르소나 배정
   * framingType이 있으면 친화도 매트릭스에서 primary 에이전트를 배정
   */
  private assignPersonaByFraming(
    rec: TopicRecommendation,
    affinity: Record<string, FramingAffinityEntry>
  ): void {
    if (rec.personaId) return; // 이미 배정된 건 스킵

    if (rec.framingType && affinity[rec.framingType]) {
      rec.personaId = affinity[rec.framingType].primary as TopicRecommendation['personaId'];
    }
  }

  /**
   * Pillar 2: 크로스-리전 콘셉트 추천 생성
   */
  private generateConceptRecommendations(): TopicRecommendation[] {
    const pool = loadSeedPool();
    const concepts = pool.concepts;
    if (!concepts || concepts.length === 0) return [];

    const sampled = shuffleArray([...concepts]).slice(0, 3);
    const recs: TopicRecommendation[] = [];

    for (const concept of sampled) {
      // titleTemplate에서 {loc1}, {loc2} 등을 랜덤 location으로 치환
      const locs = shuffleArray([...concept.locations]).slice(0, concept.minLocations);
      let title = concept.titleTemplate;
      locs.forEach((loc, i) => {
        title = title.replace(`{loc${i + 1}}`, loc);
      });
      // 남은 플레이스홀더 제거
      title = title.replace(/\s*\{loc\d+\}/g, '');

      const agent = concept.suggestedAgents[Math.floor(Math.random() * concept.suggestedAgents.length)];

      recs.push({
        topic: concept.id,
        type: concept.type,
        score: 80 + Math.floor(Math.random() * 16),
        source: 'gap_analysis',
        reasoning: `크로스-리전 콘셉트: ${concept.description}`,
        suggestedTitle: title,
        keywords: [...concept.keywords, ...locs.slice(0, 2)],
        discoveredAt: new Date().toISOString(),
        personaId: agent as TopicRecommendation['personaId'],
        framingType: concept.framingType as FramingType,
      });
    }

    return recs;
  }

  /**
   * Pillar 3: 캘린더 기반 추천 (공휴일, N주년, 월별 훅)
   */
  private generateCalendarRecommendations(currentDate: Date = new Date()): TopicRecommendation[] {
    const seeds = loadEventSeeds();
    const recs: TopicRecommendation[] = [];
    const month = currentDate.getMonth() + 1;
    const year = currentDate.getFullYear();

    // 1. 30일 내 공휴일 체크
    if (seeds.holidays) {
      for (const holiday of seeds.holidays) {
        const [mm, dd] = holiday.date.split('-').map(Number);
        const holidayDate = new Date(year, mm - 1, dd);
        const daysUntil = Math.floor((holidayDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntil >= 0 && daysUntil <= 30) {
          for (const theme of holiday.themes) {
            const agent = theme.agents[0] as TopicRecommendation['personaId'];
            recs.push({
              topic: holiday.name,
              suggestedTitle: theme.title,
              score: 90 + Math.max(0, 20 - daysUntil),
              source: 'event_calendar',
              reasoning: `공휴일 D-${daysUntil}: ${holiday.name}`,
              type: theme.type,
              framingType: theme.framingType as FramingType,
              keywords: [holiday.name],
              discoveredAt: currentDate.toISOString(),
              personaId: agent,
            });
          }
        }
      }
    }

    // 2. N주년 기념일 체크 (5주년 단위)
    if (seeds.anniversaries) {
      for (const anni of seeds.anniversaries) {
        const [mm, dd] = anni.date.split('-').map(Number);
        const anniDate = new Date(year, mm - 1, dd);
        const daysUntil = Math.floor((anniDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
        const n = year - anni.yearStarted;
        const isSignificant = n > 0 && (n % 5 === 0);
        if (isSignificant && daysUntil >= -7 && daysUntil <= 45) {
          for (const theme of anni.themes) {
            const agent = theme.agents[0] as TopicRecommendation['personaId'];
            recs.push({
              topic: `${anni.name} ${n}주년`,
              suggestedTitle: theme.title.replace('{n}', String(n)),
              score: 85 + (n % 10 === 0 ? 15 : 0),
              source: 'event_calendar',
              reasoning: `${n}주년 기념: ${anni.name}`,
              type: theme.type,
              framingType: theme.framingType as FramingType,
              keywords: [anni.name, `${n}주년`],
              discoveredAt: currentDate.toISOString(),
              personaId: agent,
            });
          }
        }
      }
    }

    // 3. 월별 훅 (현재월 + 다음달)
    if (seeds.monthlyHooks) {
      const months = [String(month), String(month === 12 ? 1 : month + 1)];
      for (const m of months) {
        const hooks = seeds.monthlyHooks[m] || [];
        const sampled = shuffleArray([...hooks]).slice(0, 2);
        for (const hook of sampled) {
          recs.push({
            topic: `${m}월 ${hook}`,
            suggestedTitle: hook,
            score: 70,
            source: 'event_calendar',
            reasoning: `월별 훅: ${m}월 - ${hook}`,
            type: 'travel',
            framingType: 'seasonal' as FramingType,
            keywords: hook.split(' '),
            discoveredAt: currentDate.toISOString(),
          });
        }
      }
    }

    return recs;
  }

  /**
   * 기발행 앵글 스캔: Set<"지역명::framingType">
   */
  private async getPublishedAngles(): Promise<Set<string>> {
    const published = new Set<string>();
    if (!existsSync(BLOG_POSTS_DIR)) return published;

    for (const category of ['travel', 'culture'] as const) {
      const catDir = join(BLOG_POSTS_DIR, category);
      if (!existsSync(catDir)) continue;
      try {
        const files = await readdir(catDir);
        for (const file of files) {
          if (!file.endsWith('.md')) continue;
          const content = await readFile(join(catDir, file), 'utf-8');
          const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
          if (!fmMatch) continue;
          const fm = fmMatch[1];
          const titleMatch = fm.match(/title:\s*["']?(.+?)["']?\s*$/m);
          const title = titleMatch?.[1] || '';
          // 지역명 추출
          const pool = loadSeedPool();
          for (const loc of Object.values(pool.locations)) {
            if (title.includes(loc.name)) {
              // 프레이밍 추출
              for (const [framing, patterns] of Object.entries({
                list_ranking: [/TOP\s*\d+/i, /베스트/, /\d+선/, /순위/],
                deep_dive: [/역사/, /의미/, /해설/, /이야기/],
                experience: [/후기/, /체험/, /1박2일/, /당일/],
                seasonal: [/\d+월/, /봄/, /여름/, /가을/, /겨울/],
                comparison: [/vs/i, /비교/, /장단점/],
                local_story: [/골목/, /로컬/, /숨은/, /현지인/],
                niche_digging: [/디깅/, /취향/, /발견/],
              })) {
                if (patterns.some(p => p.test(title))) {
                  published.add(`${loc.name}::${framing}`);
                }
              }
              // 프레이밍 미감지 시 기본값
              published.add(`${loc.name}::experience`);
            }
          }
        }
      } catch {
        // ignore
      }
    }

    return published;
  }

  /**
   * 기발행 앵글 패널티 적용
   */
  private penalizePublishedAngles(
    recommendations: TopicRecommendation[],
    publishedAngles: Set<string>
  ): void {
    const pool = loadSeedPool();
    const locationNames = new Set(Object.values(pool.locations).map(l => l.name));

    for (const rec of recommendations) {
      // 추천에서 지역명 찾기
      let locName: string | null = null;
      for (const name of locationNames) {
        if (rec.topic.includes(name) || rec.suggestedTitle.includes(name)) {
          locName = name;
          break;
        }
      }
      if (!locName) continue;

      const key = `${locName}::${rec.framingType || 'experience'}`;
      if (publishedAngles.has(key)) {
        rec.score -= 15;
        rec.reasoning += ` | 기발행앵글(${key}) -15`;
      }
    }
  }

  /**
   * Axis 2B: 트렌딩 주제에서 niche 파생 주제 생성
   * "경주" 트렌딩 → "경주 석굴암 뒷길 디깅" 같은 niche 앵글 파생
   */
  private async deriveNicheTopics(
    recommendations: TopicRecommendation[]
  ): Promise<TopicRecommendation[]> {
    const regionMapping = await this.loadRegionMapping();
    const derived: TopicRecommendation[] = [];

    // 기존 추천에서 niche가 아닌 것 중 지역 매핑이 있는 것을 파생
    for (const rec of recommendations) {
      if (rec.personaId === 'niche') continue; // 이미 niche면 스킵

      // 추천 키워드에서 지역명 찾기
      const regionKey = Object.keys(regionMapping).find(region =>
        rec.topic.includes(region) || rec.keywords.some(k => k.includes(region))
      );
      if (!regionKey) continue;

      const mapping = regionMapping[regionKey];
      if (!mapping.nicheAngles || mapping.nicheAngles.length === 0) continue;

      // 랜덤 niche 앵글 1개 선택
      const angle = mapping.nicheAngles[Math.floor(Math.random() * mapping.nicheAngles.length)];
      const nichePlace = mapping.places[Math.floor(Math.random() * mapping.places.length)];

      derived.push({
        topic: `${nichePlace} ${angle}`,
        type: rec.type,
        score: Math.max(60, rec.score - 10), // 원본보다 약간 낮은 점수
        source: rec.source,
        reasoning: `${rec.topic} 트렌딩에서 niche 파생 — ${angle}`,
        suggestedTitle: `${nichePlace}, ${angle}: 아는 사람만 아는 이야기`,
        keywords: [nichePlace, regionKey, ...rec.keywords.slice(0, 2)],
        discoveredAt: new Date().toISOString(),
        personaId: 'niche',
        framingType: 'niche_digging'
      });
    }

    return derived;
  }

  /**
   * Axis 3C: 에이전트 밸런싱 — 목표 비율 대비 부족한 에이전트 보정
   */
  private async balanceAgentDistribution(
    recommendations: TopicRecommendation[]
  ): Promise<void> {
    const targets = await this.loadDiversityTargets();
    if (!targets?.agentRatio) return;

    // 현재 분포 계산
    const counts: Record<string, number> = {};
    for (const rec of recommendations) {
      const pid = rec.personaId || 'friendly';
      counts[pid] = (counts[pid] || 0) + 1;
    }
    const total = recommendations.length;
    if (total === 0) return;

    // 목표 대비 부족한 에이전트 찾기
    const deficits: Array<{ agent: string; deficit: number }> = [];
    for (const [agent, targetRatio] of Object.entries(targets.agentRatio)) {
      const actual = (counts[agent] || 0) / total;
      const deficit = targetRatio - actual;
      if (deficit > 0.05) { // 5% 이상 부족하면 보정 대상
        deficits.push({ agent, deficit });
      }
    }

    if (deficits.length === 0) return;

    // 가장 많은 에이전트(초과)에서 부족한 에이전트로 재배정
    deficits.sort((a, b) => b.deficit - a.deficit);

    const surplusAgents = Object.entries(targets.agentRatio)
      .filter(([agent]) => {
        const actual = (counts[agent] || 0) / total;
        return actual > targets.agentRatio[agent] + 0.05;
      })
      .map(([agent]) => agent);

    for (const { agent: deficitAgent } of deficits) {
      // 초과 에이전트의 추천 중 점수가 낮은 것부터 재배정
      const candidates = recommendations
        .filter(r => surplusAgents.includes(r.personaId || 'friendly'))
        .sort((a, b) => a.score - b.score);

      if (candidates.length > 0) {
        candidates[0].personaId = deficitAgent as TopicRecommendation['personaId'];
        // counts 업데이트
        const oldAgent = candidates[0].personaId || 'friendly';
        counts[oldAgent] = (counts[oldAgent] || 0) - 1;
        counts[deficitAgent] = (counts[deficitAgent] || 0) + 1;
      }
    }
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
    diversityTargets?: DiversityTargets;
  } = {}): Promise<DiscoveryResult> {
    console.log('🔍 Moltbook 트렌드 스캔 중...');

    // 1. 트렌딩 스캔
    const trending = await this.scanner.scanTrending(options.submolt);
    console.log(`   ✓ ${trending.length}개 트렌딩 토픽 발견`);
    this.eventBus?.emit('discovery:trending-complete', {
      count: trending.length,
      submolt: options.submolt,
    });

    // 2. 갭 분석 (옵션)
    let gaps: TopicGap[] = [];
    if (options.includeGaps !== false) {
      console.log('📊 갭 분석 중...');
      gaps = await this.gapAnalyzer.analyzeGaps(trending);
      console.log(`   ✓ ${gaps.length}개 콘텐츠 갭 발견`);
      this.eventBus?.emit('discovery:gap-complete', {
        gapCount: gaps.length,
        uncoveredCount: gaps.filter(g => g.blogCoverage === 'none').length,
      });
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
    this.eventBus?.emit('discovery:recommendations', {
      count: recommendations.length,
      topScore: recommendations[0]?.score ?? 0,
      sources: [...new Set(recommendations.map(r => r.source))],
    });

    // 4. 콘텐츠 다양성 밸런싱
    const targets = options.diversityTargets || await this.loadDiversityTargets();
    const balancer = new ContentBalancer(targets, this.eventBus);
    const analysis = await balancer.analyzeDistribution();
    const boosts = balancer.calculateBoosts(analysis);
    balancer.applyBoosts(recommendations, boosts);
    this.eventBus?.emit('discovery:balance-applied', {
      agentBoosts: boosts.agentBoosts,
      regionBoosts: boosts.regionBoosts,
      framingBoosts: boosts.framingBoosts,
    });

    // 5. 미커버 지역 추천 자동 생성
    const regionGapRecs = balancer.generateRegionGapRecommendations(boosts);
    if (regionGapRecs.length > 0) {
      // 기존 추천과 중복되지 않는 것만 추가
      const existingTopics = new Set(recommendations.map(r => r.topic));
      for (const rec of regionGapRecs) {
        if (!existingTopics.has(rec.topic)) {
          recommendations.push(rec);
          existingTopics.add(rec.topic);
        }
      }
      recommendations.sort((a, b) => b.score - a.score);
      console.log(`   ✓ 미커버 지역 추천 ${regionGapRecs.length}개 추가`);
    }

    // 5.5. Pillar 2: 크로스-리전 콘셉트 추천
    const conceptRecs = this.generateConceptRecommendations();
    if (conceptRecs.length > 0) {
      const existingTopics2 = new Set(recommendations.map(r => r.topic));
      for (const rec of conceptRecs) {
        if (!existingTopics2.has(rec.topic)) {
          recommendations.push(rec);
          existingTopics2.add(rec.topic);
        }
      }
      console.log(`   ✓ 크로스-리전 콘셉트 ${conceptRecs.length}개 추가`);
    }

    // 5.7. Pillar 3: 캘린더 기반 추천
    const calendarRecs = this.generateCalendarRecommendations();
    if (calendarRecs.length > 0) {
      const existingTopics3 = new Set(recommendations.map(r => r.topic));
      for (const rec of calendarRecs) {
        if (!existingTopics3.has(rec.topic)) {
          recommendations.push(rec);
          existingTopics3.add(rec.topic);
        }
      }
      console.log(`   ✓ 캘린더 추천 ${calendarRecs.length}개 추가`);
    }

    // 6. Niche 파생 주제 생성 (Axis 2B)
    const nicheTopics = await this.deriveNicheTopics(recommendations);
    if (nicheTopics.length > 0) {
      const existingSet = new Set(recommendations.map(r => r.topic));
      for (const nt of nicheTopics) {
        if (!existingSet.has(nt.topic)) {
          recommendations.push(nt);
          existingSet.add(nt.topic);
        }
      }
      console.log(`   ✓ Niche 파생 주제 ${nicheTopics.length}개 추가`);
    }

    // 7. framingAffinity 기반 페르소나 배정 (Axis 1B)
    const affinity = await this.loadFramingAffinity();
    for (const rec of recommendations) {
      this.assignPersonaByFraming(rec, affinity);
    }

    // 8. 에이전트 밸런싱 (Axis 3C)
    await this.balanceAgentDistribution(recommendations);

    // 8.5. 기발행 앵글 패널티
    const publishedAngles = await this.getPublishedAngles();
    if (publishedAngles.size > 0) {
      this.penalizePublishedAngles(recommendations, publishedAngles);
      console.log(`   ✓ 기발행 앵글 ${publishedAngles.size}개 감지, 패널티 적용`);
    }

    // 9. 리전 캡 적용
    const cappedRecommendations = ContentBalancer.applyRegionalCap(recommendations, 2);

    // 최종 정렬
    cappedRecommendations.sort((a, b) => b.score - a.score);

    // recommendations 배열을 캡 적용 결과로 교체
    recommendations.length = 0;
    recommendations.push(...cappedRecommendations);

    balancer.printAnalysis(boosts);

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
    const discoverStart = Date.now();
    console.log('\n═══════════════════════════════════════════════════');
    console.log('   📡 2차원 강화 주제 발굴 시작');
    console.log('═══════════════════════════════════════════════════\n');
    this.eventBus?.emit('discovery:phase-start', { phase: 'discoverEnhanced', mode: 'enhanced' });

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
      this.eventBus?.emit('discovery:enhanced-phase', {
        dimension: 'openclaw',
        count: openclawFeedback.length,
        details: openclawFeedback.length > 0
          ? `평균 감성: ${(openclawFeedback.reduce((s, f) => s + f.sentimentScore, 0) / openclawFeedback.length).toFixed(0)}`
          : undefined,
      });

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
      this.eventBus?.emit('discovery:enhanced-phase', {
        dimension: 'vote',
        count: votePosts.length,
        details: votePosts.length > 0
          ? `유형: ${votePosts.map(v => v.voteType).join(', ')}`
          : undefined,
      });

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
          suggestedTitle: `${topicLabel} 깊이 있게 들여다보기`,
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

    // 추가 추천 중 에이전트 미배정 건에 사전 배정
    const targets = await this.loadDiversityTargets();
    const postMergeBalancer = new ContentBalancer(targets, this.eventBus);
    const postAnalysis = await postMergeBalancer.analyzeDistribution();
    const postBoosts = postMergeBalancer.calculateBoosts(postAnalysis);
    // agentBoosts에서 가장 부족한 에이전트 찾기
    const mostNeededAgent = (
      Object.entries(postBoosts.agentBoosts)
        .sort(([, a], [, b]) => b - a)[0]?.[0] || 'informative'
    ) as 'viral' | 'friendly' | 'informative' | 'niche';
    for (const rec of allRecommendations) {
      if (!rec.personaId) {
        rec.personaId = mostNeededAgent;
      }
    }
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

    this.eventBus?.emit('discovery:complete', {
      totalRecommendations: enhancedResult.recommendations.length,
      mode: 'enhanced',
      duration: Date.now() - discoverStart,
    });

    return enhancedResult;
  }

  /**
   * 추천 병합 (중복 제거, 점수 통합)
   * 앵글 인식: 같은 지역이라도 다른 framingType이면 별개로 취급
   */
  private mergeRecommendations(
    base: TopicRecommendation[],
    additional: TopicRecommendation[]
  ): TopicRecommendation[] {
    const merged = new Map<string, TopicRecommendation>();

    // 키: topic::framingType (같은 지역 + 같은 프레이밍만 중복)
    const makeKey = (rec: TopicRecommendation) =>
      `${rec.topic}::${rec.framingType || 'experience'}`;

    // 기본 추천 추가
    for (const rec of base) {
      merged.set(makeKey(rec), rec);
    }

    // 추가 추천 병합 (점수가 높으면 대체)
    for (const rec of additional) {
      const key = makeKey(rec);
      const existing = merged.get(key);
      if (!existing) {
        merged.set(key, rec);
      } else if (rec.score > existing.score) {
        // 점수가 높으면 대체하되, 소스 정보 추가
        merged.set(key, {
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
   * content-strategy.json에서 diversityTargets 로드
   */
  private async loadDiversityTargets(): Promise<DiversityTargets | undefined> {
    try {
      const strategyPath = join(process.cwd(), 'config/content-strategy.json');
      const raw = await readFile(strategyPath, 'utf-8');
      const strategy = JSON.parse(raw) as { diversityTargets?: DiversityTargets };
      return strategy.diversityTargets;
    } catch {
      return undefined;
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
          keywords: rec.keywords,
          ...(rec.personaId ? { personaId: rec.personaId } : {}),
          ...(rec.framingType ? { framingType: rec.framingType } : {})
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

// ============================================================================
// 유틸리티
// ============================================================================

/** Fisher-Yates 셔플 */
function shuffleArray<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default TopicDiscovery;
