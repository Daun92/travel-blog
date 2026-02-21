/**
 * KOPIS 공연예술통합전산망 API 모듈
 */

import { KopisClient } from './client.js';
import { BaseClientConfig } from '../common/types.js';

let clientInstance: KopisClient | null = null;

/**
 * KOPIS 클라이언트 싱글턴
 * KOPIS_API_KEY 사용 (별도 키 — kopis.or.kr 발급)
 */
export function getKopisClient(configOverride?: Partial<BaseClientConfig>): KopisClient | null {
  const rawKey = process.env.KOPIS_API_KEY;
  if (!rawKey) return null;

  const serviceKey = rawKey.includes('%') ? decodeURIComponent(rawKey) : rawKey;

  if (!clientInstance) {
    clientInstance = new KopisClient({
      serviceKey,
      ...configOverride,
    });
  }

  return clientInstance;
}

export function resetKopisClient(): void {
  clientInstance = null;
}

export { KopisClient } from './client.js';
export type { KopisPerformanceItem, KopisVenueItem } from './types.js';
