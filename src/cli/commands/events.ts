/**
 * events 명령어: 이벤트 캘린더 관리
 *
 * npm run events sync              # 이벤트 수집 (API + Gemini + 시드)
 * npm run events sync -- --month 3 # 특정 월 수집
 * npm run events list              # 다가오는 이벤트 목록
 * npm run events list -- --days 30 # 30일 내 이벤트
 * npm run events timing            # 바이럴 타이밍 현황
 * npm run events angles <id>       # 특정 이벤트의 콘텐츠 앵글 생성
 */

import chalk from 'chalk';
import EventCalendarManager from '../../agents/events/event-calendar.js';
import EventCollector from '../../agents/events/event-collector.js';
import { EventCalendarScanner } from '../../agents/events/event-scanner.js';
import ContentAngleGenerator from '../../agents/events/content-angle-generator.js';

export interface EventsCommandOptions {
  month?: string;
  year?: string;
  days?: string;
  skipApi?: boolean;
  skipGemini?: boolean;
}

export async function eventsCommand(
  action: string,
  args: string[] = [],
  options: EventsCommandOptions = {}
): Promise<void> {
  switch (action) {
    case 'sync':
      await syncEvents(options);
      break;

    case 'list':
      await listEvents(options);
      break;

    case 'timing':
      await showTiming();
      break;

    case 'angles':
      await showAngles(args[0]);
      break;

    default:
      showHelp();
  }
}

// ──────────────────────────────────────────────────
// sync: 이벤트 수집
// ──────────────────────────────────────────────────

async function syncEvents(options: EventsCommandOptions): Promise<void> {
  const calendar = new EventCalendarManager();
  const collector = new EventCollector(calendar);

  const month = options.month ? parseInt(options.month, 10) : undefined;
  const year = options.year ? parseInt(options.year, 10) : undefined;

  const stats = await collector.sync({
    month,
    year,
    skipApi: options.skipApi,
    skipGemini: options.skipGemini
  });

  // 요약
  console.log(chalk.cyan('\n📊 수집 요약'));
  console.log(chalk.dim('─'.repeat(40)));
  console.log(`  🌱 시드:       ${stats.seeds}개`);
  console.log(`  🏛️  KTO API:    ${stats.kto}개`);
  console.log(`  🎭 문화정보원: ${stats.culture}개`);
  console.log(`  🤖 Gemini AI:  ${stats.gemini}개`);
  console.log(`  🔄 중복 제거:  ${stats.deduplicated}개`);
  console.log(chalk.green(`  ✅ 최종 저장:  ${stats.total}개`));
}

// ──────────────────────────────────────────────────
// list: 이벤트 목록
// ──────────────────────────────────────────────────

async function listEvents(options: EventsCommandOptions): Promise<void> {
  const calendar = new EventCalendarManager();
  await calendar.load();
  calendar.updateLifecycles();

  const days = options.days ? parseInt(options.days, 10) : 60;
  const events = calendar.getEventsWithinDays(days);

  if (events.length === 0) {
    console.log(chalk.yellow(`\n📅 ${days}일 내 이벤트가 없습니다.`));
    console.log(chalk.dim('  npm run events sync 로 이벤트를 수집하세요.'));
    return;
  }

  console.log(chalk.cyan(`\n📅 ${days}일 내 이벤트 (${events.length}개)\n`));

  // 상태별 그룹핑
  const active = events.filter(e => e.status === 'active');
  const upcoming = events.filter(e => e.status === 'upcoming');
  const past = events.filter(e => e.status === 'past');

  if (active.length > 0) {
    console.log(chalk.green.bold('🔴 진행 중'));
    for (const e of active) {
      printEvent(e);
    }
    console.log('');
  }

  if (upcoming.length > 0) {
    console.log(chalk.yellow.bold('🟡 다가오는 이벤트'));
    const sorted = upcoming.sort((a, b) =>
      new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    );
    for (const e of sorted) {
      printEvent(e);
    }
    console.log('');
  }

  if (past.length > 0) {
    console.log(chalk.dim.bold('⚪ 최근 종료'));
    for (const e of past) {
      printEvent(e);
    }
  }

  // 마지막 동기화 시간
  const lastSync = calendar.getLastSyncedAt();
  if (lastSync) {
    console.log(chalk.dim(`\n마지막 동기화: ${new Date(lastSync).toLocaleString('ko-KR')}`));
  }
}

function printEvent(event: import('../../agents/events/event-calendar.js').CalendarEvent): void {
  const categoryEmoji: Record<string, string> = {
    festival: '🎪', exhibition: '🖼️', performance: '🎭',
    conference: '🎤', seasonal: '🌸'
  };

  const visibilityBadge = event.visibility === 'major' ? chalk.red('[MAJOR]')
    : event.visibility === 'hidden' ? chalk.magenta('[HIDDEN]')
    : chalk.yellow('[EMERGING]');

  const sourceTag = event.source === 'gemini' ? chalk.blue('[AI]')
    : event.source === 'manual' ? chalk.gray('[시드]')
    : chalk.green('[API]');

  const now = new Date();
  const start = new Date(event.startDate);
  const daysToStart = Math.round((start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const daysTag = daysToStart > 0 ? chalk.cyan(`D-${daysToStart}`)
    : daysToStart === 0 ? chalk.red('TODAY')
    : chalk.dim(`D+${Math.abs(daysToStart)}`);

  const emoji = categoryEmoji[event.category] || '📌';
  console.log(`  ${emoji} ${visibilityBadge} ${sourceTag} ${event.title}`);
  console.log(chalk.dim(`     ${event.startDate} ~ ${event.endDate} | ${event.location.region} ${event.location.venue} | ${daysTag}`));

  if (event.needsVerification) {
    console.log(chalk.yellow(`     ⚠️ AI 발굴 - 검증 필요`));
  }
}

// ──────────────────────────────────────────────────
// timing: 바이럴 타이밍 현황
// ──────────────────────────────────────────────────

async function showTiming(): Promise<void> {
  const scanner = new EventCalendarScanner();
  const timingStatus = await scanner.getTimingStatus();

  if (timingStatus.length === 0) {
    console.log(chalk.yellow('\n⏰ 30일 내 진행/예정 이벤트가 없습니다.'));
    return;
  }

  console.log(chalk.cyan('\n⏰ 바이럴 타이밍 현황\n'));

  for (const { event, timing, boost } of timingStatus) {
    const urgencyEmoji = timing.urgency === 'critical' ? '🔥'
      : timing.urgency === 'high' ? '⚡'
      : timing.urgency === 'medium' ? '📌'
      : '⏳';

    const boostColor = boost >= 40 ? 'red' : boost >= 20 ? 'yellow' : 'dim';

    console.log(`  ${urgencyEmoji} ${chalk.white.bold(event.title)}`);
    console.log(`     ${timing.recommendedAction}`);
    console.log(chalk.dim(`     Phase: ${timing.phase} | D${timing.daysToStart >= 0 ? '-' : '+'}${Math.abs(timing.daysToStart)} | Boost: ${chalk[boostColor](String(boost))}`));
    console.log('');
  }
}

// ──────────────────────────────────────────────────
// angles: 콘텐츠 앵글 생성
// ──────────────────────────────────────────────────

async function showAngles(eventId?: string): Promise<void> {
  if (!eventId) {
    console.log(chalk.red('\n❌ 이벤트 ID를 입력하세요.'));
    console.log(chalk.dim('  사용법: npm run events angles <eventId>'));
    console.log(chalk.dim('  이벤트 ID 확인: npm run events list'));
    return;
  }

  const calendar = new EventCalendarManager();
  await calendar.load();

  const event = calendar.getEvent(eventId);
  if (!event) {
    // ID 부분 매칭 시도
    const allEvents = calendar.getEvents();
    const matched = allEvents.filter(e => e.id.includes(eventId) || e.title.includes(eventId));

    if (matched.length === 0) {
      console.log(chalk.red(`\n❌ 이벤트를 찾을 수 없습니다: ${eventId}`));
      return;
    }

    if (matched.length > 1) {
      console.log(chalk.yellow(`\n⚠️ 여러 이벤트가 매칭됩니다:`));
      for (const m of matched) {
        console.log(chalk.dim(`  ${m.id} - ${m.title}`));
      }
      return;
    }

    // 단일 매칭
    return showAnglesForEvent(matched[0]);
  }

  return showAnglesForEvent(event);
}

async function showAnglesForEvent(event: import('../../agents/events/event-calendar.js').CalendarEvent): Promise<void> {
  const generator = new ContentAngleGenerator();
  const now = new Date();
  const startDate = new Date(event.startDate);
  const daysToStart = Math.round((startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  console.log(chalk.cyan(`\n🎯 콘텐츠 앵글: ${event.title}\n`));
  console.log(chalk.dim(`   기간: ${event.startDate} ~ ${event.endDate} (D${daysToStart >= 0 ? '-' : '+'}${Math.abs(daysToStart)})`));
  console.log(chalk.dim(`   장소: ${event.location.region} ${event.location.venue}`));
  console.log(chalk.dim(`   키워드: ${event.keywords.join(', ')}`));
  if (event.hiddenGems.length > 0) {
    console.log(chalk.dim(`   히든젬: ${event.hiddenGems.join(', ')}`));
  }
  console.log('');

  const angles = generator.generateAngles(event, daysToStart);

  if (angles.length === 0) {
    console.log(chalk.yellow('  적합한 콘텐츠 앵글이 없습니다.'));
    return;
  }

  const personaNames: Record<string, string> = {
    viral: '조회영', friendly: '김주말', informative: '한교양'
  };

  for (const angle of angles) {
    const personaTag = chalk.cyan(`[${personaNames[angle.personaId]}]`);
    const typeTag = chalk.yellow(`[${angle.contentType}]`);

    console.log(`  ${personaTag} ${typeTag} ${chalk.white.bold(angle.title)}`);
    console.log(chalk.dim(`     바이럴 점수: ${angle.estimatedViralScore}/100 | 키워드: ${angle.keywords.join(', ')}`));
    console.log('');
  }

  // AI 제목 생성 제안
  console.log(chalk.dim('  💡 AI 제목 생성: npm run events angles <id> --ai (향후 지원)'));
}

// ──────────────────────────────────────────────────
// 도움말
// ──────────────────────────────────────────────────

function showHelp(): void {
  console.log(chalk.cyan('\n📅 이벤트 캘린더 관리\n'));
  console.log(chalk.white('사용 가능한 작업:'));
  console.log(chalk.dim('  sync                이벤트 수집 (API + Gemini + 시드)'));
  console.log(chalk.dim('  list                다가오는 이벤트 목록'));
  console.log(chalk.dim('  timing              바이럴 타이밍 현황'));
  console.log(chalk.dim('  angles <id>         특정 이벤트의 콘텐츠 앵글 생성'));
  console.log(chalk.dim('\n옵션:'));
  console.log(chalk.dim('  --month <n>         특정 월 수집 (sync)'));
  console.log(chalk.dim('  --year <n>          특정 년도 (sync)'));
  console.log(chalk.dim('  --days <n>          조회 범위 일수 (list, 기본 60)'));
  console.log(chalk.dim('  --skip-api          API 수집 건너뛰기 (sync)'));
  console.log(chalk.dim('  --skip-gemini       Gemini AI 발굴 건너뛰기 (sync)'));
}
