/**
 * 에러 복구/재시도 로직 모듈
 */

import { loadQualityConfig } from './config.js';

/**
 * 재시도 설정
 */
export interface RetryConfig {
  maxRetries: number;
  backoffMs: number[];
  fallbackStrategy: 'skip' | 'manual' | 'cache';
}

/**
 * 재시도 결과
 */
export interface RetryResult<T> {
  success: boolean;
  result?: T;
  attempts: number;
  lastError?: Error;
  usedFallback: boolean;
  fallbackResult?: T;
}

/**
 * 에러 타입 분류
 */
export type ErrorType =
  | 'network'       // 네트워크 오류
  | 'rate_limit'    // API 제한
  | 'auth'          // 인증 오류
  | 'timeout'       // 타임아웃
  | 'server'        // 서버 오류
  | 'validation'    // 유효성 검사 오류
  | 'unknown';      // 알 수 없는 오류

/**
 * 에러 타입 판별
 */
export function classifyError(error: unknown): ErrorType {
  if (!(error instanceof Error)) return 'unknown';

  const message = error.message.toLowerCase();

  if (message.includes('network') || message.includes('fetch') || message.includes('dns')) {
    return 'network';
  }

  if (message.includes('rate') || message.includes('limit') || message.includes('quota')) {
    return 'rate_limit';
  }

  if (message.includes('auth') || message.includes('401') || message.includes('403')) {
    return 'auth';
  }

  if (message.includes('timeout') || message.includes('timed out')) {
    return 'timeout';
  }

  if (message.includes('500') || message.includes('502') || message.includes('503')) {
    return 'server';
  }

  if (message.includes('valid') || message.includes('invalid')) {
    return 'validation';
  }

  return 'unknown';
}

/**
 * 재시도 가능 여부 판단
 */
export function isRetryable(errorType: ErrorType): boolean {
  // 재시도 가능한 에러
  const retryableErrors: ErrorType[] = ['network', 'rate_limit', 'timeout', 'server'];
  return retryableErrors.includes(errorType);
}

/**
 * 지수 백오프 딜레이 계산
 */
function calculateBackoff(attempt: number, backoffMs: number[]): number {
  if (attempt < backoffMs.length) {
    return backoffMs[attempt];
  }
  // 마지막 값 사용
  return backoffMs[backoffMs.length - 1];
}

/**
 * 지정된 시간만큼 대기
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 재시도 래퍼 함수
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    config?: Partial<RetryConfig>;
    fallback?: () => Promise<T>;
    onRetry?: (attempt: number, error: Error, delay: number) => void;
    shouldRetry?: (error: Error) => boolean;
  } = {}
): Promise<RetryResult<T>> {
  // 설정 로드
  const qualityConfig = await loadQualityConfig();
  const config: RetryConfig = {
    maxRetries: options.config?.maxRetries ?? qualityConfig.retry.maxRetries,
    backoffMs: options.config?.backoffMs ?? qualityConfig.retry.backoffMs,
    fallbackStrategy: options.config?.fallbackStrategy ?? qualityConfig.retry.fallbackStrategy
  };

  let lastError: Error | undefined;
  let attempts = 0;

  // 재시도 루프
  for (let i = 0; i <= config.maxRetries; i++) {
    attempts = i + 1;

    try {
      const result = await operation();
      return {
        success: true,
        result,
        attempts,
        usedFallback: false
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // 재시도 가능 여부 확인
      const errorType = classifyError(error);
      const canRetry = options.shouldRetry
        ? options.shouldRetry(lastError)
        : isRetryable(errorType);

      if (!canRetry || i >= config.maxRetries) {
        break;
      }

      // 백오프 대기
      const delay = calculateBackoff(i, config.backoffMs);

      if (options.onRetry) {
        options.onRetry(i + 1, lastError, delay);
      }

      await sleep(delay);
    }
  }

  // 모든 재시도 실패 - 폴백 전략 적용
  let fallbackResult: T | undefined;
  let usedFallback = false;

  if (config.fallbackStrategy === 'cache' && options.fallback) {
    try {
      fallbackResult = await options.fallback();
      usedFallback = true;
    } catch {
      // 폴백도 실패
    }
  }

  return {
    success: usedFallback,
    result: fallbackResult,
    attempts,
    lastError,
    usedFallback,
    fallbackResult
  };
}

/**
 * 배치 작업용 재시도 래퍼
 */
export async function withBatchRetry<T, R>(
  items: T[],
  operation: (item: T) => Promise<R>,
  options: {
    config?: Partial<RetryConfig>;
    concurrency?: number;
    onItemError?: (item: T, error: Error) => void;
    onItemSuccess?: (item: T, result: R) => void;
  } = {}
): Promise<{
  results: Array<{ item: T; result?: R; error?: Error; success: boolean }>;
  successCount: number;
  failCount: number;
}> {
  const results: Array<{ item: T; result?: R; error?: Error; success: boolean }> = [];
  let successCount = 0;
  let failCount = 0;

  // 순차 처리 (concurrency 미지원 - 간단 구현)
  for (const item of items) {
    const retryResult = await withRetry(
      () => operation(item),
      { config: options.config }
    );

    if (retryResult.success && retryResult.result !== undefined) {
      results.push({ item, result: retryResult.result, success: true });
      successCount++;

      if (options.onItemSuccess) {
        options.onItemSuccess(item, retryResult.result);
      }
    } else {
      results.push({ item, error: retryResult.lastError, success: false });
      failCount++;

      if (options.onItemError && retryResult.lastError) {
        options.onItemError(item, retryResult.lastError);
      }
    }
  }

  return { results, successCount, failCount };
}

/**
 * 타임아웃 래퍼
 */
export async function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    operation()
      .then(result => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch(error => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

/**
 * 서킷 브레이커 패턴 구현
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailure: Date | null = null;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private threshold: number = 5,           // 실패 임계값
    private resetTimeoutMs: number = 60000   // 리셋 타임아웃 (1분)
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // 회로 상태 확인
    if (this.state === 'open') {
      const timeSinceLastFailure = this.lastFailure
        ? Date.now() - this.lastFailure.getTime()
        : Infinity;

      if (timeSinceLastFailure < this.resetTimeoutMs) {
        throw new Error('Circuit breaker is open - request blocked');
      }

      // Half-open 상태로 전환
      this.state = 'half-open';
    }

    try {
      const result = await operation();

      // 성공 시 리셋
      this.failures = 0;
      this.state = 'closed';

      return result;
    } catch (error) {
      this.failures++;
      this.lastFailure = new Date();

      if (this.failures >= this.threshold) {
        this.state = 'open';
      }

      throw error;
    }
  }

  getState(): 'closed' | 'open' | 'half-open' {
    return this.state;
  }

  reset(): void {
    this.failures = 0;
    this.lastFailure = null;
    this.state = 'closed';
  }
}
