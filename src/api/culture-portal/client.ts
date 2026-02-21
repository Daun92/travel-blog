/**
 * 전국공연행사정보 표준데이터 클라이언트
 *
 * 이전: culture.go.kr XML API (폐지됨)
 * 현재: api.data.go.kr/openapi/tn_pubr_public_pblprfr_event_info_api
 *
 * KTO_API_KEY 사용 (data.go.kr 공용)
 */

import { BaseDataGoKrClient } from '../common/base-client.js';
import { BaseClientConfig } from '../common/types.js';
import { CulturePerformanceItem } from './types.js';

const PERFORMANCE_BASE = 'http://api.data.go.kr/openapi/tn_pubr_public_pblprfr_event_info_api';

/** 한글→영문 필드 매핑 */
const PERFORMANCE_FIELD_MAP: Record<string, string> = {
  '행사명': 'eventNm',
  '개최장소': 'opar',
  '행사내용': 'eventCo',
  '행사시작일자': 'eventStartDate',
  '행사종료일자': 'eventEndDate',
  '행사시작시각': 'eventStartTime',
  '행사종료시각': 'eventEndTime',
  '관람요금': 'admfee',
  '주관기관명': 'auspcInsttNm',
  '주최기관명': 'mnnstNm',
  '전화번호': 'phoneNumber',
  '홈페이지주소': 'homepageUrl',
  '소재지도로명주소': 'rdnmadr',
  '소재지지번주소': 'lnmadr',
  '위도': 'latitude',
  '경도': 'longitude',
  '데이터기준일자': 'referenceDate',
};

export class CulturePortalClient extends BaseDataGoKrClient {
  protected readonly baseUrl = PERFORMANCE_BASE;

  constructor(config: BaseClientConfig) {
    super({
      ...config,
      usageFilePath: config.usageFilePath ?? 'data/api-usage-culture.json',
      serviceName: '전국공연행사',
    });
  }

  /**
   * 공연/행사 검색
   */
  async searchPerformances(
    opts?: {
      keyword?: string;
      startDate?: string;
      endDate?: string;
      area?: string;
      rows?: number;
      page?: number;
    }
  ): Promise<CulturePerformanceItem[]> {
    const params: Record<string, string> = {
      numOfRows: String(opts?.rows ?? 20),
      pageNo: String(opts?.page ?? 1),
    };
    if (opts?.keyword) params['cond[행사명::LIKE]'] = opts.keyword;
    if (opts?.startDate) params['cond[행사시작일자::GTE]'] = opts.startDate;
    if (opts?.endDate) params['cond[행사종료일자::LTE]'] = opts.endDate;
    if (opts?.area) params['cond[소재지도로명주소::LIKE]'] = opts.area;

    return this.requestStandardData<CulturePerformanceItem>(
      params,
      'search',
      PERFORMANCE_FIELD_MAP
    );
  }

  /**
   * 특정 행사 상세 (이름으로 정확 검색)
   */
  async getPerformanceDetail(
    eventName: string
  ): Promise<CulturePerformanceItem[]> {
    const params: Record<string, string> = {
      numOfRows: '1',
      pageNo: '1',
      'cond[행사명::EQ]': eventName,
    };

    return this.requestStandardData<CulturePerformanceItem>(
      params,
      'detail',
      PERFORMANCE_FIELD_MAP
    );
  }
}
