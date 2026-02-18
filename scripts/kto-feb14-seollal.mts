/**
 * KTO Image Search — 설날 포스트 (2026-02-14-post) 섹션별 실사진 보강
 *
 * 타겟:
 *   Section 2 (떡국): 한국민속촌 전통 체험
 *   Section 3 (윷놀이): 국립민속박물관
 *   Section 4 (전시): 국립현대미술관 서울, 예술의전당
 *   Section 5 (축제): 고창모양성, 강진, 대가야
 */
import { config } from 'dotenv';
config();

import { getDataGoKrClient } from '../src/api/data-go-kr/index.js';
import { writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const IMG_DIR = 'blog/static/images';
const DRY_RUN = process.argv.includes('--dry-run');
const POST_SLUG = '2026-02-14-post';

interface SearchTarget {
  keyword: string;
  contentTypeId?: string;
  outputFile: string;
  section: string;
  note: string;
}

// ── Primary Batch ────────────────────────────────────────────────────
const primaryTargets: SearchTarget[] = [
  // Section 2: 떡국 → 한국민속촌(전통 음식 체험)
  {
    keyword: '한국민속촌',
    contentTypeId: '12',
    outputFile: `kto-${POST_SLUG}-minsokchon.jpg`,
    section: 'Section 2 (떡국)',
    note: '전통 음식/떡국 체험 연계'
  },
  // Section 3: 윷놀이 → 국립민속박물관
  {
    keyword: '국립민속박물관',
    contentTypeId: '14',
    outputFile: `kto-${POST_SLUG}-folklore-museum.jpg`,
    section: 'Section 3 (윷놀이)',
    note: '민속 놀이 전시 연계'
  },
  // Section 4: 국립현대미술관 서울
  {
    keyword: '국립현대미술관 서울',
    contentTypeId: '14',
    outputFile: `kto-${POST_SLUG}-mmca.jpg`,
    section: 'Section 4 (MMCA)',
    note: '삼청동 서울관'
  },
  // Section 4: 예술의전당 — 미스매치 주의, "서울예술의전당"으로 검색
  {
    keyword: '서울예술의전당',
    contentTypeId: '14',
    outputFile: `kto-${POST_SLUG}-artscenter.jpg`,
    section: 'Section 4 (예술의전당)',
    note: '서초동, 계룡 미스매치 방지'
  },
  // Section 5: 고창모양성
  {
    keyword: '고창모양성',
    contentTypeId: '12',
    outputFile: `kto-${POST_SLUG}-gochang.jpg`,
    section: 'Section 5 (고창)',
    note: '성 밟기 축제'
  },
  // Section 5: 강진
  {
    keyword: '강진청자축제',
    contentTypeId: '15',
    outputFile: `kto-${POST_SLUG}-gangjin.jpg`,
    section: 'Section 5 (강진)',
    note: '청자 도자기 체험'
  },
  // Section 5: 대가야
  {
    keyword: '고령 대가야',
    contentTypeId: '12',
    outputFile: `kto-${POST_SLUG}-gaya.jpg`,
    section: 'Section 5 (대가야)',
    note: '대가야 역사 문화'
  },
];

// ── Retry Batch (1차 실패 시 대체 키워드) ────────────────────────────
const retryTargets: SearchTarget[] = [
  // 예술의전당 retry
  {
    keyword: '예술의전당',
    contentTypeId: '14',
    outputFile: `kto-${POST_SLUG}-artscenter.jpg`,
    section: 'Section 4 (예술의전당)',
    note: '재시도 — 키워드 짧게'
  },
  // 강진 retry (축제가 아닌 관광지로)
  {
    keyword: '강진',
    contentTypeId: '12',
    outputFile: `kto-${POST_SLUG}-gangjin.jpg`,
    section: 'Section 5 (강진)',
    note: '재시도 — 관광지 타입'
  },
  // 대가야 retry
  {
    keyword: '대가야박물관',
    contentTypeId: '14',
    outputFile: `kto-${POST_SLUG}-gaya.jpg`,
    section: 'Section 5 (대가야)',
    note: '재시도 — 문화시설'
  },
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
    console.log(`  ❌ ${filename}: ${e.message}`);
    return false;
  }
}

interface SearchResult {
  keyword: string;
  outputFile: string;
  section: string;
  contentId: string;
  title: string;
  imageUrl: string;
  success: boolean;
}

async function searchTarget(
  client: any,
  target: SearchTarget
): Promise<SearchResult> {
  console.log(`\n🔍 [${target.section}] "${target.keyword}" 검색... (${target.note})`);

  // Skip if already downloaded
  if (existsSync(join(IMG_DIR, target.outputFile))) {
    console.log(`  ⏭️ ${target.outputFile} 이미 존재 — 건너뜀`);
    return { ...target, contentId: 'existing', title: 'existing', imageUrl: 'existing', success: true };
  }

  try {
    // Step 1: Search
    const searchOpts: any = { numOfRows: 10 };
    if (target.contentTypeId) searchOpts.contentTypeId = target.contentTypeId;
    // Festival search needs eventStartDate
    if (target.contentTypeId === '15') searchOpts.eventStartDate = '20260101';

    let searchResults = await client.searchKeyword(target.keyword, searchOpts);

    if (searchResults.length === 0) {
      console.log(`  검색 결과 없음`);
      return { ...target, contentId: '', title: '', imageUrl: '', success: false };
    }

    // Pick best match — prefer results with firstimage
    const withImage = searchResults.filter((r: any) => r.firstimage);
    const best = (withImage.length > 0 ? withImage[0] : searchResults[0]) as any;
    const contentId = best.contentid;
    const title = best.title;
    console.log(`  → ${title} (contentId: ${contentId})`);

    // ★ Title mismatch validation
    const keywordCore = target.keyword.replace(/\s/g, '');
    const titleNorm = title.replace(/\s/g, '');
    if (!titleNorm.includes(keywordCore.slice(0, 3)) && !keywordCore.includes(titleNorm.slice(0, 3))) {
      console.log(`  ⚠️ 타이틀 미스매치 의심: "${title}" ≠ "${target.keyword}"`);
    }

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
      console.log(`  ❌ 이미지 URL 없음`);
      return { ...target, contentId, title, imageUrl: '', success: false };
    }

    // Step 5: Download
    console.log(`  이미지: ${imageUrl.substring(0, 80)}...`);
    const success = await downloadImage(imageUrl, target.outputFile);
    return { ...target, contentId, title, imageUrl, success };

  } catch (e: any) {
    console.log(`  ❌ 에러: ${e.message}`);
    return { ...target, contentId: '', title: '', imageUrl: '', success: false };
  }
}

async function main() {
  console.log(`\n🚀 KTO Image Search — 설날 포스트 (${POST_SLUG})`);
  console.log(`   Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`   Output: ${IMG_DIR}\n`);

  const client = getDataGoKrClient();
  const results: SearchResult[] = [];

  // ── Phase 1: Primary targets ──
  console.log('\n═══ Phase 1: Primary 검색 ═══');
  for (const target of primaryTargets) {
    const result = await searchTarget(client, target);
    results.push(result);
  }

  // ── Phase 2: Retry failed targets ──
  const failedFiles = new Set(results.filter(r => !r.success).map(r => r.outputFile));
  const retriesToRun = retryTargets.filter(t => failedFiles.has(t.outputFile));

  if (retriesToRun.length > 0) {
    console.log('\n═══ Phase 2: 재시도 (대체 키워드) ═══');
    for (const target of retriesToRun) {
      const result = await searchTarget(client, target);
      results.push(result);
    }
  }

  // ── Summary ──
  console.log('\n\n📋 결과 요약:');
  console.log('─'.repeat(70));

  const bySection = new Map<string, SearchResult[]>();
  for (const r of results) {
    const list = bySection.get(r.section) || [];
    list.push(r);
    bySection.set(r.section, list);
  }

  for (const [section, items] of bySection) {
    const ok = items.some(i => i.success);
    console.log(`\n  ${ok ? '✅' : '❌'} ${section}`);
    for (const r of items) {
      const status = r.success ? '✅' : '❌';
      const titleInfo = r.title && r.title !== 'existing' ? ` → "${r.title}"` : '';
      console.log(`     ${status} ${r.keyword}${titleInfo} → ${r.outputFile}`);
    }
  }

  const total = new Set(results.map(r => r.outputFile)).size;
  const success = new Set(results.filter(r => r.success).map(r => r.outputFile)).size;
  console.log(`\n🎯 전체: ${success}/${total} 이미지 확보`);

  // Registry entries
  const newEntries = results.filter(r => r.success && r.contentId !== 'existing');
  if (newEntries.length > 0) {
    console.log('\n📝 image-registry.json 추가 엔트리:');
    for (const r of newEntries) {
      console.log(JSON.stringify({
        source: 'kto',
        ktoContentId: r.contentId,
        ktoUrl: r.imageUrl,
        postSlug: POST_SLUG,
        query: r.keyword,
        usedAt: new Date().toISOString(),
        note: r.section
      }));
    }
  }

  // Failed targets (for AI stillcut fallback)
  const failedSections = [...bySection.entries()]
    .filter(([_, items]) => !items.some(i => i.success))
    .map(([section]) => section);

  if (failedSections.length > 0) {
    console.log('\n⚠️ AI 스틸컷 폴백 필요:');
    for (const s of failedSections) {
      console.log(`   - ${s}`);
    }
  }
}

main().catch(console.error);
