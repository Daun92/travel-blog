import { config } from 'dotenv';
config();

import { generatePost } from '../src/generator/index.js';
import { rename } from 'fs/promises';
import { join } from 'path';

const topic = "강릉 커피거리 & 바다 뷰 카페 투어: 안목해변 감성 여행 코스";
const keywords = ["강릉 카페", "안목해변", "강릉 커피거리", "강릉 여행"];

console.log("🚀 포스트 생성 시작:", topic);

try {
  const result = await generatePost({
    topic,
    type: 'travel',
    length: 'medium',
    keywords,
    draft: true,
    outputDir: './drafts',
    onProgress: (msg: string) => console.log(`  ${msg}`)
  });

  // 파일명을 고유하게 변경
  const newFilename = '2026-02-05-gangneung-cafe.md';
  const oldPath = result.filepath;
  const newPath = join('./drafts', newFilename);

  await rename(oldPath, newPath);

  console.log("✅ 포스트 생성 완료:", newPath);
} catch (error) {
  console.error("❌ 에러:", (error as Error).message);
  process.exit(1);
}
