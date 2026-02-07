/**
 * data.go.kr API 모듈 공개 인터페이스
 * 싱글턴 클라이언트 팩토리 + 타입 재-export
 */

import { DataGoKrClient } from './client.js';
import { DataGoKrClientConfig } from './types.js';

// 싱글턴 인스턴스
let clientInstance: DataGoKrClient | null = null;

/**
 * data.go.kr API 클라이언트 싱글턴
 * collector, grounding-client 등 모듈 간 공유하여 레이트리밋/쿼터 통합 관리
 *
 * @returns DataGoKrClient 인스턴스 (KTO_API_KEY 없으면 null)
 */
export function getDataGoKrClient(configOverride?: Partial<DataGoKrClientConfig>): DataGoKrClient | null {
  const rawKey = process.env.KTO_API_KEY;
  if (!rawKey) return null;

  // data.go.kr 포털에서 "Encoding" 키를 복사한 경우 %가 포함됨
  // URL에 직접 삽입하므로 디코딩된(원본) 키를 사용해야 이중 인코딩 방지
  const serviceKey = rawKey.includes('%') ? decodeURIComponent(rawKey) : rawKey;

  if (!clientInstance) {
    clientInstance = new DataGoKrClient({
      serviceKey,
      ...configOverride,
    });
  }

  return clientInstance;
}

/**
 * 싱글턴 리셋 (테스트용)
 */
export function resetClient(): void {
  clientInstance = null;
}

// 타입 재-export
export { DataGoKrClient } from './client.js';
export type {
  DataGoKrClientConfig,
  DataGoKrResponse,
  TourismItem,
  FestivalItem,
  DetailCommonItem,
  DetailImageItem,
  AreaCodeItem,
  ApiUsageData,
  CacheTtlConfig,
} from './types.js';
export {
  CONTENT_TYPE,
  AREA_CODE,
  DataGoKrError,
  QuotaExceededError,
} from './types.js';
export { RateLimiter } from './rate-limiter.js';
export { ApiCache } from './cache.js';
