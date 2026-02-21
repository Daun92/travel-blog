/**
 * 태화강 국가정원 KTO 이미지 심층 검색
 * 포스트 섹션별 타겟 키워드로 KTO API 검색 + 이미지 다운로드
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

interface SearchTarget {
  keyword: string;
  section: string;
  contentTypeId?: number;
  outputFile: string;
  fallbackKeywords?: string[];
}

const targets: SearchTarget[] = [
  {
    keyword: '태화강 국가정원',
    section: '§1 역사적 배경',
    contentTypeId: 12,
    outputFile: `kto-${SLUG}-garden.jpg`,
    fallbackKeywords: ['태화강국가정원', '태화강정원'],
  },
  {
    keyword: '울산 십리대숲',
    section: '§2 십리대숲 생태',
    contentTypeId: 12,
    outputFile: `kto-${SLUG}-bamboo.jpg`,
    fallbackKeywords: ['십리대숲', '태화강 대숲'],
  },
  {
    keyword: '태화루',
    section: '§4 산책 코스',
    contentTypeId: 12,
    outputFile: `kto-${SLUG}-taehwaru.jpg`,
    fallbackKeywords: ['울산 태화루'],
  },
  {
    keyword: '태화강 대공원',
    section: '§6 실용 정보',
    contentTypeId: 12,
    outputFile: `kto-${SLUG}-park.jpg`,
    fallbackKeywords: ['태화강대공원', '울산 태화강'],
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

async function searchAndDownload(target: SearchTarget, client: ReturnType<typeof getDataGoKrClient>): Promise<{
  target: SearchTarget;
  found: boolean;
  title?: string;
  address?: string;
  contentId?: string;
  imageUrl?: string;
}> {
  if (!client) return { target, found: false };

  const outputPath = path.join(BLOG_IMAGES_DIR, target.outputFile);
  if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
    console.log(`  ⏭️  ${target.section}: ${target.outputFile} 이미 존재 — 스킵`);
    return { target, found: true };
  }

  const allKeywords = [target.keyword, ...(target.fallbackKeywords || [])];

  for (const keyword of allKeywords) {
    console.log(`  🔍 ${target.section}: "${keyword}" 검색...`);

    try {
      const items = await client.searchKeyword(keyword, {
        numOfRows: 10,
        contentTypeId: target.contentTypeId,
      });

      if (items.length === 0) {
        console.log(`    결과 없음`);
        continue;
      }

      // 울산 지역 필터링
      const ulsanItems = items.filter((item: any) =>
        item.addr1?.includes('울산') || item.areacode === '7'
      );

      const searchPool = ulsanItems.length > 0 ? ulsanItems : items;
      console.log(`    결과 ${items.length}건 (울산: ${ulsanItems.length}건)`);

      for (const item of searchPool) {
        const title = item.title || '';
        const addr = item.addr1 || '';
        const firstimage = item.firstimage || '';

        console.log(`    → ${title} | ${addr}`);

        // firstimage 먼저 시도
        if (firstimage) {
          console.log(`    firstimage 발견: ${firstimage.substring(0, 80)}...`);
          const success = await downloadImage(firstimage, outputPath);
          if (success) {
            return {
              target,
              found: true,
              title,
              address: addr,
              contentId: item.contentid,
              imageUrl: firstimage,
            };
          }
        }

        // detailImage 시도
        if (item.contentid) {
          try {
            console.log(`    detailImage 조회 (contentId: ${item.contentid})...`);
            const detailImages = await client.getDetailImages(item.contentid);
            if (detailImages.length > 0) {
              const imgUrl = (detailImages[0] as any).originimgurl || (detailImages[0] as any).smallimageurl;
              if (imgUrl) {
                console.log(`    detailImage 발견: ${imgUrl.substring(0, 80)}...`);
                const success = await downloadImage(imgUrl, outputPath);
                if (success) {
                  return {
                    target,
                    found: true,
                    title,
                    address: addr,
                    contentId: item.contentid,
                    imageUrl: imgUrl,
                  };
                }
              }
            }
          } catch { /* continue */ }
        }

        // detailCommon firstimage 시도
        if (item.contentid) {
          try {
            console.log(`    detailCommon 조회 (contentId: ${item.contentid})...`);
            const detail = await client.getDetailCommon(item.contentid);
            const commonImg = (detail as any)?.firstimage || (detail as any)?.firstimage2;
            if (commonImg) {
              console.log(`    detailCommon image 발견: ${commonImg.substring(0, 80)}...`);
              const success = await downloadImage(commonImg, outputPath);
              if (success) {
                return {
                  target,
                  found: true,
                  title,
                  address: addr,
                  contentId: item.contentid,
                  imageUrl: commonImg,
                };
              }
            }
          } catch { /* continue */ }
        }

        console.log(`    이미지 없음 — 다음 결과 시도`);
      }
    } catch (err) {
      console.log(`    ⚠️ API 오류: ${(err as Error).message}`);
    }
  }

  console.log(`  ❌ ${target.section}: 모든 키워드 실패`);
  return { target, found: false };
}

async function main() {
  console.log('=== 태화강 국가정원 KTO 이미지 심층 검색 ===\n');

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
    const detail = r.title ? `${r.title} (${r.address || ''})` : '';
    console.log(`${status} ${r.target.section}: ${r.target.outputFile} ${detail}`);
  }

  // image-registry 엔트리 출력
  const registryEntries = results
    .filter((r) => r.found && r.contentId)
    .map((r) => ({
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
