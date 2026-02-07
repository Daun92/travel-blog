/**
 * 강화 점수 체계 (0-200)
 * 기존 0-100 → 0-200 스케일로 확장
 *
 * final = min(200, (base + surveyBoost) × seasonalMultiplier × timeDecay + eventBoost + performanceFeedback)
 */

import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { CalendarEvent, SeasonalPattern, DEFAULT_SEASONAL_PATTERNS } from './event-calendar.js';

// ============================================================================
// 타입 정의
// ============================================================================

export interface TopicScore {
  base: number;                  // 0-100 (기존 로직 유지)
  surveyBoost: number;           // 0-30 (기존 유지)
  eventBoost: number;            // 0-50 (NEW)
  seasonalMultiplier: number;    // 0.8-1.5 (NEW)
  timeDecay: number;             // 0.5-1.0 (NEW)
  performanceFeedback: number;   // -20~+20 (NEW)
  final: number;                 // 0-200
}

export interface ScoringContext {
  /** 현재 날짜 (테스트용 오버라이드 가능) */
  now?: Date;
  /** 계절 패턴 */
  seasonalPatterns?: Record<string, SeasonalPattern>;
  /** 이벤트 캘린더의 관련 이벤트 */
  relatedEvents?: CalendarEvent[];
  /** 성과 피드백 데이터 */
  performanceData?: PerformanceRecord[];
}

export interface PerformanceRecord {
  postPath: string;
  topicKeywords: string[];
  moltbookUpvotes: number;
  moltbookShares: number;
  category: 'travel' | 'culture';
  publishedAt: string;
  recordedAt: string;
}

// ============================================================================
// EnhancedScorer
// ============================================================================

export class EnhancedScorer {
  private seasonalPatterns: Record<string, SeasonalPattern>;
  private performanceHistory: PerformanceRecord[];

  constructor() {
    this.seasonalPatterns = DEFAULT_SEASONAL_PATTERNS;
    this.performanceHistory = [];
  }

  /** 성과 히스토리 로드 */
  async loadPerformanceHistory(): Promise<void> {
    const historyPath = join(process.cwd(), 'data', 'performance-history.json');
    if (!existsSync(historyPath)) return;

    try {
      const raw = await readFile(historyPath, 'utf-8');
      const data = JSON.parse(raw) as { records: PerformanceRecord[] };
      this.performanceHistory = data.records || [];
    } catch {
      // 파일 없으면 빈 배열 유지
    }
  }

  /** 계절 패턴 설정 */
  setSeasonalPatterns(patterns: Record<string, SeasonalPattern>): void {
    this.seasonalPatterns = patterns;
  }

  /**
   * 통합 점수 계산 (0-200)
   */
  calculateScore(
    baseScore: number,
    surveyBoost: number,
    keywords: string[],
    context: ScoringContext = {}
  ): TopicScore {
    const now = context.now || new Date();

    // 1. base + surveyBoost
    const base = Math.min(100, Math.max(0, baseScore));
    const survey = Math.min(30, Math.max(0, surveyBoost));

    // 2. seasonalMultiplier
    const seasonalMultiplier = this.calculateSeasonalMultiplier(
      keywords,
      now,
      context.seasonalPatterns || this.seasonalPatterns
    );

    // 3. timeDecay (일반 주제용, 이벤트 주제는 eventBoost로 대체)
    const timeDecay = context.relatedEvents && context.relatedEvents.length > 0
      ? 1.0  // 이벤트 연결 주제는 감쇠 없음
      : 1.0; // 발굴 시점 기반 감쇠는 discover 시 적용

    // 4. eventBoost
    const eventBoost = this.calculateEventBoost(context.relatedEvents || [], now);

    // 5. performanceFeedback
    const performanceFeedback = this.calculatePerformanceFeedback(
      keywords,
      context.performanceData || this.performanceHistory
    );

    // 최종 점수
    const final = Math.min(200, Math.max(0,
      Math.round((base + survey) * seasonalMultiplier * timeDecay + eventBoost + performanceFeedback)
    ));

    return {
      base,
      surveyBoost: survey,
      eventBoost,
      seasonalMultiplier,
      timeDecay,
      performanceFeedback,
      final
    };
  }

  /**
   * discoveredAt 기반 시간 감쇠 계산
   */
  calculateTimeDecay(discoveredAt: string, now?: Date): number {
    const target = now || new Date();
    const discovered = new Date(discoveredAt);
    const daysSince = (target.getTime() - discovered.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSince <= 7) return 1.0;
    if (daysSince <= 14) return 0.95;
    if (daysSince <= 30) return 0.85;
    if (daysSince <= 60) return 0.7;
    if (daysSince <= 90) return 0.6;
    return 0.5;
  }

  // ──────────────────────────────────────────────────
  // 이벤트 근접도 부스트 (0-50)
  // ──────────────────────────────────────────────────

  private calculateEventBoost(events: CalendarEvent[], now: Date): number {
    if (events.length === 0) return 0;

    let maxBoost = 0;

    for (const event of events) {
      const boost = this.calculateSingleEventBoost(event, now);
      maxBoost = Math.max(maxBoost, boost);
    }

    return maxBoost;
  }

  calculateSingleEventBoost(event: CalendarEvent, now: Date): number {
    const startDate = new Date(event.startDate);
    const endDate = new Date(event.endDate);
    const daysToStart = (startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    const daysFromEnd = (now.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24);

    let boost = 0;

    // 이벤트 종료 후
    if (daysFromEnd > 0) {
      if (daysFromEnd <= 7) {
        // 후기 콘텐츠 윈도우
        boost = 30 * 0.6; // 18점
      } else {
        return 0; // 너무 늦음
      }
    } else {
      // 이벤트 시작 전 또는 진행 중
      const optimalWindow = event.timing.guideDays; // 카테고리별 최적 타이밍
      const deviation = Math.abs(daysToStart - optimalWindow);

      if (deviation <= 3) {
        boost = 50;  // 최적 타이밍
      } else if (deviation <= 7) {
        boost = 50 - (deviation - 3) * 2;  // 40~32
      } else if (deviation <= 14) {
        boost = 32 - (deviation - 7) * 1.3;  // ~23
      } else if (deviation <= 30) {
        boost = 23 - (deviation - 14) * 0.7;  // ~12
      } else {
        boost = Math.max(0, 12 - (deviation - 30) * 0.3);
      }
    }

    // visibility 보정
    if (event.visibility === 'hidden') {
      boost *= 1.2;  // 차별화 가치
    } else if (event.visibility === 'emerging') {
      boost *= 0.8;
    }
    // major는 ×1.0 (기본)

    return Math.min(50, Math.max(0, Math.round(boost)));
  }

  // ──────────────────────────────────────────────────
  // 계절 승수 (0.8-1.5)
  // ──────────────────────────────────────────────────

  private calculateSeasonalMultiplier(
    keywords: string[],
    now: Date,
    patterns: Record<string, SeasonalPattern>
  ): number {
    const currentMonth = now.getMonth() + 1; // 1-12

    for (const [, pattern] of Object.entries(patterns)) {
      if (!pattern.months.includes(currentMonth)) continue;

      // 주제 키워드가 계절 키워드와 매칭되는지 확인
      const hasMatch = keywords.some(kw =>
        pattern.keywords.some(sk => kw.includes(sk) || sk.includes(kw))
      );

      if (hasMatch) {
        return pattern.boost;
      }
    }

    return 1.0; // 매칭 없으면 중립
  }

  // ──────────────────────────────────────────────────
  // 성과 피드백 (-20 ~ +20)
  // ──────────────────────────────────────────────────

  private calculatePerformanceFeedback(
    keywords: string[],
    history: PerformanceRecord[]
  ): number {
    if (history.length === 0 || keywords.length === 0) return 0;

    // 유사 키워드(50% 이상 overlap) 주제의 과거 발행 성과 평균
    const similarRecords = history.filter(record => {
      const overlap = record.topicKeywords.filter(rk =>
        keywords.some(k => rk.includes(k) || k.includes(rk))
      );
      return overlap.length >= Math.ceil(record.topicKeywords.length * 0.5);
    });

    if (similarRecords.length === 0) return 0;

    // 성과 점수: upvotes × 2 + shares × 5
    const avgPerformance = similarRecords.reduce((sum, r) =>
      sum + r.moltbookUpvotes * 2 + r.moltbookShares * 5, 0
    ) / similarRecords.length;

    // -20 ~ +20 범위로 정규화
    // 기준: 20점 = 중립, 40점 이상 = 양호, 60점 이상 = 우수
    const normalized = Math.max(-20, Math.min(20, (avgPerformance - 20) * 0.5));

    return Math.round(normalized);
  }

  // ──────────────────────────────────────────────────
  // 바이럴 타이밍 분석
  // ──────────────────────────────────────────────────

  /**
   * 이벤트의 바이럴 타이밍 현황 분석
   */
  analyzeViralTiming(event: CalendarEvent, now?: Date): {
    phase: 'too_early' | 'preview' | 'optimal' | 'guide' | 'active' | 'retrospective' | 'expired';
    daysToStart: number;
    daysFromEnd: number;
    urgency: 'low' | 'medium' | 'high' | 'critical';
    recommendedAction: string;
  } {
    const target = now || new Date();
    const startDate = new Date(event.startDate);
    const endDate = new Date(event.endDate);
    const daysToStart = Math.round((startDate.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));
    const daysFromEnd = Math.round((target.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24));

    let phase: 'too_early' | 'preview' | 'optimal' | 'guide' | 'active' | 'retrospective' | 'expired';
    let urgency: 'low' | 'medium' | 'high' | 'critical';
    let recommendedAction: string;

    if (daysFromEnd > event.timing.retroDays) {
      phase = 'expired';
      urgency = 'low';
      recommendedAction = '이벤트 종료 - 콘텐츠 기회 만료';
    } else if (daysFromEnd > 0) {
      phase = 'retrospective';
      urgency = 'medium';
      recommendedAction = '후기/리뷰 콘텐츠 발행 가능';
    } else if (daysToStart <= 0) {
      phase = 'active';
      urgency = 'high';
      recommendedAction = '현장 가이드/실시간 정보 콘텐츠';
    } else if (daysToStart <= event.timing.guideDays) {
      phase = 'guide';
      urgency = 'critical';
      recommendedAction = '⚡ 바이럴 최적 타이밍! 완전정복 가이드 콘텐츠 즉시 발행';
    } else if (daysToStart <= event.timing.guideDays + 3) {
      phase = 'optimal';
      urgency = 'critical';
      recommendedAction = '🔥 최적 타이밍 진입! 가이드 콘텐츠 준비';
    } else if (daysToStart <= event.timing.previewDays) {
      phase = 'preview';
      urgency = 'medium';
      recommendedAction = '프리뷰/사전 정보 콘텐츠 발행';
    } else {
      phase = 'too_early';
      urgency = 'low';
      recommendedAction = `D-${daysToStart}일 - 아직 이른 시점`;
    }

    return { phase, daysToStart, daysFromEnd, urgency, recommendedAction };
  }
}

export default EnhancedScorer;
