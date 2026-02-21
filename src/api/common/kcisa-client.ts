/**
 * api.kcisa.kr (문화공공데이터광장) 공통 기반 클래스
 * CULTURE_API_KEY 사용, JSON 응답
 *
 * 예술의전당, 문화체육관광부, 한국지역진흥재단, 한국문화예술위원회 등
 * culture.go.kr/data/openapi 에서 발급받은 키로 호출
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

export abstract class BaseKcisaClient {
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

    const serviceName = config.serviceName ?? 'KCISA';

    this.rateLimiter = new RateLimiter(
      config.dailyQuota ?? 1000,
      config.minDelayMs ?? 200,
      config.usageFilePath ?? 'data/api-usage-kcisa.json',
      serviceName
    );

    this.cache = new ApiCache(
      config.cacheDir ?? 'data/api-cache'
    );
  }

  /** API 사용량 조회 */
  async getUsage() {
    return this.rateLimiter.getUsage();
  }

  /** 남은 쿼터 */
  async getRemaining() {
    return this.rateLimiter.getRemaining();
  }

  /**
   * api.kcisa.kr JSON API 공통 요청
   * 응답 형식이 data.go.kr과 동일한 경우 (response.body.items.item)
   */
  protected async request<T>(
    endpoint: string,
    params: Record<string, string>,
    cacheCategory: keyof CacheTtlConfig
  ): Promise<T[]> {
    const cacheKey = `${this.baseUrl}${endpoint}:${JSON.stringify(params)}`;

    if (this.cacheEnabled) {
      const cached = await this.cache.get<T[]>(cacheKey);
      if (cached !== null) return cached;
    }

    const allParams = new URLSearchParams(params);

    // CULTURE_API_KEY는 UUID 형식이라 인코딩 이슈 없지만, 일관성을 위해 raw 삽입
    const url = `${this.baseUrl}${endpoint}?serviceKey=${this.serviceKey}&${allParams.toString()}`;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        await this.rateLimiter.acquire();

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json() as DataGoKrResponse<T>;

        // resultCode 검증
        const code = data.response?.header?.resultCode;
        if (code !== '0000' && code !== '00') {
          const msg = data.response?.header?.resultMsg || RESULT_CODES[code] || 'UNKNOWN';
          throw new DataGoKrError(
            `KCISA API 오류 [${code}]: ${msg}`,
            code,
            msg
          );
        }

        // items 정규화
        const items = this.normalizeItems<T>(data);

        if (this.cacheEnabled) {
          await this.cache.set(cacheKey, items, cacheCategory);
        }

        return items;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (
          error instanceof DataGoKrError &&
          ['0020', '0021', '0022', '0030'].includes(error.resultCode)
        ) {
          throw error;
        }

        if (attempt < this.maxRetries) {
          const delay = this.retryDelayMs * Math.pow(2, attempt);
          console.warn(`KCISA API 재시도 ${attempt + 1}/${this.maxRetries}: ${lastError.message}`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError ?? new Error('KCISA API 요청 실패');
  }

  /**
   * items 정규화: data.go.kr과 동일한 래퍼
   */
  protected normalizeItems<T>(data: DataGoKrResponse<T>): T[] {
    const body = data.response?.body;
    if (!body) return [];

    const rawItems = body.items as unknown;
    if (!rawItems || rawItems === '') return [];

    const itemObj = rawItems as { item: T[] | T | '' };
    const items = itemObj.item;
    if (!items || items === '') return [];
    if (Array.isArray(items)) return items;
    return [items as T];
  }
}
