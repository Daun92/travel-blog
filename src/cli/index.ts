#!/usr/bin/env node
/**
 * 블로그 자동화 CLI
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { config } from 'dotenv';

// 환경 변수 로드
config();

// 명령어 임포트
import { newCommand } from './commands/new.js';
import { draftsCommand } from './commands/drafts.js';
import { reviewCommand } from './commands/review.js';
import { publishCommand } from './commands/publish.js';
import { keywordsCommand } from './commands/keywords.js';
import { statusCommand } from './commands/status.js';
import { moltbookCommand } from './commands/moltbook.js';
import { collectCommand } from './commands/collect.js';
import { queueCommand } from './commands/queue.js';
import { dailyCommand } from './commands/daily.js';
import { factcheckCommand } from './commands/factcheck.js';
import { validateCommand, reviewHumanCommand } from './commands/validate.js';
import { aeoCommand } from './commands/aeo.js';
import { workflowCommand } from './commands/workflow.js';
import { pipelineCommand } from './commands/pipeline.js';
import { monitorCommand } from './commands/monitor.js';
import { enhanceCommand } from './commands/enhance.js';
import { linksCommand } from './commands/links.js';
import { surveyCommand } from './commands/survey.js';

const program = new Command();

program
  .name('blog')
  .description('여행/문화예술 블로그 자동화 CLI')
  .version('1.0.0');

// 새 포스트 생성
program
  .command('new')
  .description('새 블로그 포스트 생성')
  .requiredOption('-t, --topic <topic>', '포스트 주제')
  .option('--type <type>', '포스트 유형 (travel|culture)', 'travel')
  .option('-k, --keywords <keywords>', '키워드 (쉼표로 구분)')
  .option('-l, --length <length>', '글 길이 (short|medium|long)', 'medium')
  .option('--no-draft', '바로 발행 (기본: 초안)')
  .option('-y, --yes', '모든 프롬프트에 자동 응답 (비대화 모드)')
  .option('--inline-images', 'Gemini AI로 인라인 설명 이미지 생성')
  .option('--image-count <count>', '생성할 인라인 이미지 개수 (기본: 3, 최대: 5)', '3')
  .option('--agent <id>', '에이전트 페르소나 지정 (viral|friendly|informative)')
  .action((options) => {
    // image-count를 숫자로 변환
    if (options.imageCount) {
      options.imageCount = parseInt(options.imageCount, 10);
    }
    return newCommand(options);
  });

// 초안 목록
program
  .command('drafts')
  .description('초안 목록 보기')
  .option('-a, --all', '모든 초안 표시')
  .action(draftsCommand);

// 초안 검토/편집
program
  .command('review')
  .description('초안 검토 및 편집')
  .option('-f, --file <file>', '특정 파일 검토')
  .option('--approve', '검토 후 승인 (draft: false)')
  .action(reviewCommand);

// 발행
program
  .command('publish')
  .description('포스트 발행 (Git push)')
  .option('-f, --file <file>', '특정 파일 발행')
  .option('--all', '모든 승인된 초안 발행')
  .option('-m, --message <message>', '커밋 메시지')
  .option('--skip-validation', '품질 검증 건너뛰기')
  .action(publishCommand);

// 키워드 추천
program
  .command('keywords')
  .description('트렌드 키워드 추천')
  .option('-c, --category <category>', '카테고리 (travel|culture|all)', 'all')
  .action(keywordsCommand);

// 상태 확인
program
  .command('status')
  .description('시스템 상태 확인')
  .action(statusCommand);

// 데이터 수집
program
  .command('collect')
  .description('공공 API에서 데이터 수집')
  .option('-k, --keyword <keyword>', '수집할 키워드')
  .option('--type <type>', '유형 (travel|culture)', 'travel')
  .action(collectCommand);

// Moltbook 커뮤니티
program
  .command('moltbook <action>')
  .description('Moltbook 커뮤니티 통합 (setup|share|feedback|heartbeat|analyze|draft|draft-feedback|draft-status)')
  .option('-f, --file <file>', '공유할 파일')
  .action(moltbookCommand);

// 주제 큐 관리
program
  .command('queue [action] [args...]')
  .description('주제 큐 관리 (list|add|remove|move|clear|discover|discovered)')
  .option('--type <type>', '주제 유형 (travel|culture)', 'travel')
  .option('--completed', '완료된 주제 표시')
  .option('--clear', '큐 초기화')
  .option('--gaps', '갭 분석 포함 (discover)')
  .option('--auto', '자동 큐 채우기 (discover)')
  .option('--min-score <n>', '최소 점수 (discover --auto)')
  .action((action = 'list', args, options) => queueCommand(action, args, options));

// 일일 자동화
program
  .command('daily [action]')
  .description('일일 자동화 제어 (run|preview|deploy|cancel|status)')
  .option('--count <count>', '생성할 포스트 수')
  .option('--delay <hours>', '배포 지연 시간')
  .option('--today', '오늘 생성된 초안만')
  .action((action = 'run', options) => dailyCommand(action, options));

// 팩트체크
program.addCommand(factcheckCommand);

// 품질 검증
program.addCommand(validateCommand);
program.addCommand(reviewHumanCommand);

// AEO (AI Engine Optimization)
program.addCommand(aeoCommand);

// 통합 워크플로우
program.addCommand(workflowCommand);

// 콘텐츠 파이프라인
program.addCommand(pipelineCommand);

// 모니터링
program.addCommand(monitorCommand);

// 드래프트 향상 (페르소나 + 디테일링)
program
  .command('enhance')
  .description('드래프트 향상 (페르소나 적용 + 클리셰 제거 + 디테일링)')
  .option('-f, --file <file>', '특정 파일 향상')
  .option('-a, --all', '모든 드래프트 향상')
  .option('--type <type>', '콘텐츠 유형 (travel|culture)')
  .option('--dry-run', '실제 저장 없이 미리보기')
  .option('--analyze', '분석만 수행 (향상 없이)')
  .option('-v, --verbose', '상세 출력')
  .action(enhanceCommand);

// 실용 링크 처리
program
  .command('links')
  .description('드래프트/발행 포스트의 링크 마커를 실제 URL로 변환')
  .option('-f, --file <file>', '특정 파일 처리')
  .option('-a, --all', '모든 드래프트 처리')
  .option('-p, --published', '발행된 포스트 처리')
  .option('-e, --enhance', 'AI로 장소명 추출 후 링크 자동 추가')
  .option('--dry-run', '실제 저장 없이 미리보기')
  .option('-v, --verbose', '상세 출력')
  .action(linksCommand);

// 서베이 인사이트 DB
program
  .command('survey [action] [args...]')
  .description('서베이 인사이트 DB 관리 (ingest|status|boost|apply-strategy)')
  .action((action = 'status', args, options) => surveyCommand(action, args, options));

// 프로그램 실행
program.parse();

// 명령어 없으면 도움말 표시
if (!process.argv.slice(2).length) {
  console.log(chalk.cyan(`
╔════════════════════════════════════════════════════╗
║       여행/문화예술 블로그 자동화 시스템           ║
╚════════════════════════════════════════════════════╝
  `));
  program.outputHelp();
}
