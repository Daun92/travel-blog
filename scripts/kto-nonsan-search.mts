import { config } from 'dotenv'; config();
import { getDataGoKrClient } from '../src/api/data-go-kr/index.js';
import * as fs from 'fs';

async function main() {
  const client = getDataGoKrClient();

  // 관촉사 검색
  console.log('=== 관촉사 검색 ===');
  const results = await client.searchKeyword('관촉사', { contentTypeId: '12', numOfRows: 5 });
  for (const r of results) {
    const img = r.firstimage ? 'Y' : 'N';
    console.log('[' + img + '] ' + r.contentid + ' ' + r.title + ' — ' + (r.addr1 || 'N/A'));
  }

  // 관촉사 detailImage
  if (results.length > 0) {
    const main = results[0];
    console.log('\n=== ' + main.title + ' 상세 이미지 ===');
    const images = await client.detailImage(String(main.contentid));
    console.log('이미지 ' + images.length + '개 발견');
    for (const img of images.slice(0, 5)) {
      console.log('  ' + img.originimgurl);
    }

    if (main.firstimage) {
      console.log('\nfirstimage: ' + main.firstimage);
      const res = await fetch(main.firstimage);
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync('blog/static/images/kto-nonsan-strawberry-gwanchuksa.jpg', buf);
      console.log('Downloaded cover: ' + Math.round(buf.length / 1024) + 'KB');
    }
  }

  // 논산 딸기 축제 검색
  console.log('\n=== 논산 딸기 검색 ===');
  const fest = await client.searchKeyword('논산 딸기', { numOfRows: 5 });
  for (const r of fest) {
    const img = r.firstimage ? 'Y' : 'N';
    console.log('[' + img + '] ' + r.contentid + ' ' + r.title + ' — ' + (r.addr1 || 'N/A'));
  }

  // 명재고택 검색
  console.log('\n=== 명재고택 검색 ===');
  const mj = await client.searchKeyword('명재고택', { contentTypeId: '12', numOfRows: 5 });
  for (const r of mj) {
    const img = r.firstimage ? 'Y' : 'N';
    console.log('[' + img + '] ' + r.contentid + ' ' + r.title + ' — ' + (r.addr1 || 'N/A'));
  }
}

main().catch(console.error);
