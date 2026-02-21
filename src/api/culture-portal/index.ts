/**
 * 전국공연행사정보 표준데이터 모듈
 *
 * 이전: CULTURE_API_KEY (culture.go.kr, 폐지됨)
 * 현재: KTO_API_KEY (data.go.kr 공용 키)
 */

import { CulturePortalClient } from './client.js';
import { BaseClientConfig } from '../common/types.js';

let clientInstance: CulturePortalClient | null = null;

/**
 * 공연행사 클라이언트 싱글턴
 * KTO_API_KEY 사용 (data.go.kr 공용 — 서비스 활용 신청 필요)
 */
export function getCulturePortalClient(configOverride?: Partial<BaseClientConfig>): CulturePortalClient | null {
  const rawKey = process.env.KTO_API_KEY;
  if (!rawKey) return null;

  const serviceKey = rawKey.includes('%') ? decodeURIComponent(rawKey) : rawKey;

  if (!clientInstance) {
    clientInstance = new CulturePortalClient({
      serviceKey,
      ...configOverride,
    });
  }

  return clientInstance;
}

export function resetCulturePortalClient(): void {
  clientInstance = null;
}

export { CulturePortalClient } from './client.js';
export type { CulturePerformanceItem, PerformanceData } from './types.js';
