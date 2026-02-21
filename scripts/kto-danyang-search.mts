import { config } from 'dotenv'; config();
import { getDataGoKrClient } from '../src/api/data-go-kr/index.js';
import * as fs from 'fs';

const SLUG = '2026-02-20-danyang-day-trip-course-and-cost';
const IMG_DIR = 'blog/static/images';

async function downloadImage(url: string, filename: string) {
  const res = await fetch(url);
  if (!res.ok) { console.log('  FAIL: ' + res.status); return; }
  const buf = Buffer.from(await res.arrayBuffer());
  const path = `${IMG_DIR}/${filename}`;
  fs.writeFileSync(path, buf);
  console.log('  Downloaded: ' + filename + ' (' + Math.round(buf.length / 1024) + 'KB)');
}

async function main() {
  const client = getDataGoKrClient();
  let ktoIdx = 3; // 0=cover, 2=바람개비마을 already exist

  // Tier 1: 고수동굴 (고유명사)
  console.log('=== Tier 1: 고수동굴 ===');
  const cave = await client.searchKeyword('고수동굴', { contentTypeId: '12', numOfRows: 5 });
  for (const r of cave) {
    const img = r.firstimage ? 'Y' : 'N';
    console.log('[' + img + '] ' + r.contentid + ' ' + r.title + ' — ' + (r.addr1 || 'N/A'));
  }

  // 고수동굴 detailImage
  const caveMatch = cave.find(r => r.title?.includes('고수동굴'));
  if (caveMatch) {
    console.log('\n--- ' + caveMatch.title + ' detailImage ---');
    const imgs = await client.detailImage(String(caveMatch.contentid));
    console.log('상세 이미지 ' + imgs.length + '개');
    for (const img of imgs.slice(0, 8)) {
      console.log('  ' + img.originimgurl);
    }

    // Download firstimage
    if (caveMatch.firstimage) {
      const ext = caveMatch.firstimage.includes('.png') ? '.png' : '.jpg';
      await downloadImage(caveMatch.firstimage, `kto-${SLUG}-${ktoIdx}${ext}`);
      ktoIdx++;
    }

    // Download best detail image (different angle)
    if (imgs.length > 1) {
      const detailUrl = imgs[1].originimgurl;
      const ext = detailUrl.includes('.png') ? '.png' : '.jpg';
      await downloadImage(detailUrl, `kto-${SLUG}-${ktoIdx}${ext}`);
      ktoIdx++;
    }
  }

  // Tier 1: 구인사 (이미 커버 있지만 다른 시점 확보)
  console.log('\n=== Tier 1: 구인사 ===');
  const temple = await client.searchKeyword('구인사', { contentTypeId: '12', numOfRows: 5 });
  for (const r of temple) {
    const img = r.firstimage ? 'Y' : 'N';
    console.log('[' + img + '] ' + r.contentid + ' ' + r.title + ' — ' + (r.addr1 || 'N/A'));
  }

  const templeMatch = temple.find(r => r.title?.includes('구인사'));
  if (templeMatch) {
    const imgs = await client.detailImage(String(templeMatch.contentid));
    console.log('구인사 상세 이미지 ' + imgs.length + '개');
    for (const img of imgs.slice(0, 5)) {
      console.log('  ' + img.originimgurl);
    }
  }

  // Tier 2: 단양 (상위 지명)
  console.log('\n=== Tier 2: 단양 관광지 ===');
  const danyang = await client.searchKeyword('단양', { contentTypeId: '12', numOfRows: 10 });
  for (const r of danyang) {
    const img = r.firstimage ? 'Y' : 'N';
    console.log('[' + img + '] ' + r.contentid + ' ' + r.title + ' — ' + (r.addr1 || 'N/A'));
  }

  console.log('\n=== 완료 ===');
  console.log('다운로드된 이미지: kto-' + SLUG + '-3.jpg ~ kto-' + SLUG + '-' + (ktoIdx - 1) + '.jpg');
}

main().catch(e => { console.error(e); process.exit(1); });
