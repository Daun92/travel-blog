/**
 * 한눈에보는문화정보조회서비스 클라이언트
 * apis.data.go.kr/B553457/cultureinfo — data.go.kr 공용키(KTO_API_KEY) 사용
 * 응답: XML only (_type=json 미지원 → BaseXmlClient 사용)
 *
 * 엔드포인트:
 *  - /period2  기간별 조회
 *  - /area2    지역별 조회
 *  - /detail2  상세 조회
 *  - /realm2   분야별 조회
 */

import { BaseXmlClient } from '../common/xml-client.js';
import { BaseClientConfig } from '../common/types.js';
import { CultureInfoItem, CultureInfoDetailItem } from './types.js';

const CULTURE_INFO_BASE = 'https://apis.data.go.kr/B553457/cultureinfo';

export class CultureInfoClient extends BaseXmlClient {
  protected readonly baseUrl = CULTURE_INFO_BASE;

  constructor(config: BaseClientConfig) {
    super({
      ...config,
      usageFilePath: config.usageFilePath ?? 'data/api-usage-culture-info.json',
      serviceName: '문화정보',
    });
  }

  /** XML → 아이템 배열 추출 (data.go.kr 공통 구조) */
  private extractItems<T>(parsed: Record<string, unknown>): T[] {
    const response = parsed as {
      response?: {
        header?: { resultCode?: string; resultMsg?: string };
        body?: {
          items?: { item?: T | T[] } | '';
          totalCount?: number;
        };
      };
    };

    const code = response?.response?.header?.resultCode;
    if (code && code !== '00') {
      const msg = response?.response?.header?.resultMsg ?? 'Unknown';
      throw new Error(`CultureInfo API 오류 (${code}): ${msg}`);
    }

    const rawItems = response?.response?.body?.items as unknown;
    if (!rawItems || rawItems === '' || typeof rawItems !== 'object') return [];

    const item = (rawItems as { item?: T | T[] }).item;
    if (!item) return [];
    return Array.isArray(item) ? item : [item];
  }

  /** 기간별 문화정보 조회 */
  async searchByPeriod(
    opts?: {
      from?: string;
      to?: string;
      keyword?: string;
      sido?: string;
      realmCode?: string;
      rows?: number;
      pageNo?: number;
    }
  ): Promise<CultureInfoItem[]> {
    const params = this.buildParams(opts);
    return this.requestXml<CultureInfoItem>(
      '/period2', params, 'search',
      (parsed) => this.extractItems<CultureInfoItem>(parsed)
    );
  }

  /** 지역별 문화정보 조회 */
  async searchByArea(
    opts?: {
      sido?: string;
      keyword?: string;
      from?: string;
      to?: string;
      realmCode?: string;
      rows?: number;
      pageNo?: number;
    }
  ): Promise<CultureInfoItem[]> {
    const params = this.buildParams(opts);
    return this.requestXml<CultureInfoItem>(
      '/area2', params, 'search',
      (parsed) => this.extractItems<CultureInfoItem>(parsed)
    );
  }

  /** 분야별 문화정보 조회 */
  async searchByRealm(
    realmCode: string,
    opts?: {
      keyword?: string;
      sido?: string;
      from?: string;
      to?: string;
      rows?: number;
      pageNo?: number;
    }
  ): Promise<CultureInfoItem[]> {
    const params = this.buildParams({ ...opts, realmCode });
    return this.requestXml<CultureInfoItem>(
      '/realm2', params, 'search',
      (parsed) => this.extractItems<CultureInfoItem>(parsed)
    );
  }

  /** 상세 조회 */
  async getDetail(seq: string): Promise<CultureInfoDetailItem[]> {
    const params: Record<string, string> = {
      seq,
      numOfRows: '1',
      pageNo: '1',
    };
    return this.requestXml<CultureInfoDetailItem>(
      '/detail2', params, 'detail',
      (parsed) => this.extractItems<CultureInfoDetailItem>(parsed)
    );
  }

  /** 공통 파라미터 빌드 */
  private buildParams(
    opts?: {
      from?: string;
      to?: string;
      keyword?: string;
      sido?: string;
      realmCode?: string;
      rows?: number;
      pageNo?: number;
    }
  ): Record<string, string> {
    const params: Record<string, string> = {
      numOfrows: String(opts?.rows ?? 20),
      pageNo: String(opts?.pageNo ?? 1),
    };
    if (opts?.from) params.from = opts.from;
    if (opts?.to) params.to = opts.to;
    if (opts?.keyword) params.keyword = opts.keyword;
    if (opts?.sido) params.sido = opts.sido;
    if (opts?.realmCode) params.realmCode = opts.realmCode;
    return params;
  }
}
