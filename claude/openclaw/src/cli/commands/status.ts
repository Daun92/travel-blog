/**
 * status 명령어: 시스템 상태 확인
 */

import { readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import matter from 'gray-matter';
import { checkOllamaStatus, listModels } from '../../generator/index.js';

export async function statusCommand(): Promise<void> {
  console.log(chalk.cyan('\n📊 시스템 상태\n'));

  const spinner = ora();

  // 1. Ollama 상태
  console.log(chalk.white.bold('🤖 Ollama'));
  spinner.start('연결 확인 중...');

  const ollamaOnline = await checkOllamaStatus();

  if (ollamaOnline) {
    spinner.succeed(chalk.green('연결됨'));

    // 모델 목록
    const models = await listModels();
    if (models.length > 0) {
      console.log(chalk.dim('  사용 가능한 모델:'));
      models.forEach(m => console.log(chalk.dim(`    • ${m}`)));
    }

    // 현재 설정 모델
    const configModel = process.env.OLLAMA_MODEL || 'qwen3:8b';
    const hasModel = models.some(m => m.includes(configModel.split(':')[0]));
    if (hasModel) {
      console.log(chalk.green(`  ✓ 설정된 모델 사용 가능: ${configModel}`));
    } else {
      console.log(chalk.yellow(`  ⚠ 설정된 모델 없음: ${configModel}`));
      console.log(chalk.dim(`    설치: ollama pull ${configModel}`));
    }
  } else {
    spinner.fail(chalk.red('연결 실패'));
    console.log(chalk.dim('  Ollama 시작: ollama serve'));
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

  // 5. 환경 변수
  console.log(chalk.white.bold('\n⚙️  환경 설정'));

  const envVars = [
    { key: 'OLLAMA_HOST', default: 'http://localhost:11434' },
    { key: 'OLLAMA_MODEL', default: 'qwen3:8b' },
    { key: 'UNSPLASH_ACCESS_KEY', secret: true }
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
    } else {
      console.log(chalk.yellow(`  ⚠ ${env.key}: 미설정`));
    }
  }

  // 6. 명령어 안내
  console.log(chalk.cyan('\n💡 사용 가능한 명령어'));
  console.log(chalk.dim('  npm run new       - 새 포스트 생성'));
  console.log(chalk.dim('  npm run drafts    - 초안 목록'));
  console.log(chalk.dim('  npm run review    - 초안 검토'));
  console.log(chalk.dim('  npm run publish   - 포스트 발행'));
  console.log(chalk.dim('  npm run keywords  - 키워드 추천'));
  console.log(chalk.dim('  npm run hugo:serve - 로컬 미리보기'));

  console.log('');
}
