/**
 * 국가유산청 문화재 검색 클라이언트
 *
 * khs.go.kr OpenAPI — 인증 키 불필요 (공개 API)
 * 응답: XML (CDATA 래핑)
 *
 * 엔드포인트:
 * - SearchKindOpenapiList.do: 목록 검색
 * - SearchKindOpenapiDt.do: 상세 조회
 */

import { XMLParser } from 'fast-xml-parser';
import { HeritageItem } from './types.js';

const HERITAGE_BASE = 'http://www.khs.go.kr/cha';

const parser = new XMLParser({
  ignoreAttributes: false,
  processEntities: true,
  trimValues: true,
});

export class HeritageClient {
  /**
   * 문화재 검색
   * @param keyword 문화재명 (ccbaMnm1 LIKE 검색)
   */
  async searchHeritage(
    keyword: string,
    opts?: { numOfRows?: number; pageNo?: number; kdcd?: string }
  ): Promise<HeritageItem[]> {
    const params = new URLSearchParams({
      ccbaMnm1: keyword,
      pageUnit: String(opts?.numOfRows ?? 10),
      pageIndex: String(opts?.pageNo ?? 1),
    });

    if (opts?.kdcd) params.set('ccbaKdcd', opts.kdcd);

    const url = `${HERITAGE_BASE}/SearchKindOpenapiList.do?${params.toString()}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const xml = await response.text();
      const parsed = parser.parse(xml);

      const result = parsed?.result;
      if (!result) return [];

      const items = result.item;
      if (!items) return [];

      const rawArr: Record<string, unknown>[] = Array.isArray(items) ? items : [items];
      return rawArr.map((item): HeritageItem => ({
        ccbaMnm1: String(item.ccbaMnm1 ?? ''),
        ccbaKdcd: String(item.ccbaKdcd ?? ''),
        ccbaKdnm: String(item.ccmaName ?? ''),   // XML 필드명 ccmaName → ccbaKdnm
        ccbaAsno: String(item.ccbaAsno ?? ''),
        ccbaLcad: `${item.ccbaCtcdNm ?? ''} ${item.ccsiName ?? ''}`.trim(),
        ccbaCtcdNm: String(item.ccbaCtcdNm ?? ''),
        ccsiName: String(item.ccsiName ?? ''),
        latitude: String(item.latitude ?? ''),
        longitude: String(item.longitude ?? ''),
      }));
    } catch (error) {
      console.error(`국가유산청 API 오류:`, error);
      return [];
    }
  }

  /**
   * 문화재 상세 정보
   * @param asno 관리번호 (ccbaAsno)
   * @param opts.kdcd 종목코드 (ccbaKdcd)
   * @param opts.ctcd 시도코드 (ccbaCtcd)
   */
  async getHeritageDetail(
    asno: string,
    opts?: { kdcd?: string; ctcd?: string }
  ): Promise<HeritageItem[]> {
    const params = new URLSearchParams({
      ccbaAsno: asno,
    });

    if (opts?.kdcd) params.set('ccbaKdcd', opts.kdcd);
    if (opts?.ctcd) params.set('ccbaCtcd', opts.ctcd);

    const url = `${HERITAGE_BASE}/SearchKindOpenapiDt.do?${params.toString()}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const xml = await response.text();
      const parsed = parser.parse(xml);

      const result = parsed?.result;
      if (!result) return [];

      const item = result.item;
      if (!item) return [];

      const rawSingle: Record<string, unknown> = Array.isArray(item) ? item[0] : item;
      return [{
        ccbaMnm1: String(rawSingle.ccbaMnm1 ?? ''),
        ccbaKdcd: String(rawSingle.ccbaKdcd ?? ''),
        ccbaKdnm: String(rawSingle.ccmaName ?? ''),
        ccbaAsno: String(rawSingle.ccbaAsno ?? ''),
        ccceName: String(rawSingle.ccceName ?? ''),
        ccbaLcad: String(rawSingle.ccbaLcad ?? ''),
        ccbaCtcdNm: String(rawSingle.ccbaCtcdNm ?? ''),
        ccsiName: String(rawSingle.ccsiName ?? ''),
        content: String(rawSingle.content ?? ''),
        imageUrl: String(rawSingle.imageUrl ?? ''),
        latitude: String(rawSingle.latitude ?? ''),
        longitude: String(rawSingle.longitude ?? ''),
        ccbaAsdt: String(rawSingle.ccbaAsdt ?? ''),
      }];
    } catch (error) {
      console.error(`국가유산청 상세 API 오류:`, error);
      return [];
    }
  }
}
