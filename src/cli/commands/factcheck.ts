/**
 * 팩트체크 CLI 명령어
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { glob } from 'glob';
import { writeFile } from 'fs/promises';
import ora from 'ora';
import {
  factCheckFile,
  factCheckFiles,
  summarizeReport,
  FactCheckReport
} from '../../factcheck/index.js';

export const factcheckCommand = new Command('factcheck')
  .description('포스트의 사실관계를 검증합니다')
  .option('-f, --file <path>', '단일 파일 검증')
  .option('-a, --all', '모든 초안 파일 검증')
  .option('-d, --drafts', 'drafts/ 폴더의 모든 파일 검증')
  .option('-o, --output <path>', '보고서 출력 경로')
  .option('-v, --verbose', '상세 출력')
  .option('--json', 'JSON 형식으로 출력')
  .option('--threshold <number>', '최소 점수 기준 (기본: 80)', '80')
  .option('--no-block', '점수 미달 시에도 발행 차단하지 않음')
  .action(async (options) => {
    console.log(chalk.cyan('\n🔍 팩트체크 시작...\n'));

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

      // 팩트체크 실행
      const reports: FactCheckReport[] = [];
      let blockedCount = 0;
      let passedCount = 0;
      let reviewCount = 0;

      for (const filePath of filePaths) {
        const spinner = ora(`검증 중: ${filePath}`).start();

        try {
          const report = await factCheckFile(filePath, {
            verbose: options.verbose,
            onProgress: (current, total, claim) => {
              spinner.text = `검증 중: ${filePath} (${current}/${total}) - ${claim.type}`;
            }
          });

          reports.push(report);

          // 결과 표시
          if (report.blockPublish) {
            spinner.fail(chalk.red(`차단: ${filePath} (${report.overallScore}%)`));
            blockedCount++;
          } else if (report.needsHumanReview) {
            spinner.warn(chalk.yellow(`검토 필요: ${filePath} (${report.overallScore}%)`));
            reviewCount++;
          } else {
            spinner.succeed(chalk.green(`통과: ${filePath} (${report.overallScore}%)`));
            passedCount++;
          }

          // 상세 출력
          if (options.verbose) {
            console.log(summarizeReport(report));
          }

        } catch (error) {
          spinner.fail(chalk.red(`오류: ${filePath}`));
          console.error(chalk.red(`  ${error instanceof Error ? error.message : error}`));
        }
      }

      // 요약 출력
      console.log(chalk.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
      console.log(chalk.cyan('📊 팩트체크 요약'));
      console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

      console.log(chalk.white(`총 검증 파일: ${reports.length}개`));
      console.log(chalk.green(`  ✓ 통과: ${passedCount}개`));
      console.log(chalk.yellow(`  ⚠ 검토 필요: ${reviewCount}개`));
      console.log(chalk.red(`  ✗ 차단: ${blockedCount}개`));

      // 전체 통계
      const totalClaims = reports.reduce((sum, r) => sum + r.claims.total, 0);
      const totalVerified = reports.reduce((sum, r) => sum + r.claims.verified, 0);
      const totalFalse = reports.reduce((sum, r) => sum + r.claims.false, 0);
      const totalUnknown = reports.reduce((sum, r) => sum + r.claims.unknown, 0);

      console.log(chalk.white(`\n클레임 통계:`));
      console.log(chalk.white(`  총 클레임: ${totalClaims}개`));
      console.log(chalk.green(`  확인됨: ${totalVerified}개 (${totalClaims > 0 ? Math.round(totalVerified / totalClaims * 100) : 0}%)`));
      console.log(chalk.red(`  거짓: ${totalFalse}개 (${totalClaims > 0 ? Math.round(totalFalse / totalClaims * 100) : 0}%)`));
      console.log(chalk.yellow(`  미확인: ${totalUnknown}개 (${totalClaims > 0 ? Math.round(totalUnknown / totalClaims * 100) : 0}%)`));

      // JSON 출력
      if (options.json) {
        const jsonOutput = JSON.stringify(reports, null, 2);

        if (options.output) {
          await writeFile(options.output, jsonOutput);
          console.log(chalk.green(`\n보고서 저장: ${options.output}`));
        } else {
          console.log('\n' + jsonOutput);
        }
      }

      // 보고서 파일 저장
      if (options.output && !options.json) {
        const reportContent = reports.map(r => summarizeReport(r)).join('\n');
        await writeFile(options.output, reportContent);
        console.log(chalk.green(`\n보고서 저장: ${options.output}`));
      }

      // 종료 코드
      if (blockedCount > 0 && options.block !== false) {
        console.log(chalk.red('\n⚠️ 일부 파일이 품질 기준을 통과하지 못했습니다.'));
        process.exit(1);
      }

      console.log(chalk.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

    } catch (error) {
      console.error(chalk.red('\n❌ 팩트체크 실패:'), error);
      process.exit(1);
    }
  });
