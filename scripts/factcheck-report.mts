/**
 * Claude Code 팩트체크 — Step 3: 보고서 생성
 *
 * Claude Code가 검증 완료한 결과 JSON을 읽어 FactCheckReport를 생성합니다.
 * 기존 scoring, quality-gate, auto-fix 로직을 재사용합니다.
 *
 * 입력 JSON 형식:
 * {
 *   "filePath": "drafts/2026-02-07-post.md",
 *   "title": "포스트 제목",
 *   "claims": ExtractedClaim[],      // factcheck:extract 출력의 claims
 *   "results": VerificationResult[]  // Claude Code가 생성한 검증 결과
 * }
 *
 * Usage:
 *   npm run factcheck:report -- -i <results.json>
 *   npm run factcheck:report -- -i <results.json> --auto-fix
 *   npm run factcheck:report -- -i <results.json> --auto-fix --dry-run
 */
import { config } from 'dotenv';
config();

import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname } from 'path';
import {
  calculateCategoryScore,
  calculateOverallScore,
  calculateSeverityStats,
  generateCorrections,
  evaluateQualityGate,
  loadConfig,
  summarizeReport,
  applyAutoFix,
  formatDiff
} from '../src/factcheck/index.js';
import type {
  ExtractedClaim,
  VerificationResult,
  FactCheckReport
} from '../src/factcheck/types.js';

interface InputData {
  filePath: string;
  title: string;
  claims: ExtractedClaim[];
  results: VerificationResult[];
}

function parseArgs(): { inputPath: string; autoFix: boolean; dryRun: boolean; verbose: boolean } {
  const args = process.argv.slice(2);
  let inputPath = '';
  let autoFix = false;
  let dryRun = false;
  let verbose = false;

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '-i' || args[i] === '--input') && args[i + 1]) {
      inputPath = args[i + 1];
      i++;
    } else if (args[i] === '--auto-fix') {
      autoFix = true;
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    } else if (args[i] === '--verbose' || args[i] === '-v') {
      verbose = true;
    }
  }

  if (!inputPath) {
    console.error('Usage: npm run factcheck:report -- -i <results.json>');
    console.error('Options:');
    console.error('  --auto-fix    자동 수정 적용');
    console.error('  --dry-run     수정 미리보기 (파일 변경 없음)');
    console.error('  --verbose     상세 출력');
    process.exit(1);
  }

  return { inputPath, autoFix, dryRun, verbose };
}

function validateInput(data: unknown): data is InputData {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.filePath === 'string' &&
    typeof d.title === 'string' &&
    Array.isArray(d.claims) &&
    Array.isArray(d.results)
  );
}

async function main() {
  const { inputPath, autoFix, dryRun, verbose } = parseArgs();

  // 입력 JSON 읽기
  const rawInput = await readFile(inputPath, 'utf-8');
  const input = JSON.parse(rawInput) as unknown;

  if (!validateInput(input)) {
    console.error('❌ 입력 JSON 형식 오류. 필수 필드: filePath, title, claims[], results[]');
    process.exit(1);
  }

  // results에 checkedAt 보완 (Claude Code가 누락했을 수 있음)
  const now = new Date().toISOString();
  for (const result of input.results) {
    if (!result.checkedAt) {
      result.checkedAt = now;
    }
    if (!result.source) {
      result.source = 'web_search';
    }
  }

  // 설정 로드
  const factcheckConfig = await loadConfig();

  // 점수 계산
  const categoryScores = {
    critical: calculateCategoryScore(input.results, input.claims, 'critical'),
    major: calculateCategoryScore(input.results, input.claims, 'major'),
    minor: calculateCategoryScore(input.results, input.claims, 'minor')
  };

  const overallScore = calculateOverallScore(categoryScores, factcheckConfig);

  // 통계 계산
  const bySeverity = calculateSeverityStats(input.results, input.claims);

  const claimStats = {
    total: input.claims.length,
    verified: input.results.filter(r => r.status === 'verified').length,
    false: input.results.filter(r => r.status === 'false').length,
    unknown: input.results.filter(r => r.status === 'unknown').length
  };

  // 수정 제안 생성
  const corrections = generateCorrections(input.results, input.claims);

  // 품질 게이트 평가
  const gateResult = evaluateQualityGate(categoryScores, overallScore, bySeverity, factcheckConfig);

  // FactCheckReport 생성
  const report: FactCheckReport = {
    filePath: input.filePath,
    title: input.title,
    checkedAt: now,
    overallScore,
    categoryScores,
    claims: claimStats,
    bySeverity,
    results: input.results,
    extractedClaims: input.claims,
    corrections,
    ...gateResult,
    version: '1.0.0-claude'
  };

  // 콘솔에 요약 출력
  console.log(summarizeReport(report));

  // 보고서 JSON 저장
  const reportDir = 'data/factcheck-claude';
  await mkdir(reportDir, { recursive: true });
  const reportFilename = inputPath.replace(/\.json$/, '-report.json');
  const reportPath = reportFilename.includes('factcheck-claude')
    ? reportFilename
    : `${reportDir}/${inputPath.split('/').pop()?.replace(/\.json$/, '-report.json') || 'report.json'}`;

  await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`📄 보고서 저장: ${reportPath}`);

  // 자동 수정
  if (autoFix && corrections.length > 0) {
    console.log('\n🔧 자동 수정 실행...');
    const fixReport = await applyAutoFix(input.filePath, report, { dryRun, verbose });
    console.log(formatDiff(fixReport));
  } else if (autoFix && corrections.length === 0) {
    console.log('\n✅ 수정 필요 없음');
  }
}

main().catch((error) => {
  console.error('❌ 보고서 생성 실패:', error instanceof Error ? error.message : error);
  process.exit(1);
});
