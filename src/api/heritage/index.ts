/**
 * 국가유산청 문화재 API 모듈
 *
 * khs.go.kr OpenAPI — 인증 키 불필요 (공개 API)
 * HERITAGE_API_KEY 환경변수 유무와 관계없이 항상 사용 가능
 */

import { HeritageClient } from './client.js';

let clientInstance: HeritageClient | null = null;

export function getHeritageClient(): HeritageClient {
  if (!clientInstance) {
    clientInstance = new HeritageClient();
  }
  return clientInstance;
}

export function resetHeritageClient(): void {
  clientInstance = null;
}

export { HeritageClient } from './client.js';
export type { HeritageItem, HeritageData } from './types.js';
