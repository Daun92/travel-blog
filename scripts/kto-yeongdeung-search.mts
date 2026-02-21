/**
 * 영등굿 포스트 KTO 이미지 검색
 * §2 칠머리당 야외 의례 + §3 씨드림/배방선 장면 타겟
 */
import { config } from 'dotenv';
config();

import { getDataGoKrClient } from '../src/api/data-go-kr/index.js';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';

const BLOG_IMAGES_DIR = path.resolve('blog/static/images');
const SLUG = 'jeju-yeongdeung-haenyeo';

interface SearchTarget {
  keyword: string;
  section: string;
  contentTypeId?: number;
  outputFile: string;
  fallbackKeywords?: string[];
}

const targets: SearchTarget[] = [
  {
    keyword: '칠머리당',
    section: '§2 칠머리당 영등굿 의례',
    contentTypeId: 15, // festival
    outputFile: `kto-${SLUG}-chilmeori.jpg`,
    fallbackKeywords: ['칠머리당영등굿', '제주 칠머리당', '칠머리당 영등굿'],
  },
  {
    keyword: '제주 영등제',
    section: '§2 영등제 (폴백)',
    contentTypeId: 15,
    outputFile: `kto-${SLUG}-yeongdeungje.jpg`,
    fallbackKeywords: ['영등굿', '영등제', '제주영등굿'],
  },
  {
    keyword: '칠머리당',
    section: '§2 칠머리당 (관광지)',
    contentTypeId: 12, // tourist spot
    outputFile: `kto-${SLUG}-chilmeori-spot.jpg`,
    fallbackKeywords: ['제주 칠머리당'],
  },
  {
    keyword: '제주 영등제',
    section: '§3 씨드림/배방선',
    contentTypeId: 12,
    outputFile: `kto-${SLUG}-ssideurim.jpg`,
    fallbackKeywords: ['영등제', '제주 영등'],
  },
];

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
        console.log(`    ❌ HTTP ${res.statusCode}`);
        resolve(false);
        return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        if (buffer.length < 1000) {
          console.log(`    ❌ Too small (${buffer.length} bytes)`);
          resolve(false);
          return;
        }
        fs.writeFileSync(outputPath, buffer);
        console.log(`    ✅ Downloaded: ${path.basename(outputPath)} (${(buffer.length / 1024).toFixed(0)}KB)`);
        resolve(true);
      });
      res.on('error', () => resolve(false));
    }).on('error', () => resolve(false));
  });
}

async function searchAndDownload(target: SearchTarget, client: ReturnType<typeof getDataGoKrClient>) {
  if (!client) return { target, found: false };

  const outputPath = path.join(BLOG_IMAGES_DIR, target.outputFile);
  if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
    console.log(`  ⏭️  ${target.section}: ${target.outputFile} 이미 존재 — 스킵`);
    return { target, found: true };
  }

  const allKeywords = [target.keyword, ...(target.fallbackKeywords || [])];

  for (const keyword of allKeywords) {
    console.log(`  🔍 ${target.section}: "${keyword}" 검색 (type: ${target.contentTypeId})...`);

    try {
      const items = await client.searchKeyword(keyword, {
        numOfRows: 10,
        contentTypeId: target.contentTypeId,
      });

      if (items.length === 0) {
        console.log(`    결과 없음`);
        continue;
      }

      // 제주 지역 우선
      const jejuItems = items.filter((item: any) =>
        item.addr1?.includes('제주') || item.areacode === '39'
      );

      const searchPool = jejuItems.length > 0 ? jejuItems : items;
      console.log(`    결과 ${items.length}건 (제주: ${jejuItems.length}건)`);

      for (const item of searchPool) {
        const title = item.title || '';
        const addr = item.addr1 || '';
        const firstimage = item.firstimage || '';
        const contentId = item.contentid;

        console.log(`    → ${title} | ${addr} | contentId: ${contentId}`);

        // firstimage
        if (firstimage) {
          console.log(`    firstimage: ${firstimage.substring(0, 80)}...`);
          const success = await downloadImage(firstimage, outputPath);
          if (success) {
            return { target, found: true, title, address: addr, contentId, imageUrl: firstimage };
          }
        }

        // detailImage — 여러 시점 확보
        if (contentId) {
          try {
            console.log(`    detailImage 조회 (contentId: ${contentId})...`);
            const detailImages = await client.getDetailImages(contentId);
            console.log(`    detailImage: ${detailImages.length}장`);

            for (let i = 0; i < Math.min(detailImages.length, 5); i++) {
              const img = detailImages[i] as any;
              const imgUrl = img.originimgurl || img.smallimageurl;
              if (imgUrl) {
                console.log(`    [${i}] ${imgUrl.substring(0, 80)}...`);
                // 첫 번째 것만 다운로드
                if (i === 0) {
                  const success = await downloadImage(imgUrl, outputPath);
                  if (success) {
                    return { target, found: true, title, address: addr, contentId, imageUrl: imgUrl };
                  }
                }
              }
            }
          } catch { /* continue */ }
        }
      }
    } catch (err) {
      console.log(`    ⚠️ API 오류: ${(err as Error).message}`);
    }
  }

  console.log(`  ❌ ${target.section}: 모든 키워드 실패`);
  return { target, found: false };
}

async function main() {
  console.log('=== 영등굿 포스트 KTO 이미지 검색 ===\n');

  const client = getDataGoKrClient();
  if (!client) {
    console.error('❌ KTO API 클라이언트 초기화 실패');
    process.exit(1);
  }

  const results = [];

  for (const target of targets) {
    const result = await searchAndDownload(target, client);
    results.push(result);
    console.log('');
  }

  console.log('\n=== 결과 요약 ===');
  for (const r of results) {
    const status = r.found ? '✅' : '❌';
    const detail = (r as any).title ? `${(r as any).title} (${(r as any).address || ''})` : '';
    console.log(`${status} ${r.target.section}: ${r.target.outputFile} ${detail}`);
  }

  const registryEntries = results
    .filter((r): r is typeof r & { contentId: string; imageUrl: string; title: string } =>
      r.found && !!(r as any).contentId
    )
    .map((r: any) => ({
      source: 'kto',
      ktoContentId: r.contentId,
      ktoUrl: r.imageUrl,
      postSlug: SLUG,
      query: r.target.keyword,
      usedAt: new Date().toISOString(),
      note: `${r.target.section}: ${r.title}`,
    }));

  if (registryEntries.length > 0) {
    console.log('\n=== image-registry.json 엔트리 ===');
    console.log(JSON.stringify(registryEntries, null, 2));
  }
}

main().catch(console.error);
