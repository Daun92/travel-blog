/**
 * daily 명령어: 일일 자동화 제어
 */

import { spawn } from 'child_process';
import { join } from 'path';
import chalk from 'chalk';

export interface DailyCommandOptions {
  count?: string;
  delay?: string;
  today?: boolean;
}

function runScript(scriptName: string, args: string[] = []): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn('npx', ['tsx', `scripts/${scriptName}`, ...args], {
      stdio: 'inherit',
      shell: true
    });

    child.on('close', (code) => {
      resolve(code ?? 1);
    });

    child.on('error', () => {
      resolve(1);
    });
  });
}

export async function dailyCommand(
  action: string,
  options: DailyCommandOptions = {}
): Promise<void> {
  switch (action) {
    case 'run': {
      console.log(chalk.cyan('\n🚀 일일 포스트 생성 시작\n'));

      const args: string[] = [];
      if (options.count) {
        args.push('--count', options.count);
      }

      const code = await runScript('daily-posts.mts', args);
      process.exit(code);
    }

    case 'preview': {
      console.log(chalk.cyan('\n🔍 프리뷰 모드\n'));

      // 프리뷰만 (생성 안 함)
      await runScript('daily-posts.mts', ['--preview']);

      // 프리뷰 보고서도 생성
      const args = options.today ? ['--today'] : [];
      await runScript('generate-preview.mts', args);
      break;
    }

    case 'deploy': {
      console.log(chalk.cyan('\n📦 배포 시작\n'));

      const args: string[] = [];
      if (options.delay) {
        args.push('--delay', options.delay);
      }

      const code = await runScript('deploy-with-delay.mts', args);
      process.exit(code);
    }

    case 'cancel': {
      const code = await runScript('deploy-with-delay.mts', ['--cancel']);
      process.exit(code);
    }

    case 'status': {
      console.log(chalk.cyan('\n📊 배포 상태\n'));
      await runScript('deploy-with-delay.mts', ['--status']);
      break;
    }

    default:
      console.log(chalk.cyan('\n📅 일일 자동화 제어\n'));
      console.log(chalk.white('사용 가능한 작업:'));
      console.log(chalk.dim('  run       일일 포스트 생성 실행'));
      console.log(chalk.dim('  preview   프리뷰만 생성 (포스트 생성 안 함)'));
      console.log(chalk.dim('  deploy    초안을 블로그에 배포'));
      console.log(chalk.dim('  cancel    예약된 배포 취소'));
      console.log(chalk.dim('  status    배포 상태 확인'));
      console.log(chalk.dim('\n옵션:'));
      console.log(chalk.dim('  --count <n>    생성할 포스트 수 (run에서 사용)'));
      console.log(chalk.dim('  --delay <n>    배포 지연 시간 (deploy에서 사용)'));
      console.log(chalk.dim('  --today        오늘 생성된 초안만 (preview에서 사용)'));
      console.log(chalk.dim('\n예시:'));
      console.log(chalk.dim('  npm run daily:run           # 일일 2포스트 생성'));
      console.log(chalk.dim('  npm run daily:run -- --count 1  # 1개만 생성'));
      console.log(chalk.dim('  npm run daily:preview       # 프리뷰만'));
      console.log(chalk.dim('  npm run daily:deploy        # 즉시 배포'));
      console.log(chalk.dim('  npm run daily:deploy -- --delay 6  # 6시간 후 배포'));
      console.log(chalk.dim('  npm run daily:cancel        # 배포 취소'));
  }
}
