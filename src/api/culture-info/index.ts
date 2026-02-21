/**
 * 한눈에보는문화정보조회서비스 — 싱글턴 팩토리
 * KTO_API_KEY 사용 (data.go.kr 공용)
 */

import { CultureInfoClient } from './client.js';

let clientInstance: CultureInfoClient | null = null;

export function getCultureInfoClient(): CultureInfoClient | null {
  if (clientInstance) return clientInstance;

  const key = process.env.KTO_API_KEY;
  if (!key) return null;

  // Encoded key 자동 디코딩
  const decodedKey = key.includes('%') ? decodeURIComponent(key) : key;

  clientInstance = new CultureInfoClient({ serviceKey: decodedKey });
  return clientInstance;
}

export { CultureInfoClient } from './client.js';
export type { CultureInfoItem, CultureInfoDetailItem } from './types.js';
export { REALM_CODES } from './types.js';
