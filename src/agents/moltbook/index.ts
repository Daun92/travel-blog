/**
 * Moltbook 피드백 루프 시스템
 * AI 에이전트 커뮤니티와 통합하여 콘텐츠 품질 향상
 */

import { writeFile, readFile, mkdir, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import SurveyInsightsDBManager from './survey-insights-db.js';

// ============================================================================
// 타입 정의
// ============================================================================

export interface MoltbookPost {
  id: string;
  title: string;
  url: string;
  content?: string;
  upvotes: number;
  downvotes: number;
  comments: Comment[];
  created_at: string;
  submolt: string;
}

export interface Comment {
  id: string;
  content: string;
  author: { name: string };
  upvotes: number;
  created_at: string;
}

export interface FeedbackData {
  postId: string;
  blogUrl: string;
  upvotes: number;
  downvotes: number;
  engagement: number;
  comments: Comment[];
  topics: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  timestamp: string;
}

export interface DiversityTargets {
  agentRatio: Record<string, number>;
  typeMix: { travel: number; culture: number };
  regionPriority: string[];
  regionCovered: string[];
  /** 프레이밍 유형별 목표 비율 (합계 1.0) */
  framingMix?: Record<string, number>;
}

export interface ContentStrategy {
  priorityTopics: string[];
  contentFormat: string;
  focusAreas: string[];
  improvementPlan: string[];
  optimalPostingTime: string;
  optimalLength: number;
  lastUpdated: string;
  diversityTargets?: DiversityTargets;
}

export interface DraftFeedback {
  draftId: string;
  postId: string;
  blogTitle: string;
  status: 'pending' | 'collected' | 'applied';
  sharedAt: string;
  collectedAt?: string;
  upvotes: number;
  downvotes: number;
  comments: Comment[];
  suggestions: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
}

export interface MoltbookConfig {
  apiKey: string;
  agentName: string;
  baseUrl: string;
}

// ============================================================================
// 설정
// ============================================================================

const MOLTBOOK_API = 'https://www.moltbook.com/api/v1';
const CONFIG_DIR = join(process.cwd(), 'config');
const DATA_DIR = join(process.cwd(), 'data/feedback');

/**
 * Moltbook 설정 로드
 */
export async function loadMoltbookConfig(): Promise<MoltbookConfig | null> {
  try {
    const credPath = join(CONFIG_DIR, 'moltbook-credentials.json');
    const cred = JSON.parse(await readFile(credPath, 'utf-8'));
    return {
      apiKey: cred.api_key || '',
      agentName: cred.agent_name || 'TravelCuratorKR',
      baseUrl: MOLTBOOK_API
    };
  } catch {
    return null;
  }
}

/**
 * Moltbook 설정 확인
 */
export async function isMoltbookConfigured(): Promise<boolean> {
  const config = await loadMoltbookConfig();
  return config !== null && config.apiKey.length > 0;
}

// ============================================================================
// Moltbook 공유 Agent
// ============================================================================

export class MoltbookShareAgent {
  private config: MoltbookConfig;

  constructor(config: MoltbookConfig) {
    this.config = config;
  }

  /**
   * 블로그 포스트를 Moltbook에 공유
   */
  async sharePost(blogPost: {
    title: string;
    url: string;
    summary: string;
    category: 'travel' | 'culture';
    topics: string[];
  }): Promise<MoltbookPost | null> {
    if (!this.config.apiKey) {
      console.log('⚠️ Moltbook API 키가 설정되지 않았습니다.');
      return null;
    }

    const submolt = blogPost.category === 'travel' ? 'travel' : 'culture';

    try {
      const response = await fetch(`${this.config.baseUrl}/posts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          submolt,
          title: blogPost.title,
          url: blogPost.url,
          content: `${blogPost.summary}\n\n📊 데이터 기반 큐레이션\n🔗 전체 글: ${blogPost.url}\n\n#${blogPost.topics.join(' #')}`
        })
      });

      if (!response.ok) {
        console.log(`⚠️ Moltbook 공유 실패: ${response.statusText}`);
        return null;
      }

      const data = await response.json() as { post: MoltbookPost };
      console.log(`✅ Moltbook 공유 완료: ${data.post.id}`);

      // 공유 기록 저장
      await this.saveShareRecord(data.post.id, blogPost.url);

      return data.post;
    } catch (error) {
      console.log(`⚠️ Moltbook 공유 오류: ${error}`);
      return null;
    }
  }

  /**
   * 공유 기록 저장
   */
  private async saveShareRecord(postId: string, blogUrl: string): Promise<void> {
    const recordPath = join(DATA_DIR, 'share-records.json');

    let records: Record<string, string> = {};
    try {
      records = JSON.parse(await readFile(recordPath, 'utf-8'));
    } catch {
      // 파일 없으면 새로 생성
    }

    records[blogUrl] = postId;
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(recordPath, JSON.stringify(records, null, 2));
  }

  /**
   * 초안을 Moltbook에 공유 (발행 전 피드백 수집용)
   */
  async shareDraft(draft: {
    title: string;
    summary: string;
    filePath: string;
    category: 'travel' | 'culture';
    topics: string[];
  }): Promise<DraftFeedback | null> {
    if (!this.config.apiKey) {
      console.log('⚠️ Moltbook API 키가 설정되지 않았습니다.');
      return null;
    }

    const submolt = draft.category === 'travel' ? 'travel' : 'culture';
    const draftId = `draft-${Date.now()}`;

    try {
      const response = await fetch(`${this.config.baseUrl}/posts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          submolt,
          title: `[초안 피드백 요청] ${draft.title}`,
          content: `📝 **초안 미리보기**\n\n${draft.summary}\n\n---\n\n💬 이 초안에 대한 피드백을 부탁드립니다!\n- 내용이 정확한가요?\n- 추가되었으면 하는 정보가 있나요?\n- 개선할 점이 있다면 알려주세요!\n\n#${draft.topics.join(' #')} #초안피드백`
        })
      });

      if (!response.ok) {
        console.log(`⚠️ Moltbook 초안 공유 실패: ${response.statusText}`);
        return null;
      }

      const data = await response.json() as { post: MoltbookPost };
      console.log(`✅ Moltbook 초안 공유 완료: ${data.post.id}`);

      // 초안 피드백 기록 저장
      const draftFeedback: DraftFeedback = {
        draftId,
        postId: data.post.id,
        blogTitle: draft.title,
        status: 'pending',
        sharedAt: new Date().toISOString(),
        upvotes: 0,
        downvotes: 0,
        comments: [],
        suggestions: [],
        sentiment: 'neutral'
      };

      await this.saveDraftFeedbackRecord(draftFeedback);

      return draftFeedback;
    } catch (error) {
      console.log(`⚠️ Moltbook 초안 공유 오류: ${error}`);
      return null;
    }
  }

  /**
   * 초안 피드백 기록 저장
   */
  private async saveDraftFeedbackRecord(feedback: DraftFeedback): Promise<void> {
    const recordPath = join(DATA_DIR, 'draft-feedback-records.json');

    let records: DraftFeedback[] = [];
    try {
      records = JSON.parse(await readFile(recordPath, 'utf-8'));
    } catch {
      // 파일 없으면 새로 생성
    }

    // 기존 레코드 업데이트 또는 추가
    const existingIndex = records.findIndex(r => r.draftId === feedback.draftId);
    if (existingIndex >= 0) {
      records[existingIndex] = feedback;
    } else {
      records.push(feedback);
    }

    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(recordPath, JSON.stringify(records, null, 2));
  }

  /**
   * 대기 중인 초안 피드백 목록 조회
   */
  async getPendingDraftFeedback(): Promise<DraftFeedback[]> {
    const recordPath = join(DATA_DIR, 'draft-feedback-records.json');

    try {
      const records: DraftFeedback[] = JSON.parse(await readFile(recordPath, 'utf-8'));
      return records.filter(r => r.status === 'pending');
    } catch {
      return [];
    }
  }
}

// ============================================================================
// 피드백 수집 Agent
// ============================================================================

export class FeedbackCollector {
  private config: MoltbookConfig;

  constructor(config: MoltbookConfig) {
    this.config = config;
  }

  /**
   * 모든 내 포스트의 피드백 수집
   */
  async collectAllFeedback(): Promise<FeedbackData[]> {
    if (!this.config.apiKey) {
      console.log('⚠️ Moltbook API 키가 설정되지 않았습니다.');
      return [];
    }

    try {
      const myPosts = await this.getMyPosts();
      const feedbackList: FeedbackData[] = [];

      for (const post of myPosts) {
        const comments = await this.getComments(post.id);
        const topics = this.extractTopics(post.title);
        const sentiment = this.analyzeSentiment(comments);

        feedbackList.push({
          postId: post.id,
          blogUrl: post.url,
          upvotes: post.upvotes,
          downvotes: post.downvotes,
          engagement: post.upvotes + comments.length,
          comments,
          topics,
          sentiment,
          timestamp: new Date().toISOString()
        });
      }

      // 피드백 데이터 저장
      await this.saveFeedback(feedbackList);

      console.log(`📊 피드백 수집 완료: ${feedbackList.length}개 포스트`);
      return feedbackList;
    } catch (error) {
      console.log(`⚠️ 피드백 수집 오류: ${error}`);
      return [];
    }
  }

  private async getMyPosts(): Promise<MoltbookPost[]> {
    // Get agent ID first
    const meResponse = await fetch(`${this.config.baseUrl}/agents/me`, {
      headers: { 'Authorization': `Bearer ${this.config.apiKey}` }
    });
    const meData = await meResponse.json() as { agent: { id: string } };
    const agentId = meData.agent?.id;

    if (!agentId) {
      console.log('⚠️ 에이전트 ID를 가져올 수 없습니다.');
      return [];
    }

    // Get posts using the correct endpoint
    const postsResponse = await fetch(`${this.config.baseUrl}/posts?author=${agentId}`, {
      headers: { 'Authorization': `Bearer ${this.config.apiKey}` }
    });

    const postsData = await postsResponse.json() as { posts: MoltbookPost[] };
    return postsData.posts || [];
  }

  private async getComments(postId: string): Promise<Comment[]> {
    const response = await fetch(
      `${this.config.baseUrl}/posts/${postId}/comments?sort=top`,
      { headers: { 'Authorization': `Bearer ${this.config.apiKey}` } }
    );

    const data = await response.json() as { comments: Comment[] };
    return data.comments || [];
  }

  private extractTopics(title: string): string[] {
    const keywords = [
      '제주', '서울', '부산', '강릉', '경주', '전주', '대구', '인천',
      '카페', '전시회', '축제', '여행', '맛집', '공연', '미술관', '박물관',
      '렌터카', '가격', '비교', '총정리', '추천', '코스', '일정'
    ];
    return keywords.filter(k => title.includes(k));
  }

  private analyzeSentiment(comments: Comment[]): 'positive' | 'neutral' | 'negative' {
    if (comments.length === 0) return 'neutral';

    const positiveWords = ['좋아요', '감사', '도움', '유용', '최고', '추천', '굿', '완벽'];
    const negativeWords = ['오래됐', '부정확', '틀렸', '아쉽', '실망', '별로', '업데이트'];

    let score = 0;
    for (const comment of comments) {
      const content = comment.content.toLowerCase();
      score += positiveWords.filter(w => content.includes(w)).length;
      score -= negativeWords.filter(w => content.includes(w)).length;
    }

    if (score > 2) return 'positive';
    if (score < -2) return 'negative';
    return 'neutral';
  }

  private async saveFeedback(data: FeedbackData[]): Promise<void> {
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `feedback-${timestamp}.json`;
    const filepath = join(DATA_DIR, filename);

    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(filepath, JSON.stringify(data, null, 2));
  }

  async loadRecentFeedback(days: number = 7): Promise<FeedbackData[]> {
    try {
      const files = await readdir(DATA_DIR);
      const feedbackFiles = files.filter(f => f.startsWith('feedback-'));

      const allFeedback: FeedbackData[] = [];
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);

      for (const file of feedbackFiles) {
        const filepath = join(DATA_DIR, file);
        const data: FeedbackData[] = JSON.parse(await readFile(filepath, 'utf-8'));

        const recent = data.filter(f => new Date(f.timestamp) > cutoff);
        allFeedback.push(...recent);
      }

      return allFeedback;
    } catch {
      return [];
    }
  }

  /**
   * 특정 초안의 피드백 수집
   */
  async collectDraftFeedback(draftFeedback: DraftFeedback): Promise<DraftFeedback> {
    if (!this.config.apiKey) {
      console.log('⚠️ Moltbook API 키가 설정되지 않았습니다.');
      return draftFeedback;
    }

    try {
      // 포스트 정보 조회
      const postResponse = await fetch(
        `${this.config.baseUrl}/posts/${draftFeedback.postId}`,
        { headers: { 'Authorization': `Bearer ${this.config.apiKey}` } }
      );

      if (!postResponse.ok) {
        console.log(`⚠️ 포스트 조회 실패: ${postResponse.statusText}`);
        return draftFeedback;
      }

      const postData = await postResponse.json() as { post: MoltbookPost };
      const post = postData.post;

      // 댓글 수집
      const comments = await this.getComments(draftFeedback.postId);

      // 제안 추출
      const suggestions = this.extractSuggestions(comments);

      // 감정 분석
      const sentiment = this.analyzeSentiment(comments);

      // 업데이트된 피드백
      const updatedFeedback: DraftFeedback = {
        ...draftFeedback,
        status: 'collected',
        collectedAt: new Date().toISOString(),
        upvotes: post.upvotes,
        downvotes: post.downvotes,
        comments,
        suggestions,
        sentiment
      };

      // 기록 업데이트
      await this.updateDraftFeedbackRecord(updatedFeedback);

      console.log(`📊 초안 피드백 수집 완료: ${draftFeedback.blogTitle}`);
      console.log(`   - Upvotes: ${updatedFeedback.upvotes}, Downvotes: ${updatedFeedback.downvotes}`);
      console.log(`   - 댓글: ${comments.length}개, 제안: ${suggestions.length}개`);
      console.log(`   - 감정: ${sentiment}`);

      return updatedFeedback;
    } catch (error) {
      console.log(`⚠️ 초안 피드백 수집 오류: ${error}`);
      return draftFeedback;
    }
  }

  /**
   * 댓글에서 제안 추출
   */
  private extractSuggestions(comments: Comment[]): string[] {
    const suggestions: string[] = [];
    const suggestionPatterns = [
      /추가.*하면/,
      /더.*있으면/,
      /포함.*좋을/,
      /알려.*주세요/,
      /정보.*필요/,
      /업데이트.*필요/,
      /틀렸/,
      /부정확/,
      /수정.*필요/
    ];

    for (const comment of comments) {
      const content = comment.content;
      if (suggestionPatterns.some(pattern => pattern.test(content))) {
        suggestions.push(content.substring(0, 100));
      }
    }

    return suggestions;
  }

  /**
   * 초안 피드백 기록 업데이트
   */
  private async updateDraftFeedbackRecord(feedback: DraftFeedback): Promise<void> {
    const recordPath = join(DATA_DIR, 'draft-feedback-records.json');

    let records: DraftFeedback[] = [];
    try {
      records = JSON.parse(await readFile(recordPath, 'utf-8'));
    } catch {
      // 파일 없으면 새로 생성
    }

    const existingIndex = records.findIndex(r => r.draftId === feedback.draftId);
    if (existingIndex >= 0) {
      records[existingIndex] = feedback;
    } else {
      records.push(feedback);
    }

    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(recordPath, JSON.stringify(records, null, 2));
  }

  /**
   * 대기 중인 모든 초안 피드백 수집
   */
  async collectAllPendingDraftFeedback(): Promise<DraftFeedback[]> {
    const recordPath = join(DATA_DIR, 'draft-feedback-records.json');

    try {
      const records: DraftFeedback[] = JSON.parse(await readFile(recordPath, 'utf-8'));
      const pending = records.filter(r => r.status === 'pending');

      const collected: DraftFeedback[] = [];
      for (const record of pending) {
        const updated = await this.collectDraftFeedback(record);
        collected.push(updated);
      }

      return collected;
    } catch {
      return [];
    }
  }
}

// ============================================================================
// 피드백 분석 Agent
// ============================================================================

export class FeedbackAnalyzer {
  analyze(feedbackData: FeedbackData[]): {
    topTopics: string[];
    topContentTypes: string[];
    requestedInfo: string[];
    improvementAreas: string[];
    successPatterns: {
      avgUpvotes: number;
      bestPostingTime: string;
      optimalLength: number;
    };
  } {
    // 인기 주제
    const topicEngagement = new Map<string, number>();
    for (const fb of feedbackData) {
      for (const topic of fb.topics) {
        topicEngagement.set(topic, (topicEngagement.get(topic) || 0) + fb.engagement);
      }
    }

    const topTopics = Array.from(topicEngagement.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([topic]) => topic);

    // 콘텐츠 유형
    const contentTypes = this.analyzeContentTypes(feedbackData);

    // 요청사항
    const requests = this.extractRequests(feedbackData);

    // 개선 영역
    const improvements = this.findImprovements(feedbackData);

    // 성공 패턴
    const avgUpvotes = feedbackData.length > 0
      ? feedbackData.reduce((sum, fb) => sum + fb.upvotes, 0) / feedbackData.length
      : 0;

    return {
      topTopics,
      topContentTypes: contentTypes,
      requestedInfo: requests,
      improvementAreas: improvements,
      successPatterns: {
        avgUpvotes: Math.round(avgUpvotes * 10) / 10,
        bestPostingTime: '09:00',
        optimalLength: 1800
      }
    };
  }

  private analyzeContentTypes(data: FeedbackData[]): string[] {
    const types = new Map<string, number>();

    for (const fb of data) {
      const url = fb.blogUrl;
      let type = '기타';

      if (url && typeof url === 'string') {
        if (url.includes('비교') || url.includes('총정리')) {
          type = '데이터 집계형';
        } else if (url.includes('코스') || url.includes('일정')) {
          type = '일정 큐레이션형';
        } else if (url.includes('TOP') || url.includes('순위')) {
          type = '분석/인사이트형';
        }
      }

      types.set(type, (types.get(type) || 0) + fb.engagement);
    }

    return Array.from(types.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([type]) => type);
  }

  private extractRequests(data: FeedbackData[]): string[] {
    const requests: string[] = [];

    for (const fb of data) {
      for (const comment of fb.comments) {
        const content = comment.content;
        if (content.includes('해주세요') || content.includes('알려주세요') ||
            (content.includes('더') && content.includes('필요'))) {
          requests.push(content.substring(0, 50));
        }
      }
    }

    return requests.slice(0, 10);
  }

  private findImprovements(data: FeedbackData[]): string[] {
    const improvements: string[] = [];

    for (const fb of data) {
      const url = fb.blogUrl || '(제목 없음)';

      if (fb.engagement < 5) {
        improvements.push(`"${url}" - 낮은 참여도`);
      }
      if (fb.sentiment === 'negative') {
        improvements.push(`"${url}" - 부정적 피드백`);
      }
      for (const comment of fb.comments) {
        if (comment.content.includes('오래됐') || comment.content.includes('업데이트')) {
          improvements.push(`"${url}" - 업데이트 필요`);
        }
      }
    }

    return improvements.slice(0, 5);
  }

  generateReport(analysis: ReturnType<typeof this.analyze>): string {
    return `
🦞 Moltbook 피드백 분석 리포트
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔥 인기 주제 TOP 5
${analysis.topTopics.length > 0 ? analysis.topTopics.map((t, i) => `${i + 1}. ${t}`).join('\n') : '데이터 없음'}

📝 효과적 콘텐츠 유형
${analysis.topContentTypes.length > 0 ? analysis.topContentTypes.map((t, i) => `${i + 1}. ${t}`).join('\n') : '데이터 없음'}

💬 커뮤니티 요청사항
${analysis.requestedInfo.length > 0 ? analysis.requestedInfo.slice(0, 5).map((r, i) => `${i + 1}. ${r}`).join('\n') : '요청 없음'}

⚠️  개선 필요
${analysis.improvementAreas.length > 0 ? analysis.improvementAreas.map((a, i) => `${i + 1}. ${a}`).join('\n') : '없음'}

📈 성공 패턴
├─ 평균 upvotes: ${analysis.successPatterns.avgUpvotes}
├─ 최적 포스팅 시간: ${analysis.successPatterns.bestPostingTime}
└─ 최적 글자수: ${analysis.successPatterns.optimalLength}자
    `.trim();
  }
}

// ============================================================================
// 전략 조정 Agent
// ============================================================================

export class StrategyAdjuster {
  private strategyPath: string;

  constructor() {
    this.strategyPath = join(CONFIG_DIR, 'content-strategy.json');
  }

  async adjust(analysis: ReturnType<FeedbackAnalyzer['analyze']>): Promise<ContentStrategy> {
    // 기존 전략에서 diversityTargets 보존
    const existing = await this.load();

    const newStrategy: ContentStrategy = {
      priorityTopics: analysis.topTopics,
      contentFormat: analysis.topContentTypes[0] || '데이터 집계형',
      focusAreas: analysis.requestedInfo.slice(0, 5),
      improvementPlan: analysis.improvementAreas,
      optimalPostingTime: analysis.successPatterns.bestPostingTime,
      optimalLength: analysis.successPatterns.optimalLength,
      lastUpdated: new Date().toISOString(),
      ...(existing?.diversityTargets ? { diversityTargets: existing.diversityTargets } : {})
    };

    // 서베이 인사이트 DB 머지
    try {
      const surveyDb = new SurveyInsightsDBManager();
      await surveyDb.load();
      const surveyRecs = surveyDb.getStrategyRecommendations();

      if (surveyRecs.priorityTopics.length > 0) {
        // 서베이 주제 우선 배치
        const merged = [...new Set([...surveyRecs.priorityTopics, ...newStrategy.priorityTopics])].slice(0, 10);
        newStrategy.priorityTopics = merged;
      }
      if (surveyRecs.contentFormat) {
        newStrategy.contentFormat = surveyRecs.contentFormat;
      }
      if (surveyRecs.focusAreas.length > 0) {
        const mergedFocus = [...new Set([...surveyRecs.focusAreas, ...newStrategy.focusAreas])].slice(0, 10);
        newStrategy.focusAreas = mergedFocus;
      }
      console.log('📊 서베이 인사이트 반영됨');
    } catch {
      // 서베이 DB 없어도 정상 동작
    }

    // 발행 포스트의 framing 분포 분석 → diversityTargets.framingMix 갱신
    try {
      const framingDist = await this.analyzeFramingDistribution();
      if (framingDist && Object.keys(framingDist).length > 0) {
        if (!newStrategy.diversityTargets) {
          newStrategy.diversityTargets = {
            agentRatio: { viral: 0.33, friendly: 0.34, informative: 0.33 },
            typeMix: { travel: 0.6, culture: 0.4 },
            regionPriority: [],
            regionCovered: []
          };
        }
        newStrategy.diversityTargets.framingMix = framingDist;
        console.log('📊 프레이밍 분포 반영됨:', Object.entries(framingDist).map(([k, v]) => `${k}:${Math.round(v * 100)}%`).join(', '));
      }
    } catch {
      // framing 분석 실패해도 정상 동작
    }

    await mkdir(CONFIG_DIR, { recursive: true });
    await writeFile(this.strategyPath, JSON.stringify(newStrategy, null, 2));

    console.log('✅ 콘텐츠 전략 업데이트 완료');
    return newStrategy;
  }

  /**
   * 발행된 포스트에서 framingType 분포 분석
   * blog/content/posts/ 하위의 frontmatter에서 framingType 필드를 집계
   */
  private async analyzeFramingDistribution(): Promise<Record<string, number> | null> {
    const blogPostsDir = join(process.cwd(), 'blog/content/posts');
    if (!existsSync(blogPostsDir)) return null;

    const counts: Record<string, number> = {};
    let total = 0;

    for (const category of ['travel', 'culture']) {
      const catDir = join(blogPostsDir, category);
      if (!existsSync(catDir)) continue;

      try {
        const files = await readdir(catDir);
        for (const file of files) {
          if (!file.endsWith('.md')) continue;
          const content = await readFile(join(catDir, file), 'utf-8');
          const match = content.match(/framingType:\s*["']?(\w+)["']?/);
          if (match) {
            counts[match[1]] = (counts[match[1]] || 0) + 1;
            total++;
          }
        }
      } catch {
        // 디렉토리 읽기 실패 무시
      }
    }

    if (total === 0) return null;

    // 비율로 변환
    const distribution: Record<string, number> = {};
    for (const [key, count] of Object.entries(counts)) {
      distribution[key] = Math.round((count / total) * 100) / 100;
    }

    return distribution;
  }

  async load(): Promise<ContentStrategy | null> {
    try {
      const data = await readFile(this.strategyPath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
}

// ============================================================================
// 통합 피드백 루프
// ============================================================================

export class MoltbookFeedbackLoop {
  private shareAgent: MoltbookShareAgent;
  private collector: FeedbackCollector;
  private analyzer: FeedbackAnalyzer;
  private adjuster: StrategyAdjuster;

  constructor(config: MoltbookConfig) {
    this.shareAgent = new MoltbookShareAgent(config);
    this.collector = new FeedbackCollector(config);
    this.analyzer = new FeedbackAnalyzer();
    this.adjuster = new StrategyAdjuster();
  }

  async publishAndShare(blogPost: {
    title: string;
    url: string;
    summary: string;
    category: 'travel' | 'culture';
    topics: string[];
  }): Promise<void> {
    console.log(`📤 Moltbook에 공유 중: ${blogPost.title}`);
    await this.shareAgent.sharePost(blogPost);
  }

  async runFeedbackCycle(): Promise<void> {
    console.log('🔄 피드백 사이클 시작...\n');

    console.log('1️⃣ 피드백 수집 중...');
    const feedback = await this.collector.collectAllFeedback();

    console.log('\n2️⃣ 피드백 분석 중...');
    const analysis = this.analyzer.analyze(feedback);
    const report = this.analyzer.generateReport(analysis);
    console.log('\n' + report);

    console.log('\n3️⃣ 전략 조정 중...');
    await this.adjuster.adjust(analysis);

    console.log('\n✅ 피드백 사이클 완료');
  }

  async heartbeat(): Promise<void> {
    console.log('💓 Heartbeat 실행...');

    const recentFeedback = await this.collector.loadRecentFeedback(7);

    if (recentFeedback.length === 0) {
      console.log('📭 새 피드백 없음');
      return;
    }

    const quickAnalysis = this.analyzer.analyze(recentFeedback);

    console.log(`
📊 Quick Stats (최근 7일)
├─ 총 포스트: ${recentFeedback.length}개
├─ 평균 upvotes: ${quickAnalysis.successPatterns.avgUpvotes}
├─ 새 요청사항: ${quickAnalysis.requestedInfo.length}개
└─ 개선 필요: ${quickAnalysis.improvementAreas.length}개
    `.trim());
  }

  /**
   * 초안을 Moltbook에 공유하여 피드백 수집
   */
  async shareDraft(draft: {
    title: string;
    summary: string;
    filePath: string;
    category: 'travel' | 'culture';
    topics: string[];
  }): Promise<DraftFeedback | null> {
    console.log(`📝 초안 공유 중: ${draft.title}`);
    return await this.shareAgent.shareDraft(draft);
  }

  /**
   * 대기 중인 초안 피드백 수집
   */
  async collectDraftFeedback(): Promise<DraftFeedback[]> {
    console.log('📊 초안 피드백 수집 중...');
    return await this.collector.collectAllPendingDraftFeedback();
  }

  /**
   * 대기 중인 초안 피드백 목록 조회
   */
  async getPendingDrafts(): Promise<DraftFeedback[]> {
    return await this.shareAgent.getPendingDraftFeedback();
  }

  /**
   * 초안 피드백 기반 발행 권장 여부 판단
   */
  async evaluateDraftForPublish(draftFeedback: DraftFeedback): Promise<{
    shouldPublish: boolean;
    reason: string;
    improvements: string[];
  }> {
    // 피드백이 수집되지 않았으면 수집
    let feedback = draftFeedback;
    if (feedback.status === 'pending') {
      feedback = await this.collector.collectDraftFeedback(draftFeedback);
    }

    const improvements: string[] = [];
    let shouldPublish = true;
    let reason = '피드백 기반 발행 권장';

    // 1. 부정적 감정 체크
    if (feedback.sentiment === 'negative') {
      shouldPublish = false;
      reason = '부정적 피드백 많음 - 수정 후 발행 권장';
      improvements.push(...feedback.suggestions);
    }

    // 2. Downvote 비율 체크
    const totalVotes = feedback.upvotes + feedback.downvotes;
    if (totalVotes > 0 && feedback.downvotes / totalVotes > 0.3) {
      shouldPublish = false;
      reason = 'Downvote 비율 높음 (30% 초과) - 수정 권장';
    }

    // 3. 제안 사항 체크
    if (feedback.suggestions.length >= 3) {
      improvements.push(...feedback.suggestions.slice(0, 5));
      if (shouldPublish) {
        reason = '개선 사항 반영 후 발행 권장';
      }
    }

    // 4. 댓글 없이 Upvote 없으면 관심 부족
    if (feedback.comments.length === 0 && feedback.upvotes === 0) {
      // 충분한 시간이 지났는지 체크 (12시간)
      const sharedTime = new Date(feedback.sharedAt).getTime();
      const now = Date.now();
      const hoursPassed = (now - sharedTime) / (1000 * 60 * 60);

      if (hoursPassed < 12) {
        reason = '피드백 수집 중 (12시간 미만)';
      } else {
        reason = '커뮤니티 관심 낮음 - 주제/제목 검토 권장';
      }
    }

    return {
      shouldPublish,
      reason,
      improvements
    };
  }
}

export default MoltbookFeedbackLoop;

// Re-export ShareQueue for CLI access
export { ShareQueue, normalizePath } from './share-queue.js';
export type { ShareQueueItem, ShareQueueConfig, ShareQueueStats, ShareQueueState } from './share-queue.js';
