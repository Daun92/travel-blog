/**
 * 예술의전당 API 클라이언트
 * #2 종합 공연정보 (API_CCA_148)
 * #8 공연-음악회 (rest/meta/SACperf)
 */

import { BaseKcisaClient } from '../common/kcisa-client.js';
import { BaseClientConfig } from '../common/types.js';
import { SacPerformanceItem, KcisaMetaItem } from './types.js';

// #2 예술의전당 종합 공연정보
const SAC_COMPREHENSIVE_BASE = 'https://api.kcisa.kr/openapi/API_CCA_148';

export class SacComprehensiveClient extends BaseKcisaClient {
  protected readonly baseUrl = SAC_COMPREHENSIVE_BASE;

  constructor(config: BaseClientConfig) {
    super({
      ...config,
      usageFilePath: config.usageFilePath ?? 'data/api-usage-kcisa.json',
      serviceName: '예술의전당_종합',
    });
  }

  /** 종합 공연/전시 검색 */
  async searchPerformances(
    opts?: { numOfRows?: number; pageNo?: number }
  ): Promise<SacPerformanceItem[]> {
    const params: Record<string, string> = {
      numOfRows: String(opts?.numOfRows ?? 20),
      pageNo: String(opts?.pageNo ?? 1),
    };
    return this.request<SacPerformanceItem>('/request', params, 'search');
  }
}

// #8 예술의전당 공연-음악회
const SAC_CONCERT_BASE = 'https://api.kcisa.kr/openapi/service/rest/meta';

export class SacConcertClient extends BaseKcisaClient {
  protected readonly baseUrl = SAC_CONCERT_BASE;

  constructor(config: BaseClientConfig) {
    super({
      ...config,
      usageFilePath: config.usageFilePath ?? 'data/api-usage-kcisa.json',
      serviceName: '예술의전당_음악회',
    });
  }

  /** 음악회 공연정보 검색 */
  async searchConcerts(
    opts?: { numOfRows?: number; pageNo?: number }
  ): Promise<KcisaMetaItem[]> {
    const params: Record<string, string> = {
      numOfRows: String(opts?.numOfRows ?? 20),
      pageNo: String(opts?.pageNo ?? 1),
    };
    return this.request<KcisaMetaItem>('/SACperf', params, 'search');
  }
}
