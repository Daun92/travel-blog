/**
 * publish 명령어: 포스트 발행 (Git push)
 */

import { readdir, readFile, copyFile, stat, unlink } from 'fs/promises';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import matter from 'gray-matter';
import { canPublish } from '../../quality/index.js';

const execAsync = promisify(exec);

export interface PublishCommandOptions {
  file?: string;
  all?: boolean;
  message?: string;
  skipValidation?: boolean;
  keepDraft?: boolean;
}

export async function publishCommand(options: PublishCommandOptions): Promise<void> {
  console.log(chalk.cyan('\n🚀 포스트 발행\n'));

  const draftsDir = './drafts';
  const blogDir = './blog';
  const spinner = ora();

  try {
    // 발행할 파일 목록 수집
    let filesToPublish: Array<{
      filename: string;
      filepath: string;
      title: string;
      category: string;
    }> = [];

    if (options.file) {
      // 특정 파일 발행
      const filepath = join(draftsDir, options.file);
      const fileStat = await stat(filepath).catch(() => null);

      if (!fileStat) {
        console.log(chalk.red(`파일을 찾을 수 없습니다: ${options.file}`));
        return;
      }

      const content = await readFile(filepath, 'utf-8');
      const { data } = matter(content);

      if (data.draft) {
        console.log(chalk.yellow('⚠️  이 파일은 아직 초안 상태입니다.'));
        const { proceed } = await inquirer.prompt([{
          type: 'confirm',
          name: 'proceed',
          message: '그래도 발행하시겠습니까?',
          default: false
        }]);

        if (!proceed) {
          console.log(chalk.dim('발행이 취소되었습니다.'));
          return;
        }
      }

      filesToPublish.push({
        filename: options.file,
        filepath,
        title: data.title || options.file,
        category: (data.categories as string[])?.[0] || 'travel'
      });
    } else if (options.all) {
      // 모든 승인된 파일 발행
      const files = await readdir(draftsDir).catch(() => []);
      const mdFiles = files.filter(f => f.endsWith('.md'));

      for (const filename of mdFiles) {
        const filepath = join(draftsDir, filename);
        const content = await readFile(filepath, 'utf-8');
        const { data } = matter(content);

        // 승인된 파일만 (draft: false)
        if (data.draft === false) {
          filesToPublish.push({
            filename,
            filepath,
            title: data.title || filename,
            category: (data.categories as string[])?.[0] || 'travel'
          });
        }
      }

      if (filesToPublish.length === 0) {
        console.log(chalk.yellow('발행할 승인된 파일이 없습니다.'));
        console.log(chalk.dim('파일을 승인하려면: npm run review'));
        return;
      }
    } else {
      // 파일 선택
      const files = await readdir(draftsDir).catch(() => []);
      const mdFiles = files.filter(f => f.endsWith('.md'));

      if (mdFiles.length === 0) {
        console.log(chalk.yellow('발행할 파일이 없습니다.'));
        return;
      }

      const fileInfos = await Promise.all(
        mdFiles.map(async (filename) => {
          const content = await readFile(join(draftsDir, filename), 'utf-8');
          const { data } = matter(content);
          return {
            name: `${data.draft ? '📝' : '✅'} ${data.title || filename}`,
            value: filename,
            short: filename,
            data
          };
        })
      );

      const { selectedFiles } = await inquirer.prompt([{
        type: 'checkbox',
        name: 'selectedFiles',
        message: '발행할 파일을 선택하세요:',
        choices: fileInfos.map(f => ({
          name: f.name,
          value: f.value,
          checked: !f.data.draft // 승인된 파일은 기본 선택
        }))
      }]);

      if (selectedFiles.length === 0) {
        console.log(chalk.dim('발행이 취소되었습니다.'));
        return;
      }

      for (const filename of selectedFiles) {
        const info = fileInfos.find(f => f.value === filename);
        if (info) {
          filesToPublish.push({
            filename,
            filepath: join(draftsDir, filename),
            title: info.data.title || filename,
            category: (info.data.categories as string[])?.[0] || 'travel'
          });
        }
      }
    }

    // 프론트매터 필수 필드 프리체크 (빠르고 API 비용 없음)
    {
      const preflight: string[] = [];
      for (const file of filesToPublish) {
        const raw = await readFile(file.filepath, 'utf-8');
        const { data } = matter(raw);
        const missing: string[] = [];
        if (!data.author) missing.push('author');
        if (!data.personaId) missing.push('personaId');
        if (!data.description) missing.push('description');
        if (!data.tags || (data.tags as string[]).length === 0) missing.push('tags');
        if (missing.length > 0) {
          preflight.push(`${file.title}: 누락 필드 — ${missing.join(', ')}`);
        }
      }
      if (preflight.length > 0) {
        console.log(chalk.yellow('\n⚠️ 프론트매터 필수 필드 누락:'));
        preflight.forEach(p => console.log(chalk.yellow(`  • ${p}`)));
        console.log(chalk.dim('  → npm run edit 으로 프론트매터를 보완하세요.\n'));
      }
    }

    // 품질 게이트 검증 (--skip-validation이 없으면)
    if (!options.skipValidation) {
      console.log(chalk.cyan('\n🔍 품질 게이트 검증 중...\n'));

      const blockedFiles: string[] = [];
      const warningFiles: string[] = [];

      for (const file of filesToPublish) {
        const publishCheck = await canPublish(file.filepath);

        if (!publishCheck.allowed) {
          if (publishCheck.reason?.includes('사람 검토')) {
            warningFiles.push(`${file.title}: ${publishCheck.reason}`);
          } else {
            blockedFiles.push(`${file.title}: ${publishCheck.reason}`);
          }
        } else {
          console.log(chalk.green(`  ✓ ${file.title}`));
        }
      }

      // 차단된 파일 처리
      if (blockedFiles.length > 0) {
        console.log(chalk.red('\n🚫 품질 기준 미달로 발행 차단:'));
        blockedFiles.forEach(f => console.log(chalk.red(`  • ${f}`)));

        // 차단된 파일 제외
        filesToPublish = filesToPublish.filter(f =>
          !blockedFiles.some(b => b.startsWith(f.title))
        );

        if (filesToPublish.length === 0) {
          console.log(chalk.red('\n모든 파일이 품질 기준을 통과하지 못했습니다.'));
          console.log(chalk.dim('품질 검증: npm run validate -f <파일>'));
          console.log(chalk.dim('팩트체크: npm run factcheck -f <파일>'));
          return;
        }
      }

      // 경고 파일 처리
      if (warningFiles.length > 0) {
        console.log(chalk.yellow('\n⚠️ 검토 필요:'));
        warningFiles.forEach(f => console.log(chalk.yellow(`  • ${f}`)));

        const { continueWithWarnings } = await inquirer.prompt([{
          type: 'confirm',
          name: 'continueWithWarnings',
          message: '경고가 있는 파일도 발행하시겠습니까?',
          default: false
        }]);

        if (!continueWithWarnings) {
          // 경고 파일 제외
          filesToPublish = filesToPublish.filter(f =>
            !warningFiles.some(w => w.startsWith(f.title))
          );
        }
      }

      if (filesToPublish.length === 0) {
        console.log(chalk.dim('발행할 파일이 없습니다.'));
        return;
      }
    }

    // 발행 확인
    console.log(chalk.white.bold('\n📋 발행할 파일:'));
    filesToPublish.forEach(f => {
      console.log(`  • ${f.title} → posts/${f.category}/`);
    });

    const { confirm } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: `${filesToPublish.length}개 파일을 발행하시겠습니까?`,
      default: true
    }]);

    if (!confirm) {
      console.log(chalk.dim('발행이 취소되었습니다.'));
      return;
    }

    // 파일 이동
    spinner.start('파일 이동 중...');

    for (const file of filesToPublish) {
      const targetDir = join(blogDir, 'content', 'posts', file.category);
      const targetPath = join(targetDir, file.filename);

      // 파일 복사
      await copyFile(file.filepath, targetPath);
    }

    spinner.succeed('파일 이동 완료');

    // Git 커밋
    const commitMessage = options.message ||
      `Add ${filesToPublish.length} post(s): ${filesToPublish.map(f => f.title).join(', ')}`;

    spinner.start('Git 커밋 중...');

    try {
      // Git add
      await execAsync('git add blog/content/posts/', { cwd: process.cwd() });

      // Git commit
      await execAsync(`git commit -m "${commitMessage}"`, { cwd: process.cwd() });

      spinner.succeed('Git 커밋 완료');

      // Git push 확인
      const { push } = await inquirer.prompt([{
        type: 'confirm',
        name: 'push',
        message: 'GitHub에 푸시하시겠습니까?',
        default: true
      }]);

      if (push) {
        spinner.start('GitHub에 푸시 중...');
        await execAsync('git push', { cwd: process.cwd() });
        spinner.succeed('GitHub 푸시 완료');

        console.log(chalk.green('\n✅ 발행 완료!'));
        console.log(chalk.dim('GitHub Actions가 자동으로 사이트를 빌드합니다.'));
        console.log(chalk.dim('몇 분 후 사이트에서 확인할 수 있습니다.'));
      } else {
        console.log(chalk.green('\n✅ 로컬 커밋 완료!'));
        console.log(chalk.dim('나중에 푸시하려면: git push'));
      }

      // 발행 후 드래프트 자동 삭제
      if (!options.keepDraft) {
        const deletedDrafts: string[] = [];
        for (const file of filesToPublish) {
          try {
            await unlink(file.filepath);
            deletedDrafts.push(file.filename);
          } catch {
            // 이미 삭제되었거나 접근 불가 — 무시
          }
        }
        if (deletedDrafts.length > 0) {
          console.log(chalk.dim(`\n🗑️  드래프트 ${deletedDrafts.length}개 정리 완료`));
        }
      }

      // 큐 완료 자동 연동
      await markQueueCompleted(filesToPublish.map(f => f.title));

    } catch (gitError) {
      spinner.fail('Git 작업 실패');
      console.error(chalk.yellow('\n⚠️  Git 오류 (파일은 이동되었습니다):'));
      console.error(chalk.dim(gitError instanceof Error ? gitError.message : String(gitError)));
      console.log(chalk.dim('\n수동으로 커밋하려면:'));
      console.log(chalk.dim('  git add blog/content/posts/'));
      console.log(chalk.dim('  git commit -m "Add posts"'));
      console.log(chalk.dim('  git push'));
    }

  } catch (error) {
    spinner.fail('오류 발생');
    console.error(chalk.red('\n❌ 오류:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

/**
 * 발행된 포스트 제목과 매칭되는 큐 항목을 completed로 이동
 */
async function markQueueCompleted(publishedTitles: string[]): Promise<void> {
  try {
    const queuePath = './config/topic-queue.json';
    const raw = await readFile(queuePath, 'utf-8');
    const queue = JSON.parse(raw);

    if (!queue.queue || queue.queue.length === 0) return;

    const movedItems: string[] = [];
    const remaining = queue.queue.filter((item: { title: string }) => {
      // 제목의 핵심 키워드가 발행 제목에 포함되는지 확인
      const matched = publishedTitles.some(pubTitle => {
        const pubNorm = pubTitle.replace(/[:\s\-–—]/g, '').toLowerCase();
        const queueNorm = item.title.replace(/[:\s\-–—]/g, '').toLowerCase();
        // 큐 제목이 발행 제목에 포함되거나 유사한 경우
        return pubNorm.includes(queueNorm) || queueNorm.includes(pubNorm) ||
          // 첫 6글자 매칭 (핵심 키워드)
          pubNorm.slice(0, 6) === queueNorm.slice(0, 6);
      });
      if (matched) movedItems.push(item.title);
      return !matched;
    });

    if (movedItems.length > 0) {
      const completed = queue.completed || [];
      for (const title of movedItems) {
        const item = queue.queue.find((q: { title: string }) => q.title === title);
        if (item) completed.push(item);
      }
      queue.queue = remaining;
      queue.completed = completed;
      const { writeFile: writeFileFs } = await import('fs/promises');
      await writeFileFs(queuePath, JSON.stringify(queue, null, 2) + '\n', 'utf-8');
      console.log(chalk.dim(`📋 큐 완료 처리: ${movedItems.length}개 (${movedItems.join(', ')})`));
    }
  } catch {
    // 큐 파일 접근 실패 — 발행에는 영향 없음
  }
}
