import { config } from 'dotenv';
import chalk from 'chalk';

config(); // Load .env

const API_KEY = process.env.MOLTBOOK_API_KEY!;
const AGENT_ID = process.env.MOLTBOOK_AGENT_ID!;
const AGENT_NAME = process.env.MOLTBOOK_AGENT_NAME!;
const MOLTBOOK_API = 'https://www.moltbook.com/api/v1';

interface MoltbookPost {
  id: string;
  title: string;
  content: string;
  url: string | null;
  upvotes: number;
  downvotes: number;
  comment_count: number;
  created_at: string;
  submolt: { name: string; display_name: string };
  author: { name: string };
}

interface Comment {
  id: string;
  content: string;
  author: { name: string };
  upvotes: number;
  created_at: string;
}

async function getComments(postId: string): Promise<Comment[]> {
  try {
    const response = await fetch(
      `${MOLTBOOK_API}/posts/${postId}/comments?sort=top&limit=10`,
      { headers: { 'Authorization': `Bearer ${API_KEY}` } }
    );
    const data = await response.json() as { comments: Comment[] };
    return data.comments || [];
  } catch {
    return [];
  }
}

async function briefing() {
  console.log(chalk.bold.cyan('\n🦞 Moltbook 계정 활동 브리핑\n'));
  console.log(chalk.gray('═'.repeat(60)));

  // Get agent info
  const meResponse = await fetch(`${MOLTBOOK_API}/agents/me`, {
    headers: { 'Authorization': `Bearer ${API_KEY}` }
  });
  const meData = await meResponse.json() as any;
  const agent = meData.agent;

  console.log(chalk.green('\n👤 계정 정보'));
  console.log(chalk.gray('  이름:'), agent.name);
  console.log(chalk.gray('  카르마:'), agent.karma);
  console.log(chalk.gray('  포스트:'), agent.stats.posts);
  console.log(chalk.gray('  댓글:'), agent.stats.comments);
  console.log(chalk.gray('  구독:'), agent.stats.subscriptions);
  console.log(chalk.gray('  가입일:'), new Date(agent.created_at).toLocaleDateString('ko-KR'));

  // Get posts
  const postsResponse = await fetch(`${MOLTBOOK_API}/posts?author=${agent.id}&limit=50`, {
    headers: { 'Authorization': `Bearer ${API_KEY}` }
  });
  const postsData = await postsResponse.json() as { posts: MoltbookPost[] };
  const posts = postsData.posts || [];

  console.log(chalk.green(`\n📊 활동 통계 (최근 ${posts.length}개 포스트)`));
  console.log(chalk.gray('═'.repeat(60)));

  // Calculate stats
  const totalUpvotes = posts.reduce((sum, p) => sum + p.upvotes, 0);
  const totalDownvotes = posts.reduce((sum, p) => sum + p.downvotes, 0);
  const totalComments = posts.reduce((sum, p) => sum + p.comment_count, 0);
  const avgUpvotes = posts.length > 0 ? Math.round(totalUpvotes / posts.length) : 0;
  const avgComments = posts.length > 0 ? Math.round(totalComments / posts.length) : 0;

  console.log(chalk.cyan('  총 Upvotes:'), chalk.bold(totalUpvotes.toLocaleString()));
  console.log(chalk.cyan('  총 Downvotes:'), totalDownvotes.toLocaleString());
  console.log(chalk.cyan('  총 댓글:'), totalComments.toLocaleString());
  console.log(chalk.cyan('  평균 Upvotes/포스트:'), avgUpvotes.toLocaleString());
  console.log(chalk.cyan('  평균 댓글/포스트:'), avgComments.toLocaleString());

  // Submolt distribution
  const submolts = new Map<string, number>();
  posts.forEach(p => {
    const name = p.submolt?.display_name || p.submolt?.name || 'Unknown';
    submolts.set(name, (submolts.get(name) || 0) + 1);
  });

  console.log(chalk.green('\n📂 Submolt 분포'));
  console.log(chalk.gray('═'.repeat(60)));
  Array.from(submolts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([name, count]) => {
      console.log(chalk.cyan(`  ${name}:`), count + '개');
    });

  // Top posts
  const topPosts = [...posts]
    .sort((a, b) => b.upvotes - a.upvotes)
    .slice(0, 10);

  console.log(chalk.green('\n🔥 인기 포스트 TOP 10'));
  console.log(chalk.gray('═'.repeat(60)));

  for (let i = 0; i < topPosts.length; i++) {
    const post = topPosts[i];
    const rank = i + 1;
    const title = post.title || '(제목 없음)';
    const titlePreview = title.length > 50 ? title.substring(0, 47) + '...' : title;

    console.log(chalk.yellow(`\n${rank}. ${titlePreview}`));
    console.log(chalk.gray(`   Submolt: ${post.submolt?.display_name || post.submolt?.name}`));
    console.log(chalk.gray(`   날짜: ${new Date(post.created_at).toLocaleDateString('ko-KR')}`));
    console.log(chalk.green(`   ⬆️  ${post.upvotes.toLocaleString()} upvotes`),
                chalk.red(`⬇️  ${post.downvotes} downvotes`),
                chalk.blue(`💬 ${post.comment_count.toLocaleString()} comments`));

    // Get top comments for top 3 posts
    if (i < 3 && post.comment_count > 0) {
      const comments = await getComments(post.id);
      if (comments.length > 0) {
        console.log(chalk.cyan(`   💬 주요 댓글:`));
        comments.slice(0, 3).forEach(c => {
          const preview = c.content.length > 80
            ? c.content.substring(0, 77) + '...'
            : c.content;
          console.log(chalk.gray(`      - ${c.author.name}: "${preview}" (⬆️  ${c.upvotes})`));
        });
      }
      await new Promise(resolve => setTimeout(resolve, 300)); // Rate limiting
    }
  }

  // Recent posts
  const recentPosts = posts.slice(0, 5);
  console.log(chalk.green('\n⏰ 최근 포스트 (5개)'));
  console.log(chalk.gray('═'.repeat(60)));

  recentPosts.forEach((post, i) => {
    const title = post.title || '(제목 없음)';
    const titlePreview = title.length > 50 ? title.substring(0, 47) + '...' : title;
    console.log(chalk.yellow(`\n${i + 1}. ${titlePreview}`));
    console.log(chalk.gray(`   날짜: ${new Date(post.created_at).toLocaleDateString('ko-KR')}`));
    console.log(chalk.green(`   ⬆️  ${post.upvotes.toLocaleString()}`),
                chalk.blue(`💬 ${post.comment_count.toLocaleString()}`));
  });

  // Check for OpenClaw blog posts
  const blogPosts = posts.filter(p =>
    p.content && p.content.includes('daun92.github.io')
  );

  console.log(chalk.green('\n📝 OpenClaw 블로그 포스트'));
  console.log(chalk.gray('═'.repeat(60)));

  if (blogPosts.length > 0) {
    console.log(chalk.cyan(`${blogPosts.length}개의 블로그 포스트 발견\n`));
    blogPosts.forEach((post, i) => {
      const urlMatch = post.content.match(/https:\/\/daun92\.github\.io[^\s]+/);
      console.log(chalk.yellow(`${i + 1}. ${post.title || '(제목 없음)'}`));
      if (urlMatch) {
        console.log(chalk.gray(`   📎 ${urlMatch[0]}`));
      }
      console.log(chalk.green(`   ⬆️  ${post.upvotes}`), chalk.blue(`💬 ${post.comment_count}`));
    });
  } else {
    console.log(chalk.yellow('⚠️  아직 공유된 블로그 포스트가 없습니다.'));
    console.log(chalk.gray('   힌트: npm run moltbook:share 로 블로그 포스트를 공유하세요.'));
  }

  console.log(chalk.gray('\n' + '═'.repeat(60)));
  console.log(chalk.green('\n✅ 브리핑 완료\n'));
}

briefing().catch(console.error);
