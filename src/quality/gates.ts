/**
 * 품질 게이트 로직
 */

import { readFile } from 'fs/promises';
import matter from 'gray-matter';
import { loadQualityConfig, QualityGatesConfig } from './config.js';
import { checkDuplicate, calculateDuplicateScore } from './duplicate-checker.js';
import { needsHumanReview, addReviewCase, ReviewTrigger } from './human-review.js';
import { withRetry } from './retry-handler.js';
import { factCheckFile, FactCheckReport } from '../factcheck/index.js';
import { analyzeReadability, ReadabilityAnalysis } from './readability.js';
import { analyzeTone, ToneAnalysis } from './tone-checker.js';
import { analyzeStructure, StructureAnalysis } from './structure-checker.js';
import { analyzeKeywordDensity, KeywordDensityAnalysis } from './keyword-density.js';
import { validateImageNarrativeCoherence } from '../images/image-validator.js';

/**
 * 게이트 결과
 */
export interface GateResult {
  name: string;
  score: number;
  passed: boolean;
  threshold: number;
  blockOnFailure: boolean;
  details?: string;
  warnings?: string[];
}

/**
 * 종합 검증 결과
 */
export interface ValidationResult {
  filePath: string;
  title: string;
  validatedAt: string;

  // 게이트 결과
  gates: GateResult[];

  // 종합 판정
  overallPassed: boolean;
  blockPublish: boolean;
  needsHumanReview: boolean;

  // 상세 정보
  factCheckReport?: FactCheckReport;
  duplicateInfo?: {
    isDuplicate: boolean;
    similarPosts: Array<{ path: string; title: string; similarity: number }>;
    recommendation: string;
  };

  // 확장 분석 결과
  readabilityAnalysis?: ReadabilityAnalysis;
  toneAnalysis?: ToneAnalysis;
  structureAnalysis?: StructureAnalysis;
  keywordDensityAnalysis?: KeywordDensityAnalysis;

  // 경고 및 에러
  warnings: string[];
  errors: string[];
}

/**
 * SEO 점수 계산
 */
async function calculateSeoScore(
  filePath: string,
  frontmatter: Record<string, unknown>,
  content: string
): Promise<{ score: number; details: string[] }> {
  const details: string[] = [];
  let score = 100;

  // 1. 제목 검사 (20점)
  const title = frontmatter.title as string || '';
  if (!title) {
    score -= 20;
    details.push('제목 없음');
  } else if (title.length < 10) {
    score -= 10;
    details.push('제목이 너무 짧음 (10자 미만)');
  } else if (title.length > 60) {
    score -= 5;
    details.push('제목이 너무 김 (60자 초과)');
  }

  // 2. 설명 검사 (15점)
  const description = frontmatter.description as string || '';
  if (!description) {
    score -= 15;
    details.push('메타 설명 없음');
  } else if (description.length < 50) {
    score -= 10;
    details.push('메타 설명이 너무 짧음');
  } else if (description.length > 160) {
    score -= 5;
    details.push('메타 설명이 너무 김 (160자 초과)');
  }

  // 3. 키워드/태그 검사 (15점)
  const tags = frontmatter.tags as string[] || [];
  const keywords = frontmatter.keywords as string[] || [];
  const totalKeywords = tags.length + keywords.length;

  if (totalKeywords === 0) {
    score -= 15;
    details.push('태그/키워드 없음');
  } else if (totalKeywords < 3) {
    score -= 10;
    details.push('태그/키워드 부족 (3개 미만)');
  }

  // 4. 이미지 검사 (15점)
  const hasImage = frontmatter.image || content.includes('![');
  if (!hasImage) {
    score -= 15;
    details.push('이미지 없음');
  }

  // 5. 헤딩 구조 검사 (15점)
  const headings = content.match(/^#{2,3}\s+.+$/gm) || [];
  if (headings.length === 0) {
    score -= 15;
    details.push('소제목(H2/H3) 없음');
  } else if (headings.length < 3) {
    score -= 10;
    details.push('소제목 부족 (3개 미만)');
  }

  // 6. 내부/외부 링크 검사 (10점)
  const links = content.match(/\[.+?\]\(.+?\)/g) || [];
  if (links.length === 0) {
    score -= 10;
    details.push('링크 없음');
  }

  // 7. 슬러그 검사 (10점)
  const slug = frontmatter.slug as string || '';
  if (!slug) {
    score -= 5;
    details.push('커스텀 슬러그 없음');
  }

  return { score: Math.max(0, score), details };
}

/**
 * 콘텐츠 품질 점수 계산
 */
function calculateContentScore(
  content: string,
  minWordCount: number = 1500
): { score: number; details: string[] } {
  const details: string[] = [];
  let score = 100;

  // 글자 수 계산 (한글 + 영문 + 숫자)
  const textOnly = content.replace(/[#*\-\[\]()_`~>|]/g, '').replace(/\s+/g, ' ');
  const charCount = textOnly.replace(/\s/g, '').length;

  // 1. 분량 검사 (40점)
  if (charCount < minWordCount * 0.5) {
    score -= 40;
    details.push(`분량 매우 부족 (${charCount}자, 최소 ${minWordCount}자)`);
  } else if (charCount < minWordCount) {
    score -= 20;
    details.push(`분량 부족 (${charCount}자, 권장 ${minWordCount}자)`);
  }

  // 2. 문단 구조 검사 (20점)
  const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 50);
  if (paragraphs.length < 3) {
    score -= 20;
    details.push('문단 구조 부족 (3개 미만)');
  } else if (paragraphs.length < 5) {
    score -= 10;
    details.push('문단 구조 개선 필요');
  }

  // 3. 가독성 검사 (20점)
  const longSentences = content.match(/[^.!?。]+[.!?。]/g)?.filter(s => s.length > 150) || [];
  if (longSentences.length > 5) {
    score -= 20;
    details.push(`문장이 너무 긴 경우 많음 (${longSentences.length}개)`);
  } else if (longSentences.length > 2) {
    score -= 10;
    details.push(`긴 문장 개선 필요 (${longSentences.length}개)`);
  }

  // 4. 리스트/포맷팅 사용 (20점)
  const hasList = content.includes('- ') || content.includes('* ') || content.match(/^\d+\./m);
  const hasEmphasis = content.includes('**') || content.includes('__');
  const hasBlockquote = content.includes('> ');

  let formatScore = 20;
  if (!hasList) formatScore -= 8;
  if (!hasEmphasis) formatScore -= 6;
  if (!hasBlockquote) formatScore -= 6;

  if (formatScore < 20) {
    score -= (20 - formatScore);
    if (!hasList) details.push('리스트 사용 없음');
  }

  return { score: Math.max(0, score), details };
}

/**
 * 단일 파일 검증
 */
export async function validateFile(
  filePath: string,
  options: {
    skipFactCheck?: boolean;
    skipDuplicateCheck?: boolean;
    verbose?: boolean;
    allGates?: boolean;  // 모든 확장 게이트 실행
    readability?: boolean;
    tone?: boolean;
    structure?: boolean;
    keywordDensity?: boolean;
    contentType?: 'travel' | 'culture';  // 톤 체크용
  } = {}
): Promise<ValidationResult> {
  const config = await loadQualityConfig();

  // 파일 읽기
  const content = await readFile(filePath, 'utf-8');
  const { data: frontmatter, content: body } = matter(content);
  const title = frontmatter.title as string || 'Untitled';

  const gates: GateResult[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  let factCheckReport: FactCheckReport | undefined;
  let duplicateInfo: ValidationResult['duplicateInfo'] | undefined;
  let readabilityAnalysis: ReadabilityAnalysis | undefined;
  let toneAnalysis: ToneAnalysis | undefined;
  let structureAnalysis: StructureAnalysis | undefined;
  let keywordDensityAnalysis: KeywordDensityAnalysis | undefined;

  // 콘텐츠 타입 추론
  const contentType = options.contentType ||
    (frontmatter.categories as string[] || []).includes('travel') ? 'travel' : 'culture';

  // 1. 팩트체크 게이트
  if (!options.skipFactCheck && config.gates.factcheck.enabled !== false) {
    try {
      const fcResult = await withRetry(
        () => factCheckFile(filePath, { verbose: options.verbose }),
        {
          onRetry: (attempt, error, delay) => {
            warnings.push(`팩트체크 재시도 ${attempt}: ${error.message} (${delay}ms 후)`);
          }
        }
      );

      if (fcResult.success && fcResult.result) {
        factCheckReport = fcResult.result;
        gates.push({
          name: 'factcheck',
          score: factCheckReport.overallScore,
          passed: factCheckReport.passesGate,
          threshold: config.gates.factcheck.overall?.minScore || 80,
          blockOnFailure: config.gates.factcheck.blockOnFailure,
          details: `검증: ${factCheckReport.claims.verified}/${factCheckReport.claims.total}`,
          warnings: factCheckReport.corrections.map(c => c.reason)
        });
      } else {
        errors.push('팩트체크 실패 — GEMINI_API_KEY 확인 또는 --skip-validation 사용');
        gates.push({
          name: 'factcheck',
          score: 0,
          passed: false,
          threshold: config.gates.factcheck.overall?.minScore || 80,
          blockOnFailure: true,
          details: '팩트체크 API 오류 — GEMINI_API_KEY 확인 또는 --skip-validation 사용'
        });
      }
    } catch (error) {
      errors.push(`팩트체크 오류: ${error instanceof Error ? error.message : error}`);
    }
  }

  // 2. SEO 게이트
  if (config.gates.seo.enabled !== false) {
    const seoResult = await calculateSeoScore(filePath, frontmatter, body);
    gates.push({
      name: 'seo',
      score: seoResult.score,
      passed: seoResult.score >= config.gates.seo.minScore,
      threshold: config.gates.seo.minScore,
      blockOnFailure: config.gates.seo.blockOnFailure,
      details: seoResult.details.length > 0 ? seoResult.details.join(', ') : 'SEO 최적화 양호',
      warnings: seoResult.details
    });
  }

  // 3. 콘텐츠 게이트
  if (config.gates.content.enabled !== false) {
    const contentResult = calculateContentScore(body, config.gates.content.minWordCount);
    gates.push({
      name: 'content',
      score: contentResult.score,
      passed: contentResult.score >= config.gates.content.minScore,
      threshold: config.gates.content.minScore,
      blockOnFailure: config.gates.content.blockOnFailure,
      details: contentResult.details.length > 0 ? contentResult.details.join(', ') : '콘텐츠 품질 양호',
      warnings: contentResult.details
    });
  }

  // 4. 중복 검사 게이트
  if (!options.skipDuplicateCheck && config.gates.duplicate.enabled !== false) {
    try {
      const dupResult = await checkDuplicate(filePath, {
        titleThreshold: config.gates.duplicate.similarityThreshold || 80
      });

      duplicateInfo = {
        isDuplicate: dupResult.isDuplicate,
        similarPosts: dupResult.similarPosts,
        recommendation: dupResult.recommendation
      };

      const dupScore = calculateDuplicateScore(dupResult);
      gates.push({
        name: 'duplicate',
        score: dupScore,
        passed: dupScore >= config.gates.duplicate.minScore,
        threshold: config.gates.duplicate.minScore,
        blockOnFailure: config.gates.duplicate.blockOnFailure,
        details: dupResult.details || '중복 없음',
        warnings: dupResult.isDuplicate ? [`유사 포스트: ${dupResult.similarPosts[0]?.title}`] : undefined
      });
    } catch (error) {
      warnings.push(`중복 검사 실패: ${error instanceof Error ? error.message : error}`);
    }
  }

  // 5. 가독성 게이트
  if (options.allGates || options.readability) {
    try {
      readabilityAnalysis = analyzeReadability(body);

      const readabilityConfig = (config.gates as Record<string, { minScore?: number; blockOnFailure?: boolean }>).readability || { minScore: 70, blockOnFailure: false };

      gates.push({
        name: 'readability',
        score: readabilityAnalysis.score,
        passed: readabilityAnalysis.score >= (readabilityConfig.minScore || 70),
        threshold: readabilityConfig.minScore || 70,
        blockOnFailure: readabilityConfig.blockOnFailure || false,
        details: `평균 문장 ${readabilityAnalysis.avgSentenceLength}자, 긴 문장 ${readabilityAnalysis.longSentenceCount}개`,
        warnings: readabilityAnalysis.suggestions
          .filter(s => s.severity !== 'low')
          .map(s => s.message)
          .slice(0, 3)
      });
    } catch (error) {
      warnings.push(`가독성 분석 실패: ${error instanceof Error ? error.message : error}`);
    }
  }

  // 6. 톤/어조 게이트
  if (options.allGates || options.tone) {
    try {
      toneAnalysis = analyzeTone(body, contentType);

      const toneConfig = (config.gates as Record<string, { minScore?: number; blockOnFailure?: boolean }>).tone || { minScore: 70, blockOnFailure: false };

      gates.push({
        name: 'tone',
        score: toneAnalysis.score,
        passed: toneAnalysis.score >= (toneConfig.minScore || 70),
        threshold: toneConfig.minScore || 70,
        blockOnFailure: toneConfig.blockOnFailure || false,
        details: `목표: ${toneAnalysis.targetTone}, 감지: ${toneAnalysis.detectedTone}, 일관성: ${toneAnalysis.toneConsistency}%`,
        warnings: toneAnalysis.inconsistencies
          .filter(i => i.severity !== 'low')
          .map(i => i.message)
          .slice(0, 3)
      });
    } catch (error) {
      warnings.push(`톤 분석 실패: ${error instanceof Error ? error.message : error}`);
    }
  }

  // 7. 구조 게이트
  if (options.allGates || options.structure) {
    try {
      structureAnalysis = analyzeStructure(content);

      const structureConfig = (config.gates as Record<string, { minScore?: number; blockOnFailure?: boolean }>).structure || { minScore: 70, blockOnFailure: false };

      gates.push({
        name: 'structure',
        score: structureAnalysis.score,
        passed: structureAnalysis.score >= (structureConfig.minScore || 70),
        threshold: structureConfig.minScore || 70,
        blockOnFailure: structureConfig.blockOnFailure || false,
        details: `인트로: ${structureAnalysis.hasIntro ? '✓' : '✗'}, 결론: ${structureAnalysis.hasConclusion ? '✓' : '✗'}, CTA: ${structureAnalysis.ctaPresent ? '✓' : '✗'}`,
        warnings: structureAnalysis.issues
          .filter(i => i.severity !== 'low')
          .map(i => i.message)
          .slice(0, 3)
      });
    } catch (error) {
      warnings.push(`구조 분석 실패: ${error instanceof Error ? error.message : error}`);
    }
  }

  // 8. 키워드 밀도 게이트
  if (options.allGates || options.keywordDensity) {
    try {
      keywordDensityAnalysis = analyzeKeywordDensity(content);

      const kwConfig = (config.gates as Record<string, { minScore?: number; blockOnFailure?: boolean }>).keyword_density || { minScore: 70, blockOnFailure: false };

      gates.push({
        name: 'keyword_density',
        score: keywordDensityAnalysis.score,
        passed: keywordDensityAnalysis.score >= (kwConfig.minScore || 70),
        threshold: kwConfig.minScore || 70,
        blockOnFailure: kwConfig.blockOnFailure || false,
        details: `주요 키워드: ${keywordDensityAnalysis.metrics.primaryKeyword || '없음'}, 밀도: ${keywordDensityAnalysis.metrics.primaryKeywordDensity}%`,
        warnings: keywordDensityAnalysis.recommendations
          .filter(r => r.priority === 'high')
          .map(r => r.message)
          .slice(0, 3)
      });
    } catch (error) {
      warnings.push(`키워드 밀도 분석 실패: ${error instanceof Error ? error.message : error}`);
    }
  }

  // 9. GEO 게이트 (AI 검색 엔진 인용 친화)
  const geoConfig = (config.gates as Record<string, { minScore?: number; blockOnFailure?: boolean; enabled?: boolean; warn?: boolean }>).geo || { minScore: 60, blockOnFailure: false, enabled: true, warn: true };
  if (geoConfig.enabled !== false && (options.allGates || options.structure)) {
    // structure 게이트에서 이미 analyzeStructure()가 실행됐으면 재사용
    const geoAnalysis = structureAnalysis || analyzeStructure(content);
    if (!structureAnalysis) structureAnalysis = geoAnalysis;

    gates.push({
      name: 'geo',
      score: geoAnalysis.geoScore,
      passed: geoAnalysis.geoScore >= (geoConfig.minScore || 60),
      threshold: geoConfig.minScore || 60,
      blockOnFailure: geoConfig.blockOnFailure || false,
      details: `GEO 점수: ${geoAnalysis.geoScore}, 이슈 ${geoAnalysis.geoIssues.length}개`,
      warnings: geoAnalysis.geoIssues.map(i => i.message).slice(0, 5)
    });
  }

  // 6. 이미지-서사 일관성 게이트
  if (options.allGates) {
    const coherenceResults = validateImageNarrativeCoherence(body, title);
    const avgCoherence = coherenceResults.length > 0
      ? Math.round(coherenceResults.reduce((sum, r) => sum + r.coherenceScore, 0) / coherenceResults.length)
      : 100;
    const issueCount = coherenceResults.filter(r => r.action !== 'keep').length;

    gates.push({
      name: 'image_coherence',
      score: avgCoherence,
      passed: avgCoherence >= 40,
      threshold: 40,
      blockOnFailure: false,
      details: `이미지-서사 일관성: ${avgCoherence}점 (${coherenceResults.length}개 이미지, 이슈 ${issueCount}개)`,
      warnings: coherenceResults
        .filter(r => r.action !== 'keep')
        .slice(0, 5)
        .map(r => `${r.sectionTitle}: ${r.coherenceScore}점${r.issue ? ` — ${r.issue}` : ''}`)
    });
  }

  // 종합 판정
  const requiredGates = gates.filter(g => config.publishRequirements.requiredGates.includes(g.name));
  const warningGates = gates.filter(g => config.publishRequirements.warningGates.includes(g.name));

  const requiredPassed = requiredGates.every(g => g.passed);
  const hasBlockingFailure = gates.some(g => !g.passed && g.blockOnFailure);

  const overallPassed = requiredPassed && !hasBlockingFailure;
  const blockPublish = hasBlockingFailure;

  // 경고 게이트 결과 추가
  for (const gate of warningGates) {
    if (!gate.passed && gate.warnings) {
      warnings.push(...gate.warnings);
    }
  }

  // 사람 검토 필요 여부 판단
  const avgScore = gates.length > 0
    ? gates.reduce((sum, g) => sum + g.score, 0) / gates.length
    : 100;

  const reviewCheck = needsHumanReview(avgScore, {
    hasCriticalFalse: (factCheckReport?.bySeverity.critical.false ?? 0) > 0,
    unknownRatio: factCheckReport?.claims.total
      ? (factCheckReport.claims.unknown / factCheckReport.claims.total) * 100
      : 0,
    content: body
  });

  // 검토 케이스 추가
  if (reviewCheck.needed && reviewCheck.trigger) {
    await addReviewCase(
      filePath,
      title,
      reviewCheck.trigger as ReviewTrigger,
      avgScore,
      gates.filter(g => !g.passed).map(g => `${g.name}: ${g.score}%`).join(', ')
    );
  }

  return {
    filePath,
    title,
    validatedAt: new Date().toISOString(),
    gates,
    overallPassed,
    blockPublish,
    needsHumanReview: reviewCheck.needed,
    factCheckReport,
    duplicateInfo,
    readabilityAnalysis,
    toneAnalysis,
    structureAnalysis,
    keywordDensityAnalysis,
    warnings,
    errors
  };
}

/**
 * 발행 가능 여부 확인 (빠른 체크)
 */
export async function canPublish(filePath: string): Promise<{
  allowed: boolean;
  reason?: string;
}> {
  try {
    const result = await validateFile(filePath, {
      skipDuplicateCheck: true  // 빠른 체크용
    });

    if (result.blockPublish) {
      const failedGates = result.gates.filter(g => !g.passed && g.blockOnFailure);
      return {
        allowed: false,
        reason: `품질 기준 미달: ${failedGates.map(g => g.name).join(', ')}`
      };
    }

    if (result.needsHumanReview) {
      return {
        allowed: false,
        reason: '사람 검토 필요'
      };
    }

    return { allowed: true };
  } catch (error) {
    return {
      allowed: false,
      reason: `검증 오류: ${error instanceof Error ? error.message : error}`
    };
  }
}
