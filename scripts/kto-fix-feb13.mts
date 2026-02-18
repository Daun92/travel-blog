/**
 * KTO Image Fix — 2/13 포스트 인라인 이미지 교체
 * 컨텍스트 불일치 KTO 이미지를 올바른 이미지로 교체
 */
import { config } from 'dotenv';
config();

import { getDataGoKrClient } from '../src/api/data-go-kr/index.js';
import { writeFileSync } from 'fs';
import { join } from 'path';

const IMG_DIR = 'blog/static/images';

interface ReplaceTarget {
  keyword: string;
  contentTypeId: string;
  outputFile: string;
  reason: string;
}

const TARGETS: ReplaceTarget[] = [
  {
    keyword: '다랭이마을',
    contentTypeId: '12',
    outputFile: 'kto-2026-02-13-post-1.jpg',
    reason: '편백자연휴양림 → 다랭이논 섹션에 맞는 이미지 필요',
  },
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
  console.log('\n🔄 KTO Image Fix — 2/13 포스트\n');
  const client = getDataGoKrClient();

  for (const target of TARGETS) {
    console.log(`🔍 "${target.keyword}" 검색... (${target.reason})`);

    const results = await client.searchKeyword(target.keyword, {
      contentTypeId: target.contentTypeId,
      numOfRows: 10,
    });

    if (results.length === 0) {
      console.log(`  ❌ 검색 결과 없음`);
      continue;
    }

    // Pick first result with image
    const withImage = results.filter((r: any) => r.firstimage);
    const best = (withImage.length > 0 ? withImage[0] : results[0]) as any;
    console.log(`  → ${best.title} (contentId: ${best.contentid})`);

    let imageUrl = best.firstimage || '';

    if (!imageUrl) {
      console.log(`  firstimage 없음 → detailImage 조회...`);
      const images = await client.detailImage(best.contentid);
      if (images.length > 0) {
        imageUrl = (images[0] as any).originimgurl || '';
      }
    }

    if (!imageUrl) {
      console.log(`  ❌ 이미지 URL 없음`);
      continue;
    }

    console.log(`  📷 ${imageUrl.substring(0, 80)}...`);
    await downloadImage(imageUrl, target.outputFile);
  }

  console.log('\n✅ 완료');
}

main().catch(console.error);
