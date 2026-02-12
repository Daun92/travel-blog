/**
 * KTO Image Boost — add inline images to posts with only 2 images
 *
 * Target posts:
 * 1. 2026-02-07-1 (템플스테이): 묘각사, 마곡사
 * 2. 2026-02-11-368 (제주 오름): 성산일출봉, 산방산
 * 3. 2026-02-11-post (목포 근대역사): 유달산, 달성사/성지
 */
import { config } from 'dotenv';
config();

import { getDataGoKrClient } from '../src/api/data-go-kr/index.js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const IMG_DIR = 'blog/static/images';

interface SearchTarget {
  keyword: string;
  contentTypeId?: string;
  outputFile: string;
  postSlug: string;
}

const targets: SearchTarget[] = [
  // 템플스테이
  { keyword: '묘각사', contentTypeId: '12', outputFile: 'kto-2026-02-07-1-1.jpg', postSlug: '2026-02-07-1' },
  { keyword: '마곡사', contentTypeId: '12', outputFile: 'kto-2026-02-07-1-2.jpg', postSlug: '2026-02-07-1' },
  // 제주 오름
  { keyword: '성산일출봉', contentTypeId: '12', outputFile: 'kto-2026-02-11-368-3.jpg', postSlug: '2026-02-11-368' },
  { keyword: '산방산', contentTypeId: '12', outputFile: 'kto-2026-02-11-368-4.jpg', postSlug: '2026-02-11-368' },
  // 목포
  { keyword: '유달산', contentTypeId: '12', outputFile: 'kto-2026-02-11-post-3.jpg', postSlug: '2026-02-11-post' },
  { keyword: '목포 달성사', contentTypeId: '12', outputFile: 'kto-2026-02-11-post-4.jpg', postSlug: '2026-02-11-post' },
];

async function downloadImage(url: string, filename: string): Promise<boolean> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    const path = join(IMG_DIR, filename);
    writeFileSync(path, buffer);
    console.log(`  ✅ ${filename} (${(buffer.length / 1024).toFixed(0)}KB)`);
    return true;
  } catch (e: any) {
    console.log(`  ❌ ${filename}: ${e.message}`);
    return false;
  }
}

async function main() {
  const client = getDataGoKrClient();
  const results: Array<{
    keyword: string;
    outputFile: string;
    contentId: string;
    title: string;
    imageUrl: string;
    success: boolean;
  }> = [];

  for (const target of targets) {
    console.log(`\n🔍 "${target.keyword}" 검색...`);

    try {
      // Step 1: Search
      const searchResults = await client.searchKeyword(target.keyword, {
        contentTypeId: target.contentTypeId,
        numOfRows: 5,
      });

      if (searchResults.length === 0) {
        // Retry with first word only
        const firstWord = target.keyword.split(' ')[0];
        console.log(`  검색 결과 없음 → "${firstWord}" 재검색...`);
        const retry = await client.searchKeyword(firstWord, {
          contentTypeId: target.contentTypeId,
          numOfRows: 5,
        });
        if (retry.length === 0) {
          console.log(`  ❌ 재검색도 결과 없음`);
          results.push({ keyword: target.keyword, outputFile: target.outputFile, contentId: '', title: '', imageUrl: '', success: false });
          continue;
        }
        searchResults.push(...retry);
      }

      // Pick best match (first result usually)
      const best = searchResults[0] as any;
      const contentId = best.contentid;
      const title = best.title;
      console.log(`  → ${title} (contentId: ${contentId})`);

      // Step 2: Try firstimage from search result
      let imageUrl = best.firstimage || '';

      // Step 3: If no firstimage, try detailImage
      if (!imageUrl) {
        console.log(`  firstimage 없음 → detailImage 조회...`);
        try {
          const images = await client.detailImage(contentId);
          if (images.length > 0) {
            const img = images[0] as any;
            imageUrl = img.originimgurl || img.originImgUrl || '';
          }
        } catch (e: any) {
          console.log(`  detailImage 에러: ${e.message}`);
        }
      }

      // Step 4: If still no image, try detailCommon
      if (!imageUrl) {
        console.log(`  detailImage 없음 → detailCommon 조회...`);
        try {
          const detail = await client.detailCommon(contentId);
          imageUrl = (detail as any).firstimage || (detail as any).firstimage2 || '';
        } catch (e: any) {
          console.log(`  detailCommon 에러: ${e.message}`);
        }
      }

      if (!imageUrl) {
        console.log(`  ❌ 이미지 URL을 찾을 수 없음`);
        results.push({ keyword: target.keyword, outputFile: target.outputFile, contentId, title, imageUrl: '', success: false });
        continue;
      }

      // Step 5: Download
      console.log(`  이미지 다운로드: ${imageUrl.substring(0, 80)}...`);
      const success = await downloadImage(imageUrl, target.outputFile);

      results.push({ keyword: target.keyword, outputFile: target.outputFile, contentId, title, imageUrl, success });
    } catch (e: any) {
      console.log(`  ❌ 검색 에러: ${e.message}`);
      results.push({ keyword: target.keyword, outputFile: target.outputFile, contentId: '', title: '', imageUrl: '', success: false });
    }
  }

  // Summary
  console.log('\n\n📋 결과 요약:');
  console.log('─'.repeat(80));
  for (const r of results) {
    const status = r.success ? '✅' : '❌';
    console.log(`${status} ${r.keyword} → ${r.outputFile} (${r.title || 'N/A'}, contentId: ${r.contentId || 'N/A'})`);
  }
  console.log('─'.repeat(80));

  // Output registry entries for successful downloads
  console.log('\n📝 image-registry.json 추가 엔트리:');
  for (const r of results.filter(r => r.success)) {
    const slug = targets.find(t => t.keyword === r.keyword)!.postSlug;
    console.log(JSON.stringify({
      ktoContentId: r.contentId,
      ktoUrl: r.imageUrl,
      source: 'kto',
      postSlug: slug,
      query: r.keyword,
    }, null, 2));
  }
}

main().catch(console.error);
