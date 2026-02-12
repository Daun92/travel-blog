/**
 * KTO Image Audit — fetch candidate images for mismatched posts
 *
 * Mismatches identified:
 * 1. 부산 busan-2: "롯데아울렛" image in 광복로 트리축제 section
 * 2. 강릉 gangneung-2: "경포 누정" image in 굴산사지 section
 * 3. 을지로 12-2: "철제가구거리" image in 지하상가 section
 */
import { config } from 'dotenv';
config();

import { getDataGoKrClient } from '../src/api/data-go-kr/index.js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const AUDIT_DIR = 'blog/static/images/audit';
if (!existsSync(AUDIT_DIR)) mkdirSync(AUDIT_DIR, { recursive: true });

async function downloadImage(url: string, filename: string): Promise<void> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    const path = join(AUDIT_DIR, filename);
    writeFileSync(path, buffer);
    console.log(`  ✅ ${filename} (${(buffer.length / 1024).toFixed(0)}KB)`);
  } catch (e: any) {
    console.log(`  ❌ ${filename}: ${e.message}`);
  }
}

async function main() {
  const client = getDataGoKrClient();

  // 1. 광복로 겨울빛 트리축제 (contentId: 3576410)
  console.log('\n📸 1. 광복로 트리축제 이미지 (contentId: 3576410)');
  try {
    const festivalImages = await client.detailImage('3576410');
    console.log(`  Found ${festivalImages.length} images`);
    for (let i = 0; i < festivalImages.length; i++) {
      const img = festivalImages[i] as any;
      const url = img.originimgurl || img.originImgUrl;
      if (url) await downloadImage(url, `festival-${i + 1}.jpg`);
    }
  } catch (e: any) {
    console.log(`  ❌ API error: ${e.message}`);
    // Fallback: use firstimage from detailCommon2 cache
    console.log('  Trying firstimage from cache...');
    await downloadImage(
      'http://tong.visitkorea.or.kr/cms/resource/05/3576405_image2_1.JPG',
      'festival-first.jpg'
    );
  }

  // 2. 강릉 굴산사지 (contentId: 125769) - already in cache
  console.log('\n📸 2. 강릉 굴산사지 이미지 (contentId: 125769)');
  const gulsanImages = [
    { url: 'http://tong.visitkorea.or.kr/cms/resource/22/3025022_image2_1.jpg', name: 'gulsan-first.jpg' },
    { url: 'http://tong.visitkorea.or.kr/cms/resource/23/3025023_image2_1.jpg', name: 'gulsan-2.jpg' },
    { url: 'http://tong.visitkorea.or.kr/cms/resource/24/3025024_image2_1.jpg', name: 'gulsan-3.jpg' },
    { url: 'http://tong.visitkorea.or.kr/cms/resource/25/3025025_image2_1.jpg', name: 'gulsan-4.jpg' },
    { url: 'http://tong.visitkorea.or.kr/cms/resource/28/3025028_image2_1.jpg', name: 'gulsan-7.jpg' },
    { url: 'http://tong.visitkorea.or.kr/cms/resource/33/3025033_image2_1.jpg', name: 'gulsan-12.jpg' },
    { url: 'http://tong.visitkorea.or.kr/cms/resource/34/3025034_image2_1.jpg', name: 'gulsan-13.jpg' },
  ];
  for (const img of gulsanImages) {
    await downloadImage(img.url, img.name);
  }

  // 3. 을지로 지하상가 / 세운상가 관련
  console.log('\n📸 3. 을지로 지하상가/세운상가 이미지');

  // 3a. Search for 을지로 지하상가
  try {
    const searchResult = await client.searchKeyword('을지로 지하상가', {
      contentTypeId: '12',
      numOfRows: 5,
    });
    console.log(`  Search "을지로 지하상가": ${searchResult.length} results`);
    for (const item of searchResult) {
      const ci = (item as any).contentid;
      const title = (item as any).title;
      console.log(`    - ${title} (${ci})`);
      if ((item as any).firstimage) {
        await downloadImage((item as any).firstimage, `euljiro-search-${ci}.jpg`);
      }
    }
  } catch (e: any) {
    console.log(`  Search error: ${e.message}`);
  }

  // 3b. 세운상가 images from cache (Type1 copyright)
  const sewoonImages = [
    { url: 'http://tong.visitkorea.or.kr/cms/resource/59/3569459_image2_1.jpg', name: 'sewoon-3.jpg' },
    { url: 'http://tong.visitkorea.or.kr/cms/resource/61/3569461_image2_1.jpg', name: 'sewoon-2.jpg' },
    { url: 'http://tong.visitkorea.or.kr/cms/resource/70/3569470_image2_1.jpg', name: 'sewoon-6.jpg' },
  ];
  for (const img of sewoonImages) {
    await downloadImage(img.url, img.name);
  }

  // 3c. Search for 세운상가 additional images
  try {
    const sewoonDetail = await client.detailImage('2553876');
    console.log(`  세운상가 detailImage2: ${sewoonDetail.length} images`);
    for (let i = 0; i < Math.min(sewoonDetail.length, 5); i++) {
      const img = sewoonDetail[i] as any;
      const url = img.originimgurl || img.originImgUrl;
      if (url) await downloadImage(url, `sewoon-detail-${i + 1}.jpg`);
    }
  } catch (e: any) {
    console.log(`  세운상가 detail error: ${e.message}`);
  }

  // 4. Also check: 부산 busan image alternatives
  console.log('\n📸 4. 부산 추가 검색 — F1963, 광안리 등');
  try {
    // F1963 (수영구 복합문화공간) - Section 2 of busan post has no KTO image
    const f1963 = await client.searchKeyword('F1963', {
      contentTypeId: '14',
      numOfRows: 3,
    });
    console.log(`  Search "F1963": ${f1963.length} results`);
    for (const item of f1963) {
      const ci = (item as any).contentid;
      const title = (item as any).title;
      console.log(`    - ${title} (${ci})`);
      if ((item as any).firstimage) {
        await downloadImage((item as any).firstimage, `f1963-${ci}.jpg`);
      }
    }
  } catch (e: any) {
    console.log(`  F1963 search error: ${e.message}`);
  }

  // 광안리 드론쇼
  try {
    const gwanganri = await client.searchKeyword('광안리', {
      contentTypeId: '12',
      numOfRows: 3,
    });
    console.log(`  Search "광안리": ${gwanganri.length} results`);
    for (const item of gwanganri) {
      const ci = (item as any).contentid;
      const title = (item as any).title;
      console.log(`    - ${title} (${ci})`);
    }
  } catch (e: any) {
    console.log(`  광안리 search error: ${e.message}`);
  }

  console.log('\n✅ Audit complete. Check blog/static/images/audit/ for candidates.');
  console.log('Use npm run api:usage to check remaining quota.');
}

main().catch(console.error);
