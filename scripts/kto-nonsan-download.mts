import { config } from 'dotenv'; config();
import { getDataGoKrClient } from '../src/api/data-go-kr/index.js';
import * as fs from 'fs';
import * as path from 'path';

const IMAGES_DIR = 'blog/static/images';

async function download(url: string, filename: string): Promise<boolean> {
  const outPath = path.join(IMAGES_DIR, filename);
  if (fs.existsSync(outPath)) {
    console.log('  SKIP (exists): ' + filename);
    return true;
  }
  try {
    const res = await fetch(url);
    if (!res.ok) { console.log('  FAIL: ' + url); return false; }
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(outPath, buf);
    console.log('  OK: ' + filename + ' (' + Math.round(buf.length / 1024) + 'KB)');
    return true;
  } catch (e) {
    console.log('  ERROR: ' + url);
    return false;
  }
}

async function main() {
  const client = getDataGoKrClient();

  // 1. 관촉사 상세 이미지 다운로드 (은진미륵 찾기)
  console.log('=== 관촉사 상세 이미지 다운로드 ===');
  const gwImages = await client.detailImage('125905');
  let idx = 0;
  for (const img of gwImages) {
    await download(img.originimgurl, 'kto-nonsan-gwanchuksa-detail-' + idx + '.jpg');
    idx++;
  }

  // 2. 딸기삼촌농장 이미지
  console.log('\n=== 딸기삼촌농장 이미지 ===');
  const strawResults = await client.searchKeyword('논산 딸기', { numOfRows: 5 });
  const straw = strawResults.find((r: any) => r.contentid === '880738' || String(r.contentid) === '880738');
  if (straw?.firstimage) {
    await download(straw.firstimage, 'kto-nonsan-strawberry-farm.jpg');
  }
  const strawDetail = await client.detailImage('880738');
  console.log('딸기삼촌 상세 이미지: ' + strawDetail.length + '개');
  for (const img of strawDetail.slice(0, 3)) {
    await download(img.originimgurl, 'kto-nonsan-strawberry-farm-' + strawDetail.indexOf(img) + '.jpg');
  }

  // 3. 명재고택 이미지
  console.log('\n=== 명재고택 이미지 ===');
  const mjResults = await client.searchKeyword('명재고택', { contentTypeId: '12', numOfRows: 5 });
  const mj = mjResults[0];
  if (mj?.firstimage) {
    await download(mj.firstimage, 'kto-nonsan-myeongjae.jpg');
  }
  const mjDetail = await client.detailImage('231931');
  console.log('명재고택 상세 이미지: ' + mjDetail.length + '개');
  for (const img of mjDetail.slice(0, 3)) {
    await download(img.originimgurl, 'kto-nonsan-myeongjae-' + mjDetail.indexOf(img) + '.jpg');
  }
}

main().catch(console.error);
