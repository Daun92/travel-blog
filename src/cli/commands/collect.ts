/**
 * collect 명령어: 데이터 수집
 */

import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { collectData, getTrendKeywords, dataToPromptContext } from '../../agents/collector.js';

export interface CollectCommandOptions {
  keyword?: string;
  type?: 'travel' | 'culture';
}

export async function collectCommand(options: CollectCommandOptions): Promise<void> {
  console.log(chalk.cyan('\n🔍 데이터 수집\n'));

  const spinner = ora();

  try {
    // 키워드 입력
    let keyword = options.keyword;

    if (!keyword) {
      // 트렌드 키워드 먼저 보여주기
      console.log(chalk.white.bold('📈 현재 트렌드 키워드:\n'));

      const travelTrends = await getTrendKeywords('travel');
      const cultureTrends = await getTrendKeywords('culture');

      console.log(chalk.blue('🧳 여행:'));
      console.log('   ' + travelTrends.slice(0, 5).join(', '));

      console.log(chalk.magenta('\n🎨 문화예술:'));
      console.log('   ' + cultureTrends.slice(0, 5).join(', '));

      console.log('');

      const { selectedKeyword, customKeyword } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedKeyword',
          message: '키워드를 선택하세요:',
          choices: [
            ...travelTrends.slice(0, 3).map(k => ({ name: `🧳 ${k}`, value: k })),
            ...cultureTrends.slice(0, 3).map(k => ({ name: `🎨 ${k}`, value: k })),
            { name: chalk.dim('직접 입력'), value: '__custom__' }
          ]
        },
        {
          type: 'input',
          name: 'customKeyword',
          message: '키워드를 입력하세요:',
          when: (answers) => answers.selectedKeyword === '__custom__'
        }
      ]);

      keyword = customKeyword || selectedKeyword;
    }

    if (!keyword) {
      throw new Error('키워드가 선택되지 않았습니다.');
    }

    // 데이터 수집
    spinner.start(`"${keyword}" 데이터 수집 중...`);

    const data = await collectData(keyword);

    spinner.succeed('데이터 수집 완료!');

    // 결과 표시
    console.log(chalk.dim('\n─'.repeat(50)));

    console.log(chalk.white.bold('\n📊 수집 결과\n'));

    console.log(`• 키워드: ${chalk.cyan(data.keyword)}`);
    console.log(`• 관광지: ${chalk.green(data.tourismData.length)}개`);
    console.log(`• 축제/행사: ${chalk.green(data.festivals?.length ?? 0)}개`);
    console.log(`• 문화행사: ${chalk.green(data.cultureEvents.length)}개`);
    console.log(`• 트렌드 키워드: ${chalk.green(data.trendKeywords.length)}개`);

    // 관광지 목록
    if (data.tourismData.length > 0) {
      console.log(chalk.white.bold('\n🏛️ 관광지'));
      data.tourismData.slice(0, 5).forEach((item, i) => {
        console.log(`   ${i + 1}. ${item.title}`);
        console.log(chalk.dim(`      ${item.address}`));
      });
    }

    // 문화행사 목록
    if (data.cultureEvents.length > 0) {
      console.log(chalk.white.bold('\n🎭 문화행사'));
      data.cultureEvents.slice(0, 5).forEach((item, i) => {
        console.log(`   ${i + 1}. ${item.title}`);
        console.log(chalk.dim(`      ${item.place} | ${item.startDate} ~ ${item.endDate}`));
      });
    }

    console.log(chalk.dim('\n─'.repeat(50)));

    // 다음 단계
    const { nextAction } = await inquirer.prompt([{
      type: 'list',
      name: 'nextAction',
      message: '다음 작업:',
      choices: [
        { name: '📝 이 데이터로 포스트 생성', value: 'generate' },
        { name: '💾 프롬프트 컨텍스트 복사', value: 'copy' },
        { name: '🔍 다른 키워드 수집', value: 'another' },
        { name: '❌ 종료', value: 'exit' }
      ]
    }]);

    switch (nextAction) {
      case 'generate':
        console.log(chalk.cyan('\n💡 포스트를 생성하려면:'));
        console.log(chalk.dim(`   npm run new -- -t "${keyword}" --type travel`));
        break;

      case 'copy':
        const context = dataToPromptContext(data);
        console.log(chalk.white.bold('\n📋 프롬프트 컨텍스트:\n'));
        console.log(chalk.dim('─'.repeat(50)));
        console.log(context);
        console.log(chalk.dim('─'.repeat(50)));
        console.log(chalk.dim('\n위 내용을 Gemini 프롬프트에 포함하여 사용하세요.'));
        break;

      case 'another':
        await collectCommand({});
        break;

      case 'exit':
        console.log(chalk.dim('\n종료합니다.'));
        break;
    }

  } catch (error) {
    spinner.fail('오류 발생');
    console.error(chalk.red('\n❌ 오류:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
