/**
 * 팩트체크 시스템 타입 정의
 */

/**
 * 클레임 심각도 레벨
 * - critical: 장소 존재, 주소 (틀리면 헛걸음)
 * - major: 운영시간, 이벤트 기간 (틀리면 불편)
 * - minor: 가격, 시설 정보 (현장 확인 가능)
 */
export type ClaimSeverity = 'critical' | 'major' | 'minor';

/**
 * 검증 결과 상태
 */
export type VerificationStatus = 'verified' | 'false' | 'unknown';

/**
 * 검증 소스 타입
 */
export type VerificationSource = 'official_api' | 'web_search' | 'cached' | 'unknown';

/**
 * 클레임 타입
 */
export type ClaimType =
  | 'venue_exists'    // 장소 존재 여부
  | 'location'        // 주소/위치
  | 'hours'           // 운영시간
  | 'event_period'    // 전시/이벤트 기간
  | 'price'           // 가격
  | 'facilities'      // 시설 정보
  | 'contact'         // 연락처
  | 'transport'       // 교통/접근성
  | 'general';        // 일반 정보

/**
 * 추출된 클레임
 */
export interface ExtractedClaim {
  id: string;
  type: ClaimType;
  text: string;
  value: string;
  severity: ClaimSeverity;
  context?: string;       // 클레임이 나온 문맥
  lineNumber?: number;    // 소스 라인 번호
}

/**
 * 검증 결과
 */
export interface VerificationResult {
  claimId: string;
  status: VerificationStatus;
  confidence: number;     // 0-100
  source: VerificationSource;
  sourceUrl?: string;
  correctValue?: string;  // 실제 정확한 값 (false인 경우)
  checkedAt: string;
  details?: string;
}

/**
 * 수정 제안
 */
export interface Correction {
  claimId: string;
  originalText: string;
  suggestedText: string;
  reason: string;
  autoApplicable: boolean;  // 자동 수정 가능 여부
}

/**
 * 팩트체크 보고서
 */
export interface FactCheckReport {
  // 기본 정보
  filePath: string;
  title: string;
  checkedAt: string;

  // 점수 (0-100)
  overallScore: number;
  categoryScores: {
    critical: number;     // Critical 항목 점수
    major: number;        // Major 항목 점수
    minor: number;        // Minor 항목 점수
  };

  // 클레임 통계
  claims: {
    total: number;
    verified: number;
    false: number;
    unknown: number;
  };

  // 심각도별 통계
  bySeverity: {
    critical: { total: number; verified: number; false: number; unknown: number };
    major: { total: number; verified: number; false: number; unknown: number };
    minor: { total: number; verified: number; false: number; unknown: number };
  };

  // 상세 결과
  results: VerificationResult[];
  extractedClaims: ExtractedClaim[];

  // 수정 제안
  corrections: Correction[];

  // 판정
  passesGate: boolean;          // 품질 게이트 통과 여부
  needsHumanReview: boolean;    // 사람 검토 필요 여부
  blockPublish: boolean;        // 발행 차단 여부

  // 메타데이터
  version: string;
}

/**
 * 팩트체크 설정
 */
export interface FactCheckConfig {
  // 점수 기준
  thresholds: {
    critical: number;   // Critical 항목 최소 점수 (기본: 100)
    major: number;      // Major 항목 최소 점수 (기본: 85)
    minor: number;      // Minor 항목 최소 점수 (기본: 70)
    overall: number;    // 전체 최소 점수 (기본: 80)
  };

  // 가중치
  weights: {
    critical: number;   // 기본: 0.3
    major: number;      // 기본: 0.3
    minor: number;      // 기본: 0.4
  };

  // 동작 설정
  blockOnCriticalFailure: boolean;  // Critical 실패 시 즉시 차단
  maxRetries: number;               // API 실패 시 재시도 횟수
  cacheResults: boolean;            // 결과 캐싱 여부
  cacheTtlHours: number;            // 캐시 유효 시간
}

/**
 * Grounding API 응답 타입
 */
export interface GroundingResponse {
  answer: string;
  groundingMetadata?: {
    webSearchQueries?: string[];
    searchEntryPoint?: {
      renderedContent?: string;
    };
    groundingSupports?: Array<{
      segment: {
        startIndex?: number;
        endIndex?: number;
        text?: string;
      };
      groundingChunkIndices?: number[];
      confidenceScores?: number[];
    }>;
    groundingChunks?: Array<{
      web?: {
        uri?: string;
        title?: string;
      };
    }>;
  };
}

/**
 * 공식 API 검증 결과
 */
export interface OfficialApiResult {
  found: boolean;
  data?: Record<string, unknown>;
  source: string;
  checkedAt: string;
}
