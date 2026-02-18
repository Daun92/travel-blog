/**
 * 2026-02-18 포스트 인라인 이미지 KTO 배치 검색
 */
import { config } from 'dotenv';
config();

import { getDataGoKrClient } from '../src/api/data-go-kr/index.js';
import { writeFile } from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const OUTPUT_DIR = 'blog/static/images';

interface SearchTarget {
  keyword: string;
  contentTypeId: number;
  outputFile: string;
  postSlug: string;
  section: string;
}

const TARGETS: SearchTarget[] = [
  // Post #1 (거제·통영) — 섹션 2: 구조라
  { keyword: '구조라관광어촌마을', contentTypeId: 12, outputFile: 'kto-2026-02-18-to-3.jpg', postSlug: '2026-02-18-to', section: '구조라관광어촌마을' },
  // Post #1 — 섹션 4: 덕포랜드 씨라인
  { keyword: '덕포해수욕장', contentTypeId: 12, outputFile: 'kto-2026-02-18-to-4.jpg', postSlug: '2026-02-18-to', section: '덕포랜드 씨라인' },
  // Post #2 (망원·문래·신당) — 섹션 1: 망원동
  { keyword: '망원시장', contentTypeId: 12, outputFile: 'kto-2026-02-18-post-3.jpg', postSlug: '2026-02-18-post', section: '망원동' },
  // Post #2 — 섹션 2: 문래동
  { keyword: '문래창작촌', contentTypeId: 14, outputFile: 'kto-2026-02-18-post-4.jpg', postSlug: '2026-02-18-post', section: '문래동 창작촌' },
  // Post #2 — 섹션 3: 신당동
  { keyword: '신당동중앙시장', contentTypeId: 12, outputFile: 'kto-2026-02-18-post-5.jpg', postSlug: '2026-02-18-post', section: '신당동 중앙시장' },
  // Post #3 (양평 vs 가평) — 섹션 3: 더 힐하우스
  { keyword: '더힐하우스양평', contentTypeId: 32, outputFile: 'kto-2026-02-18-vs-3.jpg', postSlug: '2026-02-18-vs', section: '더 힐하우스 양평' },
  // Post #3 — 섹션 4: 불빛:애
  { keyword: '양평 불빛축제', contentTypeId: 15, outputFile: 'kto-2026-02-18-vs-4.jpg', postSlug: '2026-02-18-vs', section: '겨울엔 양평 불빛:애' },
];

async function downloadImage(url: string, outputPath: string): Promise<boolean> {
  try {
    const response = await fetch(url);
    if (!response.ok) return false;
    const buffer = Buffer.from(await response.arrayBuffer());
    await writeFile(outputPath, buffer);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const client = getDataGoKrClient();
  console.log('=== 2026-02-18 KTO 배치 검색 ===\n');

  const results: { target: SearchTarget; status: string; title?: string; imageUrl?: string }[] = [];

  for (const target of TARGETS) {
    const outputPath = join(OUTPUT_DIR, target.outputFile);

    if (existsSync(outputPath)) {
      console.log(`⏭️ SKIP: ${target.outputFile} (이미 존재)`);
      results.push({ target, status: 'skip' });
      continue;
    }

    console.log(`\n🔍 검색: "${target.keyword}" (contentTypeId: ${target.contentTypeId})`);

    try {
      // searchKeyword API 호출
      const searchResult = await client.searchKeyword({
        keyword: target.keyword,
        contentTypeId: target.contentTypeId,
        numOfRows: 5,
      });

      const items = searchResult.items;
      if (!items || items.length === 0) {
        console.log(`   ❌ 결과 없음`);

        // 폴백: 키워드 첫 단어로 재시도
        const firstWord = target.keyword.split(/\s/)[0];
        if (firstWord !== target.keyword) {
          console.log(`   🔄 폴백 검색: "${firstWord}"`);
          const fallbackResult = await client.searchKeyword({
            keyword: firstWord,
            contentTypeId: target.contentTypeId,
            numOfRows: 5,
          });
          const fallbackItems = fallbackResult.items;
          if (fallbackItems && fallbackItems.length > 0) {
            // title 검증 필수
            const item = fallbackItems[0];
            console.log(`   ⚠️ 폴백 결과: "${item.title}" — title 검증 필요`);
            if (item.firstimage) {
              console.log(`   📷 이미지 URL: ${item.firstimage}`);
              const downloaded = await downloadImage(item.firstimage, outputPath);
              if (downloaded) {
                console.log(`   ✅ 다운로드: ${target.outputFile}`);
                results.push({ target, status: 'fallback', title: item.title, imageUrl: item.firstimage });
                continue;
              }
            }
          }
        }

        results.push({ target, status: 'not_found' });
        continue;
      }

      // 가장 적합한 결과 선택 (firstimage가 있는 것 우선)
      const withImage = items.filter((item: any) => item.firstimage);
      const bestItem = withImage.length > 0 ? withImage[0] : items[0];

      console.log(`   📋 결과: "${bestItem.title}" (contentId: ${bestItem.contentid})`);

      if (bestItem.firstimage) {
        console.log(`   📷 이미지: ${bestItem.firstimage}`);
        const downloaded = await downloadImage(bestItem.firstimage, outputPath);
        if (downloaded) {
          console.log(`   ✅ 다운로드: ${target.outputFile}`);
          results.push({ target, status: 'success', title: bestItem.title, imageUrl: bestItem.firstimage });
        } else {
          console.log(`   ❌ 다운로드 실패`);
          results.push({ target, status: 'download_failed', title: bestItem.title });
        }
      } else {
        console.log(`   ⚠️ firstimage 없음 — detailImage2 시도`);
        try {
          const detail = await client.detailImage({
            contentId: bestItem.contentid,
          });
          const images = detail.items;
          if (images && images.length > 0) {
            const imgUrl = images[0].originimgurl || images[0].smallimageurl;
            if (imgUrl) {
              const downloaded = await downloadImage(imgUrl, outputPath);
              if (downloaded) {
                console.log(`   ✅ 다운로드 (detailImage): ${target.outputFile}`);
                results.push({ target, status: 'success', title: bestItem.title, imageUrl: imgUrl });
              } else {
                results.push({ target, status: 'download_failed', title: bestItem.title });
              }
            } else {
              results.push({ target, status: 'no_image', title: bestItem.title });
            }
          } else {
            results.push({ target, status: 'no_image', title: bestItem.title });
          }
        } catch {
          results.push({ target, status: 'no_image', title: bestItem.title });
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`   ❌ API 오류: ${msg}`);
      results.push({ target, status: 'error' });
    }
  }

  // 결과 요약
  console.log('\n=== 결과 요약 ===');
  for (const r of results) {
    const icon = r.status === 'success' ? '✅' :
                 r.status === 'fallback' ? '⚠️' :
                 r.status === 'skip' ? '⏭️' : '❌';
    console.log(`${icon} ${r.target.section} → ${r.target.outputFile}: ${r.status}${r.title ? ` (${r.title})` : ''}`);
  }
}

main().catch(err => {
  console.error('치명적 오류:', err);
  process.exit(1);
});
