/**
 * 통합 워크플로우 CLI 명령어
 * stages.ts의 runFullValidation을 래핑
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { readFile } from 'fs/promises';
import { glob } from 'glob';
import matter from 'gray-matter';

// 통합 검증 모듈 (단일 진실의 원천)
import {
  runFullValidation,
  FullValidationResult,
  calculateAverageScore,
  ValidationStageOptions
} from '../../workflow/stages.js';

// Moltbook 연동 (발행 후 공유용)
import { loadMoltbookConfig, MoltbookFeedbackLoop } from '../../agents/moltbook/index.js';

// WorkflowResult는 stages.ts의 FullValidationResult를 사용
type WorkflowResult = FullValidationResult;

export const workflowCommand = new Command('workflow')
  .description('통합 품질 검증 워크플로우')
  .argument('[mode]', 'full: 전체 파이프라인, quick: 필수 검증만, enhance: 향상 포함', 'full')
  .option('-f, --file <path>', '검증할 파일')
  .option('-a, --all', '모든 초안 검증')
  .option('--enhance', '콘텐츠 향상 실행 (페르소나 + 클리셰 제거)')
  .option('--enhance-only', '향상만 실행 (검증 없이)')
  .option('--draft', 'Moltbook Draft 포함')
  .option('--apply', 'AEO 요소 자동 적용')
  .option('--auto-fix', '자동 수정 가능한 항목 수정')
  .option('-v, --verbose', '상세 출력')
  .option('--json', 'JSON 형식 출력')
  .action(async (mode, options) => {
    const isQuickMode = mode === 'quick';
    const isEnhanceMode = mode === 'enhance' || options.enhance || options.enhanceOnly;
    const modeLabel = options.enhanceOnly ? 'Enhance Only' : (isQuickMode ? 'Quick' : (isEnhanceMode ? 'Full+Enhance' : 'Full'));

    console.log(chalk.cyan(`\n🔄 통합 워크플로우 (${modeLabel} 모드)\n`));

    try {
      let filePaths: string[] = [];

      // 파일 경로 결정
      if (options.file) {
        filePaths = [options.file];
      } else if (options.all) {
        filePaths = await glob('drafts/**/*.md');

        if (filePaths.length === 0) {
          console.log(chalk.yellow('검증할 초안 파일이 없습니다.'));
          return;
        }

        console.log(chalk.white(`발견된 초안: ${filePaths.length}개\n`));
      } else {
        // 파일 선택
        const draftFiles = await glob('drafts/**/*.md');

        if (draftFiles.length === 0) {
          console.log(chalk.yellow('초안 파일이 없습니다.'));
          return;
        }

        const { selectedFile } = await inquirer.prompt([{
          type: 'list',
          name: 'selectedFile',
          message: '검증할 초안 선택:',
          choices: draftFiles.map(f => ({ name: f, value: f }))
        }]);

        filePaths = [selectedFile];
      }

      const results: WorkflowResult[] = [];

      for (const filePath of filePaths) {
        // 스피너 생성
        const spinner = ora('검증 중...').start();

        // stages.ts의 runFullValidation 사용 (단일 진실의 원천)
        const result = await runFullValidation(filePath, {
          mode: options.enhanceOnly ? 'enhance-only' : (isQuickMode ? 'quick' : 'full'),
          includeEnhance: isEnhanceMode || options.enhance,
          includeFactcheck: true,
          includeQuality: true,
          includeAEO: true,
          includeImage: true,
          applyAEO: options.apply,
          autoFix: options.autoFix,
          verbose: options.verbose,
          onProgress: (stage, msg) => {
            spinner.text = `[${stage}] ${msg}`;
          }
        });

        spinner.stop();
        results.push(result);

        // Moltbook Draft 공유 (선택적)
        if (options.draft && result.canPublish) {
          await shareToDraftMoltbook(filePath, result);
        }

        // 결과 요약 출력
        printWorkflowSummary(result);
      }

      // 전체 요약
      if (results.length > 1) {
        printOverallSummary(results);
      }

      // JSON 출력
      if (options.json) {
        console.log(JSON.stringify(results, null, 2));
      }

    } catch (error) {
      console.error(chalk.red('\n❌ 워크플로우 실패:'), error);
      process.exit(1);
    }
  });

/**
 * Moltbook Draft 공유 헬퍼
 */
async function shareToDraftMoltbook(
  filePath: string,
  result: FullValidationResult
): Promise<void> {
  const spinner = ora('Moltbook Draft 공유 중...').start();

  try {
    const config = await loadMoltbookConfig();
    if (!config || !config.apiKey) {
      spinner.info(chalk.gray('Moltbook 미설정 - 건너뜀'));
      return;
    }

    const content = await readFile(filePath, 'utf-8');
    const { data: frontmatter } = matter(content);

    const loop = new MoltbookFeedbackLoop(config);
    const topics = [...(frontmatter.tags || []), ...(frontmatter.keywords || [])] as string[];
    const summary = content.replace(/^#.*$/gm, '').trim().slice(0, 500) + '...';

    const draftResult = await loop.shareDraft({
      title: result.title,
      summary,
      filePath,
      category: result.contentType,
      topics
    });

    if (draftResult) {
      spinner.succeed(chalk.green(`Moltbook Draft 공유 완료 (ID: ${draftResult.postId})`));
      result.recommendations.push('[Moltbook] 12-24시간 후 npm run moltbook draft-feedback 실행');
    } else {
      spinner.fail(chalk.yellow('Moltbook Draft 공유 실패'));
    }
  } catch (error) {
    spinner.fail(chalk.red('Moltbook Draft 오류'));
  }
}

/**
 * 워크플로우 결과 요약 출력
 */
function printWorkflowSummary(result: FullValidationResult): void {
  console.log(chalk.cyan(`\n📋 ${result.title}`));
  console.log(chalk.gray(`   ${result.filePath}`));
  console.log(chalk.gray(`   ${'─'.repeat(50)}`));

  // 단계별 결과
  for (const stage of result.stages) {
    const icon = stage.status === 'passed' ? '✓' :
                 stage.status === 'warning' ? '⚠' :
                 stage.status === 'skipped' ? '○' : '✗';
    const color = stage.status === 'passed' ? 'green' :
                  stage.status === 'warning' ? 'yellow' :
                  stage.status === 'skipped' ? 'gray' : 'red';

    let line = `   ${icon} ${stage.name}`;
    if (stage.score !== undefined) {
      line += ` (${stage.score}%)`;
    }
    if (stage.details) {
      line += ` - ${stage.details}`;
    }

    console.log(chalk[color](line));
  }

  console.log(chalk.gray(`   ${'─'.repeat(50)}`));

  // 평균 점수
  const avgScore = calculateAverageScore(result.stages);
  console.log(chalk.white(`   평균 점수: ${avgScore}%`));

  // 최종 판정
  if (result.canPublish) {
    console.log(chalk.green('   ✅ 발행 가능'));
  } else if (result.needsReview) {
    console.log(chalk.yellow('   ⚠️ 검토 필요'));
  } else {
    console.log(chalk.red('   🚫 발행 차단'));
  }

  // 경고
  if (result.warnings.length > 0) {
    console.log(chalk.yellow('\n   ⚠️ 경고:'));
    for (const warn of result.warnings.slice(0, 3)) {
      console.log(chalk.yellow(`   - ${warn}`));
    }
  }

  // 권장 사항
  if (result.recommendations.length > 0) {
    console.log(chalk.gray('\n   💡 권장 사항:'));
    for (const rec of result.recommendations.slice(0, 5)) {
      console.log(chalk.gray(`   - ${rec}`));
    }
    if (result.recommendations.length > 5) {
      console.log(chalk.gray(`   ... 외 ${result.recommendations.length - 5}개`));
    }
  }

  console.log('');
}

/**
 * 전체 요약 출력
 */
function printOverallSummary(results: FullValidationResult[]): void {
  console.log(chalk.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.cyan('📊 통합 워크플로우 요약'));
  console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

  const publishable = results.filter(r => r.canPublish).length;
  const needsReview = results.filter(r => r.needsReview && !r.canPublish).length;
  const blocked = results.filter(r => !r.canPublish && !r.needsReview).length;

  // 전체 평균 점수
  const totalAvg = results.length > 0
    ? Math.round(results.reduce((sum, r) => sum + calculateAverageScore(r.stages), 0) / results.length)
    : 0;

  console.log(chalk.white(`총 검증 파일: ${results.length}개`));
  console.log(chalk.white(`전체 평균 점수: ${totalAvg}%`));
  console.log('');
  console.log(chalk.green(`  ✅ 발행 가능: ${publishable}개`));
  console.log(chalk.yellow(`  ⚠️ 검토 필요: ${needsReview}개`));
  console.log(chalk.red(`  🚫 발행 차단: ${blocked}개`));

  // 흐름 안내
  console.log(chalk.gray('\n📋 검증 흐름: Factcheck → Enhance → Quality → AEO → Image'));

  console.log(chalk.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
}
