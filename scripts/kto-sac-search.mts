import { config } from 'dotenv'; config();
import { getDataGoKrClient } from '../src/api/data-go-kr/index.js';
import * as fs from 'fs';

const SLUG = '2026-02-20-march-theatre-performances-top-5-seoul';
const IMG_DIR = 'blog/static/images';

async function downloadImage(url: string, filename: string) {
  const res = await fetch(url);
  if (!res.ok) { console.log('  FAIL: ' + res.status); return false; }
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(IMG_DIR + '/' + filename, buf);
  console.log('  OK: ' + filename + ' (' + Math.round(buf.length / 1024) + 'KB)');
  return true;
}

async function main() {
  const client = getDataGoKrClient();

  // 서울 예술의전당 — contentTypeId 없이 검색
  console.log('=== 예술의전당 (all types) ===');
  const r1 = await client.searchKeyword('예술의전당', { numOfRows: 10 });
  for (const r of r1) {
    const isSeoul = r.addr1?.includes('서울') ? '★' : ' ';
    console.log('[' + (r.firstimage ? 'Y' : 'N') + ']' + isSeoul + ' ' + r.contentid + ' ' + r.title + ' — ' + (r.addr1 || ''));
  }

  // 서울예술의전당으로 직접 검색
  console.log('\n=== 서울예술의전당 ===');
  const r2 = await client.searchKeyword('서울예술의전당', { numOfRows: 5 });
  for (const r of r2) {
    console.log('[' + (r.firstimage ? 'Y' : 'N') + '] ' + r.contentid + ' ' + r.title + ' — ' + (r.addr1 || ''));
  }

  // 서초 예술의전당으로 검색
  console.log('\n=== 서초 예술의전당 ===');
  const r3 = await client.searchKeyword('서초 예술의전당', { numOfRows: 5 });
  for (const r of r3) {
    console.log('[' + (r.firstimage ? 'Y' : 'N') + '] ' + r.contentid + ' ' + r.title + ' — ' + (r.addr1 || ''));
  }

  // Download Seoul SAC if found
  const allResults = [...r1, ...r2, ...r3];
  const seoulSac = allResults.find(r => r.firstimage && r.addr1?.includes('서울') && r.title?.includes('예술의전당'));
  if (seoulSac) {
    console.log('\nDownloading Seoul SAC: ' + seoulSac.title);
    await downloadImage(seoulSac.firstimage!, 'kto-' + SLUG + '-sac-seoul.jpg');
    const imgs = await client.detailImage(String(seoulSac.contentid));
    console.log('detailImage: ' + imgs.length + '개');
    if (imgs.length > 0) {
      await downloadImage(imgs[0].originimgurl, 'kto-' + SLUG + '-sac-seoul-detail.jpg');
    }
  } else {
    console.log('\nSeoul SAC not found with firstimage');
  }

  console.log('\nDone');
}

main().catch(e => { console.error('ERROR:', e); process.exit(1); });
