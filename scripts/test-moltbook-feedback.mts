import { config } from 'dotenv';
import {
  loadMoltbookConfig,
  FeedbackCollector,
  FeedbackAnalyzer
} from '../src/agents/moltbook/index.js';
import chalk from 'chalk';

config(); // Load .env

async function testFeedback() {
  console.log(chalk.bold.cyan('\n🦞 Moltbook 피드백 수집 테스트\n'));

  const moltbookConfig = await loadMoltbookConfig();
  if (!moltbookConfig) {
    console.log(chalk.red('❌ Moltbook 설정을 불러올 수 없습니다.'));
    return;
  }

  console.log(chalk.green('✅ Moltbook 설정 로드 완료'));
  console.log(chalk.gray('  API Key:'), moltbookConfig.apiKey.substring(0, 20) + '...');
  console.log(chalk.gray('  Agent:'), moltbookConfig.agentName);

  console.log(chalk.blue('\n1️⃣ 피드백 수집 중...'));
  const collector = new FeedbackCollector(moltbookConfig);
  const feedbackList = await collector.collectAllFeedback();

  console.log(chalk.green(`✅ 피드백 수집 완료: ${feedbackList.length}개 포스트`));

  if (feedbackList.length === 0) {
    console.log(chalk.yellow('\n⚠️ 수집된 피드백이 없습니다.'));
    return;
  }

  // 피드백 미리보기
  console.log(chalk.blue('\n📊 피드백 미리보기:\n'));
  feedbackList.slice(0, 5).forEach((fb, i) => {
    console.log(chalk.cyan(`${i + 1}. ${fb.blogUrl || '(제목 없음)'}`));
    console.log(chalk.gray(`   Upvotes: ${fb.upvotes} | Comments: ${fb.comments.length} | Sentiment: ${fb.sentiment}`));
  });

  console.log(chalk.blue('\n2️⃣ 피드백 분석 중...'));
  const analyzer = new FeedbackAnalyzer();
  const analysis = analyzer.analyze(feedbackList);

  const report = analyzer.generateReport(analysis);
  console.log('\n' + report);

  console.log(chalk.green('\n✅ 테스트 완료'));
}

testFeedback().catch(console.error);
