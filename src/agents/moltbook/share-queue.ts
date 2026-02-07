/**
 * Moltbook 배치 공유 큐잉 시스템
 *
 * 기능:
 * - 우선순위 기반 공유 순서 결정 (신선도 + 품질 + 다양성 + 서베이)
 * - 지수 백오프 재시도 (최대 5회)
 * - 경로 정규화 (Windows/Unix 호환)
 * - 공유 시간대 제한 (기본 09:00-22:00)
 * - V1→V2 상태 파일 마이그레이션
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import matter from 'gray-matter';

// ============================================================
// 타입 정의
// ============================================================

export interface ShareQueueItem {
  filePath: string;          // 정규화된 경로 (항상 forward slash)
  title: string;
  category: string;
  publishedAt: string;       // ISO 날짜
  priority: number;          // 0-100
  status: 'pending' | 'shared' | 'failed' | 'skipped';
  retryCount: number;
  lastAttempt?: string;
  nextRetryAfter?: string;
  sharedAt?: string;
  moltbookPostId?: string;
  lastError?: string;
}

export interface ShareQueueConfig {
  rateLimitMinutes: number;
  maxRetries: number;
  timeWindowStart: number;   // 시작 시간 (24h, 기본 9)
  timeWindowEnd: number;     // 종료 시간 (24h, 기본 22)
  backoffMinutes: number[];  // 재시도 간격 [30, 60, 120, 240, 480]
}

export interface ShareQueueStats {
  totalPosts: number;
  shared: number;
  pending: number;
  failed: number;
  skipped: number;
  lastShareTime?: string;
}

export interface ShareQueueState {
  version: '2.0';
  queue: ShareQueueItem[];
  config: ShareQueueConfig;
  stats: ShareQueueStats;
}

// V1 타입 (마이그레이션용)
interface ShareStateV1 {
  lastSharedTime: string | null;
  sharedPosts: string[];
  pendingPosts: string[];
  totalShared: number;
}

// ============================================================
// 기본 설정
// ============================================================

const STATE_FILE = 'data/moltbook-share-state.json';

const DEFAULT_CONFIG: ShareQueueConfig = {
  rateLimitMinutes: 30,
  maxRetries: 5,
  timeWindowStart: 9,
  timeWindowEnd: 22,
  backoffMinutes: [30, 60, 120, 240, 480]
};

// ============================================================
// 경로 정규화
// ============================================================

/**
 * 경로를 forward slash로 정규화
 */
export function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

// ============================================================
// ShareQueue 클래스
// ============================================================

export class ShareQueue {
  private state: ShareQueueState;
  private stateFile: string;
  private loaded = false;

  constructor(stateFile: string = STATE_FILE) {
    this.stateFile = stateFile;
    this.state = {
      version: '2.0',
      queue: [],
      config: { ...DEFAULT_CONFIG },
      stats: {
        totalPosts: 0,
        shared: 0,
        pending: 0,
        failed: 0,
        skipped: 0
      }
    };
  }

  /**
   * 상태 파일 로드 (V1→V2 자동 마이그레이션)
   */
  async load(): Promise<void> {
    try {
      const data = await readFile(this.stateFile, 'utf-8');
      const parsed = JSON.parse(data);

      if (parsed.version === '2.0') {
        // V2: 그대로 사용 (경로 정규화 적용)
        this.state = parsed as ShareQueueState;
        this.state.queue = this.state.queue.map(item => ({
          ...item,
          filePath: normalizePath(item.filePath)
        }));
      } else if (parsed.sharedPosts !== undefined) {
        // V1: 마이그레이션
        this.state = this.migrateV1(parsed as ShareStateV1);
        await this.save(); // 즉시 V2로 저장
      }
    } catch {
      // 파일 없으면 기본 상태 유지
    }

    this.loaded = true;
    this.updateStats();
  }

  /**
   * V1 → V2 마이그레이션
   */
  private migrateV1(v1: ShareStateV1): ShareQueueState {
    const queue: ShareQueueItem[] = v1.sharedPosts.map(fp => ({
      filePath: normalizePath(fp),
      title: '',
      category: '',
      publishedAt: '',
      priority: 0,
      status: 'shared' as const,
      retryCount: 0,
      sharedAt: v1.lastSharedTime || new Date().toISOString()
    }));

    return {
      version: '2.0',
      queue,
      config: { ...DEFAULT_CONFIG },
      stats: {
        totalPosts: v1.sharedPosts.length,
        shared: v1.sharedPosts.length,
        pending: 0,
        failed: 0,
        skipped: 0,
        lastShareTime: v1.lastSharedTime || undefined
      }
    };
  }

  /**
   * 상태 파일 저장
   */
  async save(): Promise<void> {
    const dir = join(this.stateFile, '..');
    await mkdir(dir, { recursive: true });
    await writeFile(this.stateFile, JSON.stringify(this.state, null, 2), 'utf-8');
  }

  /**
   * 통계 업데이트
   */
  private updateStats(): void {
    this.state.stats = {
      totalPosts: this.state.queue.length,
      shared: this.state.queue.filter(i => i.status === 'shared').length,
      pending: this.state.queue.filter(i => i.status === 'pending').length,
      failed: this.state.queue.filter(i => i.status === 'failed').length,
      skipped: this.state.queue.filter(i => i.status === 'skipped').length,
      lastShareTime: this.state.stats.lastShareTime
    };
  }

  /**
   * 포스트를 큐에 추가
   */
  addPost(post: {
    filePath: string;
    title: string;
    category: string;
    publishedAt: string;
    qualityScore?: number;
    surveyBoost?: number;
  }): void {
    const normalizedPath = normalizePath(post.filePath);

    // 중복 확인
    const existing = this.state.queue.find(i => i.filePath === normalizedPath);
    if (existing) {
      // 이미 공유된 포스트는 다시 추가하지 않음
      if (existing.status === 'shared') return;
      // pending/failed 상태면 우선순위 재계산
      existing.priority = this.calculatePriority(post);
      return;
    }

    this.state.queue.push({
      filePath: normalizedPath,
      title: post.title,
      category: post.category,
      publishedAt: post.publishedAt,
      priority: this.calculatePriority(post),
      status: 'pending',
      retryCount: 0
    });

    this.updateStats();
  }

  /**
   * 우선순위 점수 계산 (0-100)
   */
  calculatePriority(post: {
    publishedAt: string;
    qualityScore?: number;
    category?: string;
    surveyBoost?: number;
  }): number {
    let score = 0;

    // 신선도 (0-30): 24시간 내 30점, 14일에 걸쳐 0으로 감소
    const hoursAgo = (Date.now() - new Date(post.publishedAt).getTime()) / (1000 * 60 * 60);
    if (hoursAgo <= 24) {
      score += 30;
    } else {
      const daysAgo = hoursAgo / 24;
      score += Math.max(0, Math.round(30 * (1 - daysAgo / 14)));
    }

    // 품질 점수 (0-30)
    if (post.qualityScore !== undefined) {
      score += Math.round((post.qualityScore / 100) * 30);
    } else {
      score += 15; // 기본값
    }

    // 카테고리 다양성 (0-20): 최근 공유에서 부족한 카테고리 보너스
    if (post.category) {
      const recentShared = this.state.queue
        .filter(i => i.status === 'shared')
        .slice(-5);
      const categoryCount = recentShared.filter(i => i.category === post.category).length;
      score += Math.max(0, 20 - categoryCount * 5);
    }

    // 서베이 관련성 (0-20)
    score += Math.min(20, post.surveyBoost || 0);

    return Math.min(100, score);
  }

  /**
   * 다음 공유할 포스트 가져오기 (우선순위 순)
   */
  getNextPost(): ShareQueueItem | null {
    const now = new Date();

    // 시간대 확인
    if (!this.isInTimeWindow(now)) {
      return null;
    }

    // Rate limit 확인
    if (!this.canShare()) {
      return null;
    }

    // 재시도 가능한 failed 포스트 + pending 포스트
    const candidates = this.state.queue.filter(item => {
      if (item.status === 'pending') return true;
      if (item.status === 'failed' && item.retryCount < this.state.config.maxRetries) {
        // 재시도 시간 확인
        if (item.nextRetryAfter) {
          return new Date(item.nextRetryAfter) <= now;
        }
        return true;
      }
      return false;
    });

    if (candidates.length === 0) return null;

    // 우선순위 내림차순 정렬
    candidates.sort((a, b) => b.priority - a.priority);
    return candidates[0];
  }

  /**
   * 공유 가능 시간대인지 확인
   */
  isInTimeWindow(now: Date = new Date()): boolean {
    const hour = now.getHours();
    return hour >= this.state.config.timeWindowStart &&
           hour < this.state.config.timeWindowEnd;
  }

  /**
   * Rate limit 확인
   */
  canShare(): boolean {
    if (!this.state.stats.lastShareTime) return true;

    const lastTime = new Date(this.state.stats.lastShareTime);
    const diffMinutes = (Date.now() - lastTime.getTime()) / 1000 / 60;
    return diffMinutes >= this.state.config.rateLimitMinutes;
  }

  /**
   * 다음 공유까지 남은 시간 (분)
   */
  getWaitMinutes(): number {
    if (!this.state.stats.lastShareTime) return 0;

    const lastTime = new Date(this.state.stats.lastShareTime);
    const diffMinutes = (Date.now() - lastTime.getTime()) / 1000 / 60;
    return Math.max(0, this.state.config.rateLimitMinutes - diffMinutes);
  }

  /**
   * 공유 성공 기록
   */
  markShared(filePath: string, moltbookPostId?: string): void {
    const normalized = normalizePath(filePath);
    const item = this.state.queue.find(i => i.filePath === normalized);
    if (!item) return;

    item.status = 'shared';
    item.sharedAt = new Date().toISOString();
    item.moltbookPostId = moltbookPostId;

    this.state.stats.lastShareTime = item.sharedAt;
    this.updateStats();
  }

  /**
   * 공유 실패 기록 (지수 백오프 재시도)
   */
  markFailed(filePath: string, error: string, isClientError = false): void {
    const normalized = normalizePath(filePath);
    const item = this.state.queue.find(i => i.filePath === normalized);
    if (!item) return;

    item.retryCount++;
    item.lastAttempt = new Date().toISOString();
    item.lastError = error;

    // 4xx 에러(콘텐츠 문제)는 재시도하지 않음
    if (isClientError) {
      item.status = 'skipped';
      item.lastError = `[재시도 불가] ${error}`;
    } else if (item.retryCount >= this.state.config.maxRetries) {
      item.status = 'skipped';
    } else {
      item.status = 'failed';
      // 지수 백오프: [30, 60, 120, 240, 480]분
      const backoffIndex = Math.min(item.retryCount - 1, this.state.config.backoffMinutes.length - 1);
      const backoffMs = this.state.config.backoffMinutes[backoffIndex] * 60 * 1000;
      item.nextRetryAfter = new Date(Date.now() + backoffMs).toISOString();
    }

    this.updateStats();
  }

  /**
   * 이미 공유된 포스트인지 확인
   */
  isShared(filePath: string): boolean {
    const normalized = normalizePath(filePath);
    return this.state.queue.some(i => i.filePath === normalized && i.status === 'shared');
  }

  /**
   * 대시보드용 상태 정보
   */
  getStatus(): {
    stats: ShareQueueStats;
    pendingPosts: ShareQueueItem[];
    failedPosts: ShareQueueItem[];
    recentShared: ShareQueueItem[];
    canShareNow: boolean;
    waitMinutes: number;
    inTimeWindow: boolean;
  } {
    return {
      stats: { ...this.state.stats },
      pendingPosts: this.state.queue
        .filter(i => i.status === 'pending')
        .sort((a, b) => b.priority - a.priority),
      failedPosts: this.state.queue.filter(i => i.status === 'failed'),
      recentShared: this.state.queue
        .filter(i => i.status === 'shared')
        .sort((a, b) => (b.sharedAt || '').localeCompare(a.sharedAt || ''))
        .slice(0, 5),
      canShareNow: this.canShare() && this.isInTimeWindow(),
      waitMinutes: this.getWaitMinutes(),
      inTimeWindow: this.isInTimeWindow()
    };
  }

  /**
   * content-strategy.json에서 공유 시간대 로드
   */
  async loadTimeWindowFromStrategy(): Promise<void> {
    try {
      const strategyPath = 'config/content-strategy.json';
      const data = await readFile(strategyPath, 'utf-8');
      const strategy = JSON.parse(data);

      if (strategy.optimalPostingTime) {
        const timeMatch = strategy.optimalPostingTime.match(/(\d{1,2})/);
        if (timeMatch) {
          const startHour = parseInt(timeMatch[1], 10);
          this.state.config.timeWindowStart = Math.max(6, startHour - 1);
          this.state.config.timeWindowEnd = Math.min(23, startHour + 13);
        }
      }
    } catch {
      // 전략 파일 없으면 기본값 유지
    }
  }
}
