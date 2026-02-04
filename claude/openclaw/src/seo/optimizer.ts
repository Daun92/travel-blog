/**
 * SEO 최적화 모듈
 */

export interface SeoAnalysis {
  score: number;
  issues: SeoIssue[];
  suggestions: SeoSuggestion[];
  metrics: SeoMetrics;
}

export interface SeoIssue {
  type: 'error' | 'warning';
  field: string;
  message: string;
  impact: 'high' | 'medium' | 'low';
}

export interface SeoSuggestion {
  field: string;
  current: string | number;
  recommended: string | number;
  message: string;
}

export interface SeoMetrics {
  titleLength: number;
  descriptionLength: number;
  wordCount: number;
  headingCount: { h1: number; h2: number; h3: number };
  imageCount: number;
  internalLinks: number;
  externalLinks: number;
  keywordDensity: number;
}

/**
 * SEO 분석 수행
 */
export function analyzeSeo(
  frontmatter: Record<string, unknown>,
  content: string,
  keywords: string[] = []
): SeoAnalysis {
  const issues: SeoIssue[] = [];
  const suggestions: SeoSuggestion[] = [];

  // 메트릭 계산
  const metrics = calculateMetrics(frontmatter, content, keywords);

  // 제목 분석
  analyzTitle(frontmatter.title as string || '', issues, suggestions);

  // 설명 분석
  analyzeDescription(frontmatter.description as string || '', issues, suggestions);

  // 본문 분석
  analyzeContent(content, issues, suggestions);

  // 키워드 분석
  if (keywords.length > 0) {
    analyzeKeywords(content, keywords, issues, suggestions);
  }

  // 이미지 분석
  analyzeImages(content, issues, suggestions);

  // 링크 분석
  analyzeLinks(content, issues, suggestions);

  // 점수 계산
  const score = calculateScore(issues, suggestions, metrics);

  return {
    score,
    issues,
    suggestions,
    metrics
  };
}

/**
 * 메트릭 계산
 */
function calculateMetrics(
  frontmatter: Record<string, unknown>,
  content: string,
  keywords: string[]
): SeoMetrics {
  const title = (frontmatter.title as string) || '';
  const description = (frontmatter.description as string) || '';

  // 제목/설명 길이
  const titleLength = title.length;
  const descriptionLength = description.length;

  // 글자 수 (공백 제외)
  const wordCount = content.replace(/\s+/g, '').length;

  // 헤딩 수
  const h1Count = (content.match(/^# /gm) || []).length;
  const h2Count = (content.match(/^## /gm) || []).length;
  const h3Count = (content.match(/^### /gm) || []).length;

  // 이미지 수
  const imageCount = (content.match(/!\[.*?\]\(.*?\)/g) || []).length;

  // 링크 수
  const allLinks = content.match(/\[.*?\]\(.*?\)/g) || [];
  const internalLinks = allLinks.filter(l => l.includes('](/') || l.includes('(./')).length;
  const externalLinks = allLinks.length - internalLinks - imageCount;

  // 키워드 밀도
  let keywordDensity = 0;
  if (keywords.length > 0 && wordCount > 0) {
    const keywordMatches = keywords.reduce((count, kw) => {
      const regex = new RegExp(kw, 'gi');
      return count + (content.match(regex) || []).length;
    }, 0);
    keywordDensity = (keywordMatches / wordCount) * 100;
  }

  return {
    titleLength,
    descriptionLength,
    wordCount,
    headingCount: { h1: h1Count, h2: h2Count, h3: h3Count },
    imageCount,
    internalLinks,
    externalLinks,
    keywordDensity
  };
}

/**
 * 제목 분석
 */
function analyzTitle(
  title: string,
  issues: SeoIssue[],
  suggestions: SeoSuggestion[]
): void {
  if (!title) {
    issues.push({
      type: 'error',
      field: 'title',
      message: '제목이 없습니다',
      impact: 'high'
    });
    return;
  }

  if (title.length < 20) {
    suggestions.push({
      field: 'title',
      current: title.length,
      recommended: '30-60',
      message: '제목이 너무 짧습니다. 30-60자 권장'
    });
  } else if (title.length > 60) {
    suggestions.push({
      field: 'title',
      current: title.length,
      recommended: '30-60',
      message: '제목이 너무 깁니다. 검색 결과에서 잘릴 수 있습니다'
    });
  }
}

/**
 * 설명 분석
 */
function analyzeDescription(
  description: string,
  issues: SeoIssue[],
  suggestions: SeoSuggestion[]
): void {
  if (!description) {
    issues.push({
      type: 'warning',
      field: 'description',
      message: '메타 설명이 없습니다',
      impact: 'high'
    });
    return;
  }

  if (description.length < 70) {
    suggestions.push({
      field: 'description',
      current: description.length,
      recommended: '100-160',
      message: '메타 설명이 너무 짧습니다. 100-160자 권장'
    });
  } else if (description.length > 160) {
    suggestions.push({
      field: 'description',
      current: description.length,
      recommended: '100-160',
      message: '메타 설명이 너무 깁니다. 검색 결과에서 잘릴 수 있습니다'
    });
  }
}

/**
 * 본문 분석
 */
function analyzeContent(
  content: string,
  issues: SeoIssue[],
  suggestions: SeoSuggestion[]
): void {
  const wordCount = content.replace(/\s+/g, '').length;

  if (wordCount < 800) {
    issues.push({
      type: 'warning',
      field: 'content',
      message: '본문이 너무 짧습니다 (800자 미만)',
      impact: 'high'
    });
  } else if (wordCount < 1500) {
    suggestions.push({
      field: 'content',
      current: wordCount,
      recommended: '1500+',
      message: '본문 길이를 1500자 이상으로 늘리면 SEO에 유리합니다'
    });
  }

  // H2 소제목 분석
  const h2Count = (content.match(/^## /gm) || []).length;
  if (h2Count < 2) {
    suggestions.push({
      field: 'headings',
      current: h2Count,
      recommended: '3-5',
      message: 'H2 소제목을 3-5개 추가하면 가독성과 SEO가 개선됩니다'
    });
  }

  // 첫 문단 분석
  const firstPara = content.split('\n\n')[0];
  if (firstPara && firstPara.length < 100) {
    suggestions.push({
      field: 'intro',
      current: firstPara.length,
      recommended: '150+',
      message: '첫 문단을 더 풍성하게 작성하세요. 핵심 키워드를 포함하면 좋습니다'
    });
  }
}

/**
 * 키워드 분석
 */
function analyzeKeywords(
  content: string,
  keywords: string[],
  issues: SeoIssue[],
  suggestions: SeoSuggestion[]
): void {
  for (const keyword of keywords) {
    const regex = new RegExp(keyword, 'gi');
    const matches = content.match(regex) || [];

    if (matches.length === 0) {
      issues.push({
        type: 'warning',
        field: 'keywords',
        message: `키워드 "${keyword}"가 본문에 없습니다`,
        impact: 'medium'
      });
    } else if (matches.length < 2) {
      suggestions.push({
        field: 'keywords',
        current: matches.length,
        recommended: '2-5',
        message: `키워드 "${keyword}"를 2-5회 자연스럽게 사용하세요`
      });
    }
  }
}

/**
 * 이미지 분석
 */
function analyzeImages(
  content: string,
  issues: SeoIssue[],
  suggestions: SeoSuggestion[]
): void {
  const images = content.match(/!\[(.*?)\]\((.*?)\)/g) || [];

  if (images.length === 0) {
    suggestions.push({
      field: 'images',
      current: 0,
      recommended: '1+',
      message: '이미지를 1개 이상 추가하면 사용자 경험과 SEO가 개선됩니다'
    });
    return;
  }

  // alt 텍스트 확인
  for (const img of images) {
    const altMatch = img.match(/!\[(.*?)\]/);
    if (altMatch && (!altMatch[1] || altMatch[1].trim() === '')) {
      issues.push({
        type: 'warning',
        field: 'images',
        message: '이미지에 alt 텍스트가 없습니다',
        impact: 'medium'
      });
      break;
    }
  }
}

/**
 * 링크 분석
 */
function analyzeLinks(
  content: string,
  issues: SeoIssue[],
  suggestions: SeoSuggestion[]
): void {
  const links = content.match(/\[.*?\]\((?!.*?\.(jpg|jpeg|png|gif|webp)).*?\)/gi) || [];
  const internalLinks = links.filter(l => l.includes('](/') || l.includes('(./'));

  if (internalLinks.length === 0) {
    suggestions.push({
      field: 'links',
      current: 0,
      recommended: '2-3',
      message: '내부 링크를 추가하면 SEO와 사용자 체류 시간이 개선됩니다'
    });
  }
}

/**
 * SEO 점수 계산
 */
function calculateScore(
  issues: SeoIssue[],
  suggestions: SeoSuggestion[],
  metrics: SeoMetrics
): number {
  let score = 100;

  // 이슈 감점
  for (const issue of issues) {
    if (issue.type === 'error') {
      score -= issue.impact === 'high' ? 20 : issue.impact === 'medium' ? 10 : 5;
    } else {
      score -= issue.impact === 'high' ? 10 : issue.impact === 'medium' ? 5 : 2;
    }
  }

  // 제안 감점
  score -= suggestions.length * 3;

  // 긍정 요소 가점
  if (metrics.wordCount >= 2000) score += 5;
  if (metrics.headingCount.h2 >= 3) score += 5;
  if (metrics.imageCount >= 2) score += 5;
  if (metrics.internalLinks >= 2) score += 5;

  return Math.max(0, Math.min(100, score));
}

/**
 * SEO 최적화 제안 생성
 */
export function generateSeoSuggestions(analysis: SeoAnalysis): string[] {
  const tips: string[] = [];

  if (analysis.score < 50) {
    tips.push('SEO 점수가 낮습니다. 아래 문제들을 해결하세요.');
  }

  // 이슈 기반 제안
  for (const issue of analysis.issues) {
    tips.push(`❌ ${issue.message}`);
  }

  // 개선 제안
  for (const suggestion of analysis.suggestions) {
    tips.push(`💡 ${suggestion.message}`);
  }

  return tips;
}
