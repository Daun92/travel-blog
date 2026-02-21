/**
 * 관광빅데이터 정보서비스 클라이언트
 * DataLabService — data.go.kr 공용키 사용
 *
 * 주요 엔드포인트:
 * - /metcoRegnVisitrDDList: 광역시도별 방문자 수
 * - /locgoRegnVisitrDDList: 시군구별 방문자 수
 *
 * NOTE: 키워드 검색 트렌드 API는 DataLabService에 존재하지 않을 수 있음.
 * 방문자 통계에 집중하며, 키워드 트렌드는 graceful degradation 처리.
 */

import { BaseDataGoKrClient } from '../common/base-client.js';
import { BaseClientConfig } from '../common/types.js';
import { KeywordTrendItem, VisitorStatsItem } from './types.js';

const BIGDATA_BASE = 'http://apis.data.go.kr/B551011/DataLabService';

export class BigDataClient extends BaseDataGoKrClient {
  protected readonly baseUrl = BIGDATA_BASE;

  constructor(config: BaseClientConfig) {
    super({
      ...config,
      usageFilePath: config.usageFilePath ?? 'data/api-usage-bigdata.json',
      serviceName: 'DataLabService',
    });
  }

  /**
   * 키워드 검색 트렌드 조회
   *
   * NOTE: 정확한 엔드포인트 확인 필요. 실패 시 빈 배열 반환.
   * @param keyword 검색어
   * @param startYmd 시작일 (YYYYMMDD)
   * @param endYmd 종료일 (YYYYMMDD)
   */
  async getKeywordTrend(
    keyword: string,
    opts?: { startYmd?: string; endYmd?: string; numOfRows?: number }
  ): Promise<KeywordTrendItem[]> {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600_000)
      .toISOString().slice(0, 10).replace(/-/g, '');

    const params: Record<string, string> = {
      keyword,
      startYmd: opts?.startYmd ?? thirtyDaysAgo,
      endYmd: opts?.endYmd ?? today,
      numOfRows: String(opts?.numOfRows ?? 12),
    };

    return this.request<KeywordTrendItem>('/srchTrend', params, 'search');
  }

  /**
   * 광역시도별 방문자 통계 조회
   * NOTE: DataLabService는 areaCode를 입력 파라미터로 받지 않음
   *       전체 데이터를 받은 후 클라이언트에서 필터링
   * @param areaCode 지역코드 (11=서울, 12=인천 등) — 미지정 시 전체 반환
   */
  async getVisitorStats(
    areaCode?: string,
    opts?: { startYmd?: string; endYmd?: string; numOfRows?: number }
  ): Promise<VisitorStatsItem[]> {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600_000)
      .toISOString().slice(0, 10).replace(/-/g, '');

    const params: Record<string, string> = {
      startYmd: opts?.startYmd ?? thirtyDaysAgo,
      endYmd: opts?.endYmd ?? today,
      numOfRows: String(opts?.numOfRows ?? 100),
    };

    const items = await this.request<VisitorStatsItem>('/metcoRegnVisitrDDList', params, 'search');

    // 클라이언트 필터링
    if (areaCode) {
      return items.filter(item => item.areaCode === areaCode);
    }
    return items;
  }

  /**
   * 시군구별 방문자 통계 조회
   * NOTE: DataLabService는 signguCode를 입력 파라미터로 받지 않을 수 있음
   * @param signguCode 시군구 코드 — 미지정 시 전체 반환
   */
  async getLocalVisitorStats(
    signguCode?: string,
    opts?: { startYmd?: string; endYmd?: string; numOfRows?: number }
  ): Promise<VisitorStatsItem[]> {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600_000)
      .toISOString().slice(0, 10).replace(/-/g, '');

    const params: Record<string, string> = {
      startYmd: opts?.startYmd ?? thirtyDaysAgo,
      endYmd: opts?.endYmd ?? today,
      numOfRows: String(opts?.numOfRows ?? 100),
    };

    const items = await this.request<VisitorStatsItem>('/locgoRegnVisitrDDList', params, 'search');

    if (signguCode) {
      return items.filter(item => item.signguCode === signguCode);
    }
    return items;
  }
}
