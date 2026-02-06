/**
 * new 명령어: 새 블로그 포스트 생성
 */

import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { generatePost, suggestTitles, checkOllamaStatus } from '../../generator/index.js';
import { findImageForTopic, UnsplashClient } from '../../images/unsplash.js';
import { GeminiImageClient } from '../../images/gemini-imagen.js';

export interface NewCommandOptions {
  topic: string;
  type: 'travel' | 'culture';
  keywords?: string;
  length: 'short' | 'medium' | 'long';
  draft: boolean;
  yes?: boolean; // 비대화 모드
  inlineImages?: boolean; // 인라인 이미지 생성
  imageCount?: number; // 인라인 이미지 개수
  agent?: string; // 에이전트 페르소나 ID (viral|friendly|informative)
}

export async function newCommand(options: NewCommandOptions): Promise<void> {
  console.log(chalk.cyan('\n📝 새 블로그 포스트 생성\n'));

  const spinner = ora();

  try {
    // 1. Ollama 상태 확인
    spinner.start('Ollama 서버 연결 확인 중...');
    const isOnline = await checkOllamaStatus();

    if (!isOnline) {
      spinner.fail('Ollama 서버에 연결할 수 없습니다.');
      console.log(chalk.yellow('\n💡 Ollama를 시작하려면: ollama serve'));
      process.exit(1);
    }
    spinner.succeed('Ollama 서버 연결됨');

    // 2. 옵션 확인
    console.log(chalk.dim('\n입력된 옵션:'));
    console.log(`  • 주제: ${chalk.white(options.topic)}`);
    console.log(`  • 유형: ${chalk.white(options.type === 'travel' ? '여행' : '문화예술')}`);
    console.log(`  • 길이: ${chalk.white(options.length)}`);
    console.log(`  • 초안: ${chalk.white(options.draft ? '예' : '아니오')}`);
    if (options.agent) {
      console.log(`  • 에이전트: ${chalk.magenta(options.agent)} (수동 지정)`);
    }

    // 3. 키워드 파싱
    const keywords = options.keywords
      ? options.keywords.split(',').map(k => k.trim())
      : [];

    if (keywords.length > 0) {
      console.log(`  • 키워드: ${chalk.white(keywords.join(', '))}`);
    }

    // 4. 인라인 이미지 옵션 표시
    const useInlineImages = options.inlineImages ?? false;
    const imageCount = options.imageCount ?? 3;

    if (useInlineImages) {
      console.log(`  • 인라인 이미지: ${chalk.green('활성화')} (${imageCount}개)`);

      // Gemini 상태 확인
      const geminiClient = new GeminiImageClient();
      if (!geminiClient.isConfigured()) {
        console.log(chalk.yellow('    ⚠️ GEMINI_API_KEY가 설정되지 않았습니다.'));
      } else if (!geminiClient.isEnabled()) {
        console.log(chalk.yellow('    ⚠️ GEMINI_IMAGE_ENABLED=true로 설정이 필요합니다.'));
      } else {
        const usage = await geminiClient.getDailyUsage();
        const usageCheck = await geminiClient.checkUsageLimit(imageCount);
        console.log(chalk.dim(`    일일 사용량: ${usage}/${usageCheck.limit}`));
        if (usageCheck.warning && !usageCheck.allowed) {
          console.log(chalk.yellow(`    ⚠️ ${usageCheck.warning}`));
        }
      }
    }

    // 5. 제목 추천 (선택사항) - 비대화 모드에서는 스킵
    let selectedTitle = options.topic;

    if (!options.yes) {
      console.log('');
      const { wantTitles } = await inquirer.prompt([{
        type: 'confirm',
        name: 'wantTitles',
        message: 'AI에게 제목 추천을 받으시겠습니까?',
        default: false
      }]);

      if (wantTitles) {
        spinner.start('제목 추천 생성 중...');
        const titles = await suggestTitles(options.topic, options.type);
        spinner.stop();

        if (titles.length > 0) {
          const { title } = await inquirer.prompt([{
            type: 'list',
            name: 'title',
            message: '제목을 선택하세요:',
            choices: [
              ...titles.map(t => ({ name: t, value: t })),
              { name: chalk.dim('직접 입력'), value: '__custom__' }
            ]
          }]);

          if (title === '__custom__') {
            const { customTitle } = await inquirer.prompt([{
              type: 'input',
              name: 'customTitle',
              message: '제목을 입력하세요:',
              default: options.topic
            }]);
            selectedTitle = customTitle;
          } else {
            selectedTitle = title;
          }
        }
      }
    } else {
      console.log(chalk.dim('\n비대화 모드: 제목 추천 스킵'));
    }

    // 6. 이미지 검색 (Unsplash 키가 있는 경우) - 비대화 모드에서도 자동 검색
    let coverImage = '';
    let imageAttribution = '';
    let imageAlt = '';

    if (process.env.UNSPLASH_ACCESS_KEY) {
      let shouldSearch = true;

      if (!options.yes) {
        const { wantImage } = await inquirer.prompt([{
          type: 'confirm',
          name: 'wantImage',
          message: 'Unsplash에서 커버 이미지를 검색하시겠습니까?',
          default: true
        }]);
        shouldSearch = wantImage;
      }

      if (shouldSearch) {
        spinner.start('커버 이미지 검색 중...');
        const photo = await findImageForTopic(options.topic);
        spinner.stop();

        if (photo) {
          console.log(chalk.green(`✓ 커버 이미지 찾음: ${photo.alt_description || '이미지'}`));

          const client = new UnsplashClient();
          const { filepath, attribution } = await client.download(
            photo,
            './blog/static/images',
            `cover-${Date.now()}.jpg`
          );

          // Windows/Unix 경로 호환성 처리
          coverImage = '/' + filepath
            .replace(/\\/g, '/')
            .replace(/^\.\/blog\/static\//, '')
            .replace(/^blog\/static\//, '');
          imageAttribution = attribution;
          imageAlt = photo.alt_description || options.topic;
        } else {
          console.log(chalk.yellow('커버 이미지를 찾지 못했습니다.'));
        }
      }
    } else {
      console.log(chalk.dim('UNSPLASH_ACCESS_KEY가 설정되지 않아 커버 이미지 검색을 건너뜁니다.'));
    }

    // 7. 콘텐츠 생성
    console.log('');
    spinner.start('AI가 콘텐츠 생성 중... (약 1-2분 소요)');

    const result = await generatePost({
      topic: selectedTitle,
      type: options.type,
      keywords,
      length: options.length,
      draft: options.draft,
      outputDir: './drafts',
      coverImage: coverImage || undefined,
      coverAlt: imageAlt || undefined,
      coverCaption: imageAttribution || undefined,
      inlineImages: useInlineImages,
      imageCount,
      persona: options.agent,
      onProgress: (msg) => {
        spinner.text = msg;
      }
    });

    spinner.succeed('콘텐츠 생성 완료!');

    // 8. 결과 표시
    console.log(chalk.green('\n✅ 포스트가 생성되었습니다!\n'));
    console.log(chalk.dim('─'.repeat(50)));
    console.log(`  📄 파일: ${chalk.cyan(result.filepath)}`);
    console.log(`  📝 제목: ${chalk.white(result.frontmatter.title)}`);
    console.log(`  ✍️  작성: ${chalk.magenta(result.frontmatter.author || 'Blog Author')}${result.frontmatter.personaId ? chalk.dim(` (${result.frontmatter.personaId})`) : ''}`);
    console.log(`  🏷️  태그: ${chalk.dim(result.frontmatter.tags.join(', '))}`);
    console.log(`  📊 상태: ${result.frontmatter.draft ? chalk.yellow('초안') : chalk.green('발행 준비')}`);

    // 인라인 이미지 결과 표시
    if (result.inlineImages && result.inlineImages.length > 0) {
      console.log(`  🖼️  인라인 이미지: ${chalk.green(`${result.inlineImages.length}개 생성됨`)}`);
    }

    console.log(chalk.dim('─'.repeat(50)));

    if (imageAttribution) {
      console.log(chalk.dim(`\n커버 이미지 출처: ${imageAttribution}`));
    }

    // 9. 다음 단계 안내
    console.log(chalk.cyan('\n📌 다음 단계:'));
    console.log(`  1. 초안 검토: ${chalk.white(`npm run review -- -f ${result.filename}`)}`);
    console.log(`  2. 발행: ${chalk.white(`npm run publish -- -f ${result.filename}`)}`);

  } catch (error) {
    spinner.fail('오류 발생');
    console.error(chalk.red('\n❌ 오류:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
