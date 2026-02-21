/**
 * 전국전통시장 API 모듈
 */

import { MarketClient } from './client.js';
import { BaseClientConfig } from '../common/types.js';

let clientInstance: MarketClient | null = null;

export function getMarketClient(configOverride?: Partial<BaseClientConfig>): MarketClient | null {
  const rawKey = process.env.KTO_API_KEY;
  if (!rawKey) return null;

  const serviceKey = rawKey.includes('%') ? decodeURIComponent(rawKey) : rawKey;

  if (!clientInstance) {
    clientInstance = new MarketClient({
      serviceKey,
      ...configOverride,
    });
  }

  return clientInstance;
}

export function resetMarketClient(): void {
  clientInstance = null;
}

export { MarketClient } from './client.js';
export type { MarketItem, MarketData } from './types.js';
