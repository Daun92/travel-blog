import { config } from 'dotenv';
config();

const API_KEY = process.env.MOLTBOOK_API_KEY!;
const MOLTBOOK_API = 'https://www.moltbook.com/api/v1';
const headers = { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' };

// 1. /agents/me
console.log('=== /agents/me ===');
const meRes = await fetch(`${MOLTBOOK_API}/agents/me`, { headers });
console.log('Status:', meRes.status);
const meData = await meRes.json();
console.log(JSON.stringify(meData, null, 2).substring(0, 1000));

// 2. culture submolt posts
console.log('\n=== /submolts/culture/posts?sort=hot&limit=3 ===');
const cRes = await fetch(`${MOLTBOOK_API}/submolts/culture/posts?sort=hot&limit=3`, { headers });
console.log('Status:', cRes.status);
if (cRes.ok) {
  const cData = await cRes.json() as any;
  const posts = cData.posts || [];
  console.log(`Posts count: ${posts.length}`);
  if (posts[0]) {
    console.log('First post keys:', Object.keys(posts[0]).join(', '));
    console.log('First post:', JSON.stringify(posts[0], null, 2).substring(0, 500));
  }
}

// 3. Try upvote on a random post
console.log('\n=== Upvote test ===');
const tRes = await fetch(`${MOLTBOOK_API}/submolts/travel/posts?sort=hot&limit=1`, { headers });
if (tRes.ok) {
  const tData = await tRes.json() as any;
  const testPost = tData.posts?.[0];
  if (testPost) {
    console.log(`Test post: ${testPost.id} - ${testPost.title?.substring(0, 30)}`);

    // Try POST /posts/{id}/upvote
    const r1 = await fetch(`${MOLTBOOK_API}/posts/${testPost.id}/upvote`, { method: 'POST', headers });
    console.log(`POST /upvote: ${r1.status}`, await r1.text().then(t => t.substring(0, 200)));

    await new Promise(r => setTimeout(r, 500));

    // Try POST /posts/{id}/vote with body
    const r2 = await fetch(`${MOLTBOOK_API}/posts/${testPost.id}/vote`, {
      method: 'POST', headers,
      body: JSON.stringify({ direction: 'up' })
    });
    console.log(`POST /vote: ${r2.status}`, await r2.text().then(t => t.substring(0, 200)));

    await new Promise(r => setTimeout(r, 500));

    // Try PUT /posts/{id}/vote
    const r3 = await fetch(`${MOLTBOOK_API}/posts/${testPost.id}/vote`, {
      method: 'PUT', headers,
      body: JSON.stringify({ direction: 1 })
    });
    console.log(`PUT /vote: ${r3.status}`, await r3.text().then(t => t.substring(0, 200)));
  }
}

// 4. Try comment
console.log('\n=== Comment test ===');
const c2Res = await fetch(`${MOLTBOOK_API}/submolts/culture/posts?sort=hot&limit=1`, { headers });
if (c2Res.ok) {
  const c2Data = await c2Res.json() as any;
  const testPost = c2Data.posts?.[0];
  if (testPost) {
    console.log(`Test post: ${testPost.id} - ${testPost.title?.substring(0, 30)}`);
    const cr = await fetch(`${MOLTBOOK_API}/posts/${testPost.id}/comments`, {
      method: 'POST', headers,
      body: JSON.stringify({ content: '좋은 글이네요! 문화예술 콘텐츠 많이 올라오면 좋겠습니다 😊' })
    });
    console.log(`POST comment: ${cr.status}`, await cr.text().then(t => t.substring(0, 200)));
  }
}
