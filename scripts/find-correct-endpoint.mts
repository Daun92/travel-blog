import { config } from 'dotenv';
import chalk from 'chalk';

config(); // Load .env

const API_KEY = process.env.MOLTBOOK_API_KEY!;
const AGENT_ID = process.env.MOLTBOOK_AGENT_ID!;
const AGENT_NAME = process.env.MOLTBOOK_AGENT_NAME!;
const MOLTBOOK_API = 'https://www.moltbook.com/api/v1';

async function testEndpoints() {
  console.log(chalk.bold.cyan('\n🔍 올바른 엔드포인트 찾기\n'));

  const endpoints = [
    `/agents/${AGENT_NAME}`,
    `/agents/name/${AGENT_NAME}`,
    `/users/${AGENT_NAME}`,
    `/users/${AGENT_NAME}/posts`,
    `/me/posts`,
    `/posts?user=${AGENT_NAME}`,
    `/posts?agent=${AGENT_NAME}`,
    `/posts?agent_id=${AGENT_ID}`,
    `/posts?agent_name=${AGENT_NAME}`,
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(chalk.blue(`\nTesting: ${endpoint}`));

      const response = await fetch(`${MOLTBOOK_API}${endpoint}`, {
        headers: { 'Authorization': `Bearer ${API_KEY}` }
      });

      console.log(chalk.gray(`Status: ${response.status}`));

      if (response.ok) {
        const data = await response.json();

        // Check if it has posts
        if (data.posts) {
          console.log(chalk.green(`✅ Found posts field! Count: ${data.posts.length}`));

          // Verify first post author
          if (data.posts.length > 0) {
            const firstPost = data.posts[0];
            console.log(chalk.gray(`First post author: ${firstPost.author?.name}`));

            const isMine = firstPost.author?.id === AGENT_ID || firstPost.author?.name === AGENT_NAME;
            if (isMine) {
              console.log(chalk.green(`🎯 THIS IS THE CORRECT ENDPOINT!`));
              console.log(chalk.yellow(`\nPosts from this endpoint:\n`));

              data.posts.slice(0, 10).forEach((post: any, i: number) => {
                console.log(chalk.cyan(`${i + 1}. ${post.title || '(제목 없음)'}`));
                console.log(chalk.gray(`   Upvotes: ${post.upvotes} | Comments: ${post.comment_count}`));
              });

              return endpoint;
            } else {
              console.log(chalk.red(`❌ Posts from other users`));
            }
          }
        } else if (data.agent) {
          console.log(chalk.yellow(`Found agent info, no posts field`));
        } else {
          console.log(chalk.gray(`Response keys: ${Object.keys(data).join(', ')}`));
        }
      } else {
        const text = await response.text();
        if (text.includes('<!DOCTYPE html>')) {
          console.log(chalk.red(`❌ HTML response (404 or redirect)`));
        } else {
          console.log(chalk.red(`❌ Error: ${text.substring(0, 100)}`));
        }
      }
    } catch (error) {
      console.log(chalk.red(`❌ Error: ${error}`));
    }

    await new Promise(resolve => setTimeout(resolve, 300));
  }

  console.log(chalk.yellow(`\n⚠️ No working endpoint found`));
  console.log(chalk.gray(`\nTrying to get posts from /agents/me stats...`));

  // Last resort: check if /agents/me has embedded posts
  const meResponse = await fetch(`${MOLTBOOK_API}/agents/me`, {
    headers: { 'Authorization': `Bearer ${API_KEY}` }
  });
  const meData = await meResponse.json() as any;

  console.log(chalk.cyan('\n/agents/me response keys:'));
  console.log(JSON.stringify(Object.keys(meData.agent || {}), null, 2));

  console.log(chalk.cyan('\nFull agent data:'));
  console.log(JSON.stringify(meData.agent, null, 2).substring(0, 1000));
}

testEndpoints().catch(console.error);
