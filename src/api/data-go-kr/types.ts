/**
 * KorService2 (한국관광공사 국문 관광정보 서비스 v2) 전용 타입
 * 공유 타입은 common/types.ts에서 re-export
 */

// 공유 타입 re-export (기존 import 경로 호환)
export type {
  DataGoKrResponse,
  ApiUsageData,
  CacheEntry,
  CacheTtlConfig,
  BaseClientConfig,
} from '../common/types.js';

export {
  DataGoKrError,
  QuotaExceededError,
  RESULT_CODES,
} from '../common/types.js';

// ============================================================================
// KorService2 전용 타입 — DataGoKrClientConfig
// ============================================================================

/** KorService2 클라이언트 설정 (BaseClientConfig 확장) */
export interface DataGoKrClientConfig {
  serviceKey: string;
  /** 일일 쿼터 (기본: 1000) */
  dailyQuota?: number;
  /** 요청 간 최소 딜레이 ms (기본: 200) */
  minDelayMs?: number;
  /** API 실패 시 재시도 횟수 (기본: 2) */
  maxRetries?: number;
  /** 재시도 간 기본 딜레이 ms (기본: 1000) */
  retryDelayMs?: number;
  /** 캐시 활성화 (기본: true) */
  cacheEnabled?: boolean;
  /** 캐시 디렉토리 (기본: data/api-cache) */
  cacheDir?: string;
  /** 쿼터 파일 경로 (기본: data/api-usage.json) */
  usageFilePath?: string;
}

// ============================================================================
// KorService2 아이템 인터페이스
// ============================================================================

/** 관광정보 공통 필드 */
export interface KorServiceBaseItem {
  contentid: string;
  contenttypeid: string;
  title: string;
  addr1: string;
  addr2?: string;
  tel?: string;
  firstimage?: string;
  firstimage2?: string;
  mapx?: string;
  mapy?: string;
  mlevel?: string;
  sigungucode?: string;
  areacode?: string;
  cat1?: string;
  cat2?: string;
  cat3?: string;
  createdtime?: string;
  modifiedtime?: string;
  booktour?: string;
  cpyrhtDivCd?: string;
}

/** searchKeyword2 / areaBasedList2 응답 아이템 */
export interface TourismItem extends KorServiceBaseItem {
  zipcode?: string;
  overview?: string;
}

/** searchFestival2 응답 아이템 */
export interface FestivalItem extends KorServiceBaseItem {
  eventstartdate: string;
  eventenddate: string;
  eventplace?: string;
  sponsor1?: string;
  sponsor1tel?: string;
  sponsor2?: string;
  sponsor2tel?: string;
}

/** detailCommon2 응답 아이템 */
export interface DetailCommonItem {
  contentid: string;
  contenttypeid: string;
  title: string;
  homepage?: string;
  tel?: string;
  telname?: string;
  overview?: string;
  addr1?: string;
  addr2?: string;
  zipcode?: string;
  mapx?: string;
  mapy?: string;
  mlevel?: string;
  firstimage?: string;
  firstimage2?: string;
  cpyrhtDivCd?: string;
  booktour?: string;
  createdtime?: string;
  modifiedtime?: string;
}

/** detailIntro2 응답 아이템 (관광지: contenttypeid=12) */
export interface DetailIntroTouristItem {
  contentid: string;
  contenttypeid: string;
  heritage1?: string;
  heritage2?: string;
  heritage3?: string;
  infocenter?: string;
  opendate?: string;
  restdate?: string;
  expguide?: string;
  expagerange?: string;
  accomcount?: string;
  useseason?: string;
  usetime?: string;
  parking?: string;
  chkbabycarriage?: string;
  chkcreditcard?: string;
  chkpet?: string;
}

/** detailIntro2 응답 아이템 (축제: contenttypeid=15) */
export interface DetailIntroFestivalItem {
  contentid: string;
  contenttypeid: string;
  sponsor1?: string;
  sponsor1tel?: string;
  sponsor2?: string;
  sponsor2tel?: string;
  eventenddate?: string;
  playtime?: string;
  eventplace?: string;
  eventhomepage?: string;
  agelimit?: string;
  bookingplace?: string;
  placeinfo?: string;
  subevent?: string;
  program?: string;
  eventstartdate?: string;
  usetimefestival?: string;
  discountinfofestival?: string;
  spendtimefestival?: string;
  festivalgrade?: string;
}

/** detailImage2 응답 아이템 */
export interface DetailImageItem {
  contentid: string;
  originimgurl: string;
  imgname: string;
  smallimageurl: string;
  cpyrhtDivCd?: string;
  serialnum: string;
}

/** areaCode2 응답 아이템 */
export interface AreaCodeItem {
  rnum: number;
  code: string;
  name: string;
}

// ============================================================================
// contentTypeId 상수
// ============================================================================

export const CONTENT_TYPE = {
  TOURISM: '12',       // 관광지
  CULTURE: '14',       // 문화시설
  FESTIVAL: '15',      // 축제/공연/행사
  COURSE: '25',        // 여행코스
  LEISURE: '28',       // 레포츠
  ACCOMMODATION: '32', // 숙박
  SHOPPING: '38',      // 쇼핑
  RESTAURANT: '39',    // 음식점
} as const;

export type ContentTypeId = typeof CONTENT_TYPE[keyof typeof CONTENT_TYPE];

// ============================================================================
// 지역 코드 상수
// ============================================================================

export const AREA_CODE = {
  SEOUL: '1',
  INCHEON: '2',
  DAEJEON: '3',
  DAEGU: '4',
  GWANGJU: '5',
  BUSAN: '6',
  ULSAN: '7',
  SEJONG: '8',
  GYEONGGI: '31',
  GANGWON: '32',
  CHUNGBUK: '33',
  CHUNGNAM: '34',
  GYEONGBUK: '35',
  GYEONGNAM: '36',
  JEONBUK: '37',
  JEONNAM: '38',
  JEJU: '39',
} as const;
