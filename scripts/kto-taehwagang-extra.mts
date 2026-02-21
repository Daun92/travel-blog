/**
 * 태화강 추가 KTO 이미지 다운로드
 * "태화강" 검색에서 발견된 추가 관광지의 firstimage 다운로드
 */
import { config } from 'dotenv';
config();

import { getDataGoKrClient } from '../src/api/data-go-kr/index.js';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';

const BLOG_IMAGES_DIR = path.resolve('blog/static/images');
const SLUG = '2026-02-18-taehwagang';

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
        console.log(`  ✅ ${path.basename(outputPath)} (${(buffer.length / 1024).toFixed(0)}KB)`);
        resolve(true);
      });
      res.on('error', () => resolve(false));
    }).on('error', () => resolve(false));
  });
}

async function main() {
  const client = getDataGoKrClient();
  if (!client) { console.error('❌ Client init failed'); process.exit(1); }

  console.log('=== 태화강 추가 KTO 이미지 다운로드 ===\n');

  // "태화강" 키워드 검색 (울산 6건 발견)
  const items = await client.searchKeyword('태화강', { numOfRows: 10, contentTypeId: 12 });
  const ulsanItems = items.filter((item: any) => item.addr1?.includes('울산'));

  const downloads: { contentId: string; title: string; addr: string; filename: string; url: string }[] = [];

  for (const item of ulsanItems) {
    const i = item as any;
    const contentId = i.contentid;
    const title = i.title;
    const addr = i.addr1 || '';
    const firstimage = i.firstimage || '';

    // 128202(국가정원)은 이미 확보 — 스킵
    if (contentId === '128202') {
      console.log(`⏭️  ${title} (이미 확보)`);
      continue;
    }

    if (!firstimage) {
      console.log(`❌ ${title}: firstimage 없음`);
      continue;
    }

    // 파일명 결정
    let suffix = '';
    if (title.includes('태화강') && !title.includes('국가정원') && !title.includes('전망') && !title.includes('삼호') && !title.includes('동굴') && !title.includes('억새')) {
      suffix = 'river';
    } else if (title.includes('전망대')) {
      suffix = 'observatory';
    } else if (title.includes('삼호')) {
      suffix = 'samho';
    } else if (title.includes('동굴')) {
      suffix = 'cave';
    } else if (title.includes('억새')) {
      suffix = 'reeds';
    } else {
      suffix = contentId;
    }

    const filename = `kto-${SLUG}-${suffix}.jpg`;
    const outputPath = path.join(BLOG_IMAGES_DIR, filename);

    if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
      console.log(`⏭️  ${title}: ${filename} 이미 존재`);
      continue;
    }

    console.log(`🔍 ${title} | ${addr} | contentId: ${contentId}`);
    const success = await downloadImage(firstimage, outputPath);
    if (success) {
      downloads.push({ contentId, title, addr, filename, url: firstimage });
    }
  }

  console.log('\n=== 다운로드 완료 ===');
  console.log(`새로 다운로드: ${downloads.length}건`);

  if (downloads.length > 0) {
    console.log('\n=== image-registry.json 엔트리 ===');
    const entries = downloads.map(d => ({
      source: 'kto',
      ktoContentId: d.contentId,
      ktoUrl: d.url,
      postSlug: SLUG,
      query: '태화강',
      usedAt: new Date().toISOString(),
      note: `${d.title} (${d.addr})`,
    }));
    console.log(JSON.stringify(entries, null, 2));
  }
}

main().catch(console.error);
