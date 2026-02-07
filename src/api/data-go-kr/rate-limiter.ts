/**
 * data.go.kr API 레이트 리미터 + 쿼터 추적
 * - 일일 1,000건 쿼터 (자정 KST 리셋)
 * - 요청 간 최소 200ms 딜레이
 * - 80% 경고, 100% 차단
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname } from 'path';
import { ApiUsageData, QuotaExceededError } from './types.js';

export class RateLimiter {
  private lastRequestTime = 0;
  private usageData: ApiUsageData | null = null;

  constructor(
    private readonly dailyQuota: number = 1000,
    private readonly minDelayMs: number = 200,
    private readonly usageFilePath: string = 'data/api-usage.json'
  ) {}

  /**
   * 요청 전 호출 — 딜레이 대기 + 쿼터 확인
   * @throws QuotaExceededError 쿼터 초과 시
   */
  async acquire(): Promise<void> {
    // 1. 최소 딜레이 대기
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minDelayMs) {
      await new Promise(resolve => setTimeout(resolve, this.minDelayMs - elapsed));
    }

    // 2. 쿼터 확인
    const usage = await this.loadUsage();
    const todayKST = this.getTodayKST();

    // 날짜 변경 → 리셋
    if (usage.date !== todayKST) {
      usage.date = todayKST;
      usage.count = 0;
      usage.warned = false;
    }

    // 쿼터 초과 체크
    if (usage.count >= this.dailyQuota) {
      throw new QuotaExceededError(usage.count, this.dailyQuota);
    }

    // 80% 경고
    if (!usage.warned && usage.count >= this.dailyQuota * 0.8) {
      console.warn(`⚠️ data.go.kr 일일 쿼터 80% 도달: ${usage.count}/${this.dailyQuota}건`);
      usage.warned = true;
    }

    // 카운트 증가
    usage.count++;
    usage.lastRequestAt = new Date().toISOString();
    this.lastRequestTime = Date.now();

    await this.saveUsage(usage);
  }

  /** 현재 사용량 조회 */
  async getUsage(): Promise<ApiUsageData> {
    const usage = await this.loadUsage();
    const todayKST = this.getTodayKST();

    if (usage.date !== todayKST) {
      return {
        date: todayKST,
        count: 0,
        lastRequestAt: '',
        warned: false,
      };
    }

    return { ...usage };
  }

  /** 남은 쿼터 수 */
  async getRemaining(): Promise<number> {
    const usage = await this.getUsage();
    return Math.max(0, this.dailyQuota - usage.count);
  }

  // ─────────────────────────────────────────────
  // 내부 메서드
  // ─────────────────────────────────────────────

  private getTodayKST(): string {
    const now = new Date();
    // KST = UTC + 9
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    return kst.toISOString().split('T')[0];
  }

  private async loadUsage(): Promise<ApiUsageData> {
    if (this.usageData) return this.usageData;

    try {
      const raw = await readFile(this.usageFilePath, 'utf-8');
      this.usageData = JSON.parse(raw) as ApiUsageData;
      return this.usageData;
    } catch {
      // 파일 없으면 초기값
      this.usageData = {
        date: this.getTodayKST(),
        count: 0,
        lastRequestAt: '',
        warned: false,
      };
      return this.usageData;
    }
  }

  private async saveUsage(usage: ApiUsageData): Promise<void> {
    this.usageData = usage;

    try {
      await mkdir(dirname(this.usageFilePath), { recursive: true });
      await writeFile(this.usageFilePath, JSON.stringify(usage, null, 2));
    } catch (err) {
      console.warn('API 사용량 저장 실패:', err);
    }
  }
}
