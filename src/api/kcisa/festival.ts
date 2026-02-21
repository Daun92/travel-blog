/**
 * 축제 API 클라이언트
 * #3 문화체육관광부_지역축제정보 (meta4/getKCPG0504)
 * #4 한국지역진흥재단_축제정보 (meta/KOLfest)
 */

import { BaseKcisaClient } from '../common/kcisa-client.js';
import { BaseClientConfig } from '../common/types.js';
import { KcisaMetaItem } from './types.js';

// #3 문화체육관광부 지역축제정보
const MCST_FESTIVAL_BASE = 'https://api.kcisa.kr/openapi/service/rest/meta4';

export class McstFestivalClient extends BaseKcisaClient {
  protected readonly baseUrl = MCST_FESTIVAL_BASE;

  constructor(config: BaseClientConfig) {
    super({
      ...config,
      usageFilePath: config.usageFilePath ?? 'data/api-usage-kcisa.json',
      serviceName: '문체부_축제',
    });
  }

  /** 지역축제 검색 */
  async searchFestivals(
    opts?: { numOfRows?: number; pageNo?: number }
  ): Promise<KcisaMetaItem[]> {
    const params: Record<string, string> = {
      numOfRows: String(opts?.numOfRows ?? 20),
      pageNo: String(opts?.pageNo ?? 1),
    };
    return this.request<KcisaMetaItem>('/getKCPG0504', params, 'festival');
  }
}

// #4 한국지역진흥재단 축제정보
const KRPF_FESTIVAL_BASE = 'https://api.kcisa.kr/openapi/service/rest/meta';

export class KrpfFestivalClient extends BaseKcisaClient {
  protected readonly baseUrl = KRPF_FESTIVAL_BASE;

  constructor(config: BaseClientConfig) {
    super({
      ...config,
      usageFilePath: config.usageFilePath ?? 'data/api-usage-kcisa.json',
      serviceName: '지역진흥재단_축제',
    });
  }

  /** 축제 검색 */
  async searchFestivals(
    opts?: { numOfRows?: number; pageNo?: number }
  ): Promise<KcisaMetaItem[]> {
    const params: Record<string, string> = {
      numOfRows: String(opts?.numOfRows ?? 20),
      pageNo: String(opts?.pageNo ?? 1),
    };
    return this.request<KcisaMetaItem>('/KOLfest', params, 'festival');
  }
}
