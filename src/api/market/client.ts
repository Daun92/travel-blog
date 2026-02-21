/**
 * 전국전통시장 표준데이터 클라이언트
 * 공공데이터포털 표준데이터 API — api.data.go.kr (data.go.kr 공용키 사용)
 *
 * 응답 형식: { data: T[], totalCount, page, perPage }
 * 필드명: 한글 (시장명, 소재지도로명주소 등) → fieldMap으로 영문 변환
 */

import { BaseDataGoKrClient } from '../common/base-client.js';
import { BaseClientConfig } from '../common/types.js';
import { MarketItem } from './types.js';

const MARKET_BASE = 'http://api.data.go.kr/openapi/tn_pubr_public_trdit_mrkt_api';

/** 한글 필드명 → MarketItem 영문 필드명 매핑 */
const MARKET_FIELD_MAP: Record<string, string> = {
  '시장명': 'mrktNm',
  '시장유형구분': 'mrktType',
  '소재지도로명주소': 'rdnmadr',
  '소재지지번주소': 'lnmadr',
  '점포수': 'storCo',
  '취급품목': 'prdlst',
  '개설연도': 'opertDe',
  '전화번호': 'telno',
  '주차장보유여부': 'parkngPsbltyAt',
  '시장개장일': 'mrktOpenDe',
  '위도': 'latitude',
  '경도': 'longitude',
  '데이터기준일자': 'referenceDate',
};

export class MarketClient extends BaseDataGoKrClient {
  protected readonly baseUrl = MARKET_BASE;

  constructor(config: BaseClientConfig) {
    super({
      ...config,
      usageFilePath: config.usageFilePath ?? 'data/api-usage-market.json',
      serviceName: '전통시장',
    });
  }

  /**
   * 전통시장 검색
   * @param keyword 시장명 또는 지역
   */
  async searchMarkets(
    keyword: string,
    opts?: { numOfRows?: number; pageNo?: number }
  ): Promise<MarketItem[]> {
    const params: Record<string, string> = {
      page: String(opts?.pageNo ?? 1),
      perPage: String(opts?.numOfRows ?? 10),
    };

    // 표준데이터 API 검색 조건: cond[필드명::LIKE]=값
    if (keyword) {
      params['cond[시장명::LIKE]'] = keyword;
    }

    return this.requestStandardData<MarketItem>(params, 'search', MARKET_FIELD_MAP);
  }

  /**
   * 시장 상세 정보 (시장명 정확 매칭)
   * @param marketName 시장명
   */
  async getMarketDetail(
    marketName: string,
    opts?: { numOfRows?: number }
  ): Promise<MarketItem[]> {
    const params: Record<string, string> = {
      page: '1',
      perPage: String(opts?.numOfRows ?? 1),
      'cond[시장명::EQ]': marketName,
    };

    return this.requestStandardData<MarketItem>(params, 'detail', MARKET_FIELD_MAP);
  }
}
