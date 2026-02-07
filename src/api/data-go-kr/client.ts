/**
 * data.go.kr 공공 API 클라이언트
 * KorService2 (한국관광공사 국문 관광정보 서비스 v2)
 *
 * CRITICAL: ServiceKey를 URLSearchParams에 넣지 않음 → 이중 인코딩 방지
 */

import {
  DataGoKrResponse,
  DataGoKrClientConfig,
  DataGoKrError,
  TourismItem,
  FestivalItem,
  DetailCommonItem,
  DetailImageItem,
  AreaCodeItem,
  RESULT_CODES,
  CacheTtlConfig,
} from './types.js';
import { RateLimiter } from './rate-limiter.js';
import { ApiCache } from './cache.js';

const KOR_SERVICE2_BASE = 'http://apis.data.go.kr/B551011/KorService2';

export class DataGoKrClient {
  private readonly serviceKey: string;
  private readonly rateLimiter: RateLimiter;
  private readonly cache: ApiCache;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private readonly cacheEnabled: boolean;

  constructor(config: DataGoKrClientConfig) {
    this.serviceKey = config.serviceKey;
    this.maxRetries = config.maxRetries ?? 2;
    this.retryDelayMs = config.retryDelayMs ?? 1000;
    this.cacheEnabled = config.cacheEnabled ?? true;

    this.rateLimiter = new RateLimiter(
      config.dailyQuota ?? 1000,
      config.minDelayMs ?? 200,
      config.usageFilePath ?? 'data/api-usage.json'
    );

    this.cache = new ApiCache(
      config.cacheDir ?? 'data/api-cache'
    );
  }

  // ============================================================================
  // 공개 API 메서드
  // ============================================================================

  /** 키워드 검색 (searchKeyword2) */
  async searchKeyword(
    keyword: string,
    opts?: { contentTypeId?: string; areaCode?: string; numOfRows?: number; pageNo?: number }
  ): Promise<TourismItem[]> {
    const params: Record<string, string> = {
      keyword,
      numOfRows: String(opts?.numOfRows ?? 20),
      pageNo: String(opts?.pageNo ?? 1),
    };
    if (opts?.contentTypeId) params.contentTypeId = opts.contentTypeId;
    if (opts?.areaCode) params.areaCode = opts.areaCode;

    return this.request<TourismItem>('/searchKeyword2', params, 'search');
  }

  /** 축제/행사 검색 (searchFestival2) */
  async searchFestival(
    opts?: {
      eventStartDate?: string;
      eventEndDate?: string;
      areaCode?: string;
      numOfRows?: number;
      pageNo?: number;
    }
  ): Promise<FestivalItem[]> {
    const params: Record<string, string> = {
      numOfRows: String(opts?.numOfRows ?? 20),
      pageNo: String(opts?.pageNo ?? 1),
    };
    if (opts?.eventStartDate) params.eventStartDate = opts.eventStartDate;
    if (opts?.eventEndDate) params.eventEndDate = opts.eventEndDate;
    if (opts?.areaCode) params.areaCode = opts.areaCode;

    return this.request<FestivalItem>('/searchFestival2', params, 'festival');
  }

  /** 지역기반 관광정보 (areaBasedList2) */
  async areaBasedList(
    opts?: {
      contentTypeId?: string;
      areaCode?: string;
      sigunguCode?: string;
      numOfRows?: number;
      pageNo?: number;
      arrange?: string;
    }
  ): Promise<TourismItem[]> {
    const params: Record<string, string> = {
      numOfRows: String(opts?.numOfRows ?? 20),
      pageNo: String(opts?.pageNo ?? 1),
    };
    if (opts?.contentTypeId) params.contentTypeId = opts.contentTypeId;
    if (opts?.areaCode) params.areaCode = opts.areaCode;
    if (opts?.sigunguCode) params.sigunguCode = opts.sigunguCode;
    if (opts?.arrange) params.arrange = opts.arrange;

    return this.request<TourismItem>('/areaBasedList2', params, 'search');
  }

  /** 위치기반 관광정보 (locationBasedList2) */
  async locationBasedList(
    mapX: number,
    mapY: number,
    radius: number = 2000,
    opts?: { contentTypeId?: string; numOfRows?: number; pageNo?: number }
  ): Promise<TourismItem[]> {
    const params: Record<string, string> = {
      mapX: String(mapX),
      mapY: String(mapY),
      radius: String(radius),
      numOfRows: String(opts?.numOfRows ?? 20),
      pageNo: String(opts?.pageNo ?? 1),
    };
    if (opts?.contentTypeId) params.contentTypeId = opts.contentTypeId;

    return this.request<TourismItem>('/locationBasedList2', params, 'search');
  }

  /** 공통 상세정보 (detailCommon2) */
  async detailCommon(
    contentId: string,
    opts?: { numOfRows?: number }
  ): Promise<DetailCommonItem[]> {
    // KorService2에서는 defaultYN/addrinfoYN/overviewYN/firstImageYN 파라미터 제거됨
    // 최소 파라미터(contentId)만으로 모든 필드 반환
    const params: Record<string, string> = {
      contentId,
    };
    if (opts?.numOfRows) params.numOfRows = String(opts.numOfRows);

    return this.request<DetailCommonItem>('/detailCommon2', params, 'detail');
  }

  /** 이미지 목록 (detailImage2) */
  async detailImage(
    contentId: string,
    opts?: { numOfRows?: number }
  ): Promise<DetailImageItem[]> {
    // KorService2에서는 imageYN/subImageYN 파라미터 제거됨
    const params: Record<string, string> = {
      contentId,
    };
    if (opts?.numOfRows) params.numOfRows = String(opts.numOfRows);

    return this.request<DetailImageItem>('/detailImage2', params, 'detail');
  }

  /** 지역 코드 조회 (areaCode2) */
  async areaCode(areaCode?: string): Promise<AreaCodeItem[]> {
    const params: Record<string, string> = {
      numOfRows: '50',
    };
    if (areaCode) params.areaCode = areaCode;

    return this.request<AreaCodeItem>('/areaCode2', params, 'code');
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
  // 내부 구현
  // ============================================================================

  /**
   * 공통 API 요청 처리
   * CRITICAL: serviceKey는 URL 문자열에 직접 삽입 (URLSearchParams 사용 금지)
   */
  private async request<T>(
    endpoint: string,
    params: Record<string, string>,
    cacheCategory: keyof CacheTtlConfig
  ): Promise<T[]> {
    // 캐시 키 생성
    const cacheKey = `${endpoint}:${JSON.stringify(params)}`;

    // 캐시 히트 확인
    if (this.cacheEnabled) {
      const cached = await this.cache.get<T[]>(cacheKey);
      if (cached !== null) return cached;
    }

    // 공통 파라미터
    const allParams = new URLSearchParams({
      MobileOS: 'WIN',
      MobileApp: 'OpenClaw',
      _type: 'json',
      ...params,
    });

    // CRITICAL: serviceKey는 URLSearchParams 밖에서 직접 삽입
    const url = `${KOR_SERVICE2_BASE}${endpoint}?serviceKey=${this.serviceKey}&${allParams.toString()}`;

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

        // resultCode 검증
        const code = data.response?.header?.resultCode;
        if (code !== '0000') {
          const msg = data.response?.header?.resultMsg || RESULT_CODES[code] || 'UNKNOWN';
          throw new DataGoKrError(
            `data.go.kr API 오류 [${code}]: ${msg}`,
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
          console.warn(`data.go.kr 재시도 ${attempt + 1}/${this.maxRetries}: ${lastError.message}`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError ?? new Error('data.go.kr API 요청 실패');
  }

  /**
   * items 정규화: 빈 문자열(''), 단일 객체, 배열 → 항상 배열
   */
  private normalizeItems<T>(data: DataGoKrResponse<T>): T[] {
    const body = data.response?.body;
    if (!body) return [];

    // data.go.kr은 결과 없으면 items를 빈 문자열('')로 반환
    // unknown 경유로 타입 안전하게 처리
    const rawItems = body.items as unknown;
    if (!rawItems || rawItems === '') return [];

    const itemObj = rawItems as { item: T[] | T | '' };
    const items = itemObj.item;
    // 단일 결과: 객체, 복수: 배열, 없음: ''
    if (!items || items === '') return [];
    if (Array.isArray(items)) return items;
    return [items as T];
  }
}
