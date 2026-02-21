import { config } from 'dotenv'; config();
import { getDataGoKrClient } from '../src/api/data-go-kr/index.js';
import * as fs from 'fs';

const SLUG = '2026-02-20-danyang-day-trip-course-and-cost';
const IMG_DIR = 'blog/static/images';

async function downloadImage(url: string, filename: string) {
  const res = await fetch(url);
  if (!res.ok) { console.log('  FAIL: ' + res.status + ' ' + url); return false; }
  const buf = Buffer.from(await res.arrayBuffer());
  const path = `${IMG_DIR}/${filename}`;
  fs.writeFileSync(path, buf);
  console.log('  OK: ' + filename + ' (' + Math.round(buf.length / 1024) + 'KB)');
  return true;
}

async function main() {
  const client = getDataGoKrClient();

  // 1. 단양 관광특구 firstimage (contentId: 1957364)
  console.log('=== 단양 관광특구 firstimage ===');
  const tourist = await client.detailCommon(1957364);
  if (tourist?.firstimage) {
    console.log('URL: ' + tourist.firstimage);
    await downloadImage(tourist.firstimage, `kto-${SLUG}-3.jpg`);
  } else {
    // Fallback: search by keyword
    const results = await client.searchKeyword('단양 관광특구', { numOfRows: 3 });
    const match = results.find(r => r.firstimage);
    if (match?.firstimage) {
      console.log('Fallback URL: ' + match.firstimage);
      await downloadImage(match.firstimage, `kto-${SLUG}-3.jpg`);
    }
  }

  // 2. 구인사 detail images (contentId: 127677) — different angle from cover
  console.log('\n=== 구인사 detail images ===');
  const imgs = await client.detailImage(127677);
  console.log('상세 이미지 ' + imgs.length + '개');
  for (const img of imgs) {
    console.log('  ' + img.originimgurl);
  }
  // Download 2nd image (index 1) for a different angle
  if (imgs.length >= 2) {
    await downloadImage(imgs[1].originimgurl, `kto-${SLUG}-4.jpg`);
  }

  console.log('\n=== Done ===');
}

main().catch(e => { console.error(e); process.exit(1); });
