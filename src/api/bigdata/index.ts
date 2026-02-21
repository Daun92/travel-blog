/**
 * 관광빅데이터 정보서비스 API 모듈
 */

import { BigDataClient } from './client.js';
import { BaseClientConfig } from '../common/types.js';

let clientInstance: BigDataClient | null = null;

/**
 * 관광빅데이터 클라이언트 싱글턴
 * data.go.kr 공용키 사용 (KTO_API_KEY)
 */
export function getBigDataClient(configOverride?: Partial<BaseClientConfig>): BigDataClient | null {
  const rawKey = process.env.KTO_API_KEY;
  if (!rawKey) return null;

  const serviceKey = rawKey.includes('%') ? decodeURIComponent(rawKey) : rawKey;

  if (!clientInstance) {
    clientInstance = new BigDataClient({
      serviceKey,
      ...configOverride,
    });
  }

  return clientInstance;
}

export function resetBigDataClient(): void {
  clientInstance = null;
}

export { BigDataClient } from './client.js';
export type { KeywordTrendItem, VisitorStatsItem, BigDataStats } from './types.js';
