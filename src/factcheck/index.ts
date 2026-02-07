/**
 * 팩트체크 시스템 메인 모듈
 */

import { readFile } from 'fs/promises';
import matter from 'gray-matter';
import {
  FactCheckReport,
  FactCheckConfig,
  ExtractedClaim,
  VerificationResult,
  Correction,
  ClaimSeverity
} from './types.js';
import { extractClaims, needsFactCheck, getClaimStats } from './claim-extractor.js';
import { verifyClaims, clearVerificationCache } from './grounding-client.js';

// 기본 설정
const DEFAULT_CONFIG: FactCheckConfig = {
  thresholds: {
    critical: 100,   // Critical은 100% 통과 필요
    major: 85,       // Major는 85% 이상
    minor: 70,       // Minor는 70% 이상
    overall: 80      // 전체 80% 이상
  },
  weights: {
    critical: 0.3,
    major: 0.3,
    minor: 0.4
  },
  blockOnCriticalFailure: true,
  maxRetries: 3,
  cacheResults: true,
  cacheTtlHours: 24
};

/**
 * 설정 파일 로드
 */
async function loadConfig(): Promise<FactCheckConfig> {
  try {
    const configPath = 'config/quality-gates.json';
    const content = await readFile(configPath, 'utf-8');
    const parsed = JSON.parse(content) as { gates?: { factcheck?: Partial<FactCheckConfig> } };

    if (parsed.gates?.factcheck) {
      return {
        ...DEFAULT_CONFIG,
        ...parsed.gates.factcheck
      };
    }
  } catch {
    // 설정 파일 없으면 기본값 사용
  }

  return DEFAULT_CONFIG;
}

/**
 * 심각도별 점수 계산
 */
function calculateCategoryScore(
  results: VerificationResult[],
  claims: ExtractedClaim[],
  severity: ClaimSeverity
): number {
  const severityClaims = claims.filter(c => c.severity === severity);
  const severityResults = results.filter(r =>
    severityClaims.some(c => c.id === r.claimId)
  );

  if (severityClaims.length === 0) return 100;

  const verified = severityResults.filter(r => r.status === 'verified').length;
  const total = severityClaims.length;

  return Math.round((verified / total) * 100);
}

/**
 * 전체 점수 계산 (가중 평균)
 */
function calculateOverallScore(
  categoryScores: { critical: number; major: number; minor: number },
  config: FactCheckConfig
): number {
  const { weights } = config;

  return Math.round(
    categoryScores.critical * weights.critical +
    categoryScores.major * weights.major +
    categoryScores.minor * weights.minor
  );
}

/**
 * 심각도별 통계 생성
 */
function calculateSeverityStats(
  results: VerificationResult[],
  claims: ExtractedClaim[]
): FactCheckReport['bySeverity'] {
  const stats: FactCheckReport['bySeverity'] = {
    critical: { total: 0, verified: 0, false: 0, unknown: 0 },
    major: { total: 0, verified: 0, false: 0, unknown: 0 },
    minor: { total: 0, verified: 0, false: 0, unknown: 0 }
  };

  for (const claim of claims) {
    stats[claim.severity].total++;

    const result = results.find(r => r.claimId === claim.id);
    if (result) {
      if (result.status === 'verified') stats[claim.severity].verified++;
      else if (result.status === 'false') stats[claim.severity].false++;
      else stats[claim.severity].unknown++;
    } else {
      stats[claim.severity].unknown++;
    }
  }

  return stats;
}

/**
 * 수정 제안 생성
 */
function generateCorrections(
  results: VerificationResult[],
  claims: ExtractedClaim[]
): Correction[] {
  const corrections: Correction[] = [];

  for (const result of results) {
    if (result.status === 'false' && result.correctValue) {
      const claim = claims.find(c => c.id === result.claimId);
      if (!claim) continue;

      corrections.push({
        claimId: result.claimId,
        originalText: claim.text,
        suggestedText: claim.text.replace(claim.value, result.correctValue),
        reason: result.details || '검증 결과 정확하지 않음',
        autoApplicable: claim.severity !== 'critical'  // Critical은 수동 검토
      });
    }
  }

  return corrections;
}

/**
 * 품질 게이트 통과 여부 판단
 */
function evaluateQualityGate(
  categoryScores: { critical: number; major: number; minor: number },
  overallScore: number,
  bySeverity: FactCheckReport['bySeverity'],
  config: FactCheckConfig
): { passesGate: boolean; needsHumanReview: boolean; blockPublish: boolean } {
  // Critical 항목 하나라도 FALSE면 즉시 차단
  if (config.blockOnCriticalFailure && bySeverity.critical.false > 0) {
    return {
      passesGate: false,
      needsHumanReview: true,
      blockPublish: true
    };
  }

  // 카테고리별 기준 체크
  const criticalPass = categoryScores.critical >= config.thresholds.critical;
  const majorPass = categoryScores.major >= config.thresholds.major;
  const minorPass = categoryScores.minor >= config.thresholds.minor;
  const overallPass = overallScore >= config.thresholds.overall;

  const passesGate = criticalPass && majorPass && minorPass && overallPass;

  // 50-70% 구간은 사람 검토 필요
  const needsHumanReview = overallScore >= 50 && overallScore < 70;

  // 전체 점수 기준 미달 시 발행 차단
  const blockPublish = overallScore < config.thresholds.overall;

  return { passesGate, needsHumanReview, blockPublish };
}

/**
 * 단일 파일 팩트체크
 */
export async function factCheckFile(
  filePath: string,
  options: {
    config?: Partial<FactCheckConfig>;
    verbose?: boolean;
    onProgress?: (current: number, total: number, claim: ExtractedClaim) => void;
  } = {}
): Promise<FactCheckReport> {
  const config = {
    ...DEFAULT_CONFIG,
    ...(await loadConfig()),
    ...options.config
  };

  // 파일 읽기
  const content = await readFile(filePath, 'utf-8');
  const { data: frontmatter, content: body } = matter(content);

  // 팩트체크 필요 여부 확인
  if (!needsFactCheck(body, frontmatter)) {
    return createEmptyReport(filePath, frontmatter.title as string || 'Untitled');
  }

  // 클레임 추출
  const claims = extractClaims(body, frontmatter);

  if (claims.length === 0) {
    return createEmptyReport(filePath, frontmatter.title as string || 'Untitled');
  }

  if (options.verbose) {
    console.log(`추출된 클레임: ${claims.length}개`);
    const stats = getClaimStats(claims);
    console.log(`- Critical: ${stats.bySeverity.critical}개`);
    console.log(`- Major: ${stats.bySeverity.major}개`);
    console.log(`- Minor: ${stats.bySeverity.minor}개`);
  }

  // API 키 확인
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY 환경변수가 설정되지 않았습니다.');
  }

  // 클레임 검증
  const results = await verifyClaims(
    claims,
    {
      apiKey,
      maxRetries: config.maxRetries
    },
    options.onProgress
  );

  // 점수 계산
  const categoryScores = {
    critical: calculateCategoryScore(results, claims, 'critical'),
    major: calculateCategoryScore(results, claims, 'major'),
    minor: calculateCategoryScore(results, claims, 'minor')
  };

  const overallScore = calculateOverallScore(categoryScores, config);

  // 통계 계산
  const bySeverity = calculateSeverityStats(results, claims);

  const claimStats = {
    total: claims.length,
    verified: results.filter(r => r.status === 'verified').length,
    false: results.filter(r => r.status === 'false').length,
    unknown: results.filter(r => r.status === 'unknown').length
  };

  // 수정 제안 생성
  const corrections = generateCorrections(results, claims);

  // 품질 게이트 평가
  const gateResult = evaluateQualityGate(categoryScores, overallScore, bySeverity, config);

  return {
    filePath,
    title: frontmatter.title as string || 'Untitled',
    checkedAt: new Date().toISOString(),
    overallScore,
    categoryScores,
    claims: claimStats,
    bySeverity,
    results,
    extractedClaims: claims,
    corrections,
    ...gateResult,
    version: '1.0.0'
  };
}

/**
 * 빈 보고서 생성 (팩트체크 불필요한 경우)
 */
function createEmptyReport(filePath: string, title: string): FactCheckReport {
  return {
    filePath,
    title,
    checkedAt: new Date().toISOString(),
    overallScore: 100,
    categoryScores: { critical: 100, major: 100, minor: 100 },
    claims: { total: 0, verified: 0, false: 0, unknown: 0 },
    bySeverity: {
      critical: { total: 0, verified: 0, false: 0, unknown: 0 },
      major: { total: 0, verified: 0, false: 0, unknown: 0 },
      minor: { total: 0, verified: 0, false: 0, unknown: 0 }
    },
    results: [],
    extractedClaims: [],
    corrections: [],
    passesGate: true,
    needsHumanReview: false,
    blockPublish: false,
    version: '1.0.0'
  };
}

/**
 * 다중 파일 팩트체크
 */
export async function factCheckFiles(
  filePaths: string[],
  options: {
    config?: Partial<FactCheckConfig>;
    verbose?: boolean;
    stopOnBlock?: boolean;
  } = {}
): Promise<FactCheckReport[]> {
  const reports: FactCheckReport[] = [];

  for (const filePath of filePaths) {
    try {
      const report = await factCheckFile(filePath, options);
      reports.push(report);

      // 발행 차단되면 중단 옵션
      if (options.stopOnBlock && report.blockPublish) {
        console.warn(`발행 차단: ${filePath} (점수: ${report.overallScore}%)`);
        break;
      }
    } catch (error) {
      console.error(`팩트체크 실패 (${filePath}):`, error);
      // 실패해도 계속 진행
    }
  }

  return reports;
}

/**
 * 보고서 요약 출력
 */
export function summarizeReport(report: FactCheckReport): string {
  const lines: string[] = [];

  lines.push(`\n📋 팩트체크 보고서: ${report.title}`);
  lines.push(`${'━'.repeat(50)}`);
  lines.push(`파일: ${report.filePath}`);
  lines.push(`검사 시간: ${report.checkedAt}`);
  lines.push('');

  // 점수
  const scoreEmoji = report.overallScore >= 80 ? '🟢'
    : report.overallScore >= 50 ? '🟡'
      : '🔴';

  lines.push(`${scoreEmoji} 전체 점수: ${report.overallScore}%`);
  lines.push(`   - Critical: ${report.categoryScores.critical}%`);
  lines.push(`   - Major: ${report.categoryScores.major}%`);
  lines.push(`   - Minor: ${report.categoryScores.minor}%`);
  lines.push('');

  // 클레임 통계
  lines.push(`📊 클레임 검증 결과:`);
  lines.push(`   ✓ 확인됨: ${report.claims.verified}/${report.claims.total}`);
  lines.push(`   ✗ 거짓: ${report.claims.false}/${report.claims.total}`);
  lines.push(`   ? 미확인: ${report.claims.unknown}/${report.claims.total}`);
  lines.push('');

  // 판정
  if (report.blockPublish) {
    lines.push(`🚫 발행 차단: 품질 기준 미달 (${report.overallScore}% < 80%)`);
  } else if (report.needsHumanReview) {
    lines.push(`⚠️ 사람 검토 필요: 점수 50-70% 구간`);
  } else if (report.passesGate) {
    lines.push(`✅ 품질 게이트 통과`);
  }

  // 수정 제안
  if (report.corrections.length > 0) {
    lines.push('');
    lines.push(`🔧 수정 제안 (${report.corrections.length}개):`);
    for (const correction of report.corrections) {
      lines.push(`   - ${correction.originalText}`);
      lines.push(`     → ${correction.suggestedText}`);
    }
  }

  lines.push(`${'━'.repeat(50)}\n`);

  return lines.join('\n');
}

// Re-export types and utilities
export {
  extractClaims,
  needsFactCheck,
  getClaimStats,
  clearVerificationCache
};

export { applyAutoFix, formatDiff } from './auto-fixer.js';

export type {
  FactCheckReport,
  FactCheckConfig,
  ExtractedClaim,
  VerificationResult,
  Correction,
  AutoFixReport,
  AppliedCorrection,
  DiffEntry,
  AutoFixAuditLog
} from './types.js';
