/**
 * 공공 API 공유 모듈 — barrel export
 */

export { RateLimiter } from './rate-limiter.js';
export { ApiCache, DEFAULT_TTL } from './cache.js';
export { BaseDataGoKrClient } from './base-client.js';
export { BaseXmlClient } from './xml-client.js';
export { BaseKcisaClient } from './kcisa-client.js';

export type {
  DataGoKrResponse,
  ApiUsageData,
  CacheEntry,
  CacheTtlConfig,
  BaseClientConfig,
} from './types.js';

export {
  DataGoKrError,
  QuotaExceededError,
  RESULT_CODES,
} from './types.js';
