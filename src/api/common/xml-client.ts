/**
 * XML 응답 API 공통 기반 클래스
 * culture.go.kr, kopis.or.kr 등이 상속
 *
 * fast-xml-parser로 XML → JS 객체 변환 후 정규화
 */

import { XMLParser } from 'fast-xml-parser';
import { BaseClientConfig, CacheTtlConfig } from './types.js';
import { RateLimiter } from './rate-limiter.js';
import { ApiCache } from './cache.js';

export abstract class BaseXmlClient {
  protected abstract readonly baseUrl: string;
  protected readonly serviceKey: string;
  protected readonly keyParamName: string;
  protected readonly rateLimiter: RateLimiter;
  protected readonly cache: ApiCache;
  protected readonly maxRetries: number;
  protected readonly retryDelayMs: number;
  protected readonly cacheEnabled: boolean;
  protected readonly xmlParser: XMLParser;

  constructor(config: BaseClientConfig) {
    this.serviceKey = config.serviceKey;
    this.keyParamName = config.keyParamName ?? 'serviceKey';
    this.maxRetries = config.maxRetries ?? 2;
    this.retryDelayMs = config.retryDelayMs ?? 1000;
    this.cacheEnabled = config.cacheEnabled ?? true;

    const serviceName = config.serviceName ?? 'XML API';

    this.rateLimiter = new RateLimiter(
      config.dailyQuota ?? 1000,
      config.minDelayMs ?? 200,
      config.usageFilePath ?? 'data/api-usage.json',
      serviceName
    );

    this.cache = new ApiCache(
      config.cacheDir ?? 'data/api-cache'
    );

    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
      isArray: (name) => {
        // 단일 아이템도 배열로 정규화할 태그 이름들
        const arrayTags = ['db', 'item', 'perforInfo'];
        return arrayTags.includes(name);
      },
    });
  }

  // ============================================================================
  // 유틸리티
  // ============================================================================

  async getUsage() {
    return this.rateLimiter.getUsage();
  }

  async getRemaining() {
    return this.rateLimiter.getRemaining();
  }

  async cleanupCache() {
    return this.cache.cleanup();
  }

  async clearCache() {
    return this.cache.clear();
  }

  async cacheStats() {
    return this.cache.stats();
  }

  // ============================================================================
  // XML 요청 처리
  // ============================================================================

  /**
   * XML API 요청 + 파싱
   * @param extractItems 파싱된 객체에서 아이템 배열을 추출하는 콜백
   */
  protected async requestXml<T>(
    endpoint: string,
    params: Record<string, string>,
    cacheCategory: keyof CacheTtlConfig,
    extractItems: (parsed: Record<string, unknown>) => T[]
  ): Promise<T[]> {
    // 캐시 키 생성
    const cacheKey = `${this.baseUrl}${endpoint}:${JSON.stringify(params)}`;

    // 캐시 히트 확인
    if (this.cacheEnabled) {
      const cached = await this.cache.get<T[]>(cacheKey);
      if (cached !== null) return cached;
    }

    const allParams = new URLSearchParams(params);
    const url = `${this.baseUrl}${endpoint}?${this.keyParamName}=${this.serviceKey}&${allParams.toString()}`;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        await this.rateLimiter.acquire();

        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const xmlText = await response.text();
        const parsed = this.xmlParser.parse(xmlText) as Record<string, unknown>;

        const items = extractItems(parsed);

        // 캐시 저장
        if (this.cacheEnabled) {
          await this.cache.set(cacheKey, items, cacheCategory);
        }

        return items;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < this.maxRetries) {
          const delay = this.retryDelayMs * Math.pow(2, attempt);
          console.warn(`XML API 재시도 ${attempt + 1}/${this.maxRetries}: ${lastError.message}`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError ?? new Error('XML API 요청 실패');
  }
}
