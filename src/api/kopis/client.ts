/**
 * KOPIS 공연예술통합전산망 클라이언트
 * kopis.or.kr — KOPIS_API_KEY 사용 (XML 응답)
 */

import { BaseXmlClient } from '../common/xml-client.js';
import { BaseClientConfig } from '../common/types.js';
import { KopisPerformanceItem, KopisVenueItem } from './types.js';

const KOPIS_BASE = 'http://www.kopis.or.kr/openApi/restful';

export class KopisClient extends BaseXmlClient {
  protected readonly baseUrl = KOPIS_BASE;

  constructor(config: BaseClientConfig) {
    super({
      ...config,
      usageFilePath: config.usageFilePath ?? 'data/api-usage-kopis.json',
      serviceName: 'KOPIS',
      keyParamName: 'service',  // KOPIS는 'service' 파라미터명 사용
    });
  }

  /**
   * 공연 검색
   */
  async searchPerformances(
    opts?: {
      keyword?: string;
      startDate?: string;
      endDate?: string;
      area?: string;
      genre?: string;
      rows?: number;
      page?: number;
    }
  ): Promise<KopisPerformanceItem[]> {
    // stdate, eddate 모두 필수 (미지정 시 오늘 날짜)
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const params: Record<string, string> = {
      stdate: opts?.startDate ?? today,
      eddate: opts?.endDate ?? today,
      rows: String(opts?.rows ?? 20),
      cpage: String(opts?.page ?? 1),
    };
    if (opts?.keyword) params.shprfnm = opts.keyword;
    if (opts?.area) params.signgucode = opts.area;
    if (opts?.genre) params.shcate = opts.genre;

    return this.requestXml<KopisPerformanceItem>(
      '/pblprfr',
      params,
      'search',
      (parsed) => this.extractItems(parsed, 'db')
    );
  }

  /**
   * 공연 상세 정보
   * @param mt20id 공연 ID
   */
  async getPerformanceDetail(
    mt20id: string
  ): Promise<KopisPerformanceItem[]> {
    return this.requestXml<KopisPerformanceItem>(
      `/pblprfr/${mt20id}`,
      {},
      'detail',
      (parsed) => this.extractItems(parsed, 'db')
    );
  }

  /**
   * 공연시설 검색
   */
  async searchVenues(
    opts?: {
      keyword?: string;
      area?: string;
      rows?: number;
      page?: number;
    }
  ): Promise<KopisVenueItem[]> {
    const params: Record<string, string> = {
      rows: String(opts?.rows ?? 20),
      cpage: String(opts?.page ?? 1),
    };
    if (opts?.keyword) params.shprfnmfct = opts.keyword;
    if (opts?.area) params.signgucode = opts.area;

    return this.requestXml<KopisVenueItem>(
      '/prfplc',
      params,
      'search',
      (parsed) => this.extractItems(parsed, 'db')
    );
  }

  /**
   * KOPIS XML 응답에서 아이템 추출
   * KOPIS 구조: <dbs><db>...</db></dbs>
   * 에러 구조: <dbs><db><returncode>2</returncode><errmsg>...</errmsg></db></dbs>
   */
  private extractItems<T>(parsed: Record<string, unknown>, tagName: string): T[] {
    const dbs = parsed['dbs'] as Record<string, unknown> | undefined;
    if (!dbs) return [];

    const items = dbs[tagName];
    if (!items) return [];

    // KOPIS 에러 응답 감지: <db> 안에 returncode가 있으면 에러
    const firstItem = Array.isArray(items) ? items[0] : items;
    if (firstItem && typeof firstItem === 'object') {
      const maybeError = firstItem as Record<string, unknown>;
      const rc = String(maybeError['returncode'] ?? '');
      if (rc && rc !== '0' && rc !== '00') {
        const errMsg = maybeError['errmsg'] ?? 'UNKNOWN';
        throw new Error(`KOPIS API 오류 [${maybeError['returncode']}]: ${errMsg}`);
      }
    }

    if (Array.isArray(items)) return items as T[];
    return [items as T];
  }
}
