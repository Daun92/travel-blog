/**
 * 산림청 둘레길 정보서비스 (ForestStoryService) 타입
 */

/** 둘레길 아이템 */
export interface TrailItem {
  /** 둘레길 명 */
  frtrlNm?: string;
  /** 코스 번호 */
  crsKorNm?: string;
  /** 코스 설명 */
  crsContents?: string;
  /** 코스 난이도 */
  crsDstnc?: string;
  /** 코스 거리 (km) */
  crsTotlRqrmHour?: string;
  /** 소요 시간 */
  crsLevel?: string;
  /** 시작점 */
  crsSummary?: string;
  /** 종점 */
  travelerinfo?: string;
  /** 소재지 */
  sigun?: string;
  /** 관할 지역 */
  brdDiv?: string;
  /** 위도 */
  latitude?: string;
  /** 경도 */
  longitude?: string;
}

/** 수집기에서 사용할 정규화된 둘레길 데이터 */
export interface TrailData {
  name: string;
  course: string;
  distance: string;
  duration: string;
  difficulty: string;
  description: string;
  location: string;
}
