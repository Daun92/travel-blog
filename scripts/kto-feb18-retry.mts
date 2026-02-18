/**
 * 2026-02-18 KTO 재시도 — 키워드 조정 + 올바른 API 호출 시그니처
 */
import { config } from 'dotenv';
config();

import { getDataGoKrClient } from '../src/api/data-go-kr/index.js';
import { writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

const OUTPUT_DIR = 'blog/static/images';

interface SearchTarget {
  keywords: string[];
  contentTypeId: string;
  outputFile: string;
  section: string;
  isFestival?: boolean;
}

const TARGETS: SearchTarget[] = [
  // Post #1: 구조라
  { keywords: ['구조라', '거제 구조라', '구조라해수욕장'], contentTypeId: '12', outputFile: 'kto-2026-02-18-to-3.jpg', section: '구조라관광어촌마을' },
  // Post #1: 덕포
  { keywords: ['덕포', '거제 덕포', '덕포해수욕장'], contentTypeId: '12', outputFile: 'kto-2026-02-18-to-4.jpg', section: '덕포랜드 씨라인' },
  // Post #2: 망원시장
  { keywords: ['망원시장', '망원동', '마포구 망원'], contentTypeId: '12', outputFile: 'kto-2026-02-18-post-3.jpg', section: '망원동' },
  // Post #2: 문래 (관광지 or 문화시설)
  { keywords: ['문래동', '문래창작촌', '영등포 문래'], contentTypeId: '14', outputFile: 'kto-2026-02-18-post-4.jpg', section: '문래동' },
  // Post #2: 신당동
  { keywords: ['신당동', '중앙시장', '신당시장'], contentTypeId: '12', outputFile: 'kto-2026-02-18-post-5.jpg', section: '신당동' },
  // Post #3: 양평 관광지
  { keywords: ['남한강', '양평', '양평 강변'], contentTypeId: '12', outputFile: 'kto-2026-02-18-vs-3.jpg', section: '더 힐하우스 양평' },
  // Post #3: 양평 축제
  { keywords: ['양평'], contentTypeId: '15', outputFile: 'kto-2026-02-18-vs-4.jpg', section: '겨울엔 양평 불빛:애', isFestival: true },
];

async function downloadImage(url: string, outputPath: string): Promise<boolean> {
  try {
    const response = await fetch(url);
    if (!response.ok) return false;
    const buffer = Buffer.from(await response.arrayBuffer());
    await writeFile(outputPath, buffer);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const client = getDataGoKrClient();
  console.log('=== 2026-02-18 KTO 재시도 검색 (시그니처 수정) ===\n');

  for (const target of TARGETS) {
    const outputPath = join(OUTPUT_DIR, target.outputFile);

    if (existsSync(outputPath)) {
      console.log(`⏭️ SKIP: ${target.outputFile}`);
      continue;
    }

    let found = false;
    for (const keyword of target.keywords) {
      console.log(`🔍 "${keyword}" (type:${target.contentTypeId}) → ${target.section}`);

      try {
        let items: any[];

        if (target.isFestival) {
          const result = await client.searchFestival({
            eventStartDate: '20260101',
            areaCode: '31', // 경기도
            numOfRows: 10,
          });
          items = result || [];
        } else {
          // searchKeyword(keyword, opts) — keyword는 첫 번째 positional 인자!
          items = await client.searchKeyword(keyword, {
            contentTypeId: target.contentTypeId,
            numOfRows: 10,
          });
        }

        if (!items || items.length === 0) {
          console.log(`   결과 없음`);
          continue;
        }

        // firstimage가 있는 항목 필터
        const withImage = items.filter((item: any) => item.firstimage);
        console.log(`   결과: ${items.length}개 (이미지: ${withImage.length}개)`);

        for (const item of items.slice(0, 3)) {
          console.log(`   - "${item.title}" ${item.firstimage ? '📷' : '🚫'} ${item.addr1 || ''}`);
        }

        if (withImage.length > 0) {
          const best = withImage[0];
          console.log(`   → 선택: "${best.title}"`);
          const downloaded = await downloadImage(best.firstimage, outputPath);
          if (downloaded) {
            console.log(`   ✅ 다운로드: ${target.outputFile}`);
            found = true;
            break;
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`   오류: ${msg}`);
      }
    }

    if (!found) {
      console.log(`   ❌ ${target.section}: KTO 실패 → AI 스틸컷 폴백 필요\n`);
    }
  }
}

main().catch(err => {
  console.error('치명적 오류:', err);
  process.exit(1);
});
