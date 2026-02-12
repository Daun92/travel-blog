/**
 * 파이프라인 CLI 명령어
 * 콘텐츠 파이프라인 제어 및 모니터링
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import ContentPipeline, { loadPipelineConfig, savePipelineConfig } from '../../workflow/pipeline.js';
import PipelineScheduler from '../../workflow/scheduler.js';

export const pipelineCommand = new Command('pipeline')
  .description('콘텐츠 파이프라인 관리 (주제 발굴 → 생성 → 검증 → 발행)')
  .argument('[stage]', '실행할 스테이지 (discover|select|generate|validate|publish|monitor|all)')
  .option('--dry-run', '실제 생성/발행 없이 미리보기')
  .option('-v, --verbose', '상세 출력')
  .option('--auto', '완전 자동 모드')
  .option('--enhanced', '2차원 강화 발굴 사용 (OpenClaw피드백 + Vote포스트)')
  .option('--remediate', '실패 게이트 자동 치유')
  .option('--history [count]', '실행 기록 조회', '10')
  .option('--config', '설정 확인')
  .option('--schedule', '스케줄러 상태 확인')
  .option('--enable <taskId>', '스케줄 태스크 활성화')
  .option('--disable <taskId>', '스케줄 태스크 비활성화')
  .action(async (stage, options) => {
    try {
      // 설정 확인
      if (options.config) {
        const config = await loadPipelineConfig();
        console.log(chalk.cyan('\n⚙️ 파이프라인 설정\n'));
        console.log(JSON.stringify(config, null, 2));
        return;
      }

      // 스케줄러 상태 확인
      if (options.schedule) {
        const scheduler = new PipelineScheduler();
        await scheduler.initialize();
        scheduler.printStatus();
        return;
      }

      // 스케줄 태스크 활성화/비활성화
      if (options.enable) {
        const scheduler = new PipelineScheduler();
        await scheduler.initialize();

        const success = await scheduler.setTaskEnabled(options.enable, true);
        if (success) {
          console.log(chalk.green(`\n✅ 태스크 활성화됨: ${options.enable}`));
        } else {
          console.log(chalk.red(`\n❌ 태스크를 찾을 수 없습니다: ${options.enable}`));
        }
        return;
      }

      if (options.disable) {
        const scheduler = new PipelineScheduler();
        await scheduler.initialize();

        const success = await scheduler.setTaskEnabled(options.disable, false);
        if (success) {
          console.log(chalk.yellow(`\n⏸️ 태스크 비활성화됨: ${options.disable}`));
        } else {
          console.log(chalk.red(`\n❌ 태스크를 찾을 수 없습니다: ${options.disable}`));
        }
        return;
      }

      // 실행 기록 조회
      if (options.history && !stage) {
        const count = parseInt(options.history, 10) || 10;
        const pipeline = new ContentPipeline();
        const runs = await pipeline.loadRuns(count);

        if (runs.length === 0) {
          console.log(chalk.yellow('\n파이프라인 실행 기록이 없습니다.'));
          return;
        }

        console.log(chalk.cyan(`\n📜 최근 파이프라인 실행 기록 (${runs.length}개)\n`));

        for (const run of runs) {
          const statusIcon = run.status === 'completed' ? '✓' :
                            run.status === 'partial' ? '⚠' :
                            run.status === 'failed' ? '✗' : '⏳';

          const statusColor = run.status === 'completed' ? 'green' :
                             run.status === 'partial' ? 'yellow' : 'red';

          console.log(chalk[statusColor](`${statusIcon} [${run.id}] ${run.status}`));
          console.log(chalk.dim(`   시작: ${run.startedAt}`));
          console.log(chalk.dim(`   발굴: ${run.summary.topicsDiscovered}, 생성: ${run.summary.postsGenerated}, 발행: ${run.summary.postsPublished}`));

          if (run.errors.length > 0) {
            console.log(chalk.red(`   오류: ${run.errors.length}개`));
          }

          console.log('');
        }
        return;
      }

      // 파이프라인 실행
      const config = await loadPipelineConfig();

      // --enhanced 옵션으로 강화 발굴 활성화
      if (options.enhanced) {
        if (!config.discovery.sources.includes('openclaw_feedback')) {
          config.discovery.sources.push('openclaw_feedback');
        }
        if (!config.discovery.sources.includes('vote_posts')) {
          config.discovery.sources.push('vote_posts');
        }
        console.log(chalk.cyan('📡 2차원 강화 발굴 모드 활성화'));
        console.log(chalk.dim('   • 차원 1: OpenClaw 포스트 피드백 분석'));
        console.log(chalk.dim('   • 차원 2: Vote/Poll 포스트 피드백 분석\n'));
      }

      const pipeline = new ContentPipeline(config);

      // 스테이지 결정
      let stages: string[] | undefined;

      if (stage && stage !== 'all') {
        stages = [stage];
      }

      console.log(chalk.cyan('\n🚀 콘텐츠 파이프라인\n'));

      if (options.dryRun) {
        console.log(chalk.yellow('⚠️ Dry-run 모드: 실제 생성/발행이 수행되지 않습니다.\n'));
      }

      const spinner = ora('파이프라인 실행 중...').start();

      try {
        const result = await pipeline.runFull({
          dryRun: options.dryRun,
          stages,
          verbose: options.verbose,
          remediate: options.remediate
        });

        spinner.stop();

        // 결과 출력
        const statusIcon = result.status === 'completed' ? '✅' :
                          result.status === 'partial' ? '⚠️' : '❌';

        console.log(`\n${statusIcon} 파이프라인 ${result.status}`);

        // 스테이지별 결과
        console.log(chalk.white('\n📋 스테이지 결과:'));
        for (const stageResult of result.stages) {
          const icon = stageResult.status === 'completed' ? '✓' :
                      stageResult.status === 'failed' ? '✗' :
                      stageResult.status === 'skipped' ? '○' : '?';

          const color = stageResult.status === 'completed' ? 'green' :
                       stageResult.status === 'failed' ? 'red' : 'dim';

          console.log(chalk[color](`  ${icon} ${stageResult.name} (${stageResult.duration || 0}ms)`));

          if (stageResult.error) {
            console.log(chalk.red(`    └ ${stageResult.error}`));
          }
        }

        // 다음 단계 안내
        if (!options.dryRun && result.summary.postsGenerated > 0) {
          console.log(chalk.cyan('\n💡 다음 단계:'));
          console.log(chalk.dim('  npm run drafts           # 생성된 초안 확인'));
          console.log(chalk.dim('  npm run publish -f <file> # 수동 발행'));
        }

      } catch (error) {
        spinner.fail('파이프라인 실패');
        console.error(chalk.red(`\n❌ ${error}`));
        process.exit(1);
      }

    } catch (error) {
      console.error(chalk.red('\n❌ 오류:'), error);
      process.exit(1);
    }
  });

// 도움말 추가
pipelineCommand.on('--help', () => {
  console.log(`
예시:
  npm run pipeline                    # 전체 파이프라인 실행
  npm run pipeline discover           # 주제 발굴만 실행
  npm run pipeline discover --enhanced # 2차원 강화 발굴 (OpenClaw+Vote)
  npm run pipeline generate           # 생성만 실행
  npm run pipeline --dry-run          # 미리보기 모드
  npm run pipeline --enhanced         # 강화 발굴로 전체 파이프라인 실행
  npm run pipeline --remediate        # 실패 게이트 자동 치유
  npm run pipeline --history 5        # 최근 5개 실행 기록
  npm run pipeline --schedule         # 스케줄러 상태 확인
  npm run pipeline --config           # 설정 확인

2차원 강화 발굴:
  --enhanced 옵션은 두 가지 추가 데이터 소스를 활성화합니다:
  • OpenClaw 피드백: 블로그 포스트에 대한 Moltbook 커뮤니티 반응 분석
  • Vote 포스트: 투표/설문 형태의 피드백에서 주제 요청 추출
  `);
});

export default pipelineCommand;
