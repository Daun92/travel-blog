/**
 * KTO Image Replace — add real KTO photos to posts with 0 KTO images
 *
 * Usage:
 *   npx tsx scripts/kto-image-replace.mts              # Run all targets
 *   npx tsx scripts/kto-image-replace.mts --dry-run     # Preview only (no downloads)
 *   npx tsx scripts/kto-image-replace.mts --batch 1     # Run specific batch
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
}

// ── Batch 1: Travel Priority 1 (주요 관광지) ───────────────────────
const batch1: SearchTarget[] = [
  // 통영
  { keyword: '동피랑벽화마을', contentTypeId: '12', outputFile: 'kto-tongyeong-dongpirang.jpg', postSlug: '2026-02-07-tongyeong', batch: 1 },
  { keyword: '세병관', contentTypeId: '12', outputFile: 'kto-tongyeong-sebyeonggwan.jpg', postSlug: '2026-02-07-tongyeong', batch: 1 },
  // 수원 화성
  { keyword: '수원화성', contentTypeId: '12', outputFile: 'kto-suwon-hwaseong.jpg', postSlug: '2026-02-07-2-7', batch: 1 },
  { keyword: '방화수류정', contentTypeId: '12', outputFile: 'kto-suwon-banghwa.jpg', postSlug: '2026-02-07-2-7', batch: 1 },
  // 북한산
  { keyword: '북한산', contentTypeId: '12', outputFile: 'kto-bukhansan-1.jpg', postSlug: '2026-02-06-bukhansan', batch: 1 },
  // 서울 여행
  { keyword: '경복궁', contentTypeId: '12', outputFile: 'kto-seoul-gyeongbokgung.jpg', postSlug: '2026-02-06-seoul-travel', batch: 1 },
  { keyword: '광장시장', contentTypeId: '12', outputFile: 'kto-seoul-gwangjang.jpg', postSlug: '2026-02-06-seoul-travel', batch: 1 },
];

// ── Batch 2: Travel Priority 2 ─────────────────────────────────────
const batch2: SearchTarget[] = [
  // 강릉
  { keyword: '오죽헌', contentTypeId: '12', outputFile: 'kto-gangneung-ojukheon.jpg', postSlug: '2026-02-10-post-1', batch: 2 },
  { keyword: '경포대', contentTypeId: '12', outputFile: 'kto-gangneung-gyeongpo.jpg', postSlug: '2026-02-10-post-1', batch: 2 },
  // 부산 산복도로
  { keyword: '감천문화마을', contentTypeId: '12', outputFile: 'kto-busan-gamcheon.jpg', postSlug: '2026-02-10-post-2', batch: 2 },
  { keyword: '깡깡이마을', contentTypeId: '12', outputFile: 'kto-busan-gganggangi.jpg', postSlug: '2026-02-10-post-2', batch: 2 },
  { keyword: '동래읍성', contentTypeId: '12', outputFile: 'kto-busan-dongnae.jpg', postSlug: '2026-02-10-post-2', batch: 2 },
  // 발렌타인 TOP5
  { keyword: '광안리해수욕장', contentTypeId: '12', outputFile: 'kto-valentine-gwanganli.jpg', postSlug: '2026-02-09-top-5', batch: 2 },
  // 오지 탐험 TOP5
  { keyword: '백룡동굴', contentTypeId: '12', outputFile: 'kto-oji-baekryong.jpg', postSlug: '2026-02-07-top-5', batch: 2 },
  { keyword: '울릉도', contentTypeId: '12', outputFile: 'kto-oji-ulleungdo.jpg', postSlug: '2026-02-07-top-5', batch: 2 },
];

// ── Batch 3: 서울 근교 + Culture ────────────────────────────────────
const batch3: SearchTarget[] = [
  // 서울 근교 당일치기
  { keyword: '송도센트럴파크', contentTypeId: '12', outputFile: 'kto-daytrip-songdo.jpg', postSlug: '2026-02-06-5', batch: 3 },
  { keyword: '헤이리예술마을', contentTypeId: '12', outputFile: 'kto-daytrip-heyri.jpg', postSlug: '2026-02-06-5', batch: 3 },
  { keyword: '물의정원', contentTypeId: '12', outputFile: 'kto-daytrip-water-garden.jpg', postSlug: '2026-02-06-5', batch: 3 },
  // 성수동 (culture)
  { keyword: '서울숲', contentTypeId: '12', outputFile: 'kto-seongsu-seoulforest.jpg', postSlug: '2026-02-07-vs', batch: 3 },
  // 공예 체험 (culture)
  { keyword: '국립현대미술관 서울', contentTypeId: '14', outputFile: 'kto-craft-mmca.jpg', postSlug: '2026-02-08-craft-experience', batch: 3 },
  { keyword: '예술의전당', contentTypeId: '14', outputFile: 'kto-craft-artscenter.jpg', postSlug: '2026-02-08-craft-experience', batch: 3 },
];

// ── Batch 4: Retries with alternative keywords ─────────────────────
const batch4: SearchTarget[] = [
  // 통영 — 동피랑 재시도
  { keyword: '통영 동피랑', contentTypeId: '12', outputFile: 'kto-tongyeong-dongpirang.jpg', postSlug: '2026-02-07-tongyeong', batch: 4 },
  // 서울 — 광장시장 재시도
  { keyword: '남대문시장', contentTypeId: '12', outputFile: 'kto-seoul-namdaemun.jpg', postSlug: '2026-02-06-seoul-travel', batch: 4 },
  // 강릉 — 오죽헌 재시도
  { keyword: '강릉 오죽헌', contentTypeId: '12', outputFile: 'kto-gangneung-ojukheon.jpg', postSlug: '2026-02-10-post-1', batch: 4 },
  // 부산 — 깡깡이 재시도
  { keyword: '영도대교', contentTypeId: '12', outputFile: 'kto-busan-yeongdo.jpg', postSlug: '2026-02-10-post-2', batch: 4 },
  // 서울 근교 — 재시도
  { keyword: '인천 송도', contentTypeId: '12', outputFile: 'kto-daytrip-songdo.jpg', postSlug: '2026-02-06-5', batch: 4 },
  { keyword: '헤이리', contentTypeId: '12', outputFile: 'kto-daytrip-heyri.jpg', postSlug: '2026-02-06-5', batch: 4 },
  { keyword: '팔당', contentTypeId: '12', outputFile: 'kto-daytrip-paldang.jpg', postSlug: '2026-02-06-5', batch: 4 },
  // 공예 — 예술의전당 재시도 (서울)
  { keyword: '서울 예술의전당', contentTypeId: '14', outputFile: 'kto-craft-artscenter.jpg', postSlug: '2026-02-08-craft-experience', batch: 4 },
];

// ── Batch 5: KTO:0 포스트 보강 (신규 6개 포스트) ─────────────────────
const batch5: SearchTarget[] = [
  // 전주 한옥마을 직장인 후기
  { keyword: '전주한옥마을', contentTypeId: '12', outputFile: 'kto-jeonju-hanok-weekend.jpg', postSlug: '2026-02-07-2-3', batch: 5 },
  { keyword: '국립전주박물관', contentTypeId: '14', outputFile: 'kto-jeonju-museum.jpg', postSlug: '2026-02-07-2-3', batch: 5 },
  // 군산 시간여행 1박2일
  { keyword: '선유도', contentTypeId: '12', outputFile: 'kto-gunsan-seonyudo.jpg', postSlug: '2026-02-08-12', batch: 5 },
  { keyword: '군산근대역사박물관', contentTypeId: '14', outputFile: 'kto-gunsan-museum.jpg', postSlug: '2026-02-08-12', batch: 5 },
  // 인천 개항장 차이나타운
  { keyword: '인천차이나타운', contentTypeId: '12', outputFile: 'kto-incheon-chinatown.jpg', postSlug: '2026-02-08-90', batch: 5 },
  { keyword: '월미도', contentTypeId: '12', outputFile: 'kto-incheon-wolmido.jpg', postSlug: '2026-02-08-90', batch: 5 },
  // 안동 하회마을 유교 문화
  { keyword: '하회마을', contentTypeId: '12', outputFile: 'kto-andong-hahoe.jpg', postSlug: '2026-02-08-andong-hahoe', batch: 5 },
  { keyword: '안동 봉정사', contentTypeId: '12', outputFile: 'kto-andong-bongjeongsa.jpg', postSlug: '2026-02-08-andong-hahoe', batch: 5 },
  // 속초 양양 겨울 바다 TOP 5
  { keyword: '속초 중앙시장', contentTypeId: '12', outputFile: 'kto-sokcho-market.jpg', postSlug: '2026-02-08-top-5', batch: 5 },
  { keyword: '설악산', contentTypeId: '12', outputFile: 'kto-sokcho-seorak.jpg', postSlug: '2026-02-08-top-5', batch: 5 },
  // 익선동
  { keyword: '익선동', contentTypeId: '12', outputFile: 'kto-ikseondong.jpg', postSlug: '2026-02-07-post', batch: 5 },
  { keyword: '종묘', contentTypeId: '12', outputFile: 'kto-ikseondong-jongmyo.jpg', postSlug: '2026-02-07-post', batch: 5 },
];

// ── Batch 6: 나머지 KTO:0 + 보강 대상 포스트 ──────────────────────
const batch6: SearchTarget[] = [
  // 서울 전시 후기 (KTO:0)
  { keyword: '국립현대미술관 서울', contentTypeId: '14', outputFile: 'kto-exhibit-mmca-seoul.jpg', postSlug: '2026-02-08-2', batch: 6 },
  { keyword: '예술의전당', contentTypeId: '14', outputFile: 'kto-exhibit-artscenter.jpg', postSlug: '2026-02-08-2', batch: 6 },
  // 직장인 주말 여가 TOP 5 (KTO:0)
  { keyword: '국립중앙박물관', contentTypeId: '14', outputFile: 'kto-weekend-nationalmuseum.jpg', postSlug: '2026-02-07-2-top-5', batch: 6 },
  // 인디 공연장 TOP 6 (KTO:0) — 낮은 확률이지만 시도
  { keyword: 'KT&G 상상마당', contentTypeId: '14', outputFile: 'kto-indie-sangsangmadang.jpg', postSlug: '2026-02-08-indie-venue', batch: 6 },
  // 전통주 양조장 (vk-1개 보강)
  { keyword: '강릉선교장', contentTypeId: '12', outputFile: 'kto-liquor-seongyojang.jpg', postSlug: '2026-02-08-traditional-liquor', batch: 6 },
  // 목포 근대역사 (kto-1개 보강)
  { keyword: '유달산', contentTypeId: '12', outputFile: 'kto-mokpo-yudalsan.jpg', postSlug: '2026-02-11-post', batch: 6 },
  // 여수 밤바다 (kto-1개 보강)
  { keyword: '여수 해상케이블카', contentTypeId: '12', outputFile: 'kto-yeosu-cablecar.jpg', postSlug: '2026-02-05-yeosu-night', batch: 6 },
];

// ── Batch 6b: Retries with alternative keywords ────────────────────
const batch6b: SearchTarget[] = [
  // 서울 예술의전당 재시도 (이전: "예술의전당" → 계룡문화예술의전당 미스매치)
  { keyword: '서울예술의전당', contentTypeId: '14', outputFile: 'kto-exhibit-artscenter.jpg', postSlug: '2026-02-08-2', batch: 6 },
  // 강릉선교장 재시도 (이전: "강릉선교장" → 결과 없음)
  { keyword: '선교장', contentTypeId: '12', outputFile: 'kto-liquor-seongyojang.jpg', postSlug: '2026-02-08-traditional-liquor', batch: 6 },
  // 유달산 재시도 (이전: 이미지 URL 없음)
  { keyword: '유달산공원', contentTypeId: '12', outputFile: 'kto-mokpo-yudalsan.jpg', postSlug: '2026-02-11-post', batch: 6 },
];

// ── Batch 7: 워크플로우 시험 (리움미술관) ────────────────────────────
const batch7: SearchTarget[] = [
  { keyword: '리움미술관', contentTypeId: '14', outputFile: 'kto-leeum-museum.jpg', postSlug: '2026-02-05-post', batch: 7 },
  // 재시도: 구명칭 + 주변 관광지
  { keyword: '삼성미술관', contentTypeId: '14', outputFile: 'kto-leeum-samsung.jpg', postSlug: '2026-02-05-post', batch: 7 },
  { keyword: '한남동', contentTypeId: '12', outputFile: 'kto-leeum-hannam.jpg', postSlug: '2026-02-05-post', batch: 7 },
];

// ── Batch 8: 오지 탐험 TOP 5 보강 (3개 섹션 KTO 이미지 없음) ──────
const batch8: SearchTarget[] = [
  // 영양 자작나무 숲
  { keyword: '영양자작나무숲', contentTypeId: '12', outputFile: 'kto-oji-birch-forest.jpg', postSlug: '2026-02-07-top-5', batch: 8 },
  // 인제 아침가리 계곡
  { keyword: '아침가리계곡', contentTypeId: '12', outputFile: 'kto-oji-achimgari.jpg', postSlug: '2026-02-07-top-5', batch: 8 },
  // 삼척 무건리 이끼폭포
  { keyword: '이끼폭포', contentTypeId: '12', outputFile: 'kto-oji-moss-falls.jpg', postSlug: '2026-02-07-top-5', batch: 8 },
];

// ── Batch 8b: 오지 탐험 재시도 (대체 키워드) ─────────────────────────
const batch8b: SearchTarget[] = [
  // 영양 자작나무 숲 — 대체 키워드
  { keyword: '죽파리자작나무', contentTypeId: '12', outputFile: 'kto-oji-birch-forest.jpg', postSlug: '2026-02-07-top-5', batch: 8 },
  { keyword: '영양 수비면', contentTypeId: '12', outputFile: 'kto-oji-birch-forest.jpg', postSlug: '2026-02-07-top-5', batch: 8 },
  // 아침가리 계곡 — 대체 키워드
  { keyword: '인제 아침가리', contentTypeId: '12', outputFile: 'kto-oji-achimgari.jpg', postSlug: '2026-02-07-top-5', batch: 8 },
  { keyword: '방동약수', contentTypeId: '12', outputFile: 'kto-oji-achimgari.jpg', postSlug: '2026-02-07-top-5', batch: 8 },
  // 무건리 이끼폭포 — 대체 키워드
  { keyword: '무건리', contentTypeId: '12', outputFile: 'kto-oji-moss-falls.jpg', postSlug: '2026-02-07-top-5', batch: 8 },
  { keyword: '삼척 도계', contentTypeId: '12', outputFile: 'kto-oji-moss-falls.jpg', postSlug: '2026-02-07-top-5', batch: 8 },
];

const ALL_TARGETS = [...batch1, ...batch2, ...batch3, ...batch4, ...batch5, ...batch6, ...batch6b, ...batch7, ...batch8, ...batch8b];

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

async function main() {
  const targets = BATCH_NUM > 0
    ? ALL_TARGETS.filter(t => t.batch === BATCH_NUM)
    : ALL_TARGETS;

  console.log(`\n🚀 KTO Image Replace — ${DRY_RUN ? 'DRY RUN' : 'LIVE'} mode`);
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
  }> = [];

  for (const target of targets) {
    console.log(`\n🔍 [${target.postSlug}] "${target.keyword}" 검색...`);

    // Skip if file already exists
    if (existsSync(join(IMG_DIR, target.outputFile))) {
      console.log(`  ⏭️ ${target.outputFile} 이미 존재 — 건너뜀`);
      results.push({ ...target, contentId: 'existing', title: 'existing', imageUrl: 'existing', success: true });
      continue;
    }

    try {
      // Step 1: Search
      let searchResults = await client.searchKeyword(target.keyword, {
        contentTypeId: target.contentTypeId,
        numOfRows: 10,
      });

      if (searchResults.length === 0) {
        // Retry with first word only
        const firstWord = target.keyword.split(/[\s·]/)[0];
        if (firstWord !== target.keyword) {
          console.log(`  검색 결과 없음 → "${firstWord}" 재검색...`);
          searchResults = await client.searchKeyword(firstWord, {
            contentTypeId: target.contentTypeId,
            numOfRows: 10,
          });
        }
      }

      if (searchResults.length === 0) {
        console.log(`  ❌ 검색 결과 없음`);
        results.push({ ...target, contentId: '', title: '', imageUrl: '', success: false });
        continue;
      }

      // Pick best match — prefer results with firstimage
      const withImage = searchResults.filter((r: any) => r.firstimage);
      const best = (withImage.length > 0 ? withImage[0] : searchResults[0]) as any;
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
        results.push({ ...target, contentId, title, imageUrl: '', success: false });
        continue;
      }

      // Step 5: Download
      console.log(`  이미지: ${imageUrl.substring(0, 80)}...`);
      const success = await downloadImage(imageUrl, target.outputFile);
      results.push({ ...target, contentId, title, imageUrl, success });

    } catch (e: any) {
      console.log(`  ❌ 검색 에러: ${e.message}`);
      results.push({ ...target, contentId: '', title: '', imageUrl: '', success: false });
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
      console.log(`     ${status} ${r.keyword} → ${r.outputFile}`);
    }
  }

  console.log('\n' + '─'.repeat(80));
  const total = results.length;
  const success = results.filter(r => r.success).length;
  console.log(`\n🎯 전체: ${success}/${total} 성공`);

  // Output registry entries for successful downloads
  const newEntries = results.filter(r => r.success && r.contentId !== 'existing');
  if (newEntries.length > 0) {
    console.log('\n📝 image-registry.json 추가 엔트리:');
    console.log('[');
    for (const r of newEntries) {
      console.log(JSON.stringify({
        source: 'kto',
        ktoContentId: r.contentId,
        ktoUrl: r.imageUrl,
        postSlug: r.postSlug,
        query: r.keyword,
        usedAt: new Date().toISOString(),
      }) + ',');
    }
    console.log(']');
  }
}

main().catch(console.error);
