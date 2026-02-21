import { config } from 'dotenv'; config();
import { getDataGoKrClient } from '../src/api/data-go-kr/index.js';
import * as fs from 'fs';

const SLUG = '2026-02-20-sindorim-factory-zone-deep-digging';
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

  // 신도림전주관 (2836621) - 포스트 3층 레이어 핵심
  console.log('=== 신도림전주관 detailImage ===');
  const imgs1 = await client.detailImage('2836621');
  console.log('상세 이미지: ' + imgs1.length + '개');
  for (const img of imgs1) console.log('  ' + img.originimgurl);

  // 신도림테크노근린공원 (3447960) - 포스트 2층 레이어
  console.log('\n=== 신도림테크노근린공원 detailImage ===');
  const imgs2 = await client.detailImage('3447960');
  console.log('상세 이미지: ' + imgs2.length + '개');
  for (const img of imgs2) console.log('  ' + img.originimgurl);

  // 구로공단 노동자생활체험관 (2553960) - 공장지대 서사
  console.log('\n=== 구로공단 노동자생활체험관 detailImage ===');
  const imgs3 = await client.detailImage('2553960');
  console.log('상세 이미지: ' + imgs3.length + '개');
  for (const img of imgs3) console.log('  ' + img.originimgurl);

  // 구로기계공구단지 (2591803) - 공장지대 서사
  console.log('\n=== 구로기계공구단지 detailImage ===');
  const imgs4 = await client.detailImage('2591803');
  console.log('상세 이미지: ' + imgs4.length + '개');
  for (const img of imgs4) console.log('  ' + img.originimgurl);

  // Download best matches for sections
  // 커버: 신도림테크노근린공원 firstimage (포스트 전체 테마 = 공장지대의 쉼표)
  console.log('\n=== Downloads ===');

  // 신도림테크노근린공원 firstimage for cover (공원 = 공장지대 쉼표)
  const parkSearch = await client.searchKeyword('신도림테크노근린공원', { numOfRows: 1 });
  if (parkSearch.length > 0 && parkSearch[0].firstimage) {
    console.log('Cover candidate: ' + parkSearch[0].title);
    await downloadImage(parkSearch[0].firstimage, 'kto-' + SLUG + '-park-cover.jpg');
  }

  // 신도림전주관 firstimage for section 3
  const jeonjuSearch = await client.searchKeyword('신도림전주관', { numOfRows: 1 });
  if (jeonjuSearch.length > 0 && jeonjuSearch[0].firstimage) {
    console.log('Section 3 candidate: ' + jeonjuSearch[0].title);
    await downloadImage(jeonjuSearch[0].firstimage, 'kto-' + SLUG + '-jeonju.jpg');
  }

  // Detail images - pick best for section 1 (테크노마트/산업)
  if (imgs3.length > 0) {
    console.log('Section 1 candidate (노동자체험관): detail image');
    await downloadImage(imgs3[0].originimgurl, 'kto-' + SLUG + '-factory.jpg');
  } else if (imgs4.length > 0) {
    console.log('Section 1 candidate (기계공구단지): detail image');
    await downloadImage(imgs4[0].originimgurl, 'kto-' + SLUG + '-factory.jpg');
  }

  console.log('\nDone');
}

main().catch(e => { console.error('ERROR:', e); process.exit(1); });
