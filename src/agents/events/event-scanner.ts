/**
 * 이벤트 스캐너
 * EventCalendarDB에서 이벤트를 읽어 TopicRecommendation[]으로 변환
 * TopicDiscovery와 연동하는 브릿지 역할
 */

import EventCalendarManager, { CalendarEvent } from './event-calendar.js';
import { EnhancedScorer, TopicScore } from './enhanced-scorer.js';
import ContentAngleGenerator, { ContentAngle } from './content-angle-generator.js';
import type { TopicRecommendation } from '../moltbook/topic-discovery.js';

// ============================================================================
// EventCalendarScanner
// ============================================================================

export class EventCalendarScanner {
  private calendar: EventCalendarManager;
  private scorer: EnhancedScorer;
  private angleGenerator: ContentAngleGenerator;

  constructor(calendar?: EventCalendarManager) {
    this.calendar = calendar || new EventCalendarManager();
    this.scorer = new EnhancedScorer();
    this.angleGenerator = new ContentAngleGenerator();
  }

  /**
   * 이벤트 DB에서 콘텐츠 추천 생성
   * @param lookAheadDays 앞으로 몇 일 내 이벤트를 스캔할지 (기본 60일)
   * @param surveyBoosts 서베이 부스트 맵
   */
  async scan(options: {
    lookAheadDays?: number;
    surveyBoosts?: Record<string, number>;
  } = {}): Promise<TopicRecommendation[]> {
    const { lookAheadDays = 60, surveyBoosts = {} } = options;
    const now = new Date();

    await this.calendar.load();
    await this.scorer.loadPerformanceHistory();

    // 라이프사이클 갱신
    this.calendar.updateLifecycles();

    // 스캔 범위 내 이벤트
    const events = this.calendar.getEventsWithinDays(lookAheadDays);

    if (events.length === 0) {
      console.log('   📅 스캔 범위 내 이벤트 없음');
      return [];
    }

    console.log(`   📅 ${events.length}개 이벤트 스캔 중...`);

    const recommendations: TopicRecommendation[] = [];

    for (const event of events) {
      const startDate = new Date(event.startDate);
      const daysToStart = Math.round((startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      // 콘텐츠 앵글 생성
      const angles = this.angleGenerator.generateAngles(event, daysToStart);

      for (const angle of angles) {
        // 서베이 부스트 계산
        const surveyBoost = this.calculateSurveyBoost(event.keywords, surveyBoosts);

        // 강화 점수 계산
        const baseScore = this.calculateBaseScore(event, angle);
        const score = this.scorer.calculateScore(
          baseScore,
          surveyBoost,
          event.keywords,
          { relatedEvents: [event], now }
        );

        // 바이럴 타이밍 분석
        const timing = this.scorer.analyzeViralTiming(event, now);

        // 추천 생성
        const category = angle.category;
        const sourceTag = event.source === 'gemini' ? '[AI발굴]' : '[이벤트]';
        const timingTag = timing.urgency === 'critical' ? '🔥' : timing.urgency === 'high' ? '⚡' : '';

        recommendations.push({
          topic: event.title,
          type: category,
          score: score.final,
          source: 'event_calendar',
          reasoning: `${timingTag}${sourceTag} ${angle.contentType} | ${timing.recommendedAction}`,
          suggestedTitle: angle.title,
          keywords: [...event.keywords, ...event.hiddenGems.slice(0, 2)],
          discoveredAt: new Date().toISOString(),
          scoreBreakdown: score,
          personaId: angle.personaId,
          eventMeta: {
            eventId: event.id,
            eventTitle: event.title,
            contentType: angle.contentType
          }
        });
      }
    }

    // 비교 앵글 생성 (같은 달, 같은 카테고리 이벤트끼리)
    const comparisonAngles = this.generateComparisonAngles(events, now, surveyBoosts);
    recommendations.push(...comparisonAngles);

    // 점수 정렬
    recommendations.sort((a, b) => b.score - a.score);

    // 상위 20개만 반환 (너무 많으면 혼란)
    return recommendations.slice(0, 20);
  }

  /**
   * 바이럴 타이밍 현황 조회
   */
  async getTimingStatus(): Promise<Array<{
    event: CalendarEvent;
    timing: ReturnType<EnhancedScorer['analyzeViralTiming']>;
    boost: number;
  }>> {
    await this.calendar.load();
    this.calendar.updateLifecycles();

    const now = new Date();
    const events = this.calendar.getEventsWithinDays(30)
      .filter(e => e.status !== 'past');

    return events.map(event => ({
      event,
      timing: this.scorer.analyzeViralTiming(event, now),
      boost: this.scorer.calculateSingleEventBoost(event, now)
    })).sort((a, b) => {
      // urgency 순 정렬
      const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return urgencyOrder[a.timing.urgency] - urgencyOrder[b.timing.urgency];
    });
  }

  // ──────────────────────────────────────────────────
  // 내부 헬퍼
  // ──────────────────────────────────────────────────

  private calculateBaseScore(event: CalendarEvent, angle: ContentAngle): number {
    let score = 40; // 기본점

    // visibility
    if (event.visibility === 'major') score += 25;
    if (event.visibility === 'emerging') score += 15;
    if (event.visibility === 'hidden') score += 10;

    // contentType 가중
    if (angle.contentType === 'guide') score += 15;
    if (angle.contentType === 'comparison') score += 10;
    if (angle.contentType === 'preview') score += 5;

    // 바이럴 추정 점수 반영
    score += Math.round(angle.estimatedViralScore * 0.1);

    return Math.min(100, score);
  }

  private calculateSurveyBoost(keywords: string[], surveyBoosts: Record<string, number>): number {
    let maxBoost = 0;
    for (const kw of keywords) {
      for (const [surveyKw, boost] of Object.entries(surveyBoosts)) {
        if (kw.includes(surveyKw) || surveyKw.includes(kw)) {
          maxBoost = Math.max(maxBoost, boost);
        }
      }
    }
    return Math.min(30, maxBoost);
  }

  private generateComparisonAngles(
    events: CalendarEvent[],
    now: Date,
    surveyBoosts: Record<string, number>
  ): TopicRecommendation[] {
    const comparisons: TopicRecommendation[] = [];

    // 같은 월, 같은 카테고리의 major 이벤트 쌍
    const upcomingMajor = events.filter(e =>
      e.status === 'upcoming' && e.visibility === 'major'
    );

    for (let i = 0; i < upcomingMajor.length; i++) {
      for (let j = i + 1; j < upcomingMajor.length; j++) {
        const a = upcomingMajor[i];
        const b = upcomingMajor[j];

        // 같은 카테고리 또는 관련 이벤트
        if (a.category !== b.category) continue;

        const angle = this.angleGenerator.generateComparisonAngle(a, b);
        const surveyBoost = this.calculateSurveyBoost(
          [...a.keywords, ...b.keywords],
          surveyBoosts
        );

        const score = this.scorer.calculateScore(
          75, surveyBoost, [...a.keywords, ...b.keywords],
          { relatedEvents: [a, b], now }
        );

        comparisons.push({
          topic: `${a.title} vs ${b.title}`,
          type: angle.category,
          score: score.final,
          source: 'event_calendar',
          reasoning: `[비교] ${a.title} vs ${b.title}`,
          suggestedTitle: angle.title,
          keywords: angle.keywords,
          discoveredAt: new Date().toISOString(),
          scoreBreakdown: score,
          personaId: 'viral',
          eventMeta: {
            eventId: a.id,
            eventTitle: `${a.title} vs ${b.title}`,
            contentType: 'comparison'
          }
        });
      }
    }

    return comparisons.slice(0, 3); // 비교 앵글은 최대 3개
  }
}

export default EventCalendarScanner;
