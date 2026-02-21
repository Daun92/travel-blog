/**
 * #5 방방곡곡 트래킹 안내 서비스
 * convergence2017/conver2 — 둘레길/산책로/자전거길
 */

import { BaseKcisaClient } from '../common/kcisa-client.js';
import { BaseClientConfig } from '../common/types.js';
import { TrackingItem } from './types.js';

const TRACKING_BASE = 'https://api.kcisa.kr/openapi/service/rest/convergence2017';

export class TrackingClient extends BaseKcisaClient {
  protected readonly baseUrl = TRACKING_BASE;

  constructor(config: BaseClientConfig) {
    super({
      ...config,
      usageFilePath: config.usageFilePath ?? 'data/api-usage-kcisa.json',
      serviceName: '트래킹',
    });
  }

  /** 트래킹/둘레길 검색 */
  async searchTrails(
    opts?: { keyword?: string; numOfRows?: number; pageNo?: number }
  ): Promise<TrackingItem[]> {
    const params: Record<string, string> = {
      numOfRows: String(opts?.numOfRows ?? 20),
      pageNo: String(opts?.pageNo ?? 1),
    };
    if (opts?.keyword) params.keyword = opts.keyword;
    return this.request<TrackingItem>('/conver2', params, 'search');
  }
}
