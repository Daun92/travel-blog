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

  console.log('=== 신도림 ===');
  const r1 = await client.searchKeyword('신도림', { numOfRows: 10 });
  for (const r of r1) {
    console.log('[' + (r.firstimage ? 'Y' : 'N') + '] ' + r.contentid + ' ' + r.title + ' — ' + (r.addr1 || ''));
  }

  console.log('\n=== 구로 관광지 ===');
  const r2 = await client.searchKeyword('구로', { contentTypeId: '12', numOfRows: 5 });
  for (const r of r2) {
    console.log('[' + (r.firstimage ? 'Y' : 'N') + '] ' + r.contentid + ' ' + r.title + ' — ' + (r.addr1 || ''));
  }

  // Download best available
  const allResults = [...r1, ...r2];
  const withImage = allResults.filter(r => r.firstimage);

  if (withImage.length > 0) {
    // Pick first with image that's relevant to 신도림/구로 area
    const best = withImage[0];
    console.log('\nDownloading cover: ' + best.title);
    await downloadImage(best.firstimage!, 'kto-' + SLUG + '-cover.jpg');

    if (withImage.length > 1) {
      const second = withImage[1];
      console.log('Downloading section: ' + second.title);
      await downloadImage(second.firstimage!, 'kto-' + SLUG + '-1.jpg');
    }
  }

  console.log('\nDone');
}

main().catch(e => { console.error('ERROR:', e); process.exit(1); });
