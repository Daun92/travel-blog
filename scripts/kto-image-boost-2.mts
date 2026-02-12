/**
 * KTO Image Boost Round 2 — retry failed searches + verify successful ones
 */
import { config } from 'dotenv';
config();

import { getDataGoKrClient } from '../src/api/data-go-kr/index.js';
import { writeFileSync } from 'fs';
import { join } from 'path';

const IMG_DIR = 'blog/static/images';

async function downloadImage(url: string, filename: string): Promise<boolean> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    writeFileSync(join(IMG_DIR, filename), buffer);
    console.log(`  ✅ ${filename} (${(buffer.length / 1024).toFixed(0)}KB)`);
    return true;
  } catch (e: any) {
    console.log(`  ❌ ${filename}: ${e.message}`);
    return false;
  }
}

async function trySearch(client: any, keyword: string, opts: any = {}): Promise<any[]> {
  try {
    return await client.searchKeyword(keyword, { numOfRows: 5, ...opts });
  } catch {
    return [];
  }
}

async function tryGetImages(client: any, contentId: string): Promise<string[]> {
  const urls: string[] = [];
  try {
    const images = await client.detailImage(contentId);
    for (const img of images) {
      const url = (img as any).originimgurl || (img as any).originImgUrl || (img as any).smallimageurl;
      if (url) urls.push(url);
    }
  } catch {}
  if (urls.length === 0) {
    try {
      const detail = await client.detailCommon(contentId);
      const fi = (detail as any).firstimage || (detail as any).firstimage2;
      if (fi) urls.push(fi);
    } catch {}
  }
  return urls;
}

async function main() {
  const client = getDataGoKrClient();

  // 1. 마곡사 — retry with different search terms
  console.log('\n🔍 마곡사 재시도...');
  for (const kw of ['공주 마곡사', '마곡사 템플스테이', '마곡사']) {
    const results = await trySearch(client, kw, { contentTypeId: '12' });
    for (const r of results) {
      const item = r as any;
      console.log(`  [${kw}] ${item.title} (${item.contentid}) firstimage: ${item.firstimage ? 'YES' : 'NO'}`);
      if (item.firstimage) {
        console.log(`    URL: ${item.firstimage}`);
      }
      // Try detail images
      const imgUrls = await tryGetImages(client, item.contentid);
      if (imgUrls.length > 0) {
        console.log(`    detailImage: ${imgUrls.length}장 발견`);
        for (const url of imgUrls.slice(0, 2)) console.log(`    → ${url}`);
      }
    }
  }

  // 2. 산방산 (관광지, not 유람선)
  console.log('\n🔍 산방산 (관광지) 검색...');
  const sanbangResults = await trySearch(client, '산방산', { contentTypeId: '12' });
  for (const r of sanbangResults) {
    const item = r as any;
    console.log(`  ${item.title} (${item.contentid}) firstimage: ${item.firstimage ? 'YES' : 'NO'}`);
    if (item.firstimage) console.log(`    URL: ${item.firstimage}`);
  }

  // 3. 유달산 — broader search
  console.log('\n🔍 유달산 재시도...');
  for (const kw of ['유달산', '목포 유달산', '목포 노적봉']) {
    const results = await trySearch(client, kw);
    for (const r of results) {
      const item = r as any;
      console.log(`  [${kw}] ${item.title} (${item.contentid}) firstimage: ${item.firstimage ? 'YES' : 'NO'}`);
      if (item.firstimage) console.log(`    URL: ${item.firstimage}`);
    }
  }

  // 4. 목포 근대역사 / 달성사
  console.log('\n🔍 목포 근대역사 / 달성사...');
  for (const kw of ['달성사', '목포 근대역사관', '목포 원도심', '목포 근대건축']) {
    const results = await trySearch(client, kw, { contentTypeId: '12' });
    for (const r of results) {
      const item = r as any;
      console.log(`  [${kw}] ${item.title} (${item.contentid}) firstimage: ${item.firstimage ? 'YES' : 'NO'}`);
      if (item.firstimage) console.log(`    URL: ${item.firstimage}`);
    }
  }

  // 5. 전등사 (for templestay post)
  console.log('\n🔍 전등사...');
  const jeondeungResults = await trySearch(client, '전등사', { contentTypeId: '12' });
  for (const r of jeondeungResults) {
    const item = r as any;
    console.log(`  ${item.title} (${item.contentid}) firstimage: ${item.firstimage ? 'YES' : 'NO'}`);
    if (item.firstimage) console.log(`    URL: ${item.firstimage}`);
    const imgUrls = await tryGetImages(client, item.contentid);
    if (imgUrls.length > 0) {
      console.log(`  detailImage: ${imgUrls.length}장`);
      for (const url of imgUrls.slice(0, 3)) console.log(`    → ${url}`);
    }
  }

  console.log('\n✅ 탐색 완료. API 사용량 확인: npm run api:usage');
}

main().catch(console.error);
