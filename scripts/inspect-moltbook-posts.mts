import { config } from 'dotenv';
import chalk from 'chalk';

config(); // Load .env

const API_KEY = process.env.MOLTBOOK_API_KEY!;
const AGENT_ID = process.env.MOLTBOOK_AGENT_ID!;
const MOLTBOOK_API = 'https://www.moltbook.com/api/v1';

async function inspectPosts() {
  console.log(chalk.bold.cyan('\n🔍 Moltbook 포스트 구조 분석\n'));

  // Get agent ID
  const meResponse = await fetch(`${MOLTBOOK_API}/agents/me`, {
    headers: { 'Authorization': `Bearer ${API_KEY}` }
  });
  const meData = await meResponse.json() as { agent: { id: string } };
  const agentId = meData.agent?.id;

  console.log(chalk.gray('Agent ID:'), agentId);

  // Get posts
  const postsResponse = await fetch(`${MOLTBOOK_API}/posts?author=${agentId}&limit=3`, {
    headers: { 'Authorization': `Bearer ${API_KEY}` }
  });

  const postsData = await postsResponse.json() as { posts: any[] };
  const posts = postsData.posts || [];

  console.log(chalk.green(`\n✅ 조회된 포스트: ${posts.length}개\n`));

  if (posts.length > 0) {
    console.log(chalk.blue('첫 번째 포스트 구조:\n'));
    const firstPost = posts[0];

    // Show all keys
    console.log(chalk.yellow('Available fields:'));
    Object.keys(firstPost).forEach(key => {
      const value = firstPost[key];
      const valueStr = typeof value === 'object'
        ? JSON.stringify(value).substring(0, 50) + '...'
        : String(value).substring(0, 50);
      console.log(chalk.gray(`  ${key}:`), valueStr);
    });

    console.log(chalk.cyan('\n\n전체 포스트 데이터:\n'));
    console.log(JSON.stringify(firstPost, null, 2));
  }
}

inspectPosts().catch(console.error);
