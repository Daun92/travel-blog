/**
 * api.kcisa.kr (문화공공데이터광장) 공통 타입
 * CULTURE_API_KEY 사용
 */

// ============================================================================
// 공통 메타데이터 필드 (rest/meta/* 엔드포인트 공용)
// ============================================================================

/** 표준 메타데이터 아이템 (축제, 공연 등 공용) */
export interface KcisaMetaItem {
  title?: string;
  alternativeTitle?: string;
  creator?: string;
  regDate?: string;
  collectionDb?: string;
  subjectCategory?: string;
  subjectKeyword?: string;
  extent?: string;
  description?: string;
  spatial?: string;
  spatialCoverage?: string;
  temporalCoverage?: string;
  person?: string;
  language?: string;
  sourceTitle?: string;
  referenceIdentifier?: string;
  rights?: string;
  copyrightOthers?: string;
  url?: string;
  uci?: string;
  contributor?: string;
}

// ============================================================================
// #2 예술의전당 종합 공연정보 (API_CCA_148)
// ============================================================================

/** 예술의전당 종합 공연정보 아이템 */
export interface SacPerformanceItem {
  title?: string;
  /** 주최기관 */
  hostInstitution?: string;
  /** 수집일 */
  collectionDate?: string;
  /** 발행일 */
  issueDate?: string;
  description?: string;
  /** 이미지 URL */
  imageUrl?: string;
  /** 공연 ID */
  performanceId?: string;
  /** 웹사이트 */
  url?: string;
  /** 조회수 */
  viewCount?: string;
  /** 좌석정보 */
  seatingInfo?: string;
  /** 티켓정보 */
  ticketInfo?: string;
  /** 장소 */
  venue?: string;
  /** 장르 */
  genre?: string;
  /** 공연시간 */
  duration?: string;
  /** 전시수 */
  exhibitionCount?: string;
  /** 관람안내 */
  guidelines?: string;
  /** 작가/출연 */
  creator?: string;
  /** 연락처 */
  contact?: string;
  /** 출연/스태프 */
  castCrew?: string;
  /** 주최 */
  organizer?: string;
  /** 관람등급 */
  ageRating?: string;
  /** 요금/할인 */
  charge?: string;
  /** 기간 */
  period?: string;
  /** 시간 */
  time?: string;
}

// ============================================================================
// #5 방방곡곡 트래킹 (convergence2017/conver2)
// ============================================================================

/** 트래킹 안내 아이템 */
export interface TrackingItem {
  rnum?: string;
  title?: string;
  description?: string;
  abstractDesc?: string;
  affiliation?: string;
  charge?: string;
  format?: string;
  venue?: string;
  spatial?: string;
  temporal?: string;
  identifier?: string;
  url?: string;
  localarea?: string;
}

// ============================================================================
// #7 공공미술 작품 (convergence2018/conver9)
// ============================================================================

/** 공공미술 작품 아이템 */
export interface PublicArtItem {
  /** 주소 */
  address?: string;
  /** 작품명 */
  artworkName?: string;
  /** 시도 */
  sido?: string;
  /** 군구 */
  gungu?: string;
  /** 장소 */
  venue?: string;
  /** 수집일 */
  collectionDate?: string;
  /** 분류 (시각/공연) */
  subjectCategory?: string;
  /** 등록일 */
  regDate?: string;
  /** 제공기관코드 */
  providerCode?: string;
  /** 제공기관명 */
  providerName?: string;
}
