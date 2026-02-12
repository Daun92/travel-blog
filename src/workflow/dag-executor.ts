/**
 * DAG 실행기 — 비선형 파이프라인 엔진
 * Layer 4 (조율층) 핵심 컴포넌트
 *
 * 기존 ContentPipeline의 순차 실행을 DAG(방향 비순환 그래프) 기반으로 교체.
 * dependsOn이 모두 완료된 스테이지들을 동시에 시작하고,
 * 실패 시 onFailure 정책에 따라 분기한다.
 *
 * 기존 6단계의 DAG 정의:
 *   discover ──→ select ──→ generate ──→ validate ──→ publish
 *   monitor (독립 — 동시 시작 가능)
 *                                        feedback (Layer 1 루프)
 */

import { WorkflowEventBus, getEventBus } from './event-bus.js';

// ============================================================================
// 타입 정의
// ============================================================================

export interface StageDefinition<T = unknown> {
  /** 스테이지 이름 */
  name: string;
  /** 선행 조건 (빈 배열 = 즉시 실행 가능) */
  dependsOn: string[];
  /** 실행 함수 */
  execute: (context: PipelineContext) => Promise<T>;
  /** 병렬 실행 가능 여부 (기본: true) */
  canRunParallel?: boolean;
  /** 실패 시 정책 (기본: 'stop') */
  onFailure?: 'stop' | 'skip' | 'remediate';
}

export interface PipelineContext {
  /** 실행 ID */
  runId: string;
  /** 스테이지별 결과 저장 */
  results: Map<string, unknown>;
  /** 이벤트 버스 */
  eventBus: WorkflowEventBus;
  /** 설정 */
  config: DAGConfig;
}

export interface DAGConfig {
  /** 병렬 실행 활성화 (기본: true) */
  parallel?: boolean;
  /** 상세 출력 */
  verbose?: boolean;
  /** 최대 동시 실행 수 (기본: 5) */
  maxConcurrency?: number;
}

export interface DAGStageResult {
  name: string;
  status: 'completed' | 'failed' | 'skipped';
  startedAt: string;
  completedAt: string;
  duration: number;
  result?: unknown;
  error?: string;
}

export interface DAGExecutionResult {
  runId: string;
  stages: DAGStageResult[];
  status: 'completed' | 'partial' | 'failed';
  duration: number;
  errors: string[];
}

// ============================================================================
// DAG Executor
// ============================================================================

/**
 * DAG 기반 파이프라인 실행기
 *
 * 1. 모든 StageDefinition을 위상 정렬(topological sort)
 * 2. dependsOn이 모두 완료된 스테이지들을 동시에 시작
 * 3. 각 스테이지 완료 시 EventBus에 이벤트 발행
 * 4. 실패 시 onFailure 정책에 따라 분기
 * 5. 모든 도달 가능한 스테이지 완료 시 파이프라인 종료
 */
export class DAGExecutor {
  private stages: Map<string, StageDefinition> = new Map();
  private eventBus: WorkflowEventBus;

  constructor(private config: DAGConfig = {}) {
    this.eventBus = getEventBus();
    if (config.verbose) {
      this.eventBus.setVerbose(true);
    }
  }

  /**
   * 스테이지 등록
   */
  addStage<T>(stage: StageDefinition<T>): this {
    this.stages.set(stage.name, stage as StageDefinition);
    return this;
  }

  /**
   * 복수 스테이지 등록
   */
  addStages(stages: StageDefinition[]): this {
    for (const stage of stages) {
      this.addStage(stage);
    }
    return this;
  }

  /**
   * DAG 실행
   */
  async execute(runId?: string): Promise<DAGExecutionResult> {
    const id = runId || `dag-${Date.now()}`;
    const startTime = Date.now();

    // 위상 정렬로 실행 순서 검증
    const sorted = this.topologicalSort();
    if (!sorted) {
      throw new Error('DAG에 순환 의존성이 있습니다');
    }

    // 컨텍스트 생성
    const context: PipelineContext = {
      runId: id,
      results: new Map(),
      eventBus: this.eventBus,
      config: this.config,
    };

    const completed = new Set<string>();
    const failed = new Set<string>();
    const skipped = new Set<string>();
    const stageResults: DAGStageResult[] = [];
    const errors: string[] = [];
    let stopExecution = false;

    if (this.config.parallel !== false) {
      // ================================================================
      // 병렬 실행 모드
      // ================================================================
      while (completed.size + failed.size + skipped.size < this.stages.size && !stopExecution) {
        // 실행 가능한 스테이지 찾기: 모든 의존성 완료 + 아직 미실행
        const ready: StageDefinition[] = [];

        for (const [name, stage] of this.stages) {
          if (completed.has(name) || failed.has(name) || skipped.has(name)) continue;

          // 의존성 확인
          const depsReady = stage.dependsOn.every(dep => completed.has(dep));
          const depsFailed = stage.dependsOn.some(dep => failed.has(dep) || skipped.has(dep));

          if (depsFailed) {
            // 의존 스테이지가 실패 → 이 스테이지도 건너뜀
            skipped.add(name);
            stageResults.push({
              name,
              status: 'skipped',
              startedAt: new Date().toISOString(),
              completedAt: new Date().toISOString(),
              duration: 0,
            });
            continue;
          }

          if (depsReady) {
            ready.push(stage);
          }
        }

        if (ready.length === 0 && !stopExecution) {
          // 더 이상 진행할 수 없음 (데드락 또는 모든 경로 차단)
          break;
        }

        // 동시 실행 (maxConcurrency 제한)
        const maxConc = this.config.maxConcurrency || 5;
        const batch = ready.slice(0, maxConc);

        const batchResults = await Promise.allSettled(
          batch.map(stage => this.executeStage(stage, context))
        );

        // 결과 처리
        for (let i = 0; i < batchResults.length; i++) {
          const stage = batch[i];
          const settled = batchResults[i];

          if (settled.status === 'fulfilled') {
            const result = settled.value;
            stageResults.push(result);

            if (result.status === 'completed') {
              completed.add(stage.name);
              context.results.set(stage.name, result.result);
            } else {
              failed.add(stage.name);
              errors.push(`[${stage.name}] ${result.error}`);

              if (stage.onFailure === 'stop') {
                stopExecution = true;
              }
            }
          } else {
            // Promise.allSettled rejected (비정상)
            failed.add(stage.name);
            const err = `[${stage.name}] ${settled.reason}`;
            errors.push(err);
            stageResults.push({
              name: stage.name,
              status: 'failed',
              startedAt: new Date().toISOString(),
              completedAt: new Date().toISOString(),
              duration: 0,
              error: String(settled.reason),
            });

            if (stage.onFailure === 'stop') {
              stopExecution = true;
            }
          }
        }
      }
    } else {
      // ================================================================
      // 순차 실행 모드 (--no-parallel 호환)
      // ================================================================
      for (const stageName of sorted) {
        if (stopExecution) break;

        const stage = this.stages.get(stageName)!;

        // 의존성 실패 확인
        const depsFailed = stage.dependsOn.some(dep => failed.has(dep) || skipped.has(dep));
        if (depsFailed) {
          skipped.add(stageName);
          stageResults.push({
            name: stageName,
            status: 'skipped',
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            duration: 0,
          });
          continue;
        }

        const result = await this.executeStage(stage, context);
        stageResults.push(result);

        if (result.status === 'completed') {
          completed.add(stageName);
          context.results.set(stageName, result.result);
        } else {
          failed.add(stageName);
          errors.push(`[${stageName}] ${result.error}`);

          if (stage.onFailure === 'stop') {
            stopExecution = true;
          }
        }
      }
    }

    // 실행 결과 결정
    const totalDuration = Date.now() - startTime;
    const status: DAGExecutionResult['status'] =
      failed.size === 0 && skipped.size === 0
        ? 'completed'
        : failed.size > 0 && completed.size > 0
          ? 'partial'
          : 'failed';

    // 이벤트 발행
    const summary: Record<string, number> = {
      completed: completed.size,
      failed: failed.size,
      skipped: skipped.size,
    };

    this.eventBus.emit('pipeline:complete', { runId: id, summary });

    return {
      runId: id,
      stages: stageResults,
      status,
      duration: totalDuration,
      errors,
    };
  }

  // ============================================================================
  // 내부 함수
  // ============================================================================

  /**
   * 단일 스테이지 실행
   */
  private async executeStage(
    stage: StageDefinition,
    context: PipelineContext
  ): Promise<DAGStageResult> {
    const startedAt = new Date().toISOString();
    const startTime = Date.now();

    // 이벤트: 시작
    this.eventBus.emit('pipeline:stage-start', {
      runId: context.runId,
      stage: stage.name,
    });

    if (this.config.verbose) {
      console.log(`\n📌 스테이지: ${stage.name}`);
    }

    try {
      const result = await stage.execute(context);
      const duration = Date.now() - startTime;

      // 이벤트: 완료
      this.eventBus.emit('pipeline:stage-end', {
        runId: context.runId,
        stage: stage.name,
        success: true,
        duration,
      });

      if (this.config.verbose) {
        console.log(`   ✓ 완료 (${duration}ms)`);
      }

      return {
        name: stage.name,
        status: 'completed',
        startedAt,
        completedAt: new Date().toISOString(),
        duration,
        result,
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);

      // 이벤트: 실패
      this.eventBus.emit('pipeline:stage-end', {
        runId: context.runId,
        stage: stage.name,
        success: false,
        duration,
      });

      if (this.config.verbose) {
        console.log(`   ✗ 실패: ${errorMsg}`);
      }

      return {
        name: stage.name,
        status: 'failed',
        startedAt,
        completedAt: new Date().toISOString(),
        duration,
        error: errorMsg,
      };
    }
  }

  /**
   * 위상 정렬 (Kahn's algorithm)
   * 순환 의존성 시 null 반환
   */
  private topologicalSort(): string[] | null {
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    // 초기화
    for (const [name, stage] of this.stages) {
      inDegree.set(name, stage.dependsOn.length);
      if (!adjacency.has(name)) {
        adjacency.set(name, []);
      }
      for (const dep of stage.dependsOn) {
        if (!adjacency.has(dep)) {
          adjacency.set(dep, []);
        }
        adjacency.get(dep)!.push(name);
      }
    }

    // 진입 차수 0인 노드 큐
    const queue: string[] = [];
    for (const [name, degree] of inDegree) {
      if (degree === 0) {
        queue.push(name);
      }
    }

    const sorted: string[] = [];

    while (queue.length > 0) {
      const node = queue.shift()!;
      sorted.push(node);

      for (const neighbor of adjacency.get(node) || []) {
        const newDegree = (inDegree.get(neighbor) || 0) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) {
          queue.push(neighbor);
        }
      }
    }

    // 순환 검사
    if (sorted.length !== this.stages.size) {
      return null;
    }

    return sorted;
  }
}

/**
 * 콘텐츠 파이프라인용 기본 DAG 정의 생성
 *
 * 기존 ContentPipeline의 6단계를 DAG StageDefinition으로 변환.
 * pipeline.ts에서 사용.
 */
export function createDefaultPipelineStages(
  stageExecutors: Record<string, (context: PipelineContext) => Promise<unknown>>
): StageDefinition[] {
  return [
    {
      name: 'discover',
      dependsOn: [],
      execute: stageExecutors.discover,
      onFailure: 'skip',
    },
    {
      name: 'select',
      dependsOn: ['discover'],
      execute: stageExecutors.select,
      onFailure: 'stop',
    },
    {
      name: 'generate',
      dependsOn: ['select'],
      execute: stageExecutors.generate,
      onFailure: 'stop',
    },
    {
      name: 'validate',
      dependsOn: ['generate'],
      execute: stageExecutors.validate,
      onFailure: 'skip',
    },
    {
      name: 'publish',
      dependsOn: ['validate'],
      execute: stageExecutors.publish,
      onFailure: 'skip',
    },
    {
      name: 'monitor',
      dependsOn: [],  // 독립 — discover와 병렬 실행 가능
      execute: stageExecutors.monitor,
      onFailure: 'skip',
    },
  ];
}
