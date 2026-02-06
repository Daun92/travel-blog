/**
 * 모니터링 CLI 명령어
 * 포스트 성과 추적 및 신선도 관리
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import PerformanceTracker from '../../monitoring/performance-tracker.js';
import FreshnessChecker from '../../monitoring/freshness-checker.js';
import UpdateSuggester from '../../monitoring/update-suggester.js';

export const monitorCommand = new Command('monitor')
  .description('포스트 성과 및 신선도 모니터링')
  .argument('[action]', '실행할 작업 (performance|freshness|updates|dashboard)', 'dashboard')
  .option('-f, --file <path>', '특정 포스트 분석')
  .option('--update', '데이터 새로고침')
  .option('-v, --verbose', '상세 출력')
  .option('--json', 'JSON 형식 출력')
  .action(async (action, options) => {
    try {
      console.log(chalk.cyan('\n📊 콘텐츠 모니터링\n'));

      switch (action) {
        case 'performance':
          await runPerformanceAnalysis(options);
          break;

        case 'freshness':
          await runFreshnessAnalysis(options);
          break;

        case 'updates':
          await runUpdateAnalysis(options);
          break;

        case 'dashboard':
        default:
          await runDashboard(options);
          break;
      }

    } catch (error) {
      console.error(chalk.red('\n❌ 모니터링 오류:'), error);
      process.exit(1);
    }
  });

/**
 * 성과 분석
 */
async function runPerformanceAnalysis(options: {
  file?: string;
  update?: boolean;
  verbose?: boolean;
  json?: boolean;
}): Promise<void> {
  const tracker = new PerformanceTracker();
  await tracker.load();

  if (options.update) {
    const spinner = ora('성과 데이터 업데이트 중...').start();
    const count = await tracker.updateAll();
    spinner.succeed(`${count}개 포스트 성과 업데이트 완료`);
  }

  if (options.file) {
    const performance = tracker.getPostPerformance(options.file);

    if (!performance) {
      console.log(chalk.yellow(`포스트를 찾을 수 없습니다: ${options.file}`));
      return;
    }

    if (options.json) {
      console.log(JSON.stringify(performance, null, 2));
      return;
    }

    console.log(chalk.white.bold(`📈 ${performance.title}`));
    console.log('─'.repeat(50));
    console.log(`  점수: ${performance.score}/100`);
    console.log(`  트렌드: ${formatTrend(performance.trend)}`);
    console.log(`  조회수: ${performance.metrics.views}`);
    console.log(`  평균 체류 시간: ${Math.round(performance.metrics.avgTimeOnPage)}초`);
    console.log(`  Moltbook upvotes: ${performance.engagement.moltbookUpvotes}`);
    console.log(`  댓글: ${performance.engagement.moltbookComments}`);
    return;
  }

  // 리포트 생성
  const report = await tracker.generateReport();

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(chalk.white.bold('📈 성과 리포트'));
  console.log('━'.repeat(50));
  console.log(`총 포스트: ${report.totalPosts}개`);
  console.log(`평균 점수: ${report.avgScore}/100`);
  console.log('');

  if (report.topPosts.length > 0) {
    console.log(chalk.green.bold('🏆 상위 포스트'));
    for (const post of report.topPosts.slice(0, 5)) {
      console.log(`  ${formatTrend(post.trend)} ${post.title} (${post.score}점)`);
    }
    console.log('');
  }

  if (report.lowPosts.length > 0) {
    console.log(chalk.yellow.bold('⚠️ 저성과 포스트'));
    for (const post of report.lowPosts.slice(0, 5)) {
      console.log(`  ${formatTrend(post.trend)} ${post.title} (${post.score}점)`);
    }
    console.log('');
  }

  console.log(chalk.white.bold('📁 카테고리별'));
  for (const [cat, stats] of Object.entries(report.byCategory)) {
    console.log(`  ${cat}: ${stats.count}개, 평균 ${stats.avgScore}점`);
  }
  console.log('');

  if (report.insights.length > 0) {
    console.log(chalk.cyan.bold('💡 인사이트'));
    for (const insight of report.insights) {
      console.log(`  ${insight}`);
    }
  }
}

/**
 * 신선도 분석
 */
async function runFreshnessAnalysis(options: {
  file?: string;
  update?: boolean;
  verbose?: boolean;
  json?: boolean;
}): Promise<void> {
  const checker = new FreshnessChecker();
  await checker.load();

  if (options.update) {
    const spinner = ora('신선도 검사 중...').start();
    const count = await checker.checkAll();
    spinner.succeed(`${count}개 포스트 신선도 검사 완료`);
  }

  if (options.file) {
    const freshness = checker.getPostFreshness(options.file);

    if (!freshness) {
      console.log(chalk.yellow(`포스트를 찾을 수 없습니다: ${options.file}`));
      return;
    }

    if (options.json) {
      console.log(JSON.stringify(freshness, null, 2));
      return;
    }

    console.log(chalk.white.bold(`🌿 ${freshness.title}`));
    console.log('─'.repeat(50));
    console.log(`  신선도 점수: ${freshness.freshnessScore}/100`);
    console.log(`  우선순위: ${formatPriority(freshness.priority)}`);
    console.log(`  발행 후 경과: ${freshness.daysSincePublish}일`);

    if (freshness.outdatedIndicators.length > 0) {
      console.log(`\n  ⚠️ 오래된 지표:`);
      for (const indicator of freshness.outdatedIndicators) {
        const severity = indicator.severity === 'high' ? '🔴' :
                        indicator.severity === 'medium' ? '🟡' : '🟢';
        console.log(`    ${severity} ${indicator.message}`);
      }
    }

    if (freshness.updateSuggestions.length > 0) {
      console.log(`\n  💡 업데이트 제안:`);
      for (const suggestion of freshness.updateSuggestions) {
        console.log(`    • ${suggestion.description}`);
      }
    }
    return;
  }

  // 리포트 생성
  const report = await checker.generateReport();

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(chalk.white.bold('🌿 신선도 리포트'));
  console.log('━'.repeat(50));
  console.log(`총 포스트: ${report.totalPosts}개`);
  console.log(`평균 신선도: ${report.avgFreshness}/100`);
  console.log(`신선한 포스트: ${report.freshPosts}개`);
  console.log(`오래된 포스트: ${report.outdatedPosts}개`);
  console.log('');

  console.log(chalk.white.bold('📊 우선순위별'));
  console.log(`  🔴 긴급: ${report.byPriority.urgent || 0}개`);
  console.log(`  🟠 높음: ${report.byPriority.high || 0}개`);
  console.log(`  🟡 중간: ${report.byPriority.medium || 0}개`);
  console.log(`  🟢 낮음: ${report.byPriority.low || 0}개`);
  console.log('');

  if (report.urgentPosts.length > 0) {
    console.log(chalk.red.bold('🚨 즉시 업데이트 필요'));
    for (const post of report.urgentPosts.slice(0, 5)) {
      console.log(`  ${formatPriority(post.priority)} ${post.title}`);
      console.log(`    신선도: ${post.freshnessScore}점, ${post.daysSincePublish}일 전`);
    }
  }
}

/**
 * 업데이트 제안 분석
 */
async function runUpdateAnalysis(options: {
  file?: string;
  update?: boolean;
  verbose?: boolean;
  json?: boolean;
}): Promise<void> {
  const suggester = new UpdateSuggester();
  await suggester.load();

  if (options.update) {
    const spinner = ora('업데이트 계획 생성 중...').start();

    const freshnessChecker = new FreshnessChecker();
    await freshnessChecker.load();
    await freshnessChecker.checkAll();

    const performanceTracker = new PerformanceTracker();
    await performanceTracker.load();

    const postsNeedingUpdate = freshnessChecker.getPostsNeedingUpdate('high');
    let generated = 0;

    for (const freshness of postsNeedingUpdate) {
      const performance = performanceTracker.getPostPerformance(freshness.postPath) || undefined;
      await suggester.generateUpdatePlan(freshness, performance);
      generated++;
    }

    spinner.succeed(`${generated}개 업데이트 계획 생성 완료`);
  }

  if (options.file) {
    const plan = suggester.getUpdatePlan(options.file);

    if (!plan) {
      console.log(chalk.yellow(`업데이트 계획이 없습니다: ${options.file}`));

      // 즉시 생성
      const freshnessChecker = new FreshnessChecker();
      await freshnessChecker.load();
      const freshness = freshnessChecker.getPostFreshness(options.file);

      if (freshness) {
        console.log(chalk.dim('새 계획을 생성합니다...'));
        const newPlan = await suggester.generateUpdatePlan(freshness);
        console.log(suggester.formatPlan(newPlan));
      }
      return;
    }

    if (options.json) {
      console.log(JSON.stringify(plan, null, 2));
      return;
    }

    console.log(suggester.formatPlan(plan));
    return;
  }

  // 업데이트 큐 표시
  const queue = suggester.getUpdateQueue(10);

  if (queue.length === 0) {
    console.log(chalk.green('업데이트가 필요한 포스트가 없습니다.'));
    console.log(chalk.dim('npm run monitor updates --update 로 분석을 실행하세요.'));
    return;
  }

  if (options.json) {
    console.log(JSON.stringify(queue, null, 2));
    return;
  }

  console.log(chalk.white.bold('📋 업데이트 큐'));
  console.log('━'.repeat(50));

  for (const plan of queue) {
    const effort = plan.estimatedEffort === 'high' ? '🔴' :
                  plan.estimatedEffort === 'medium' ? '🟡' : '🟢';

    console.log(`\n${effort} [${plan.priority}/10] ${plan.title}`);
    console.log(chalk.dim(`   유형: ${plan.updateType}, 노력: ${plan.estimatedEffort}, 예상 효과: ${plan.expectedImpact}`));

    if (options.verbose && plan.sections.length > 0) {
      for (const section of plan.sections.slice(0, 2)) {
        console.log(chalk.dim(`   • ${section.section}: ${section.action}`));
      }
    }
  }

  console.log(chalk.dim(`\n총 ${queue.length}개 포스트 업데이트 대기 중`));
}

/**
 * 대시보드
 */
async function runDashboard(options: {
  update?: boolean;
  verbose?: boolean;
  json?: boolean;
}): Promise<void> {
  const performanceTracker = new PerformanceTracker();
  const freshnessChecker = new FreshnessChecker();
  const suggester = new UpdateSuggester();

  await Promise.all([
    performanceTracker.load(),
    freshnessChecker.load(),
    suggester.load()
  ]);

  if (options.update) {
    const spinner = ora('데이터 새로고침 중...').start();

    await performanceTracker.updateAll();
    await freshnessChecker.checkAll();

    const postsNeedingUpdate = freshnessChecker.getPostsNeedingUpdate('high');
    for (const freshness of postsNeedingUpdate.slice(0, 10)) {
      const performance = performanceTracker.getPostPerformance(freshness.postPath) || undefined;
      await suggester.generateUpdatePlan(freshness, performance);
    }

    spinner.succeed('데이터 새로고침 완료');
  }

  const perfReport = await performanceTracker.generateReport();
  const freshReport = await freshnessChecker.generateReport();
  const updateQueue = suggester.getUpdateQueue(5);

  if (options.json) {
    console.log(JSON.stringify({
      performance: perfReport,
      freshness: freshReport,
      updateQueue
    }, null, 2));
    return;
  }

  // 대시보드 출력
  console.log(chalk.cyan.bold('━'.repeat(50)));
  console.log(chalk.cyan.bold('          📊 콘텐츠 모니터링 대시보드'));
  console.log(chalk.cyan.bold('━'.repeat(50)));

  // 요약
  console.log(chalk.white.bold('\n📈 성과 요약'));
  console.log(`  총 포스트: ${perfReport.totalPosts}개`);
  console.log(`  평균 점수: ${perfReport.avgScore}/100`);

  console.log(chalk.white.bold('\n🌿 신선도 요약'));
  console.log(`  평균 신선도: ${freshReport.avgFreshness}/100`);
  console.log(`  오래된 포스트: ${freshReport.outdatedPosts}개`);
  console.log(`  긴급 업데이트: ${freshReport.byPriority.urgent || 0}개`);

  // 상위 성과
  if (perfReport.topPosts.length > 0) {
    console.log(chalk.green.bold('\n🏆 상위 성과 (TOP 3)'));
    for (const post of perfReport.topPosts.slice(0, 3)) {
      console.log(`  ${formatTrend(post.trend)} ${post.title.substring(0, 30)}... (${post.score}점)`);
    }
  }

  // 업데이트 필요
  if (updateQueue.length > 0) {
    console.log(chalk.yellow.bold('\n⚠️ 업데이트 필요'));
    for (const plan of updateQueue.slice(0, 3)) {
      console.log(`  [${plan.priority}/10] ${plan.title.substring(0, 30)}...`);
    }
  }

  // 인사이트
  if (perfReport.insights.length > 0) {
    console.log(chalk.cyan.bold('\n💡 인사이트'));
    for (const insight of perfReport.insights.slice(0, 3)) {
      console.log(`  ${insight}`);
    }
  }

  console.log(chalk.dim('\n상세 정보: npm run monitor <performance|freshness|updates>'));
}

/**
 * 트렌드 포맷팅
 */
function formatTrend(trend: string): string {
  switch (trend) {
    case 'rising': return '📈';
    case 'declining': return '📉';
    default: return '➡️';
  }
}

/**
 * 우선순위 포맷팅
 */
function formatPriority(priority: string): string {
  switch (priority) {
    case 'urgent': return '🔴';
    case 'high': return '🟠';
    case 'medium': return '🟡';
    default: return '🟢';
  }
}

export default monitorCommand;
