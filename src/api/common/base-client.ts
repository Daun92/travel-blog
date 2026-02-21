/**
 * data.go.kr JSON API 공통 기반 클래스
 * KorService2, TourStnInfoService1, DataLabService 등이 상속
 *
 * CRITICAL: serviceKey는 URLSearchParams에 넣지 않음 → 이중 인코딩 방지
 */

import {
  BaseClientConfig,
  DataGoKrResponse,
  DataGoKrError,
  RESULT_CODES,
  CacheTtlConfig,
} from './types.js';
import { RateLimiter } from './rate-limiter.js';
import { ApiCache } from './cache.js';

export abstract class BaseDataGoKrClient {
  protected abstract readonly baseUrl: string;
  protected readonly serviceKey: string;
  protected readonly rateLimiter: RateLimiter;
  protected readonly cache: ApiCache;
  protected readonly maxRetries: number;
  protected readonly retryDelayMs: number;
  protected readonly cacheEnabled: boolean;

  constructor(config: BaseClientConfig) {
    this.serviceKey = config.serviceKey;
    this.maxRetries = config.maxRetries ?? 2;
    this.retryDelayMs = config.retryDelayMs ?? 1000;
    this.cacheEnabled = config.cacheEnabled ?? true;

    const serviceName = config.serviceName ?? 'data.go.kr';

    this.rateLimiter = new RateLimiter(
      config.dailyQuota ?? 1000,
      config.minDelayMs ?? 200,
      config.usageFilePath ?? 'data/api-usage.json',
      serviceName
    );

    this.cache = new ApiCache(
      config.cacheDir ?? 'data/api-cache'
    );
  }

  // ============================================================================
  // 유틸리티
  // ============================================================================

  /** API 사용량 조회 */
  async getUsage() {
    return this.rateLimiter.getUsage();
  }

  /** 남은 쿼터 */
  async getRemaining() {
    return this.rateLimiter.getRemaining();
  }

  /** 캐시 정리 */
  async cleanupCache() {
    return this.cache.cleanup();
  }

  /** 캐시 전체 삭제 */
  async clearCache() {
    return this.cache.clear();
  }

  /** 캐시 통계 */
  async cacheStats() {
    return this.cache.stats();
  }

  // ============================================================================
  // 서브클래스 오버라이드 가능
  // ============================================================================

  /**
   * Service API 요청 시 기본 파라미터
   * 한국관광공사 API: MobileOS, MobileApp, _type=json
   * 기상청 API 등: dataType=JSON (서브클래스에서 오버라이드)
   */
  protected getDefaultParams(): Record<string, string> {
    return {
      MobileOS: 'WIN',
      MobileApp: 'OpenClaw',
      _type: 'json',
    };
  }

  // ============================================================================
  // 공통 요청 처리
  // ============================================================================

  /**
   * data.go.kr JSON API 공통 요청
   * CRITICAL: serviceKey는 URL 문자열에 직접 삽입 (URLSearchParams 사용 금지)
   */
  protected async request<T>(
    endpoint: string,
    params: Record<string, string>,
    cacheCategory: keyof CacheTtlConfig
  ): Promise<T[]> {
    // 캐시 키 생성
    const cacheKey = `${this.baseUrl}${endpoint}:${JSON.stringify(params)}`;

    // 캐시 히트 확인
    if (this.cacheEnabled) {
      const cached = await this.cache.get<T[]>(cacheKey);
      if (cached !== null) return cached;
    }

    // 공통 파라미터 (서브클래스에서 오버라이드 가능)
    const allParams = new URLSearchParams({
      ...this.getDefaultParams(),
      ...params,
    });

    // CRITICAL: serviceKey는 URLSearchParams 밖에서 직접 삽입
    const url = `${this.baseUrl}${endpoint}?serviceKey=${this.serviceKey}&${allParams.toString()}`;

    // 재시도 루프
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        // 레이트 리밋 + 쿼터 체크
        await this.rateLimiter.acquire();

        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json() as DataGoKrResponse<T>;

        // resultCode 검증 (한국관광공사: '0000', 기상청: '00')
        const code = data.response?.header?.resultCode;
        if (code !== '0000' && code !== '00') {
          const msg = data.response?.header?.resultMsg || RESULT_CODES[code] || 'UNKNOWN';
          throw new DataGoKrError(
            `API 오류 [${code}]: ${msg}`,
            code,
            msg
          );
        }

        // items 정규화
        const items = this.normalizeItems<T>(data);

        // 캐시 저장
        if (this.cacheEnabled) {
          await this.cache.set(cacheKey, items, cacheCategory);
        }

        return items;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // 쿼터 초과 또는 인증 오류는 재시도 불필요
        if (
          error instanceof DataGoKrError &&
          ['0022', '0030', '0021'].includes(error.resultCode)
        ) {
          throw error;
        }

        if (attempt < this.maxRetries) {
          const delay = this.retryDelayMs * Math.pow(2, attempt);
          console.warn(`API 재시도 ${attempt + 1}/${this.maxRetries}: ${lastError.message}`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError ?? new Error('API 요청 실패');
  }

  /**
   * items 정규화: 빈 문자열(''), 단일 객체, 배열 → 항상 배열
   */
  protected normalizeItems<T>(data: DataGoKrResponse<T>): T[] {
    const body = data.response?.body;
    if (!body) return [];

    // data.go.kr은 결과 없으면 items를 빈 문자열('')로 반환
    const rawItems = body.items as unknown;
    if (!rawItems || rawItems === '') return [];

    const itemObj = rawItems as { item: T[] | T | '' };
    const items = itemObj.item;
    if (!items || items === '') return [];
    if (Array.isArray(items)) return items;
    return [items as T];
  }

  /**
   * 공공데이터포털 표준데이터 API 요청
   * 응답 형식: { data: T[], totalCount, page, perPage }
   * @param params 요청 파라미터
   * @param cacheCategory 캐시 카테고리
   * @param fieldMap 한글→영문 필드명 매핑 (optional)
   */
  protected async requestStandardData<T>(
    params: Record<string, string>,
    cacheCategory: keyof CacheTtlConfig,
    fieldMap?: Record<string, string>
  ): Promise<T[]> {
    const cacheKey = `${this.baseUrl}:std:${JSON.stringify(params)}`;

    if (this.cacheEnabled) {
      const cached = await this.cache.get<T[]>(cacheKey);
      if (cached !== null) return cached;
    }

    const allParams = new URLSearchParams({
      type: 'json',
      ...params,
    });

    // CRITICAL: serviceKey는 URLSearchParams 밖에서 직접 삽입
    const url = `${this.baseUrl}?serviceKey=${this.serviceKey}&${allParams.toString()}`;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        await this.rateLimiter.acquire();

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const json = await response.json() as Record<string, unknown>;

        // 표준데이터 API도 에러 시 기존 response.header 형식을 반환함
        const errResp = json as { response?: { header?: { resultCode?: string; resultMsg?: string } } };
        if (errResp.response?.header?.resultCode && errResp.response.header.resultCode !== '0000') {
          const code = errResp.response.header.resultCode;
          const msg = errResp.response.header.resultMsg || RESULT_CODES[code] || 'UNKNOWN';
          throw new DataGoKrError(
            `표준데이터 API 오류 [${code}]: ${msg}`,
            code,
            msg
          );
        }

        const stdData = json as { data?: unknown[]; totalCount?: number };
        let items: T[] = Array.isArray(stdData.data) ? stdData.data as T[] : [];

        // 한글→영문 필드명 매핑
        if (fieldMap && items.length > 0) {
          items = items.map(item => {
            const mapped: Record<string, unknown> = {};
            for (const [ko, en] of Object.entries(fieldMap)) {
              mapped[en] = (item as Record<string, unknown>)[ko];
            }
            return mapped as T;
          });
        }

        if (this.cacheEnabled) {
          await this.cache.set(cacheKey, items, cacheCategory);
        }

        return items;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // 인증/쿼터 오류는 재시도 불필요
        // NOTE: 표준데이터 API는 2자리('30'), Service API는 4자리('0030') 코드 사용
        if (
          error instanceof DataGoKrError &&
          ['0022', '0030', '0021', '0020', '22', '30', '21', '20'].includes(error.resultCode)
        ) {
          throw error;
        }

        if (attempt < this.maxRetries) {
          const delay = this.retryDelayMs * Math.pow(2, attempt);
          console.warn(`API 재시도 ${attempt + 1}/${this.maxRetries}: ${lastError.message}`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError ?? new Error('API 요청 실패');
  }
}
