/**
 * 톤/어조 일관성 체커
 * 콘텐츠 유형별 적절한 톤 검사
 */

// ============================================================================
// 타입 정의
// ============================================================================

export type ToneType = 'casual' | 'informative' | 'professional' | 'mixed';

export interface ToneInconsistency {
  type: 'ending_mismatch' | 'formality_shift' | 'tone_break';
  severity: 'high' | 'medium' | 'low';
  message: string;
  location?: { line: number; text: string };
  detected: string;
  expected: string;
}

export interface ToneAnalysis {
  score: number;  // 0-100
  detectedTone: ToneType;
  targetTone: ToneType;
  toneConsistency: number;  // 0-100
  inconsistencies: ToneInconsistency[];
  metrics: {
    casualEndings: number;
    formalEndings: number;
    totalSentences: number;
    toneChanges: number;
  };
}

// ============================================================================
// 톤 프로필 정의
// ============================================================================

// 콘텐츠 타입별 목표 톤
export const TONE_PROFILES: Record<string, {
  targetTone: ToneType;
  description: string;
  acceptableEndings: string[];
  avoidEndings: string[];
}> = {
  travel: {
    targetTone: 'casual',
    description: '친근하고 대화하는 듯한 톤',
    acceptableEndings: ['해요', '거든요', '이에요', '예요', '네요', '죠', '요', '답니다'],
    avoidEndings: ['하다', '한다', '이다', '습니다', '됩니다', '었다', '였다']
  },
  culture: {
    targetTone: 'informative',
    description: '정보 전달 중심의 객관적 톤',
    acceptableEndings: ['입니다', '합니다', '습니다', '됩니다', '있습니다', '했습니다'],
    avoidEndings: ['해', '거든', '야', '데', '지']
  },
  professional: {
    targetTone: 'professional',
    description: '전문적이고 격식있는 톤',
    acceptableEndings: ['입니다', '합니다', '바랍니다', '있습니다', '됩니다'],
    avoidEndings: ['해요', '거든요', '네요', '죠']
  }
};

// 톤 감지 패턴
const CASUAL_PATTERNS = [
  /~해요[.!?]?$/,
  /~거든요[.!?]?$/,
  /~이에요[.!?]?$/,
  /~예요[.!?]?$/,
  /~네요[.!?]?$/,
  /~죠[.!?]?$/,
  /~요[.!?]?$/,
  /~답니다[.!?]?$/,
  /정말[^.]*좋/,
  /완전[^.]*대박/,
  /꼭[^.]*해보세요/,
  /강추[!]*/
];

const FORMAL_PATTERNS = [
  /~입니다[.!?]?$/,
  /~합니다[.!?]?$/,
  /~습니다[.!?]?$/,
  /~됩니다[.!?]?$/,
  /~있습니다[.!?]?$/,
  /~하였다[.!?]?$/,
  /~였습니다[.!?]?$/,
  /~바랍니다[.!?]?$/
];

const INFORMAL_PATTERNS = [
  /~해[.!?]?$/,
  /~야[.!?]?$/,
  /~지[.!?]?$/,
  /~거든[.!?]?$/,
  /~잖아[.!?]?$/
];

// ============================================================================
// 톤 체커
// ============================================================================

export class ToneChecker {
  /**
   * 톤 분석 실행
   */
  analyze(content: string, contentType: 'travel' | 'culture' | 'professional' = 'travel'): ToneAnalysis {
    // 마크다운 정리
    const cleanContent = this.cleanMarkdown(content);

    // 문장 추출
    const sentences = this.extractSentences(cleanContent);

    // 톤 프로필 가져오기
    const profile = TONE_PROFILES[contentType];

    // 각 문장 톤 분석
    const sentenceTones = sentences.map(s => this.detectSentenceTone(s));

    // 메트릭 계산
    const metrics = this.calculateMetrics(sentenceTones);

    // 검출된 주요 톤
    const detectedTone = this.determineOverallTone(metrics);

    // 일관성 검사
    const inconsistencies = this.findInconsistencies(
      sentences,
      sentenceTones,
      profile.targetTone
    );

    // 톤 일관성 점수
    const toneConsistency = this.calculateConsistency(sentenceTones);

    // 최종 점수
    const score = this.calculateScore(
      detectedTone,
      profile.targetTone,
      toneConsistency,
      inconsistencies
    );

    return {
      score,
      detectedTone,
      targetTone: profile.targetTone,
      toneConsistency,
      inconsistencies,
      metrics
    };
  }

  /**
   * 마크다운 정리
   */
  private cleanMarkdown(content: string): string {
    let cleaned = content.replace(/^---[\s\S]*?---\n/, '');
    cleaned = cleaned.replace(/!\[([^\]]*)\]\([^)]+\)/g, '');
    cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    cleaned = cleaned.replace(/^#{1,6}\s+/gm, '');
    cleaned = cleaned.replace(/```[\s\S]*?```/g, '');
    cleaned = cleaned.replace(/`[^`]+`/g, '');
    cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1');
    cleaned = cleaned.replace(/\*([^*]+)\*/g, '$1');
    return cleaned.trim();
  }

  /**
   * 문장 추출
   */
  private extractSentences(content: string): string[] {
    return content
      .split(/[.!?。]\s*|\n/)
      .map(s => s.trim())
      .filter(s => s.length >= 5);
  }

  /**
   * 단일 문장 톤 감지
   */
  private detectSentenceTone(sentence: string): ToneType {
    let casualScore = 0;
    let formalScore = 0;
    let informalScore = 0;

    // 캐주얼 패턴 검사
    for (const pattern of CASUAL_PATTERNS) {
      if (pattern.test(sentence)) {
        casualScore += 2;
      }
    }

    // 포멀 패턴 검사
    for (const pattern of FORMAL_PATTERNS) {
      if (pattern.test(sentence)) {
        formalScore += 2;
      }
    }

    // 인포멀 패턴 검사
    for (const pattern of INFORMAL_PATTERNS) {
      if (pattern.test(sentence)) {
        informalScore += 2;
      }
    }

    // 문장 끝 분석
    const ending = sentence.slice(-4);

    if (['해요', '거든', '네요', '예요', '이요'].some(e => ending.includes(e))) {
      casualScore += 1;
    }

    if (['니다', '습니다', '됩니다'].some(e => ending.includes(e))) {
      formalScore += 1;
    }

    // 점수 기반 판정
    const maxScore = Math.max(casualScore, formalScore, informalScore);

    if (maxScore === 0) return 'mixed';
    if (casualScore === maxScore) return 'casual';
    if (formalScore === maxScore) return 'informative';
    return 'casual';  // informal -> casual로 처리
  }

  /**
   * 메트릭 계산
   */
  private calculateMetrics(tones: ToneType[]): {
    casualEndings: number;
    formalEndings: number;
    totalSentences: number;
    toneChanges: number;
  } {
    const casualEndings = tones.filter(t => t === 'casual').length;
    const formalEndings = tones.filter(t => t === 'informative' || t === 'professional').length;

    // 톤 변화 횟수 계산
    let toneChanges = 0;
    for (let i = 1; i < tones.length; i++) {
      if (tones[i] !== 'mixed' && tones[i - 1] !== 'mixed' && tones[i] !== tones[i - 1]) {
        toneChanges++;
      }
    }

    return {
      casualEndings,
      formalEndings,
      totalSentences: tones.length,
      toneChanges
    };
  }

  /**
   * 전체 톤 결정
   */
  private determineOverallTone(metrics: ReturnType<typeof this.calculateMetrics>): ToneType {
    const total = metrics.casualEndings + metrics.formalEndings;

    if (total === 0) return 'mixed';

    const casualRatio = metrics.casualEndings / total;

    if (casualRatio > 0.7) return 'casual';
    if (casualRatio < 0.3) return 'informative';
    return 'mixed';
  }

  /**
   * 불일치 찾기
   */
  private findInconsistencies(
    sentences: string[],
    tones: ToneType[],
    targetTone: ToneType
  ): ToneInconsistency[] {
    const inconsistencies: ToneInconsistency[] = [];

    // 1. 목표 톤과 다른 문장 찾기
    sentences.forEach((sentence, index) => {
      const tone = tones[index];

      if (tone !== 'mixed' && tone !== targetTone) {
        const expectedDesc = targetTone === 'casual' ? '친근한 ~해요체' : '정보 전달 ~입니다체';
        const detectedDesc = tone === 'casual' ? '친근한 ~해요체' : '정보 전달 ~입니다체';

        inconsistencies.push({
          type: 'ending_mismatch',
          severity: 'medium',
          message: `문장 어조가 목표와 다릅니다. "${detectedDesc}" → "${expectedDesc}"`,
          location: { line: index + 1, text: sentence.substring(0, 40) + '...' },
          detected: detectedDesc,
          expected: expectedDesc
        });
      }
    });

    // 2. 갑작스러운 톤 변화 찾기
    for (let i = 1; i < sentences.length; i++) {
      const prevTone = tones[i - 1];
      const currTone = tones[i];

      if (prevTone !== 'mixed' && currTone !== 'mixed' && prevTone !== currTone) {
        // 연속 3문장 이상 같은 톤이었다가 바뀌면 심각
        let consecutiveCount = 0;
        for (let j = i - 1; j >= 0 && j >= i - 3; j--) {
          if (tones[j] === prevTone) consecutiveCount++;
        }

        if (consecutiveCount >= 2) {
          inconsistencies.push({
            type: 'tone_break',
            severity: 'high',
            message: '갑작스러운 톤 변화가 감지되었습니다.',
            location: { line: i + 1, text: sentences[i].substring(0, 40) + '...' },
            detected: currTone,
            expected: prevTone
          });
        }
      }
    }

    // 중복 제거 및 제한
    const unique = inconsistencies.slice(0, 10);

    return unique;
  }

  /**
   * 톤 일관성 계산
   */
  private calculateConsistency(tones: ToneType[]): number {
    if (tones.length === 0) return 100;

    // mixed 제외하고 가장 많은 톤 찾기
    const counts = { casual: 0, informative: 0, professional: 0 };

    for (const tone of tones) {
      if (tone !== 'mixed') {
        counts[tone]++;
      }
    }

    const maxCount = Math.max(...Object.values(counts));
    const relevantTones = tones.filter(t => t !== 'mixed').length;

    if (relevantTones === 0) return 100;

    return Math.round((maxCount / relevantTones) * 100);
  }

  /**
   * 점수 계산
   */
  private calculateScore(
    detectedTone: ToneType,
    targetTone: ToneType,
    consistency: number,
    inconsistencies: ToneInconsistency[]
  ): number {
    let score = 100;

    // 목표 톤과 일치 여부 (30점)
    if (detectedTone !== targetTone) {
      if (detectedTone === 'mixed') {
        score -= 15;  // mixed는 약간 감점
      } else {
        score -= 30;  // 완전히 다른 톤은 큰 감점
      }
    }

    // 일관성 점수 반영 (40점)
    score -= Math.round((100 - consistency) * 0.4);

    // 불일치 항목 감점 (30점)
    for (const inc of inconsistencies) {
      if (inc.severity === 'high') {
        score -= 5;
      } else if (inc.severity === 'medium') {
        score -= 2;
      } else {
        score -= 1;
      }
    }

    return Math.max(0, Math.min(100, score));
  }
}

/**
 * 톤 분석 실행 헬퍼
 */
export function analyzeTone(
  content: string,
  contentType: 'travel' | 'culture' | 'professional' = 'travel'
): ToneAnalysis {
  const checker = new ToneChecker();
  return checker.analyze(content, contentType);
}

export default ToneChecker;
