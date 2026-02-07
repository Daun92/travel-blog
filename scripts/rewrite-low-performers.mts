/**
 * 저성과 포스트 리라이트 스크립트
 *
 * performance.json에서 score ≤ threshold 포스트를 감지하고
 * 전체 Premium Workflow 파이프라인을 재적용한다.
 *
 * 사용법:
 *   npm run rewrite:low                     # 기본 (51점 이하)
 *   npm run rewrite:low -- --threshold 55   # 커스텀 임계값
 *   npm run rewrite:low -- --dry-run        # 미리보기 (변경 없음)
 *   npm run rewrite:low -- --file <path>    # 특정 파일만
 */

import { config } from 'dotenv';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { execSync } from 'child_process';
import { join, basename } from 'path';

config();

const PERFORMANCE_FILE = 'data/monitoring/performance.json';
const REPORTS_DIR = 'reports';
const BLOG_POSTS_DIR = 'blog/content/posts';

interface PerformanceEntry {
  postPath: string;
  title: string;
  category: string;
  score: number;
  trend: string;
  publishedAt: string;
  engagement?: {
    moltbookUpvotes: number;
    moltbookDownvotes: number;
    moltbookComments: number;
    sentiment: string;
  };
}

interface StepResult {
  name: string;
  success: boolean;
  output?: string;
  error?: string;
  durationMs: number;
}

interface RewriteResult {
  postPath: string;
  title: string;
  previousScore: number;
  steps: StepResult[];
  overallSuccess: boolean;
}

/**
 * CLI 인수 파싱
 */
function parseArgs(): {
  threshold: number;
  dryRun: boolean;
  file?: string;
} {
  const args = process.argv.slice(2);
  let threshold = 51;
  let dryRun = false;
  let file: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--threshold' && args[i + 1]) {
      threshold = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    } else if (args[i] === '--file' && args[i + 1]) {
      file = args[i + 1];
      i++;
    }
  }

  return { threshold, dryRun, file };
}

/**
 * 저성과 포스트 필터링
 */
async function findLowPerformers(threshold: number): Promise<PerformanceEntry[]> {
  const data = await readFile(PERFORMANCE_FILE, 'utf-8');
  const entries = JSON.parse(data) as PerformanceEntry[];

  return entries
    .filter(e => {
      // _index.md 제외
      if (e.postPath.includes('_index')) return false;
      // 점수 임계값 이하
      return e.score <= threshold;
    })
    .sort((a, b) => a.score - b.score); // 최저 점수 우선
}

/**
 * 단일 스텝 실행
 */
function runStep(name: string, command: string, dryRun: boolean): StepResult {
  const start = Date.now();

  if (dryRun) {
    return {
      name,
      success: true,
      output: `(dry-run) ${command}`,
      durationMs: 0
    };
  }

  try {
    const output = execSync(command, {
      encoding: 'utf-8',
      timeout: 5 * 60 * 1000, // 5분 타임아웃
      stdio: ['pipe', 'pipe', 'pipe']
    });

    return {
      name,
      success: true,
      output: output.slice(0, 500),
      durationMs: Date.now() - start
    };
  } catch (error: any) {
    return {
      name,
      success: false,
      error: error.message?.slice(0, 300) || 'Unknown error',
      durationMs: Date.now() - start
    };
  }
}

/**
 * 포스트 리라이트 파이프라인 실행
 */
function rewritePost(entry: PerformanceEntry, dryRun: boolean): RewriteResult {
  const filePath = join(BLOG_POSTS_DIR, entry.postPath);
  const steps: StepResult[] = [];

  console.log(`\n📝 리라이트: ${entry.title}`);
  console.log(`   점수: ${entry.score}점 | 경로: ${filePath}`);

  // Step 1: enhance (페르소나 기반 재향상)
  console.log('   1/5 Enhance...');
  steps.push(runStep('enhance', `npx tsx src/cli/index.ts enhance -f "${filePath}"`, dryRun));

  // Step 2: factcheck --auto-fix
  console.log('   2/5 Factcheck + Auto-fix...');
  steps.push(runStep('factcheck', `npx tsx src/cli/index.ts factcheck -f "${filePath}" --auto-fix`, dryRun));

  // Step 3: validate
  console.log('   3/5 Validate...');
  steps.push(runStep('validate', `npx tsx src/cli/index.ts validate -f "${filePath}"`, dryRun));

  // Step 4: aeo --apply
  console.log('   4/5 AEO...');
  steps.push(runStep('aeo', `npx tsx src/cli/index.ts aeo -f "${filePath}" --apply`, dryRun));

  // Step 5: links --enhance
  console.log('   5/5 Links...');
  steps.push(runStep('links', `npx tsx src/cli/index.ts links -f "${filePath}" --enhance`, dryRun));

  const successCount = steps.filter(s => s.success).length;
  const overallSuccess = successCount >= 3; // 5개 중 3개 이상 성공

  const emoji = overallSuccess ? '✅' : '⚠️';
  console.log(`   ${emoji} 완료: ${successCount}/${steps.length} 스텝 성공`);

  return {
    postPath: entry.postPath,
    title: entry.title,
    previousScore: entry.score,
    steps,
    overallSuccess
  };
}

/**
 * 마크다운 리포트 생성
 */
function generateReport(results: RewriteResult[], threshold: number, dryRun: boolean): string {
  const lines: string[] = [];
  const date = new Date().toISOString().slice(0, 10);

  lines.push(`# 저성과 포스트 리라이트 리포트`);
  lines.push(`- 날짜: ${date}`);
  lines.push(`- 임계값: ${threshold}점 이하`);
  lines.push(`- 대상: ${results.length}개 포스트`);
  if (dryRun) lines.push(`- **DRY-RUN 모드 (실제 변경 없음)**`);
  lines.push('');

  lines.push(`## 결과 요약`);
  const success = results.filter(r => r.overallSuccess).length;
  lines.push(`- 성공: ${success}/${results.length}`);
  lines.push('');

  lines.push(`## 포스트별 상세`);
  lines.push('');

  for (const result of results) {
    const icon = result.overallSuccess ? '✅' : '⚠️';
    lines.push(`### ${icon} ${result.title} (이전 점수: ${result.previousScore})`);
    lines.push(`- 경로: \`${result.postPath}\``);
    lines.push('');

    lines.push('| 단계 | 결과 | 소요 시간 |');
    lines.push('|------|------|-----------|');

    for (const step of result.steps) {
      const status = step.success ? '✅ 성공' : '❌ 실패';
      const duration = step.durationMs > 0 ? `${(step.durationMs / 1000).toFixed(1)}s` : '-';
      lines.push(`| ${step.name} | ${status} | ${duration} |`);
    }

    // 실패 상세
    const failures = result.steps.filter(s => !s.success);
    if (failures.length > 0) {
      lines.push('');
      lines.push('**실패 상세:**');
      for (const f of failures) {
        lines.push(`- ${f.name}: ${f.error?.slice(0, 100) || '알 수 없는 오류'}`);
      }
    }

    lines.push('');
  }

  return lines.join('\n');
}

/**
 * 메인
 */
async function main() {
  const { threshold, dryRun, file } = parseArgs();

  console.log('🔄 저성과 포스트 리라이트');
  console.log(`   임계값: ${threshold}점 이하`);
  if (dryRun) console.log('   모드: DRY-RUN (변경 없음)');
  console.log('');

  let targets: PerformanceEntry[];

  if (file) {
    // 특정 파일 지정
    const data = await readFile(PERFORMANCE_FILE, 'utf-8');
    const entries = JSON.parse(data) as PerformanceEntry[];
    const normalizedFile = file.replace(/\\/g, '/');
    const entry = entries.find(e =>
      normalizedFile.includes(e.postPath.replace(/\\/g, '/'))
    );

    if (!entry) {
      console.log(`파일을 찾을 수 없습니다: ${file}`);
      process.exit(1);
    }

    targets = [entry];
  } else {
    targets = await findLowPerformers(threshold);
  }

  if (targets.length === 0) {
    console.log(`${threshold}점 이하 포스트가 없습니다.`);
    return;
  }

  console.log(`📋 대상 포스트: ${targets.length}개`);
  for (const t of targets) {
    console.log(`   [${t.score}점] ${t.title}`);
  }

  if (dryRun) {
    console.log('\n(dry-run 모드: 위 포스트가 리라이트 대상입니다)');
    return;
  }

  // 리라이트 실행
  const results: RewriteResult[] = [];

  for (const target of targets) {
    const result = rewritePost(target, dryRun);
    results.push(result);
  }

  // 리포트 생성
  const report = generateReport(results, threshold, dryRun);
  await mkdir(REPORTS_DIR, { recursive: true });
  const reportFile = join(REPORTS_DIR, `rewrite-${new Date().toISOString().slice(0, 10)}.md`);
  await writeFile(reportFile, report, 'utf-8');

  console.log(`\n📊 리포트 저장: ${reportFile}`);

  // 요약
  const successCount = results.filter(r => r.overallSuccess).length;
  console.log(`\n✅ 완료: ${successCount}/${results.length} 포스트 리라이트 성공`);
  console.log('다음 단계: npm run monitor 으로 성과 변화 추적');
}

main().catch(console.error);
