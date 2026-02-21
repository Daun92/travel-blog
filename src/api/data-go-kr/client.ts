/**
 * KorService2 (한국관광공사 국문 관광정보 서비스 v2) 클라이언트
 * BaseDataGoKrClient를 상속하여 KorService2 전용 엔드포인트 구현
 *
 * CRITICAL: ServiceKey를 URLSearchParams에 넣지 않음 → 이중 인코딩 방지
 */

import { BaseDataGoKrClient } from '../common/base-client.js';
import {
  DataGoKrClientConfig,
  TourismItem,
  FestivalItem,
  DetailCommonItem,
  DetailImageItem,
  AreaCodeItem,
} from './types.js';

const KOR_SERVICE2_BASE = 'http://apis.data.go.kr/B551011/KorService2';

export class DataGoKrClient extends BaseDataGoKrClient {
  protected readonly baseUrl = KOR_SERVICE2_BASE;

  constructor(config: DataGoKrClientConfig) {
    super({
      ...config,
      usageFilePath: config.usageFilePath ?? 'data/api-usage.json',
      serviceName: 'KorService2',
    });
  }

  // ============================================================================
  // 공개 API 메서드
  // ============================================================================

  /** 키워드 검색 (searchKeyword2) */
  async searchKeyword(
    keyword: string,
    opts?: { contentTypeId?: string; areaCode?: string; numOfRows?: number; pageNo?: number }
  ): Promise<TourismItem[]> {
    const params: Record<string, string> = {
      keyword,
      numOfRows: String(opts?.numOfRows ?? 20),
      pageNo: String(opts?.pageNo ?? 1),
    };
    if (opts?.contentTypeId) params.contentTypeId = opts.contentTypeId;
    if (opts?.areaCode) params.areaCode = opts.areaCode;

    return this.request<TourismItem>('/searchKeyword2', params, 'search');
  }

  /** 축제/행사 검색 (searchFestival2) */
  async searchFestival(
    opts?: {
      eventStartDate?: string;
      eventEndDate?: string;
      areaCode?: string;
      numOfRows?: number;
      pageNo?: number;
    }
  ): Promise<FestivalItem[]> {
    const params: Record<string, string> = {
      numOfRows: String(opts?.numOfRows ?? 20),
      pageNo: String(opts?.pageNo ?? 1),
    };
    if (opts?.eventStartDate) params.eventStartDate = opts.eventStartDate;
    if (opts?.eventEndDate) params.eventEndDate = opts.eventEndDate;
    if (opts?.areaCode) params.areaCode = opts.areaCode;

    return this.request<FestivalItem>('/searchFestival2', params, 'festival');
  }

  /** 지역기반 관광정보 (areaBasedList2) */
  async areaBasedList(
    opts?: {
      contentTypeId?: string;
      areaCode?: string;
      sigunguCode?: string;
      numOfRows?: number;
      pageNo?: number;
      arrange?: string;
    }
  ): Promise<TourismItem[]> {
    const params: Record<string, string> = {
      numOfRows: String(opts?.numOfRows ?? 20),
      pageNo: String(opts?.pageNo ?? 1),
    };
    if (opts?.contentTypeId) params.contentTypeId = opts.contentTypeId;
    if (opts?.areaCode) params.areaCode = opts.areaCode;
    if (opts?.sigunguCode) params.sigunguCode = opts.sigunguCode;
    if (opts?.arrange) params.arrange = opts.arrange;

    return this.request<TourismItem>('/areaBasedList2', params, 'search');
  }

  /** 위치기반 관광정보 (locationBasedList2) */
  async locationBasedList(
    mapX: number,
    mapY: number,
    radius: number = 2000,
    opts?: { contentTypeId?: string; numOfRows?: number; pageNo?: number }
  ): Promise<TourismItem[]> {
    const params: Record<string, string> = {
      mapX: String(mapX),
      mapY: String(mapY),
      radius: String(radius),
      numOfRows: String(opts?.numOfRows ?? 20),
      pageNo: String(opts?.pageNo ?? 1),
    };
    if (opts?.contentTypeId) params.contentTypeId = opts.contentTypeId;

    return this.request<TourismItem>('/locationBasedList2', params, 'search');
  }

  /** 공통 상세정보 (detailCommon2) */
  async detailCommon(
    contentId: string,
    opts?: { numOfRows?: number }
  ): Promise<DetailCommonItem[]> {
    const params: Record<string, string> = {
      contentId,
    };
    if (opts?.numOfRows) params.numOfRows = String(opts.numOfRows);

    return this.request<DetailCommonItem>('/detailCommon2', params, 'detail');
  }

  /** 이미지 목록 (detailImage2) */
  async detailImage(
    contentId: string,
    opts?: { numOfRows?: number }
  ): Promise<DetailImageItem[]> {
    const params: Record<string, string> = {
      contentId,
    };
    if (opts?.numOfRows) params.numOfRows = String(opts.numOfRows);

    return this.request<DetailImageItem>('/detailImage2', params, 'detail');
  }

  /** 지역 코드 조회 (areaCode2) */
  async areaCode(areaCode?: string): Promise<AreaCodeItem[]> {
    const params: Record<string, string> = {
      numOfRows: '50',
    };
    if (areaCode) params.areaCode = areaCode;

    return this.request<AreaCodeItem>('/areaCode2', params, 'code');
  }
}
