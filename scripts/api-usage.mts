/**
 * data.go.kr API 사용량 확인 스크립트
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

  const usage = await client.getUsage();
  const remaining = await client.getRemaining();
  const cacheStats = await client.cacheStats();

  console.log('📊 data.go.kr API 사용량');
  console.log('─'.repeat(40));
  console.log(`날짜:     ${usage.date}`);
  console.log(`사용:     ${usage.count} / 1,000건`);
  console.log(`남은:     ${remaining}건`);
  console.log(`마지막:   ${usage.lastRequestAt || '없음'}`);
  console.log(`경고:     ${usage.warned ? '⚠️ 80% 초과' : '정상'}`);
  console.log('');
  console.log('💾 캐시 현황');
  console.log('─'.repeat(40));
  console.log(`파일 수:  ${cacheStats.total}개`);
  console.log(`용량:     ${(cacheStats.sizeBytes / 1024).toFixed(1)}KB`);
}

main().catch(console.error);
