/**
 * 포스트 성과 추적 모듈
 * 발행된 포스트의 성과 메트릭 수집 및 분석
 */

import { readFile, writeFile, mkdir, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import matter from 'gray-matter';
import { loadMoltbookConfig, FeedbackCollector } from '../agents/moltbook/index.js';

// ============================================================================
// 타입 정의
// ============================================================================

export interface PostMetrics {
  views: number;
  avgTimeOnPage: number;  // seconds
  bounceRate: number;  // 0-100
  exitRate: number;  // 0-100
  pageRank: number;  // internal ranking
}

export interface EngagementMetrics {
  moltbookUpvotes: number;
  moltbookDownvotes: number;
  moltbookComments: number;
  moltbookShares: number;
  sentiment: 'positive' | 'neutral' | 'negative';
}

export interface PostPerformance {
  postPath: string;
  title: string;
  category: string;
  publishedAt: string;
  lastUpdated: string;
  metrics: PostMetrics;
  engagement: EngagementMetrics;
  score: number;  // 종합 성과 점수 0-100
  trend: 'rising' | 'stable' | 'declining';
  tags: string[];
}

export interface PerformanceReport {
  generatedAt: string;
  totalPosts: number;
  avgScore: number;
  topPosts: PostPerformance[];
  lowPosts: PostPerformance[];
  byCategory: Record<string, {
    count: number;
    avgScore: number;
    bestPost: string;
  }>;
  insights: string[];
}

// ============================================================================
// 설정
// ============================================================================

const DATA_DIR = join(process.cwd(), 'data/monitoring');
const PERFORMANCE_DATA_PATH = join(DATA_DIR, 'performance.json');
const BLOG_POSTS_DIR = join(process.cwd(), 'blog/content/posts');

// ============================================================================
// 성과 추적기
// ============================================================================

export class PerformanceTracker {
  private performanceData: Map<string, PostPerformance> = new Map();

  /**
   * 성과 데이터 로드
   */
  async load(): Promise<void> {
    try {
      if (existsSync(PERFORMANCE_DATA_PATH)) {
        const content = await readFile(PERFORMANCE_DATA_PATH, 'utf-8');
        const data = JSON.parse(content) as PostPerformance[];

        for (const post of data) {
          this.performanceData.set(post.postPath, post);
        }
      }
    } catch (error) {
      console.log(`⚠️ 성과 데이터 로드 실패: ${error}`);
    }
  }

  /**
   * 성과 데이터 저장
   */
  async save(): Promise<void> {
    await mkdir(DATA_DIR, { recursive: true });
    const data = Array.from(this.performanceData.values());
    await writeFile(PERFORMANCE_DATA_PATH, JSON.stringify(data, null, 2));
  }

  /**
   * 모든 포스트 성과 업데이트
   */
  async updateAll(): Promise<number> {
    const posts = await this.scanPublishedPosts();
    let updated = 0;

    for (const postPath of posts) {
      try {
        await this.updatePostPerformance(postPath);
        updated++;
      } catch (error) {
        console.log(`⚠️ 성과 업데이트 실패 (${postPath}): ${error}`);
      }
    }

    await this.save();
    return updated;
  }

  /**
   * 단일 포스트 성과 업데이트
   */
  async updatePostPerformance(postPath: string): Promise<PostPerformance> {
    const absolutePath = postPath.startsWith(BLOG_POSTS_DIR)
      ? postPath
      : join(BLOG_POSTS_DIR, postPath);

    // 포스트 메타데이터 읽기
    const content = await readFile(absolutePath, 'utf-8');
    const { data: frontmatter } = matter(content);

    const title = frontmatter.title as string || 'Untitled';
    const categories = frontmatter.categories as string[] || [];
    const category = categories[0] || 'uncategorized';
    const publishedAt = frontmatter.date as string || new Date().toISOString();
    const tags = frontmatter.tags as string[] || [];

    // 기존 데이터 가져오기
    const existing = this.performanceData.get(postPath);

    // 메트릭 수집 (시뮬레이션 또는 실제 데이터)
    const metrics = await this.collectMetrics(postPath, existing);
    const engagement = await this.collectEngagement(postPath, existing);

    // 종합 점수 계산
    const score = this.calculateScore(metrics, engagement);

    // 트렌드 결정
    const trend = this.determineTrend(existing?.score, score);

    const performance: PostPerformance = {
      postPath,
      title,
      category,
      publishedAt,
      lastUpdated: new Date().toISOString(),
      metrics,
      engagement,
      score,
      trend,
      tags
    };

    this.performanceData.set(postPath, performance);

    return performance;
  }

  /**
   * 메트릭 수집
   */
  private async collectMetrics(
    postPath: string,
    existing?: PostPerformance
  ): Promise<PostMetrics> {
    // 실제 환경에서는 Google Analytics API 등 연동
    // 현재는 시뮬레이션 데이터 + 기존 데이터 기반 증가

    const baseMetrics = existing?.metrics || {
      views: 0,
      avgTimeOnPage: 0,
      bounceRate: 70,
      exitRate: 50,
      pageRank: 50
    };

    // 시뮬레이션: 시간에 따른 점진적 증가
    const daysSincePublish = existing
      ? Math.floor((Date.now() - new Date(existing.publishedAt).getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    // 랜덤 변동 + 시간 기반 증가
    const viewGrowth = Math.max(0, Math.floor(Math.random() * 50 * Math.log(daysSincePublish + 1)));

    return {
      views: baseMetrics.views + viewGrowth,
      avgTimeOnPage: Math.max(30, baseMetrics.avgTimeOnPage + (Math.random() - 0.5) * 10),
      bounceRate: Math.max(20, Math.min(90, baseMetrics.bounceRate + (Math.random() - 0.5) * 5)),
      exitRate: Math.max(20, Math.min(90, baseMetrics.exitRate + (Math.random() - 0.5) * 5)),
      pageRank: Math.max(0, Math.min(100, baseMetrics.pageRank + (Math.random() - 0.3) * 5))
    };
  }

  /**
   * 참여도 수집
   */
  private async collectEngagement(
    postPath: string,
    existing?: PostPerformance
  ): Promise<EngagementMetrics> {
    // Moltbook에서 실제 데이터 수집 시도
    try {
      const moltbookConfig = await loadMoltbookConfig();
      if (moltbookConfig) {
        // TODO: 실제 Moltbook API 연동
        // 현재는 시뮬레이션
      }
    } catch {
      // Moltbook 연동 실패 시 시뮬레이션
    }

    const baseEngagement = existing?.engagement || {
      moltbookUpvotes: 0,
      moltbookDownvotes: 0,
      moltbookComments: 0,
      moltbookShares: 0,
      sentiment: 'neutral' as const
    };

    // 시뮬레이션: 점진적 증가
    return {
      moltbookUpvotes: baseEngagement.moltbookUpvotes + Math.floor(Math.random() * 3),
      moltbookDownvotes: baseEngagement.moltbookDownvotes + (Math.random() > 0.9 ? 1 : 0),
      moltbookComments: baseEngagement.moltbookComments + (Math.random() > 0.7 ? 1 : 0),
      moltbookShares: baseEngagement.moltbookShares + (Math.random() > 0.85 ? 1 : 0),
      sentiment: this.calculateSentiment(
        baseEngagement.moltbookUpvotes,
        baseEngagement.moltbookDownvotes
      )
    };
  }

  /**
   * 감정 계산
   */
  private calculateSentiment(
    upvotes: number,
    downvotes: number
  ): 'positive' | 'neutral' | 'negative' {
    const total = upvotes + downvotes;
    if (total === 0) return 'neutral';

    const ratio = upvotes / total;
    if (ratio > 0.7) return 'positive';
    if (ratio < 0.3) return 'negative';
    return 'neutral';
  }

  /**
   * 종합 점수 계산
   */
  private calculateScore(
    metrics: PostMetrics,
    engagement: EngagementMetrics
  ): number {
    let score = 50; // 기본 점수

    // 조회수 기반 (30점)
    score += Math.min(30, Math.log(metrics.views + 1) * 5);

    // 체류 시간 기반 (20점)
    score += Math.min(20, (metrics.avgTimeOnPage / 180) * 20);

    // 바운스율 기반 (-20점 ~ 0점)
    score -= Math.max(0, (metrics.bounceRate - 50) / 5);

    // 참여도 기반 (30점)
    const totalEngagement = engagement.moltbookUpvotes + engagement.moltbookComments * 2;
    score += Math.min(30, totalEngagement * 2);

    // 부정적 피드백 감점
    score -= engagement.moltbookDownvotes * 3;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * 트렌드 결정
   */
  private determineTrend(
    oldScore: number | undefined,
    newScore: number
  ): 'rising' | 'stable' | 'declining' {
    if (oldScore === undefined) return 'stable';

    const diff = newScore - oldScore;
    if (diff > 5) return 'rising';
    if (diff < -5) return 'declining';
    return 'stable';
  }

  /**
   * 발행된 포스트 스캔
   */
  private async scanPublishedPosts(): Promise<string[]> {
    const posts: string[] = [];

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
          if (file.endsWith('.md')) {
            posts.push(join(cat, file));
          }
        }
      } catch {
        // 디렉토리 읽기 실패
      }
    }

    return posts;
  }

  /**
   * 성과 리포트 생성
   */
  async generateReport(): Promise<PerformanceReport> {
    await this.load();

    const allPosts = Array.from(this.performanceData.values());

    if (allPosts.length === 0) {
      return {
        generatedAt: new Date().toISOString(),
        totalPosts: 0,
        avgScore: 0,
        topPosts: [],
        lowPosts: [],
        byCategory: {},
        insights: ['아직 성과 데이터가 없습니다.']
      };
    }

    // 정렬
    const sorted = [...allPosts].sort((a, b) => b.score - a.score);

    // 평균 점수
    const avgScore = Math.round(
      allPosts.reduce((sum, p) => sum + p.score, 0) / allPosts.length
    );

    // 카테고리별 집계
    const byCategory: Record<string, { count: number; avgScore: number; bestPost: string }> = {};

    for (const post of allPosts) {
      if (!byCategory[post.category]) {
        byCategory[post.category] = { count: 0, avgScore: 0, bestPost: '' };
      }

      byCategory[post.category].count++;
      byCategory[post.category].avgScore += post.score;
    }

    for (const cat of Object.keys(byCategory)) {
      const catPosts = allPosts.filter(p => p.category === cat);
      byCategory[cat].avgScore = Math.round(byCategory[cat].avgScore / byCategory[cat].count);
      byCategory[cat].bestPost = catPosts.sort((a, b) => b.score - a.score)[0]?.title || '';
    }

    // 인사이트 생성
    const insights = this.generateInsights(allPosts, avgScore);

    return {
      generatedAt: new Date().toISOString(),
      totalPosts: allPosts.length,
      avgScore,
      topPosts: sorted.slice(0, 5),
      lowPosts: sorted.slice(-5).reverse(),
      byCategory,
      insights
    };
  }

  /**
   * 인사이트 생성
   */
  private generateInsights(posts: PostPerformance[], avgScore: number): string[] {
    const insights: string[] = [];

    // 성장 트렌드
    const risingPosts = posts.filter(p => p.trend === 'rising').length;
    if (risingPosts > posts.length * 0.3) {
      insights.push(`📈 ${risingPosts}개 포스트가 성장 중입니다.`);
    }

    // 저성과 포스트
    const lowPosts = posts.filter(p => p.score < 40);
    if (lowPosts.length > 0) {
      insights.push(`⚠️ ${lowPosts.length}개 포스트의 성과가 저조합니다. 업데이트를 고려하세요.`);
    }

    // 인기 카테고리
    const categoryScores = new Map<string, number[]>();
    for (const post of posts) {
      if (!categoryScores.has(post.category)) {
        categoryScores.set(post.category, []);
      }
      categoryScores.get(post.category)!.push(post.score);
    }

    let bestCategory = '';
    let bestCategoryAvg = 0;
    for (const [cat, scores] of categoryScores) {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      if (avg > bestCategoryAvg) {
        bestCategoryAvg = avg;
        bestCategory = cat;
      }
    }

    if (bestCategory) {
      insights.push(`🏆 "${bestCategory}" 카테고리가 평균 ${Math.round(bestCategoryAvg)}점으로 가장 좋은 성과를 보입니다.`);
    }

    // 인기 태그
    const tagCounts = new Map<string, number>();
    for (const post of posts.filter(p => p.score >= 70)) {
      for (const tag of post.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }

    const topTags = Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([tag]) => tag);

    if (topTags.length > 0) {
      insights.push(`🏷️ 인기 태그: ${topTags.join(', ')}`);
    }

    return insights;
  }

  /**
   * 특정 포스트 성과 조회
   */
  getPostPerformance(postPath: string): PostPerformance | null {
    return this.performanceData.get(postPath) || null;
  }

  /**
   * 모든 성과 데이터 조회
   */
  getAllPerformance(): PostPerformance[] {
    return Array.from(this.performanceData.values());
  }
}

export default PerformanceTracker;
