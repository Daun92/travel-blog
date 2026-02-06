/**
 * moltbook 명령어: Moltbook 커뮤니티 통합
 */

import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import {
  loadMoltbookConfig,
  isMoltbookConfigured,
  MoltbookFeedbackLoop,
  MoltbookShareAgent,
  FeedbackCollector,
  FeedbackAnalyzer,
  StrategyAdjuster
} from '../../agents/moltbook/index.js';

export interface MoltbookCommandOptions {
  action: 'setup' | 'share' | 'feedback' | 'heartbeat' | 'analyze' | 'draft' | 'draft-feedback' | 'draft-status';
  file?: string;
}

export async function moltbookCommand(action: string, options: Record<string, unknown> = {}): Promise<void> {
  console.log(chalk.cyan('\n🦞 Moltbook 커뮤니티 통합\n'));

  const spinner = ora();

  switch (action) {
    case 'setup':
      await setupMoltbook();
      break;

    case 'share':
      await shareToMoltbook(options.file as string);
      break;

    case 'feedback':
      await runFeedbackCycle(spinner);
      break;

    case 'heartbeat':
      await runHeartbeat(spinner);
      break;

    case 'analyze':
      await showAnalysis(spinner);
      break;

    default:
      showHelp();
  }
}

/**
 * Moltbook 초기 설정
 */
async function setupMoltbook(): Promise<void> {
  console.log(chalk.white.bold('Moltbook 설정\n'));

  const configured = await isMoltbookConfigured();

  if (configured) {
    const config = await loadMoltbookConfig();
    console.log(chalk.green('✓ Moltbook이 이미 설정되어 있습니다.'));
    console.log(chalk.dim(`  Agent: ${config?.agentName}`));
    console.log(chalk.dim(`  API Key: ****${config?.apiKey.slice(-4)}`));

    const { reconfigure } = await inquirer.prompt([{
      type: 'confirm',
      name: 'reconfigure',
      message: '다시 설정하시겠습니까?',
      default: false
    }]);

    if (!reconfigure) return;
  }

  console.log(chalk.yellow(`
Moltbook 설정 안내:

1. https://www.moltbook.com 에서 Agent 등록
2. API 키 발급
3. 아래에 API 키 입력
  `));

  const { apiKey, agentName } = await inquirer.prompt([
    {
      type: 'input',
      name: 'agentName',
      message: 'Agent 이름:',
      default: 'TravelCuratorKR'
    },
    {
      type: 'password',
      name: 'apiKey',
      message: 'Moltbook API 키:',
      mask: '*'
    }
  ]);

  if (!apiKey) {
    console.log(chalk.yellow('\n⚠️ API 키가 입력되지 않았습니다.'));
    console.log(chalk.dim('Moltbook 없이도 블로그 자동화는 작동합니다.'));
    return;
  }

  // 설정 파일 저장
  const { writeFile, mkdir } = await import('fs/promises');
  const { join } = await import('path');

  const configDir = join(process.cwd(), 'config');
  await mkdir(configDir, { recursive: true });

  await writeFile(
    join(configDir, 'moltbook-credentials.json'),
    JSON.stringify({ api_key: apiKey, agent_name: agentName }, null, 2)
  );

  console.log(chalk.green('\n✅ Moltbook 설정 완료!'));
  console.log(chalk.dim('이제 포스트 발행 시 자동으로 Moltbook에 공유됩니다.'));
}

/**
 * Moltbook에 포스트 공유
 */
async function shareToMoltbook(file?: string): Promise<void> {
  const config = await loadMoltbookConfig();

  if (!config || !config.apiKey) {
    console.log(chalk.yellow('⚠️ Moltbook이 설정되지 않았습니다.'));
    console.log(chalk.dim('설정하려면: npm run moltbook setup'));
    return;
  }

  // 파일 선택 또는 입력
  if (!file) {
    const { title, url, summary, category, topics } = await inquirer.prompt([
      {
        type: 'input',
        name: 'title',
        message: '포스트 제목:'
      },
      {
        type: 'input',
        name: 'url',
        message: '포스트 URL:'
      },
      {
        type: 'input',
        name: 'summary',
        message: '요약 (1-2문장):'
      },
      {
        type: 'list',
        name: 'category',
        message: '카테고리:',
        choices: ['travel', 'culture']
      },
      {
        type: 'input',
        name: 'topics',
        message: '태그 (쉼표 구분):',
        default: '여행,추천'
      }
    ]);

    const shareAgent = new MoltbookShareAgent(config);
    const result = await shareAgent.sharePost({
      title,
      url,
      summary,
      category,
      topics: topics.split(',').map((t: string) => t.trim())
    });

    if (result) {
      console.log(chalk.green('\n✅ Moltbook 공유 완료!'));
      console.log(chalk.dim(`Post ID: ${result.id}`));
    }
  }
}

/**
 * 피드백 사이클 실행
 */
async function runFeedbackCycle(spinner: ReturnType<typeof ora>): Promise<void> {
  const config = await loadMoltbookConfig();

  if (!config || !config.apiKey) {
    console.log(chalk.yellow('⚠️ Moltbook이 설정되지 않았습니다.'));
    return;
  }

  const loop = new MoltbookFeedbackLoop(config);
  await loop.runFeedbackCycle();
}

/**
 * Heartbeat 실행
 */
async function runHeartbeat(spinner: ReturnType<typeof ora>): Promise<void> {
  const config = await loadMoltbookConfig();

  if (!config || !config.apiKey) {
    console.log(chalk.yellow('⚠️ Moltbook이 설정되지 않았습니다.'));
    return;
  }

  const loop = new MoltbookFeedbackLoop(config);
  await loop.heartbeat();
}

/**
 * 분석 결과 표시
 */
async function showAnalysis(spinner: ReturnType<typeof ora>): Promise<void> {
  const config = await loadMoltbookConfig();

  if (!config || !config.apiKey) {
    console.log(chalk.yellow('⚠️ Moltbook이 설정되지 않았습니다.'));
    console.log(chalk.dim('\nMoltbook 없이도 로컬 분석을 수행합니다...'));
  }

  // 로컬 전략 파일 읽기
  const adjuster = new StrategyAdjuster();
  const strategy = await adjuster.load();

  if (strategy) {
    console.log(chalk.white.bold('\n📊 현재 콘텐츠 전략\n'));
    console.log(chalk.dim('─'.repeat(50)));
    console.log(`\n🎯 우선 주제: ${strategy.priorityTopics.join(', ') || '미설정'}`);
    console.log(`📝 콘텐츠 형식: ${strategy.contentFormat}`);
    console.log(`⏰ 최적 포스팅 시간: ${strategy.optimalPostingTime}`);
    console.log(`📏 권장 글자수: ${strategy.optimalLength}자`);

    if (strategy.focusAreas.length > 0) {
      console.log(`\n💬 커뮤니티 요청:`);
      strategy.focusAreas.forEach((area, i) => {
        console.log(`   ${i + 1}. ${area}`);
      });
    }

    if (strategy.improvementPlan.length > 0) {
      console.log(`\n⚠️ 개선 필요:`);
      strategy.improvementPlan.forEach((item, i) => {
        console.log(`   ${i + 1}. ${item}`);
      });
    }

    console.log(chalk.dim(`\n마지막 업데이트: ${strategy.lastUpdated}`));
  } else {
    console.log(chalk.yellow('\n아직 분석 데이터가 없습니다.'));
    console.log(chalk.dim('피드백 수집 후 전략이 자동으로 생성됩니다.'));
  }
}

/**
 * 초안을 Moltbook에 공유 (피드백 수집용)
 */
async function shareDraft(file: string | undefined, spinner: ReturnType<typeof ora>): Promise<void> {
  const config = await loadMoltbookConfig();

  if (!config || !config.apiKey) {
    console.log(chalk.yellow('⚠️ Moltbook이 설정되지 않았습니다.'));
    console.log(chalk.dim('설정하려면: npm run moltbook setup'));
    return;
  }

  const { readFile } = await import('fs/promises');
  const matter = (await import('gray-matter')).default;
  const { glob } = await import('glob');

  // 파일 선택
  let filePath = file;
  if (!filePath) {
    const draftFiles = await glob('drafts/**/*.md');

    if (draftFiles.length === 0) {
      console.log(chalk.yellow('초안 파일이 없습니다.'));
      return;
    }

    const { selectedFile } = await inquirer.prompt([{
      type: 'list',
      name: 'selectedFile',
      message: '공유할 초안 선택:',
      choices: draftFiles.map(f => ({ name: f, value: f }))
    }]);

    filePath = selectedFile;
  }

  if (!filePath) {
    console.log(chalk.red('파일을 선택해주세요.'));
    return;
  }

  spinner.start('초안 읽는 중...');

  try {
    const content = await readFile(filePath, 'utf-8');
    const { data: frontmatter, content: body } = matter(content);

    const title = frontmatter.title as string || 'Untitled';
    const category = (frontmatter.categories?.includes?.('culture') || frontmatter.type === 'culture') ? 'culture' : 'travel';
    const topics = [...(frontmatter.tags || []), ...(frontmatter.keywords || [])] as string[];

    // 요약 생성 (본문 첫 500자)
    const summary = body.replace(/^#.*$/gm, '').trim().slice(0, 500) + '...';

    spinner.text = 'Moltbook에 초안 공유 중...';

    const loop = new MoltbookFeedbackLoop(config);
    const result = await loop.shareDraft({
      title,
      summary,
      filePath,
      category: category as 'travel' | 'culture',
      topics
    });

    if (result) {
      spinner.succeed(chalk.green('초안 공유 완료!'));
      console.log(chalk.dim(`Draft ID: ${result.draftId}`));
      console.log(chalk.dim(`Post ID: ${result.postId}`));
      console.log(chalk.yellow('\n💡 12-24시간 후 피드백을 수집하세요:'));
      console.log(chalk.dim('   npm run moltbook draft-feedback'));
    } else {
      spinner.fail('초안 공유 실패');
    }
  } catch (error) {
    spinner.fail(`오류: ${error instanceof Error ? error.message : error}`);
  }
}

/**
 * 초안 피드백 수집
 */
async function collectDraftFeedback(spinner: ReturnType<typeof ora>): Promise<void> {
  const config = await loadMoltbookConfig();

  if (!config || !config.apiKey) {
    console.log(chalk.yellow('⚠️ Moltbook이 설정되지 않았습니다.'));
    return;
  }

  spinner.start('초안 피드백 수집 중...');

  try {
    const loop = new MoltbookFeedbackLoop(config);
    const feedbacks = await loop.collectDraftFeedback();

    if (feedbacks.length === 0) {
      spinner.info('수집할 대기 중인 초안 피드백이 없습니다.');
      return;
    }

    spinner.succeed(`${feedbacks.length}개 초안 피드백 수집 완료`);

    console.log(chalk.cyan('\n📊 초안 피드백 요약\n'));

    for (const fb of feedbacks) {
      const sentimentEmoji = fb.sentiment === 'positive' ? '😊'
        : fb.sentiment === 'negative' ? '😟'
          : '😐';

      console.log(chalk.white.bold(`${fb.blogTitle}`));
      console.log(chalk.dim(`  └ 상태: ${fb.status}`));
      console.log(chalk.dim(`  └ 투표: 👍 ${fb.upvotes} / 👎 ${fb.downvotes}`));
      console.log(chalk.dim(`  └ 댓글: ${fb.comments.length}개`));
      console.log(chalk.dim(`  └ 감정: ${sentimentEmoji} ${fb.sentiment}`));

      if (fb.suggestions.length > 0) {
        console.log(chalk.yellow(`  └ 제안: ${fb.suggestions.length}개`));
        fb.suggestions.slice(0, 3).forEach(s => {
          console.log(chalk.gray(`      - ${s.slice(0, 60)}...`));
        });
      }

      // 발행 권장 여부 판단
      const evaluation = await loop.evaluateDraftForPublish(fb);
      const evalColor = evaluation.shouldPublish ? 'green' : 'yellow';
      console.log(chalk[evalColor](`  └ 판정: ${evaluation.reason}`));

      console.log('');
    }
  } catch (error) {
    spinner.fail(`오류: ${error instanceof Error ? error.message : error}`);
  }
}

/**
 * 초안 피드백 상태 확인
 */
async function showDraftStatus(spinner: ReturnType<typeof ora>): Promise<void> {
  const config = await loadMoltbookConfig();

  if (!config || !config.apiKey) {
    console.log(chalk.yellow('⚠️ Moltbook이 설정되지 않았습니다.'));
    return;
  }

  spinner.start('초안 상태 확인 중...');

  try {
    const loop = new MoltbookFeedbackLoop(config);
    const pendingDrafts = await loop.getPendingDrafts();

    spinner.stop();

    console.log(chalk.cyan('\n📋 초안 피드백 대기 목록\n'));

    if (pendingDrafts.length === 0) {
      console.log(chalk.gray('대기 중인 초안이 없습니다.'));
      return;
    }

    for (const draft of pendingDrafts) {
      const sharedDate = new Date(draft.sharedAt);
      const hoursPassed = Math.round((Date.now() - sharedDate.getTime()) / (1000 * 60 * 60));

      console.log(chalk.white(`${draft.blogTitle}`));
      console.log(chalk.dim(`  └ 상태: ${draft.status}`));
      console.log(chalk.dim(`  └ 공유: ${hoursPassed}시간 전`));
      console.log(chalk.dim(`  └ Draft ID: ${draft.draftId}`));
      console.log('');
    }

    console.log(chalk.yellow('💡 피드백 수집: npm run moltbook draft-feedback'));
  } catch (error) {
    spinner.fail(`오류: ${error instanceof Error ? error.message : error}`);
  }
}

/**
 * 도움말 표시
 */
function showHelp(): void {
  console.log(`
${chalk.white.bold('사용법:')}

  ${chalk.cyan('npm run moltbook setup')}           - Moltbook 초기 설정
  ${chalk.cyan('npm run moltbook share')}           - 포스트 공유
  ${chalk.cyan('npm run moltbook feedback')}        - 피드백 수집 & 분석
  ${chalk.cyan('npm run moltbook heartbeat')}       - 빠른 상태 체크
  ${chalk.cyan('npm run moltbook analyze')}         - 현재 전략 확인

${chalk.white.bold('초안 피드백 (발행 전 검증):')}

  ${chalk.cyan('npm run moltbook draft')}           - 초안을 Moltbook에 공유
  ${chalk.cyan('npm run moltbook draft-feedback')}  - 초안 피드백 수집
  ${chalk.cyan('npm run moltbook draft-status')}    - 초안 피드백 상태 확인

${chalk.white.bold('Moltbook이란?')}

  AI 에이전트 커뮤니티 플랫폼입니다.
  블로그 포스트를 공유하고 다른 AI 에이전트들의
  피드백을 받아 콘텐츠 품질을 개선할 수 있습니다.

  자세한 정보: https://www.moltbook.com
  `);
}
