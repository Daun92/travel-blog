/**
 * Multi-API Image & Data Search for March TOP 5 Posts
 *
 * Uses ALL available APIs to maximize image coverage:
 *   1. CultureInfo (B000=전시, C000=축제) — imgUrl 제공
 *   2. KCISA SAC (예술의전당 종합) — imageUrl 제공
 *   3. KOPIS (공연예술) — poster 제공
 *   4. KTO (관광공사) — 추가 타겟 검색
 *
 * Usage:
 *   npx tsx scripts/multi-api-march-top5.mts                # Run all
 *   npx tsx scripts/multi-api-march-top5.mts --dry-run      # Preview only
 *   npx tsx scripts/multi-api-march-top5.mts --api culture  # CultureInfo only
 *   npx tsx scripts/multi-api-march-top5.mts --api sac      # SAC only
 *   npx tsx scripts/multi-api-march-top5.mts --api kopis    # KOPIS only
 *   npx tsx scripts/multi-api-march-top5.mts --api kto      # KTO additional
 */
import { config } from 'dotenv';
config();

import { writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const IMG_DIR = 'blog/static/images';
const DRY_RUN = process.argv.includes('--dry-run');
const API_FILTER = (() => {
  const idx = process.argv.indexOf('--api');
  return idx >= 0 ? process.argv[idx + 1] : 'all';
})();

interface SearchResult {
  api: string;
  query: string;
  title: string;
  imageUrl: string;
  venue?: string;
  period?: string;
  price?: string;
  postSlug: string;
  note: string;
  downloaded: boolean;
  outputFile?: string;
}

const results: SearchResult[] = [];

// ── Helper ───────────────────────────────────────────────────────────
async function downloadImage(url: string, filename: string): Promise<boolean> {
  if (DRY_RUN) {
    console.log(`  🔍 [DRY-RUN] Would download → ${filename}`);
    return true;
  }
  if (existsSync(join(IMG_DIR, filename))) {
    console.log(`  ⏭️ ${filename} already exists — skip`);
    return true;
  }
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    writeFileSync(join(IMG_DIR, buffer.length > 0 ? filename : ''), buffer);
    if (buffer.length < 1000) {
      console.log(`  ⚠️ ${filename} too small (${buffer.length}B) — likely placeholder`);
      return false;
    }
    writeFileSync(join(IMG_DIR, filename), buffer);
    console.log(`  ✅ ${filename} (${(buffer.length / 1024).toFixed(0)}KB)`);
    return true;
  } catch (e: any) {
    console.log(`  ❌ Download failed: ${e.message}`);
    return false;
  }
}

// ── 1. CultureInfo API ───────────────────────────────────────────────
async function searchCultureInfo() {
  console.log('\n\n═══════════════════════════════════════════════════════════');
  console.log('  📚 CultureInfo API (한눈에보는문화정보)');
  console.log('═══════════════════════════════════════════════════════════');

  const { getCultureInfoClient } = await import('../src/api/culture-info/index.js');
  const client = getCultureInfoClient();
  if (!client) {
    console.log('  ❌ CultureInfo client unavailable (KTO_API_KEY missing)');
    return;
  }

  // ── Exhibition searches (B000=전시) ──
  const exhibitionKeywords = [
    { keyword: '데미안 허스트', slug: 'march-seoul-exhibition-top5', note: '1위 MMCA' },
    { keyword: '티노 세갈', slug: 'march-seoul-exhibition-top5', note: '2위 리움' },
    { keyword: '도널드 저드', slug: 'march-seoul-exhibition-top5', note: '3위 현대카드' },
    { keyword: '울트라백화점', slug: 'march-seoul-exhibition-top5', note: '4위 DDP' },
    { keyword: '볼로냐', slug: 'march-seoul-exhibition-top5', note: '5위 예술의전당' },
    { keyword: '국립현대미술관', slug: 'march-seoul-exhibition-top5', note: '1위 venue' },
    { keyword: 'DDP', slug: 'march-seoul-exhibition-top5', note: '4위 venue' },
  ];

  console.log('\n  ── 전시 검색 (realmCode=B000) ──');
  for (const { keyword, slug, note } of exhibitionKeywords) {
    console.log(`\n  🔍 "${keyword}" [${note}]...`);
    try {
      const items = await client.searchByPeriod({
        keyword,
        realmCode: 'B000',
        from: '20260201',
        to: '20260430',
        rows: 5,
      });
      if (items.length === 0) {
        console.log(`    → 0 results`);
        results.push({ api: 'CultureInfo', query: keyword, title: '', imageUrl: '', postSlug: slug, note, downloaded: false });
        continue;
      }
      for (const item of items.slice(0, 3)) {
        const hasImg = item.imgUrl && item.imgUrl.length > 10;
        console.log(`    → "${item.title}" @ ${item.place || '?'} | ${item.startDate}~${item.endDate} | img: ${hasImg ? '✅' : '❌'}`);
        if (hasImg) {
          console.log(`      imgUrl: ${item.imgUrl}`);
        }
        results.push({
          api: 'CultureInfo',
          query: keyword,
          title: item.title || '',
          imageUrl: item.imgUrl || '',
          venue: item.place,
          period: `${item.startDate}~${item.endDate}`,
          price: item.price,
          postSlug: slug,
          note: `${note} | ${item.realmName || ''}`,
          downloaded: false,
        });
      }
    } catch (e: any) {
      console.log(`    ❌ Error: ${e.message}`);
    }
  }

  // ── Festival searches (C000=축제) ──
  const festivalKeywords = [
    { keyword: '구례 산수유', slug: 'march-spring-festival-top5', note: '1위 구례' },
    { keyword: '서천 동백', slug: 'march-spring-festival-top5', note: '2위 서천' },
    { keyword: '양평 산수유', slug: 'march-spring-festival-top5', note: '3위 양평' },
    { keyword: '화개장터', slug: 'march-spring-festival-top5', note: '4위 화개' },
    { keyword: '이천 백사', slug: 'march-spring-festival-top5', note: '5위 이천' },
    { keyword: '산수유축제', slug: 'march-spring-festival-top5', note: '산수유 통합' },
    { keyword: '동백꽃축제', slug: 'march-spring-festival-top5', note: '동백 통합' },
    { keyword: '벚꽃축제', slug: 'march-spring-festival-top5', note: '벚꽃 통합' },
  ];

  console.log('\n  ── 축제 검색 (realmCode=C000) ──');
  for (const { keyword, slug, note } of festivalKeywords) {
    console.log(`\n  🔍 "${keyword}" [${note}]...`);
    try {
      const items = await client.searchByPeriod({
        keyword,
        realmCode: 'C000',
        from: '20260201',
        to: '20260430',
        rows: 5,
      });
      if (items.length === 0) {
        console.log(`    → 0 results`);
        results.push({ api: 'CultureInfo', query: keyword, title: '', imageUrl: '', postSlug: slug, note, downloaded: false });
        continue;
      }
      for (const item of items.slice(0, 3)) {
        const hasImg = item.imgUrl && item.imgUrl.length > 10;
        console.log(`    → "${item.title}" @ ${item.place || '?'} | ${item.startDate}~${item.endDate} | img: ${hasImg ? '✅' : '❌'}`);
        if (hasImg) {
          console.log(`      imgUrl: ${item.imgUrl}`);
        }
        results.push({
          api: 'CultureInfo',
          query: keyword,
          title: item.title || '',
          imageUrl: item.imgUrl || '',
          venue: item.place,
          period: `${item.startDate}~${item.endDate}`,
          price: item.price,
          postSlug: slug,
          note: `${note} | ${item.realmName || ''}`,
          downloaded: false,
        });
      }
    } catch (e: any) {
      console.log(`    ❌ Error: ${e.message}`);
    }
  }

  // ── Also try broad search for Seoul March exhibitions ──
  console.log('\n  ── 서울 3월 전시 전체 (sido=서울, B000) ──');
  try {
    const items = await client.searchByArea({
      sido: '서울',
      realmCode: 'B000',
      from: '20260301',
      to: '20260331',
      rows: 30,
    });
    console.log(`    → ${items.length} exhibitions found in Seoul March 2026`);
    const withImg = items.filter(i => i.imgUrl && i.imgUrl.length > 10);
    console.log(`    → ${withImg.length} with images`);
    // Look for our specific exhibitions
    const targets = ['허스트', '세갈', '저드', '울트라', '볼로냐', 'DDP', '국립현대', '리움', '현대카드'];
    for (const item of items) {
      const matchedTarget = targets.find(t => item.title?.includes(t) || item.place?.includes(t));
      if (matchedTarget) {
        const hasImg = item.imgUrl && item.imgUrl.length > 10;
        console.log(`    🎯 MATCH "${item.title}" @ ${item.place} | img: ${hasImg ? '✅' : '❌'} [matched: ${matchedTarget}]`);
        if (hasImg) console.log(`       imgUrl: ${item.imgUrl}`);
      }
    }
  } catch (e: any) {
    console.log(`    ❌ Error: ${e.message}`);
  }
}

// ── 2. KCISA SAC API ─────────────────────────────────────────────────
async function searchSac() {
  console.log('\n\n═══════════════════════════════════════════════════════════');
  console.log('  🎭 KCISA SAC API (예술의전당 종합)');
  console.log('═══════════════════════════════════════════════════════════');

  const { getSacComprehensiveClient } = await import('../src/api/kcisa/index.js');
  const client = getSacComprehensiveClient();
  if (!client) {
    console.log('  ❌ SAC client unavailable (CULTURE_API_KEY missing)');
    return;
  }

  try {
    console.log('\n  🔍 예술의전당 전체 프로그램 검색...');
    const items = await client.searchPerformances({ numOfRows: 50 });
    console.log(`    → ${items.length} items found`);

    // Look for our exhibition: 볼로냐 일러스트 원화전
    const targets = ['볼로냐', 'Bologna', '일러스트', '원화전'];
    let found = false;
    for (const item of items) {
      const matchedTarget = targets.find(t =>
        item.title?.includes(t) || item.description?.includes(t)
      );
      if (matchedTarget) {
        found = true;
        const hasImg = item.imageUrl && item.imageUrl.length > 10;
        console.log(`    🎯 MATCH "${item.title}" | venue: ${item.venue} | img: ${hasImg ? '✅' : '❌'}`);
        if (hasImg) console.log(`       imageUrl: ${item.imageUrl}`);
        if (item.period) console.log(`       period: ${item.period}`);
        if (item.charge) console.log(`       charge: ${item.charge}`);
        results.push({
          api: 'KCISA-SAC',
          query: matchedTarget,
          title: item.title || '',
          imageUrl: item.imageUrl || '',
          venue: item.venue,
          period: item.period,
          price: item.charge,
          postSlug: 'march-seoul-exhibition-top5',
          note: `5위 예술의전당 | SAC match: ${matchedTarget}`,
          downloaded: false,
        });
      }
    }
    if (!found) {
      console.log('    → No 볼로냐/일러스트 matches in SAC data');
      // Show first few items for debugging
      console.log('    Latest SAC items:');
      for (const item of items.slice(0, 5)) {
        console.log(`      - "${item.title}" @ ${item.venue || '?'} | img: ${item.imageUrl ? '✅' : '❌'}`);
      }
    }
  } catch (e: any) {
    console.log(`  ❌ SAC Error: ${e.message}`);
  }
}

// ── 3. KOPIS API ─────────────────────────────────────────────────────
async function searchKopis() {
  console.log('\n\n═══════════════════════════════════════════════════════════');
  console.log('  🎪 KOPIS API (공연예술통합전산망)');
  console.log('═══════════════════════════════════════════════════════════');

  const { getKopisClient } = await import('../src/api/kopis/index.js');
  const client = getKopisClient();
  if (!client) {
    console.log('  ❌ KOPIS client unavailable (KOPIS_API_KEY missing)');
    return;
  }

  // KOPIS is mainly for performances but let's try
  const keywords = ['데미안 허스트', '볼로냐', '울트라백화점'];
  for (const keyword of keywords) {
    console.log(`\n  🔍 "${keyword}"...`);
    try {
      const items = await client.searchPerformances({
        stdate: '20260201',
        eddate: '20260430',
        shprfnm: keyword,
        rows: 5,
      });
      console.log(`    → ${items.length} results`);
      for (const item of items.slice(0, 3)) {
        const p = item as any;
        console.log(`    → "${p.prfnm}" @ ${p.fcltynm} | poster: ${p.poster ? '✅' : '❌'}`);
        if (p.poster) console.log(`      poster: ${p.poster}`);
        results.push({
          api: 'KOPIS',
          query: keyword,
          title: p.prfnm || '',
          imageUrl: p.poster || '',
          venue: p.fcltynm,
          period: `${p.prfpdfrom}~${p.prfpdto}`,
          postSlug: 'march-seoul-exhibition-top5',
          note: `KOPIS match`,
          downloaded: false,
        });
      }
    } catch (e: any) {
      console.log(`    ❌ Error: ${e.message}`);
    }
  }
}

// ── 4. KTO Additional Searches ───────────────────────────────────────
async function searchKtoAdditional() {
  console.log('\n\n═══════════════════════════════════════════════════════════');
  console.log('  🏔️ KTO Additional Searches (남은 갭 보강)');
  console.log('═══════════════════════════════════════════════════════════');

  const { getDataGoKrClient } = await import('../src/api/data-go-kr/index.js');
  const client = getDataGoKrClient();

  const additionalTargets = [
    // Exhibition gaps
    { keyword: '동대문', typeId: '12', file: 'kto-march-exhibition-dongdaemun.jpg', slug: 'march-seoul-exhibition-top5', note: '4위 DDP 주변' },
    { keyword: '한남동거리', typeId: '12', file: 'kto-march-exhibition-hannam-st.jpg', slug: 'march-seoul-exhibition-top5', note: '2위 리움 주변' },
    // Festival gaps
    { keyword: '화개장터', typeId: '12', file: 'kto-march-festival-hwagae-retry.jpg', slug: 'march-spring-festival-top5', note: '4위 화개장터 retry' },
    { keyword: '십리벚꽃길', typeId: '12', file: 'kto-march-festival-sipri.jpg', slug: 'march-spring-festival-top5', note: '4위 십리벚꽃길' },
    { keyword: '쌍계사하동', typeId: '12', file: 'kto-march-festival-ssanggyesa-hadong.jpg', slug: 'march-spring-festival-top5', note: '4위 쌍계사(하동)' },
    { keyword: '양평개군', typeId: '12', file: 'kto-march-festival-yangpyeong-gagun.jpg', slug: 'march-spring-festival-top5', note: '3위 양평 개군면' },
    { keyword: '백사면', typeId: '12', file: 'kto-march-festival-baeksa.jpg', slug: 'march-spring-festival-top5', note: '5위 이천 백사면' },
  ];

  for (const target of additionalTargets) {
    if (existsSync(join(IMG_DIR, target.file))) {
      console.log(`\n  ⏭️ ${target.file} already exists — skip`);
      continue;
    }
    console.log(`\n  🔍 "${target.keyword}" (typeId=${target.typeId}) [${target.note}]...`);
    try {
      const items = await client.searchKeyword(target.keyword, {
        contentTypeId: target.typeId,
        numOfRows: 5,
      });
      if (items.length === 0) {
        console.log(`    → 0 results`);
        results.push({ api: 'KTO', query: target.keyword, title: '', imageUrl: '', postSlug: target.slug, note: target.note, downloaded: false });
        continue;
      }
      const withImg = items.filter((r: any) => r.firstimage);
      const best = (withImg.length > 0 ? withImg[0] : items[0]) as any;
      console.log(`    → "${best.title}" (id: ${best.contentid}) | img: ${best.firstimage ? '✅' : '❌'}`);

      let imageUrl = best.firstimage || '';
      if (!imageUrl) {
        try {
          const images = await client.detailImage(best.contentid);
          if (images.length > 0) imageUrl = (images[0] as any).originimgurl || '';
        } catch {}
      }

      if (imageUrl) {
        const ok = await downloadImage(imageUrl, target.file);
        results.push({
          api: 'KTO',
          query: target.keyword,
          title: best.title,
          imageUrl,
          postSlug: target.slug,
          note: target.note,
          downloaded: ok,
          outputFile: target.file,
        });
      } else {
        console.log(`    → No image found`);
        results.push({ api: 'KTO', query: target.keyword, title: best.title, imageUrl: '', postSlug: target.slug, note: target.note, downloaded: false });
      }
    } catch (e: any) {
      console.log(`    ❌ Error: ${e.message}`);
    }
  }
}

// ── Main ─────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🚀 Multi-API March TOP 5 Search — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`📡 API filter: ${API_FILTER}`);
  console.log(`📁 Output: ${IMG_DIR}\n`);

  if (API_FILTER === 'all' || API_FILTER === 'culture') await searchCultureInfo();
  if (API_FILTER === 'all' || API_FILTER === 'sac') await searchSac();
  if (API_FILTER === 'all' || API_FILTER === 'kopis') await searchKopis();
  if (API_FILTER === 'all' || API_FILTER === 'kto') await searchKtoAdditional();

  // ── Summary ─────────────────────────────────────────────────────
  console.log('\n\n══════════════════════════════════════════════════════════');
  console.log('  📋 FINAL RESULTS SUMMARY');
  console.log('══════════════════════════════════════════════════════════');

  const byApi = new Map<string, SearchResult[]>();
  for (const r of results) {
    const list = byApi.get(r.api) || [];
    list.push(r);
    byApi.set(r.api, list);
  }

  for (const [api, items] of byApi) {
    const withImg = items.filter(i => i.imageUrl);
    console.log(`\n  📡 ${api}: ${withImg.length}/${items.length} with images`);
    for (const r of items) {
      const status = r.imageUrl ? '✅' : '❌';
      const dl = r.downloaded ? ' [DL]' : '';
      console.log(`     ${status} "${r.query}" → "${r.title?.substring(0, 40)}" ${r.venue ? `@ ${r.venue}` : ''}${dl}`);
    }
  }

  // ── Downloadable images ─────────────────────────────────────────
  const downloadable = results.filter(r => r.imageUrl && !r.downloaded);
  if (downloadable.length > 0) {
    console.log('\n\n  📥 Downloadable images (not yet saved):');
    for (const r of downloadable) {
      console.log(`     ${r.api} | "${r.title?.substring(0, 30)}" | ${r.imageUrl?.substring(0, 80)}...`);
    }
  }

  // ── Coverage assessment ─────────────────────────────────────────
  console.log('\n\n  🎯 Coverage Assessment:');

  const exhibitSlug = 'march-seoul-exhibition-top5';
  const festSlug = 'march-spring-festival-top5';

  const exhibitResults = results.filter(r => r.postSlug === exhibitSlug && r.imageUrl);
  const festResults = results.filter(r => r.postSlug === festSlug && r.imageUrl);

  console.log(`\n  📝 Exhibition TOP 5: ${exhibitResults.length} images found`);
  const exhibitTargets = ['허스트', 'MMCA', '세갈', '리움', '저드', '이태원', '울트라', 'DDP', '볼로냐', '예술의전당'];
  for (const t of exhibitTargets) {
    const found = exhibitResults.find(r =>
      r.title?.includes(t) || r.query?.includes(t) || r.note?.includes(t)
    );
    console.log(`     ${found ? '✅' : '❌'} ${t}: ${found ? `"${found.title?.substring(0, 30)}" (${found.api})` : 'NOT FOUND'}`);
  }

  console.log(`\n  📝 Festival TOP 5: ${festResults.length} images found`);
  const festTargets = ['구례', '서천', '양평', '화개', '이천', '산수유', '동백'];
  for (const t of festTargets) {
    const found = festResults.find(r =>
      r.title?.includes(t) || r.query?.includes(t) || r.note?.includes(t)
    );
    console.log(`     ${found ? '✅' : '❌'} ${t}: ${found ? `"${found.title?.substring(0, 30)}" (${found.api})` : 'NOT FOUND'}`);
  }
}

main().catch(console.error);
