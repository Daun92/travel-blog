/**
 * 실용 링크 처리 CLI 명령어
 * 드래프트 파일의 링크 마커를 실제 URL로 변환
 */

import { readFile, writeFile, readdir } from 'fs/promises';
import { join, basename } from 'path';
import chalk from 'chalk';
import {
  processAllLinks,
  analyzeLinkMarkers,
  analyzePlaceholderLinks,
  enhanceWithLinks,
  type LinkAnalysis
} from '../../generator/link-processor.js';

interface LinksCommandOptions {
  file?: string;
  all?: boolean;
  published?: boolean;
  enhance?: boolean;
  dryRun?: boolean;
  verbose?: boolean;
}

/**
 * 링크 처리 명령어 핸들러
 */
export async function linksCommand(options: LinksCommandOptions): Promise<void> {
  console.log(chalk.cyan('\n🔗 실용 링크 처리\n'));

  const draftsDir = join(process.cwd(), 'drafts');
  const publishedDir = join(process.cwd(), 'blog', 'content', 'posts');

  try {
    if (options.file) {
      // 단일 파일 처리
      const filepath = options.file.includes('/') || options.file.includes('\\')
        ? options.file
        : join(draftsDir, options.file);
      await processFile(filepath, options);
    } else if (options.all || options.published) {
      // 드래프트 처리
      if (options.all) {
        console.log(chalk.white('📁 드래프트 폴더'));
        await processAllFiles(draftsDir, options);
      }

      // 발행된 포스트 처리
      if (options.published) {
        console.log(chalk.white('\n📁 발행된 포스트'));
        await processAllFiles(publishedDir, options, true);
      }
    } else {
      // 옵션 없으면 도움말
      console.log(chalk.yellow('사용법:'));
      console.log('  npm run links -- -f <파일명>       단일 파일 처리');
      console.log('  npm run links -- --all             전체 드래프트 처리');
      console.log('  npm run links -- --published       발행된 포스트 처리');
      console.log('  npm run links -- --all --published 드래프트 + 발행 모두');
      console.log('  npm run links -- --all --dry-run   미리보기 (저장 안함)');
      console.log('  npm run links -- -f <파일> -v      상세 출력');
      console.log('');
      console.log(chalk.cyan('AI 기반 장소 추출:'));
      console.log('  npm run links -- --published --enhance    발행 포스트에 링크 자동 추가');
      console.log('  npm run links -- -f <파일> --enhance      단일 파일 AI 링크 추가');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(`\n오류: ${message}`));
    process.exit(1);
  }
}

/**
 * 단일 파일 처리
 */
async function processFile(filepath: string, options: LinksCommandOptions): Promise<boolean> {
  const filename = basename(filepath);

  // 파일 읽기
  let content: string;
  try {
    content = await readFile(filepath, 'utf-8');
  } catch {
    console.error(chalk.red(`파일을 찾을 수 없습니다: ${filepath}`));
    return false;
  }

  // 링크 분석 (마커 + 플레이스홀더)
  const markerAnalysis = analyzeLinkMarkers(content);
  const placeholderCount = analyzePlaceholderLinks(content);
  const totalLinks = markerAnalysis.totalMarkers + placeholderCount;

  // --enhance 모드: AI로 장소 추출
  if (options.enhance) {
    console.log(chalk.white(`📄 ${filename}`));
    console.log(chalk.cyan(`   🤖 AI 장소 추출 중...`));

    const enhanceResult = await enhanceWithLinks(content);

    if (enhanceResult.places.length === 0) {
      console.log(chalk.gray(`   추출된 장소 없음`));
      return false;
    }

    console.log(chalk.gray(`   ${enhanceResult.places.length}개 장소 감지`));

    if (enhanceResult.added.length > 0) {
      console.log(chalk.green(`   ✓ ${enhanceResult.added.length}개 링크 추가`));
      if (options.verbose) {
        for (const place of enhanceResult.added) {
          console.log(chalk.gray(`     → ${place}`));
        }
      }
    }

    if (enhanceResult.skipped.length > 0 && options.verbose) {
      console.log(chalk.gray(`   스킵 (이미 링크 있음): ${enhanceResult.skipped.length}개`));
    }

    if (enhanceResult.added.length === 0) {
      console.log(chalk.yellow(`   추가할 링크 없음 (이미 모두 링크됨)`));
      return false;
    }

    // 저장
    if (!options.dryRun) {
      await writeFile(filepath, enhanceResult.content, 'utf-8');
      console.log(chalk.green(`   ✓ 저장 완료`));
    } else {
      console.log(chalk.yellow(`   (dry-run: 저장 안함)`));
    }

    return true;
  }

  // 일반 모드: 마커/플레이스홀더 처리
  if (totalLinks === 0) {
    console.log(chalk.gray(`  ${filename}: 링크 마커 없음`));
    return false;
  }

  console.log(chalk.white(`📄 ${filename}`));
  if (markerAnalysis.totalMarkers > 0) {
    console.log(chalk.gray(`   [LINK:...] 마커: ${markerAnalysis.totalMarkers}개`));
  }
  if (placeholderCount > 0) {
    console.log(chalk.gray(`   (링크) 플레이스홀더: ${placeholderCount}개`));
  }

  if (options.verbose && markerAnalysis.totalMarkers > 0) {
    printAnalysis(markerAnalysis);
  }

  // 모든 링크 처리 (마커 + 플레이스홀더)
  const result = processAllLinks(content);
  const totalProcessed = result.markers.processed.length + result.placeholders.length;

  if (totalProcessed === 0) {
    console.log(chalk.yellow(`   변환할 링크가 없습니다.`));
    return false;
  }

  // 결과 출력
  if (result.markers.processed.length > 0) {
    console.log(chalk.green(`   ✓ 마커 ${result.markers.processed.length}개 변환`));
  }
  if (result.placeholders.length > 0) {
    console.log(chalk.green(`   ✓ 플레이스홀더 ${result.placeholders.length}개 → 네이버 지도 링크`));
  }

  if (result.markers.failed.length > 0) {
    console.log(chalk.yellow(`   ⚠ ${result.markers.failed.length}개 변환 실패`));
  }

  if (options.verbose) {
    for (const link of result.markers.processed) {
      console.log(chalk.gray(`     → [${link.marker.type}] ${link.marker.query}`));
      console.log(chalk.blue(`       ${link.url}`));
    }
    for (const link of result.placeholders) {
      console.log(chalk.gray(`     → [map] ${link.text}`));
      console.log(chalk.blue(`       ${link.url}`));
    }
  }

  // 저장
  if (!options.dryRun) {
    await writeFile(filepath, result.content, 'utf-8');
    console.log(chalk.green(`   ✓ 저장 완료`));
  } else {
    console.log(chalk.yellow(`   (dry-run: 저장 안함)`));
  }

  return true;
}

/**
 * 디렉토리에서 모든 .md 파일 찾기 (재귀)
 */
async function findMarkdownFiles(dir: string): Promise<string[]> {
  const results: string[] = [];

  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        const subFiles = await findMarkdownFiles(fullPath);
        results.push(...subFiles);
      } else if (entry.name.endsWith('.md')) {
        results.push(fullPath);
      }
    }
  } catch {
    // 디렉토리 접근 실패 시 무시
  }

  return results;
}

/**
 * 전체 파일 처리
 */
async function processAllFiles(
  dir: string,
  options: LinksCommandOptions,
  recursive: boolean = false
): Promise<void> {
  // 파일 목록
  let files: string[];
  try {
    if (recursive) {
      files = await findMarkdownFiles(dir);
    } else {
      const entries = await readdir(dir);
      files = entries.filter(f => f.endsWith('.md')).map(f => join(dir, f));
    }
  } catch {
    console.error(chalk.red(`폴더를 찾을 수 없습니다: ${dir}`));
    return;
  }

  if (files.length === 0) {
    console.log(chalk.yellow('처리할 파일이 없습니다.'));
    return;
  }

  console.log(chalk.gray(`${files.length}개 파일 검사 중...\n`));

  let processedCount = 0;
  let skippedCount = 0;

  for (const filepath of files) {
    const wasProcessed = await processFile(filepath, options);

    if (wasProcessed) {
      processedCount++;
    } else {
      skippedCount++;
    }
  }

  // 요약
  console.log(chalk.cyan('\n─────────────────────────────────'));
  console.log(chalk.white('📊 처리 결과:'));
  console.log(`   처리됨: ${chalk.green(processedCount)}개`);
  console.log(`   스킵됨: ${chalk.gray(skippedCount)}개`);

  if (options.dryRun) {
    console.log(chalk.yellow('\n(dry-run 모드: 실제 파일은 변경되지 않았습니다)'));
  }
}

/**
 * 분석 결과 출력
 */
function printAnalysis(analysis: LinkAnalysis): void {
  console.log(chalk.gray('   타입별 분포:'));

  const typeLabels: Record<string, string> = {
    map: '네이버 지도',
    place: '네이버 검색',
    booking: '인터파크 티켓',
    yes24: '예스24 티켓',
    official: '공식 URL'
  };

  for (const [type, count] of Object.entries(analysis.byType)) {
    if (count > 0) {
      console.log(chalk.gray(`     ${typeLabels[type] || type}: ${count}개`));
    }
  }
}
