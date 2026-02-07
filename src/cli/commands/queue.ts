/**
 * queue 명령어: 주제 큐 관리 + Moltbook 기반 주제 발굴
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import chalk from 'chalk';
import { loadMoltbookConfig } from '../../agents/moltbook/index.js';
import TopicDiscovery, { TopicRecommendation } from '../../agents/moltbook/topic-discovery.js';
import CommunityRequestExtractor from '../../agents/moltbook/community-requests.js';
import SurveyInsightsDBManager from '../../agents/moltbook/survey-insights-db.js';
import { EventCalendarScanner } from '../../agents/events/event-scanner.js';

interface TopicItem {
  title: string;
  type: 'travel' | 'culture';
  meta?: {
    score?: number;
    source?: string;
    surveyRelevance?: number;
    discoveredAt?: string;
    keywords?: string[];
  };
}

interface TopicQueue {
  queue: TopicItem[];
  completed: TopicItem[];
  discovered?: TopicRecommendation[];
  settings: {
    postsPerDay: number;
    deployDelayHours: number;
    defaultLength: string;
    enableInlineImages: boolean;
    inlineImageCount: number;
    autoPopulateThreshold?: number;
    minQueueSize?: number;
  };
}

const queuePath = './config/topic-queue.json';

async function loadQueue(): Promise<TopicQueue> {
  try {
    const content = await readFile(queuePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    // 기본 큐 생성
    const defaultQueue: TopicQueue = {
      queue: [],
      completed: [],
      settings: {
        postsPerDay: 2,
        deployDelayHours: 6,
        defaultLength: 'medium',
        enableInlineImages: true,
        inlineImageCount: 3
      }
    };

    await mkdir('./config', { recursive: true });
    await writeFile(queuePath, JSON.stringify(defaultQueue, null, 2), 'utf-8');
    return defaultQueue;
  }
}

async function saveQueue(queue: TopicQueue): Promise<void> {
  await writeFile(queuePath, JSON.stringify(queue, null, 2), 'utf-8');
}

/**
 * travel/culture 비율 밸런싱
 */
function balanceByRatio(
  recommendations: TopicRecommendation[],
  ratio: number,
  minScore: number,
  maxItems: number = 5
): TopicRecommendation[] {
  // minScore 이상만 필터
  const eligible = recommendations.filter(r => r.score >= minScore);

  // 이벤트 긴급 주제(D-7 이내)는 비율 무시하고 우선 편입
  const urgent = eligible.filter(r =>
    r.eventMeta && r.scoreBreakdown && r.scoreBreakdown.eventBoost >= 40
  );

  const nonUrgent = eligible.filter(r =>
    !urgent.includes(r)
  );

  // 비율 계산
  const remainingSlots = Math.max(0, maxItems - urgent.length);
  const travelSlots = Math.round(remainingSlots * ratio);
  const cultureSlots = remainingSlots - travelSlots;

  const travel = nonUrgent.filter(r => r.type === 'travel').slice(0, travelSlots);
  const culture = nonUrgent.filter(r => r.type === 'culture').slice(0, cultureSlots);

  return [...urgent, ...travel, ...culture]
    .sort((a, b) => b.score - a.score)
    .slice(0, maxItems);
}

export interface QueueCommandOptions {
  type?: 'travel' | 'culture';
  clear?: boolean;
  completed?: boolean;
  gaps?: boolean;
  auto?: boolean;
  minScore?: string;
  ratio?: string;
}

export async function queueCommand(
  action: string,
  args: string[] = [],
  options: QueueCommandOptions = {}
): Promise<void> {
  const queue = await loadQueue();

  switch (action) {
    case 'list': {
      console.log(chalk.cyan('\n📋 주제 큐 현황\n'));

      if (options.completed) {
        // 완료된 주제 표시
        console.log(chalk.white.bold('✅ 완료된 주제'));
        if (queue.completed.length === 0) {
          console.log(chalk.dim('  (없음)'));
        } else {
          queue.completed.forEach((topic, i) => {
            const emoji = topic.type === 'travel' ? '🧳' : '🎨';
            console.log(chalk.dim(`  ${i + 1}. ${emoji} [${topic.type}] ${topic.title}`));
          });
        }
        console.log('');
      }

      console.log(chalk.white.bold('📝 대기 중인 주제'));
      if (queue.queue.length === 0) {
        console.log(chalk.yellow('  큐가 비어있습니다.'));
        console.log(chalk.dim('  npm run queue:add -- "주제" --type travel 로 추가하세요.'));
      } else {
        queue.queue.forEach((topic, i) => {
          const emoji = topic.type === 'travel' ? '🧳' : '🎨';
          let line = `  ${i + 1}. ${emoji} [${topic.type}] ${topic.title}`;
          if (topic.meta) {
            const parts: string[] = [];
            if (topic.meta.score != null) parts.push(`점수:${topic.meta.score}`);
            if (topic.meta.source) parts.push(topic.meta.source);
            if (topic.meta.surveyRelevance != null && topic.meta.surveyRelevance > 0) {
              parts.push(`서베이:${topic.meta.surveyRelevance}%`);
            }
            if (parts.length > 0) line += chalk.dim(` (${parts.join(', ')})`);
          }
          console.log(chalk.white(line));
        });
      }

      console.log(chalk.dim(`\n총 ${queue.queue.length}개 대기 중, ${queue.completed.length}개 완료됨`));

      // 설정 표시
      console.log(chalk.white.bold('\n⚙️  설정'));
      console.log(chalk.dim(`  일일 생성: ${queue.settings.postsPerDay}개`));
      console.log(chalk.dim(`  배포 지연: ${queue.settings.deployDelayHours}시간`));
      console.log(chalk.dim(`  인라인 이미지: ${queue.settings.enableInlineImages ? '활성화' : '비활성화'} (${queue.settings.inlineImageCount}개)`));
      break;
    }

    case 'add': {
      const title = args.join(' ');
      if (!title) {
        console.log(chalk.red('\n❌ 주제를 입력하세요.'));
        console.log(chalk.dim('  사용법: npm run queue:add -- "주제 제목" --type travel'));
        process.exit(1);
      }

      const type = options.type || 'travel';

      // 중복 체크
      const exists = queue.queue.some(t => t.title === title);
      if (exists) {
        console.log(chalk.yellow(`\n⚠️ 이미 큐에 있는 주제입니다: ${title}`));
        process.exit(1);
      }

      queue.queue.push({ title, type });
      await saveQueue(queue);

      const emoji = type === 'travel' ? '🧳' : '🎨';
      console.log(chalk.green(`\n✅ 주제 추가됨: ${emoji} [${type}] ${title}`));
      console.log(chalk.dim(`  큐 위치: ${queue.queue.length}번째`));
      break;
    }

    case 'remove': {
      const indexStr = args[0];
      if (!indexStr) {
        console.log(chalk.red('\n❌ 제거할 번호를 입력하세요.'));
        console.log(chalk.dim('  사용법: npm run queue:remove -- 3'));
        process.exit(1);
      }

      const index = parseInt(indexStr, 10) - 1;
      if (isNaN(index) || index < 0 || index >= queue.queue.length) {
        console.log(chalk.red(`\n❌ 잘못된 번호입니다: ${indexStr}`));
        console.log(chalk.dim(`  유효 범위: 1-${queue.queue.length}`));
        process.exit(1);
      }

      const removed = queue.queue.splice(index, 1)[0];
      await saveQueue(queue);

      const emoji = removed.type === 'travel' ? '🧳' : '🎨';
      console.log(chalk.green(`\n✅ 주제 제거됨: ${emoji} [${removed.type}] ${removed.title}`));
      break;
    }

    case 'clear': {
      if (options.completed) {
        queue.completed = [];
        await saveQueue(queue);
        console.log(chalk.green('\n✅ 완료된 주제 목록이 초기화되었습니다.'));
      } else if (options.clear) {
        queue.queue = [];
        await saveQueue(queue);
        console.log(chalk.green('\n✅ 대기 큐가 초기화되었습니다.'));
      } else {
        console.log(chalk.yellow('\n⚠️ 초기화 옵션을 지정하세요:'));
        console.log(chalk.dim('  npm run queue:clear -- --clear      # 대기 큐 초기화'));
        console.log(chalk.dim('  npm run queue:clear -- --completed  # 완료 목록 초기화'));
      }
      break;
    }

    case 'move': {
      // 순서 변경: move <from> <to>
      const fromStr = args[0];
      const toStr = args[1];

      if (!fromStr || !toStr) {
        console.log(chalk.red('\n❌ 이동할 위치를 지정하세요.'));
        console.log(chalk.dim('  사용법: npm run queue -- move 5 1  # 5번을 1번으로'));
        process.exit(1);
      }

      const from = parseInt(fromStr, 10) - 1;
      const to = parseInt(toStr, 10) - 1;

      if (isNaN(from) || isNaN(to) ||
          from < 0 || from >= queue.queue.length ||
          to < 0 || to >= queue.queue.length) {
        console.log(chalk.red('\n❌ 잘못된 번호입니다.'));
        process.exit(1);
      }

      const [item] = queue.queue.splice(from, 1);
      queue.queue.splice(to, 0, item);
      await saveQueue(queue);

      console.log(chalk.green(`\n✅ 순서 변경됨: ${item.title}`));
      console.log(chalk.dim(`  ${from + 1}번 → ${to + 1}번`));
      break;
    }

    case 'discover': {
      console.log(chalk.cyan('\n🔍 Moltbook 트렌드 + 이벤트 기반 주제 발굴\n'));

      // Moltbook 설정 로드
      const moltbookConfig = await loadMoltbookConfig();

      // 발굴 실행
      const discovery = new TopicDiscovery(moltbookConfig);

      // 커뮤니티 요청 수집
      let communityRequests: string[] = [];
      if (options.gaps) {
        console.log(chalk.dim('커뮤니티 요청도 분석 중...'));
        const extractor = new CommunityRequestExtractor(moltbookConfig);
        const requests = await extractor.extractFromRecentFeedback(7);
        communityRequests = extractor.toRecommendationStrings(requests);
        console.log(chalk.dim(`  ${requests.length}개 커뮤니티 요청 발견`));
      }

      // 서베이 부스트 로드
      const surveyDb = new SurveyInsightsDBManager();
      await surveyDb.load();
      const surveyBoosts = surveyDb.getSurveyScoreBoosts();
      if (Object.keys(surveyBoosts).length > 0) {
        console.log(chalk.dim(`서베이 부스트: ${Object.keys(surveyBoosts).length}개 키워드 적용`));
      }

      // 이벤트 스캐너로 이벤트 기반 추천 수집
      console.log(chalk.dim('📅 이벤트 캘린더 스캔 중...'));
      const eventScanner = new EventCalendarScanner();
      const eventRecs = await eventScanner.scan({ surveyBoosts });
      if (eventRecs.length > 0) {
        console.log(chalk.dim(`  ${eventRecs.length}개 이벤트 기반 추천 발견`));
      }

      const result = await discovery.discover({
        submolt: options.type,
        includeGaps: options.gaps,
        communityRequests,
        surveyBoosts,
        eventRecommendations: eventRecs
      });

      // 결과 출력
      console.log(chalk.white.bold('\n🔥 트렌딩 토픽'));
      if (result.trending.length === 0) {
        console.log(chalk.dim('  트렌딩 데이터 없음'));
      } else {
        for (const trend of result.trending.slice(0, 5)) {
          const emoji = trend.submolt === 'travel' ? '🧳' : '🎨';
          const direction = trend.trendDirection === 'rising' ? '📈' : trend.trendDirection === 'declining' ? '📉' : '➡️';
          console.log(chalk.white(`  ${emoji} ${trend.topic} ${direction} (engagement: ${trend.engagementScore})`));
        }
      }

      if (options.gaps && result.gaps.length > 0) {
        console.log(chalk.white.bold('\n📊 콘텐츠 갭'));
        for (const gap of result.gaps.slice(0, 5)) {
          const priority = gap.recommendedPriority === 'high' ? '🔴' : gap.recommendedPriority === 'medium' ? '🟡' : '🟢';
          console.log(chalk.white(`  ${priority} ${gap.topic}: ${gap.blogCoverage} (priority: ${gap.recommendedPriority})`));
          if (gap.suggestedAngles.length > 0) {
            console.log(chalk.dim(`     → ${gap.suggestedAngles[0]}`));
          }
        }
      }

      console.log(chalk.white.bold('\n💡 추천 주제 (0-200 스케일)'));
      if (result.recommendations.length === 0) {
        console.log(chalk.dim('  추천 주제 없음'));
      } else {
        for (const rec of result.recommendations.slice(0, 10)) {
          const emoji = rec.type === 'travel' ? '🧳' : '🎨';
          const source = rec.source === 'gap_analysis' ? '[갭]'
            : rec.source === 'moltbook_trending' ? '[트렌드]'
            : rec.source === 'survey_demand' ? '[서베이]'
            : rec.source === 'event_calendar' ? '[이벤트]'
            : '[요청]';
          const personaTag = rec.personaId ? chalk.magenta(`[${rec.personaId}]`) : '';
          console.log(chalk.white(`  ${emoji} ${chalk.cyan(source)} ${personaTag} ${rec.suggestedTitle}`));

          // 점수 내역 출력
          if (rec.scoreBreakdown) {
            const sb = rec.scoreBreakdown;
            console.log(chalk.dim(`     점수: ${rec.score}/200 (base:${sb.base} + survey:${sb.surveyBoost} × season:${sb.seasonalMultiplier} + event:${sb.eventBoost} + perf:${sb.performanceFeedback})`));
          } else {
            console.log(chalk.dim(`     점수: ${rec.score}, ${rec.reasoning}`));
          }
        }
      }

      // travel/culture 비율 분석
      const ratio = parseFloat(options.ratio || '0.6');
      const travelRecs = result.recommendations.filter(r => r.type === 'travel');
      const cultureRecs = result.recommendations.filter(r => r.type === 'culture');
      console.log(chalk.dim(`\n📊 비율: travel ${travelRecs.length}개 / culture ${cultureRecs.length}개 (목표: ${Math.round(ratio * 100)}/${Math.round((1 - ratio) * 100)})`));

      // 자동 큐 채우기
      if (options.auto) {
        const minScore = parseInt(options.minScore || '100', 10); // 0-200 스케일 기본 100
        console.log(chalk.white.bold(`\n🤖 자동 큐 채우기 (최소 점수: ${minScore}/200, 비율: ${ratio})`));

        // 비율 밸런싱 적용
        const balancedRecs = balanceByRatio(result.recommendations, ratio, minScore);

        const added = await discovery.autoPopulateQueue(balancedRecs, 0); // 이미 필터링됨

        if (added > 0) {
          console.log(chalk.green(`  ✅ ${added}개 주제가 큐에 추가되었습니다.`));
          const refreshed = await loadQueue();
          refreshed.discovered = result.recommendations;
          await saveQueue(refreshed);
        } else {
          console.log(chalk.yellow(`  ⚠️ 추가할 적합한 주제가 없습니다.`));
          queue.discovered = result.recommendations;
          await saveQueue(queue);
        }
      } else {
        console.log(chalk.dim(`\n💡 --auto 옵션으로 자동 큐 채우기 가능`));
        console.log(chalk.dim(`   --ratio 0.6 으로 travel/culture 비율 조정`));
        queue.discovered = result.recommendations;
        await saveQueue(queue);
      }

      break;
    }

    case 'discovered': {
      // 발견된 주제 목록 표시
      console.log(chalk.cyan('\n🔍 발견된 주제 목록\n'));

      if (!queue.discovered || queue.discovered.length === 0) {
        console.log(chalk.yellow('  발견된 주제가 없습니다.'));
        console.log(chalk.dim('  npm run queue discover 로 주제를 발굴하세요.'));
      } else {
        for (const rec of queue.discovered) {
          const emoji = rec.type === 'travel' ? '🧳' : '🎨';
          const source = rec.source === 'gap_analysis' ? '[갭]' :
                        rec.source === 'moltbook_trending' ? '[트렌드]' :
                        rec.source === 'survey_demand' ? '[서베이]' : '[요청]';
          console.log(chalk.white(`  ${emoji} ${chalk.cyan(source)} ${rec.suggestedTitle}`));
          console.log(chalk.dim(`     점수: ${rec.score}, 키워드: ${rec.keywords.join(', ')}`));
        }

        console.log(chalk.dim(`\n총 ${queue.discovered.length}개 발견됨`));
      }
      break;
    }

    default:
      console.log(chalk.cyan('\n📋 주제 큐 관리\n'));
      console.log(chalk.white('사용 가능한 작업:'));
      console.log(chalk.dim('  list              큐 목록 보기'));
      console.log(chalk.dim('  add "주제"        주제 추가'));
      console.log(chalk.dim('  remove <번호>     주제 제거'));
      console.log(chalk.dim('  move <from> <to>  순서 변경'));
      console.log(chalk.dim('  clear             큐 초기화'));
      console.log(chalk.dim('  discover          Moltbook 기반 주제 발굴'));
      console.log(chalk.dim('  discovered        발견된 주제 목록 보기'));
      console.log(chalk.dim('\n옵션:'));
      console.log(chalk.dim('  --type travel|culture  주제 유형'));
      console.log(chalk.dim('  --completed            완료된 주제 표시 (list)'));
      console.log(chalk.dim('  --clear                대기 큐 초기화 (clear)'));
      console.log(chalk.dim('  --gaps                 갭 분석 포함 (discover)'));
      console.log(chalk.dim('  --auto                 자동 큐 채우기 (discover)'));
      console.log(chalk.dim('  --min-score <n>        최소 점수 (discover --auto, 기본 100/200)'));
      console.log(chalk.dim('  --ratio <n>            travel/culture 비율 (기본 0.6)'));
  }
}
