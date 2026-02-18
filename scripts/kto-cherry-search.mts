/**
 * KTO 벚꽃 테마 키워드 검색 — 시즌별 이미지 확보 가능성 조사
 */
import { config } from 'dotenv';
config();

import { getDataGoKrClient } from '../src/api/data-go-kr/index.js';

const client = getDataGoKrClient();

const queries = [
  { keyword: '석촌호수 벚꽃', ctid: '12' },
  { keyword: '여의도 벚꽃', ctid: '12' },
  { keyword: '불국사 벚꽃', ctid: '12' },
  { keyword: '대릉원 벚꽃', ctid: '12' },
  { keyword: '보문단지 벚꽃', ctid: '12' },
  { keyword: '보문호 벚꽃', ctid: '12' },
  { keyword: '경주 벚꽃', ctid: '12' },
  { keyword: '윤중로 벚꽃', ctid: '12' },
];

async function main() {
  console.log('🌸 KTO 벚꽃 테마 키워드 검색\n');

  for (const q of queries) {
    try {
      const results = await client.searchKeyword(q.keyword, {
        contentTypeId: q.ctid,
        numOfRows: 5,
      });
      const withImg = results.filter((r: any) => r.firstimage);
      console.log(`🔍 "${q.keyword}": ${results.length}건 (이미지 ${withImg.length}건)`);
      for (const r of results.slice(0, 3)) {
        const item = r as any;
        console.log(`   → ${item.title} (id:${item.contentid}) img:${!!item.firstimage}`);
        if (item.firstimage) {
          console.log(`     URL: ${item.firstimage.substring(0, 80)}...`);
        }
      }
    } catch (e: any) {
      console.log(`❌ "${q.keyword}": ${e.message}`);
    }
  }

  // 기존 이미지의 detailImage도 확인
  console.log('\n\n📷 기존 contentId detailImage 확인');
  const contentIds = [
    { id: '126230', name: '보문관광단지' },
    { id: '126166', name: '불국사' },
    { id: '1492402', name: '대릉원' },
    { id: '754052', name: '석촌호수' },
    { id: '127955', name: '여의도공원' },
  ];

  for (const c of contentIds) {
    try {
      const images = await client.detailImage(c.id);
      console.log(`\n📸 ${c.name} (${c.id}): ${images.length}장`);
      for (const img of images.slice(0, 5)) {
        const item = img as any;
        const url = item.originimgurl || item.originImgUrl || '';
        console.log(`   ${url.substring(0, 80)}...`);
      }
    } catch (e: any) {
      console.log(`❌ ${c.name}: ${e.message}`);
    }
  }
}

main().catch(console.error);
