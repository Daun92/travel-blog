/**
 * status 명령어: 시스템 상태 확인
 */

import { readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import matter from 'gray-matter';
import { checkGeminiStatus, listModels } from '../../generator/index.js';

interface TopicQueue {
  queue: { title: string; type: string }[];
  completed: { title: string; type: string }[];
  settings: {
    postsPerDay: number;
    deployDelayHours: number;
  };
}

export async function statusCommand(): Promise<void> {
  console.log(chalk.cyan('\n📊 시스템 상태\n'));

  const spinner = ora();

  // 1. LLM 상태 (Gemini API)
  console.log(chalk.white.bold('🤖 LLM (Gemini API)'));
  spinner.start('API 키 확인 중...');

  const geminiOnline = await checkGeminiStatus();
  const llmModel = process.env.LLM_MODEL || 'gemini-3.0-flash';
  const geminiImageModel = process.env.GEMINI_IMAGE_MODEL || 'gemini-3.0-pro-preview';

  if (geminiOnline) {
    spinner.succeed(chalk.green('API 키 설정됨'));

    // 사용 가능한 모델 목록
    const models = await listModels();
    console.log(chalk.dim('  사용 가능한 모델:'));
    models.forEach(m => console.log(chalk.dim(`    • ${m}`)));

    // 현재 설정 모델
    console.log(chalk.green(`  ✓ 텍스트 생성: ${llmModel}`));
    console.log(chalk.green(`  ✓ 이미지 생성: ${geminiImageModel}`));
  } else {
    spinner.fail(chalk.red('API 키 미설정'));
    console.log(chalk.dim('  .env에 GEMINI_API_KEY 설정 필요'));
  }

  // 2. 디렉토리 상태
  console.log(chalk.white.bold('\n📁 디렉토리'));

  const directories = [
    { path: './drafts', name: '초안 폴더' },
    { path: './blog', name: 'Hugo 블로그' },
    { path: './blog/content/posts', name: '포스트 폴더' },
    { path: './blog/static/images', name: '이미지 폴더' }
  ];

  for (const dir of directories) {
    const dirStat = await stat(dir.path).catch(() => null);
    if (dirStat?.isDirectory()) {
      console.log(chalk.green(`  ✓ ${dir.name}: ${dir.path}`));
    } else {
      console.log(chalk.red(`  ✗ ${dir.name}: ${dir.path} (없음)`));
    }
  }

  // 3. 초안 상태
  console.log(chalk.white.bold('\n📝 초안'));

  const draftsDir = './drafts';
  const draftsStat = await stat(draftsDir).catch(() => null);

  if (draftsStat?.isDirectory()) {
    const files = await readdir(draftsDir);
    const mdFiles = files.filter(f => f.endsWith('.md'));

    if (mdFiles.length > 0) {
      let draftCount = 0;
      let approvedCount = 0;

      for (const filename of mdFiles) {
        const content = await readFile(join(draftsDir, filename), 'utf-8');
        const { data } = matter(content);
        if (data.draft === false) {
          approvedCount++;
        } else {
          draftCount++;
        }
      }

      console.log(chalk.dim(`  총 ${mdFiles.length}개 파일`));
      if (draftCount > 0) {
        console.log(chalk.yellow(`  • 초안: ${draftCount}개`));
      }
      if (approvedCount > 0) {
        console.log(chalk.green(`  • 승인됨: ${approvedCount}개`));
      }
    } else {
      console.log(chalk.dim('  초안 없음'));
    }
  } else {
    console.log(chalk.dim('  초안 폴더 없음'));
  }

  // 4. 블로그 포스트 상태
  console.log(chalk.white.bold('\n📚 발행된 포스트'));

  const postsDir = './blog/content/posts';
  const postsStat = await stat(postsDir).catch(() => null);

  if (postsStat?.isDirectory()) {
    const categories = await readdir(postsDir).catch(() => []);
    let totalPosts = 0;

    for (const category of categories) {
      const categoryPath = join(postsDir, category);
      const categoryStat = await stat(categoryPath).catch(() => null);

      if (categoryStat?.isDirectory()) {
        const files = await readdir(categoryPath);
        const mdFiles = files.filter(f => f.endsWith('.md') && !f.startsWith('_'));
        totalPosts += mdFiles.length;

        if (mdFiles.length > 0) {
          const emoji = category === 'travel' ? '🧳' : '🎨';
          console.log(chalk.dim(`  ${emoji} ${category}: ${mdFiles.length}개`));
        }
      }
    }

    if (totalPosts === 0) {
      console.log(chalk.dim('  발행된 포스트 없음'));
    } else {
      console.log(chalk.green(`  총 ${totalPosts}개 발행됨`));
    }
  } else {
    console.log(chalk.dim('  포스트 폴더 없음'));
  }

  // 5. 주제 큐 상태
  console.log(chalk.white.bold('\n📋 주제 큐'));

  try {
    const queueContent = await readFile('./config/topic-queue.json', 'utf-8');
    const queue: TopicQueue = JSON.parse(queueContent);

    console.log(chalk.dim(`  대기 중: ${queue.queue.length}개`));
    console.log(chalk.dim(`  완료됨: ${queue.completed.length}개`));
    console.log(chalk.dim(`  일일 생성: ${queue.settings.postsPerDay}개`));

    if (queue.queue.length > 0) {
      console.log(chalk.dim('  다음 주제:'));
      queue.queue.slice(0, 2).forEach((topic, i) => {
        const emoji = topic.type === 'travel' ? '🧳' : '🎨';
        console.log(chalk.dim(`    ${i + 1}. ${emoji} ${topic.title.slice(0, 30)}...`));
      });
    }

    if (queue.queue.length < 5) {
      console.log(chalk.yellow(`  ⚠ 큐에 주제가 부족합니다 (${queue.queue.length}개)`));
      console.log(chalk.dim('    npm run queue:add -- "주제" --type travel'));
    }
  } catch {
    console.log(chalk.yellow('  ⚠ 주제 큐 파일 없음'));
    console.log(chalk.dim('    npm run queue:list로 초기화'));
  }

  // 6. 환경 변수
  console.log(chalk.white.bold('\n⚙️  환경 설정'));

  const envVars = [
    { key: 'GEMINI_API_KEY', secret: true, required: true },
    { key: 'LLM_MODEL', default: 'gemini-3.0-flash' },
    { key: 'GEMINI_IMAGE_MODEL', default: 'gemini-3.0-pro-preview' },
    { key: 'UNSPLASH_ACCESS_KEY', secret: true },
    { key: 'HUGO_BASE_URL', default: '/travel-blog' }
  ];

  for (const env of envVars) {
    const value = process.env[env.key];
    if (value) {
      if (env.secret) {
        console.log(chalk.green(`  ✓ ${env.key}: ****${value.slice(-4)}`));
      } else {
        console.log(chalk.green(`  ✓ ${env.key}: ${value}`));
      }
    } else if (env.default) {
      console.log(chalk.dim(`  • ${env.key}: ${env.default} (기본값)`));
    } else if ((env as any).required) {
      console.log(chalk.red(`  ✗ ${env.key}: 필수 설정 누락`));
    } else {
      console.log(chalk.yellow(`  ⚠ ${env.key}: 미설정`));
    }
  }

  // 7. 명령어 안내
  console.log(chalk.cyan('\n💡 사용 가능한 명령어'));
  console.log(chalk.white.bold('  일일 자동화:'));
  console.log(chalk.dim('  npm run daily:run     - 일일 2포스트 생성'));
  console.log(chalk.dim('  npm run daily:preview - 프리뷰 보고서'));
  console.log(chalk.dim('  npm run daily:deploy  - 배포'));
  console.log(chalk.white.bold('  주제 큐:'));
  console.log(chalk.dim('  npm run queue:list    - 큐 목록'));
  console.log(chalk.dim('  npm run queue:add     - 주제 추가'));
  console.log(chalk.white.bold('  수동 작업:'));
  console.log(chalk.dim('  npm run new           - 새 포스트 생성'));
  console.log(chalk.dim('  npm run drafts        - 초안 목록'));
  console.log(chalk.dim('  npm run hugo:serve    - 로컬 미리보기'));

  console.log('');
}
