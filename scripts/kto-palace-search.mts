import { config } from 'dotenv'; config();
import { getDataGoKrClient } from '../src/api/data-go-kr/index.js';
import * as fs from 'fs';

const SLUG = '2026-02-20-seoul-five-palaces-spring-tour-guide';
const IMG_DIR = 'blog/static/images';

async function downloadImage(url: string, filename: string) {
  const res = await fetch(url);
  if (!res.ok) { console.log('  FAIL: ' + res.status); return false; }
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(`${IMG_DIR}/${filename}`, buf);
  console.log('  OK: ' + filename + ' (' + Math.round(buf.length / 1024) + 'KB)');
  return true;
}

async function main() {
  const client = getDataGoKrClient();
  let idx = 3; // 0=cover(to replace), 1=간송, 2=감로암 already exist

  // 경복궁
  console.log('=== 경복궁 ===');
  const gb = await client.searchKeyword('경복궁', { contentTypeId: '12', numOfRows: 5 });
  for (const r of gb) {
    const img = r.firstimage ? 'Y' : 'N';
    console.log('[' + img + '] ' + r.contentid + ' ' + r.title + ' — ' + (r.addr1 || 'N/A'));
  }
  const gbMain = gb.find(r => r.title === '경복궁' || r.title?.includes('경복궁'));
  if (gbMain) {
    const imgs = await client.detailImage(String(gbMain.contentid));
    console.log('경복궁 상세: ' + imgs.length + '개');
    for (const img of imgs.slice(0, 5)) console.log('  ' + img.originimgurl);

    // Download firstimage for cover replacement
    if (gbMain.firstimage) {
      await downloadImage(gbMain.firstimage, `kto-${SLUG}-cover.jpg`);
    }
    // Download detail image for section
    if (imgs.length > 0) {
      await downloadImage(imgs[0].originimgurl, `kto-${SLUG}-${idx}.jpg`);
      idx++;
    }
  }

  // 창덕궁
  console.log('\n=== 창덕궁 ===');
  const cd = await client.searchKeyword('창덕궁', { contentTypeId: '12', numOfRows: 5 });
  for (const r of cd) {
    const img = r.firstimage ? 'Y' : 'N';
    console.log('[' + img + '] ' + r.contentid + ' ' + r.title + ' — ' + (r.addr1 || 'N/A'));
  }
  const cdMain = cd.find(r => r.title === '창덕궁' || r.title?.startsWith('창덕궁'));
  if (cdMain) {
    const imgs = await client.detailImage(String(cdMain.contentid));
    console.log('창덕궁 상세: ' + imgs.length + '개');
    for (const img of imgs.slice(0, 5)) console.log('  ' + img.originimgurl);

    if (cdMain.firstimage) {
      await downloadImage(cdMain.firstimage, `kto-${SLUG}-${idx}.jpg`);
      idx++;
    }
  }

  // 덕수궁
  console.log('\n=== 덕수궁 ===');
  const ds = await client.searchKeyword('덕수궁', { contentTypeId: '12', numOfRows: 3 });
  for (const r of ds) {
    const img = r.firstimage ? 'Y' : 'N';
    console.log('[' + img + '] ' + r.contentid + ' ' + r.title + ' — ' + (r.addr1 || 'N/A'));
  }

  console.log('\n=== Done (idx=' + idx + ') ===');
}

main().catch(e => { console.error(e); process.exit(1); });
