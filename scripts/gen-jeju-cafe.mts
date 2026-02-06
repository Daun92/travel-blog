import { config } from 'dotenv';
config();

import { generatePost } from '../src/generator/index.js';

const topic = "제주도 감성 카페 베스트 7: 오션뷰부터 숨은 핫플까지 인스타 성지 총정리";
const keywords = ["제주 카페 추천", "제주도 오션뷰 카페", "제주 인스타 핫플", "애월 카페"];

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

  console.log("✅ 포스트 생성 완료:", result.filepath);
  console.log("📄 파일명:", result.filename);
} catch (error) {
  console.error("❌ 에러:", (error as Error).message);
  process.exit(1);
}
