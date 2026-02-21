import { config } from 'dotenv';
config();
import { loadMoltbookConfig, MoltbookShareAgent } from '../src/agents/moltbook/index.js';

const baseUrl = (process.env.BLOG_BASE_URL || 'https://daun92.github.io/travel-blog').replace(/\/+$/, '');
const moltConfig = await loadMoltbookConfig();
if (!moltConfig) {
  console.error('❌ Moltbook 설정 로드 실패');
  process.exit(1);
}
const agent = new MoltbookShareAgent(moltConfig);

// 두 번째 포스트만 (첫 번째는 이미 공유 완료)
const post = {
  title: '성수동은 왜 떴나: 도시 재생의 인문학적 통찰과 차세대 문화 허브의 조건',
  url: `${baseUrl}/posts/2026-02-09-post/`,
  summary: '성수동이 단순한 상권을 넘어 문화 허브로 자리 잡은 배경을 인문학적 시각으로 분석합니다.',
  category: 'culture' as const,
  topics: ['문화', '예술', '성수동', '도시재생', '문화허브']
};

console.log(`📢 공유 중: ${post.title.substring(0, 40)}...`);
try {
  const result = await agent.sharePost(post);
  if (result) {
    console.log(`✅ 성공! PostId: ${result.id}`);
  } else {
    console.log('⚠️ 공유 실패 (null 반환)');
  }
} catch (e: any) {
  console.error(`❌ 실패: ${e.message}`);
}
