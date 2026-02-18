/**
 * KTO Image Batch — 2/14 포스트 2건 인라인 이미지 보강
 *
 * Usage:
 *   npx tsx scripts/kto-feb14-batch.mts              # Run all
 *   npx tsx scripts/kto-feb14-batch.mts --dry-run     # Preview only
 */
import { config } from 'dotenv';
config();

import { getDataGoKrClient } from '../src/api/data-go-kr/index.js';
import { writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const IMG_DIR = 'blog/static/images';
const DRY_RUN = process.argv.includes('--dry-run');

interface SearchTarget {
  keyword: string;
  contentTypeId?: string;
  outputFile: string;
  postSlug: string;
  note: string;
}

// ── 서울 야경 TOP 7 (viral/조회영) ─────────────────────────────────
const nightViewTargets: SearchTarget[] = [
  { keyword: '응봉산', contentTypeId: '12', outputFile: 'kto-nightview-eungbongsan.jpg', postSlug: '2026-02-14-top-7', note: '응봉산 야경 파노라마' },
  { keyword: '롯데월드타워', contentTypeId: '14', outputFile: 'kto-nightview-lottetower.jpg', postSlug: '2026-02-14-top-7', note: '서울스카이 전망대' },
  { keyword: '세빛섬', contentTypeId: '12', outputFile: 'kto-nightview-sebitseum.jpg', postSlug: '2026-02-14-top-7', note: '반포대교 세빛섬' },
  { keyword: '동대문디자인플라자', contentTypeId: '14', outputFile: 'kto-nightview-ddp.jpg', postSlug: '2026-02-14-top-7', note: 'DDP LED 장미정원' },
  { keyword: '북악스카이웨이', contentTypeId: '12', outputFile: 'kto-nightview-bukak.jpg', postSlug: '2026-02-14-top-7', note: '팔각정 전망대' },
  { keyword: '낙산공원', contentTypeId: '12', outputFile: 'kto-nightview-naksan.jpg', postSlug: '2026-02-14-top-7', note: '성곽길 야경' },
  { keyword: '노들섬', contentTypeId: '14', outputFile: 'kto-nightview-nodeul.jpg', postSlug: '2026-02-14-top-7', note: '한강 위 복합문화공간' },
];

// ── 벚꽃 개화시기 (informative/한교양) ─────────────────────────────
const cherryBlossomTargets: SearchTarget[] = [
  { keyword: '경화역', contentTypeId: '12', outputFile: 'kto-cherry-gyeonghwa.jpg', postSlug: '2026-02-14-2026', note: '진해 경화역 벚꽃 터널' },
  { keyword: '여좌천', contentTypeId: '12', outputFile: 'kto-cherry-yeojwacheon.jpg', postSlug: '2026-02-14-2026', note: '진해 여좌천 로망스다리' },
  { keyword: '경주보문단지', contentTypeId: '12', outputFile: 'kto-cherry-bomun.jpg', postSlug: '2026-02-14-2026', note: '경주 보문호 벚꽃길' },
  { keyword: '불국사', contentTypeId: '12', outputFile: 'kto-cherry-bulguksa.jpg', postSlug: '2026-02-14-2026', note: '불국사 진입로 벚꽃' },
  { keyword: '대릉원', contentTypeId: '12', outputFile: 'kto-cherry-daereungwon.jpg', postSlug: '2026-02-14-2026', note: '대릉원(천마총) 벚꽃' },
  { keyword: '석촌호수', contentTypeId: '12', outputFile: 'kto-cherry-seokchon.jpg', postSlug: '2026-02-14-2026', note: '석촌호수 벚꽃 산책로' },
  { keyword: '여의도윤중로', contentTypeId: '12', outputFile: 'kto-cherry-yeouido.jpg', postSlug: '2026-02-14-2026', note: '여의도 윤중로 벚꽃길' },
];

// ── 재시도 대체 키워드 ─────────────────────────────────────────────
const retryTargets: SearchTarget[] = [
  // 노들섬 재시도 (14 실패 시 12로)
  { keyword: '노들섬', contentTypeId: '12', outputFile: 'kto-nightview-nodeul.jpg', postSlug: '2026-02-14-top-7', note: '노들섬 재시도 (관광지)' },
  // 북악스카이웨이 재시도
  { keyword: '팔각정', contentTypeId: '12', outputFile: 'kto-nightview-bukak.jpg', postSlug: '2026-02-14-top-7', note: '팔각정 재시도' },
  // 여의도 재시도
  { keyword: '여의도공원', contentTypeId: '12', outputFile: 'kto-cherry-yeouido.jpg', postSlug: '2026-02-14-2026', note: '여의도공원 재시도' },
  // 경주보문단지 재시도
  { keyword: '보문관광단지', contentTypeId: '12', outputFile: 'kto-cherry-bomun.jpg', postSlug: '2026-02-14-2026', note: '보문관광단지 재시도' },
];

const ALL_TARGETS = [...nightViewTargets, ...cherryBlossomTargets];

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

async function searchAndDownload(
  client: ReturnType<typeof getDataGoKrClient>,
  target: SearchTarget
): Promise<{ success: boolean; contentId: string; title: string; imageUrl: string }> {
  console.log(`\n🔍 [${target.postSlug}] "${target.keyword}" 검색... (${target.note})`);

  // Skip if file already exists
  if (existsSync(join(IMG_DIR, target.outputFile))) {
    console.log(`  ⏭️ ${target.outputFile} 이미 존재 — 건너뜀`);
    return { success: true, contentId: 'existing', title: 'existing', imageUrl: 'existing' };
  }

  try {
    // Step 1: Search
    let searchResults = await client.searchKeyword(target.keyword, {
      contentTypeId: target.contentTypeId,
      numOfRows: 10,
    });

    // First-word fallback (주의: title 검증 필수)
    if (searchResults.length === 0) {
      const firstWord = target.keyword.split(/[\s·]/)[0];
      if (firstWord !== target.keyword && firstWord.length >= 2) {
        console.log(`  검색 결과 없음 → "${firstWord}" 재검색...`);
        searchResults = await client.searchKeyword(firstWord, {
          contentTypeId: target.contentTypeId,
          numOfRows: 10,
        });
      }
    }

    if (searchResults.length === 0) {
      console.log(`  ❌ 검색 결과 없음`);
      return { success: false, contentId: '', title: '', imageUrl: '' };
    }

    // Pick best match — prefer results with firstimage
    const withImage = searchResults.filter((r: any) => r.firstimage);
    const best = (withImage.length > 0 ? withImage[0] : searchResults[0]) as any;
    const contentId = best.contentid;
    const title = best.title;
    console.log(`  → ${title} (contentId: ${contentId})`);

    // Title 검증 — 미스매치 감지
    const keywordNorm = target.keyword.replace(/[\s·]/g, '').toLowerCase();
    const titleNorm = title.replace(/[\s·]/g, '').toLowerCase();
    if (!titleNorm.includes(keywordNorm) && !keywordNorm.includes(titleNorm.slice(0, 3))) {
      console.log(`  ⚠️ 미스매치 가능: "${target.keyword}" → "${title}" — 계속 진행하되 주의`);
    }

    // Step 2: Try firstimage
    let imageUrl = best.firstimage || '';

    // Step 3: detailImage fallback
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

    // Step 4: detailCommon fallback
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
      return { success: false, contentId, title, imageUrl: '' };
    }

    // Step 5: Download
    console.log(`  이미지: ${imageUrl.substring(0, 80)}...`);
    const success = await downloadImage(imageUrl, target.outputFile);
    return { success, contentId, title, imageUrl };

  } catch (e: any) {
    console.log(`  ❌ 검색 에러: ${e.message}`);
    return { success: false, contentId: '', title: '', imageUrl: '' };
  }
}

async function main() {
  console.log(`\n🚀 KTO Image Batch — 2/14 포스트 2건 (${DRY_RUN ? 'DRY RUN' : 'LIVE'})`);
  console.log(`📦 Primary targets: ${ALL_TARGETS.length}개`);
  console.log(`📁 Output: ${IMG_DIR}\n`);

  const client = getDataGoKrClient();
  const results: Array<SearchTarget & { success: boolean; contentId: string; title: string; imageUrl: string }> = [];

  // Phase 1: Primary search
  for (const target of ALL_TARGETS) {
    const result = await searchAndDownload(client, target);
    results.push({ ...target, ...result });
  }

  // Phase 2: Retry failed targets
  const failedFiles = new Set(results.filter(r => !r.success).map(r => r.outputFile));
  const retries = retryTargets.filter(t => failedFiles.has(t.outputFile));

  if (retries.length > 0) {
    console.log(`\n\n🔄 재시도: ${retries.length}개 대상`);
    for (const target of retries) {
      if (existsSync(join(IMG_DIR, target.outputFile))) continue;
      const result = await searchAndDownload(client, target);
      if (result.success) {
        // Update main result
        const idx = results.findIndex(r => r.outputFile === target.outputFile);
        if (idx >= 0) results[idx] = { ...target, ...result };
      }
    }
  }

  // ── Summary ─────────────────────────────────────────────────────
  console.log('\n\n📋 결과 요약:');
  console.log('─'.repeat(80));

  const bySlug = new Map<string, typeof results>();
  for (const r of results) {
    const list = bySlug.get(r.postSlug) || [];
    list.push(r);
    bySlug.set(r.postSlug, list);
  }

  for (const [slug, items] of bySlug) {
    const ok = items.filter(i => i.success).length;
    console.log(`\n  📝 ${slug} (${ok}/${items.length} 성공)`);
    for (const r of items) {
      const status = r.success ? '✅' : '❌';
      console.log(`     ${status} ${r.keyword} → ${r.outputFile} ${!r.success ? '' : `(${r.title})`}`);
    }
  }

  const total = results.length;
  const success = results.filter(r => r.success).length;
  console.log('\n' + '─'.repeat(80));
  console.log(`\n🎯 전체: ${success}/${total} 성공`);

  // Registry entries
  const newEntries = results.filter(r => r.success && r.contentId !== 'existing');
  if (newEntries.length > 0) {
    console.log('\n📝 image-registry.json 추가 엔트리:');
    for (const r of newEntries) {
      console.log(JSON.stringify({
        source: 'kto',
        ktoContentId: r.contentId,
        ktoUrl: r.imageUrl,
        postSlug: r.postSlug,
        query: r.keyword,
        usedAt: new Date().toISOString(),
        note: r.note,
      }));
    }
  }
}

main().catch(console.error);
