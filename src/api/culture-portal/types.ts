/**
 * 전국공연행사정보 표준데이터 (data.go.kr) 타입
 * 이전: culture.go.kr XML API (폐지됨)
 * 현재: api.data.go.kr 표준데이터 JSON API
 */

/** 공연행사 표준데이터 raw 응답 아이템 (한글 필드명 → 영문 매핑 후) */
export interface CulturePerformanceItem {
  /** 행사명 */
  eventNm?: string;
  /** 개최장소 */
  opar?: string;
  /** 행사내용 */
  eventCo?: string;
  /** 행사시작일자 (YYYY-MM-DD) */
  eventStartDate?: string;
  /** 행사종료일자 (YYYY-MM-DD) */
  eventEndDate?: string;
  /** 행사시작시각 */
  eventStartTime?: string;
  /** 행사종료시각 */
  eventEndTime?: string;
  /** 관람요금 */
  admfee?: string;
  /** 주관기관명 */
  auspcInsttNm?: string;
  /** 주최기관명 */
  mnnstNm?: string;
  /** 전화번호 */
  phoneNumber?: string;
  /** 홈페이지주소 */
  homepageUrl?: string;
  /** 소재지도로명주소 */
  rdnmadr?: string;
  /** 소재지지번주소 */
  lnmadr?: string;
  /** 위도 */
  latitude?: string;
  /** 경도 */
  longitude?: string;
  /** 데이터기준일자 */
  referenceDate?: string;
}

/** 수집기에서 사용할 정규화된 공연 데이터 */
export interface PerformanceData {
  title: string;
  startDate: string;
  endDate: string;
  venue: string;
  category: string;
  area: string;
  price: string;
  thumbnail: string;
  url: string;
  source: 'culture-portal' | 'kopis';
}
