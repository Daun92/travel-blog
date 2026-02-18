import { config } from 'dotenv';
config();

import { getDataGoKrClient } from '../src/api/data-go-kr/index.js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const CANDIDATE_DIR = 'blog/static/images/candidates-seollal';
const IMG_DIR = 'blog/static/images';

async function downloadImage(url: string, filename: string, dir = CANDIDATE_DIR): Promise<boolean> {
  const outPath = join(dir, filename);
  if (existsSync(outPath)) {
    console.log(`  ⏭️  이미 존재: ${filename}`);
    return true;
  }
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 5000) {
      console.log(`  ⚠️  너무 작음 (${buffer.length}B): ${filename}`);
      return false;
    }
    writeFileSync(outPath, buffer);
    console.log(`  ✅ ${filename} (${(buffer.length / 1024).toFixed(0)}KB)`);
    return true;
  } catch (e: any) {
    console.log(`  ❌ 다운로드 실패: ${e.message}`);
    return false;
  }
}

async function searchAndDownload(
  client: any,
  label: string,
  keyword: string,
  prefix: string,
  opts: Record<string, string> = {}
) {
  console.log(`\n=== ${label}: "${keyword}" ===`);
  try {
    const results = await client.searchKeyword(keyword, { numOfRows: 10, ...opts });
    console.log(`  결과: ${results.length}건`);
    let candidateIdx = 0;
    for (const r of results.slice(0, 8)) {
      const item = r as any;
      const hasImg = item.firstimage ? 'IMG' : 'NO-IMG';
      console.log(`  → ${item.title} (type:${item.contenttypeid}, id:${item.contentid}) ${item.addr1?.substring(0, 25) || ''} [${hasImg}]`);

      if (item.firstimage) {
        await downloadImage(item.firstimage, `${prefix}-search-${candidateIdx}-${item.contentid}.jpg`);
        candidateIdx++;
      }
    }

    // detailImage2 for top results with contentId
    for (const r of results.slice(0, 3)) {
      const item = r as any;
      console.log(`\n  📸 detailImage: ${item.title} (${item.contentid})`);
      try {
        const imgs = await client.detailImage(item.contentid);
        console.log(`    이미지 ${imgs.length}건`);
        for (let i = 0; i < Math.min(imgs.length, 3); i++) {
          const img = imgs[i] as any;
          const url = img.originimgurl || img.originImgUrl;
          if (url) {
            await downloadImage(url, `${prefix}-detail-${item.contentid}-${i}.jpg`);
          }
        }
      } catch (e: any) {
        console.log(`    detailImage 에러: ${e.message}`);
      }
    }
  } catch (e: any) {
    console.log(`  에러: ${e.message}`);
  }
}

async function searchDetailOnly(
  client: any,
  label: string,
  contentId: string,
  prefix: string
) {
  console.log(`\n=== ${label}: detailImage (${contentId}) ===`);
  try {
    const imgs = await client.detailImage(contentId);
    console.log(`  이미지 ${imgs.length}건`);
    for (let i = 0; i < Math.min(imgs.length, 5); i++) {
      const img = imgs[i] as any;
      const url = img.originimgurl || img.originImgUrl;
      if (url) {
        await downloadImage(url, `${prefix}-detail-${contentId}-${i}.jpg`);
      }
    }
  } catch (e: any) {
    console.log(`  에러: ${e.message}`);
  }
}

async function main() {
  mkdirSync(CANDIDATE_DIR, { recursive: true });
  const client = getDataGoKrClient();

  // ═══════════════════════════════════════════════════════
  // TARGET 1: §1 세배 섹션 — 현재 이미지: 시골 퍼레이드 (완전 미스매치)
  // 필요: 세배/전통 의례 현장, 한옥 공간, 공수법 관련
  // ═══════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(60));
  console.log('TARGET 1: 세배 섹션 — 전통 의례/설날 세시풍속');
  console.log('═'.repeat(60));

  await searchAndDownload(client, '남산골한옥마을', '남산골한옥마을', 't1-namsangol', { contentTypeId: '14' });
  await searchAndDownload(client, '남산골한옥마을 관광지', '남산골한옥마을', 't1-namsangol-tour', { contentTypeId: '12' });
  await searchAndDownload(client, '경복궁 설날', '경복궁', 't1-gyeongbok', { contentTypeId: '12' });
  await searchAndDownload(client, '전통예절 체험', '전통예절', 't1-manner', {});
  await searchAndDownload(client, '세시풍속', '세시풍속', 't1-sesipungsok', {});

  // ═══════════════════════════════════════════════════════
  // TARGET 2: §2 떡국 섹션 — 현재: 민속촌 가을 풍경 (계절 불일치)
  // 필요: 겨울/설날 분위기 민속촌 or 떡국 관련 전통 공간
  // ═══════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(60));
  console.log('TARGET 2: 떡국 섹션 — 겨울 민속촌/전통 음식 문화');
  console.log('═'.repeat(60));

  // 기존 한국민속촌 contentId 125578의 다른 이미지 탐색
  await searchDetailOnly(client, '한국민속촌 (기존)', '125578', 't2-minsokchon');
  await searchAndDownload(client, '한국민속촌', '한국민속촌', 't2-minsokchon-search', { contentTypeId: '12' });
  await searchAndDownload(client, '전통음식 체험', '전통음식', 't2-food', { contentTypeId: '12' });
  await searchAndDownload(client, '한옥마을 전통', '한옥마을', 't2-hanok', { contentTypeId: '12' });

  // ═══════════════════════════════════════════════════════
  // TARGET 3: §3 윷놀이 — 현재: 민속박물관 파주 외관 (여름, 연결 약함)
  // 필요: 민속 놀이 전시/체험 또는 박물관 내부
  // ═══════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(60));
  console.log('TARGET 3: 윷놀이 섹션 — 민속박물관/전통 놀이');
  console.log('═'.repeat(60));

  // 기존 국립민속박물관 파주 contentId 2738515의 다른 이미지
  await searchDetailOnly(client, '국립민속박물관 파주 (기존)', '2738515', 't3-folklore-paju');
  await searchAndDownload(client, '국립민속박물관', '국립민속박물관', 't3-folklore', { contentTypeId: '14' });
  await searchAndDownload(client, '민속놀이', '민속놀이', 't3-folktoy', {});
  await searchAndDownload(client, '윷놀이', '윷놀이', 't3-yut', {});

  // ═══════════════════════════════════════════════════════
  // TARGET 4: §5 고창 — 현재: 봄 철쭉 이미지 (계절 불일치)
  // 필요: 겨울/중립 계절 고창읍성 or 모양성제 관련
  // ═══════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(60));
  console.log('TARGET 4: 고창읍성 — 겨울/중립 계절 이미지');
  console.log('═'.repeat(60));

  // 기존 고창읍성 contentId 126398의 다른 이미지
  await searchDetailOnly(client, '고창읍성 (기존)', '126398', 't4-gochang');
  await searchAndDownload(client, '고창읍성', '고창읍성', 't4-gochang-search', { contentTypeId: '12' });
  await searchAndDownload(client, '고창모양성제', '고창모양성제', 't4-moyang', { contentTypeId: '15' });
  await searchAndDownload(client, '고창', '고창', 't4-gochang-general', { contentTypeId: '12' });

  console.log('\n' + '═'.repeat(60));
  console.log('🏁 검색 완료. 후보 이미지 경로:', CANDIDATE_DIR);
  console.log('═'.repeat(60));
}

main().catch(console.error);
