// src/agents/moltbook/feedback-loop.ts

/**
 * Moltbook 피드백 루프 시스템
 * 
 * 기능:
 * 1. 블로그 포스트를 Moltbook에 자동 공유
 * 2. 커뮤니티 피드백 수집 (upvotes, 댓글)
 * 3. 피드백 분석 및 인사이트 도출
 * 4. 콘텐츠 전략 자동 조정
 */

import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';

// ============================================================================
// 타입 정의
// ============================================================================

interface MoltbookPost {
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

interface Comment {
  id: string;
  content: string;
  author: { name: string };
  upvotes: number;
  created_at: string;
}

interface FeedbackData {
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

interface ContentStrategy {
  priorityTopics: string[];
  contentFormat: string;
  focusAreas: string[];
  improvementPlan: string[];
  optimalPostingTime: string;
  optimalLength: number;
  lastUpdated: string;
}

// ============================================================================
// 설정
// ============================================================================

const MOLTBOOK_API = 'https://www.moltbook.com/api/v1';
const CONFIG_DIR = path.join(process.cwd(), 'config');
const DATA_DIR = path.join(process.cwd(), 'data/feedback');

// API 키 로드
async function loadApiKey(): Promise<string> {
  const credPath = path.join(CONFIG_DIR, 'moltbook-credentials.json');
  const cred = JSON.parse(await fs.readFile(credPath, 'utf-8'));
  return cred.api_key;
}

// ============================================================================
// 1. Moltbook 공유 Agent
// ============================================================================

export class MoltbookShareAgent {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
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
  }): Promise<MoltbookPost> {
    const submolt = blogPost.category === 'travel' ? 'travel' : 'culture';
    
    const response = await fetch(`${MOLTBOOK_API}/posts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
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
      throw new Error(`Moltbook 공유 실패: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`✅ Moltbook 공유 완료: ${data.post.id}`);
    
    // 공유 기록 저장
    await this.saveShareRecord(data.post.id, blogPost.url);
    
    return data.post;
  }

  /**
   * 공유 기록 저장 (블로그 URL ↔ Moltbook Post ID 매핑)
   */
  private async saveShareRecord(postId: string, blogUrl: string): Promise<void> {
    const recordPath = path.join(DATA_DIR, 'share-records.json');
    
    let records: Record<string, string> = {};
    try {
      records = JSON.parse(await fs.readFile(recordPath, 'utf-8'));
    } catch (e) {
      // 파일 없으면 새로 생성
    }
    
    records[blogUrl] = postId;
    await fs.writeFile(recordPath, JSON.stringify(records, null, 2));
  }

  /**
   * 블로그 URL로 Moltbook Post ID 찾기
   */
  async getPostIdByUrl(blogUrl: string): Promise<string | null> {
    const recordPath = path.join(DATA_DIR, 'share-records.json');
    
    try {
      const records = JSON.parse(await fs.readFile(recordPath, 'utf-8'));
      return records[blogUrl] || null;
    } catch (e) {
      return null;
    }
  }
}

// ============================================================================
// 2. 피드백 수집 Agent
// ============================================================================

export class FeedbackCollector {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * 모든 내 포스트의 피드백 수집
   */
  async collectAllFeedback(): Promise<FeedbackData[]> {
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
  }

  /**
   * 내 포스트 가져오기
   */
  private async getMyPosts(): Promise<MoltbookPost[]> {
    const response = await fetch(`${MOLTBOOK_API}/agents/me`, {
      headers: { 'Authorization': `Bearer ${this.apiKey}` }
    });

    const data = await response.json();
    return data.agent.recentPosts || [];
  }

  /**
   * 포스트 댓글 가져오기
   */
  private async getComments(postId: string): Promise<Comment[]> {
    const response = await fetch(
      `${MOLTBOOK_API}/posts/${postId}/comments?sort=top`,
      { headers: { 'Authorization': `Bearer ${this.apiKey}` } }
    );

    const data = await response.json();
    return data.comments || [];
  }

  /**
   * 제목에서 주제 추출
   */
  private extractTopics(title: string): string[] {
    // 간단한 키워드 추출 (실제로는 더 정교한 NLP 사용 가능)
    const keywords = [
      '제주', '서울', '부산', '강릉', '경주',
      '카페', '전시회', '축제', '여행', '맛집',
      '렌터카', '가격', '비교', '총정리', '추천'
    ];

    return keywords.filter(k => title.includes(k));
  }

  /**
   * 댓글 감정 분석
   */
  private analyzeSentiment(comments: Comment[]): 'positive' | 'neutral' | 'negative' {
    if (comments.length === 0) return 'neutral';

    const positiveWords = ['좋아요', '감사', '도움', '유용', '최고', '추천'];
    const negativeWords = ['오래됐', '부정확', '틀렸', '아쉽', '실망'];

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

  /**
   * 피드백 데이터 저장
   */
  private async saveFeedback(data: FeedbackData[]): Promise<void> {
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `feedback-${timestamp}.json`;
    const filepath = path.join(DATA_DIR, filename);

    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(filepath, JSON.stringify(data, null, 2));
  }

  /**
   * 최근 피드백 로드
   */
  async loadRecentFeedback(days: number = 7): Promise<FeedbackData[]> {
    const files = await fs.readdir(DATA_DIR);
    const feedbackFiles = files.filter(f => f.startsWith('feedback-'));
    
    const allFeedback: FeedbackData[] = [];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    for (const file of feedbackFiles) {
      const filepath = path.join(DATA_DIR, file);
      const data: FeedbackData[] = JSON.parse(await fs.readFile(filepath, 'utf-8'));
      
      const recent = data.filter(f => new Date(f.timestamp) > cutoff);
      allFeedback.push(...recent);
    }

    return allFeedback;
  }
}

// ============================================================================
// 3. 피드백 분석 Agent
// ============================================================================

export class FeedbackAnalyzer {
  /**
   * 피드백 데이터 분석
   */
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
    // 1. 인기 주제 파악
    const topicCounts = new Map<string, number>();
    const topicEngagement = new Map<string, number>();

    for (const fb of feedbackData) {
      for (const topic of fb.topics) {
        topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
        topicEngagement.set(topic, (topicEngagement.get(topic) || 0) + fb.engagement);
      }
    }

    const topTopics = Array.from(topicEngagement.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([topic]) => topic);

    // 2. 콘텐츠 유형 분석
    const contentTypes = this.analyzeContentTypes(feedbackData);

    // 3. 커뮤니티 요청사항 추출
    const requests = this.extractRequests(feedbackData);

    // 4. 개선 영역 파악
    const improvements = this.findImprovements(feedbackData);

    // 5. 성공 패턴
    const avgUpvotes = feedbackData.reduce((sum, fb) => sum + fb.upvotes, 0) / feedbackData.length;
    const bestTime = this.findBestPostingTime(feedbackData);
    const optimalLength = 1800; // TODO: 실제 데이터 기반 계산

    return {
      topTopics,
      topContentTypes: contentTypes,
      requestedInfo: requests,
      improvementAreas: improvements,
      successPatterns: {
        avgUpvotes: Math.round(avgUpvotes * 10) / 10,
        bestPostingTime: bestTime,
        optimalLength
      }
    };
  }

  /**
   * 콘텐츠 유형 분석
   */
  private analyzeContentTypes(data: FeedbackData[]): string[] {
    const types = new Map<string, number>();

    for (const fb of data) {
      const title = fb.blogUrl;
      let type = '기타';

      if (title.includes('비교') || title.includes('총정리')) {
        type = '데이터 집계형';
      } else if (title.includes('코스') || title.includes('일정')) {
        type = '일정 큐레이션형';
      } else if (title.includes('TOP') || title.includes('순위')) {
        type = '분석/인사이트형';
      }

      types.set(type, (types.get(type) || 0) + fb.engagement);
    }

    return Array.from(types.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([type]) => type);
  }

  /**
   * 커뮤니티 요청사항 추출
   */
  private extractRequests(data: FeedbackData[]): string[] {
    const requests: string[] = [];

    for (const fb of data) {
      for (const comment of fb.comments) {
        const content = comment.content;

        // "~해주세요", "~알려주세요" 패턴 찾기
        if (content.includes('해주세요') || content.includes('알려주세요')) {
          requests.push(content.substring(0, 50));
        }

        // "더 필요" 패턴
        if (content.includes('더') && content.includes('필요')) {
          requests.push(content.substring(0, 50));
        }
      }
    }

    return requests.slice(0, 10); // 최대 10개
  }

  /**
   * 개선 영역 파악
   */
  private findImprovements(data: FeedbackData[]): string[] {
    const improvements: string[] = [];

    for (const fb of data) {
      // 낮은 engagement
      if (fb.engagement < 5) {
        improvements.push(`"${fb.blogUrl}" - 낮은 참여도 (${fb.engagement})`);
      }

      // 부정적 댓글
      if (fb.sentiment === 'negative') {
        improvements.push(`"${fb.blogUrl}" - 부정적 피드백`);
      }

      // 특정 키워드
      for (const comment of fb.comments) {
        if (comment.content.includes('오래됐') || comment.content.includes('업데이트')) {
          improvements.push(`"${fb.blogUrl}" - 업데이트 필요`);
        }
      }
    }

    return improvements.slice(0, 5);
  }

  /**
   * 최적 포스팅 시간 찾기
   */
  private findBestPostingTime(data: FeedbackData[]): string {
    const hourEngagement = new Map<number, number>();

    for (const fb of data) {
      const hour = new Date(fb.timestamp).getHours();
      hourEngagement.set(hour, (hourEngagement.get(hour) || 0) + fb.engagement);
    }

    const bestHour = Array.from(hourEngagement.entries())
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 9;

    return `${bestHour.toString().padStart(2, '0')}:00`;
  }

  /**
   * 리포트 생성
   */
  generateReport(analysis: ReturnType<typeof this.analyze>): string {
    return `
🦞 Moltbook 피드백 분석 리포트
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔥 인기 주제 TOP 5
${analysis.topTopics.map((t, i) => `${i + 1}. ${t}`).join('\n')}

📝 효과적 콘텐츠 유형
${analysis.topContentTypes.map((t, i) => `${i + 1}. ${t}`).join('\n')}

💬 커뮤니티 요청사항
${analysis.requestedInfo.slice(0, 5).map((r, i) => `${i + 1}. ${r}`).join('\n')}

⚠️  개선 필요
${analysis.improvementAreas.map((a, i) => `${i + 1}. ${a}`).join('\n')}

📈 성공 패턴
├─ 평균 upvotes: ${analysis.successPatterns.avgUpvotes}
├─ 최적 포스팅 시간: ${analysis.successPatterns.bestPostingTime}
└─ 최적 글자수: ${analysis.successPatterns.optimalLength}자
    `.trim();
  }
}

// ============================================================================
// 4. 전략 조정 Agent
// ============================================================================

export class StrategyAdjuster {
  private strategyPath: string;

  constructor() {
    this.strategyPath = path.join(CONFIG_DIR, 'content-strategy.json');
  }

  /**
   * 분석 결과를 바탕으로 전략 조정
   */
  async adjust(analysis: ReturnType<FeedbackAnalyzer['analyze']>): Promise<ContentStrategy> {
    const newStrategy: ContentStrategy = {
      priorityTopics: analysis.topTopics,
      contentFormat: analysis.topContentTypes[0] || '데이터 집계형',
      focusAreas: analysis.requestedInfo.slice(0, 5),
      improvementPlan: analysis.improvementAreas,
      optimalPostingTime: analysis.successPatterns.bestPostingTime,
      optimalLength: analysis.successPatterns.optimalLength,
      lastUpdated: new Date().toISOString()
    };

    // 전략 파일 저장
    await fs.mkdir(CONFIG_DIR, { recursive: true });
    await fs.writeFile(this.strategyPath, JSON.stringify(newStrategy, null, 2));

    console.log('✅ 콘텐츠 전략 업데이트 완료');
    return newStrategy;
  }

  /**
   * 현재 전략 로드
   */
  async load(): Promise<ContentStrategy | null> {
    try {
      const data = await fs.readFile(this.strategyPath, 'utf-8');
      return JSON.parse(data);
    } catch (e) {
      return null;
    }
  }

  /**
   * 전략 비교 리포트
   */
  async compareStrategies(newStrategy: ContentStrategy): Promise<string> {
    const oldStrategy = await this.load();
    
    if (!oldStrategy) {
      return '📋 초기 전략 설정 완료';
    }

    const changes: string[] = [];

    // 우선 주제 변경
    const topicChanges = newStrategy.priorityTopics.filter(
      t => !oldStrategy.priorityTopics.includes(t)
    );
    if (topicChanges.length > 0) {
      changes.push(`새 우선 주제: ${topicChanges.join(', ')}`);
    }

    // 포커스 영역 변경
    const focusChanges = newStrategy.focusAreas.filter(
      f => !oldStrategy.focusAreas.includes(f)
    );
    if (focusChanges.length > 0) {
      changes.push(`새 포커스 영역: ${focusChanges.length}개 추가`);
    }

    // 시간 변경
    if (newStrategy.optimalPostingTime !== oldStrategy.optimalPostingTime) {
      changes.push(
        `포스팅 시간: ${oldStrategy.optimalPostingTime} → ${newStrategy.optimalPostingTime}`
      );
    }

    return changes.length > 0
      ? `🔄 전략 변경사항:\n${changes.map((c, i) => `${i + 1}. ${c}`).join('\n')}`
      : '✅ 전략 유지 (변경 없음)';
  }
}

// ============================================================================
// 5. 통합 워크플로우
// ============================================================================

export class MoltbookFeedbackLoop {
  private shareAgent: MoltbookShareAgent;
  private collector: FeedbackCollector;
  private analyzer: FeedbackAnalyzer;
  private adjuster: StrategyAdjuster;

  constructor(apiKey: string) {
    this.shareAgent = new MoltbookShareAgent(apiKey);
    this.collector = new FeedbackCollector(apiKey);
    this.analyzer = new FeedbackAnalyzer();
    this.adjuster = new StrategyAdjuster();
  }

  /**
   * 블로그 포스트 발행 + Moltbook 공유
   */
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

  /**
   * 피드백 수집 & 분석 & 전략 조정 (주기적 실행)
   */
  async runFeedbackCycle(): Promise<void> {
    console.log('🔄 피드백 사이클 시작...\n');

    // 1. 피드백 수집
    console.log('1️⃣ 피드백 수집 중...');
    const feedback = await this.collector.collectAllFeedback();

    // 2. 분석
    console.log('\n2️⃣ 피드백 분석 중...');
    const analysis = this.analyzer.analyze(feedback);
    const report = this.analyzer.generateReport(analysis);
    console.log('\n' + report);

    // 3. 전략 조정
    console.log('\n3️⃣ 전략 조정 중...');
    const newStrategy = await this.adjuster.adjust(analysis);
    const comparison = await this.adjuster.compareStrategies(newStrategy);
    console.log('\n' + comparison);

    console.log('\n✅ 피드백 사이클 완료');
  }

  /**
   * Heartbeat (4시간마다 실행)
   */
  async heartbeat(): Promise<void> {
    console.log('💓 Heartbeat 실행...');

    // 최근 7일 피드백만 빠르게 체크
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

    // 긴급 액션 필요시 알림
    if (quickAnalysis.improvementAreas.length > 3) {
      console.log('\n⚠️  주의: 개선 필요 항목이 많습니다. 전체 피드백 사이클 실행을 권장합니다.');
    }
  }
}

// ============================================================================
// CLI 실행
// ============================================================================

async function main() {
  const command = process.argv[2];
  const apiKey = await loadApiKey();
  const loop = new MoltbookFeedbackLoop(apiKey);

  switch (command) {
    case 'share':
      // 예시: npm run moltbook -- share "제목" "URL" "요약" "travel" "제주,카페"
      const [, , , title, url, summary, category, topicsStr] = process.argv;
      await loop.publishAndShare({
        title,
        url,
        summary,
        category: category as 'travel' | 'culture',
        topics: topicsStr.split(',')
      });
      break;

    case 'feedback':
      await loop.runFeedbackCycle();
      break;

    case 'heartbeat':
      await loop.heartbeat();
      break;

    default:
      console.log(`
사용법:
  npm run moltbook:share -- <title> <url> <summary> <category> <topics>
  npm run moltbook:feedback
  npm run moltbook:heartbeat
      `.trim());
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export default MoltbookFeedbackLoop;
