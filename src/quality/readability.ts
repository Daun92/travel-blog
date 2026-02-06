/**
 * 가독성 분석 모듈
 * 한국어 기준 가독성 점수 계산
 */

// ============================================================================
// 타입 정의
// ============================================================================

export interface ReadabilitySuggestion {
  type: 'sentence_length' | 'paragraph_length' | 'complex_word' | 'formatting';
  severity: 'high' | 'medium' | 'low';
  message: string;
  location?: { line: number; text: string };
}

export interface ReadabilityAnalysis {
  score: number;  // 0-100
  avgSentenceLength: number;  // 평균 문장 길이 (글자)
  avgParagraphLength: number;  // 평균 단락 문장 수
  longSentenceCount: number;  // 긴 문장 개수
  shortParagraphCount: number;  // 짧은 단락 개수
  suggestions: ReadabilitySuggestion[];
  metrics: {
    totalSentences: number;
    totalParagraphs: number;
    totalCharacters: number;
    koreanCharacters: number;
  };
}

// ============================================================================
// 설정
// ============================================================================

// 한국어 가독성 기준
const KOREAN_READABILITY = {
  sentence: {
    optimal: { min: 20, max: 60 },  // 최적 문장 길이 (글자)
    warning: { min: 10, max: 80 },  // 경고 범위
    max: 100  // 너무 긴 문장
  },
  paragraph: {
    optimal: { min: 2, max: 5 },  // 최적 문장 수
    warning: { min: 1, max: 7 },  // 경고 범위
    max: 10  // 너무 긴 단락
  }
};

// 문장 종결 패턴
const SENTENCE_ENDINGS = /[.!?。]\s*|\n/;

// 복잡한 표현 패턴
const COMPLEX_PATTERNS = [
  { pattern: /뿐만\s*아니라/g, suggestion: '~도' },
  { pattern: /~(에|를)\s*통해서/g, suggestion: '~로' },
  { pattern: /것으로\s*사료됩니다/g, suggestion: '것 같습니다' },
  { pattern: /~(을|를)\s*기반으로\s*하여/g, suggestion: '~를 바탕으로' },
  { pattern: /~함에\s*있어서/g, suggestion: '~할 때' },
  { pattern: /~하는\s*바입니다/g, suggestion: '~합니다' }
];

// ============================================================================
// 가독성 분석기
// ============================================================================

export class ReadabilityAnalyzer {
  /**
   * 콘텐츠 가독성 분석
   */
  analyze(content: string): ReadabilityAnalysis {
    // 마크다운 정리 (frontmatter 제거)
    const cleanContent = this.cleanMarkdown(content);

    // 문장 추출
    const sentences = this.extractSentences(cleanContent);

    // 단락 추출
    const paragraphs = this.extractParagraphs(cleanContent);

    // 메트릭 계산
    const metrics = this.calculateMetrics(cleanContent, sentences, paragraphs);

    // 제안 생성
    const suggestions = this.generateSuggestions(sentences, paragraphs, cleanContent);

    // 점수 계산
    const score = this.calculateScore(metrics, suggestions);

    return {
      score,
      avgSentenceLength: metrics.avgSentenceLength,
      avgParagraphLength: metrics.avgParagraphLength,
      longSentenceCount: metrics.longSentenceCount,
      shortParagraphCount: metrics.shortParagraphCount,
      suggestions,
      metrics: {
        totalSentences: sentences.length,
        totalParagraphs: paragraphs.length,
        totalCharacters: cleanContent.length,
        koreanCharacters: metrics.koreanCharacters
      }
    };
  }

  /**
   * 마크다운 정리
   */
  private cleanMarkdown(content: string): string {
    // frontmatter 제거
    let cleaned = content.replace(/^---[\s\S]*?---\n/, '');

    // 이미지, 링크 텍스트만 남기기
    cleaned = cleaned.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1');
    cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

    // 헤딩 마커 제거
    cleaned = cleaned.replace(/^#{1,6}\s+/gm, '');

    // 코드 블록 제거
    cleaned = cleaned.replace(/```[\s\S]*?```/g, '');
    cleaned = cleaned.replace(/`[^`]+`/g, '');

    // 강조 마커 제거
    cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1');
    cleaned = cleaned.replace(/\*([^*]+)\*/g, '$1');
    cleaned = cleaned.replace(/__([^_]+)__/g, '$1');

    // 리스트 마커 제거
    cleaned = cleaned.replace(/^[\s]*[-*+]\s+/gm, '');
    cleaned = cleaned.replace(/^[\s]*\d+\.\s+/gm, '');

    // 인용 마커 제거
    cleaned = cleaned.replace(/^>\s*/gm, '');

    return cleaned.trim();
  }

  /**
   * 문장 추출
   */
  private extractSentences(content: string): string[] {
    return content
      .split(SENTENCE_ENDINGS)
      .map(s => s.trim())
      .filter(s => s.length >= 5);  // 최소 5글자 이상
  }

  /**
   * 단락 추출
   */
  private extractParagraphs(content: string): string[][] {
    const rawParagraphs = content.split(/\n\n+/);

    return rawParagraphs
      .map(p => this.extractSentences(p))
      .filter(sentences => sentences.length > 0);
  }

  /**
   * 메트릭 계산
   */
  private calculateMetrics(
    content: string,
    sentences: string[],
    paragraphs: string[][]
  ): {
    avgSentenceLength: number;
    avgParagraphLength: number;
    longSentenceCount: number;
    shortParagraphCount: number;
    koreanCharacters: number;
  } {
    // 평균 문장 길이
    const totalSentenceLength = sentences.reduce((sum, s) => sum + s.length, 0);
    const avgSentenceLength = sentences.length > 0
      ? Math.round(totalSentenceLength / sentences.length)
      : 0;

    // 평균 단락 문장 수
    const totalParagraphSentences = paragraphs.reduce((sum, p) => sum + p.length, 0);
    const avgParagraphLength = paragraphs.length > 0
      ? Math.round((totalParagraphSentences / paragraphs.length) * 10) / 10
      : 0;

    // 긴 문장 개수
    const longSentenceCount = sentences.filter(
      s => s.length > KOREAN_READABILITY.sentence.warning.max
    ).length;

    // 짧은 단락 개수 (문장 1개만 있는 단락)
    const shortParagraphCount = paragraphs.filter(
      p => p.length < KOREAN_READABILITY.paragraph.warning.min
    ).length;

    // 한국어 글자 수
    const koreanCharacters = (content.match(/[가-힣]/g) || []).length;

    return {
      avgSentenceLength,
      avgParagraphLength,
      longSentenceCount,
      shortParagraphCount,
      koreanCharacters
    };
  }

  /**
   * 제안 생성
   */
  private generateSuggestions(
    sentences: string[],
    paragraphs: string[][],
    content: string
  ): ReadabilitySuggestion[] {
    const suggestions: ReadabilitySuggestion[] = [];

    // 1. 긴 문장 검사
    sentences.forEach((sentence, index) => {
      if (sentence.length > KOREAN_READABILITY.sentence.max) {
        suggestions.push({
          type: 'sentence_length',
          severity: 'high',
          message: `문장이 너무 깁니다 (${sentence.length}자). 80자 이내로 나눠보세요.`,
          location: { line: index + 1, text: sentence.substring(0, 50) + '...' }
        });
      } else if (sentence.length > KOREAN_READABILITY.sentence.warning.max) {
        suggestions.push({
          type: 'sentence_length',
          severity: 'medium',
          message: `문장이 다소 깁니다 (${sentence.length}자). 간결하게 수정을 고려하세요.`,
          location: { line: index + 1, text: sentence.substring(0, 50) + '...' }
        });
      }
    });

    // 2. 긴 단락 검사
    paragraphs.forEach((para, index) => {
      if (para.length > KOREAN_READABILITY.paragraph.max) {
        suggestions.push({
          type: 'paragraph_length',
          severity: 'high',
          message: `단락이 너무 깁니다 (${para.length}문장). 5문장 이내로 나눠보세요.`,
          location: { line: index + 1, text: para[0].substring(0, 30) + '...' }
        });
      } else if (para.length > KOREAN_READABILITY.paragraph.warning.max) {
        suggestions.push({
          type: 'paragraph_length',
          severity: 'medium',
          message: `단락이 다소 깁니다 (${para.length}문장).`,
          location: { line: index + 1, text: para[0].substring(0, 30) + '...' }
        });
      }
    });

    // 3. 복잡한 표현 검사
    for (const { pattern, suggestion } of COMPLEX_PATTERNS) {
      const matches = content.match(pattern);
      if (matches) {
        suggestions.push({
          type: 'complex_word',
          severity: 'low',
          message: `"${matches[0]}" 대신 "${suggestion}" 사용을 고려하세요.`
        });
      }
    }

    // 4. 포맷팅 검사
    const hasHeadings = /^#{2,3}\s/m.test(content);
    const hasLists = /^[\s]*[-*+]\s/m.test(content);
    const hasEmphasis = /\*\*|__/.test(content);

    if (!hasHeadings) {
      suggestions.push({
        type: 'formatting',
        severity: 'medium',
        message: '소제목(H2, H3)을 추가하면 가독성이 향상됩니다.'
      });
    }

    if (!hasLists) {
      suggestions.push({
        type: 'formatting',
        severity: 'low',
        message: '리스트를 활용하면 정보 전달이 더 명확해집니다.'
      });
    }

    if (!hasEmphasis) {
      suggestions.push({
        type: 'formatting',
        severity: 'low',
        message: '중요한 부분을 **강조**하면 가독성이 향상됩니다.'
      });
    }

    return suggestions;
  }

  /**
   * 점수 계산
   */
  private calculateScore(
    metrics: ReturnType<typeof this.calculateMetrics>,
    suggestions: ReadabilitySuggestion[]
  ): number {
    let score = 100;

    // 문장 길이 기반 감점
    const sentenceOptimal = KOREAN_READABILITY.sentence.optimal;
    if (metrics.avgSentenceLength < sentenceOptimal.min) {
      score -= 10;  // 너무 짧은 문장
    } else if (metrics.avgSentenceLength > sentenceOptimal.max) {
      score -= Math.min(20, (metrics.avgSentenceLength - sentenceOptimal.max) / 2);
    }

    // 긴 문장 개수 기반 감점
    score -= Math.min(20, metrics.longSentenceCount * 5);

    // 단락 길이 기반 감점
    const paraOptimal = KOREAN_READABILITY.paragraph.optimal;
    if (metrics.avgParagraphLength < paraOptimal.min) {
      score -= 5;  // 너무 짧은 단락
    } else if (metrics.avgParagraphLength > paraOptimal.max) {
      score -= Math.min(15, (metrics.avgParagraphLength - paraOptimal.max) * 3);
    }

    // 제안 기반 감점
    for (const suggestion of suggestions) {
      if (suggestion.severity === 'high') {
        score -= 5;
      } else if (suggestion.severity === 'medium') {
        score -= 2;
      } else {
        score -= 1;
      }
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }
}

/**
 * 가독성 분석 실행 헬퍼
 */
export function analyzeReadability(content: string): ReadabilityAnalysis {
  const analyzer = new ReadabilityAnalyzer();
  return analyzer.analyze(content);
}

export default ReadabilityAnalyzer;
