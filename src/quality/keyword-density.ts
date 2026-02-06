/**
 * 키워드 밀도 분석 모듈
 * SEO 최적화를 위한 키워드 배치 및 밀도 검사
 */

import matter from 'gray-matter';

// ============================================================================
// 타입 정의
// ============================================================================

export interface KeywordMetric {
  keyword: string;
  count: number;
  density: number;  // 백분율
  inTitle: boolean;
  inFirstParagraph: boolean;
  inConclusion: boolean;
  inHeadings: boolean;
  distribution: 'good' | 'front-heavy' | 'back-heavy' | 'clustered' | 'sparse';
}

export interface KeywordRecommendation {
  type: 'increase' | 'decrease' | 'redistribute' | 'add_to_title' | 'add_to_intro';
  keyword: string;
  message: string;
  priority: 'high' | 'medium' | 'low';
}

export interface KeywordDensityAnalysis {
  score: number;  // 0-100
  keywords: KeywordMetric[];
  overallDensity: number;  // 모든 주요 키워드 합산 밀도
  recommendations: KeywordRecommendation[];
  metrics: {
    totalWords: number;
    uniqueKeywords: number;
    primaryKeyword: string | null;
    primaryKeywordDensity: number;
  };
}

// ============================================================================
// 설정
// ============================================================================

// 키워드 밀도 기준
const DENSITY_STANDARDS = {
  optimal: { min: 1, max: 3 },  // 1-3%가 최적
  warning: { min: 0.5, max: 4 },  // 경고 범위
  critical: { max: 5 }  // 5% 이상은 스팸으로 간주
};

// 키워드 배치 가중치
const PLACEMENT_WEIGHTS = {
  title: 3,
  firstParagraph: 2,
  headings: 1.5,
  conclusion: 1.5,
  body: 1
};

// ============================================================================
// 키워드 밀도 분석기
// ============================================================================

export class KeywordDensityAnalyzer {
  /**
   * 키워드 밀도 분석 실행
   */
  analyze(content: string, targetKeywords?: string[]): KeywordDensityAnalysis {
    // frontmatter 파싱
    const { data: frontmatter, content: body } = matter(content);

    // 키워드 추출 (frontmatter에서 또는 직접 추출)
    const keywords = targetKeywords || this.extractKeywords(frontmatter, body);

    // 단어 수 계산
    const totalWords = this.countWords(body);

    // 각 키워드 분석
    const keywordMetrics = keywords.map(kw => this.analyzeKeyword(kw, body, frontmatter, totalWords));

    // 전체 밀도 계산
    const overallDensity = this.calculateOverallDensity(keywordMetrics);

    // 주요 키워드 결정
    const primaryKeyword = this.determinePrimaryKeyword(keywordMetrics);
    const primaryKeywordDensity = primaryKeyword
      ? keywordMetrics.find(k => k.keyword === primaryKeyword)?.density || 0
      : 0;

    // 추천 생성
    const recommendations = this.generateRecommendations(keywordMetrics, frontmatter, body);

    // 점수 계산
    const score = this.calculateScore(keywordMetrics, recommendations);

    return {
      score,
      keywords: keywordMetrics,
      overallDensity,
      recommendations,
      metrics: {
        totalWords,
        uniqueKeywords: keywords.length,
        primaryKeyword,
        primaryKeywordDensity
      }
    };
  }

  /**
   * 키워드 추출
   */
  private extractKeywords(
    frontmatter: Record<string, unknown>,
    body: string
  ): string[] {
    const keywords = new Set<string>();

    // frontmatter에서 추출
    const fmTags = frontmatter.tags as string[] || [];
    const fmKeywords = frontmatter.keywords as string[] || [];

    fmTags.forEach(t => keywords.add(t.toLowerCase()));
    fmKeywords.forEach(k => keywords.add(k.toLowerCase()));

    // 제목에서 추출
    const title = frontmatter.title as string || '';
    const titleWords = this.extractMeaningfulWords(title);
    titleWords.forEach(w => keywords.add(w.toLowerCase()));

    // 본문에서 자주 등장하는 단어 추출
    const frequentWords = this.findFrequentWords(body, 5);
    frequentWords.forEach(w => keywords.add(w.toLowerCase()));

    return Array.from(keywords).slice(0, 10);  // 최대 10개
  }

  /**
   * 의미 있는 단어 추출
   */
  private extractMeaningfulWords(text: string): string[] {
    // 한글 단어 추출 (2글자 이상)
    const words = text.match(/[가-힣]{2,}/g) || [];

    // 불용어 제거
    const stopwords = [
      '하는', '있는', '되는', '위한', '대한', '통한', '의한',
      '그리고', '하지만', '그러나', '따라서', '그래서', '또한'
    ];

    return words.filter(w => !stopwords.includes(w));
  }

  /**
   * 자주 등장하는 단어 찾기
   */
  private findFrequentWords(text: string, count: number): string[] {
    const words = this.extractMeaningfulWords(text);
    const frequency = new Map<string, number>();

    words.forEach(w => {
      frequency.set(w, (frequency.get(w) || 0) + 1);
    });

    return Array.from(frequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, count)
      .map(([word]) => word);
  }

  /**
   * 단어 수 계산
   */
  private countWords(text: string): number {
    // 한글 기준: 2글자 = 약 1단어
    const koreanChars = (text.match(/[가-힣]/g) || []).length;
    return Math.round(koreanChars / 2);
  }

  /**
   * 단일 키워드 분석
   */
  private analyzeKeyword(
    keyword: string,
    body: string,
    frontmatter: Record<string, unknown>,
    totalWords: number
  ): KeywordMetric {
    // 키워드 등장 횟수
    const regex = new RegExp(keyword, 'gi');
    const matches = body.match(regex) || [];
    const count = matches.length;

    // 밀도 계산
    const density = totalWords > 0 ? (count / totalWords) * 100 : 0;

    // 배치 확인
    const title = (frontmatter.title as string || '').toLowerCase();
    const inTitle = title.includes(keyword.toLowerCase());

    // 첫 단락 (frontmatter 제거 후 첫 300자)
    const cleanBody = body.replace(/^---[\s\S]*?---\n/, '');
    const firstParagraph = cleanBody.substring(0, 300).toLowerCase();
    const inFirstParagraph = firstParagraph.includes(keyword.toLowerCase());

    // 결론 (마지막 300자)
    const conclusion = cleanBody.slice(-300).toLowerCase();
    const inConclusion = conclusion.includes(keyword.toLowerCase());

    // 헤딩에 포함 여부
    const headings = body.match(/^#{1,6}\s+.+$/gm) || [];
    const inHeadings = headings.some(h => h.toLowerCase().includes(keyword.toLowerCase()));

    // 분포 분석
    const distribution = this.analyzeDistribution(keyword, body);

    return {
      keyword,
      count,
      density: Math.round(density * 100) / 100,
      inTitle,
      inFirstParagraph,
      inConclusion,
      inHeadings,
      distribution
    };
  }

  /**
   * 키워드 분포 분석
   */
  private analyzeDistribution(keyword: string, body: string): KeywordMetric['distribution'] {
    const cleanBody = body.replace(/^---[\s\S]*?---\n/, '');
    const totalLength = cleanBody.length;

    if (totalLength === 0) return 'sparse';

    // 키워드 위치들 찾기
    const positions: number[] = [];
    const regex = new RegExp(keyword, 'gi');
    let match;

    while ((match = regex.exec(cleanBody)) !== null) {
      positions.push(match.index / totalLength);  // 0~1 범위로 정규화
    }

    if (positions.length === 0) return 'sparse';
    if (positions.length === 1) return 'sparse';

    // 분포 분석
    const avgPosition = positions.reduce((a, b) => a + b, 0) / positions.length;

    // 앞쪽에 몰림
    if (avgPosition < 0.35) return 'front-heavy';

    // 뒤쪽에 몰림
    if (avgPosition > 0.65) return 'back-heavy';

    // 클러스터링 검사 (위치 간 간격)
    const gaps = [];
    for (let i = 1; i < positions.length; i++) {
      gaps.push(positions[i] - positions[i - 1]);
    }

    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const expectedGap = 1 / positions.length;

    // 간격이 너무 불규칙하면 클러스터됨
    if (avgGap < expectedGap * 0.5) return 'clustered';

    return 'good';
  }

  /**
   * 전체 밀도 계산
   */
  private calculateOverallDensity(metrics: KeywordMetric[]): number {
    if (metrics.length === 0) return 0;

    const totalDensity = metrics.reduce((sum, m) => sum + m.density, 0);
    return Math.round(totalDensity * 100) / 100;
  }

  /**
   * 주요 키워드 결정
   */
  private determinePrimaryKeyword(metrics: KeywordMetric[]): string | null {
    if (metrics.length === 0) return null;

    // 제목에 있고 밀도가 가장 높은 것
    const titleKeywords = metrics.filter(m => m.inTitle);
    if (titleKeywords.length > 0) {
      return titleKeywords.sort((a, b) => b.density - a.density)[0].keyword;
    }

    // 밀도가 가장 높은 것
    return metrics.sort((a, b) => b.density - a.density)[0].keyword;
  }

  /**
   * 추천 생성
   */
  private generateRecommendations(
    metrics: KeywordMetric[],
    frontmatter: Record<string, unknown>,
    body: string
  ): KeywordRecommendation[] {
    const recommendations: KeywordRecommendation[] = [];

    for (const metric of metrics) {
      // 1. 밀도 기반 추천
      if (metric.density < DENSITY_STANDARDS.optimal.min) {
        recommendations.push({
          type: 'increase',
          keyword: metric.keyword,
          message: `"${metric.keyword}" 키워드 밀도가 낮습니다 (${metric.density}%). 1-3%가 적정합니다.`,
          priority: metric.density < DENSITY_STANDARDS.warning.min ? 'high' : 'medium'
        });
      } else if (metric.density > DENSITY_STANDARDS.critical.max) {
        recommendations.push({
          type: 'decrease',
          keyword: metric.keyword,
          message: `"${metric.keyword}" 키워드가 과다 사용되었습니다 (${metric.density}%). 스팸으로 인식될 수 있습니다.`,
          priority: 'high'
        });
      } else if (metric.density > DENSITY_STANDARDS.optimal.max) {
        recommendations.push({
          type: 'decrease',
          keyword: metric.keyword,
          message: `"${metric.keyword}" 키워드 밀도가 다소 높습니다 (${metric.density}%).`,
          priority: 'low'
        });
      }

      // 2. 배치 기반 추천
      if (!metric.inTitle && metric.count >= 3) {
        recommendations.push({
          type: 'add_to_title',
          keyword: metric.keyword,
          message: `"${metric.keyword}"를 제목에 포함시키면 SEO에 도움이 됩니다.`,
          priority: 'medium'
        });
      }

      if (!metric.inFirstParagraph && metric.count >= 2) {
        recommendations.push({
          type: 'add_to_intro',
          keyword: metric.keyword,
          message: `"${metric.keyword}"를 첫 문단에 자연스럽게 포함시키세요.`,
          priority: 'medium'
        });
      }

      // 3. 분포 기반 추천
      if (metric.distribution === 'front-heavy' || metric.distribution === 'back-heavy') {
        recommendations.push({
          type: 'redistribute',
          keyword: metric.keyword,
          message: `"${metric.keyword}" 키워드가 ${metric.distribution === 'front-heavy' ? '앞부분' : '뒷부분'}에 집중되어 있습니다. 전체적으로 분산시키세요.`,
          priority: 'low'
        });
      }

      if (metric.distribution === 'clustered') {
        recommendations.push({
          type: 'redistribute',
          keyword: metric.keyword,
          message: `"${metric.keyword}" 키워드가 특정 부분에 몰려있습니다. 자연스럽게 분산시키세요.`,
          priority: 'medium'
        });
      }
    }

    // 우선순위로 정렬
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return recommendations.slice(0, 10);  // 최대 10개
  }

  /**
   * 점수 계산
   */
  private calculateScore(
    metrics: KeywordMetric[],
    recommendations: KeywordRecommendation[]
  ): number {
    let score = 100;

    // 1. 주요 키워드 밀도 (40점)
    const primaryMetric = metrics.find(m => m.inTitle) || metrics[0];
    if (primaryMetric) {
      const density = primaryMetric.density;

      if (density < DENSITY_STANDARDS.warning.min) {
        score -= 30;
      } else if (density < DENSITY_STANDARDS.optimal.min) {
        score -= 15;
      } else if (density > DENSITY_STANDARDS.critical.max) {
        score -= 40;
      } else if (density > DENSITY_STANDARDS.warning.max) {
        score -= 20;
      }
    } else {
      score -= 20;  // 키워드 없음
    }

    // 2. 배치 점수 (30점)
    for (const metric of metrics.slice(0, 3)) {  // 상위 3개 키워드
      if (!metric.inTitle) score -= 5;
      if (!metric.inFirstParagraph) score -= 5;
      if (!metric.inHeadings) score -= 2;
    }

    // 3. 분포 점수 (20점)
    const badDistributions = metrics.filter(m =>
      m.distribution !== 'good' && m.distribution !== 'sparse'
    ).length;
    score -= Math.min(20, badDistributions * 5);

    // 4. 추천 기반 감점 (10점)
    const highPriorityRecs = recommendations.filter(r => r.priority === 'high').length;
    score -= Math.min(10, highPriorityRecs * 3);

    return Math.max(0, Math.min(100, score));
  }
}

/**
 * 키워드 밀도 분석 실행 헬퍼
 */
export function analyzeKeywordDensity(
  content: string,
  targetKeywords?: string[]
): KeywordDensityAnalysis {
  const analyzer = new KeywordDensityAnalyzer();
  return analyzer.analyze(content, targetKeywords);
}

export default KeywordDensityAnalyzer;
