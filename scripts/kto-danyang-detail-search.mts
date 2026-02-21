/**
 * 단양 관광특구 + 바람개비마을 — KTO detailImage2 심층 탐색
 * 서사에 맞는 대안 이미지 후보 확인
 */
import { config } from 'dotenv'; config();
import { getDataGoKrClient } from '../src/api/data-go-kr/index.js';

async function main() {
  const client = getDataGoKrClient();

  // 1. 관광특구 (contentId: 1957364) — 시장/먹거리 거리 사진 있는지
  console.log('=== 단양 관광특구 (1957364) detailImage ===');
  const tourist = await client.detailImage(1957364);
  console.log(`상세 이미지 ${tourist.length}개`);
  for (const img of tourist) {
    console.log(`  ${img.originimgurl}`);
    if (img.imgname) console.log(`    이름: ${img.imgname}`);
  }

  // 2. 바람개비마을 (contentId: 1920031) — 바람개비/마을 풍경 있는지
  console.log('\n=== 감골 바람개비마을 (1920031) detailImage ===');
  const village = await client.detailImage(1920031);
  console.log(`상세 이미지 ${village.length}개`);
  for (const img of village) {
    console.log(`  ${img.originimgurl}`);
    if (img.imgname) console.log(`    이름: ${img.imgname}`);
  }

  // 3. "단양 시장" 키워드 검색 — 시장 관련 콘텐츠
  console.log('\n=== "단양 시장" 키워드 검색 ===');
  const market = await client.searchKeyword('단양 시장', { numOfRows: 5 });
  for (const r of market) {
    const img = r.firstimage ? 'Y' : 'N';
    console.log(`[${img}] ${r.contentid} ${r.title} — ${r.addr1 || 'N/A'}`);
  }

  // 4. "단양 먹거리" 키워드 검색
  console.log('\n=== "단양 먹거리" 키워드 검색 ===');
  const food = await client.searchKeyword('단양 먹거리', { numOfRows: 5 });
  for (const r of food) {
    const img = r.firstimage ? 'Y' : 'N';
    console.log(`[${img}] ${r.contentid} ${r.title} — ${r.addr1 || 'N/A'}`);
  }

  // 5. 단양 관광특구 firstimage 확인 (다른 시점)
  console.log('\n=== 관광특구 detailCommon ===');
  const detail = await client.detailCommon(1957364);
  if (detail) {
    console.log(`firstimage: ${detail.firstimage || '없음'}`);
    console.log(`firstimage2: ${detail.firstimage2 || '없음'}`);
  }

  // 6. 바람개비마을 firstimage 확인
  console.log('\n=== 바람개비마을 detailCommon ===');
  const vDetail = await client.detailCommon(1920031);
  if (vDetail) {
    console.log(`firstimage: ${vDetail.firstimage || '없음'}`);
    console.log(`firstimage2: ${vDetail.firstimage2 || '없음'}`);
  }

  console.log('\n=== API 호출 완료 ===');
}

main().catch(e => { console.error(e); process.exit(1); });
