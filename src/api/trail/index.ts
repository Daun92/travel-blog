/**
 * 산림청 둘레길 API 모듈
 */

import { TrailClient } from './client.js';
import { BaseClientConfig } from '../common/types.js';

let clientInstance: TrailClient | null = null;

export function getTrailClient(configOverride?: Partial<BaseClientConfig>): TrailClient | null {
  const rawKey = process.env.KTO_API_KEY;
  if (!rawKey) return null;

  const serviceKey = rawKey.includes('%') ? decodeURIComponent(rawKey) : rawKey;

  if (!clientInstance) {
    clientInstance = new TrailClient({
      serviceKey,
      ...configOverride,
    });
  }

  return clientInstance;
}

export function resetTrailClient(): void {
  clientInstance = null;
}

export { TrailClient } from './client.js';
export type { TrailItem, TrailData } from './types.js';
