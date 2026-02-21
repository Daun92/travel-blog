/**
 * 5대 궁궐 KTO detailImage2 조회 + 다운로드
 * 일회용 스크립트: 경복궁·창덕궁·덕수궁·창경궁·경희궁
 */
import { config } from 'dotenv'; config();
import { getDataGoKrClient } from '../src/api/data-go-kr/index.js';
import * as fs from 'fs';
import * as path from 'path';

const SLUG = '2026-02-20-seoul-five-palaces-spring-tour-guide';
const IMG_DIR = 'blog/static/images';

// 알려진 contentId + 검색 키워드
const PALACES = [
  { name: '경복궁', contentId: '126508', keyword: '경복궁' },
  { name: '창덕궁', contentId: '127642', keyword: '창덕궁' },
  { name: '덕수궁', contentId: '126509', keyword: '덕수궁' },
  { name: '창경궁', contentId: null,     keyword: '창경궁' },
  { name: '경희궁', contentId: null,     keyword: '경희궁' },
];

async function downloadImage(url: string, filename: string): Promise<boolean> {
  const filepath = path.join(IMG_DIR, filename);
  const res = await fetch(url);
  if (!res.ok) { console.log(`  FAIL: ${res.status} ${url}`); return false; }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 5000) { console.log(`  SKIP: too small (${buf.length}B) ${url}`); return false; }
  fs.writeFileSync(filepath, buf);
  console.log(`  OK: ${filename} (${Math.round(buf.length / 1024)}KB)`);
  return true;
}

async function main() {
  const client = getDataGoKrClient();
  if (!client) { console.error('KTO_API_KEY not set'); process.exit(1); }

  const results: Record<string, { contentId: string; firstimage: string; detailImages: string[]; address: string }> = {};

  for (const palace of PALACES) {
    console.log(`\n${'='.repeat(40)}`);
    console.log(`=== ${palace.name} ===`);

    // Step 1: contentId 확보 (없으면 검색)
    let contentId = palace.contentId;
    let address = '';
    let firstimage = '';

    if (!contentId) {
      console.log(`  Searching: ${palace.keyword}`);
      const searchResults = await client.searchKeyword(palace.keyword, { contentTypeId: '12', numOfRows: 5 });
      for (const r of searchResults) {
        const img = r.firstimage ? 'Y' : 'N';
        console.log(`  [${img}] ${r.contentid} ${r.title} — ${r.addr1 || 'N/A'}`);
      }
      // 정확한 이름 매칭 우선
      const exact = searchResults.find(r => r.title === palace.name);
      const partial = searchResults.find(r => r.title?.includes(palace.name));
      const match = exact || partial;
      if (match) {
        contentId = String(match.contentid);
        address = match.addr1 || '';
        firstimage = match.firstimage || '';
        console.log(`  → matched: ${match.title} (${contentId})`);
      } else {
        console.log(`  → NO MATCH for ${palace.name}`);
        continue;
      }
    } else {
      // 알려진 contentId — detailCommon으로 기본 정보 확보
      console.log(`  Known contentId: ${contentId}`);
      try {
        const detail = await client.detailCommon(contentId);
        address = detail?.addr1 || '';
        firstimage = detail?.firstimage || '';
        console.log(`  title: ${detail?.title}, addr: ${address}`);
      } catch (e) {
        console.log(`  detailCommon error: ${e}`);
      }
    }

    // Step 2: detailImage2 조회
    console.log(`  Fetching detailImage2 for ${contentId}...`);
    const imgs = await client.detailImage(contentId);
    console.log(`  Found ${imgs.length} detail images`);

    const detailUrls: string[] = [];
    for (const img of imgs) {
      const url = img.originimgurl || img.smallimageurl || '';
      if (url) {
        detailUrls.push(url);
        console.log(`  📷 ${url.substring(url.lastIndexOf('/') + 1)}`);
      }
    }

    results[palace.name] = {
      contentId: contentId!,
      firstimage,
      detailImages: detailUrls,
      address,
    };
  }

  // Step 3: 선별 다운로드
  console.log(`\n${'='.repeat(40)}`);
  console.log('=== DOWNLOADING SELECTED IMAGES ===\n');

  // kto-SLUG-5.jpg부터 시작 (1=간송, 2=감로암, 3=경복궁, 4=창덕궁 이미 존재)
  let idx = 5;

  // 경복궁: 기존 kto-3(42KB 저해상도)을 detailImage로 교체 시도
  const gb = results['경복궁'];
  if (gb && gb.detailImages.length > 0) {
    console.log('[경복궁] detailImage 교체 시도...');
    // 야경/근정전 우선, 없으면 첫 번째
    const nightUrl = gb.detailImages.find(u => u.includes('night') || u.includes('야경')) || gb.detailImages[0];
    await downloadImage(nightUrl, `kto-${SLUG}-3-hq.jpg`);
    // 추가 시점 1장
    if (gb.detailImages.length > 1) {
      await downloadImage(gb.detailImages[1], `kto-${SLUG}-${idx}.jpg`);
      idx++;
    }
  }

  // 창덕궁: 기존 kto-4 유지 + 추가 시점
  const cd = results['창덕궁'];
  if (cd && cd.detailImages.length > 0) {
    console.log('[창덕궁] 추가 시점 다운로드...');
    await downloadImage(cd.detailImages[0], `kto-${SLUG}-${idx}.jpg`);
    idx++;
  } else if (cd && cd.firstimage) {
    // firstimage라도 확보
    console.log('[창덕궁] firstimage 사용...');
  }

  // 덕수궁: 신규 — 석조전/중화전
  const ds = results['덕수궁'];
  if (ds) {
    console.log('[덕수궁] 신규 다운로드...');
    const src = ds.detailImages.length > 0 ? ds.detailImages[0] : ds.firstimage;
    if (src) {
      await downloadImage(src, `kto-${SLUG}-${idx}.jpg`);
      idx++;
    }
  }

  // 창경궁: 신규
  const cg = results['창경궁'];
  if (cg) {
    console.log('[창경궁] 신규 다운로드...');
    const src = cg.detailImages.length > 0 ? cg.detailImages[0] : cg.firstimage;
    if (src) {
      await downloadImage(src, `kto-${SLUG}-${idx}.jpg`);
      idx++;
    }
  }

  // 경희궁: 신규
  const gh = results['경희궁'];
  if (gh) {
    console.log('[경희궁] 신규 다운로드...');
    const src = gh.detailImages.length > 0 ? gh.detailImages[0] : gh.firstimage;
    if (src) {
      await downloadImage(src, `kto-${SLUG}-${idx}.jpg`);
      idx++;
    }
  }

  // Summary
  console.log(`\n${'='.repeat(40)}`);
  console.log('=== SUMMARY ===');
  for (const [name, data] of Object.entries(results)) {
    console.log(`${name}: contentId=${data.contentId}, detail=${data.detailImages.length}장, addr=${data.address}`);
  }
  console.log(`Total downloaded: idx reached ${idx} (started at 5)`);

  // 결과를 JSON으로 저장 (이후 registry 업데이트용)
  fs.writeFileSync('data/kto-palace-detail-results.json', JSON.stringify(results, null, 2));
  console.log('\nResults saved to data/kto-palace-detail-results.json');
}

main().catch(e => { console.error(e); process.exit(1); });
