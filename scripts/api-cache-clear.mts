/**
 * data.go.kr API 캐시 삭제 스크립트
 */
import { config } from 'dotenv';
config();

import { getDataGoKrClient } from '../src/api/data-go-kr/index.js';

async function main() {
  const client = getDataGoKrClient();
  if (!client) {
    console.log('⚠️  KTO_API_KEY가 설정되지 않았습니다.');
    process.exit(0);
  }

  const before = await client.cacheStats();
  const cleaned = await client.clearCache();

  console.log(`🧹 캐시 삭제 완료: ${cleaned}개 파일 (${(before.sizeBytes / 1024).toFixed(1)}KB)`);
}

main().catch(console.error);
