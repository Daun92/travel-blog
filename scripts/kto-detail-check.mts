/**
 * 태화강 국가정원 detailImage 추가 이미지 확인
 */
import { config } from 'dotenv';
config();

import { getDataGoKrClient } from '../src/api/data-go-kr/index.js';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';

const BLOG_IMAGES_DIR = path.resolve('blog/static/images');

async function downloadImage(url: string, outputPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http;
    protocol.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const redirectUrl = res.headers.location;
        if (redirectUrl) {
          downloadImage(redirectUrl, outputPath).then(resolve);
          return;
        }
      }
      if (res.statusCode !== 200) {
        console.log(`  ❌ HTTP ${res.statusCode}`);
        resolve(false);
        return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        if (buffer.length < 1000) {
          console.log(`  ❌ Too small (${buffer.length} bytes)`);
          resolve(false);
          return;
        }
        fs.writeFileSync(outputPath, buffer);
        console.log(`  ✅ Downloaded: ${path.basename(outputPath)} (${(buffer.length / 1024).toFixed(0)}KB)`);
        resolve(true);
      });
      res.on('error', () => resolve(false));
    }).on('error', () => resolve(false));
  });
}

async function main() {
  const client = getDataGoKrClient();
  if (!client) {
    console.error('❌ Client init failed');
    process.exit(1);
  }

  // 1. 태화강 국가정원 (128202) detailImage
  console.log('=== 태화강 국가정원 (128202) detailImage ===');
  try {
    const imgs = await client.getDetailImages('128202');
    console.log(`이미지 수: ${imgs.length}`);
    for (let i = 0; i < imgs.length; i++) {
      const img = imgs[i] as any;
      const url = img.originimgurl || img.smallimageurl || 'NONE';
      console.log(`  [${i}] ${img.imgname || 'no-name'} | ${url.substring(0, 100)}`);

      // 첫 번째 이미지가 아닌 추가 이미지 다운로드 (garden은 이미 firstimage로 확보)
      if (i > 0 && url !== 'NONE') {
        const outPath = path.join(BLOG_IMAGES_DIR, `kto-2026-02-18-taehwagang-garden-${i}.jpg`);
        if (!fs.existsSync(outPath)) {
          await downloadImage(url, outPath);
        } else {
          console.log(`  ⏭️ 이미 존재: ${path.basename(outPath)}`);
        }
      }
    }
  } catch (e) {
    console.log(`  Error: ${(e as Error).message}`);
  }

  console.log('');

  // 2. 태화루 (2502631) detailImage
  console.log('=== 태화루 (2502631) detailImage ===');
  try {
    const imgs2 = await client.getDetailImages('2502631');
    console.log(`이미지 수: ${imgs2.length}`);
    for (let i = 0; i < imgs2.length; i++) {
      const img = imgs2[i] as any;
      const url = img.originimgurl || img.smallimageurl || 'NONE';
      console.log(`  [${i}] ${img.imgname || 'no-name'} | ${url.substring(0, 100)}`);
    }
  } catch (e) {
    console.log(`  Error: ${(e as Error).message}`);
  }

  console.log('');

  // 3. 추가 검색: "태화강" 단독 키워드 (울산 필터링)
  console.log('=== 추가 검색: "태화강" (울산 필터) ===');
  try {
    const items = await client.searchKeyword('태화강', { numOfRows: 10, contentTypeId: 12 });
    const ulsan = items.filter((item: any) => item.addr1?.includes('울산') || item.areacode === '7');
    console.log(`검색 결과: ${items.length}건, 울산: ${ulsan.length}건`);
    for (const item of ulsan) {
      const i = item as any;
      console.log(`  → ${i.title} | ${i.addr1} | firstimage: ${i.firstimage ? 'YES' : 'NO'} | contentId: ${i.contentid}`);
    }
  } catch (e) {
    console.log(`  Error: ${(e as Error).message}`);
  }

  console.log('');

  // 4. "울산 은하수길" 검색
  console.log('=== 추가 검색: "은하수길" ===');
  try {
    const items = await client.searchKeyword('은하수길', { numOfRows: 5 });
    const ulsan = items.filter((item: any) => item.addr1?.includes('울산'));
    console.log(`검색 결과: ${items.length}건, 울산: ${ulsan.length}건`);
    for (const item of items.slice(0, 5)) {
      const i = item as any;
      console.log(`  → ${i.title} | ${i.addr1} | firstimage: ${i.firstimage ? 'YES' : 'NO'}`);
    }
  } catch (e) {
    console.log(`  Error: ${(e as Error).message}`);
  }
}

main().catch(console.error);
