/**
 * KTO Image Boost Round 3 — download remaining images
 */
import { config } from 'dotenv';
config();

import { writeFileSync } from 'fs';
import { join } from 'path';

const IMG_DIR = 'blog/static/images';

async function downloadImage(url: string, filename: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  writeFileSync(join(IMG_DIR, filename), buffer);
  console.log(`✅ ${filename} (${(buffer.length / 1024).toFixed(0)}KB)`);
}

async function main() {
  const downloads = [
    // 마곡사 — 천연송림욕장 firstimage (contentId 126849)
    { url: 'http://tong.visitkorea.or.kr/cms/resource/40/3390240_image2_1.JPG', file: 'kto-2026-02-07-1-2.jpg' },
    // 전등사 — 강화 전등사 firstimage (contentId 125534)
    { url: 'http://tong.visitkorea.or.kr/cms/resource/74/3494874_image2_1.jpg', file: 'kto-2026-02-07-1-3.jpg' },
    // 산방산유채꽃밭 — shows mountain shape (contentId 2854521), replace cruise image
    { url: 'http://tong.visitkorea.or.kr/cms/resource/18/2854518_image2_1.jpg', file: 'kto-2026-02-11-368-4.jpg' },
    // 유달산 — 코스 이미지 (contentId 606003)
    { url: 'http://tong.visitkorea.or.kr/cms/resource/97/1887197_image2_1.jpg', file: 'kto-2026-02-11-post-3.jpg' },
    // 달성사(목포) — firstimage (contentId 299979)
    { url: 'https://tong.visitkorea.or.kr/cms/resource/34/3535134_image2_1.jpg', file: 'kto-2026-02-11-post-4.jpg' },
  ];

  for (const d of downloads) {
    try {
      await downloadImage(d.url, d.file);
    } catch (e: any) {
      console.log(`❌ ${d.file}: ${e.message}`);
    }
  }

  console.log('\n✅ 다운로드 완료');
}

main().catch(console.error);
