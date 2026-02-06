import { config } from 'dotenv';
import chalk from 'chalk';

config(); // Load .env

const API_KEY = process.env.MOLTBOOK_API_KEY!;
const AGENT_ID = process.env.MOLTBOOK_AGENT_ID!;
const AGENT_NAME = process.env.MOLTBOOK_AGENT_NAME!;
const MOLTBOOK_API = 'https://www.moltbook.com/api/v1';

async function verifyMyPosts() {
  console.log(chalk.bold.cyan('\n🔍 내 포스트 검증\n'));
  console.log(chalk.gray('Expected Agent ID:'), AGENT_ID);
  console.log(chalk.gray('Expected Agent Name:'), AGENT_NAME);

  // Get posts with author filter
  const postsResponse = await fetch(`${MOLTBOOK_API}/posts?author=${AGENT_ID}&limit=50`, {
    headers: { 'Authorization': `Bearer ${API_KEY}` }
  });

  const postsData = await postsResponse.json() as any;
  const posts = postsData.posts || [];

  console.log(chalk.green(`\n✅ API 응답: ${posts.length}개 포스트\n`));

  // Verify each post's author
  let myPosts = 0;
  let otherPosts = 0;

  console.log(chalk.blue('포스트별 저자 확인:\n'));

  posts.forEach((post: any, i: number) => {
    const authorId = post.author?.id;
    const authorName = post.author?.name;
    const isMine = authorId === AGENT_ID || authorName === AGENT_NAME;

    if (isMine) {
      myPosts++;
      console.log(chalk.green(`✓ ${i + 1}. ${post.title?.substring(0, 50) || '(제목 없음)'}`));
      console.log(chalk.gray(`   Author: ${authorName} (${authorId})`));
      console.log(chalk.gray(`   Created: ${new Date(post.created_at).toLocaleDateString('ko-KR')}`));
    } else {
      otherPosts++;
      console.log(chalk.red(`✗ ${i + 1}. ${post.title?.substring(0, 50) || '(제목 없음)'}`));
      console.log(chalk.gray(`   Author: ${authorName} (${authorId})`));
    }
  });

  console.log(chalk.cyan('\n📊 결과 요약:\n'));
  console.log(chalk.green(`  내 포스트: ${myPosts}개`));
  console.log(chalk.red(`  다른 사람 포스트: ${otherPosts}개`));

  if (otherPosts > 0) {
    console.log(chalk.yellow(`\n⚠️ API 필터가 제대로 작동하지 않습니다!`));
    console.log(chalk.gray(`   author=${AGENT_ID} 필터를 사용했지만 다른 사람 포스트도 포함됨`));
  }

  // Get correct count from /agents/me
  const meResponse = await fetch(`${MOLTBOOK_API}/agents/me`, {
    headers: { 'Authorization': `Bearer ${API_KEY}` }
  });
  const meData = await meResponse.json() as any;
  const expectedPosts = meData.agent?.stats?.posts || 0;

  console.log(chalk.cyan('\n📈 /agents/me 에서 확인된 포스트 수:'), expectedPosts);

  if (myPosts !== expectedPosts) {
    console.log(chalk.yellow(`\n⚠️ 불일치: 실제 ${myPosts}개 조회됨, 예상 ${expectedPosts}개`));
  } else {
    console.log(chalk.green(`\n✅ 일치: ${myPosts}개 포스트 모두 확인됨`));
  }
}

verifyMyPosts().catch(console.error);
