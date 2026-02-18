/**
 * 미스매치 이미지 수정 — 정확한 결과 선택
 */
import { config } from 'dotenv';
config();

import { getDataGoKrClient } from '../src/api/data-go-kr/index.js';
import { writeFile, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

const OUTPUT_DIR = 'blog/static/images';

async function downloadImage(url: string, outputPath: string): Promise<boolean> {
  try {
    const response = await fetch(url);
    if (!response.ok) return false;
    const buffer = Buffer.from(await response.arrayBuffer());
    await writeFile(outputPath, buffer);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const client = getDataGoKrClient();
  console.log('=== 미스매치 수정 ===\n');

  // 1. 덕포해수욕장 (거제) — 2번째 결과가 정확
  console.log('1. 덕포해수욕장 (거제)');
  const dkPath = join(OUTPUT_DIR, 'kto-2026-02-18-to-4.jpg');
  if (existsSync(dkPath)) await unlink(dkPath);
  const dkItems = await client.searchKeyword('덕포해수욕장', { contentTypeId: '12', numOfRows: 5 });
  const dkMatch = dkItems.find((i: any) => i.title === '덕포해수욕장' && i.addr1?.includes('거제'));
  if (dkMatch?.firstimage) {
    const ok = await downloadImage(dkMatch.firstimage, dkPath);
    console.log(ok ? `   ✅ "${dkMatch.title}" (${dkMatch.addr1})` : '   ❌ 다운로드 실패');
  } else {
    // "덕포" 검색 후 거제 필터
    const items2 = await client.searchKeyword('덕포', { contentTypeId: '12', numOfRows: 10 });
    const geojeMatch = items2.find((i: any) => i.addr1?.includes('거제'));
    if (geojeMatch?.firstimage) {
      const ok = await downloadImage(geojeMatch.firstimage, dkPath);
      console.log(ok ? `   ✅ "${geojeMatch.title}" (${geojeMatch.addr1})` : '   ❌ 다운로드 실패');
    } else {
      console.log('   ❌ 거제 덕포해수욕장 이미지 없음');
    }
  }

  // 2. 신당동 떡볶이타운
  console.log('\n2. 신당동 떡볶이타운');
  const sdPath = join(OUTPUT_DIR, 'kto-2026-02-18-post-5.jpg');
  if (existsSync(sdPath)) await unlink(sdPath);
  const sdItems = await client.searchKeyword('신당동 떡볶이', { contentTypeId: '12', numOfRows: 5 });
  let sdMatch = sdItems.find((i: any) => i.title?.includes('떡볶이') && i.firstimage);
  if (!sdMatch) {
    // 이전 검색에서 2번째 결과가 떡볶이타운이었음
    const sdItems2 = await client.searchKeyword('신당동', { contentTypeId: '12', numOfRows: 10 });
    sdMatch = sdItems2.find((i: any) => i.title?.includes('떡볶이') && i.firstimage);
  }
  if (sdMatch?.firstimage) {
    const ok = await downloadImage(sdMatch.firstimage, sdPath);
    console.log(ok ? `   ✅ "${sdMatch.title}" (${sdMatch.addr1})` : '   ❌ 다운로드 실패');
  } else {
    console.log('   ❌ 떡볶이타운 이미지 없음');
  }

  // 3. 양평 남한강 (양평 지역만)
  console.log('\n3. 양평 남한강');
  const ypPath = join(OUTPUT_DIR, 'kto-2026-02-18-vs-3.jpg');
  if (existsSync(ypPath)) await unlink(ypPath);
  // 양평 areaCode=31 (경기도), sigungucode 필요
  const ypItems = await client.searchKeyword('양평', { contentTypeId: '12', numOfRows: 20 });
  const ypMatch = ypItems.find((i: any) => i.addr1?.includes('양평') && i.firstimage);
  if (ypMatch?.firstimage) {
    const ok = await downloadImage(ypMatch.firstimage, ypPath);
    console.log(ok ? `   ✅ "${ypMatch.title}" (${ypMatch.addr1})` : '   ❌ 다운로드 실패');
  } else {
    console.log('   ❌ 양평 관광지 이미지 없음');
    // 양평 검색 결과 전체 출력
    for (const item of ypItems.slice(0, 5)) {
      console.log(`   - "${item.title}" ${item.addr1 || ''} ${item.firstimage ? '📷' : '🚫'}`);
    }
  }
}

main().catch(err => {
  console.error('치명적 오류:', err);
  process.exit(1);
});
