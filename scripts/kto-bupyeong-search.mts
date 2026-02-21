import { config } from 'dotenv';
config();

import { getDataGoKrClient } from '../src/api/data-go-kr/index.js';

async function main() {
  const client = getDataGoKrClient();
  
  // Search 1: 부평 관광자원
  console.log('=== 부평 관광자원 검색 ===');
  try {
    const items = await client.searchKeyword('부평', { numOfRows: 20 });
    if (items.length > 0) {
      for (const item of items) {
        console.log(`[${item.contenttypeid}] ${item.title} | ${item.addr1 || ''} | img: ${item.firstimage ? 'YES' : 'NO'} | contentId: ${item.contentid}`);
      }
    } else {
      console.log('No results');
    }
  } catch (e: any) { console.error('Tourism search error:', e.message); }

  // Search 2: 부평역사박물관
  console.log('\n=== 부평역사박물관 검색 ===');
  try {
    const items = await client.searchKeyword('부평역사박물관', { numOfRows: 5 });
    if (items.length > 0) {
      for (const item of items) {
        console.log(`${item.title} | contentId: ${item.contentid} | img: ${item.firstimage || 'NONE'}`);
      }
    } else {
      console.log('No results');
    }
  } catch (e: any) { console.error('Museum search error:', e.message); }

  // Search 3: 부평모두몰/부평지하상가
  console.log('\n=== 부평모두몰 검색 ===');
  try {
    const items = await client.searchKeyword('부평모두몰', { numOfRows: 5 });
    if (items.length > 0) {
      for (const item of items) {
        console.log(`${item.title} | contentId: ${item.contentid} | img: ${item.firstimage || 'NONE'}`);
      }
    } else {
      console.log('No results for 부평모두몰');
    }
    
    // Fallback: 부평지하상가
    const items2 = await client.searchKeyword('부평지하상가', { numOfRows: 5 });
    if (items2.length > 0) {
      for (const item of items2) {
        console.log(`${item.title} | contentId: ${item.contentid} | img: ${item.firstimage || 'NONE'}`);
      }
    } else {
      console.log('No results for 부평지하상가');
    }
  } catch (e: any) { console.error('Mall search error:', e.message); }

  // Search 4: 부평시장
  console.log('\n=== 부평시장 검색 ===');
  try {
    const items = await client.searchKeyword('부평시장', { numOfRows: 5 });
    if (items.length > 0) {
      for (const item of items) {
        console.log(`${item.title} | contentId: ${item.contentid} | img: ${item.firstimage || 'NONE'}`);
      }
    } else {
      console.log('No results');
    }
  } catch (e: any) { console.error('Market search error:', e.message); }

  // Search 5: 조병창
  console.log('\n=== 조병창 검색 ===');
  try {
    const items = await client.searchKeyword('조병창', { numOfRows: 5 });
    if (items.length > 0) {
      for (const item of items) {
        console.log(`${item.title} | contentId: ${item.contentid} | img: ${item.firstimage || 'NONE'}`);
      }
    } else {
      console.log('No results');
    }
  } catch (e: any) { console.error('Arsenal search error:', e.message); }

  // Search 6: 캠프마켓
  console.log('\n=== 캠프마켓 검색 ===');
  try {
    const items = await client.searchKeyword('캠프마켓', { numOfRows: 5 });
    if (items.length > 0) {
      for (const item of items) {
        console.log(`${item.title} | contentId: ${item.contentid} | img: ${item.firstimage || 'NONE'}`);
      }
    } else {
      console.log('No results for 캠프마켓');
    }
  } catch (e: any) { console.error('Camp search error:', e.message); }

  // Search 7: 인천 Tier 2 broader search
  console.log('\n=== 인천 관광지(12) 검색 (Tier 2) ===');
  const contentIds: string[] = [];
  try {
    const items = await client.searchKeyword('부평', { numOfRows: 30, contentTypeId: '12' });
    console.log(`부평 관광지(12) ${items.length}건:`);
    for (const item of items) {
      console.log(`  ${item.title} | ${item.contentid} | img: ${item.firstimage ? 'YES' : 'NO'}`);
      if (item.firstimage) contentIds.push(item.contentid);
    }
  } catch (e: any) { console.error('Area search error:', e.message); }

  // Search 8: 부평 문화시설(14)
  console.log('\n=== 부평 문화시설(14) 검색 ===');
  try {
    const items = await client.searchKeyword('부평', { numOfRows: 10, contentTypeId: '14' });
    console.log(`부평 문화시설(14) ${items.length}건:`);
    for (const item of items) {
      console.log(`  ${item.title} | ${item.contentid} | img: ${item.firstimage ? 'YES' : 'NO'}`);
      if (item.firstimage) contentIds.push(item.contentid);
    }
  } catch (e: any) { console.error('Culture search error:', e.message); }

  // Search 9: 인천 broader (Tier 2 fallback)
  console.log('\n=== 인천 전체 검색 (Tier 2 fallback) ===');
  try {
    const items = await client.searchKeyword('인천', { numOfRows: 30 });
    console.log(`인천 전체 ${items.length}건:`);
    for (const item of items) {
      console.log(`  [${item.contenttypeid}] ${item.title} | ${item.addr1 || ''} | img: ${item.firstimage ? 'YES' : 'NO'} | ${item.contentid}`);
      if (item.firstimage && !contentIds.includes(item.contentid)) contentIds.push(item.contentid);
    }
  } catch (e: any) { console.error('Incheon search error:', e.message); }

  // Search 10: 부평공원
  console.log('\n=== 부평공원 검색 ===');
  try {
    const items = await client.searchKeyword('부평공원', { numOfRows: 5 });
    if (items.length > 0) {
      for (const item of items) {
        console.log(`${item.title} | contentId: ${item.contentid} | img: ${item.firstimage || 'NONE'}`);
        if (item.firstimage && !contentIds.includes(item.contentid)) contentIds.push(item.contentid);
      }
    } else {
      console.log('No results');
    }
  } catch (e: any) { console.error('Park search error:', e.message); }

  // Search 11: 부평깡통시장
  console.log('\n=== 부평깡통시장 검색 ===');
  try {
    const items = await client.searchKeyword('깡통시장', { numOfRows: 5 });
    if (items.length > 0) {
      for (const item of items) {
        console.log(`${item.title} | contentId: ${item.contentid} | img: ${item.firstimage || 'NONE'}`);
        if (item.firstimage && !contentIds.includes(item.contentid)) contentIds.push(item.contentid);
      }
    } else {
      console.log('No results');
    }
  } catch (e: any) { console.error('Tin market search error:', e.message); }

  // Get detail images for first few contentIds
  if (contentIds.length > 0) {
    console.log(`\n=== DetailImage2 for ${Math.min(contentIds.length, 8)} items ===`);
    for (const cid of contentIds.slice(0, 8)) {
      try {
        const images = await client.detailImage(cid);
        if (images && images.length > 0) {
          console.log(`contentId ${cid}: ${images.length} images`);
          for (const img of images) {
            console.log(`  ${(img as any).originimgurl || (img as any).smallimageurl}`);
          }
        } else {
          console.log(`contentId ${cid}: 0 images`);
        }
      } catch (e: any) { console.error(`DetailImage error for ${cid}:`, e.message); }
    }
  } else {
    console.log('\nNo contentIds with images found for detail image lookup.');
  }
}

main().catch(console.error);
