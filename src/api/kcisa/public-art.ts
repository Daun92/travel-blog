/**
 * #7 공공미술 작품을 찾아서
 * convergence2018/conver9 — 지역별 공공미술 조형물
 */

import { BaseKcisaClient } from '../common/kcisa-client.js';
import { BaseClientConfig } from '../common/types.js';
import { PublicArtItem } from './types.js';

const PUBLIC_ART_BASE = 'https://api.kcisa.kr/openapi/service/rest/convergence2018';

export class PublicArtClient extends BaseKcisaClient {
  protected readonly baseUrl = PUBLIC_ART_BASE;

  constructor(config: BaseClientConfig) {
    super({
      ...config,
      usageFilePath: config.usageFilePath ?? 'data/api-usage-kcisa.json',
      serviceName: '공공미술',
    });
  }

  /** 공공미술 작품 검색 */
  async searchArtworks(
    opts?: { sido?: string; gungu?: string; numOfRows?: number; pageNo?: number }
  ): Promise<PublicArtItem[]> {
    const params: Record<string, string> = {
      numOfRows: String(opts?.numOfRows ?? 20),
      pageNo: String(opts?.pageNo ?? 1),
    };
    if (opts?.sido) params.sido = opts.sido;
    if (opts?.gungu) params.gungu = opts.gungu;
    return this.request<PublicArtItem>('/conver9', params, 'search');
  }
}
