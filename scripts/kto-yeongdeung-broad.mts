import { config } from 'dotenv'; config();
import { getDataGoKrClient } from '../src/api/data-go-kr/index.js';

async function main() {
  const client = getDataGoKrClient();
  if (!client) { console.error('No client'); return; }

  // 1. 키워드 검색 (전체 타입)
  const keywords = ['칠머리당', '영등굿', '영등제', '제주 영등'];
  for (const kw of keywords) {
    console.log(`\n--- "${kw}" (all types) ---`);
    try {
      const items = await client.searchKeyword(kw, { numOfRows: 5 });
      if (items.length === 0) { console.log('  결과 없음'); continue; }
      for (const item of items) {
        console.log(`  ${item.title} | ${item.addr1 || ''} | type:${item.contenttypeid} | id:${item.contentid} | img:${item.firstimage ? 'Y' : 'N'}`);
      }
    } catch (e) { console.log(`  에러: ${(e as Error).message}`); }
  }

  // 2. 기존 contentId 130853 상세 조회
  console.log('\n--- contentId 130853 detailCommon ---');
  try {
    const detail = await client.getDetailCommon('130853');
    const d = detail as any;
    console.log(`title: ${d.title}`);
    console.log(`addr: ${d.addr1}`);
    console.log(`firstimage: ${d.firstimage}`);
    console.log(`contenttypeid: ${d.contenttypeid}`);
    console.log(`overview: ${(d.overview || '').substring(0, 200)}`);
  } catch (e) { console.log(`에러: ${(e as Error).message}`); }

  console.log('\n--- contentId 130853 detailImage ---');
  try {
    const images = await client.getDetailImages('130853');
    console.log(`${images.length} images`);
    for (const img of images.slice(0, 8)) {
      const i = img as any;
      console.log(`  ${i.originimgurl || i.smallimageurl || 'no url'}`);
    }
  } catch (e) { console.log(`에러: ${(e as Error).message}`); }
}

main().catch(console.error);
