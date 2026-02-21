/**
 * KOPIS 공연예술통합전산망 (kopis.or.kr) 타입
 */

/** KOPIS 공연 아이템 */
export interface KopisPerformanceItem {
  /** 공연 ID */
  mt20id?: string;
  /** 공연명 */
  prfnm?: string;
  /** 시작일 (YYYY.MM.DD) */
  prfpdfrom?: string;
  /** 종료일 (YYYY.MM.DD) */
  prfpdto?: string;
  /** 공연시설명 */
  fcltynm?: string;
  /** 포스터 이미지 URL */
  poster?: string;
  /** 장르 */
  genrenm?: string;
  /** 공연 상태 (공연중, 공연예정, 공연완료) */
  prfstate?: string;
  /** 오픈런 여부 */
  openrun?: string;
  /** 지역 */
  area?: string;
  /** 공연 시간 */
  prfruntime?: string;
  /** 관람 연령 */
  prfage?: string;
  /** 제작사 */
  entrpsnm?: string;
  /** 티켓 가격 */
  pcseguidance?: string;
  /** 줄거리 */
  sty?: string;
  /** 출연진 */
  prfcast?: string;
  /** 공연시설 ID */
  mt10id?: string;
}

/** KOPIS 공연시설 아이템 */
export interface KopisVenueItem {
  /** 공연시설 ID */
  mt10id?: string;
  /** 시설명 */
  fcltynm?: string;
  /** 시설 유형 */
  fcltychartr?: string;
  /** 주소 */
  adres?: string;
  /** 전화번호 */
  telno?: string;
  /** 홈페이지 */
  relateurl?: string;
  /** 좌석 수 */
  seatscale?: string;
  /** 위도 */
  la?: string;
  /** 경도 */
  lo?: string;
}
