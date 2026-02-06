import { config } from 'dotenv';
config();

import { generatePost } from '../src/generator/index.js';

// 주간 포스트 계획
const weeklyPosts = [
  {
    topic: "전주 한옥마을 완벽 가이드: 비빔밥 맛집부터 야경 명소까지 당일치기 코스",
    type: 'travel' as const,
    keywords: ["전주 한옥마을", "전주 비빔밥", "전주 여행", "전주 데이트"]
  },
  {
    topic: "2026 봄 뮤지컬 추천 BEST 5: 꼭 봐야 할 화제작 총정리",
    type: 'culture' as const,
    keywords: ["뮤지컬 추천", "2026 뮤지컬", "서울 공연", "예술의전당"]
  },
  {
    topic: "강릉 커피거리 & 바다 뷰 카페 투어: 안목해변 감성 여행",
    type: 'travel' as const,
    keywords: ["강릉 카페", "안목해변", "강릉 커피거리", "강릉 여행"]
  }
];

async function generatePosts() {
  console.log("🚀 주간 포스트 생성 시작\n");

  for (let i = 0; i < weeklyPosts.length; i++) {
    const post = weeklyPosts[i];
    console.log(`\n[${ i + 1}/${weeklyPosts.length}] ${post.topic}`);
    console.log("─".repeat(50));

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

      console.log(`  ✅ 완료: ${result.filename}`);
    } catch (error) {
      console.error(`  ❌ 실패: ${(error as Error).message}`);
    }

    // API 레이트 리밋 방지를 위한 딜레이
    if (i < weeklyPosts.length - 1) {
      console.log("  ⏳ 다음 포스트 생성까지 5초 대기...");
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  console.log("\n✅ 모든 포스트 생성 완료!");
}

generatePosts().catch(console.error);
