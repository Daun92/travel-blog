/**
 * 산림청 둘레길 정보서비스 클라이언트
 * data.go.kr 공용키 사용
 *
 * NOTE: 산림청 API URL은 openapi.forest.go.kr 도메인이지만
 * data.go.kr 포털에서 발급한 공용키로 인증합니다.
 * 엔드포인트가 변경될 수 있으므로, 실패 시 graceful degradation 처리.
 */

import { BaseDataGoKrClient } from '../common/base-client.js';
import { BaseClientConfig } from '../common/types.js';
import { TrailItem } from './types.js';

const TRAIL_BASE = 'http://openapi.forest.go.kr/openapi/service/trailInfoService';

export class TrailClient extends BaseDataGoKrClient {
  protected readonly baseUrl = TRAIL_BASE;

  constructor(config: BaseClientConfig) {
    super({
      ...config,
      usageFilePath: config.usageFilePath ?? 'data/api-usage-forest.json',
      serviceName: 'trailInfoService',
    });
  }

  /**
   * 둘레길 검색
   * @param keyword 둘레길명 또는 지역
   */
  async searchTrails(
    keyword: string,
    opts?: { numOfRows?: number; pageNo?: number }
  ): Promise<TrailItem[]> {
    const params: Record<string, string> = {
      searchWrd: keyword,
      numOfRows: String(opts?.numOfRows ?? 10),
      pageNo: String(opts?.pageNo ?? 1),
    };

    return this.request<TrailItem>('/getForestTrailList', params, 'search');
  }

  /**
   * 둘레길 상세 정보
   * @param trailId 둘레길 ID
   */
  async getTrailDetail(
    trailId: string,
    opts?: { numOfRows?: number }
  ): Promise<TrailItem[]> {
    const params: Record<string, string> = {
      frtrlId: trailId,
      numOfRows: String(opts?.numOfRows ?? 1),
    };

    return this.request<TrailItem>('/getForestTrailDetail', params, 'detail');
  }
}
