/**
 * data.go.kr 공공 API 타입 정의
 * KorService2 (한국관광공사 국문 관광정보 서비스 v2) 기준
 */

// ============================================================================
// 공통 응답 래퍼
// ============================================================================

/** data.go.kr 표준 응답 구조 */
export interface DataGoKrResponse<T> {
  response: {
    header: {
      resultCode: string;
      resultMsg: string;
    };
    body: {
      items: {
        item: T[] | T | '';
      } | '';
      numOfRows: number;
      pageNo: number;
      totalCount: number;
    };
  };
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

// ============================================================================
// 클라이언트 설정 타입
// ============================================================================

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

/** 캐시 TTL 설정 (초 단위) */
export interface CacheTtlConfig {
  /** 검색 결과 (기본: 3600 = 1시간) */
  search: number;
  /** 상세 정보 (기본: 21600 = 6시간) */
  detail: number;
  /** 지역/분류 코드 (기본: 2592000 = 30일) */
  code: number;
  /** 축제/행사 (기본: 1800 = 30분) */
  festival: number;
}

// ============================================================================
// 쿼터 추적 타입
// ============================================================================

export interface ApiUsageData {
  /** 날짜 (YYYY-MM-DD, KST) */
  date: string;
  /** 오늘 사용 건수 */
  count: number;
  /** 마지막 요청 시각 ISO */
  lastRequestAt: string;
  /** 경고 발생 여부 */
  warned: boolean;
}

// ============================================================================
// 캐시 엔트리 타입
// ============================================================================

export interface CacheEntry<T = unknown> {
  /** 캐시 생성 시각 ISO */
  cachedAt: string;
  /** 만료 시각 ISO */
  expiresAt: string;
  /** TTL (초) */
  ttl: number;
  /** 캐시된 데이터 */
  data: T;
}

// ============================================================================
// 에러 클래스
// ============================================================================

/** data.go.kr API 오류 기본 클래스 */
export class DataGoKrError extends Error {
  constructor(
    message: string,
    public readonly resultCode: string,
    public readonly resultMsg: string
  ) {
    super(message);
    this.name = 'DataGoKrError';
  }
}

/** 쿼터 초과 오류 */
export class QuotaExceededError extends Error {
  constructor(
    public readonly used: number,
    public readonly quota: number
  ) {
    super(`일일 API 쿼터 초과: ${used}/${quota}건 사용`);
    this.name = 'QuotaExceededError';
  }
}

/** 알려진 resultCode 매핑 */
export const RESULT_CODES: Record<string, string> = {
  '0000': 'OK',
  '0001': 'APPLICATION_ERROR',
  '0002': 'DB_ERROR',
  '0003': 'NODATA_ERROR',
  '0004': 'HTTP_ERROR',
  '0005': 'SERVICETIMEOUT_ERROR',
  '0010': 'INVALID_REQUEST_PARAMETER_ERROR',
  '0011': 'NO_MANDATORY_REQUEST_PARAMETERS_ERROR',
  '0012': 'NO_OPENAPI_SERVICE_ERROR',
  '0020': 'SERVICE_ACCESS_DENIED_ERROR',
  '0021': 'TEMPORARILY_DISABLE_THE_SERVICEKEY_ERROR',
  '0022': 'LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR',
  '0030': 'SERVICE_KEY_IS_NOT_REGISTERED_ERROR',
  '0031': 'DEADLINE_HAS_EXPIRED_ERROR',
  '0032': 'UNREGISTERED_IP_ERROR',
};
