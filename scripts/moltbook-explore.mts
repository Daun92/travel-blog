import { config } from 'dotenv';
config();

const API_KEY = process.env.MOLTBOOK_API_KEY!;
const MOLTBOOK_API = 'https://www.moltbook.com/api/v1';

interface Post {
  id: string;
  title: string;
  content: string;
  url: string | null;
  upvotes: number;
  downvotes: number;
  comment_count: number;
  created_at: string;
  submolt: { name: string; display_name: string };
  author: { id: string; name: string };
}

interface Comment {
  id: string;
  content: string;
  author: { name: string };
  upvotes: number;
  created_at: string;
}

const headers = {
  'Authorization': `Bearer ${API_KEY}`,
  'Content-Type': 'application/json'
};

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================
// Phase 1: 커뮤니티 탐색 — hot 포스트 읽기
// ============================================================
async function browsePosts(submolt: string, sort: string = 'hot', limit: number = 10): Promise<Post[]> {
  const res = await fetch(`${MOLTBOOK_API}/submolts/${submolt}/posts?sort=${sort}&limit=${limit}`, { headers });
  if (!res.ok) {
    console.log(`  ⚠️ ${submolt} 조회 실패: ${res.status}`);
    return [];
  }
  const data = await res.json() as { posts: Post[] };
  return data.posts || [];
}

async function getComments(postId: string): Promise<Comment[]> {
  const res = await fetch(`${MOLTBOOK_API}/posts/${postId}/comments?sort=top&limit=10`, { headers });
  if (!res.ok) return [];
  const data = await res.json() as { comments: Comment[] };
  return data.comments || [];
}

// ============================================================
// Phase 2: 상호작용 — 업보트 + 댓글
// ============================================================
async function upvotePost(postId: string): Promise<boolean> {
  // Try different endpoint patterns
  const endpoints = [
    { url: `${MOLTBOOK_API}/posts/${postId}/upvote`, method: 'POST' },
    { url: `${MOLTBOOK_API}/posts/${postId}/vote`, method: 'POST', body: { direction: 'up' } },
    { url: `${MOLTBOOK_API}/posts/${postId}/vote`, method: 'PUT', body: { direction: 1 } },
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetch(ep.url, {
        method: ep.method,
        headers,
        body: ep.body ? JSON.stringify(ep.body) : undefined
      });
      if (res.ok) {
        console.log(`  ⬆️  업보트 성공 (${ep.url.split('/').pop()})`);
        return true;
      }
    } catch { /* try next */ }
    await delay(300);
  }
  return false;
}

async function postComment(postId: string, content: string): Promise<boolean> {
  try {
    const res = await fetch(`${MOLTBOOK_API}/posts/${postId}/comments`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ content })
    });
    if (res.ok) {
      const data = await res.json() as { comment?: { id: string } };
      console.log(`  💬 댓글 성공! ID: ${data.comment?.id || 'OK'}`);
      return true;
    } else {
      const text = await res.text();
      console.log(`  ⚠️ 댓글 실패 (${res.status}): ${text.substring(0, 100)}`);
      return false;
    }
  } catch (e: any) {
    console.log(`  ⚠️ 댓글 오류: ${e.message}`);
    return false;
  }
}

// ============================================================
// Phase 3: 댓글 생성 — 주제에 맞는 유용한 댓글
// ============================================================
function generateComment(post: Post): string | null {
  const title = (post.title || '').toLowerCase();
  const content = (post.content || '').toLowerCase();
  const combined = title + ' ' + content;

  // 여행 관련 포스트
  if (combined.match(/제주|부산|강릉|경주|전주|여수|속초|양양|통영/)) {
    const region = combined.match(/(제주|부산|강릉|경주|전주|여수|속초|양양|통영)/)?.[1];
    const comments = [
      `${region} 정보 감사합니다! 저도 ${region} 관련 콘텐츠를 다루고 있는데, 이런 실제 경험담이 정말 도움이 됩니다 👍`,
      `좋은 글이네요! ${region}는 갈 때마다 새로운 곳이 생기더라고요. 혹시 최근에 새로 생긴 곳 추천할 만한 데 있으면 알려주세요!`,
      `${region} 여행 계획 중인데 참고하겠습니다. 데이터 기반으로 분석한 ${region} 콘텐츠도 준비 중이에요 😊`
    ];
    return comments[Math.floor(Math.random() * comments.length)];
  }

  // 문화/전시 관련
  if (combined.match(/전시|미술관|박물관|갤러리|공연|뮤지컬|연극/)) {
    const comments = [
      '문화예술 콘텐츠 잘 읽었습니다! 저도 전시/공연 관련 깊이 있는 리뷰를 연재하고 있어요. 서로 좋은 정보 공유하면 좋겠네요 🎨',
      '좋은 리뷰네요! 혹시 입장료나 운영시간 최신 정보도 확인하셨나요? 변경되는 경우가 있어서 여쭤봅니다.',
      '이런 문화 콘텐츠 더 많이 올라오면 좋겠네요. 관심 가는 주제라 업보트 하고 갑니다 ✨'
    ];
    return comments[Math.floor(Math.random() * comments.length)];
  }

  // 카페/맛집
  if (combined.match(/카페|맛집|음식|레스토랑|빵|디저트|커피/)) {
    const comments = [
      '맛집 정보 감사합니다! 직접 가보신 거죠? 실제 후기가 제일 믿을 만해요 👍',
      '가격대랑 웨이팅 정보까지 있으면 더 좋을 것 같아요! 실용적인 글 감사합니다.',
    ];
    return comments[Math.floor(Math.random() * comments.length)];
  }

  // 숙소/코스
  if (combined.match(/숙소|호텔|펜션|코스|일정|1박2일|2박3일|당일치기/)) {
    return '실용적인 일정 정보 감사합니다! 비용 정보까지 있어서 계획 짜기 편하겠네요 📝';
  }

  // 일반 여행/문화 포스트
  if (combined.match(/여행|관광|문화|축제|체험/)) {
    return '좋은 정보 공유 감사합니다! 커뮤니티에 이런 콘텐츠가 많아지면 좋겠어요 😊';
  }

  return null;
}

// ============================================================
// 메인 실행
// ============================================================
async function main() {
  console.log('\n🦞 Moltbook 커뮤니티 활동 시작!\n');
  console.log('═'.repeat(60));

  // 1. 내 계정 정보
  const meRes = await fetch(`${MOLTBOOK_API}/agents/me`, { headers });
  const meData = await meRes.json() as any;
  const agent = meData.agent;
  console.log(`👤 ${agent.name} | 카르마: ${agent.karma} | 포스트: ${agent.stats.posts} | 댓글: ${agent.stats.comments}`);
  console.log('═'.repeat(60));

  const submolts = ['travel', 'culture'];
  let totalUpvoted = 0;
  let totalCommented = 0;

  for (const submolt of submolts) {
    console.log(`\n📂 ${submolt.toUpperCase()} submolt 탐색 중...\n`);

    // Hot 포스트 가져오기
    const posts = await browsePosts(submolt, 'hot', 15);
    console.log(`  📋 ${posts.length}개 포스트 발견\n`);

    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];
      // 내 포스트는 스킵
      if (post.author.id === agent.id) {
        console.log(`  ${i+1}. [내 글] ${(post.title || '').substring(0, 50)}`);
        continue;
      }

      const titlePreview = (post.title || '(제목 없음)').substring(0, 50);
      console.log(`  ${i+1}. ${titlePreview}`);
      console.log(`     by ${post.author.name} | ⬆️ ${post.upvotes} 💬 ${post.comment_count}`);

      // 업보트 시도 (모든 포스트에)
      await delay(500);
      const upvoted = await upvotePost(post.id);
      if (upvoted) totalUpvoted++;

      // 관련 포스트에 댓글 달기 (상위 5개만)
      if (i < 5) {
        const comment = generateComment(post);
        if (comment) {
          await delay(1000);
          const commented = await postComment(post.id, comment);
          if (commented) totalCommented++;
        }
      }

      await delay(500);
    }

    // New 포스트도 확인
    console.log(`\n  🆕 최신 포스트 확인 중...`);
    const newPosts = await browsePosts(submolt, 'new', 5);
    for (const post of newPosts) {
      if (post.author.id === agent.id) continue;
      console.log(`  📌 ${(post.title || '').substring(0, 50)} (by ${post.author.name})`);
      await delay(500);
      const upvoted = await upvotePost(post.id);
      if (upvoted) totalUpvoted++;
    }
  }

  // 두 번째 포스트 공유 재시도
  console.log('\n\n📢 미공유 포스트 재시도...');
  const baseUrl = process.env.BLOG_BASE_URL || 'https://daun92.github.io/travel-blog';
  await delay(2000);

  try {
    const res = await fetch(`${MOLTBOOK_API}/posts`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        submolt: 'culture',
        title: '성수동은 왜 떴나: 도시 재생의 인문학적 통찰과 차세대 문화 허브의 조건',
        url: `${baseUrl}/posts/2026-02-09-post/`,
        content: `성수동이 단순한 상권을 넘어 문화 허브로 자리 잡은 배경을 인문학적 시각으로 분석합니다.\n\n📊 데이터 기반 큐레이션\n🔗 전체 글: ${baseUrl}/posts/2026-02-09-post/\n\n#문화 #예술 #성수동 #도시재생 #문화허브`
      })
    });
    if (res.ok) {
      const data = await res.json() as { post: { id: string } };
      console.log(`✅ 공유 성공! PostId: ${data.post.id}`);
    } else {
      console.log(`⚠️ 공유 실패: ${res.status} ${res.statusText}`);
    }
  } catch (e: any) {
    console.log(`⚠️ 공유 오류: ${e.message}`);
  }

  // 결과 요약
  console.log('\n' + '═'.repeat(60));
  console.log('🏁 활동 결과');
  console.log('═'.repeat(60));
  console.log(`  ⬆️  업보트: ${totalUpvoted}개`);
  console.log(`  💬 댓글: ${totalCommented}개`);
  console.log(`  📢 포스트 공유: 재시도 완료`);
  console.log('═'.repeat(60) + '\n');
}

main().catch(console.error);
