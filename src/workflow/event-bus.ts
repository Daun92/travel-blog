/**
 * 워크플로우 이벤트 버스
 * Layer 4 (조율층) 통신 인프라 — 타입 안전 이벤트 기반 통신
 *
 * 모든 Layer 간 느슨한 결합을 제공하며, 기존 코드에 영향 없이
 * 이벤트 구독/발행으로 피드백 루프와 모니터링을 연결한다.
 */

import { EventEmitter } from 'events';

// ============================================================================
// 이벤트 타입 맵
// ============================================================================

export interface WorkflowEvents {
  // Layer 2: 콘텐츠 흐름
  'content:generated': {
    filePath: string;
    topic: string;
    type: 'travel' | 'culture';
  };
  'content:enhanced': {
    filePath: string;
    changes: { clichesRemoved: number; detailsAdded: number };
  };
  'content:published': {
    filePath: string;
    blogUrl: string;
  };

  // Layer 3: 품질
  'quality:gate-passed': {
    filePath: string;
    gate: string;
    score: number;
  };
  'quality:gate-failed': {
    filePath: string;
    gate: string;
    score: number;
    remediation?: string;
  };
  'quality:mesh-complete': {
    filePath: string;
    canPublish: boolean;
    scores: Record<string, number>;
    remediationsApplied: number;
  };

  // Layer 1: Discovery (주제 발굴)
  'discovery:phase-start': {
    phase: string;
    mode: 'standard' | 'enhanced';
  };
  'discovery:trending-complete': {
    count: number;
    submolt?: string;
  };
  'discovery:gap-complete': {
    gapCount: number;
    uncoveredCount: number;
  };
  'discovery:recommendations': {
    count: number;
    topScore: number;
    sources: string[];
  };
  'discovery:balance-applied': {
    agentBoosts: Record<string, number>;
    regionBoosts: Record<string, number>;
    framingBoosts: Record<string, number>;
  };
  'discovery:enhanced-phase': {
    dimension: string;
    count: number;
    details?: string;
  };
  'discovery:queue-populated': {
    added: number;
    queueSize: number;
    topTitle: string;
  };
  'discovery:complete': {
    totalRecommendations: number;
    mode: string;
    duration: number;
  };

  // Layer 1: 데이터/피드백
  'data:collected': {
    topic: string;
    sources: string[];
  };
  'feedback:received': {
    postSlug: string;
    sentiment: number;
  };
  'feedback:strategy-updated': {
    changes: string[];
  };

  // Layer 4: 조율
  'pipeline:stage-start': {
    runId: string;
    stage: string;
  };
  'pipeline:stage-end': {
    runId: string;
    stage: string;
    success: boolean;
    duration: number;
  };
  'pipeline:complete': {
    runId: string;
    summary: Record<string, number>;
  };
}

export type WorkflowEventName = keyof WorkflowEvents;

// ============================================================================
// 타입 안전 이벤트 버스
// ============================================================================

export class WorkflowEventBus extends EventEmitter {
  private _verbose = false;

  /**
   * 타입 안전 emit
   */
  emit<K extends WorkflowEventName>(event: K, data: WorkflowEvents[K]): boolean {
    if (this._verbose) {
      console.log(`[event] ${event}`, JSON.stringify(data).slice(0, 120));
    }
    return super.emit(event, data);
  }

  /**
   * 타입 안전 on
   */
  on<K extends WorkflowEventName>(
    event: K,
    listener: (data: WorkflowEvents[K]) => void
  ): this {
    return super.on(event, listener as (...args: unknown[]) => void);
  }

  /**
   * 타입 안전 once
   */
  once<K extends WorkflowEventName>(
    event: K,
    listener: (data: WorkflowEvents[K]) => void
  ): this {
    return super.once(event, listener as (...args: unknown[]) => void);
  }

  /**
   * verbose 모드 설정 (이벤트 로그 출력)
   */
  setVerbose(verbose: boolean): void {
    this._verbose = verbose;
  }
}

// ============================================================================
// 싱글턴
// ============================================================================

let _bus: WorkflowEventBus | null = null;

/**
 * 워크플로우 이벤트 버스 싱글턴 반환
 * 파이프라인, 스케줄러, CLI가 동일한 버스를 공유한다.
 */
export function getEventBus(): WorkflowEventBus {
  if (!_bus) {
    _bus = new WorkflowEventBus();
  }
  return _bus;
}

/**
 * 테스트용: 싱글턴 리셋
 */
export function resetEventBus(): void {
  if (_bus) {
    _bus.removeAllListeners();
    _bus = null;
  }
}
