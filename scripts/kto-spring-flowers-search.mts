/**
 * KTO 봄꽃 포스트용 이미지 검색 스크립트
 * 구례 산수유, 광양 매화, 제주 카멜리아힐
 */
import { config } from 'dotenv';
config();

import { getDataGoKrClient } from '../src/api/data-go-kr/index.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMAGES_DIR = path.join(__dirname, '..', 'blog', 'static', 'images');
const SLUG = 'march-hidden-spring-flowers';

interface SearchTarget {
  label: string;
  keywords: string[];
  contentTypeId: number;
  outputPrefix: string;
}

const targets: SearchTarget[] = [
  {
    label: '구례 산수유마을',
    keywords: ['구례산수유마을', '구례 산수유', '산수유마을'],
    contentTypeId: 12,
    outputPrefix: `kto-${SLUG}-sansuyu`,
  },
  {
    label: '광양 매화마을',
    keywords: ['광양매화마을', '광양 매화', '매화마을'],
    contentTypeId: 12,
    outputPrefix: `kto-${SLUG}-maehwa`,
  },
  {
    label: '제주 카멜리아힐',
    keywords: ['카멜리아힐', '제주 동백', '제주카멜리아힐'],
    contentTypeId: 12,
    outputPrefix: `kto-${SLUG}-camellia`,
  },
];

async function downloadImage(url: string, outputPath: string): Promise<boolean> {
  try {
    const res = await fetch(url);
    if (!res.ok) return false;
    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(outputPath, buffer);
    console.log(`  ✅ Downloaded: ${path.basename(outputPath)} (${(buffer.length / 1024).toFixed(0)}KB)`);
    return true;
  } catch (e) {
    console.log(`  ❌ Download failed: ${url}`);
    return false;
  }
}

async function searchAndDownload(client: any, target: SearchTarget) {
  console.log(`\n🔍 ${target.label}`);
  console.log('─'.repeat(50));

  for (const keyword of target.keywords) {
    console.log(`  Searching: "${keyword}" (typeId=${target.contentTypeId})`);

    try {
      const results = await client.searchKeyword(keyword, {
        contentTypeId: String(target.contentTypeId),
        numOfRows: 10,
      });

      if (!results || results.length === 0) {
        console.log(`  → 결과 없음, 다음 키워드 시도`);
        continue;
      }

      console.log(`  → ${results.length}건 발견`);

      // Show all results for verification
      for (const r of results) {
        const hasImage = r.firstimage ? '📷' : '  ';
        console.log(`  ${hasImage} [${r.contentid}] ${r.title} — ${r.addr1 || '주소 없음'}`);
      }

      // Filter results with images
      const withImages = results.filter((r: any) => r.firstimage);
      if (withImages.length === 0) {
        console.log(`  → 이미지 있는 결과 없음, 상세 조회 시도`);

        // Try detailImage for first 3 results
        for (const r of results.slice(0, 3)) {
          try {
            const details = await client.detailCommon(String(r.contentid));
            const detail = details?.[0];
            if (detail?.firstimage) {
              console.log(`  → detailCommon에서 이미지 발견: ${r.title}`);
              const ext = detail.firstimage.includes('.png') ? '.png' : '.jpg';
              const outputPath = path.join(IMAGES_DIR, `${target.outputPrefix}${ext}`);
              if (await downloadImage(detail.firstimage, outputPath)) {
                console.log(`  📋 Registry info: contentId=${r.contentid}, title=${r.title}, addr=${detail.addr1 || r.addr1}`);
                return { success: true, contentId: r.contentid, title: r.title, addr: detail.addr1 || r.addr1, filename: `${target.outputPrefix}${ext}`, url: detail.firstimage };
              }
            }
          } catch (e) {
            // skip
          }
        }
        console.log(`  → 상세 조회에서도 이미지 없음`);
        continue;
      }

      // Download first image
      const best = withImages[0];
      const ext = best.firstimage.includes('.png') ? '.png' : '.jpg';
      const outputPath = path.join(IMAGES_DIR, `${target.outputPrefix}${ext}`);

      if (fs.existsSync(outputPath)) {
        console.log(`  ⏭️ Already exists: ${path.basename(outputPath)}`);
        return { success: true, contentId: best.contentid, title: best.title, addr: best.addr1, filename: `${target.outputPrefix}${ext}`, url: best.firstimage, existing: true };
      }

      if (await downloadImage(best.firstimage, outputPath)) {
        console.log(`  📋 Registry info: contentId=${best.contentid}, title=${best.title}, addr=${best.addr1}`);

        // Try to get additional images via detailImage
        try {
          const detailImages = await client.detailImage(String(best.contentid));
          if (detailImages && detailImages.length > 0) {
            console.log(`  → ${detailImages.length}개 추가 이미지 발견`);
            // Download second image for cover candidate
            if (detailImages.length > 0 && detailImages[0].originimgurl) {
              const ext2 = detailImages[0].originimgurl.includes('.png') ? '.png' : '.jpg';
              const outputPath2 = path.join(IMAGES_DIR, `${target.outputPrefix}-2${ext2}`);
              if (!fs.existsSync(outputPath2)) {
                await downloadImage(detailImages[0].originimgurl, outputPath2);
              }
            }
          }
        } catch (e) {
          // detailImage optional
        }

        return { success: true, contentId: best.contentid, title: best.title, addr: best.addr1, filename: `${target.outputPrefix}${ext}`, url: best.firstimage };
      }
    } catch (e: any) {
      console.log(`  ❌ API 오류: ${e.message}`);
    }
  }

  console.log(`  ⚠️ ${target.label}: 모든 키워드 검색 실패`);
  return { success: false };
}

async function main() {
  const client = getDataGoKrClient();

  console.log('🌸 봄꽃 포스트 KTO 이미지 검색');
  console.log('================================\n');

  const results: any[] = [];

  for (const target of targets) {
    const result = await searchAndDownload(client, target);
    results.push({ ...result, target: target.label });
  }

  console.log('\n\n📊 검색 결과 요약');
  console.log('================================');
  for (const r of results) {
    if (r.success) {
      console.log(`✅ ${r.target}: ${r.title} (${r.contentId}) → ${r.filename}`);
    } else {
      console.log(`❌ ${r.target}: 검색 실패 → AI 스틸컷 폴백 필요`);
    }
  }
}

main().catch(console.error);
