import { config } from 'dotenv';
import chalk from 'chalk';

config(); // Load .env

const API_KEY = process.env.MOLTBOOK_API_KEY!;
const AGENT_ID = process.env.MOLTBOOK_AGENT_ID!;
const MOLTBOOK_API = 'https://www.moltbook.com/api/v1';

async function findOpenClawPosts() {
  console.log(chalk.bold.cyan('\n🔍 OpenClaw 블로그 포스트 검색\n'));

  // Get all posts
  const postsResponse = await fetch(`${MOLTBOOK_API}/posts?author=${AGENT_ID}&limit=30`, {
    headers: { 'Authorization': `Bearer ${API_KEY}` }
  });

  const postsData = await postsResponse.json() as { posts: any[] };
  const posts = postsData.posts || [];

  console.log(chalk.green(`✅ 총 ${posts.length}개 포스트 조회\n`));

  // Filter posts that contain daun92.github.io (our blog)
  const blogPosts = posts.filter((p: any) =>
    p.content && p.content.includes('daun92.github.io')
  );

  console.log(chalk.cyan(`📝 OpenClaw 블로그 포스트: ${blogPosts.length}개\n`));

  if (blogPosts.length > 0) {
    blogPosts.forEach((post: any, i: number) => {
      console.log(chalk.yellow(`${i + 1}. ${post.title || '(제목 없음)'}`));
      console.log(chalk.gray(`   ID: ${post.id}`));
      console.log(chalk.gray(`   Submolt: ${post.submolt?.name || 'N/A'}`));
      console.log(chalk.gray(`   Created: ${post.created_at}`));
      console.log(chalk.gray(`   Upvotes: ${post.upvotes} | Comments: ${post.comment_count}`));

      // Extract blog URL from content
      const urlMatch = post.content.match(/https:\/\/daun92\.github\.io[^\s]+/);
      if (urlMatch) {
        console.log(chalk.green(`   📎 Blog URL: ${urlMatch[0]}`));
      }
      console.log('');
    });
  } else {
    console.log(chalk.yellow('⚠️ OpenClaw 블로그 포스트가 아직 공유되지 않았습니다.'));
    console.log(chalk.gray('\n힌트: `npm run moltbook:share`를 사용하여 블로그 포스트를 공유하세요.'));
  }

  // Show submolt distribution
  const submolts = new Map<string, number>();
  posts.forEach((p: any) => {
    const name = p.submolt?.name || 'unknown';
    submolts.set(name, (submolts.get(name) || 0) + 1);
  });

  console.log(chalk.blue('\n📊 Submolt 분포:\n'));
  Array.from(submolts.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([name, count]) => {
      console.log(chalk.gray(`  ${name}: ${count}개`));
    });
}

findOpenClawPosts().catch(console.error);
