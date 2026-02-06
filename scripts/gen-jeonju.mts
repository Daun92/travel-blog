import { config } from 'dotenv';
config();

import { generatePost } from '../src/generator/index.js';
import { rename } from 'fs/promises';
import { join } from 'path';

const topic = "전주 한옥마을 완벽 가이드: 비빔밥 맛집부터 야경 명소까지 당일치기 코스";
const keywords = ["전주 한옥마을", "전주 비빔밥", "전주 여행", "전주 데이트"];

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
  const newFilename = '2026-02-05-jeonju-hanok.md';
  const oldPath = result.filepath;
  const newPath = join('./drafts', newFilename);

  await rename(oldPath, newPath);

  console.log("✅ 포스트 생성 완료:", newPath);
} catch (error) {
  console.error("❌ 에러:", (error as Error).message);
  process.exit(1);
}
