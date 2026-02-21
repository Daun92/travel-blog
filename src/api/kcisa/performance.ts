/**
 * #6 한국문화예술위원회_공연정보
 * rest/meta/HNPperf — 한국공연예술센터 공연
 */

import { BaseKcisaClient } from '../common/kcisa-client.js';
import { BaseClientConfig } from '../common/types.js';
import { KcisaMetaItem } from './types.js';

const ARKO_BASE = 'https://api.kcisa.kr/openapi/service/rest/meta';

export class ArkoPerformanceClient extends BaseKcisaClient {
  protected readonly baseUrl = ARKO_BASE;

  constructor(config: BaseClientConfig) {
    super({
      ...config,
      usageFilePath: config.usageFilePath ?? 'data/api-usage-kcisa.json',
      serviceName: 'ARKO_공연',
    });
  }

  /** 공연 검색 */
  async searchPerformances(
    opts?: { numOfRows?: number; pageNo?: number }
  ): Promise<KcisaMetaItem[]> {
    const params: Record<string, string> = {
      numOfRows: String(opts?.numOfRows ?? 20),
      pageNo: String(opts?.pageNo ?? 1),
    };
    return this.request<KcisaMetaItem>('/HNPperf', params, 'search');
  }
}
