/**
 * 드래프트 향상 명령어
 * 페르소나 적용 + 디테일링 + 클리셰 제거
 */

import chalk from 'chalk';
import { readdir, stat } from 'fs/promises';
import { join } from 'path';
import {
  enhanceDraft,
  analyzeDraft,
  type EnhanceResult
} from '../../agents/draft-enhancer/index.js';
import { formatClicheReport } from '../../agents/draft-enhancer/cliche-filter.js';
import { formatDetailReport } from '../../agents/draft-enhancer/detail-analyzer.js';

// ============================================================================
// 명령어 옵션
// ============================================================================

interface EnhanceOptions {
  file?: string;
  all?: boolean;
  type?: 'travel' | 'culture';
  dryRun?: boolean;
  analyze?: boolean;
  verbose?: boolean;
}

// ============================================================================
// 메인 명령어
// ============================================================================

export async function enhanceCommand(options: EnhanceOptions): Promise<void> {
  console.log(chalk.cyan('\n🎨 드래프트 향상 에이전트\n'));

  // 분석 모드
  if (options.analyze) {
    await runAnalyzeMode(options);
    return;
  }

  // 향상 모드
  await runEnhanceMode(options);
}

// ============================================================================
// 분석 모드
// ============================================================================

async function runAnalyzeMode(options: EnhanceOptions): Promise<void> {
  const files = await getTargetFiles(options);

  if (files.length === 0) {
    console.log(chalk.yellow('분석할 파일이 없습니다.'));
    return;
  }

  console.log(chalk.gray(`${files.length}개 파일 분석 중...\n`));

  for (const filePath of files) {
    const filename = filePath.split(/[/\\]/).pop();
    console.log(chalk.white.bold(`📄 ${filename}`));
    console.log(chalk.gray('─'.repeat(50)));

    try {
      const contentType = options.type || detectContentType(filePath);
      const analysis = await analyzeDraft(filePath, contentType);

      // 클리셰 리포트
      console.log(formatClicheReport(analysis.cliches));
      console.log('');

      // 디테일 리포트
      console.log(formatDetailReport(analysis.detailLevel));
      console.log('');

      // 페르소나 적합도
      const alignmentColor = analysis.personaAlignment >= 70 ? chalk.green :
        analysis.personaAlignment >= 50 ? chalk.yellow : chalk.red;
      console.log(`👤 페르소나 적합도: ${alignmentColor(analysis.personaAlignment + '%')}`);
      console.log('');

      // 추천사항
      if (analysis.recommendations.length > 0) {
        console.log(chalk.cyan('💡 추천사항:'));
        for (const rec of analysis.recommendations) {
          console.log(`   - ${rec}`);
        }
      }

      console.log('\n');
    } catch (error) {
      console.log(chalk.red(`오류: ${error instanceof Error ? error.message : error}`));
      console.log('\n');
    }
  }
}

// ============================================================================
// 향상 모드
// ============================================================================

async function runEnhanceMode(options: EnhanceOptions): Promise<void> {
  const files = await getTargetFiles(options);

  if (files.length === 0) {
    console.log(chalk.yellow('향상할 파일이 없습니다.'));
    return;
  }

  if (options.dryRun) {
    console.log(chalk.yellow('🔍 DRY-RUN 모드: 실제 저장하지 않습니다.\n'));
  }

  console.log(chalk.gray(`${files.length}개 파일 향상 중...\n`));

  const results: EnhanceResult[] = [];

  for (const filePath of files) {
    const filename = filePath.split(/[/\\]/).pop();
    console.log(chalk.white.bold(`📄 ${filename}`));
    console.log(chalk.gray('─'.repeat(50)));

    try {
      const contentType = options.type || detectContentType(filePath);

      const result = await enhanceDraft({
        filePath,
        contentType,
        dryRun: options.dryRun,
        verbose: options.verbose,
        onProgress: (msg) => console.log(chalk.gray(`   ${msg}`))
      });

      results.push(result);

      // 결과 출력
      if (result.enhanced) {
        console.log('');
        console.log(chalk.green('✅ 향상 완료'));
        console.log(`   클리셰 제거: ${result.changes.clichesRemoved}개`);
        console.log(`   디테일 추가: ${result.changes.detailsAdded}개`);

        if (result.originalAnalysis && result.finalAnalysis) {
          console.log(`   점수 변화: ${result.originalAnalysis.personaAlignment}% → ${result.finalAnalysis.personaAlignment}%`);
        }
      } else {
        console.log(chalk.green('\n✅ 이미 고품질 콘텐츠입니다. 향상 불필요.'));
      }

      // 경고
      if (result.warnings.length > 0) {
        console.log(chalk.yellow('\n⚠️ 경고:'));
        for (const warning of result.warnings) {
          console.log(`   - ${warning}`);
        }
      }

      console.log('\n');
    } catch (error) {
      console.log(chalk.red(`\n오류: ${error instanceof Error ? error.message : error}`));
      console.log('\n');
    }
  }

  // 요약
  printSummary(results);
}

// ============================================================================
// 유틸리티
// ============================================================================

async function getTargetFiles(options: EnhanceOptions): Promise<string[]> {
  const draftsDir = join(process.cwd(), 'drafts');

  if (options.file) {
    // 특정 파일
    const filePath = options.file.startsWith('drafts/')
      ? join(process.cwd(), options.file)
      : options.file.includes('/')
        ? options.file
        : join(draftsDir, options.file);

    return [filePath];
  }

  if (options.all) {
    // 모든 드래프트
    try {
      const entries = await readdir(draftsDir);
      const mdFiles: string[] = [];

      for (const entry of entries) {
        if (entry.endsWith('.md')) {
          mdFiles.push(join(draftsDir, entry));
        }
      }

      return mdFiles;
    } catch {
      return [];
    }
  }

  // 기본: 가장 최근 드래프트
  try {
    const entries = await readdir(draftsDir);
    const mdFiles: Array<{ path: string; mtime: Date }> = [];

    for (const entry of entries) {
      if (entry.endsWith('.md')) {
        const filePath = join(draftsDir, entry);
        const stats = await stat(filePath);
        mdFiles.push({ path: filePath, mtime: stats.mtime });
      }
    }

    if (mdFiles.length === 0) return [];

    // 가장 최근 파일
    mdFiles.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
    return [mdFiles[0].path];
  } catch {
    return [];
  }
}

function detectContentType(filePath: string): 'travel' | 'culture' {
  const filename = filePath.toLowerCase();

  // 문화 키워드
  const cultureKeywords = ['전시', '미술', '공연', '뮤지컬', '콘서트', '갤러리', '박물관'];
  for (const keyword of cultureKeywords) {
    if (filename.includes(keyword)) {
      return 'culture';
    }
  }

  return 'travel';
}

function printSummary(results: EnhanceResult[]): void {
  console.log(chalk.cyan('═'.repeat(50)));
  console.log(chalk.cyan.bold('📊 향상 결과 요약'));
  console.log(chalk.cyan('═'.repeat(50)));

  const enhanced = results.filter(r => r.enhanced);
  const unchanged = results.filter(r => !r.enhanced);
  const failed = results.filter(r => !r.success);

  console.log(`   처리: ${results.length}개 파일`);
  console.log(`   향상됨: ${chalk.green(enhanced.length + '개')}`);
  console.log(`   변경 불필요: ${chalk.gray(unchanged.length + '개')}`);

  if (failed.length > 0) {
    console.log(`   실패: ${chalk.red(failed.length + '개')}`);
  }

  // 총 변경 사항
  if (enhanced.length > 0) {
    const totalCliches = enhanced.reduce((sum, r) => sum + r.changes.clichesRemoved, 0);
    const totalDetails = enhanced.reduce((sum, r) => sum + r.changes.detailsAdded, 0);

    console.log('');
    console.log('   총 변경:');
    console.log(`   - 클리셰 제거: ${totalCliches}개`);
    console.log(`   - 디테일 추가: ${totalDetails}개`);
  }

  console.log('');
}

export default enhanceCommand;
