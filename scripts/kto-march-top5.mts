/**
 * KTO Image Search for March TOP 5 Posts (Festival + Exhibition)
 *
 * Usage:
 *   npx tsx scripts/kto-march-top5.mts              # Run all
 *   npx tsx scripts/kto-march-top5.mts --dry-run     # Preview only
 *   npx tsx scripts/kto-march-top5.mts --batch 1     # Festival only
 *   npx tsx scripts/kto-march-top5.mts --batch 2     # Exhibition only
 */
import { config } from 'dotenv';
config();

import { getDataGoKrClient } from '../src/api/data-go-kr/index.js';
import { writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const IMG_DIR = 'blog/static/images';
const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_ARG = process.argv.find(a => a.startsWith('--batch'));
const BATCH_NUM = BATCH_ARG ? parseInt(process.argv[process.argv.indexOf(BATCH_ARG) + 1]) : 0;

interface SearchTarget {
  keyword: string;
  contentTypeId?: string;
  outputFile: string;
  postSlug: string;
  batch: number;
  note?: string;
}

// ── Batch 1: Festival TOP 5 ─────────────────────────────────────────
const festivalTargets: SearchTarget[] = [
  // 1위: 구례 산수유축제
  { keyword: '구례산수유마을', contentTypeId: '12', outputFile: 'kto-march-festival-gurye.jpg', postSlug: 'march-spring-festival-top5', batch: 1, note: '1위 구례' },
  { keyword: '지리산온천', contentTypeId: '12', outputFile: 'kto-march-festival-jirisan.jpg', postSlug: 'march-spring-festival-top5', batch: 1, note: '1위 구례 보조' },
  // 2위: 서천 동백꽃·주꾸미
  { keyword: '마량리동백나무숲', contentTypeId: '12', outputFile: 'kto-march-festival-dongbaek.jpg', postSlug: 'march-spring-festival-top5', batch: 1, note: '2위 서천 동백숲' },
  { keyword: '마량포구', contentTypeId: '12', outputFile: 'kto-march-festival-marangpo.jpg', postSlug: 'march-spring-festival-top5', batch: 1, note: '2위 서천 항구' },
  // 3위: 양평 산수유·한우
  { keyword: '양평', contentTypeId: '12', outputFile: 'kto-march-festival-yangpyeong.jpg', postSlug: 'march-spring-festival-top5', batch: 1, note: '3위 양평' },
  // 4위: 화개장터 벚꽃
  { keyword: '화개장터', contentTypeId: '12', outputFile: 'kto-march-festival-hwagae.jpg', postSlug: 'march-spring-festival-top5', batch: 1, note: '4위 화개장터' },
  { keyword: '쌍계사', contentTypeId: '12', outputFile: 'kto-march-festival-ssanggyesa.jpg', postSlug: 'march-spring-festival-top5', batch: 1, note: '4위 쌍계사' },
  // 5위: 이천 백사
  { keyword: '이천', contentTypeId: '12', outputFile: 'kto-march-festival-icheon.jpg', postSlug: 'march-spring-festival-top5', batch: 1, note: '5위 이천' },
];

// ── Batch 1b: Festival Retries ──────────────────────────────────────
const festivalRetry: SearchTarget[] = [
  { keyword: '서천', contentTypeId: '12', outputFile: 'kto-march-festival-seocheon.jpg', postSlug: 'march-spring-festival-top5', batch: 1, note: '2위 서천 대체' },
  { keyword: '구례', contentTypeId: '12', outputFile: 'kto-march-festival-gurye-alt.jpg', postSlug: 'march-spring-festival-top5', batch: 1, note: '1위 구례 대체' },
  { keyword: '하동', contentTypeId: '12', outputFile: 'kto-march-festival-hadong.jpg', postSlug: 'march-spring-festival-top5', batch: 1, note: '4위 하동 대체' },
];

// ── Batch 2: Exhibition TOP 5 ───────────────────────────────────────
const exhibitionTargets: SearchTarget[] = [
  // 1위: 데미안 허스트 — MMCA
  { keyword: '국립현대미술관서울', contentTypeId: '14', outputFile: 'kto-march-exhibition-mmca.jpg', postSlug: 'march-seoul-exhibition-top5', batch: 2, note: '1위 MMCA' },
  // 2위: 티노 세갈 — 리움
  { keyword: '리움미술관', contentTypeId: '14', outputFile: 'kto-march-exhibition-leeum.jpg', postSlug: 'march-seoul-exhibition-top5', batch: 2, note: '2위 리움 (민간시설 - 실패 예상)' },
  // 3위: 도널드 저드 — 현대카드 스토리지 (이태원)
  { keyword: '이태원', contentTypeId: '12', outputFile: 'kto-march-exhibition-itaewon.jpg', postSlug: 'march-seoul-exhibition-top5', batch: 2, note: '3위 이태원 주변' },
  // 4위: 울트라백화점 — DDP
  { keyword: '동대문디자인플라자', contentTypeId: '14', outputFile: 'kto-march-exhibition-ddp.jpg', postSlug: 'march-seoul-exhibition-top5', batch: 2, note: '4위 DDP' },
  // 5위: 볼로냐 — 예술의전당
  { keyword: '서울예술의전당', contentTypeId: '14', outputFile: 'kto-march-exhibition-artscenter.jpg', postSlug: 'march-seoul-exhibition-top5', batch: 2, note: '5위 예술의전당' },
];

// ── Batch 2b: Exhibition Retries ────────────────────────────────────
const exhibitionRetry: SearchTarget[] = [
  { keyword: '한남동', contentTypeId: '12', outputFile: 'kto-march-exhibition-hannam.jpg', postSlug: 'march-seoul-exhibition-top5', batch: 2, note: '2위 리움 대체 (한남동)' },
  { keyword: 'DDP', contentTypeId: '14', outputFile: 'kto-march-exhibition-ddp.jpg', postSlug: 'march-seoul-exhibition-top5', batch: 2, note: '4위 DDP 대체' },
  { keyword: '예술의전당', contentTypeId: '14', outputFile: 'kto-march-exhibition-artscenter.jpg', postSlug: 'march-seoul-exhibition-top5', batch: 2, note: '5위 예술의전당 대체' },
];

const ALL_TARGETS = [
  ...festivalTargets,
  ...exhibitionTargets,
  ...festivalRetry,
  ...exhibitionRetry,
];

async function downloadImage(url: string, filename: string): Promise<boolean> {
  if (DRY_RUN) {
    console.log(`  🔍 [DRY-RUN] Would download → ${filename}`);
    return true;
  }
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    const path = join(IMG_DIR, filename);
    writeFileSync(path, buffer);
    console.log(`  ✅ ${filename} (${(buffer.length / 1024).toFixed(0)}KB)`);
    return true;
  } catch (e: any) {
    console.log(`  ❌ Download failed: ${e.message}`);
    return false;
  }
}

async function main() {
  let targets = BATCH_NUM > 0
    ? ALL_TARGETS.filter(t => t.batch === BATCH_NUM)
    : ALL_TARGETS;

  console.log(`\n🚀 KTO March TOP 5 Image Search — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`📦 Targets: ${targets.length}개 (batch: ${BATCH_NUM || 'all'})`);
  console.log(`📁 Output: ${IMG_DIR}\n`);

  const client = getDataGoKrClient();
  const results: Array<{
    keyword: string;
    outputFile: string;
    postSlug: string;
    contentId: string;
    title: string;
    imageUrl: string;
    success: boolean;
    note?: string;
  }> = [];

  for (const target of targets) {
    console.log(`\n🔍 [${target.note || target.keyword}] "${target.keyword}" (typeId=${target.contentTypeId})...`);

    // Skip if file already exists
    if (existsSync(join(IMG_DIR, target.outputFile))) {
      console.log(`  ⏭️ ${target.outputFile} already exists — skip`);
      results.push({ ...target, contentId: 'existing', title: 'existing', imageUrl: 'existing', success: true });
      continue;
    }

    try {
      // Search
      let searchResults = await client.searchKeyword(target.keyword, {
        contentTypeId: target.contentTypeId,
        numOfRows: 10,
      });

      // First-word fallback (with caution)
      if (searchResults.length === 0) {
        const firstWord = target.keyword.split(/[\s·]/)[0];
        if (firstWord !== target.keyword && firstWord.length >= 2) {
          console.log(`  0 results → retry "${firstWord}"...`);
          searchResults = await client.searchKeyword(firstWord, {
            contentTypeId: target.contentTypeId,
            numOfRows: 10,
          });
        }
      }

      if (searchResults.length === 0) {
        console.log(`  ❌ No results`);
        results.push({ ...target, contentId: '', title: '', imageUrl: '', success: false });
        continue;
      }

      // Pick best match — prefer with image
      const withImage = searchResults.filter((r: any) => r.firstimage);
      const best = (withImage.length > 0 ? withImage[0] : searchResults[0]) as any;
      const contentId = best.contentid;
      const title = best.title;
      console.log(`  → ${title} (id: ${contentId})`);

      // Image URL chain: firstimage → detailImage → detailCommon
      let imageUrl = best.firstimage || '';

      if (!imageUrl) {
        console.log(`  No firstimage → detailImage...`);
        try {
          const images = await client.detailImage(contentId);
          if (images.length > 0) {
            const img = images[0] as any;
            imageUrl = img.originimgurl || img.originImgUrl || '';
          }
        } catch (e: any) {
          console.log(`  detailImage error: ${e.message}`);
        }
      }

      if (!imageUrl) {
        console.log(`  No detailImage → detailCommon...`);
        try {
          const detail = await client.detailCommon(contentId);
          imageUrl = (detail as any).firstimage || (detail as any).firstimage2 || '';
        } catch (e: any) {
          console.log(`  detailCommon error: ${e.message}`);
        }
      }

      if (!imageUrl) {
        console.log(`  ❌ No image URL found`);
        results.push({ ...target, contentId, title, imageUrl: '', success: false });
        continue;
      }

      // Download
      const success = await downloadImage(imageUrl, target.outputFile);
      results.push({ ...target, contentId, title, imageUrl, success });

    } catch (e: any) {
      console.log(`  ❌ Error: ${e.message}`);
      results.push({ ...target, contentId: '', title: '', imageUrl: '', success: false });
    }
  }

  // ── Summary ─────────────────────────────────────────────────────────
  console.log('\n\n📋 Results Summary:');
  console.log('─'.repeat(80));

  const bySlug = new Map<string, typeof results>();
  for (const r of results) {
    const list = bySlug.get(r.postSlug) || [];
    list.push(r);
    bySlug.set(r.postSlug, list);
  }

  for (const [slug, items] of bySlug) {
    const ok = items.filter(i => i.success).length;
    console.log(`\n  📝 ${slug} (${ok}/${items.length})`);
    for (const r of items) {
      const status = r.success ? '✅' : '❌';
      console.log(`     ${status} "${r.keyword}" → ${r.outputFile} ${r.title ? `[${r.title}]` : ''}`);
    }
  }

  console.log('\n' + '─'.repeat(80));
  const total = results.length;
  const success = results.filter(r => r.success).length;
  console.log(`\n🎯 Total: ${success}/${total} succeeded`);

  // Registry entries
  const newEntries = results.filter(r => r.success && r.contentId !== 'existing');
  if (newEntries.length > 0) {
    console.log('\n📝 image-registry.json entries:');
    for (const r of newEntries) {
      console.log(JSON.stringify({
        source: 'kto',
        ktoContentId: r.contentId,
        ktoUrl: r.imageUrl,
        postSlug: r.postSlug,
        query: r.keyword,
        usedAt: new Date().toISOString(),
        note: r.note || '',
      }));
    }
  }

  // Failed targets (candidates for AI stillcut fallback)
  const failed = results.filter(r => !r.success);
  if (failed.length > 0) {
    console.log('\n⚠️ AI Stillcut Fallback Candidates:');
    for (const r of failed) {
      console.log(`  - ${r.keyword} (${r.note || r.postSlug})`);
    }
  }
}

main().catch(console.error);
