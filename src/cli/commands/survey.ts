/**
 * survey 명령어: 서베이 인사이트 DB 관리
 */

import chalk from 'chalk';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import SurveyInsightsDBManager from '../../agents/moltbook/survey-insights-db.js';

const CONFIG_DIR = join(process.cwd(), 'config');
const STRATEGY_PATH = join(CONFIG_DIR, 'content-strategy.json');

export async function surveyCommand(
  action: string,
  _args: string[] = [],
  _options: Record<string, string> = {}
): Promise<void> {
  const db = new SurveyInsightsDBManager();
  await db.load();

  switch (action) {
    case 'ingest': {
      console.log(chalk.cyan('\n📥 서베이 결과 DB 적재\n'));

      const { ingested, skipped } = await db.ingestFromFiles();

      if (ingested > 0) {
        console.log(chalk.green(`  ✅ ${ingested}건 적재 완료`));
      }
      if (skipped > 0) {
        console.log(chalk.yellow(`  ⏭️  ${skipped}건 스킵 (이미 적재됨)`));
      }
      if (ingested === 0 && skipped === 0) {
        console.log(chalk.yellow('  ⚠️ 적재할 서베이 결과 파일이 없습니다.'));
        console.log(chalk.dim('  data/feedback/survey-result.json 파일을 확인하세요.'));
      }

      const summary = db.getSummary();
      console.log(chalk.dim(`\n  DB 현황: ${summary.totalSurveys}개 서베이, ${summary.totalResponses}명 응답`));
      break;
    }

    case 'status': {
      console.log(chalk.cyan('\n📊 서베이 인사이트 DB 현황\n'));

      const summary = db.getSummary();

      if (summary.totalSurveys === 0) {
        console.log(chalk.yellow('  DB가 비어있습니다.'));
        console.log(chalk.dim('  npm run survey:ingest 로 데이터를 적재하세요.'));
        break;
      }

      console.log(chalk.white.bold('  📈 누적 통계'));
      console.log(chalk.dim(`  총 서베이: ${summary.totalSurveys}개`));
      console.log(chalk.dim(`  총 응답: ${summary.totalResponses}명`));

      if (summary.topTopics.length > 0) {
        console.log(chalk.white.bold('\n  🎨 인기 주제'));
        for (const topic of summary.topTopics) {
          const bar = '█'.repeat(Math.round(topic.votes));
          console.log(chalk.white(`  ${topic.label.padEnd(22)} ${bar} ${topic.votes.toFixed(1)}`));
        }
      }

      if (summary.topFormats.length > 0) {
        console.log(chalk.white.bold('\n  📝 선호 형식'));
        for (const fmt of summary.topFormats) {
          const bar = '█'.repeat(Math.round(fmt.votes));
          console.log(chalk.white(`  ${fmt.label.padEnd(22)} ${bar} ${fmt.votes.toFixed(1)}`));
        }
      }

      if (summary.topRegions.length > 0) {
        console.log(chalk.white.bold('\n  📍 관심 지역'));
        for (const region of summary.topRegions) {
          console.log(chalk.white(`  ${region.region}: ${region.mentions.toFixed(1)}회`));
        }
      }

      if (summary.freeTextCount > 0) {
        console.log(chalk.dim(`\n  💬 자유 의견: ${summary.freeTextCount}건`));
      }
      break;
    }

    case 'boost': {
      console.log(chalk.cyan('\n🚀 Discovery 스코어 부스트 맵\n'));

      const boosts = db.getSurveyScoreBoosts();
      const entries = Object.entries(boosts).sort((a, b) => b[1] - a[1]);

      if (entries.length === 0) {
        console.log(chalk.yellow('  부스트 데이터 없음'));
        console.log(chalk.dim('  npm run survey:ingest 로 먼저 데이터를 적재하세요.'));
        break;
      }

      console.log(chalk.white.bold('  키워드별 부스트 점수'));
      for (const [keyword, score] of entries) {
        const bar = '█'.repeat(Math.round(score / 2));
        console.log(chalk.white(`  ${keyword.padEnd(12)} +${String(score).padStart(2)}점 ${bar}`));
      }

      console.log(chalk.dim('\n  → queue discover 시 해당 키워드 포함 주제에 부스트 적용'));
      break;
    }

    case 'apply-strategy': {
      console.log(chalk.cyan('\n🎯 서베이 기반 전략 업데이트\n'));

      const recs = db.getStrategyRecommendations();

      if (recs.priorityTopics.length === 0) {
        console.log(chalk.yellow('  추천할 데이터가 부족합니다.'));
        console.log(chalk.dim('  npm run survey:ingest 로 먼저 데이터를 적재하세요.'));
        break;
      }

      // 기존 전략 로드
      let strategy: Record<string, unknown> = {};
      if (existsSync(STRATEGY_PATH)) {
        strategy = JSON.parse(await readFile(STRATEGY_PATH, 'utf-8'));
      }

      // 서베이 추천 머지
      const existingTopics = (strategy.priorityTopics as string[]) || [];
      const mergedTopics = [...new Set([...recs.priorityTopics, ...existingTopics])].slice(0, 10);

      const existingFocus = (strategy.focusAreas as string[]) || [];
      const mergedFocus = [...new Set([...recs.focusAreas, ...existingFocus])].slice(0, 10);

      strategy.priorityTopics = mergedTopics;
      if (recs.contentFormat) {
        strategy.contentFormat = recs.contentFormat;
      }
      strategy.focusAreas = mergedFocus;
      strategy.lastUpdated = new Date().toISOString();
      strategy.surveyInfluence = true;

      await mkdir(CONFIG_DIR, { recursive: true });
      await writeFile(STRATEGY_PATH, JSON.stringify(strategy, null, 2), 'utf-8');

      console.log(chalk.green('  ✅ content-strategy.json 업데이트 완료'));
      console.log(chalk.dim(`\n  우선 주제: ${mergedTopics.slice(0, 3).join(', ')}`));
      if (recs.contentFormat) {
        console.log(chalk.dim(`  선호 형식: ${recs.contentFormat}`));
      }
      if (mergedFocus.length > 0) {
        console.log(chalk.dim(`  관심 지역: ${mergedFocus.slice(0, 3).join(', ')}`));
      }
      break;
    }

    default:
      console.log(chalk.cyan('\n📊 서베이 인사이트 DB 관리\n'));
      console.log(chalk.white('사용 가능한 작업:'));
      console.log(chalk.dim('  ingest          survey-result.json → DB 적재'));
      console.log(chalk.dim('  status          DB 요약 (인기 주제, 형식, 지역)'));
      console.log(chalk.dim('  boost           discovery 스코어 부스트 맵'));
      console.log(chalk.dim('  apply-strategy  content-strategy.json 업데이트'));
  }
}
