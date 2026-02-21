import { config } from 'dotenv'; config();
import { getDataGoKrClient } from '../src/api/data-go-kr/index.js';
import * as fs from 'fs';

async function main() {
  const client = getDataGoKrClient();

  // 창덕궁과 후원 (contentId: 127642)
  console.log('Fetching 창덕궁과 후원...');
  const items = await client.detailCommon('127642');
  if (items.length === 0) {
    console.log('No detail found, trying search...');
    const results = await client.searchKeyword('창덕궁 후원', { contentTypeId: '12', numOfRows: 5 });
    for (const r of results) {
      console.log('[' + (r.firstimage ? 'Y' : 'N') + '] ' + r.contentid + ' ' + r.title);
      if (r.firstimage) {
        const res = await fetch(r.firstimage);
        const buf = Buffer.from(await res.arrayBuffer());
        fs.writeFileSync('blog/static/images/kto-2026-02-20-seoul-five-palaces-spring-tour-guide-4.jpg', buf);
        console.log('Downloaded: ' + Math.round(buf.length / 1024) + 'KB');
        break;
      }
    }
  } else {
    const detail = items[0];
    console.log('title: ' + detail.title);
    console.log('firstimage: ' + detail.firstimage);
    if (detail.firstimage) {
      const res = await fetch(detail.firstimage);
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync('blog/static/images/kto-2026-02-20-seoul-five-palaces-spring-tour-guide-4.jpg', buf);
      console.log('Downloaded: ' + Math.round(buf.length / 1024) + 'KB');
    }
  }
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
