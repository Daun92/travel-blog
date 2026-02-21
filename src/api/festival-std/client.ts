/**
 * 전국문화축제 표준데이터 클라이언트
 * 공공데이터포털 표준데이터 API — api.data.go.kr (data.go.kr 공용키 사용)
 *
 * 응답 형식: { data: T[], totalCount, page, perPage }
 * 필드명: 한글 (축제명, 개최장소 등) → fieldMap으로 영문 변환
 */

import { BaseDataGoKrClient } from '../common/base-client.js';
import { BaseClientConfig } from '../common/types.js';
import { FestivalStdItem } from './types.js';

const FESTIVAL_STD_BASE = 'http://api.data.go.kr/openapi/tn_pubr_public_cltur_fstvl_api';

/** 한글 필드명 → FestivalStdItem 영문 필드명 매핑 */
const FESTIVAL_FIELD_MAP: Record<string, string> = {
  '축제명': 'fstvlNm',
  '개최장소': 'opar',
  '축제시작일자': 'fstvlStartDate',
  '축제종료일자': 'fstvlEndDate',
  '축제내용': 'fstvlCo',
  '주최기관명': 'mnnstNm',
  '주관기관명': 'auspcInsttNm',
  '전화번호': 'phoneNumber',
  '홈페이지주소': 'homepageUrl',
  '소재지도로명주소': 'rdnmadr',
  '소재지지번주소': 'lnmadr',
  '위도': 'latitude',
  '경도': 'longitude',
  '데이터기준일자': 'referenceDate',
};

export class FestivalStdClient extends BaseDataGoKrClient {
  protected readonly baseUrl = FESTIVAL_STD_BASE;

  constructor(config: BaseClientConfig) {
    super({
      ...config,
      usageFilePath: config.usageFilePath ?? 'data/api-usage-festival-std.json',
      serviceName: '문화축제',
    });
  }

  /**
   * 문화축제 검색
   * @param opts 검색 옵션
   */
  async searchFestivals(
    opts?: {
      keyword?: string;
      startDate?: string;
      endDate?: string;
      numOfRows?: number;
      pageNo?: number;
    }
  ): Promise<FestivalStdItem[]> {
    const params: Record<string, string> = {
      page: String(opts?.pageNo ?? 1),
      perPage: String(opts?.numOfRows ?? 20),
    };

    if (opts?.keyword) {
      params['cond[축제명::LIKE]'] = opts.keyword;
    }
    if (opts?.startDate) {
      params['cond[축제시작일자::GTE]'] = opts.startDate;
    }
    if (opts?.endDate) {
      params['cond[축제종료일자::LTE]'] = opts.endDate;
    }

    return this.requestStandardData<FestivalStdItem>(params, 'festival', FESTIVAL_FIELD_MAP);
  }

  /**
   * 축제 상세 정보 (축제명 정확 매칭)
   */
  async getFestivalDetail(
    festivalName: string
  ): Promise<FestivalStdItem[]> {
    const params: Record<string, string> = {
      page: '1',
      perPage: '1',
      'cond[축제명::EQ]': festivalName,
    };

    return this.requestStandardData<FestivalStdItem>(params, 'detail', FESTIVAL_FIELD_MAP);
  }
}
