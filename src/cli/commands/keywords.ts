/**
 * keywords 명령어: 트렌드 키워드 추천
 */

import chalk from 'chalk';
import ora from 'ora';
import { recommendKeywords, checkOllamaStatus } from '../../generator/index.js';

export interface KeywordsCommandOptions {
  category: 'travel' | 'culture' | 'all';
}

export async function keywordsCommand(options: KeywordsCommandOptions): Promise<void> {
  console.log(chalk.cyan('\n🔍 트렌드 키워드 추천\n'));

  const spinner = ora();

  try {
    // Ollama 상태 확인
    spinner.start('Ollama 서버 연결 확인 중...');
    const isOnline = await checkOllamaStatus();

    if (!isOnline) {
      spinner.fail('Ollama 서버에 연결할 수 없습니다.');
      console.log(chalk.yellow('\n💡 Ollama를 시작하려면: ollama serve'));
      process.exit(1);
    }
    spinner.succeed('Ollama 서버 연결됨');

    // 카테고리 표시
    const categoryName = options.category === 'all'
      ? '전체'
      : options.category === 'travel'
        ? '여행'
        : '문화예술';

    console.log(chalk.dim(`\n카테고리: ${categoryName}`));

    // 키워드 추천 요청
    spinner.start('AI가 키워드 분석 중... (30초-1분 소요)');
    const keywords = await recommendKeywords(options.category);
    spinner.stop();

    if (keywords.length === 0) {
      console.log(chalk.yellow('\n키워드를 추천받지 못했습니다. 다시 시도해주세요.'));
      return;
    }

    // 결과 출력
    console.log(chalk.green(`\n✅ ${keywords.length}개 키워드 추천\n`));
    console.log(chalk.dim('─'.repeat(70)));

    // 카테고리별 그룹화
    const travelKeywords = keywords.filter(k => k.category === 'travel');
    const cultureKeywords = keywords.filter(k => k.category === 'culture');

    if (travelKeywords.length > 0) {
      console.log(chalk.blue('\n🧳 여행 키워드\n'));
      for (const kw of travelKeywords) {
        const difficultyColor = kw.difficulty === 'low'
          ? chalk.green
          : kw.difficulty === 'medium'
            ? chalk.yellow
            : chalk.red;

        console.log(`  ${chalk.white.bold(kw.keyword)}`);
        console.log(`  ${chalk.dim('난이도:')} ${difficultyColor(kw.difficulty)}`);
        console.log(`  ${chalk.dim('이유:')} ${kw.reason}`);
        console.log('');
      }
    }

    if (cultureKeywords.length > 0) {
      console.log(chalk.magenta('\n🎨 문화예술 키워드\n'));
      for (const kw of cultureKeywords) {
        const difficultyColor = kw.difficulty === 'low'
          ? chalk.green
          : kw.difficulty === 'medium'
            ? chalk.yellow
            : chalk.red;

        console.log(`  ${chalk.white.bold(kw.keyword)}`);
        console.log(`  ${chalk.dim('난이도:')} ${difficultyColor(kw.difficulty)}`);
        console.log(`  ${chalk.dim('이유:')} ${kw.reason}`);
        console.log('');
      }
    }

    console.log(chalk.dim('─'.repeat(70)));

    // 사용 방법 안내
    console.log(chalk.cyan('\n💡 사용 방법:'));
    console.log(chalk.dim('  npm run new -- -t "키워드" --type travel'));
    console.log(chalk.dim('  npm run new -- -t "키워드" --type culture'));

    // 난이도 설명
    console.log(chalk.dim('\n📊 난이도 설명:'));
    console.log(chalk.green('  • low: 경쟁 낮음 - 빠른 상위 노출 가능'));
    console.log(chalk.yellow('  • medium: 경쟁 보통 - 양질의 콘텐츠 필요'));
    console.log(chalk.red('  • high: 경쟁 높음 - 차별화된 콘텐츠 필요'));

  } catch (error) {
    spinner.fail('오류 발생');
    console.error(chalk.red('\n❌ 오류:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
