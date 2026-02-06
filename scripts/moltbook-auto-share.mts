/**
 * Moltbook 자동 공유 워크플로우
 * Rate limit: 1 post per 30 minutes
 *
 * 워크플로우:
 * 1. 발행된 포스트 목록 수집
 * 2. 30분 간격으로 순차 공유
 * 3. 피드백 수시 수집
 * 4. 반응 확인 후 다음 포스트 진행
 */

import { config } from 'dotenv';
import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import matter from 'gray-matter';
import { loadMoltbookConfig, MoltbookShareAgent, FeedbackCollector } from '../src/agents/moltbook/index.js';

// 환경 변수 로드
config();

const RATE_LIMIT_MINUTES = 30;
const POSTS_DIR = './blog/content/posts';
const STATE_FILE = './data/moltbook-share-state.json';

interface ShareState {
  lastSharedTime: string | null;
  sharedPosts: string[];
  pendingPosts: string[];
  totalShared: number;
}

interface PostInfo {
  filePath: string;
  title: string;
  url: string;
  summary: string;
  category: string;
  topics: string[];
  date: string;
}

/**
 * 상태 파일 로드
 */
async function loadState(): Promise<ShareState> {
  try {
    const data = await readFile(STATE_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {
      lastSharedTime: null,
      sharedPosts: [],
      pendingPosts: [],
      totalShared: 0
    };
  }
}

/**
 * 상태 파일 저장
 */
async function saveState(state: ShareState): Promise<void> {
  await writeFile(STATE_FILE, JSON.stringify(state, null, 2));
}

/**
 * 발행된 포스트 수집
 */
async function collectPublishedPosts(): Promise<PostInfo[]> {
  const posts: PostInfo[] = [];
  const categories = ['travel', 'culture'];
  const baseUrl = process.env.BLOG_BASE_URL || 'https://daun92.github.io/travel-blog';

  for (const category of categories) {
    const categoryDir = join(POSTS_DIR, category);
    try {
      const files = await readdir(categoryDir);

      for (const file of files) {
        if (!file.endsWith('.md') || file.startsWith('_')) continue;

        const filePath = join(categoryDir, file);
        const content = await readFile(filePath, 'utf-8');
        const { data } = matter(content);

        // draft가 아닌 것만
        if (data.draft === true) continue;

        // URL 생성
        const filename = file.replace('.md', '');
        const dateMatch = filename.match(/^(\d{4})-(\d{2})-(\d{2})/);
        let postUrl = `${baseUrl}/posts/`;
        if (dateMatch) {
          const [, year, month] = dateMatch;
          postUrl += `${year}/${month}/${filename}/`;
        } else {
          postUrl += `${filename}/`;
        }

        posts.push({
          filePath,
          title: data.title || filename,
          url: postUrl,
          summary: data.summary || data.description || '',
          category: data.categories?.[0] || category,
          topics: data.tags?.slice(0, 5) || [],
          date: data.date || new Date().toISOString()
        });
      }
    } catch (error) {
      console.error(`❌ ${category} 폴더 읽기 실패:`, error);
    }
  }

  // 날짜 역순 정렬 (최신 먼저)
  return posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/**
 * Rate limit 확인
 */
function canShare(state: ShareState): boolean {
  if (!state.lastSharedTime) return true;

  const lastTime = new Date(state.lastSharedTime);
  const now = new Date();
  const diffMinutes = (now.getTime() - lastTime.getTime()) / 1000 / 60;

  return diffMinutes >= RATE_LIMIT_MINUTES;
}

/**
 * 다음 공유까지 남은 시간 (분)
 */
function getWaitMinutes(state: ShareState): number {
  if (!state.lastSharedTime) return 0;

  const lastTime = new Date(state.lastSharedTime);
  const now = new Date();
  const diffMinutes = (now.getTime() - lastTime.getTime()) / 1000 / 60;

  return Math.max(0, RATE_LIMIT_MINUTES - diffMinutes);
}

/**
 * 포스트 공유
 */
async function sharePost(post: PostInfo, moltbookConfig: any): Promise<boolean> {
  console.log('\n🦞 Moltbook 포스트 공유');
  console.log(`📝 제목: ${post.title}`);
  console.log(`🔗 URL: ${post.url}`);
  console.log(`📂 카테고리: ${post.category}`);
  console.log(`🏷️  태그: ${post.topics.join(', ')}\n`);

  const shareAgent = new MoltbookShareAgent(moltbookConfig);

  try {
    const result = await shareAgent.sharePost({
      title: post.title,
      url: post.url,
      summary: post.summary,
      category: post.category,
      topics: post.topics
    });

    if (result) {
      console.log('✅ 공유 완료!');
      console.log(`📍 Post ID: ${result.id}`);
      console.log(`🔗 Moltbook: https://moltbook.com/posts/${result.id}\n`);
      return true;
    }
    return false;
  } catch (error: any) {
    if (error.message?.includes('Too Many Requests')) {
      console.log('⚠️ Rate limit 도달 - 나중에 재시도\n');
    } else {
      console.error('❌ 공유 실패:', error.message);
    }
    return false;
  }
}

/**
 * 피드백 수집 및 확인
 */
async function checkFeedback(moltbookConfig: any): Promise<{ hasActivity: boolean; summary: string }> {
  console.log('\n📊 피드백 확인 중...');

  const collector = new FeedbackCollector(moltbookConfig);
  const feedback = await collector.collectFeedback();

  const totalUpvotes = feedback.reduce((sum, f) => sum + f.upvotes, 0);
  const totalComments = feedback.reduce((sum, f) => sum + f.comments.length, 0);

  const hasActivity = totalUpvotes > 0 || totalComments > 0;

  let summary = `피드백: ${feedback.length}개 포스트`;
  if (totalUpvotes > 0) summary += ` | 👍 ${totalUpvotes}`;
  if (totalComments > 0) summary += ` | 💬 ${totalComments}`;

  console.log(summary);
  console.log(hasActivity ? '✅ 반응 있음 - 계속 진행' : '⏸️  아직 반응 없음\n');

  return { hasActivity, summary };
}

/**
 * 메인 워크플로우
 */
async function main() {
  const mode = process.argv[2] || 'auto'; // auto | once | status

  console.log('🚀 Moltbook 자동 공유 워크플로우\n');
  console.log(`⏱️  Rate Limit: ${RATE_LIMIT_MINUTES}분당 1개 포스트\n`);

  // Moltbook 설정 확인
  const moltbookConfig = await loadMoltbookConfig();
  if (!moltbookConfig || !moltbookConfig.apiKey) {
    console.error('❌ Moltbook이 설정되지 않았습니다.');
    console.log('설정: npm run moltbook:setup\n');
    process.exit(1);
  }

  // 상태 로드
  const state = await loadState();

  // 발행된 포스트 수집
  const allPosts = await collectPublishedPosts();
  const unsharedPosts = allPosts.filter(p => !state.sharedPosts.includes(p.filePath));

  console.log(`📚 발행된 포스트: ${allPosts.length}개`);
  console.log(`✅ 공유 완료: ${state.sharedPosts.length}개`);
  console.log(`📋 대기 중: ${unsharedPosts.length}개\n`);

  // 상태만 확인
  if (mode === 'status') {
    if (!canShare(state)) {
      const wait = getWaitMinutes(state);
      console.log(`⏳ 다음 공유까지 ${Math.ceil(wait)}분 대기 필요\n`);
    } else if (unsharedPosts.length > 0) {
      console.log(`✅ 지금 공유 가능\n`);
      console.log('다음 포스트:');
      console.log(`  ${unsharedPosts[0].title}\n`);
    } else {
      console.log('✅ 모든 포스트 공유 완료\n');
    }
    return;
  }

  // 1회만 실행
  if (mode === 'once') {
    if (!canShare(state)) {
      const wait = getWaitMinutes(state);
      console.log(`⏳ Rate limit - ${Math.ceil(wait)}분 후 재시도\n`);
      return;
    }

    if (unsharedPosts.length === 0) {
      console.log('✅ 공유할 포스트 없음\n');
      return;
    }

    const post = unsharedPosts[0];
    const success = await sharePost(post, moltbookConfig);

    if (success) {
      state.sharedPosts.push(post.filePath);
      state.lastSharedTime = new Date().toISOString();
      state.totalShared++;
      await saveState(state);

      console.log(`📊 진행률: ${state.sharedPosts.length}/${allPosts.length} (${Math.round(state.sharedPosts.length / allPosts.length * 100)}%)\n`);
    }
    return;
  }

  // 자동 모드 (30분 간격 반복)
  if (mode === 'auto') {
    console.log('🔄 자동 모드 시작 (Ctrl+C로 중지)\n');

    let consecutiveNoFeedback = 0;

    while (unsharedPosts.length > 0) {
      // Rate limit 확인
      if (!canShare(state)) {
        const wait = getWaitMinutes(state);
        console.log(`⏳ ${Math.ceil(wait)}분 대기 중...\n`);
        await new Promise(resolve => setTimeout(resolve, wait * 60 * 1000));
      }

      // 피드백 확인
      const { hasActivity } = await checkFeedback(moltbookConfig);

      if (!hasActivity) {
        consecutiveNoFeedback++;
        if (consecutiveNoFeedback >= 3) {
          console.log('⏸️  3회 연속 반응 없음 - 일시 정지');
          console.log('수동으로 재시작하거나 피드백 확인 후 계속하세요.\n');
          break;
        }
      } else {
        consecutiveNoFeedback = 0;
      }

      // 다음 포스트 공유
      const post = unsharedPosts.shift();
      if (!post) break;

      const success = await sharePost(post, moltbookConfig);

      if (success) {
        state.sharedPosts.push(post.filePath);
        state.lastSharedTime = new Date().toISOString();
        state.totalShared++;
        await saveState(state);

        console.log(`📊 진행률: ${state.sharedPosts.length}/${allPosts.length}\n`);
      } else {
        unsharedPosts.unshift(post); // 실패 시 다시 앞에 추가
      }

      // 30분 대기
      if (unsharedPosts.length > 0) {
        console.log(`⏰ 다음 포스트까지 ${RATE_LIMIT_MINUTES}분 대기...\n`);
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MINUTES * 60 * 1000));
      }
    }

    console.log('✅ 자동 공유 완료\n');
  }
}

main().catch(console.error);
