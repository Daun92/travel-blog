/**
 * 파이프라인 스케줄러
 * 일일 자동화 및 주기적 작업 관리
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import ContentPipeline, { loadPipelineConfig, PipelineRun } from './pipeline.js';

// ============================================================================
// 타입 정의
// ============================================================================

export interface ScheduledTask {
  id: string;
  name: string;
  schedule: {
    type: 'daily' | 'hourly' | 'cron';
    time?: string;  // HH:MM for daily
    interval?: number;  // hours for hourly
    cron?: string;  // cron expression
  };
  action: 'full_pipeline' | 'discover' | 'generate' | 'monitor' | 'feedback';
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
}

export interface SchedulerState {
  tasks: ScheduledTask[];
  lastUpdated: string;
}

// ============================================================================
// 설정
// ============================================================================

const DATA_DIR = join(process.cwd(), 'data');
const SCHEDULER_STATE_PATH = join(DATA_DIR, 'scheduler-state.json');

const DEFAULT_TASKS: ScheduledTask[] = [
  {
    id: 'daily-pipeline',
    name: '일일 콘텐츠 파이프라인',
    schedule: {
      type: 'daily',
      time: '09:00'
    },
    action: 'full_pipeline',
    enabled: true
  },
  {
    id: 'hourly-monitor',
    name: '시간당 모니터링',
    schedule: {
      type: 'hourly',
      interval: 6
    },
    action: 'monitor',
    enabled: false
  },
  {
    id: 'daily-feedback',
    name: '일일 피드백 수집',
    schedule: {
      type: 'daily',
      time: '18:00'
    },
    action: 'feedback',
    enabled: true
  }
];

// ============================================================================
// 스케줄러
// ============================================================================

export class PipelineScheduler {
  private state: SchedulerState;
  private intervalHandles: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    this.state = {
      tasks: [...DEFAULT_TASKS],
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * 스케줄러 초기화 및 로드
   */
  async initialize(): Promise<void> {
    await this.loadState();
    this.updateNextRunTimes();
  }

  /**
   * 상태 로드
   */
  private async loadState(): Promise<void> {
    try {
      if (existsSync(SCHEDULER_STATE_PATH)) {
        const content = await readFile(SCHEDULER_STATE_PATH, 'utf-8');
        const savedState = JSON.parse(content) as SchedulerState;

        // 저장된 상태와 기본 태스크 병합
        const taskMap = new Map(savedState.tasks.map(t => [t.id, t]));

        for (const defaultTask of DEFAULT_TASKS) {
          if (!taskMap.has(defaultTask.id)) {
            taskMap.set(defaultTask.id, defaultTask);
          }
        }

        this.state = {
          tasks: Array.from(taskMap.values()),
          lastUpdated: savedState.lastUpdated
        };
      }
    } catch (error) {
      console.log(`⚠️ 스케줄러 상태 로드 실패, 기본값 사용`);
    }
  }

  /**
   * 상태 저장
   */
  private async saveState(): Promise<void> {
    this.state.lastUpdated = new Date().toISOString();
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(SCHEDULER_STATE_PATH, JSON.stringify(this.state, null, 2));
  }

  /**
   * 다음 실행 시간 업데이트
   */
  private updateNextRunTimes(): void {
    const now = new Date();

    for (const task of this.state.tasks) {
      if (!task.enabled) {
        task.nextRun = undefined;
        continue;
      }

      task.nextRun = this.calculateNextRun(task, now);
    }
  }

  /**
   * 다음 실행 시간 계산
   */
  private calculateNextRun(task: ScheduledTask, from: Date): string {
    const now = from.getTime();

    if (task.schedule.type === 'daily' && task.schedule.time) {
      const [hours, minutes] = task.schedule.time.split(':').map(Number);
      const next = new Date(from);
      next.setHours(hours, minutes, 0, 0);

      // 오늘 이미 지났으면 내일
      if (next.getTime() <= now) {
        next.setDate(next.getDate() + 1);
      }

      return next.toISOString();
    }

    if (task.schedule.type === 'hourly' && task.schedule.interval) {
      const next = new Date(now + task.schedule.interval * 60 * 60 * 1000);
      return next.toISOString();
    }

    // 기본: 1시간 후
    return new Date(now + 60 * 60 * 1000).toISOString();
  }

  /**
   * 실행 대기 중인 태스크 확인
   */
  getDueTasks(): ScheduledTask[] {
    const now = Date.now();

    return this.state.tasks.filter(task => {
      if (!task.enabled || !task.nextRun) return false;
      return new Date(task.nextRun).getTime() <= now;
    });
  }

  /**
   * 태스크 실행
   */
  async runTask(task: ScheduledTask): Promise<PipelineRun | null> {
    console.log(`\n⏰ 스케줄 실행: ${task.name}`);

    try {
      const config = await loadPipelineConfig();
      const pipeline = new ContentPipeline(config);

      let result: PipelineRun | null = null;

      switch (task.action) {
        case 'full_pipeline':
          result = await pipeline.runFull({ verbose: true });
          break;

        case 'discover':
          result = await pipeline.runFull({ stages: ['discover'], verbose: true });
          break;

        case 'generate':
          result = await pipeline.runFull({ stages: ['generate', 'validate'], verbose: true });
          break;

        case 'monitor':
          result = await pipeline.runFull({ stages: ['monitor'], verbose: true });
          break;

        case 'feedback':
          result = await pipeline.runFull({ stages: ['monitor'], verbose: true });
          break;

        default:
          console.log(`⚠️ 알 수 없는 액션: ${task.action}`);
      }

      // 실행 시간 업데이트
      task.lastRun = new Date().toISOString();
      task.nextRun = this.calculateNextRun(task, new Date());
      await this.saveState();

      return result;

    } catch (error) {
      console.error(`❌ 태스크 실행 실패: ${error}`);
      return null;
    }
  }

  /**
   * 대기 중인 모든 태스크 실행
   */
  async runDueTasks(): Promise<void> {
    const dueTasks = this.getDueTasks();

    if (dueTasks.length === 0) {
      console.log('⏰ 실행 대기 중인 태스크 없음');
      return;
    }

    console.log(`\n⏰ ${dueTasks.length}개 태스크 실행 대기 중`);

    for (const task of dueTasks) {
      await this.runTask(task);
    }
  }

  /**
   * 태스크 목록 조회
   */
  getTasks(): ScheduledTask[] {
    return this.state.tasks;
  }

  /**
   * 태스크 활성화/비활성화
   */
  async setTaskEnabled(taskId: string, enabled: boolean): Promise<boolean> {
    const task = this.state.tasks.find(t => t.id === taskId);
    if (!task) return false;

    task.enabled = enabled;

    if (enabled) {
      task.nextRun = this.calculateNextRun(task, new Date());
    } else {
      task.nextRun = undefined;
    }

    await this.saveState();
    return true;
  }

  /**
   * 태스크 스케줄 업데이트
   */
  async updateTaskSchedule(
    taskId: string,
    schedule: ScheduledTask['schedule']
  ): Promise<boolean> {
    const task = this.state.tasks.find(t => t.id === taskId);
    if (!task) return false;

    task.schedule = schedule;
    task.nextRun = this.calculateNextRun(task, new Date());

    await this.saveState();
    return true;
  }

  /**
   * 상태 요약 출력
   */
  printStatus(): void {
    console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏰ 스케줄러 상태
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

    for (const task of this.state.tasks) {
      const status = task.enabled ? '✓' : '✗';
      const statusColor = task.enabled ? '활성' : '비활성';

      console.log(`${status} ${task.name}`);
      console.log(`    ID: ${task.id}`);
      console.log(`    상태: ${statusColor}`);
      console.log(`    스케줄: ${this.formatSchedule(task.schedule)}`);

      if (task.lastRun) {
        console.log(`    마지막 실행: ${task.lastRun}`);
      }

      if (task.nextRun && task.enabled) {
        console.log(`    다음 실행: ${task.nextRun}`);
      }

      console.log('');
    }
  }

  /**
   * 스케줄 포맷팅
   */
  private formatSchedule(schedule: ScheduledTask['schedule']): string {
    if (schedule.type === 'daily' && schedule.time) {
      return `매일 ${schedule.time}`;
    }

    if (schedule.type === 'hourly' && schedule.interval) {
      return `${schedule.interval}시간마다`;
    }

    if (schedule.type === 'cron' && schedule.cron) {
      return `cron: ${schedule.cron}`;
    }

    return '알 수 없음';
  }

  /**
   * 단일 큐 빈 여부 확인 및 자동 채우기
   */
  async checkAndPopulateQueue(): Promise<number> {
    const config = await loadPipelineConfig();

    // 큐 로드
    const queuePath = join(process.cwd(), 'config/topic-queue.json');
    let queueSize = 0;

    try {
      const content = await readFile(queuePath, 'utf-8');
      const queue = JSON.parse(content);
      queueSize = queue.queue?.length || 0;
    } catch {
      // 큐 파일 없음
    }

    // 최소 큐 크기 미달 시 발굴 실행
    if (queueSize < config.discovery.autoPopulateWhenQueueBelow) {
      console.log(`📭 큐가 부족합니다 (${queueSize}개). 주제 발굴 실행...`);

      const pipeline = new ContentPipeline(config);
      await pipeline.runFull({
        stages: ['discover', 'select'],
        verbose: false
      });

      // 업데이트된 큐 크기 확인
      try {
        const content = await readFile(queuePath, 'utf-8');
        const queue = JSON.parse(content);
        return queue.queue?.length || 0;
      } catch {
        return 0;
      }
    }

    return queueSize;
  }
}

export default PipelineScheduler;
