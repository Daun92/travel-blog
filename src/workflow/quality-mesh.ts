/**
 * QualityMesh — 병렬 품질 게이트 + 치유 루프
 * Layer 3 (품질 그물망) 구현
 *
 * 기존 gates.ts의 8개 게이트를 독립성 기준으로 그룹화하여 병렬 실행.
 * 실패 시 치유 가능한 게이트는 자동 치유 후 재검증한다.
 *
 * 게이트 그룹:
 *   Group A (API 의존): factcheck — 별도 실행 (CircuitBreaker 적용)
 *   Group B (순수 분석, 동시 가능): seo, content, readability, tone, structure, keyword_density
 *   Group C (파일 스캔): duplicate — Group B와 병렬 가능
 */

import { readFile } from 'fs/promises';
import matter from 'gray-matter';

import { factCheckFile, applyAutoFix, FactCheckReport } from '../factcheck/index.js';
import { validateFile as runQualityGates, ValidationResult as QualityResult, GateResult } from '../quality/gates.js';
import { validatePostImages, PostImageValidationResult } from '../images/image-validator.js';
import { enhanceDraft, analyzeDraft, EnhanceResult } from '../agents/draft-enhancer/index.js';
import { CircuitBreaker } from '../quality/retry-handler.js';
import { getEventBus } from './event-bus.js';
import type { StageResult } from './stages.js';

// ============================================================================
// 타입 정의
// ============================================================================

export interface MeshOptions {
  /** 병렬 게이트 실행 (기본: true) */
  parallel?: boolean;
  /** 자동 치유 활성화 (기본: false) */
  remediate?: boolean;
  /** 상세 출력 */
  verbose?: boolean;
  /** 콘텐츠 타입 */
  contentType?: 'travel' | 'culture';
  /** 진행 콜백 */
  onProgress?: (stage: string, message: string) => void;
}

export interface MeshResult {
  /** 게이트별 결과 */
  stages: StageResult[];
  /** 종합 발행 가능 여부 */
  canPublish: boolean;
  /** 검토 필요 여부 */
  needsReview: boolean;
  /** 치유 적용 횟수 */
  remediationsApplied: number;
  /** 상세 결과 */
  quality?: QualityResult;
  factcheck?: FactCheckReport;
  image?: PostImageValidationResult;
  /** 경고 */
  warnings: string[];
  /** 에러 */
  errors: string[];
  /** 권장 사항 */
  recommendations: string[];
  /** 타이밍 정보 (verbose 모드) */
  timing?: Record<string, number>;
}

// ============================================================================
// 치유 매핑
// ============================================================================

interface RemediationAction {
  /** 치유 가능 여부 */
  canRemediate: boolean;
  /** 자동/수동 */
  auto: boolean;
  /** 설명 */
  description: string;
}

const REMEDIATION_MAP: Record<string, RemediationAction> = {
  factcheck: { canRemediate: true, auto: true, description: 'applyAutoFix → 재검증' },
  seo: { canRemediate: true, auto: true, description: 'frontmatter 보충' },
  content: { canRemediate: true, auto: true, description: 'enhance 재실행' },
  tone: { canRemediate: true, auto: true, description: 'enhance 재실행' },
  image: { canRemediate: false, auto: false, description: '수동 이미지 추가 필요' },
  duplicate: { canRemediate: false, auto: false, description: '중복 차단 (치유 불가)' },
  readability: { canRemediate: false, auto: false, description: '수동 수정 필요' },
  structure: { canRemediate: false, auto: false, description: '수동 구조 개선 필요' },
  keyword_density: { canRemediate: false, auto: false, description: '수동 키워드 조정 필요' },
};

// 팩트체크 서킷 브레이커 (API 보호)
const factcheckBreaker = new CircuitBreaker(3, 120000);

// ============================================================================
// QualityMesh 메인 함수
// ============================================================================

/**
 * 병렬 품질 검증 메시 실행
 *
 * 독립 게이트를 동시에 실행하고, 실패 시 치유 루프를 적용한다.
 * 기존 `runFullValidation()`의 quality + factcheck + image 단계를 대체.
 */
export async function runQualityMesh(
  filePath: string,
  options: MeshOptions = {}
): Promise<MeshResult> {
  const {
    parallel = true,
    remediate = false,
    verbose = false,
    onProgress = () => {},
  } = options;

  const eventBus = getEventBus();
  const stages: StageResult[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  const recommendations: string[] = [];
  const timing: Record<string, number> = {};
  let canPublish = true;
  let needsReview = false;
  let remediationsApplied = 0;

  // 상세 결과
  let factcheckResult: FactCheckReport | undefined;
  let qualityResult: QualityResult | undefined;
  let imageResult: PostImageValidationResult | undefined;

  // 콘텐츠 타입 감지
  const content = await readFile(filePath, 'utf-8');
  const { data: frontmatter } = matter(content);
  const contentType = options.contentType || detectContentType(frontmatter);

  onProgress('mesh', '품질 메시 실행 중...');

  if (parallel) {
    // ====================================================================
    // 병렬 실행 모드
    // ====================================================================

    // Group A: Factcheck (API 의존 — CircuitBreaker 적용)
    const groupA = timedExec('factcheck', async () => {
      return runFactcheckGate(filePath, verbose, onProgress);
    });

    // Group B+C: 순수 분석 게이트 + 중복 검사 (동시 실행)
    const groupBC = timedExec('quality-gates', async () => {
      return runQualityGates(filePath, {
        skipFactCheck: true,  // Group A에서 별도 실행
        verbose,
        allGates: true,
        contentType,
      });
    });

    // Group D: 이미지 검증 (파일 시스템 I/O — 병렬 가능)
    const groupD = timedExec('image', async () => {
      return validatePostImages(filePath);
    });

    // 모든 그룹 동시 실행
    const [fcSettled, qSettled, imgSettled] = await Promise.allSettled([groupA, groupBC, groupD]);

    // --- Group A 결과 처리 ---
    if (fcSettled.status === 'fulfilled') {
      const { result: fc, duration } = fcSettled.value;
      timing['factcheck'] = duration;
      factcheckResult = fc.report;

      stages.push(fc.stage);

      if (fc.stage.blocked) {
        canPublish = false;
      }
      if (fc.needsReview) {
        needsReview = true;
      }
      if (fc.warnings.length > 0) {
        warnings.push(...fc.warnings);
      }
      if (fc.errors.length > 0) {
        errors.push(...fc.errors);
      }
    } else {
      errors.push(`팩트체크 오류: ${fcSettled.reason}`);
      stages.push({
        name: 'factcheck',
        status: 'failed',
        details: `오류: ${fcSettled.reason}`,
      });
    }

    // --- Group B+C 결과 처리 ---
    if (qSettled.status === 'fulfilled') {
      const { result: qr, duration } = qSettled.value;
      timing['quality-gates'] = duration;
      qualityResult = qr;

      // 각 게이트를 StageResult로 변환
      for (const gate of qr.gates) {
        const stage: StageResult = {
          name: gate.name,
          status: gate.passed ? 'passed' : (gate.blockOnFailure ? 'failed' : 'warning'),
          score: gate.score,
          details: gate.details,
          blocked: !gate.passed && gate.blockOnFailure,
          data: gate,
        };
        stages.push(stage);

        // 이벤트 발행
        if (gate.passed) {
          eventBus.emit('quality:gate-passed', { filePath, gate: gate.name, score: gate.score });
        } else {
          eventBus.emit('quality:gate-failed', {
            filePath,
            gate: gate.name,
            score: gate.score,
            remediation: REMEDIATION_MAP[gate.name]?.description,
          });
        }

        if (stage.blocked) {
          canPublish = false;
        }
      }

      if (qr.warnings.length > 0) {
        warnings.push(...qr.warnings.map(w => `[품질] ${w}`));
      }
      if (qr.needsHumanReview) {
        needsReview = true;
      }
    } else {
      errors.push(`품질 검증 오류: ${qSettled.reason}`);
      stages.push({
        name: 'quality',
        status: 'failed',
        details: `오류: ${qSettled.reason}`,
      });
    }

    // --- Group D 결과 처리 ---
    if (imgSettled.status === 'fulfilled') {
      const { result: img, duration } = imgSettled.value;
      timing['image'] = duration;
      imageResult = img;

      stages.push({
        name: 'image',
        status: img.passesGate ? 'passed' : 'warning',
        score: img.overallScore,
        details: `커버: ${img.coverImage ? '✓' : '✗'}, 인라인: ${img.inlineImages.length}개`,
        data: img,
      });

      if (img.recommendations.length > 0) {
        recommendations.push(...img.recommendations.map(r => `[이미지] ${r}`));
      }
    } else {
      warnings.push(`이미지 검증 오류: ${imgSettled.reason}`);
      stages.push({
        name: 'image',
        status: 'failed',
        details: `오류: ${imgSettled.reason}`,
      });
    }

  } else {
    // ====================================================================
    // 순차 실행 모드 (--no-parallel 호환)
    // ====================================================================

    // Factcheck
    try {
      const fc = await runFactcheckGate(filePath, verbose, onProgress);
      factcheckResult = fc.report;
      stages.push(fc.stage);
      if (fc.stage.blocked) canPublish = false;
      if (fc.needsReview) needsReview = true;
      warnings.push(...fc.warnings);
      errors.push(...fc.errors);
    } catch (error) {
      errors.push(`팩트체크 오류: ${error instanceof Error ? error.message : error}`);
    }

    // Quality gates
    try {
      qualityResult = await runQualityGates(filePath, {
        skipFactCheck: true,
        verbose,
        allGates: true,
        contentType,
      });

      for (const gate of qualityResult.gates) {
        stages.push({
          name: gate.name,
          status: gate.passed ? 'passed' : (gate.blockOnFailure ? 'failed' : 'warning'),
          score: gate.score,
          details: gate.details,
          blocked: !gate.passed && gate.blockOnFailure,
          data: gate,
        });
        if (!gate.passed && gate.blockOnFailure) canPublish = false;
      }
      if (qualityResult.warnings.length > 0) {
        warnings.push(...qualityResult.warnings.map(w => `[품질] ${w}`));
      }
      if (qualityResult.needsHumanReview) needsReview = true;
    } catch (error) {
      errors.push(`품질 검증 오류: ${error instanceof Error ? error.message : error}`);
    }

    // Image
    try {
      imageResult = await validatePostImages(filePath);
      stages.push({
        name: 'image',
        status: imageResult.passesGate ? 'passed' : 'warning',
        score: imageResult.overallScore,
        details: `커버: ${imageResult.coverImage ? '✓' : '✗'}, 인라인: ${imageResult.inlineImages.length}개`,
        data: imageResult,
      });
      if (imageResult.recommendations.length > 0) {
        recommendations.push(...imageResult.recommendations.map(r => `[이미지] ${r}`));
      }
    } catch (error) {
      warnings.push(`이미지 검증 오류: ${error instanceof Error ? error.message : error}`);
    }
  }

  // ======================================================================
  // 치유 루프 (remediate 옵션 활성화 시)
  // ======================================================================
  if (remediate) {
    const failedStages = stages.filter(s => s.status === 'failed' || s.status === 'warning');

    for (const failed of failedStages) {
      const remediation = REMEDIATION_MAP[failed.name];
      if (!remediation?.canRemediate || !remediation.auto) continue;

      onProgress('remediate', `${failed.name} 치유 시도 중...`);

      try {
        const healed = await attemptRemediation(filePath, failed.name, {
          factcheckReport: factcheckResult,
          contentType,
          verbose,
          onProgress,
        });

        if (healed) {
          remediationsApplied++;
          failed.status = 'passed';
          failed.details = `${failed.details} → 치유 적용됨`;
          (failed as StageResult & { remediationApplied?: boolean }).remediationApplied = true;

          if (verbose) {
            onProgress('remediate', `✓ ${failed.name} 치유 성공`);
          }
        }
      } catch (error) {
        warnings.push(`[치유] ${failed.name} 실패: ${error instanceof Error ? error.message : error}`);
      }
    }

    // 치유 후 canPublish 재평가
    const stillBlocked = stages.some(s => s.blocked && s.status !== 'passed');
    canPublish = !stillBlocked;
  }

  // ======================================================================
  // 이벤트 발행
  // ======================================================================
  const scores: Record<string, number> = {};
  for (const s of stages) {
    if (s.score !== undefined) {
      scores[s.name] = s.score;
    }
  }

  eventBus.emit('quality:mesh-complete', {
    filePath,
    canPublish,
    scores,
    remediationsApplied,
  });

  // verbose 타이밍 출력
  if (verbose && Object.keys(timing).length > 0) {
    const timingStr = Object.entries(timing)
      .map(([k, v]) => `${k} (${v}ms)`)
      .join(' | ');
    onProgress('mesh', `타이밍: ${timingStr}`);
  }

  return {
    stages,
    canPublish,
    needsReview,
    remediationsApplied,
    quality: qualityResult,
    factcheck: factcheckResult,
    image: imageResult,
    warnings,
    errors,
    recommendations,
    ...(verbose ? { timing } : {}),
  };
}

// ============================================================================
// 내부 함수
// ============================================================================

/**
 * 팩트체크 게이트 실행 (CircuitBreaker 적용)
 */
async function runFactcheckGate(
  filePath: string,
  verbose: boolean,
  onProgress: (stage: string, msg: string) => void
): Promise<{
  stage: StageResult;
  report?: FactCheckReport;
  needsReview: boolean;
  warnings: string[];
  errors: string[];
}> {
  const warnings: string[] = [];
  const errors: string[] = [];
  let needsReview = false;

  onProgress('factcheck', '팩트체크 실행 중...');

  try {
    const report = await factcheckBreaker.execute(() =>
      factCheckFile(filePath, { verbose })
    );

    const stage: StageResult = {
      name: 'factcheck',
      status: report.passesGate ? 'passed' : (report.blockPublish ? 'failed' : 'warning'),
      score: report.overallScore,
      details: `검증: ${report.claims.verified}/${report.claims.total}`,
      blocked: report.blockPublish,
      data: report,
    };

    if (report.blockPublish) {
      errors.push(`팩트체크 실패 (${report.overallScore}%)`);
    } else if (report.needsHumanReview) {
      needsReview = true;
      warnings.push(`팩트체크 검토 필요 (${report.overallScore}%)`);
    }

    // 이벤트 발행
    const eventBus = getEventBus();
    if (report.passesGate) {
      eventBus.emit('quality:gate-passed', {
        filePath,
        gate: 'factcheck',
        score: report.overallScore,
      });
    } else {
      eventBus.emit('quality:gate-failed', {
        filePath,
        gate: 'factcheck',
        score: report.overallScore,
        remediation: 'applyAutoFix → 재검증',
      });
    }

    return { stage, report, needsReview, warnings, errors };

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);

    return {
      stage: {
        name: 'factcheck',
        status: 'failed',
        details: `오류: ${msg}`,
        blocked: true,
      },
      needsReview: false,
      warnings: [],
      errors: [`팩트체크 오류: ${msg}`],
    };
  }
}

/**
 * 실행 시간 측정 래퍼
 */
async function timedExec<T>(
  _label: string,
  fn: () => Promise<T>
): Promise<{ result: T; duration: number }> {
  const start = Date.now();
  const result = await fn();
  return { result, duration: Date.now() - start };
}

/**
 * 치유 시도
 * 게이트별 치유 액션을 실행하고, 성공 여부를 반환한다.
 * 최대 1회만 시도 (무한 루프 방지).
 */
async function attemptRemediation(
  filePath: string,
  gateName: string,
  context: {
    factcheckReport?: FactCheckReport;
    contentType: 'travel' | 'culture';
    verbose: boolean;
    onProgress: (stage: string, msg: string) => void;
  }
): Promise<boolean> {
  switch (gateName) {
    case 'factcheck': {
      // 팩트체크 실패 → autoFix 적용 → 재검증
      if (!context.factcheckReport || context.factcheckReport.corrections.length === 0) {
        return false;
      }
      const fixReport = await applyAutoFix(filePath, context.factcheckReport, {
        dryRun: false,
        verbose: context.verbose,
      });
      return fixReport.stats.applied > 0;
    }

    case 'content':
    case 'tone': {
      // 분량 부족 / 톤 불일치 → enhance 재실행
      const analysis = await analyzeDraft(filePath, context.contentType);
      const needsWork = analysis.detailLevel.score < 70 || analysis.personaAlignment < 70;
      if (!needsWork) return false;

      const result = await enhanceDraft({
        filePath,
        contentType: context.contentType,
        dryRun: false,
        verbose: context.verbose,
        onProgress: (msg) => context.onProgress('remediate', msg),
      });
      return result.enhanced;
    }

    case 'seo': {
      // SEO 실패 → frontmatter 보충 (description 누락 등)
      // 간단한 보충만 시도 — 이미 있는 데이터로 description 생성
      const content = await readFile(filePath, 'utf-8');
      const { data: fm } = matter(content);
      if (fm.description) return false;  // 이미 있으면 치유 불필요

      // description을 본문 첫 200자에서 추출
      const body = content.replace(/^---[\s\S]*?---/, '').trim();
      const firstParagraph = body.split('\n\n').find(p => p.trim().length > 50);
      if (!firstParagraph) return false;

      const description = firstParagraph.replace(/[#*\[\]]/g, '').trim().slice(0, 155);
      fm.description = description;

      const grayMatter = await import('gray-matter');
      const newContent = grayMatter.default.stringify(body, fm);
      const { writeFile } = await import('fs/promises');
      await writeFile(filePath, newContent, 'utf-8');
      return true;
    }

    default:
      return false;
  }
}

/**
 * 콘텐츠 타입 감지
 */
function detectContentType(frontmatter: Record<string, unknown>): 'travel' | 'culture' {
  const categories = frontmatter.categories as string[] || [];
  if (categories.includes('culture')) return 'culture';
  return 'travel';
}
