/**
 * 한눈에보는문화정보조회서비스 (apis.data.go.kr/B553457/cultureinfo)
 * 공연/전시/예술/유산/관광/체육/도서 통합 조회
 */

/** 문화정보 아이템 (period2, area2, realm2 공통) */
export interface CultureInfoItem {
  /** 제목 */
  title?: string;
  /** 장소 */
  place?: string;
  /** 시작일 (YYYYMMDD) */
  startDate?: string;
  /** 종료일 (YYYYMMDD) */
  endDate?: string;
  /** 분야코드 */
  realmCode?: string;
  /** 분야명 */
  realmName?: string;
  /** 지역 (시도) */
  area?: string;
  /** 부제목 */
  subTitle?: string;
  /** 요금 */
  price?: string;
  /** 내용 */
  contents1?: string;
  /** 내용2 */
  contents2?: string;
  /** URL */
  url?: string;
  /** 전화번호 */
  phone?: string;
  /** GPS X (경도) */
  gpsX?: string;
  /** GPS Y (위도) */
  gpsY?: string;
  /** 이미지 URL */
  imgUrl?: string;
  /** 일련번호 */
  seq?: string;
}

/** 문화정보 상세 아이템 (detail2) */
export interface CultureInfoDetailItem extends CultureInfoItem {
  /** 관람시간 */
  placeTime?: string;
  /** 주최 */
  sponsor?: string;
  /** 주관 */
  manager?: string;
}

/** realmCode 매핑 */
export const REALM_CODES: Record<string, string> = {
  A000: '공연',
  B000: '전시',
  C000: '축제-문화행사',
  D000: '교육-체험',
  E000: '기타행사',
};
