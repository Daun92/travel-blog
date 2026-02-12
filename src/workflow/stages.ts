/**
 * 통합 검증 스테이지 모듈
 * pipeline.ts와 workflow.ts가 공유하는 단일 진실의 원천
 *
 * 흐름: Generate → Enhance → Factcheck → Quality → AEO → Image
 */

import { readFile } from 'fs/promises';
import matter from 'gray-matter';

// 각 모듈 임포트
import { factCheckFile, applyAutoFix, FactCheckReport } from '../factcheck/index.js';
import { validateFile as runQualityGates, ValidationResult as QualityResult } from '../quality/gates.js';
import { processAEO, applyAEOToFile, AEOResult } from '../aeo/index.js';
import { validatePostImages, PostImageValidationResult } from '../images/image-validator.js';
import { enhanceDraft, analyzeDraft, EnhanceResult } from '../agents/draft-enhancer/index.js';
import { runQualityMesh } from './quality-mesh.js';

// ============================================================================
// 타입 정의
// ============================================================================

export interface StageResult {
  name: string;
  status: 'passed' | 'warning' | 'failed' | 'skipped';
  score?: number;
  details?: string;
  blocked?: boolean;
  data?: unknown;
  /** 치유 루프에 의해 자동 수정이 적용되었는지 여부 */
  remediationApplied?: boolean;
}

export interface ValidationStageOptions {
  // 모드
  mode: 'full' | 'quick' | 'enhance-only';

  // 단계별 활성화
  includeEnhance?: boolean;
  includeFactcheck?: boolean;
  includeQuality?: boolean;
  includeAEO?: boolean;
  includeImage?: boolean;

  // 동작 옵션
  applyAEO?: boolean;
  autoFix?: boolean;
  verbose?: boolean;

  // 병렬/치유 옵션 (QualityMesh)
  /** 품질 게이트 병렬 실행 (기본: true) */
  parallelGates?: boolean;
  /** 자동 치유 활성화 (기본: false) */
  remediate?: boolean;

  // 콜백
  onProgress?: (stage: string, message: string) => void;
}

export interface FullValidationResult {
  filePath: string;
  title: string;
  contentType: 'travel' | 'culture';
  executedAt: string;

  // 단계별 결과
  stages: StageResult[];

  // 상세 결과 (선택적)
  factcheck?: FactCheckReport;
  enhance?: EnhanceResult;
  quality?: QualityResult;
  aeo?: AEOResult;
  image?: PostImageValidationResult;

  // 종합 판정
  overallPassed: boolean;
  canPublish: boolean;
  needsReview: boolean;

  // 권장 사항
  recommendations: string[];
  warnings: string[];
  errors: string[];
}

// ============================================================================
// 기본 설정
// ============================================================================

const DEFAULT_OPTIONS: ValidationStageOptions = {
  mode: 'full',
  includeEnhance: false,
  includeFactcheck: true,
  includeQuality: true,
  includeAEO: true,
  includeImage: true,
  applyAEO: false,
  autoFix: false,
  verbose: false,
  parallelGates: true,
  remediate: false,
  onProgress: () => {}
};

// ============================================================================
// 메인 검증 함수
// ============================================================================

/**
 * 전체 검증 파이프라인 실행
 * Generate → Enhance → Factcheck → Quality → AEO → Image
 */
export async function runFullValidation(
  filePath: string,
  options: Partial<ValidationStageOptions> = {}
): Promise<FullValidationResult> {
  const opts: ValidationStageOptions = { ...DEFAULT_OPTIONS, ...options };
  const { onProgress = () => {} } = opts;

  const stages: StageResult[] = [];
  const recommendations: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  let canPublish = true;
  let needsReview = false;

  // 상세 결과 저장
  let factcheckResult: FactCheckReport | undefined;
  let enhanceResult: EnhanceResult | undefined;
  let qualityResult: QualityResult | undefined;
  let aeoResult: AEOResult | undefined;
  let imageResult: PostImageValidationResult | undefined;

  // 파일 읽기 및 메타데이터 추출
  const content = await readFile(filePath, 'utf-8');
  const { data: frontmatter } = matter(content);
  const title = frontmatter.title as string || 'Untitled';
  const contentType = detectContentType(frontmatter);

  onProgress('init', `검증 시작: ${title}`);

  // ========================================================================
  // Stage 1: Factcheck + Quality + Image (QualityMesh 병렬 또는 순차)
  // ========================================================================
  // Quick 모드에서는 factcheck만 실행, full 모드에서는 QualityMesh 사용
  if (opts.mode === 'quick') {
    // Quick 모드: factcheck만 순차 실행
    if (opts.includeFactcheck !== false) {
      onProgress('factcheck', '팩트체크 실행 중...');

      try {
        factcheckResult = await factCheckFile(filePath, { verbose: opts.verbose });

        const stage: StageResult = {
          name: 'factcheck',
          status: factcheckResult.passesGate ? 'passed' : (factcheckResult.blockPublish ? 'failed' : 'warning'),
          score: factcheckResult.overallScore,
          details: `검증: ${factcheckResult.claims.verified}/${factcheckResult.claims.total}`,
          blocked: factcheckResult.blockPublish,
          data: factcheckResult
        };

        stages.push(stage);

        if (factcheckResult.blockPublish) {
          canPublish = false;
          errors.push(`팩트체크 실패 (${factcheckResult.overallScore}%)`);
        } else if (factcheckResult.needsHumanReview) {
          needsReview = true;
          warnings.push(`팩트체크 검토 필요 (${factcheckResult.overallScore}%)`);
        }
      } catch (error) {
        stages.push({
          name: 'factcheck',
          status: 'failed',
          details: `오류: ${error instanceof Error ? error.message : error}`
        });
        errors.push(`팩트체크 오류: ${error instanceof Error ? error.message : error}`);
      }
    }

    return buildResult(filePath, title, contentType, stages, {
      factcheck: factcheckResult
    }, { canPublish, needsReview, recommendations, warnings, errors });
  }

  // Full 모드: QualityMesh로 factcheck + quality gates + image 병렬 실행
  const useMesh = opts.includeFactcheck !== false || opts.includeQuality !== false || opts.includeImage !== false;
  let meshRan = false;

  if (useMesh) {
    onProgress('mesh', '품질 메시 실행 중 (factcheck + quality + image)...');

    try {
      const meshResult = await runQualityMesh(filePath, {
        parallel: opts.parallelGates !== false,
        remediate: opts.remediate || opts.autoFix,
        verbose: opts.verbose,
        contentType,
        onProgress,
      });

      meshRan = true;

      // Mesh 결과를 stages에 병합
      stages.push(...meshResult.stages);
      warnings.push(...meshResult.warnings);
      errors.push(...meshResult.errors);
      recommendations.push(...meshResult.recommendations);

      factcheckResult = meshResult.factcheck;
      qualityResult = meshResult.quality;
      imageResult = meshResult.image;

      if (!meshResult.canPublish) canPublish = false;
      if (meshResult.needsReview) needsReview = true;

      // autoFix용 추가 수정 제안 (mesh의 remediate와 별개로 기존 호환)
      if (!opts.autoFix && factcheckResult && factcheckResult.corrections.length > 0) {
        recommendations.push(...factcheckResult.corrections.map(c =>
          `[팩트체크] ${c.originalText} → ${c.suggestedText}`
        ));
      }

    } catch (error) {
      // Mesh 실패 시 기존 순차 경로로 폴백
      onProgress('mesh', '메시 실패, 순차 실행으로 폴백...');
      meshRan = false;
    }
  }

  // Mesh가 실행되지 않았으면 기존 순차 로직으로 폴백
  if (!meshRan) {
    // 기존 Stage 1: Factcheck
    if (opts.includeFactcheck !== false) {
      onProgress('factcheck', '팩트체크 실행 중...');

      try {
        factcheckResult = await factCheckFile(filePath, { verbose: opts.verbose });

        stages.push({
          name: 'factcheck',
          status: factcheckResult.passesGate ? 'passed' : (factcheckResult.blockPublish ? 'failed' : 'warning'),
          score: factcheckResult.overallScore,
          details: `검증: ${factcheckResult.claims.verified}/${factcheckResult.claims.total}`,
          blocked: factcheckResult.blockPublish,
          data: factcheckResult
        });

        if (factcheckResult.blockPublish) {
          canPublish = false;
          errors.push(`팩트체크 실패 (${factcheckResult.overallScore}%)`);
        }
      } catch (error) {
        stages.push({
          name: 'factcheck',
          status: 'failed',
          details: `오류: ${error instanceof Error ? error.message : error}`
        });
        errors.push(`팩트체크 오류: ${error instanceof Error ? error.message : error}`);
      }
    }
  }

  // ========================================================================
  // Stage 2: Enhance (선택적)
  // ========================================================================
  if (opts.includeEnhance || opts.mode === 'enhance-only') {
    onProgress('enhance', '콘텐츠 향상 분석 중...');

    try {
      // 먼저 분석
      const analysis = await analyzeDraft(filePath, contentType);

      // 향상 필요 여부 판단
      const needsEnhancement =
        analysis.cliches.found.length > 0 ||
        analysis.detailLevel.score < 70 ||
        analysis.personaAlignment < 70;

      if (needsEnhancement) {
        onProgress('enhance', '콘텐츠 향상 실행 중...');

        enhanceResult = await enhanceDraft({
          filePath,
          contentType,
          dryRun: false,
          verbose: opts.verbose,
          onProgress: (msg) => {
            if (opts.verbose) {
              onProgress('enhance', msg);
            }
          }
        });

        stages.push({
          name: 'enhance',
          status: enhanceResult.enhanced ? 'passed' : 'warning',
          score: enhanceResult.finalAnalysis?.personaAlignment || analysis.personaAlignment,
          details: enhanceResult.enhanced
            ? `클리셰 -${enhanceResult.changes.clichesRemoved}, 디테일 +${enhanceResult.changes.detailsAdded}`
            : '이미 고품질',
          data: enhanceResult
        });

        if (enhanceResult.warnings.length > 0) {
          warnings.push(...enhanceResult.warnings.map(w => `[향상] ${w}`));
        }

      } else {
        stages.push({
          name: 'enhance',
          status: 'passed',
          score: analysis.personaAlignment,
          details: `클리셰 0개, 적합도 ${analysis.personaAlignment}%`
        });
      }

    } catch (error) {
      stages.push({
        name: 'enhance',
        status: 'failed',
        details: `오류: ${error instanceof Error ? error.message : error}`
      });
      warnings.push(`향상 오류: ${error instanceof Error ? error.message : error}`);
    }
  }

  // enhance-only 모드면 여기서 종료
  if (opts.mode === 'enhance-only') {
    return buildResult(filePath, title, contentType, stages, {
      enhance: enhanceResult
    }, { canPublish: true, needsReview: false, recommendations, warnings, errors });
  }

  // ========================================================================
  // Stage 3: Quality (SEO, Content, Duplicate) — meshRan이면 건너뜀
  // ========================================================================
  if (!meshRan && opts.includeQuality !== false) {
    onProgress('quality', '품질 검증 실행 중...');

    try {
      qualityResult = await runQualityGates(filePath, {
        skipFactCheck: true,  // 이미 위에서 실행
        verbose: opts.verbose,
        allGates: true
      });

      // SEO 게이트
      const seoGate = qualityResult.gates.find(g => g.name === 'seo');
      if (seoGate) {
        stages.push({
          name: 'seo',
          status: seoGate.passed ? 'passed' : 'warning',
          score: seoGate.score,
          details: seoGate.details,
          data: seoGate
        });
      }

      // Content 게이트
      const contentGate = qualityResult.gates.find(g => g.name === 'content');
      if (contentGate) {
        stages.push({
          name: 'content',
          status: contentGate.passed ? 'passed' : 'warning',
          score: contentGate.score,
          details: contentGate.details,
          data: contentGate
        });
      }

      // Duplicate 게이트
      const dupGate = qualityResult.gates.find(g => g.name === 'duplicate');
      if (dupGate) {
        stages.push({
          name: 'duplicate',
          status: dupGate.passed ? 'passed' : (dupGate.blockOnFailure ? 'failed' : 'warning'),
          score: dupGate.score,
          details: dupGate.details,
          blocked: !dupGate.passed && dupGate.blockOnFailure,
          data: dupGate
        });

        if (!dupGate.passed && dupGate.blockOnFailure) {
          canPublish = false;
        }
      }

      // 품질 경고 추가
      if (qualityResult.warnings.length > 0) {
        warnings.push(...qualityResult.warnings.map(w => `[품질] ${w}`));
      }

      if (qualityResult.needsHumanReview) {
        needsReview = true;
      }

    } catch (error) {
      stages.push({
        name: 'quality',
        status: 'failed',
        details: `오류: ${error instanceof Error ? error.message : error}`
      });
      errors.push(`품질 검증 오류: ${error instanceof Error ? error.message : error}`);
    }
  }

  // ========================================================================
  // Stage 4: AEO (FAQ, Schema.org)
  // ========================================================================
  if (opts.includeAEO !== false) {
    onProgress('aeo', 'AEO 분석 중...');

    try {
      aeoResult = await processAEO(filePath);

      stages.push({
        name: 'aeo',
        status: 'passed',
        details: `FAQ: ${aeoResult.faqsAdded}, Schema: ${aeoResult.schemasAdded}`,
        data: aeoResult
      });

      if (opts.applyAEO && (aeoResult.faqsAdded > 0 || aeoResult.schemasAdded > 0)) {
        await applyAEOToFile(filePath, aeoResult);
        onProgress('aeo', 'AEO 적용 완료');
      } else if (!opts.applyAEO && (aeoResult.faqsAdded > 0 || aeoResult.schemasAdded > 0)) {
        recommendations.push('[AEO] --apply 옵션으로 FAQ/Schema 적용 가능');
      }

    } catch (error) {
      stages.push({
        name: 'aeo',
        status: 'failed',
        details: `오류: ${error instanceof Error ? error.message : error}`
      });
      warnings.push(`AEO 오류: ${error instanceof Error ? error.message : error}`);
    }
  }

  // ========================================================================
  // Stage 5: Image Validation — meshRan이면 건너뜀
  // ========================================================================
  if (!meshRan && opts.includeImage !== false) {
    onProgress('image', '이미지 검증 중...');

    try {
      imageResult = await validatePostImages(filePath);

      stages.push({
        name: 'image',
        status: imageResult.passesGate ? 'passed' : 'warning',
        score: imageResult.overallScore,
        details: `커버: ${imageResult.coverImage ? '✓' : '✗'}, 인라인: ${imageResult.inlineImages.length}개`,
        data: imageResult
      });

      if (imageResult.recommendations.length > 0) {
        recommendations.push(...imageResult.recommendations.map(r => `[이미지] ${r}`));
      }

    } catch (error) {
      stages.push({
        name: 'image',
        status: 'failed',
        details: `오류: ${error instanceof Error ? error.message : error}`
      });
      warnings.push(`이미지 검증 오류: ${error instanceof Error ? error.message : error}`);
    }
  }

  // ========================================================================
  // 결과 빌드 및 반환
  // ========================================================================
  return buildResult(filePath, title, contentType, stages, {
    factcheck: factcheckResult,
    enhance: enhanceResult,
    quality: qualityResult,
    aeo: aeoResult,
    image: imageResult
  }, { canPublish, needsReview, recommendations, warnings, errors });
}

// ============================================================================
// 유틸리티 함수
// ============================================================================

/**
 * 콘텐츠 타입 감지
 */
function detectContentType(frontmatter: Record<string, unknown>): 'travel' | 'culture' {
  const categories = frontmatter.categories as string[] || [];
  if (categories.includes('culture')) return 'culture';
  return 'travel';
}

/**
 * 결과 빌드
 */
function buildResult(
  filePath: string,
  title: string,
  contentType: 'travel' | 'culture',
  stages: StageResult[],
  details: {
    factcheck?: FactCheckReport;
    enhance?: EnhanceResult;
    quality?: QualityResult;
    aeo?: AEOResult;
    image?: PostImageValidationResult;
  },
  judgement: {
    canPublish: boolean;
    needsReview: boolean;
    recommendations: string[];
    warnings: string[];
    errors: string[];
  }
): FullValidationResult {
  const hasBlocked = stages.some(s => s.blocked);
  const allPassed = stages.every(s => s.status !== 'failed');

  return {
    filePath,
    title,
    contentType,
    executedAt: new Date().toISOString(),
    stages,
    factcheck: details.factcheck,
    enhance: details.enhance,
    quality: details.quality,
    aeo: details.aeo,
    image: details.image,
    overallPassed: allPassed && !hasBlocked,
    canPublish: judgement.canPublish && !hasBlocked,
    needsReview: judgement.needsReview,
    recommendations: judgement.recommendations,
    warnings: judgement.warnings,
    errors: judgement.errors
  };
}

/**
 * 스테이지 점수 평균 계산
 */
export function calculateAverageScore(stages: StageResult[]): number {
  const scoredStages = stages.filter(s => s.score !== undefined);
  if (scoredStages.length === 0) return 0;

  const total = scoredStages.reduce((sum, s) => sum + (s.score || 0), 0);
  return Math.round(total / scoredStages.length);
}

/**
 * 간단한 검증 (발행 가능 여부만)
 */
export async function canPublishQuick(filePath: string): Promise<{
  allowed: boolean;
  reason?: string;
  score?: number;
}> {
  try {
    const result = await runFullValidation(filePath, { mode: 'quick' });

    if (!result.canPublish) {
      const failedStages = result.stages.filter(s => s.status === 'failed');
      return {
        allowed: false,
        reason: failedStages.length > 0
          ? `실패: ${failedStages.map(s => s.name).join(', ')}`
          : '검토 필요',
        score: calculateAverageScore(result.stages)
      };
    }

    return {
      allowed: true,
      score: calculateAverageScore(result.stages)
    };
  } catch (error) {
    return {
      allowed: false,
      reason: `검증 오류: ${error instanceof Error ? error.message : error}`
    };
  }
}

export default runFullValidation;
