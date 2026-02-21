import { config } from 'dotenv'; config();
import { getDataGoKrClient } from '../src/api/data-go-kr/index.js';
import * as fs from 'fs';

const SLUG = '2026-02-20-west-coast-trail-digging-taean-boryeong';
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

  // 기존 이미지 확인: kto-...-1.jpg (병바위), kto-...-3.jpg (해수욕장 코스)
  // 필요: 무창포 (section 3), 명사십리 (section 4), 커버 후보

  console.log('=== 무창포 ===');
  const r1 = await client.searchKeyword('무창포', { numOfRows: 5 });
  for (const r of r1) {
    console.log('[' + (r.firstimage ? 'Y' : 'N') + '] ' + r.contentid + ' ' + r.title + ' — ' + (r.addr1 || ''));
  }

  console.log('\n=== 명사십리 고창 ===');
  const r2 = await client.searchKeyword('명사십리', { contentTypeId: '12', numOfRows: 5 });
  for (const r of r2) {
    console.log('[' + (r.firstimage ? 'Y' : 'N') + '] ' + r.contentid + ' ' + r.title + ' — ' + (r.addr1 || ''));
  }

  console.log('\n=== 태안 해변길 ===');
  const r3 = await client.searchKeyword('태안 해변길', { numOfRows: 5 });
  for (const r of r3) {
    console.log('[' + (r.firstimage ? 'Y' : 'N') + '] ' + r.contentid + ' ' + r.title + ' — ' + (r.addr1 || ''));
  }

  console.log('\n=== 꽃지해수욕장 ===');
  const r4 = await client.searchKeyword('꽃지해수욕장', { numOfRows: 3 });
  for (const r of r4) {
    console.log('[' + (r.firstimage ? 'Y' : 'N') + '] ' + r.contentid + ' ' + r.title + ' — ' + (r.addr1 || ''));
  }

  // Download best matches
  console.log('\n=== Downloads ===');

  // 무창포 — section 3
  const muchangpo = r1.find(r => r.firstimage && r.title?.includes('무창포'));
  if (muchangpo) {
    console.log('Section 3 (무창포): ' + muchangpo.title);
    await downloadImage(muchangpo.firstimage!, 'kto-' + SLUG + '-muchangpo.jpg');

    // detailImage for more options
    const imgs = await client.detailImage(String(muchangpo.contentid));
    console.log('  detailImage: ' + imgs.length + '개');
    for (const img of imgs.slice(0, 3)) console.log('    ' + img.originimgurl);
  }

  // 명사십리 — section 4 supplement
  const myeongsa = r2.find(r => r.firstimage && (r.addr1?.includes('고창') || r.title?.includes('고창') || r.title?.includes('명사십리')));
  if (myeongsa) {
    console.log('Section 4 (명사십리): ' + myeongsa.title);
    await downloadImage(myeongsa.firstimage!, 'kto-' + SLUG + '-myeongsa.jpg');
  }

  // 꽃지해수욕장 — section 1 / cover candidate
  const kkotji = r4.find(r => r.firstimage);
  if (kkotji) {
    console.log('Cover candidate (꽃지): ' + kkotji.title);
    await downloadImage(kkotji.firstimage!, 'kto-' + SLUG + '-kkotji.jpg');

    const imgs = await client.detailImage(String(kkotji.contentid));
    console.log('  detailImage: ' + imgs.length + '개');
    for (const img of imgs.slice(0, 3)) console.log('    ' + img.originimgurl);
  }

  console.log('\nDone');
}

main().catch(e => { console.error('ERROR:', e); process.exit(1); });
