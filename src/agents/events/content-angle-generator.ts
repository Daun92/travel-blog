/**
 * 콘텐츠 앵글 생성기
 * 이벤트 하나에서 여러 콘텐츠 앵글(프리뷰/가이드/후기/숨은명소)을 생성
 */

import { CalendarEvent } from './event-calendar.js';
import { generate } from '../../generator/gemini.js';

// ============================================================================
// 타입 정의
// ============================================================================

export interface ContentAngle {
  title: string;
  personaId: 'viral' | 'friendly' | 'informative';
  contentType: 'preview' | 'guide' | 'realtime' | 'retrospective' | 'hidden_gem' | 'comparison';
  keywords: string[];
  estimatedViralScore: number;  // 0-100
  eventId: string;
  eventTitle: string;
  category: 'travel' | 'culture';
}

// ============================================================================
// 콘텐츠 타입별 제목 템플릿
// ============================================================================

const TITLE_TEMPLATES: Record<ContentAngle['contentType'], string[]> = {
  preview: [
    '{event} 가기 전 꼭 알아야 할 {n}가지',
    '{event} D-{days}, 이것만 알면 200% 즐긴다',
    '{event} 프리뷰: 올해 달라진 점 총정리'
  ],
  guide: [
    '{event} 완전정복 가이드 (교통·맛집·코스)',
    '{event} A to Z: 처음 가는 사람을 위한 올인원',
    '{event} 꿀팁 모음, 현지인이 알려주는 꿀코스'
  ],
  realtime: [
    '{event} 현장 실시간 후기, 진짜 분위기는?',
    '{event} 1일차 후기: 기대 vs 현실',
    '{event} 라이브 리포트, 지금 가야 하는 이유'
  ],
  retrospective: [
    '{event} 놓친 분을 위한 핵심 하이라이트',
    '{event} 후기: 가본 사람만 아는 진짜 꿀팁',
    '{event} 총정리, 내년엔 이렇게 가세요'
  ],
  hidden_gem: [
    '{event} 근처 숨은 명소 {n}곳, 함께 가면 2배 즐거운 곳',
    '{event} 말고 여기! 현지인만 아는 주변 핫플',
    '{event} + 알파: 놓치면 아쉬운 주변 스팟'
  ],
  comparison: [
    '{eventA} vs {eventB}, 어디 갈까? 완벽 비교',
    '이번 달 축제 어디 갈까? {eventA} vs {eventB}',
    '{eventA}·{eventB} 동시에 즐기는 코스 추천'
  ]
};

// ============================================================================
// ContentAngleGenerator
// ============================================================================

export class ContentAngleGenerator {
  /**
   * 이벤트에서 콘텐츠 앵글 생성
   */
  generateAngles(event: CalendarEvent, daysToStart: number): ContentAngle[] {
    const angles: ContentAngle[] = [];
    const category = this.inferContentCategory(event);

    // D-day 기준 앵글 생성
    if (daysToStart > event.timing.previewDays) {
      // 아직 이른 시점 - 프리뷰만
      angles.push(this.createAngle(event, 'preview', category));
    } else if (daysToStart > event.timing.guideDays) {
      // 프리뷰 타이밍
      angles.push(this.createAngle(event, 'preview', category));
      angles.push(this.createAngle(event, 'hidden_gem', category));
    } else if (daysToStart >= 0) {
      // 가이드 타이밍 (바이럴 최적)
      angles.push(this.createAngle(event, 'guide', category));
      angles.push(this.createAngle(event, 'hidden_gem', category));
      if (daysToStart <= 3) {
        angles.push(this.createAngle(event, 'preview', category));
      }
    } else {
      // 이벤트 진행 중 또는 종료 후
      const daysFromEnd = -daysToStart; // 대략적
      if (daysFromEnd <= event.timing.retroDays) {
        angles.push(this.createAngle(event, 'retrospective', category));
      }
    }

    // 항상 hidden_gem 앵글 추가 (중복 방지)
    if (!angles.some(a => a.contentType === 'hidden_gem') && event.hiddenGems.length > 0) {
      angles.push(this.createAngle(event, 'hidden_gem', category));
    }

    return angles;
  }

  /**
   * 두 이벤트 간 비교 앵글 생성
   */
  generateComparisonAngle(eventA: CalendarEvent, eventB: CalendarEvent): ContentAngle {
    const category = this.inferContentCategory(eventA);
    const title = TITLE_TEMPLATES.comparison[0]
      .replace('{eventA}', eventA.title)
      .replace('{eventB}', eventB.title);

    return {
      title,
      personaId: 'viral',
      contentType: 'comparison',
      keywords: [...eventA.keywords, ...eventB.keywords].filter((k, i, arr) => arr.indexOf(k) === i),
      estimatedViralScore: 85,
      eventId: eventA.id,
      eventTitle: `${eventA.title} vs ${eventB.title}`,
      category
    };
  }

  /**
   * Gemini로 제목 생성 (고품질)
   */
  async generateTitleWithAI(event: CalendarEvent, contentType: ContentAngle['contentType']): Promise<string> {
    const personaId = this.matchPersona(event, contentType);
    const personaDesc = personaId === 'viral' ? '바이럴/순위형, 클릭을 유도하는'
      : personaId === 'informative' ? '교양/해설형, 정보가 풍부한'
      : '친근감/실용형, 솔직한';

    const prompt = `당신은 한국 여행/문화 블로그 제목 작성 전문가입니다.

다음 이벤트의 ${contentType} 콘텐츠 제목을 1개 생성하세요.

이벤트: ${event.title}
기간: ${event.startDate} ~ ${event.endDate}
장소: ${event.location.venue}, ${event.location.region}
키워드: ${event.keywords.join(', ')}
톤: ${personaDesc}

요구사항:
- 한국어 자연스러운 블로그 제목
- 클릭을 유도하되 과장하지 않기
- 숫자나 구체적 정보 포함 권장
- 30자 이내

제목만 한 줄로 응답하세요.`;

    try {
      const response = await generate(prompt, { temperature: 0.9, max_tokens: 100 });
      return response.trim().replace(/^["']|["']$/g, '');
    } catch {
      // 폴백: 템플릿 기반
      return this.generateTemplateTitle(event, contentType);
    }
  }

  // ──────────────────────────────────────────────────
  // 내부 헬퍼
  // ──────────────────────────────────────────────────

  private createAngle(
    event: CalendarEvent,
    contentType: ContentAngle['contentType'],
    category: 'travel' | 'culture'
  ): ContentAngle {
    const personaId = this.matchPersona(event, contentType);
    const title = this.generateTemplateTitle(event, contentType);
    const viralScore = this.estimateViralScore(event, contentType, personaId);

    return {
      title,
      personaId,
      contentType,
      keywords: event.keywords,
      estimatedViralScore: viralScore,
      eventId: event.id,
      eventTitle: event.title,
      category
    };
  }

  private generateTemplateTitle(event: CalendarEvent, contentType: ContentAngle['contentType']): string {
    const templates = TITLE_TEMPLATES[contentType] || TITLE_TEMPLATES.guide;
    const template = templates[Math.floor(Math.random() * templates.length)];

    return template
      .replace('{event}', event.title)
      .replace('{n}', String(Math.floor(Math.random() * 5) + 3))
      .replace('{days}', String(Math.floor(Math.random() * 10) + 3))
      .replace('{eventA}', event.title)
      .replace('{eventB}', '');
  }

  /**
   * 페르소나 매칭 규칙
   */
  matchPersona(event: CalendarEvent, contentType: ContentAngle['contentType']): 'viral' | 'friendly' | 'informative' {
    // contentType 우선
    if (contentType === 'comparison') return 'viral';
    if (contentType === 'hidden_gem') return 'friendly';

    // personaFit 기반 최고 적합도
    const { viral, friendly, informative } = event.personaFit;

    // 카테고리 + visibility 조합
    if (event.category === 'festival' && event.visibility === 'major') return 'viral';
    if (event.category === 'exhibition' || event.category === 'performance') return 'informative';
    if (event.category === 'seasonal') return 'friendly';

    // personaFit 최고값
    if (viral >= friendly && viral >= informative) return 'viral';
    if (informative >= friendly) return 'informative';
    return 'friendly';
  }

  private estimateViralScore(
    event: CalendarEvent,
    contentType: ContentAngle['contentType'],
    personaId: string
  ): number {
    let score = 50;

    // contentType 보정
    if (contentType === 'guide') score += 20;
    if (contentType === 'comparison') score += 15;
    if (contentType === 'preview') score += 10;
    if (contentType === 'hidden_gem') score += 10;

    // visibility 보정
    if (event.visibility === 'major') score += 15;
    if (event.visibility === 'hidden') score += 5;

    // persona 보정
    if (personaId === 'viral') score += 10;

    return Math.min(100, Math.max(0, score));
  }

  private inferContentCategory(event: CalendarEvent): 'travel' | 'culture' {
    if (event.category === 'exhibition' || event.category === 'performance') return 'culture';
    if (event.category === 'conference') return 'culture';
    return 'travel';
  }
}

export default ContentAngleGenerator;
