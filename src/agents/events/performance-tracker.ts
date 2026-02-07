/**
 * 성과 피드백 트래커
 * 발행 후 Moltbook 반응을 기록하여 주제 점수에 반영
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

// ============================================================================
// 타입 정의
// ============================================================================

export interface PerformanceRecord {
  postPath: string;
  topicKeywords: string[];
  moltbookUpvotes: number;
  moltbookShares: number;
  category: 'travel' | 'culture';
  publishedAt: string;
  recordedAt: string;
}

interface PerformanceDB {
  version: string;
  lastUpdatedAt: string;
  records: PerformanceRecord[];
}

// ============================================================================
// 경로
// ============================================================================

const DB_PATH = join(process.cwd(), 'data', 'performance-history.json');

// ============================================================================
// PerformanceTracker
// ============================================================================

export class PerformanceTracker {
  private db: PerformanceDB;
  private loaded = false;

  constructor() {
    this.db = {
      version: '1.0.0',
      lastUpdatedAt: '',
      records: []
    };
  }

  /** DB 로드 */
  async load(): Promise<void> {
    if (this.loaded) return;

    try {
      if (existsSync(DB_PATH)) {
        const raw = await readFile(DB_PATH, 'utf-8');
        this.db = JSON.parse(raw) as PerformanceDB;
      }
    } catch {
      // 빈 DB 유지
    }

    this.loaded = true;
  }

  /** DB 저장 */
  async save(): Promise<void> {
    const dir = join(process.cwd(), 'data');
    await mkdir(dir, { recursive: true });
    this.db.lastUpdatedAt = new Date().toISOString();
    await writeFile(DB_PATH, JSON.stringify(this.db, null, 2), 'utf-8');
  }

  /** 성과 기록 추가 */
  addRecord(record: PerformanceRecord): void {
    // 동일 포스트 중복 방지 (업데이트)
    const idx = this.db.records.findIndex(r => r.postPath === record.postPath);
    if (idx >= 0) {
      this.db.records[idx] = record;
    } else {
      this.db.records.push(record);
    }
  }

  /** 전체 기록 조회 */
  getRecords(): PerformanceRecord[] {
    return this.db.records;
  }

  /** 유사 키워드 주제의 평균 성과 */
  getAveragePerformance(keywords: string[]): {
    avgUpvotes: number;
    avgShares: number;
    count: number;
    feedback: number; // -20~+20 정규화
  } | null {
    if (keywords.length === 0) return null;

    const similar = this.db.records.filter(record => {
      const overlap = record.topicKeywords.filter(rk =>
        keywords.some(k => rk.includes(k) || k.includes(rk))
      );
      return overlap.length >= Math.ceil(record.topicKeywords.length * 0.5);
    });

    if (similar.length === 0) return null;

    const avgUpvotes = similar.reduce((sum, r) => sum + r.moltbookUpvotes, 0) / similar.length;
    const avgShares = similar.reduce((sum, r) => sum + r.moltbookShares, 0) / similar.length;

    // 성과 점수: upvotes × 2 + shares × 5
    const avgPerformance = avgUpvotes * 2 + avgShares * 5;

    // -20 ~ +20 정규화 (기준: 20점 = 중립)
    const feedback = Math.max(-20, Math.min(20, Math.round((avgPerformance - 20) * 0.5)));

    return { avgUpvotes, avgShares, count: similar.length, feedback };
  }

  /**
   * Moltbook 피드백 데이터에서 성과 기록 자동 추출
   */
  async recordFromFeedback(feedbackData: {
    posts: Array<{
      blogUrl?: string;
      filePath?: string;
      title: string;
      upvotes: number;
      commentsCount: number;
      category?: 'travel' | 'culture';
      tags?: string[];
      keywords?: string[];
      publishedAt?: string;
    }>;
  }): Promise<number> {
    let recorded = 0;

    for (const post of feedbackData.posts) {
      const postPath = post.filePath || post.blogUrl || post.title;
      const topicKeywords = [
        ...(post.tags || []),
        ...(post.keywords || [])
      ].filter((k, i, arr) => arr.indexOf(k) === i);

      if (topicKeywords.length === 0) continue;

      this.addRecord({
        postPath,
        topicKeywords,
        moltbookUpvotes: post.upvotes || 0,
        moltbookShares: Math.round((post.commentsCount || 0) * 0.3), // 댓글의 30%를 공유로 추정
        category: post.category || 'travel',
        publishedAt: post.publishedAt || new Date().toISOString(),
        recordedAt: new Date().toISOString()
      });
      recorded++;
    }

    if (recorded > 0) {
      await this.save();
    }

    return recorded;
  }

  /** 최근 N일 간 성과 요약 */
  getRecentSummary(days: number = 30): {
    totalPosts: number;
    avgUpvotes: number;
    avgShares: number;
    topPerformers: PerformanceRecord[];
    lowPerformers: PerformanceRecord[];
  } {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const recent = this.db.records.filter(r => new Date(r.recordedAt) >= cutoff);

    if (recent.length === 0) {
      return {
        totalPosts: 0,
        avgUpvotes: 0,
        avgShares: 0,
        topPerformers: [],
        lowPerformers: []
      };
    }

    const avgUpvotes = recent.reduce((s, r) => s + r.moltbookUpvotes, 0) / recent.length;
    const avgShares = recent.reduce((s, r) => s + r.moltbookShares, 0) / recent.length;

    const sorted = [...recent].sort((a, b) =>
      (b.moltbookUpvotes * 2 + b.moltbookShares * 5) -
      (a.moltbookUpvotes * 2 + a.moltbookShares * 5)
    );

    return {
      totalPosts: recent.length,
      avgUpvotes: Math.round(avgUpvotes * 10) / 10,
      avgShares: Math.round(avgShares * 10) / 10,
      topPerformers: sorted.slice(0, 3),
      lowPerformers: sorted.slice(-3).reverse()
    };
  }
}

export default PerformanceTracker;
