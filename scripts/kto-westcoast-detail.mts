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

  // 무창포어촌체험마을 (129044) — 실제 무창포 해변/어촌
  console.log('=== 무창포어촌체험마을 detailImage ===');
  const imgs1 = await client.detailImage('129044');
  console.log('상세 이미지: ' + imgs1.length + '개');
  for (const img of imgs1) console.log('  ' + img.originimgurl);

  // 무창포어촌체험마을 firstimage
  const detail1 = await client.detailCommon('129044');
  if (detail1.length > 0 && detail1[0].firstimage) {
    console.log('\n무창포어촌 firstimage: ' + detail1[0].firstimage);
    await downloadImage(detail1[0].firstimage, 'kto-' + SLUG + '-muchangpo2.jpg');
  }

  // 꽃지해수욕장 (126695) — 서해안 대표 노을/해변, detail image for cover
  console.log('\n=== 꽃지해수욕장 detailImage ===');
  const imgs2 = await client.detailImage('126695');
  console.log('상세 이미지: ' + imgs2.length + '개');
  for (const img of imgs2.slice(0, 5)) console.log('  ' + img.originimgurl);

  if (imgs2.length > 0) {
    // First detail image for cover (usually better quality/composition)
    await downloadImage(imgs2[0].originimgurl, 'kto-' + SLUG + '-kkotji-detail.jpg');
  }

  // 태안 해변길 1코스 바라길 (2783144) detailImage
  console.log('\n=== 태안 해변길 1코스 바라길 detailImage ===');
  const imgs3 = await client.detailImage('2783144');
  console.log('상세 이미지: ' + imgs3.length + '개');
  for (const img of imgs3.slice(0, 5)) console.log('  ' + img.originimgurl);

  console.log('\nDone');
}

main().catch(e => { console.error('ERROR:', e); process.exit(1); });
