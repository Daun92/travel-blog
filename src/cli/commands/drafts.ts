/**
 * drafts 명령어: 초안 목록 보기
 */

import { readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';
import chalk from 'chalk';
import matter from 'gray-matter';
import { format, formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

export interface DraftsCommandOptions {
  all?: boolean;
}

interface DraftInfo {
  filename: string;
  filepath: string;
  title: string;
  description: string;
  date: Date;
  draft: boolean;
  categories: string[];
  tags: string[];
  wordCount: number;
}

export async function draftsCommand(options: DraftsCommandOptions): Promise<void> {
  console.log(chalk.cyan('\n📋 초안 목록\n'));

  const draftsDir = './drafts';

  try {
    // 디렉토리 확인
    const dirStat = await stat(draftsDir).catch(() => null);
    if (!dirStat || !dirStat.isDirectory()) {
      console.log(chalk.yellow('초안 폴더가 비어있습니다.'));
      console.log(chalk.dim(`\n새 포스트를 생성하려면: npm run new -- -t "주제"`));
      return;
    }

    // 마크다운 파일 목록
    const files = await readdir(draftsDir);
    const mdFiles = files.filter(f => f.endsWith('.md'));

    if (mdFiles.length === 0) {
      console.log(chalk.yellow('초안이 없습니다.'));
      console.log(chalk.dim(`\n새 포스트를 생성하려면: npm run new -- -t "주제"`));
      return;
    }

    // 파일 정보 수집
    const drafts: DraftInfo[] = [];

    for (const filename of mdFiles) {
      const filepath = join(draftsDir, filename);
      const content = await readFile(filepath, 'utf-8');
      const { data, content: body } = matter(content);

      // 단어 수 계산 (한글 기준)
      const wordCount = body.replace(/\s+/g, '').length;

      drafts.push({
        filename,
        filepath,
        title: data.title || filename,
        description: data.description || '',
        date: new Date(data.date || Date.now()),
        draft: data.draft !== false,
        categories: data.categories || [],
        tags: data.tags || [],
        wordCount
      });
    }

    // 날짜순 정렬 (최신 먼저)
    drafts.sort((a, b) => b.date.getTime() - a.date.getTime());

    // 필터링 (기본: 초안만)
    const filtered = options.all
      ? drafts
      : drafts.filter(d => d.draft);

    if (filtered.length === 0) {
      console.log(chalk.yellow('표시할 초안이 없습니다.'));
      console.log(chalk.dim(`모든 파일을 보려면: npm run drafts -- -a`));
      return;
    }

    // 출력
    console.log(chalk.dim('─'.repeat(60)));

    for (const draft of filtered) {
      const status = draft.draft
        ? chalk.yellow('📝 초안')
        : chalk.green('✅ 승인됨');

      const category = draft.categories[0] === 'travel'
        ? chalk.blue('🧳 여행')
        : chalk.magenta('🎨 문화예술');

      const timeAgo = formatDistanceToNow(draft.date, { locale: ko, addSuffix: true });

      console.log(`\n  ${status} ${category}`);
      console.log(`  ${chalk.white.bold(draft.title)}`);
      console.log(chalk.dim(`  ${draft.description.slice(0, 60)}...`));
      console.log(chalk.dim(`  📄 ${draft.filename}`));
      console.log(chalk.dim(`  📊 ${draft.wordCount}자 | ${timeAgo}`));
      console.log(chalk.dim(`  🏷️  ${draft.tags.slice(0, 5).join(', ')}`));
    }

    console.log(chalk.dim('\n─'.repeat(60)));

    // 요약
    const draftCount = filtered.filter(d => d.draft).length;
    const approvedCount = filtered.filter(d => !d.draft).length;

    console.log(`\n📊 총 ${filtered.length}개 파일`);
    if (draftCount > 0) {
      console.log(chalk.yellow(`   • 초안: ${draftCount}개`));
    }
    if (approvedCount > 0) {
      console.log(chalk.green(`   • 승인됨: ${approvedCount}개`));
    }

    // 다음 단계 안내
    if (draftCount > 0) {
      console.log(chalk.cyan(`\n💡 초안 검토: npm run review -- -f <파일명>`));
    }
    if (approvedCount > 0) {
      console.log(chalk.cyan(`💡 발행: npm run publish -- -f <파일명>`));
    }

  } catch (error) {
    console.error(chalk.red('❌ 오류:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
