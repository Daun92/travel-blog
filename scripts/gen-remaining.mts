import { config } from 'dotenv';
config();

import { generatePost } from '../src/generator/index.js';
import { rename } from 'fs/promises';
import { join } from 'path';

const posts = [
  {
    topic: "대구 근대골목 역사 탐방: 김광석 거리부터 서문시장까지 도보 코스",
    type: 'travel' as const,
    keywords: ["대구 여행", "대구 근대골목", "김광석 거리", "서문시장"],
    filename: "2026-02-05-daegu-alley.md"
  },
  {
    topic: "서울 이색 박물관 베스트 5: 데이트 코스로 딱 좋은 숨은 명소",
    type: 'culture' as const,
    keywords: ["서울 박물관", "이색 박물관", "서울 데이트", "실내 데이트"],
    filename: "2026-02-05-seoul-museum.md"
  },
  {
    topic: "여수 밤바다 낭만 여행: 케이블카부터 낭만포차까지 야경 코스",
    type: 'travel' as const,
    keywords: ["여수 여행", "여수 밤바다", "여수 케이블카", "여수 낭만포차"],
    filename: "2026-02-05-yeosu-night.md"
  }
];

async function generatePosts() {
  console.log("🚀 나머지 포스트 생성 시작\n");

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    console.log(`[${i + 1}/${posts.length}] ${post.topic}`);
    console.log("─".repeat(60));

    try {
      const result = await generatePost({
        topic: post.topic,
        type: post.type,
        length: 'medium',
        keywords: post.keywords,
        draft: true,
        outputDir: './drafts',
        onProgress: (msg: string) => console.log(`  ${msg}`)
      });

      // 파일명 변경
      const newPath = join('./drafts', post.filename);
      await rename(result.filepath, newPath);
      console.log(`  ✅ 완료: ${post.filename}\n`);
    } catch (error) {
      console.error(`  ❌ 실패: ${(error as Error).message}\n`);
    }

    // API 레이트 리밋 방지
    if (i < posts.length - 1) {
      console.log("  ⏳ 5초 대기...\n");
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  console.log("✅ 모든 포스트 생성 완료!");
}

generatePosts().catch(console.error);
