import { config } from 'dotenv'; config();
import { getDataGoKrClient } from '../src/api/data-go-kr/index.js';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

const client = getDataGoKrClient();

// Target locations with contentIds
const targets = [
  { name: '남해독일마을', contentId: '129489', post: 'post1' },
  { name: '광교산', contentId: '128064', post: 'post2' },
  { name: '광교산형제봉', contentId: '3033248', post: 'post2' },
  { name: '수리산도립공원', contentId: '125457', post: 'post2' },
];

async function downloadImage(url: string, filepath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http;
    protocol.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const redirectUrl = res.headers.location;
        if (redirectUrl) {
          downloadImage(redirectUrl, filepath).then(resolve);
          return;
        }
      }
      if (res.statusCode !== 200) { resolve(false); return; }
      const stream = fs.createWriteStream(filepath);
      res.pipe(stream);
      stream.on('finish', () => { stream.close(); resolve(true); });
      stream.on('error', () => resolve(false));
    }).on('error', () => resolve(false));
  });
}

const outputDir = 'blog/static/images';
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

for (const target of targets) {
  console.log(`\n=== ${target.name} (${target.contentId}) ===`);

  // Get detail images
  try {
    const images = await client.detailImage(target.contentId);
    console.log(`  detailImage2: ${images.length}장`);
    for (const img of images.slice(0, 5)) {
      console.log(`  - ${img.originimgurl} | serial: ${img.serialnum}`);
    }

    // Download firstimage (or first detail image) for each
    if (images.length > 0) {
      const imgUrl = images[0].originimgurl;
      const ext = imgUrl.includes('.png') ? '.png' : '.jpg';
      const slug = target.post === 'post1'
        ? 'petit-france-gapyeong-deep-dive-guide'
        : 'gyeonggi-southern-trekking-hidden-trails';
      const filename = `kto-${slug}-${target.name.replace(/\s/g, '')}${ext}`;
      const filepath = path.join(outputDir, filename);

      const success = await downloadImage(imgUrl, filepath);
      console.log(`  Download ${filename}: ${success ? 'OK' : 'FAILED'}`);
      if (success) {
        const stats = fs.statSync(filepath);
        console.log(`  Size: ${(stats.size / 1024).toFixed(0)}KB`);
      }
    }
  } catch (e: any) {
    console.log(`  ERROR: ${e.message}`);
  }
}
