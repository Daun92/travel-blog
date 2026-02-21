/**
 * 관광빅데이터 정보서비스 (DataLabService) 타입
 */

/** 키워드 검색 트렌드 아이템 */
export interface KeywordTrendItem {
  /** 검색어 */
  keyword?: string;
  /** 기간 (YYYYMM) */
  baseYm?: string;
  /** 검색량 */
  searchCnt?: string;
  /** 검색 점유율 (%) */
  searchRatio?: string;
}

/** 방문자 통계 아이템 (metcoRegnVisitrDDList / locgoRegnVisitrDDList 공용) */
export interface VisitorStatsItem {
  /** 지역코드 (광역시도) */
  areaCode?: string;
  /** 지역명 (광역시도) */
  areaNm?: string;
  /** 시군구 코드 */
  signguCode?: string;
  /** 시군구명 */
  signguNm?: string;
  /** 기준일자 (YYYYMMDD) */
  baseYmd?: string;
  /** 요일구분코드 */
  daywkDivCd?: string;
  /** 요일명 */
  daywkDivNm?: string;
  /** 관광유형코드 (1=현지인, 2=외지인, 3=외국인) */
  touDivCd?: string;
  /** 관광유형명 */
  touDivNm?: string;
  /** 방문자 수 */
  touNum?: string;
}

/** 수집기에서 사용할 정규화된 빅데이터 */
export interface BigDataStats {
  keywordTrends: KeywordTrendItem[];
  visitorStats: VisitorStatsItem[];
}
