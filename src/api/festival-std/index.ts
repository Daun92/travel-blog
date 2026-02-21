/**
 * 전국문화축제 표준데이터 API 모듈
 */

import { FestivalStdClient } from './client.js';
import { BaseClientConfig } from '../common/types.js';

let clientInstance: FestivalStdClient | null = null;

export function getFestivalStdClient(configOverride?: Partial<BaseClientConfig>): FestivalStdClient | null {
  const rawKey = process.env.KTO_API_KEY;
  if (!rawKey) return null;

  const serviceKey = rawKey.includes('%') ? decodeURIComponent(rawKey) : rawKey;

  if (!clientInstance) {
    clientInstance = new FestivalStdClient({
      serviceKey,
      ...configOverride,
    });
  }

  return clientInstance;
}

export function resetFestivalStdClient(): void {
  clientInstance = null;
}

export { FestivalStdClient } from './client.js';
export type { FestivalStdItem, FestivalStdData } from './types.js';
