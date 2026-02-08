#!/usr/bin/env npx tsx
/**
 * 지연 배포 스크립트
 *
 * 사용법:
 *   npx tsx scripts/deploy-with-delay.mts              # 즉시 배포
 *   npx tsx scripts/deploy-with-delay.mts --delay 6    # 6시간 후 배포
 *   npx tsx scripts/deploy-with-delay.mts --cancel     # 예약된 배포 취소
 *   npx tsx scripts/deploy-with-delay.mts --status     # 배포 상태 확인
 */

import { config } from 'dotenv';
config();

import { readdir, readFile, writeFile, copyFile, mkdir, unlink, stat } from 'fs/promises';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import chalk from 'chalk';
import matter from 'gray-matter';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const deployLockFile = join(projectRoot, '.deploy-scheduled');

interface DeploySchedule {
  scheduledTime: string;
  files: string[];
  createdAt: string;
}

async function getApprovedDrafts(): Promise<string[]> {
  const draftsDir = join(projectRoot, 'drafts');

  try {
    await stat(draftsDir);
  } catch {
    return [];
  }

  const files = await readdir(draftsDir);
  const mdFiles = files.filter(f => f.endsWith('.md'));

  const approvedFiles: string[] = [];

  for (const filename of mdFiles) {
    const filepath = join(draftsDir, filename);
    const content = await readFile(filepath, 'utf-8');
    const { data } = matter(content);

    // draft: false인 파일만 배포 대상
    if (data.draft !== false) {
      console.log(chalk.yellow(`  ⏭️  건너뜀 (draft: ${data.draft ?? 'undefined'}): ${filename}`));
      continue;
    }

    // 팩트체크 점수 확인 (≥70 필수)
    const fcScore = typeof data.factcheckScore === 'number' ? data.factcheckScore : 0;
    if (fcScore < 70) {
      console.log(chalk.yellow(`  ⏭️  건너뜀 (factcheckScore: ${fcScore}): ${filename}`));
      continue;
    }

    approvedFiles.push(filename);
  }

  return approvedFiles;
}

async function deployFiles(files: string[]): Promise<boolean> {
  const draftsDir = join(projectRoot, 'drafts');
  const blogPostsDir = join(projectRoot, 'blog', 'content', 'posts');

  console.log(chalk.white.bold('\n📦 파일 배포 중...\n'));

  for (const filename of files) {
    const sourcePath = join(draftsDir, filename);
    const content = await readFile(sourcePath, 'utf-8');
    const { data } = matter(content);

    // 카테고리 폴더 결정
    const category = data.categories?.[0] || 'travel';
    const targetDir = join(blogPostsDir, category);

    // 폴더 생성
    await mkdir(targetDir, { recursive: true });

    // 파일 복사
    const targetPath = join(targetDir, filename);
    await copyFile(sourcePath, targetPath);

    // draft: false로 업데이트
    const updatedContent = matter.stringify(content, { ...data, draft: false });
    await writeFile(targetPath, updatedContent, 'utf-8');

    // 원본 삭제
    await unlink(sourcePath);

    console.log(chalk.green(`  ✓ ${filename} → ${category}/`));
  }

  return true;
}

async function gitCommitAndPush(files: string[]): Promise<boolean> {
  const today = new Date().toISOString().split('T')[0];
  const commitMessage = `Daily posts: ${today} (${files.length}개)`;

  console.log(chalk.white.bold('\n📤 Git 커밋 및 푸시...\n'));

  return new Promise((resolve) => {
    const blogDir = join(projectRoot, 'blog');

    // git add
    const addProcess = spawn('git', ['add', '.'], { cwd: blogDir, shell: true });

    addProcess.on('close', (addCode) => {
      if (addCode !== 0) {
        console.log(chalk.red('  ✗ git add 실패'));
        resolve(false);
        return;
      }

      console.log(chalk.green('  ✓ git add 완료'));

      // git commit
      const commitProcess = spawn('git', ['commit', '-m', commitMessage], {
        cwd: blogDir,
        shell: true
      });

      commitProcess.on('close', (commitCode) => {
        if (commitCode !== 0) {
          console.log(chalk.yellow('  ⚠ 커밋할 변경사항이 없거나 커밋 실패'));
          resolve(true); // 변경사항 없어도 계속 진행
          return;
        }

        console.log(chalk.green(`  ✓ git commit: ${commitMessage}`));

        // git push
        const pushProcess = spawn('git', ['push'], {
          cwd: blogDir,
          shell: true,
          stdio: 'inherit'
        });

        pushProcess.on('close', (pushCode) => {
          if (pushCode === 0) {
            console.log(chalk.green('  ✓ git push 완료'));
            resolve(true);
          } else {
            console.log(chalk.red('  ✗ git push 실패'));
            resolve(false);
          }
        });
      });
    });
  });
}

async function scheduleDeployment(delayHours: number, files: string[]): Promise<void> {
  const scheduledTime = new Date(Date.now() + delayHours * 60 * 60 * 1000);

  const schedule: DeploySchedule = {
    scheduledTime: scheduledTime.toISOString(),
    files,
    createdAt: new Date().toISOString()
  };

  await writeFile(deployLockFile, JSON.stringify(schedule, null, 2), 'utf-8');

  console.log(chalk.cyan('\n⏰ 배포 예약됨\n'));
  console.log(chalk.white(`  예약 시간: ${scheduledTime.toLocaleString('ko-KR')}`));
  console.log(chalk.white(`  대상 파일: ${files.length}개`));
  console.log(chalk.dim(`\n  취소하려면: npm run daily:cancel`));

  // Windows 작업 스케줄러 명령 안내
  console.log(chalk.yellow('\n📋 Windows 작업 스케줄러 설정 (선택사항):\n'));
  console.log(chalk.dim(`  # PowerShell에서 실행:`));
  console.log(chalk.dim(`  $trigger = New-ScheduledTaskTrigger -Once -At "${scheduledTime.toISOString()}"`));
  console.log(chalk.dim(`  $action = New-ScheduledTaskAction -Execute "npm" -Argument "run daily:deploy" -WorkingDirectory "${projectRoot}"`));
  console.log(chalk.dim(`  Register-ScheduledTask -TaskName "OpenClaw-Deploy" -Trigger $trigger -Action $action`));
}

async function cancelDeployment(): Promise<void> {
  try {
    await stat(deployLockFile);
    const content = await readFile(deployLockFile, 'utf-8');
    const schedule: DeploySchedule = JSON.parse(content);

    await unlink(deployLockFile);

    console.log(chalk.green('\n✅ 배포 예약이 취소되었습니다.\n'));
    console.log(chalk.dim(`  취소된 예약: ${schedule.scheduledTime}`));
    console.log(chalk.dim(`  대상 파일: ${schedule.files.length}개`));
  } catch {
    console.log(chalk.yellow('\n⚠️ 예약된 배포가 없습니다.'));
  }
}

async function checkStatus(): Promise<void> {
  console.log(chalk.cyan('\n📊 배포 상태\n'));

  // 예약된 배포 확인
  try {
    await stat(deployLockFile);
    const content = await readFile(deployLockFile, 'utf-8');
    const schedule: DeploySchedule = JSON.parse(content);

    const scheduledTime = new Date(schedule.scheduledTime);
    const now = new Date();
    const diff = scheduledTime.getTime() - now.getTime();

    if (diff > 0) {
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      console.log(chalk.yellow('⏰ 배포 예약됨'));
      console.log(chalk.white(`  예약 시간: ${scheduledTime.toLocaleString('ko-KR')}`));
      console.log(chalk.white(`  남은 시간: ${hours}시간 ${minutes}분`));
      console.log(chalk.white(`  대상 파일: ${schedule.files.length}개`));
    } else {
      console.log(chalk.red('⚠️ 예약 시간이 지났습니다. 즉시 배포하거나 취소하세요.'));
    }
  } catch {
    console.log(chalk.dim('예약된 배포 없음'));
  }

  // 대기 중인 초안
  const files = await getApprovedDrafts();
  console.log(chalk.white(`\n📝 대기 중인 초안: ${files.length}개`));

  if (files.length > 0) {
    files.forEach(f => console.log(chalk.dim(`  • ${f}`)));
  }
}

async function main() {
  const args = process.argv.slice(2);

  // 옵션 파싱
  if (args.includes('--cancel')) {
    await cancelDeployment();
    return;
  }

  if (args.includes('--status')) {
    await checkStatus();
    return;
  }

  const delayIndex = args.indexOf('--delay');
  const delayHours = delayIndex !== -1 ? parseInt(args[delayIndex + 1], 10) : 0;

  console.log(chalk.cyan('\n═══════════════════════════════════════════════════'));
  console.log(chalk.cyan('     🚀 OpenClaw 배포'));
  console.log(chalk.cyan('═══════════════════════════════════════════════════\n'));

  // 배포할 파일 확인
  const files = await getApprovedDrafts();

  if (files.length === 0) {
    console.log(chalk.yellow('⚠️ 배포할 초안이 없습니다.'));
    console.log(chalk.dim('  npm run new 또는 npm run daily:run으로 포스트를 생성하세요.'));
    process.exit(0);
  }

  console.log(chalk.white.bold('📋 배포 대상'));
  files.forEach(f => console.log(chalk.dim(`  • ${f}`)));

  // 지연 배포
  if (delayHours > 0) {
    await scheduleDeployment(delayHours, files);
    return;
  }

  // 즉시 배포
  console.log(chalk.white.bold('\n🚀 즉시 배포 시작'));

  const deployed = await deployFiles(files);

  if (!deployed) {
    console.log(chalk.red('\n❌ 배포 실패'));
    process.exit(1);
  }

  const pushed = await gitCommitAndPush(files);

  if (!pushed) {
    console.log(chalk.yellow('\n⚠️ Git 푸시 실패. 수동으로 푸시하세요:'));
    console.log(chalk.dim('  cd blog && git push'));
  }

  // 예약 파일 정리
  try {
    await unlink(deployLockFile);
  } catch {
    // 무시
  }

  console.log(chalk.green('\n✅ 배포 완료!\n'));
  console.log(chalk.dim('GitHub Pages 빌드 상태를 확인하세요.'));
}

main().catch((err) => {
  console.error(chalk.red('오류:'), err);
  process.exit(1);
});
