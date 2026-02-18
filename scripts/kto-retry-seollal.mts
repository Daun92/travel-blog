import { config } from 'dotenv';
config();

import { getDataGoKrClient } from '../src/api/data-go-kr/index.js';
import { writeFileSync, existsSync } from 'fs';
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
    console.log(`  ❌ Download failed: ${e.message}`);
    return false;
  }
}

async function main() {
  const client = getDataGoKrClient();

  // ── 1. 고창읍성 검색 ──
  console.log('\n=== 고창읍성 (contentTypeId 12) ===');
  try {
    const r1 = await client.searchKeyword('고창읍성', { contentTypeId: '12', numOfRows: 5 });
    console.log(`  결과: ${r1.length}건`);
    for (const r of r1.slice(0, 3)) {
      const item = r as any;
      console.log(`  → ${item.title} (id: ${item.contentid}) img: ${item.firstimage ? 'YES' : 'NO'}`);
    }
    // Download first with image
    const withImg = r1.filter((r: any) => r.firstimage);
    if (withImg.length > 0) {
      const best = withImg[0] as any;
      console.log(`  📥 Downloading: ${best.title}`);
      await downloadImage(best.firstimage, 'kto-2026-02-14-post-gochang.jpg');
    }
  } catch (e: any) {
    console.log(`  에러: ${e.message}`);
  }

  // ── 2. 예술의전당 계열 검색 ──
  console.log('\n=== 예술의전당 (all types, filter Seoul) ===');
  try {
    const r2 = await client.searchKeyword('예술의전당', { numOfRows: 10 });
    console.log(`  결과: ${r2.length}건`);
    for (const r of r2.slice(0, 5)) {
      const item = r as any;
      console.log(`  → ${item.title} (type: ${item.contenttypeid}, id: ${item.contentid}) addr: ${item.addr1?.substring(0, 20) || 'N/A'} img: ${item.firstimage ? 'YES' : 'NO'}`);
    }
    // Find Seoul one
    const seoul = r2.filter((r: any) => (r.addr1 || '').includes('서울'));
    if (seoul.length > 0) {
      const best = seoul[0] as any;
      console.log(`  📥 서울 매치: ${best.title}`);
      if (best.firstimage) {
        await downloadImage(best.firstimage, 'kto-2026-02-14-post-artscenter.jpg');
      } else {
        console.log(`  이미지 없음 → detailImage 시도`);
        const imgs = await client.detailImage(best.contentid);
        if (imgs.length > 0) {
          const img = imgs[0] as any;
          await downloadImage(img.originimgurl || img.originImgUrl, 'kto-2026-02-14-post-artscenter.jpg');
        } else {
          console.log(`  detailImage도 없음`);
        }
      }
    } else {
      console.log(`  서울 매치 없음`);
    }
  } catch (e: any) {
    console.log(`  에러: ${e.message}`);
  }

  // ── 3. 한가람미술관 (예술의전당 내) ──
  console.log('\n=== 한가람미술관 (14) ===');
  try {
    const r3 = await client.searchKeyword('한가람미술관', { contentTypeId: '14', numOfRows: 5 });
    console.log(`  결과: ${r3.length}건`);
    for (const r of r3.slice(0, 3)) {
      const item = r as any;
      console.log(`  → ${item.title} (id: ${item.contentid}) img: ${item.firstimage ? 'YES' : 'NO'}`);
    }
  } catch (e: any) {
    console.log(`  에러: ${e.message}`);
  }

  // ── 4. 모양성 검색 ──
  console.log('\n=== 모양성 (12) ===');
  try {
    const r4 = await client.searchKeyword('모양성', { contentTypeId: '12', numOfRows: 5 });
    console.log(`  결과: ${r4.length}건`);
    for (const r of r4.slice(0, 3)) {
      const item = r as any;
      console.log(`  → ${item.title} (id: ${item.contentid}) img: ${item.firstimage ? 'YES' : 'NO'}`);
    }
    const withImg = r4.filter((r: any) => r.firstimage);
    if (withImg.length > 0 && !existsSync(join(IMG_DIR, 'kto-2026-02-14-post-gochang.jpg'))) {
      const best = withImg[0] as any;
      console.log(`  📥 Downloading: ${best.title}`);
      await downloadImage(best.firstimage, 'kto-2026-02-14-post-gochang.jpg');
    }
  } catch (e: any) {
    console.log(`  에러: ${e.message}`);
  }
}

main().catch(console.error);
