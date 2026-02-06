/**
 * 품질 검증 CLI 명령어
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { glob } from 'glob';
import { writeFile } from 'fs/promises';
import ora from 'ora';
import {
  validateFile,
  ValidationResult,
  getPendingCases,
  updateReviewCase,
  cleanupOldCases
} from '../../quality/index.js';

export const validateCommand = new Command('validate')
  .description('포스트의 품질을 검증합니다')
  .option('-f, --file <path>', '단일 파일 검증')
  .option('-a, --all', '모든 초안 파일 검증')
  .option('-d, --drafts', 'drafts/ 폴더의 모든 파일 검증')
  .option('--check-duplicate', '중복 검사만 실행')
  .option('--skip-factcheck', '팩트체크 건너뛰기')
  .option('-o, --output <path>', '보고서 출력 경로')
  .option('-v, --verbose', '상세 출력')
  .option('--json', 'JSON 형식으로 출력')
  .option('--all-gates', '모든 확장 게이트 실행 (가독성, 톤, 구조, 키워드)')
  .option('--readability', '가독성 검사')
  .option('--tone', '톤/어조 일관성 검사')
  .option('--structure', '구조 완성도 검사')
  .option('--keyword-density', '키워드 밀도 검사')
  .option('--type <type>', '콘텐츠 유형 (travel|culture)', 'travel')
  .action(async (options) => {
    console.log(chalk.cyan('\n🔍 품질 검증 시작...\n'));

    try {
      let filePaths: string[] = [];

      // 파일 경로 결정
      if (options.file) {
        filePaths = [options.file];
      } else if (options.all || options.drafts) {
        const pattern = options.drafts
          ? 'drafts/**/*.md'
          : '{drafts,blog/content/posts}/**/*.md';

        filePaths = await glob(pattern);

        if (filePaths.length === 0) {
          console.log(chalk.yellow('검증할 파일이 없습니다.'));
          return;
        }

        console.log(chalk.white(`발견된 파일: ${filePaths.length}개\n`));
      } else {
        console.log(chalk.yellow('파일을 지정해주세요. --file <path> 또는 --all/--drafts'));
        return;
      }

      // 검증 실행
      const results: ValidationResult[] = [];
      let passedCount = 0;
      let blockedCount = 0;
      let reviewCount = 0;

      for (const filePath of filePaths) {
        const spinner = ora(`검증 중: ${filePath}`).start();

        try {
          const result = await validateFile(filePath, {
            skipFactCheck: options.skipFactcheck,
            skipDuplicateCheck: !options.checkDuplicate && !options.all,
            verbose: options.verbose,
            allGates: options.allGates,
            readability: options.readability,
            tone: options.tone,
            structure: options.structure,
            keywordDensity: options.keywordDensity,
            contentType: options.type as 'travel' | 'culture'
          });

          results.push(result);

          // 결과 표시
          if (result.blockPublish) {
            spinner.fail(chalk.red(`차단: ${filePath}`));
            blockedCount++;
          } else if (result.needsHumanReview) {
            spinner.warn(chalk.yellow(`검토 필요: ${filePath}`));
            reviewCount++;
          } else if (result.overallPassed) {
            spinner.succeed(chalk.green(`통과: ${filePath}`));
            passedCount++;
          } else {
            spinner.warn(chalk.yellow(`경고: ${filePath}`));
            passedCount++;
          }

          // 상세 출력
          if (options.verbose) {
            console.log(formatValidationResult(result));
          }

        } catch (error) {
          spinner.fail(chalk.red(`오류: ${filePath}`));
          console.error(chalk.red(`  ${error instanceof Error ? error.message : error}`));
        }
      }

      // 요약 출력
      console.log(chalk.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
      console.log(chalk.cyan('📊 품질 검증 요약'));
      console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

      console.log(chalk.white(`총 검증 파일: ${results.length}개`));
      console.log(chalk.green(`  ✓ 통과: ${passedCount}개`));
      console.log(chalk.yellow(`  ⚠ 검토 필요: ${reviewCount}개`));
      console.log(chalk.red(`  ✗ 차단: ${blockedCount}개`));

      // 게이트별 통계
      const gateStats = calculateGateStats(results);
      console.log(chalk.white('\n게이트별 결과:'));
      for (const [gateName, stats] of Object.entries(gateStats)) {
        const avgScore = stats.totalScore / stats.count || 0;
        const passRate = (stats.passed / stats.count * 100) || 0;
        console.log(chalk.white(`  ${gateName}: 평균 ${avgScore.toFixed(0)}%, 통과율 ${passRate.toFixed(0)}%`));
      }

      // JSON 출력
      if (options.json) {
        const jsonOutput = JSON.stringify(results, null, 2);

        if (options.output) {
          await writeFile(options.output, jsonOutput);
          console.log(chalk.green(`\n보고서 저장: ${options.output}`));
        } else {
          console.log('\n' + jsonOutput);
        }
      }

      // 종료 코드
      if (blockedCount > 0) {
        console.log(chalk.red('\n⚠️ 일부 파일이 품질 기준을 통과하지 못했습니다.'));
        process.exit(1);
      }

      console.log(chalk.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

    } catch (error) {
      console.error(chalk.red('\n❌ 품질 검증 실패:'), error);
      process.exit(1);
    }
  });

// 사람 검토 대기열 명령어
export const reviewHumanCommand = new Command('review:human')
  .description('사람 검토 대기열 관리')
  .option('-l, --list', '대기 중인 케이스 목록')
  .option('--approve <id>', '케이스 승인')
  .option('--reject <id>', '케이스 거부')
  .option('--note <note>', '검토자 노트')
  .option('--cleanup', '오래된 케이스 정리')
  .action(async (options) => {
    console.log(chalk.cyan('\n👤 사람 검토 대기열\n'));

    try {
      if (options.cleanup) {
        const removed = await cleanupOldCases();
        console.log(chalk.green(`${removed}개의 오래된 케이스 정리 완료`));
        return;
      }

      if (options.approve) {
        const updated = await updateReviewCase(options.approve, 'approved', options.note);
        if (updated) {
          console.log(chalk.green(`케이스 승인됨: ${updated.id}`));
        } else {
          console.log(chalk.red('케이스를 찾을 수 없습니다.'));
        }
        return;
      }

      if (options.reject) {
        const updated = await updateReviewCase(options.reject, 'rejected', options.note);
        if (updated) {
          console.log(chalk.yellow(`케이스 거부됨: ${updated.id}`));
        } else {
          console.log(chalk.red('케이스를 찾을 수 없습니다.'));
        }
        return;
      }

      // 기본: 목록 표시
      const cases = await getPendingCases();

      if (cases.length === 0) {
        console.log(chalk.gray('검토 대기 중인 케이스가 없습니다.'));
        return;
      }

      console.log(chalk.white(`대기 중인 케이스: ${cases.length}개\n`));

      for (const c of cases) {
        const triggerColor = c.trigger === 'critical_false' ? 'red'
          : c.trigger === 'score_50_70' ? 'yellow'
            : 'white';

        console.log(chalk[triggerColor](`[${c.id}] ${c.title}`));
        console.log(chalk.gray(`  파일: ${c.filePath}`));
        console.log(chalk.gray(`  트리거: ${c.trigger}, 점수: ${c.score}%`));
        console.log(chalk.gray(`  생성: ${c.createdAt}`));
        console.log(chalk.gray(`  상세: ${c.details}`));
        console.log('');
      }

      console.log(chalk.cyan('사용법:'));
      console.log(chalk.gray('  npm run review:human -- --approve <id> [--note "메모"]'));
      console.log(chalk.gray('  npm run review:human -- --reject <id> [--note "사유"]'));

    } catch (error) {
      console.error(chalk.red('오류:'), error);
    }
  });

/**
 * 검증 결과 포맷팅
 */
function formatValidationResult(result: ValidationResult): string {
  const lines: string[] = [];

  lines.push(chalk.cyan(`\n  📋 ${result.title}`));
  lines.push(chalk.gray(`  ${'─'.repeat(40)}`));

  for (const gate of result.gates) {
    const statusIcon = gate.passed ? '✓' : '✗';
    const statusColor = gate.passed ? 'green' : (gate.blockOnFailure ? 'red' : 'yellow');

    lines.push(chalk[statusColor](`  ${statusIcon} ${gate.name}: ${gate.score}% (기준: ${gate.threshold}%)`));

    if (gate.details && !gate.passed) {
      lines.push(chalk.gray(`    └ ${gate.details}`));
    }
  }

  if (result.warnings.length > 0) {
    lines.push(chalk.yellow(`\n  경고:`));
    for (const warning of result.warnings.slice(0, 3)) {
      lines.push(chalk.yellow(`    - ${warning}`));
    }
    if (result.warnings.length > 3) {
      lines.push(chalk.gray(`    ... 외 ${result.warnings.length - 3}개`));
    }
  }

  if (result.errors.length > 0) {
    lines.push(chalk.red(`\n  오류:`));
    for (const error of result.errors) {
      lines.push(chalk.red(`    - ${error}`));
    }
  }

  return lines.join('\n');
}

/**
 * 게이트별 통계 계산
 */
function calculateGateStats(results: ValidationResult[]): Record<string, {
  count: number;
  passed: number;
  totalScore: number;
}> {
  const stats: Record<string, { count: number; passed: number; totalScore: number }> = {};

  for (const result of results) {
    for (const gate of result.gates) {
      if (!stats[gate.name]) {
        stats[gate.name] = { count: 0, passed: 0, totalScore: 0 };
      }

      stats[gate.name].count++;
      stats[gate.name].totalScore += gate.score;
      if (gate.passed) {
        stats[gate.name].passed++;
      }
    }
  }

  return stats;
}
