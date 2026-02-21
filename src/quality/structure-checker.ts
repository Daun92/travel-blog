/**
 * 구조 완성도 체커
 * 블로그 포스트의 구조적 완성도 검사
 */

// ============================================================================
// 타입 정의
// ============================================================================

export interface SectionInfo {
  level: number;  // H1=1, H2=2, H3=3
  title: string;
  content: string;
  wordCount: number;
  hasImage: boolean;
  hasList: boolean;
}

export interface StructureIssue {
  type: 'missing_intro' | 'missing_conclusion' | 'unbalanced_sections' | 'missing_cta' |
        'heading_hierarchy' | 'empty_section' | 'no_subheadings' |
        'missing_geo_summary' | 'pronoun_heavy_sections' | 'entity_poor_faq' | 'no_self_contained_opener';
  severity: 'high' | 'medium' | 'low';
  message: string;
  suggestion?: string;
}

export interface StructureAnalysis {
  score: number;  // 0-100
  hasIntro: boolean;
  hasConclusion: boolean;
  bodyStructure: 'well-organized' | 'needs-improvement' | 'poor';
  ctaPresent: boolean;
  sections: SectionInfo[];
  issues: StructureIssue[];
  metrics: {
    totalSections: number;
    avgSectionLength: number;
    headingDepth: number;  // 최대 헤딩 깊이
    imageCount: number;
    listCount: number;
  };
  /** GEO (Generative Engine Optimization) 점수 0-100 */
  geoScore: number;
  /** GEO 관련 이슈만 필터링 */
  geoIssues: StructureIssue[];
}

// ============================================================================
// 설정
// ============================================================================

// 구조 기준
const STRUCTURE_STANDARDS = {
  intro: {
    minLength: 50,  // 최소 50자
    keywords: ['안녕', '오늘', '소개', '알려', '가볼', '추천']
  },
  conclusion: {
    minLength: 30,
    keywords: ['마무리', '정리', '결론', '추천', '즐거운', '도움', '감사']
  },
  cta: {
    patterns: [
      /댓글.*남겨/,
      /공유.*해주/,
      /구독/,
      /팔로우/,
      /더.*보기/,
      /관련.*글/,
      /다음.*포스트/,
      /좋아요/,
      /저장/
    ]
  },
  section: {
    minLength: 100,  // 섹션당 최소 100자
    maxLength: 2000,  // 섹션당 최대 2000자
    optimalCount: { min: 3, max: 7 }  // 적정 섹션 수
  }
};

// ============================================================================
// 구조 체커
// ============================================================================

export class StructureChecker {
  /**
   * 구조 분석 실행
   */
  analyze(content: string): StructureAnalysis {
    // 섹션 파싱
    const sections = this.parseSections(content);

    // 인트로/결론 체크
    const hasIntro = this.checkIntro(sections, content);
    const hasConclusion = this.checkConclusion(sections, content);

    // CTA 체크
    const ctaPresent = this.checkCTA(content);

    // 이슈 찾기
    const issues = this.findIssues(sections, hasIntro, hasConclusion, ctaPresent);

    // 메트릭 계산
    const metrics = this.calculateMetrics(sections, content);

    // 본문 구조 평가
    const bodyStructure = this.evaluateBodyStructure(sections, issues);

    // 점수 계산
    const score = this.calculateScore(
      hasIntro,
      hasConclusion,
      ctaPresent,
      bodyStructure,
      issues
    );

    // GEO 체크
    const geoIssues = this.checkGEOReadiness(content, sections);
    issues.push(...geoIssues);

    // GEO 점수 계산
    const geoScore = this.calculateGEOScore(content, sections, geoIssues);

    return {
      score,
      hasIntro,
      hasConclusion,
      bodyStructure,
      ctaPresent,
      sections,
      issues,
      metrics,
      geoScore,
      geoIssues
    };
  }

  /**
   * 섹션 파싱
   */
  private parseSections(content: string): SectionInfo[] {
    // frontmatter 제거
    const cleaned = content.replace(/^---[\s\S]*?---\n/, '');

    const sections: SectionInfo[] = [];
    const headingPattern = /^(#{1,6})\s+(.+)$/gm;

    let lastIndex = 0;
    let lastLevel = 0;
    let lastTitle = 'Intro';
    let match;

    while ((match = headingPattern.exec(cleaned)) !== null) {
      // 이전 섹션 저장
      if (lastIndex > 0 || match.index > 0) {
        const sectionContent = cleaned.substring(lastIndex, match.index).trim();

        if (sectionContent.length > 0) {
          sections.push(this.createSection(lastLevel, lastTitle, sectionContent));
        }
      }

      lastLevel = match[1].length;
      lastTitle = match[2].trim();
      lastIndex = match.index + match[0].length;
    }

    // 마지막 섹션
    const remainingContent = cleaned.substring(lastIndex).trim();
    if (remainingContent.length > 0) {
      sections.push(this.createSection(lastLevel, lastTitle, remainingContent));
    }

    return sections;
  }

  /**
   * 섹션 객체 생성
   */
  private createSection(level: number, title: string, content: string): SectionInfo {
    const koreanChars = (content.match(/[가-힣]/g) || []).length;

    return {
      level,
      title,
      content: content.substring(0, 200),
      wordCount: Math.round(koreanChars / 2),
      hasImage: /!\[.*?\]\(.*?\)/.test(content),
      hasList: /^[\s]*[-*+]\s|^\d+\.\s/m.test(content)
    };
  }

  /**
   * 인트로 체크
   */
  private checkIntro(sections: SectionInfo[], fullContent: string): boolean {
    if (sections.length === 0) return false;

    // 첫 번째 섹션이 인트로인지 확인
    const firstSection = sections[0];

    // 레벨 0(헤딩 없음)이거나 H1 바로 아래면 인트로
    if (firstSection.level === 0 || firstSection.level <= 1) {
      // 최소 길이 충족
      if (firstSection.wordCount >= STRUCTURE_STANDARDS.intro.minLength / 2) {
        return true;
      }
    }

    // 첫 200자에 인트로 키워드가 있는지 확인
    const intro = fullContent.substring(0, 500);
    return STRUCTURE_STANDARDS.intro.keywords.some(kw => intro.includes(kw));
  }

  /**
   * 결론 체크
   */
  private checkConclusion(sections: SectionInfo[], fullContent: string): boolean {
    if (sections.length === 0) return false;

    const lastSection = sections[sections.length - 1];

    // 결론 관련 제목 확인
    const conclusionTitles = ['마무리', '정리', '결론', '마치며', '총정리', '요약'];
    if (conclusionTitles.some(t => lastSection.title.includes(t))) {
      return true;
    }

    // 마지막 500자에 결론 키워드가 있는지 확인
    const conclusion = fullContent.slice(-500);
    return STRUCTURE_STANDARDS.conclusion.keywords.some(kw => conclusion.includes(kw));
  }

  /**
   * CTA 체크
   */
  private checkCTA(content: string): boolean {
    return STRUCTURE_STANDARDS.cta.patterns.some(pattern => pattern.test(content));
  }

  /**
   * 이슈 찾기
   */
  private findIssues(
    sections: SectionInfo[],
    hasIntro: boolean,
    hasConclusion: boolean,
    ctaPresent: boolean
  ): StructureIssue[] {
    const issues: StructureIssue[] = [];

    // 1. 인트로 없음
    if (!hasIntro) {
      issues.push({
        type: 'missing_intro',
        severity: 'high',
        message: '인트로(서론)가 없거나 부족합니다.',
        suggestion: '글의 시작 부분에 주제 소개와 독자의 관심을 끄는 문장을 추가하세요.'
      });
    }

    // 2. 결론 없음
    if (!hasConclusion) {
      issues.push({
        type: 'missing_conclusion',
        severity: 'high',
        message: '결론(마무리)이 없습니다.',
        suggestion: '글 끝에 핵심 내용 정리와 마무리 인사를 추가하세요.'
      });
    }

    // 3. CTA 없음
    if (!ctaPresent) {
      issues.push({
        type: 'missing_cta',
        severity: 'medium',
        message: 'CTA(Call to Action)가 없습니다.',
        suggestion: '댓글, 공유, 관련 글 안내 등 독자 참여를 유도하는 문구를 추가하세요.'
      });
    }

    // 4. 소제목 없음
    const h2Count = sections.filter(s => s.level === 2).length;
    if (h2Count === 0 && sections.length > 1) {
      issues.push({
        type: 'no_subheadings',
        severity: 'medium',
        message: '본문에 소제목(H2)이 없습니다.',
        suggestion: '주요 섹션에 H2 소제목을 추가하여 구조를 명확히 하세요.'
      });
    }

    // 5. 헤딩 계층 문제
    for (let i = 1; i < sections.length; i++) {
      const prev = sections[i - 1];
      const curr = sections[i];

      // H1 → H3 건너뛰기 등
      if (curr.level > prev.level + 1 && curr.level > 1) {
        issues.push({
          type: 'heading_hierarchy',
          severity: 'low',
          message: `헤딩 계층이 건너뛰었습니다: H${prev.level} → H${curr.level}`,
          suggestion: '헤딩은 순차적으로 사용하세요 (H2 → H3 → H4).'
        });
        break;  // 하나만 보고
      }
    }

    // 6. 빈 섹션
    const emptySections = sections.filter(s => s.wordCount < 20);
    if (emptySections.length > 0) {
      issues.push({
        type: 'empty_section',
        severity: 'medium',
        message: `내용이 부족한 섹션이 ${emptySections.length}개 있습니다.`,
        suggestion: '각 섹션에 최소 100자 이상의 내용을 작성하세요.'
      });
    }

    // 7. 불균형 섹션
    if (sections.length >= 3) {
      const lengths = sections.map(s => s.wordCount);
      const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
      const maxDiff = Math.max(...lengths.map(l => Math.abs(l - avg)));

      if (maxDiff > avg * 2) {
        issues.push({
          type: 'unbalanced_sections',
          severity: 'low',
          message: '섹션 길이가 불균형합니다.',
          suggestion: '각 섹션의 분량을 비슷하게 조정하세요.'
        });
      }
    }

    return issues;
  }

  /**
   * 메트릭 계산
   */
  private calculateMetrics(sections: SectionInfo[], content: string): {
    totalSections: number;
    avgSectionLength: number;
    headingDepth: number;
    imageCount: number;
    listCount: number;
  } {
    const totalSections = sections.length;
    const avgSectionLength = totalSections > 0
      ? Math.round(sections.reduce((sum, s) => sum + s.wordCount, 0) / totalSections)
      : 0;
    const headingDepth = Math.max(...sections.map(s => s.level), 0);

    // 이미지 개수
    const imageCount = (content.match(/!\[.*?\]\(.*?\)/g) || []).length;

    // 리스트 개수
    const listCount = (content.match(/^[\s]*[-*+]\s|^\d+\.\s/gm) || []).length;

    return {
      totalSections,
      avgSectionLength,
      headingDepth,
      imageCount,
      listCount
    };
  }

  /**
   * 본문 구조 평가
   */
  private evaluateBodyStructure(
    sections: SectionInfo[],
    issues: StructureIssue[]
  ): 'well-organized' | 'needs-improvement' | 'poor' {
    const highIssues = issues.filter(i => i.severity === 'high').length;
    const mediumIssues = issues.filter(i => i.severity === 'medium').length;

    // H2가 적절히 있는지
    const h2Count = sections.filter(s => s.level === 2).length;
    const hasGoodH2 = h2Count >= 3 && h2Count <= 7;

    if (highIssues === 0 && mediumIssues <= 1 && hasGoodH2) {
      return 'well-organized';
    }

    if (highIssues <= 1 && mediumIssues <= 2) {
      return 'needs-improvement';
    }

    return 'poor';
  }

  /**
   * 점수 계산
   */
  private calculateScore(
    hasIntro: boolean,
    hasConclusion: boolean,
    ctaPresent: boolean,
    bodyStructure: string,
    issues: StructureIssue[]
  ): number {
    let score = 100;

    // 인트로 (25점)
    if (!hasIntro) score -= 25;

    // 결론 (25점)
    if (!hasConclusion) score -= 25;

    // CTA (10점)
    if (!ctaPresent) score -= 10;

    // 본문 구조 (20점)
    if (bodyStructure === 'needs-improvement') score -= 10;
    if (bodyStructure === 'poor') score -= 20;

    // 이슈별 감점 (20점) — GEO 이슈는 geoScore에서 별도 계산하므로 제외
    const GEO_TYPES = ['missing_geo_summary', 'pronoun_heavy_sections', 'entity_poor_faq', 'no_self_contained_opener'];
    for (const issue of issues) {
      if (issue.type === 'missing_intro' || issue.type === 'missing_conclusion') {
        continue;  // 이미 감점됨
      }
      if (GEO_TYPES.includes(issue.type)) {
        continue;  // GEO 점수에서 별도 처리
      }

      if (issue.severity === 'high') {
        score -= 5;
      } else if (issue.severity === 'medium') {
        score -= 3;
      } else {
        score -= 1;
      }
    }

    return Math.max(0, Math.min(100, score));
  }

  // ============================================================================
  // GEO (Generative Engine Optimization) 체크
  // ============================================================================

  /**
   * GEO 준비도 체크 — AI 검색 엔진 인용 친화 구조 검사
   */
  private checkGEOReadiness(content: string, sections: SectionInfo[]): StructureIssue[] {
    const issues: StructureIssue[] = [];
    const cleaned = content.replace(/^---[\s\S]*?---\n/, '');

    // 1. 도입부 blockquote 요약 존재 확인
    const firstH2Index = cleaned.search(/^##\s+/m);
    const introArea = firstH2Index > 0 ? cleaned.substring(0, firstH2Index) : cleaned.substring(0, 500);
    const hasGeoSummary = /^>\s+\*\*.*\*\*/m.test(introArea) || /^>\s+.{30,}/m.test(introArea);

    if (!hasGeoSummary) {
      issues.push({
        type: 'missing_geo_summary',
        severity: 'medium',
        message: '도입부에 팩트 요약 블록(blockquote)이 없습니다.',
        suggestion: '제목 직후, 첫 H2 이전에 "> **주제 핵심 요약** — ..." 형태의 요약 블록을 추가하세요.'
      });
    }

    // 2. 대명사로 시작하는 H2 섹션 체크
    const pronounPattern = /^(?:여기|이곳|거기|그곳|이\s|그\s|저\s)(?:는|은|에|서|가|를|도)/;
    const h2Sections = sections.filter(s => s.level === 2);
    let pronounCount = 0;

    for (const section of h2Sections) {
      const firstLine = section.content.replace(/^[\s\n]+/, '').split('\n')[0]?.trim() || '';
      if (pronounPattern.test(firstLine)) {
        pronounCount++;
      }
    }

    if (pronounCount >= 3) {
      issues.push({
        type: 'pronoun_heavy_sections',
        severity: 'low',
        message: `${pronounCount}개 섹션이 대명사("여기", "이곳" 등)로 시작합니다.`,
        suggestion: '각 H2 섹션의 첫 문장에 장소명/주제를 명시적으로 포함하세요. AI 검색 엔진 발췌 시 맥락이 유지됩니다.'
      });
    }

    // 3. FAQ 답변 대명사 체크 (frontmatter에서 추출)
    const faqMatch = content.match(/^faqs:\s*\n([\s\S]*?)(?=^[a-zA-Z]|\Z)/m);
    if (faqMatch) {
      const faqAnswers = [...content.matchAll(/^\s+a:\s*["']?(.+?)["']?\s*$/gm)].map(m => m[1]);
      if (faqAnswers.length > 0) {
        const pronounFaqCount = faqAnswers.filter(a => pronounPattern.test(a.trim())).length;
        const pronounRatio = pronounFaqCount / faqAnswers.length;

        if (pronounRatio >= 0.4) {
          issues.push({
            type: 'entity_poor_faq',
            severity: 'medium',
            message: `FAQ 답변의 ${Math.round(pronounRatio * 100)}%가 대명사로 시작합니다.`,
            suggestion: 'FAQ 답변 첫 문장에 장소명/주제를 명시적으로 포함하세요.'
          });
        }
      }
    }

    // 4. 섹션 첫 문장에 주제 키워드 미포함 체크
    // frontmatter에서 title/tags/keywords 추출하여 키워드 풀 구성
    const titleMatch = content.match(/^title:\s*["']?(.+?)["']?\s*$/m);
    const topicTitle = titleMatch?.[1] || '';
    // 제목에서 주요 명사 추출 (한글 2자 이상 단어)
    const topicKeywords = topicTitle.match(/[가-힣]{2,}/g) || [];

    if (topicKeywords.length > 0 && h2Sections.length >= 3) {
      let noKeywordCount = 0;
      for (const section of h2Sections) {
        // 결론/마무리/FAQ 섹션 제외
        if (/마무리|정리|결론|마치며|자주\s*묻는/.test(section.title)) continue;

        const firstSentence = section.content.replace(/^[\s\n]+/, '').split(/[.!?。]\s/)[0] || '';
        const hasKeyword = topicKeywords.some(kw => firstSentence.includes(kw));
        if (!hasKeyword) {
          noKeywordCount++;
        }
      }

      const contentSections = h2Sections.filter(s => !/마무리|정리|결론|마치며|자주\s*묻는/.test(s.title));
      if (contentSections.length > 0 && noKeywordCount / contentSections.length > 0.6) {
        issues.push({
          type: 'no_self_contained_opener',
          severity: 'low',
          message: `${noKeywordCount}개 섹션 첫 문장에 주제 키워드가 포함되지 않았습니다.`,
          suggestion: '섹션 첫 문장에 주제와 관련된 장소명/키워드를 포함하면 AI 검색 엔진 발췌 시 맥락이 유지됩니다.'
        });
      }
    }

    return issues;
  }

  /**
   * GEO 점수 계산 (0-100)
   */
  private calculateGEOScore(
    content: string,
    sections: SectionInfo[],
    geoIssues: StructureIssue[]
  ): number {
    let score = 100;

    for (const issue of geoIssues) {
      switch (issue.type) {
        case 'missing_geo_summary':
          score -= 30;  // 요약 블록 없음: 큰 감점
          break;
        case 'pronoun_heavy_sections':
          score -= 20;  // 대명사 과다
          break;
        case 'entity_poor_faq':
          score -= 25;  // FAQ 품질 저하
          break;
        case 'no_self_contained_opener':
          score -= 15;  // 키워드 미포함
          break;
      }
    }

    // 보너스: blockquote 요약이 있고 + FAQ가 있으면 +10
    const cleaned = content.replace(/^---[\s\S]*?---\n/, '');
    const hasFAQ = content.includes('faqs:') || cleaned.includes('## 자주 묻는 질문');
    const hasBlockquote = /^>\s+/m.test(cleaned);
    if (hasFAQ && hasBlockquote) {
      score += 10;
    }

    return Math.max(0, Math.min(100, score));
  }
}

/**
 * 구조 분석 실행 헬퍼
 */
export function analyzeStructure(content: string): StructureAnalysis {
  const checker = new StructureChecker();
  return checker.analyze(content);
}

export default StructureChecker;
