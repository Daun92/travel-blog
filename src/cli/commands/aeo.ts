/**
 * AEO CLI 명령어
 * AI Engine Optimization
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { glob } from 'glob';
import ora from 'ora';
import { writeFile } from 'fs/promises';
import {
  processAEO,
  applyAEOToFile,
  analyzeAEO,
  AEOResult
} from '../../aeo/index.js';
import { validatePostImages, PostImageValidationResult } from '../../images/image-validator.js';

export const aeoCommand = new Command('aeo')
  .description('AI Engine Optimization (FAQ, Schema.org 생성)')
  .option('-f, --file <path>', '단일 파일 처리')
  .option('-a, --all', '모든 초안 파일 처리')
  .option('-d, --drafts', 'drafts/ 폴더의 모든 파일')
  .option('--analyze', '분석만 (적용 없음)')
  .option('--apply', 'AEO 요소 파일에 적용')
  .option('--faq-count <count>', 'FAQ 생성 개수', '5')
  .option('--no-faq', 'FAQ 생성 건너뛰기')
  .option('--no-schema', 'Schema 생성 건너뛰기')
  .option('--check-images', '이미지 검증 포함')
  .option('-o, --output <path>', '결과 출력 경로')
  .option('-v, --verbose', '상세 출력')
  .option('--json', 'JSON 형식 출력')
  .action(async (options) => {
    console.log(chalk.cyan('\n🔍 AEO (AI Engine Optimization) 처리 시작...\n'));

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
          console.log(chalk.yellow('처리할 파일이 없습니다.'));
          return;
        }

        console.log(chalk.white(`발견된 파일: ${filePaths.length}개\n`));
      } else {
        console.log(chalk.yellow('파일을 지정해주세요. --file <path> 또는 --all/--drafts'));
        return;
      }

      const results: AEOResult[] = [];
      const imageResults: PostImageValidationResult[] = [];

      // 분석 모드
      if (options.analyze) {
        console.log(chalk.cyan('📊 AEO 분석 모드\n'));

        for (const filePath of filePaths) {
          const analysis = await analyzeAEO(filePath);

          const scoreColor = analysis.currentScore >= 80 ? 'green'
            : analysis.currentScore >= 50 ? 'yellow'
              : 'red';

          console.log(chalk.white(`${filePath}`));
          console.log(chalk[scoreColor](`  AEO 점수: ${analysis.currentScore}%`));

          if (analysis.improvements.length > 0) {
            console.log(chalk.gray('  개선 사항:'));
            for (const improvement of analysis.improvements) {
              console.log(chalk.gray(`    - ${improvement}`));
            }
          }
          console.log('');
        }

        return;
      }

      // 처리 모드
      for (const filePath of filePaths) {
        const spinner = ora(`처리 중: ${filePath}`).start();

        try {
          // AEO 처리
          const result = await processAEO(filePath, {
            faqCount: parseInt(options.faqCount, 10),
            includeFAQSchema: options.faq !== false,
            includeArticleSchema: options.schema !== false,
            includeLocationSchema: options.schema !== false,
            includeEventSchema: options.schema !== false,
            includeBreadcrumbSchema: options.schema !== false
          });

          results.push(result);

          // 이미지 검증 (옵션)
          if (options.checkImages) {
            const imageResult = await validatePostImages(filePath);
            imageResults.push(imageResult);
          }

          // 파일에 적용
          if (options.apply) {
            await applyAEOToFile(filePath, result, {
              addFaqSection: true,
              addSchemaToFrontmatter: true
            });
            spinner.succeed(chalk.green(`적용 완료: ${filePath} (FAQ: ${result.faqsAdded}, Schema: ${result.schemasAdded})`));
          } else {
            spinner.succeed(chalk.blue(`분석 완료: ${filePath} (FAQ: ${result.faqsAdded}, Schema: ${result.schemasAdded})`));
          }

          // 상세 출력
          if (options.verbose) {
            console.log(formatAEOResult(result, options.checkImages ? imageResults[imageResults.length - 1] : undefined));
          }

        } catch (error) {
          spinner.fail(chalk.red(`오류: ${filePath}`));
          console.error(chalk.red(`  ${error instanceof Error ? error.message : error}`));
        }
      }

      // 요약 출력
      console.log(chalk.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
      console.log(chalk.cyan('📊 AEO 처리 요약'));
      console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

      console.log(chalk.white(`처리된 파일: ${results.length}개`));

      const totalFaqs = results.reduce((sum, r) => sum + r.faqsAdded, 0);
      const totalSchemas = results.reduce((sum, r) => sum + r.schemasAdded, 0);

      console.log(chalk.green(`  생성된 FAQ: ${totalFaqs}개`));
      console.log(chalk.green(`  생성된 Schema: ${totalSchemas}개`));

      if (options.checkImages && imageResults.length > 0) {
        const avgImageScore = imageResults.reduce((sum, r) => sum + r.overallScore, 0) / imageResults.length;
        const imageIssueCount = imageResults.filter(r => !r.passesGate).length;

        console.log(chalk.white(`\n이미지 검증:`));
        console.log(chalk.white(`  평균 점수: ${avgImageScore.toFixed(0)}%`));
        if (imageIssueCount > 0) {
          console.log(chalk.yellow(`  문제 발견: ${imageIssueCount}개 파일`));
        }
      }

      if (!options.apply) {
        console.log(chalk.gray('\n(--apply 옵션으로 파일에 적용할 수 있습니다)'));
      }

      // JSON 출력
      if (options.json) {
        const output = {
          results,
          imageResults: options.checkImages ? imageResults : undefined,
          summary: {
            totalFiles: results.length,
            totalFaqs,
            totalSchemas
          }
        };

        const jsonOutput = JSON.stringify(output, null, 2);

        if (options.output) {
          await writeFile(options.output, jsonOutput);
          console.log(chalk.green(`\n결과 저장: ${options.output}`));
        } else {
          console.log('\n' + jsonOutput);
        }
      }

      console.log(chalk.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

    } catch (error) {
      console.error(chalk.red('\n❌ AEO 처리 실패:'), error);
      process.exit(1);
    }
  });

/**
 * AEO 결과 포맷팅
 */
function formatAEOResult(
  result: AEOResult,
  imageResult?: PostImageValidationResult
): string {
  const lines: string[] = [];

  lines.push(chalk.cyan(`\n  📋 ${result.title}`));
  lines.push(chalk.gray(`  ${'─'.repeat(40)}`));

  // FAQ
  if (result.faqs.length > 0) {
    lines.push(chalk.green(`  ✓ FAQ ${result.faqsAdded}개 생성`));
    for (const faq of result.faqs.slice(0, 3)) {
      lines.push(chalk.gray(`    Q: ${faq.question.slice(0, 50)}...`));
    }
    if (result.faqs.length > 3) {
      lines.push(chalk.gray(`    ... 외 ${result.faqs.length - 3}개`));
    }
  } else if (result.hasExistingFAQs) {
    lines.push(chalk.blue(`  ℹ 기존 FAQ 있음`));
  }

  // Schema
  if (result.schemasAdded > 0) {
    lines.push(chalk.green(`  ✓ Schema ${result.schemasAdded}개 생성`));
    for (const schema of result.schemas) {
      lines.push(chalk.gray(`    - ${schema['@type']}`));
    }
  } else if (result.hasExistingSchema) {
    lines.push(chalk.blue(`  ℹ 기존 Schema 있음`));
  }

  // 이미지 검증 결과
  if (imageResult) {
    lines.push('');
    const imgColor = imageResult.passesGate ? 'green' : 'yellow';
    lines.push(chalk[imgColor](`  이미지 점수: ${imageResult.overallScore}%`));

    if (imageResult.recommendations.length > 0) {
      for (const rec of imageResult.recommendations.slice(0, 2)) {
        lines.push(chalk.gray(`    - ${rec}`));
      }
    }
  }

  return lines.join('\n');
}
