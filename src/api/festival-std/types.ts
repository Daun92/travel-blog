/**
 * 전국문화축제 표준데이터 타입
 */

/** 문화축제 표준 아이템 */
export interface FestivalStdItem {
  /** 축제명 */
  fstvlNm?: string;
  /** 개최 장소 */
  opar?: string;
  /** 축제 시작일 (YYYY-MM-DD) */
  fstvlStartDate?: string;
  /** 축제 종료일 (YYYY-MM-DD) */
  fstvlEndDate?: string;
  /** 축제 내용 */
  fstvlCo?: string;
  /** 주최 기관 */
  mnnstNm?: string;
  /** 주관 기관 */
  auspcInsttNm?: string;
  /** 전화번호 */
  phoneNumber?: string;
  /** 홈페이지 URL */
  homepageUrl?: string;
  /** 소재지 도로명 주소 */
  rdnmadr?: string;
  /** 소재지 지번 주소 */
  lnmadr?: string;
  /** 위도 */
  latitude?: string;
  /** 경도 */
  longitude?: string;
  /** 데이터 기준 일자 */
  referenceDate?: string;
}

/** 수집기에서 사용할 정규화된 축제 데이터 */
export interface FestivalStdData {
  name: string;
  venue: string;
  startDate: string;
  endDate: string;
  description: string;
  organizer: string;
  phone: string;
  address: string;
  homepage: string;
}
