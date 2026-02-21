/**
 * 전국전통시장 표준데이터 타입
 */

/** 전통시장 아이템 */
export interface MarketItem {
  /** 시장명 */
  mrktNm?: string;
  /** 시장 유형 (상설/5일장/야시장 등) */
  mrktType?: string;
  /** 소재지 도로명 주소 */
  rdnmadr?: string;
  /** 소재지 지번 주소 */
  lnmadr?: string;
  /** 점포 수 */
  storCo?: string;
  /** 취급 품목 */
  prdlst?: string;
  /** 개설 연도 */
  opertDe?: string;
  /** 전화번호 */
  telno?: string;
  /** 주차 시설 여부 */
  parkngPsbltyAt?: string;
  /** 시장 개장일 (5일장의 경우) */
  mrktOpenDe?: string;
  /** 위도 */
  latitude?: string;
  /** 경도 */
  longitude?: string;
  /** 데이터 기준 일자 */
  referenceDate?: string;
}

/** 수집기에서 사용할 정규화된 시장 데이터 */
export interface MarketData {
  name: string;
  type: string;
  address: string;
  storeCount: string;
  products: string;
  phone: string;
  parking: string;
}
