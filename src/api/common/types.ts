/**
 * 공공 API 공유 타입 정의
 * data.go.kr, culture.go.kr, kopis.or.kr 등 여러 서비스에서 공통 사용
 */

// ============================================================================
// data.go.kr 표준 응답 래퍼
// ============================================================================

/** data.go.kr 표준 JSON 응답 구조 */
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
// 클라이언트 설정 타입
// ============================================================================

export interface BaseClientConfig {
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
  /** 쿼터 파일 경로 */
  usageFilePath?: string;
  /** 서비스 이름 (경고 메시지용) */
  serviceName?: string;
  /** URL 쿼리 파라미터에서 API 키의 이름 (기본: 'serviceKey') */
  keyParamName?: string;
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
