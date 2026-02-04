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

const execAsync = promisify(exec);

export interface PublishCommandOptions {
  file?: string;
  all?: boolean;
  message?: string;
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

      // 원본 삭제 (선택적)
      // await unlink(file.filepath);
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
