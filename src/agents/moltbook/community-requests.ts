/**
 * Moltbook 커뮤니티 요청 추출 시스템
 * 댓글에서 주제 요청 패턴을 감지하여 콘텐츠 아이디어로 변환
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { loadMoltbookConfig, MoltbookConfig, Comment, FeedbackData } from './index.js';

// ============================================================================
// 타입 정의
// ============================================================================

export interface CommunityRequest {
  id: string;
  content: string;
  topic: string | null;
  requestType: 'info_request' | 'recommendation' | 'update_needed' | 'new_topic';
  confidence: number;  // 0-100
  sourcePostId: string;
  sourcePostTitle: string;
  authorName: string;
  upvotes: number;
  extractedAt: string;
}

export interface RequestSummary {
  totalRequests: number;
  byType: Record<string, number>;
  topTopics: Array<{ topic: string; count: number }>;
  highConfidenceRequests: CommunityRequest[];
  lastUpdated: string;
}

// ============================================================================
// 설정
// ============================================================================

const MOLTBOOK_API = 'https://www.moltbook.com/api/v1';
const DATA_DIR = join(process.cwd(), 'data/feedback');
const REQUESTS_CACHE_PATH = join(DATA_DIR, 'community-requests.json');

// 요청 패턴 정의
const REQUEST_PATTERNS = {
  info_request: [
    /(.+?)(에 대해|에대해|관련).*(알려|알고|정보)/,
    /(.+?)(어떻게|어디서|어디에|언제).*(가|할|볼)/,
    /(.+?)(정보|팁|노하우).*있(나요|을까요|으면)/,
    /(.+?).*궁금/,
    /(.+?).*알려주세요/,
    /(.+?).*알고\s*싶/,
  ],
  recommendation: [
    /(.+?)(추천|권장|권해).*해주세요/,
    /(.+?)(좋은|괜찮은|맛있는).*(추천|소개)/,
    /(.+?)\s*추천\s*(해|부탁|좀)/,
    /(.+?)(어디가|뭐가)\s*좋(을까요|나요)/,
    /(.+?)\s*best|베스트/i,
  ],
  update_needed: [
    /(.+?)(정보|내용|가격|시간).*(오래됐|오래됬|바뀌었|업데이트)/,
    /(.+?)(최신|현재|지금).*(정보|상황)/,
    /(.+?)(변경|수정).*필요/,
    /(.+?)(틀렸|잘못)/,
  ],
  new_topic: [
    /(.+?)(다뤄|다루어|포스팅|글).*해주세요/,
    /(.+?)(에 대한|관련).*(글|포스트|콘텐츠)/,
    /(.+?).*써주세요/,
    /(.+?)도\s*해주세요/,
  ]
};

// 키워드 목록
const TOPIC_KEYWORDS = [
  // 지역
  '제주', '서울', '부산', '강릉', '경주', '전주', '대구', '인천', '여수', '속초',
  '대전', '광주', '울산', '춘천', '안동', '통영', '거제', '목포', '순천', '양양',
  '공주', '부여', '청주', '단양', '진주', '하동', '영월', '정선', '포항', '담양',
  // 카테고리
  '카페', '맛집', '숙소', '호텔', '펜션', '렌터카', '전시회', '미술관', '박물관',
  '공연', '뮤지컬', '서점', '북카페', '시장', '야경', '드라이브', '코스', '일정',
  '갤러리', '축제', '체험', '산책', '골목', '한옥', '건축', '역사', '문화', '예술',
  // 특수
  '가격', '비용', '예약', '주차', '대중교통', '버스', '기차', 'KTX'
];

// ============================================================================
// 관련성 필터 — 여행/문화 도메인 외 댓글 제거
// ============================================================================

const RELEVANCE_KEYWORDS = [
  '여행', '관광', '전시', '공연', '카페', '맛집', '박물관', '미술관', '갤러리',
  '축제', '체험', '숙소', '호텔', '코스', '데이트', '산책', '야경', '역사',
  '건축', '문화', '예술', '서점', '골목', '시장', '한옥', '사찰', '해변', '산',
  '추천', '후기', '방문', '입장', '관람', '투어', '여행지', '볼거리', '먹거리',
  ...TOPIC_KEYWORDS,
];

const SPAM_PATTERNS = [
  /https?:\/\/\S{30,}/g,            // 긴 URL
  /\b(crypto|NFT|mint|token|web3)\b/gi,  // 스팸 키워드
  /\b(SOUL\.md|CYBERSECURITY|isnād)\b/g, // 알려진 오염 패턴
  /(.)\1{10,}/g,                     // 같은 문자 10회 이상 반복
];

/**
 * 댓글이 여행/문화 도메인에 관련이 있는지 필터링
 * 3단 검증: 한글 비율 → 도메인 키워드 → 스팸 패턴
 */
function isRelevantComment(content: string): boolean {
  // Filter 1: 한글 비율 — 30% 이상이어야 함
  const koreanChars = (content.match(/[가-힣]/g) || []).length;
  const koreanRatio = koreanChars / Math.max(1, content.length);
  if (koreanRatio < 0.3) return false;

  // Filter 2: 여행/문화 키워드 최소 1개 포함
  const hasRelevant = RELEVANCE_KEYWORDS.some(kw => content.includes(kw));
  if (!hasRelevant) return false;

  // Filter 3: 스팸/봇 패턴 제거
  if (SPAM_PATTERNS.some(p => p.test(content))) {
    // 정규식 lastIndex 리셋
    SPAM_PATTERNS.forEach(p => { p.lastIndex = 0; });
    return false;
  }
  SPAM_PATTERNS.forEach(p => { p.lastIndex = 0; });

  return true;
}

// ============================================================================
// 커뮤니티 요청 추출기
// ============================================================================

export class CommunityRequestExtractor {
  private config: MoltbookConfig | null;

  constructor(config?: MoltbookConfig | null) {
    this.config = config || null;
  }

  /**
   * 최근 피드백에서 요청 추출
   */
  async extractFromRecentFeedback(days: number = 7): Promise<CommunityRequest[]> {
    // 피드백 파일 로드
    const feedbackFiles = await this.loadFeedbackFiles(days);
    const requests: CommunityRequest[] = [];

    for (const feedback of feedbackFiles) {
      for (const comment of feedback.comments) {
        const request = this.extractRequest(comment, feedback.postId, feedback.blogUrl || '');

        if (request && request.confidence >= 50) {
          requests.push(request);
        }
      }
    }

    // 캐시 저장
    await this.saveCache(requests);

    return requests;
  }

  /**
   * 단일 댓글에서 요청 추출 (관련성 필터 적용)
   */
  extractRequest(
    comment: Comment,
    postId: string,
    postTitle: string
  ): CommunityRequest | null {
    const content = comment.content;

    // 관련성 필터: 여행/문화 도메인 외 댓글 차단
    if (!isRelevantComment(content)) {
      return null;
    }

    // 각 패턴 타입별로 검사
    for (const [requestType, patterns] of Object.entries(REQUEST_PATTERNS)) {
      for (const pattern of patterns) {
        const match = content.match(pattern);

        if (match) {
          const topic = this.extractTopic(content, match[1]);
          const confidence = this.calculateConfidence(content, topic, comment.upvotes);

          return {
            id: `req-${postId}-${comment.id}`,
            content: content.substring(0, 200),
            topic,
            requestType: requestType as CommunityRequest['requestType'],
            confidence,
            sourcePostId: postId,
            sourcePostTitle: postTitle,
            authorName: comment.author?.name || 'Anonymous',
            upvotes: comment.upvotes || 0,
            extractedAt: new Date().toISOString()
          };
        }
      }
    }

    return null;
  }

  /**
   * 토픽 추출
   */
  private extractTopic(content: string, matchedPart: string): string | null {
    // 키워드 기반 추출
    for (const keyword of TOPIC_KEYWORDS) {
      if (content.includes(keyword)) {
        return keyword;
      }
    }

    // 매치된 부분에서 추출 시도
    const cleaned = matchedPart.trim().replace(/[은는이가을를에서로의]/g, '');
    if (cleaned.length >= 2 && cleaned.length <= 20) {
      return cleaned;
    }

    return null;
  }

  /**
   * 신뢰도 계산
   */
  private calculateConfidence(
    content: string,
    topic: string | null,
    upvotes: number
  ): number {
    let confidence = 50; // 기본 신뢰도

    // 토픽 발견시 +20
    if (topic) {
      confidence += 20;
    }

    // upvotes가 많으면 +10
    if (upvotes >= 3) {
      confidence += 10;
    }

    // 명확한 요청 표현 +10
    const clearRequests = ['해주세요', '부탁', '알려주세요', '추천해', '궁금'];
    if (clearRequests.some(r => content.includes(r))) {
      confidence += 10;
    }

    // 길이가 적당하면 +5
    if (content.length >= 20 && content.length <= 200) {
      confidence += 5;
    }

    return Math.min(100, confidence);
  }

  /**
   * 피드백 파일 로드
   */
  private async loadFeedbackFiles(days: number): Promise<FeedbackData[]> {
    const feedbacks: FeedbackData[] = [];

    if (!existsSync(DATA_DIR)) {
      return feedbacks;
    }

    const { readdir } = await import('fs/promises');
    const files = await readdir(DATA_DIR);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    for (const file of files) {
      if (!file.startsWith('feedback-') || !file.endsWith('.json')) continue;

      try {
        const content = await readFile(join(DATA_DIR, file), 'utf-8');
        const data: FeedbackData[] = JSON.parse(content);

        for (const fb of data) {
          if (new Date(fb.timestamp) > cutoff) {
            feedbacks.push(fb);
          }
        }
      } catch {
        // 파일 파싱 실패 무시
      }
    }

    return feedbacks;
  }

  /**
   * Moltbook에서 직접 최신 댓글 가져오기
   */
  async fetchRecentComments(submolt?: 'travel' | 'culture'): Promise<CommunityRequest[]> {
    if (!this.config?.apiKey) {
      console.log('⚠️ Moltbook API 키가 없습니다. 캐시된 데이터 사용.');
      return this.loadCache();
    }

    const requests: CommunityRequest[] = [];
    const submolts = submolt ? [submolt] : ['travel', 'culture'] as const;

    for (const sub of submolts) {
      try {
        // 최근 인기 포스트 가져오기
        const postsResponse = await fetch(
          `${MOLTBOOK_API}/submolts/${sub}/posts?sort=hot&limit=10`,
          { headers: { 'Authorization': `Bearer ${this.config.apiKey}` } }
        );

        if (!postsResponse.ok) continue;

        interface PostItem {
          id: string;
          title: string;
        }

        const postsData = await postsResponse.json() as { posts: PostItem[] };
        const posts = postsData.posts || [];

        // 각 포스트의 댓글 확인
        for (const post of posts) {
          const commentsResponse = await fetch(
            `${MOLTBOOK_API}/posts/${post.id}/comments?limit=20`,
            { headers: { 'Authorization': `Bearer ${this.config.apiKey}` } }
          );

          if (!commentsResponse.ok) continue;

          const commentsData = await commentsResponse.json() as { comments: Comment[] };
          const comments = commentsData.comments || [];

          for (const comment of comments) {
            const request = this.extractRequest(comment, post.id, post.title);
            if (request && request.confidence >= 50) {
              requests.push(request);
            }
          }
        }
      } catch (error) {
        console.log(`⚠️ ${sub} 댓글 가져오기 실패:`, error);
      }
    }

    // 캐시 저장
    await this.saveCache(requests);

    return requests;
  }

  /**
   * 캐시 저장
   */
  private async saveCache(requests: CommunityRequest[]): Promise<void> {
    try {
      await mkdir(DATA_DIR, { recursive: true });
      await writeFile(REQUESTS_CACHE_PATH, JSON.stringify(requests, null, 2));
    } catch (error) {
      console.log(`⚠️ 요청 캐시 저장 실패: ${error}`);
    }
  }

  /**
   * 캐시 로드 (오염 데이터 필터링 적용)
   */
  async loadCache(): Promise<CommunityRequest[]> {
    try {
      if (!existsSync(REQUESTS_CACHE_PATH)) {
        return [];
      }

      const content = await readFile(REQUESTS_CACHE_PATH, 'utf-8');
      const cached = JSON.parse(content) as CommunityRequest[];
      // 기존 캐시에서도 관련성 필터 재적용 (오염 데이터 정제)
      return cached.filter(r => isRelevantComment(r.content));
    } catch {
      return [];
    }
  }

  /**
   * 요청 요약 생성
   */
  summarize(requests: CommunityRequest[]): RequestSummary {
    // 타입별 집계
    const byType: Record<string, number> = {
      info_request: 0,
      recommendation: 0,
      update_needed: 0,
      new_topic: 0
    };

    for (const req of requests) {
      byType[req.requestType] = (byType[req.requestType] || 0) + 1;
    }

    // 토픽별 집계
    const topicCounts = new Map<string, number>();
    for (const req of requests) {
      if (req.topic) {
        topicCounts.set(req.topic, (topicCounts.get(req.topic) || 0) + 1);
      }
    }

    const topTopics = Array.from(topicCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([topic, count]) => ({ topic, count }));

    // 고신뢰도 요청
    const highConfidenceRequests = requests
      .filter(r => r.confidence >= 70)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10);

    return {
      totalRequests: requests.length,
      byType,
      topTopics,
      highConfidenceRequests,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * 요청을 주제 추천 문자열로 변환
   */
  toRecommendationStrings(requests: CommunityRequest[]): string[] {
    return requests
      .filter(r => r.topic && r.confidence >= 60)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10)
      .map(r => r.content);
  }
}

export default CommunityRequestExtractor;
