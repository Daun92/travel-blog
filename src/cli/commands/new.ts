/**
 * new 명령어: 새 블로그 포스트 생성
 */

import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { generatePost, suggestTitles, checkGeminiStatus } from '../../generator/index.js';
import { GeminiImageClient } from '../../images/gemini-imagen.js';
import { selectCoverImage } from '../../images/image-orchestrator.js';
import { extractKtoImages } from '../../images/kto-images.js';
import { collectData, dataToPromptContext, type CollectedData } from '../../agents/collector.js';
import { factCheckFile, summarizeReport } from '../../factcheck/index.js';

export interface NewCommandOptions {
  topic: string;
  type: 'travel' | 'culture';
  keywords?: string;
  length: 'short' | 'medium' | 'long';
  draft: boolean;
  yes?: boolean; // 비대화 모드
  inlineImages?: boolean; // 인라인 이미지 생성
  imageCount?: number; // 인라인 이미지 개수
  agent?: string; // 에이전트 페르소나 ID (viral|friendly|informative|niche)
  framingType?: string; // 콘텐츠 프레이밍 유형 (list_ranking|deep_dive|experience|...)
  autoCollect?: boolean; // 자동 데이터 수집 후 프롬프트에 주입
  autoFactcheck?: boolean; // 생성 후 자동 팩트체크 실행
}

export async function newCommand(options: NewCommandOptions): Promise<void> {
  console.log(chalk.cyan('\n📝 새 블로그 포스트 생성\n'));

  const spinner = ora();

  try {
    // 1. Gemini API 상태 확인
    spinner.start('Gemini API 연결 확인 중...');
    const isOnline = await checkGeminiStatus();

    if (!isOnline) {
      spinner.fail('Gemini API에 연결할 수 없습니다.');
      console.log(chalk.yellow('\n💡 .env에 GEMINI_API_KEY를 설정하세요.'));
      process.exit(1);
    }
    spinner.succeed('Gemini API 연결됨');

    // 2. 옵션 확인
    console.log(chalk.dim('\n입력된 옵션:'));
    console.log(`  • 주제: ${chalk.white(options.topic)}`);
    console.log(`  • 유형: ${chalk.white(options.type === 'travel' ? '여행' : '문화예술')}`);
    console.log(`  • 길이: ${chalk.white(options.length)}`);
    console.log(`  • 초안: ${chalk.white(options.draft ? '예' : '아니오')}`);
    if (options.agent) {
      console.log(`  • 에이전트: ${chalk.magenta(options.agent)} (수동 지정)`);
    }
    if (options.framingType) {
      console.log(`  • 프레이밍: ${chalk.blue(options.framingType)}`);
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

    // 6. 데이터 자동 수집 (--auto-collect) — 커버 이미지 전에 실행
    let collectedDataContext: string | undefined;
    let collectedDataRaw: CollectedData | undefined;
    if (options.autoCollect) {
      console.log('');
      spinner.start(`"${options.topic}" 관련 데이터 수집 중 (data.go.kr)...`);
      try {
        const collected = await collectData(options.topic);
        collectedDataRaw = collected;
        collectedDataContext = dataToPromptContext(collected);
        const stats = [
          collected.tourismData.length > 0 ? `관광지 ${collected.tourismData.length}` : '',
          collected.festivals.length > 0 ? `축제 ${collected.festivals.length}` : '',
          collected.cultureEvents.length > 0 ? `문화행사 ${collected.cultureEvents.length}` : '',
        ].filter(Boolean).join(', ');
        spinner.succeed(`데이터 수집 완료: ${stats}`);
      } catch (error) {
        spinner.warn(`데이터 수집 실패: ${error instanceof Error ? error.message : error}`);
        console.log(chalk.dim('  수집 데이터 없이 계속 진행합니다.'));
      }
    }

    // 7. 커버 이미지 검색 — KTO 우선, Unsplash 폴백
    let coverImage = '';
    let imageAttribution = '';
    let imageAlt = '';
    let ktoImagesUsed = false;

    // 대화 모드에서 Unsplash 검색 여부 확인
    let shouldSearchCover = true;
    if (!options.yes && !collectedDataRaw && process.env.UNSPLASH_ACCESS_KEY) {
      const { wantImage } = await inquirer.prompt([{
        type: 'confirm',
        name: 'wantImage',
        message: 'Unsplash에서 커버 이미지를 검색하시겠습니까?',
        default: true
      }]);
      shouldSearchCover = wantImage;
    }

    if (shouldSearchCover) {
      const coverSlug = selectedTitle.replace(/\s+/g, '-').toLowerCase();
      spinner.start('커버 이미지 검색 중...');
      const coverResult = await selectCoverImage({
        topic: selectedTitle,
        type: options.type,
        collectedData: collectedDataRaw,
        persona: options.agent,
        keywords,
        slug: coverSlug,
        interactive: !options.yes,
        onProgress: (msg) => { spinner.text = msg; }
      });
      spinner.stop();

      if (coverResult) {
        const sourceLabel = coverResult.ktoImagesUsed ? 'KTO' : 'Unsplash';
        console.log(chalk.green(`✓ ${sourceLabel} 커버 이미지: ${coverResult.imageAlt}`));
        coverImage = coverResult.coverImage;
        imageAttribution = coverResult.imageAttribution;
        imageAlt = coverResult.imageAlt;
        ktoImagesUsed = coverResult.ktoImagesUsed;
      } else if (!process.env.UNSPLASH_ACCESS_KEY && !collectedDataRaw) {
        console.log(chalk.dim('UNSPLASH_ACCESS_KEY가 설정되지 않아 커버 이미지 검색을 건너뜁니다.'));
      } else {
        console.log(chalk.yellow('커버 이미지를 찾지 못했습니다.'));
      }
    }

    // 8. 콘텐츠 생성
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
      framingType: options.framingType,
      collectedData: collectedDataContext,
      collectedImages: collectedDataRaw
        ? extractKtoImages(collectedDataRaw)
        : undefined,
      ktoImagesUsed,
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

    // 9. 자동 팩트체크 (옵션)
    if (options.autoFactcheck) {
      console.log('');
      spinner.start('자동 팩트체크 실행 중...');
      try {
        const report = await factCheckFile(result.filepath, {
          onProgress: (current, total) => {
            spinner.text = `팩트체크 중... (${current}/${total})`;
          }
        });
        spinner.stop();
        console.log(summarizeReport(report));

        if (report.overallScore < 70) {
          console.log(chalk.red(`⚠️  팩트체크 점수 ${report.overallScore}%로 70% 미만입니다.`));
          console.log(chalk.yellow('   발행 전 반드시 사실 관계를 확인하세요.'));
        }
      } catch (fcError) {
        spinner.warn('팩트체크 실패 (생성된 포스트는 정상 저장됨)');
        console.log(chalk.dim(`  사유: ${fcError instanceof Error ? fcError.message : String(fcError)}`));
      }
    }

    // 10. 다음 단계 안내
    console.log(chalk.cyan('\n📌 다음 단계:'));
    if (!options.autoFactcheck) {
      console.log(`  1. 향상: ${chalk.white(`npm run enhance -- -f ${result.filepath}`)}`);
      console.log(`  2. 팩트체크: ${chalk.white(`npm run factcheck -- -f ${result.filepath}`)}`);
      console.log(`  3. AEO 적용: ${chalk.white(`npm run aeo -- -f ${result.filepath} --apply`)}`);
      console.log(`  4. 발행: ${chalk.white(`npm run publish -- -f ${result.filename}`)}`);
    } else {
      console.log(`  1. 향상: ${chalk.white(`npm run enhance -- -f ${result.filepath}`)}`);
      console.log(`  2. AEO 적용: ${chalk.white(`npm run aeo -- -f ${result.filepath} --apply`)}`);
      console.log(`  3. 발행: ${chalk.white(`npm run publish -- -f ${result.filename}`)}`);
    }

  } catch (error) {
    spinner.fail('오류 발생');
    console.error(chalk.red('\n❌ 오류:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
