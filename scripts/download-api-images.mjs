import 'dotenv/config';
import { getDataGoKrClient } from '../dist/api/data-go-kr/index.js';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

const client = getDataGoKrClient();
const imgDir = path.join(process.cwd(), 'blog/static/images/api');
fs.mkdirSync(imgDir, { recursive: true });

function download(url, filepath) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { timeout: 10000 }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return download(res.headers.location, filepath).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        reject(new Error('Status ' + res.statusCode));
        return;
      }
      const ws = fs.createWriteStream(filepath);
      res.pipe(ws);
      ws.on('finish', () => { ws.close(); resolve(filepath); });
      ws.on('error', reject);
    }).on('error', reject);
  });
}

async function main() {
  const spots = [
    { name: 'mmca', query: '국립현대미술관', desc: '국립현대미술관' },
    { name: 'ikseondong', query: '익선동', desc: '익선동 한옥 골목' },
    { name: 'gamroam', query: '감로암', desc: '감로암(서울)' },
    { name: 'gaeunsa', query: '개운사', desc: '개운사(서울)' },
  ];

  const results = [];

  for (const spot of spots) {
    try {
      const items = await client.searchKeyword(spot.query, { numOfRows: 3 });
      if (items.length === 0) continue;

      const item = items[0];
      const images = await client.detailImage(item.contentid);
      if (images.length === 0 && !item.firstimage) continue;

      const imgUrl = item.firstimage || images[0].originimgurl;
      const ext = '.jpg';
      const filename = 'api-' + spot.name + ext;
      const filepath = path.join(imgDir, filename);

      console.log('Downloading: ' + spot.desc + ' → ' + filename);
      await download(imgUrl, filepath);

      const stat = fs.statSync(filepath);
      console.log('  OK: ' + (stat.size / 1024).toFixed(1) + 'KB');

      results.push({
        name: spot.name,
        desc: spot.desc,
        filename,
        hugoPath: '/travel-blog/images/api/' + filename,
        source: item.title,
      });
    } catch (e) {
      console.error('[' + spot.name + '] Failed: ' + e.message);
    }
  }

  console.log('\n=== Downloaded Images ===');
  for (const r of results) {
    console.log(r.hugoPath + ' ← ' + r.source);
  }
}

main();
