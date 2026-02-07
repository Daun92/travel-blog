/**
 * Moltbook 자동 공유 워크플로우
 * ShareQueue 기반 우선순위 공유
 *
 * 모드:
 * - auto: 시간대 내 30분 간격 반복
 * - once: 1회 공유 (Task Scheduler용)
 * - status: 상태 확인
 * - queue: 큐 대시보드
 */

import { config } from 'dotenv';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import matter from 'gray-matter';
import { loadMoltbookConfig, MoltbookShareAgent, FeedbackCollector } from '../src/agents/moltbook/index.js';
import { ShareQueue, normalizePath } from '../src/agents/moltbook/share-queue.js';

// 환경 변수 로드
config();

const POSTS_DIR = './blog/content/posts';

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
          filePath: normalizePath(filePath),
          title: data.title || filename,
          url: postUrl,
          summary: data.summary || data.description || '',
          category: data.categories?.[0] || category,
          topics: data.tags?.slice(0, 5) || [],
          date: data.date || new Date().toISOString()
        });
      }
    } catch (error) {
      console.error(`  ${category} 폴더 읽기 실패:`, error);
    }
  }

  return posts;
}

/**
 * 포스트 공유
 */
async function sharePost(post: PostInfo, moltbookConfig: any): Promise<{ success: boolean; postId?: string; isClientError?: boolean; error?: string }> {
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
      console.log(`📍 Post ID: ${result.id}\n`);
      return { success: true, postId: result.id };
    }
    return { success: false, error: '공유 결과 없음' };
  } catch (error: any) {
    const isClientError = error.status >= 400 && error.status < 500;
    if (error.message?.includes('Too Many Requests')) {
      console.log('⚠️ Rate limit 도달\n');
      return { success: false, error: 'Rate limit', isClientError: false };
    }
    console.error('  공유 실패:', error.message);
    return { success: false, error: error.message, isClientError };
  }
}

/**
 * 메인 워크플로우
 */
async function main() {
  const mode = process.argv[2] || 'auto'; // auto | once | status | queue

  console.log('🚀 Moltbook 자동 공유 워크플로우 (v2)\n');

  // Moltbook 설정 확인
  const moltbookConfig = await loadMoltbookConfig();
  if (!moltbookConfig || !moltbookConfig.apiKey) {
    console.error('  Moltbook이 설정되지 않았습니다.');
    console.log('설정: npm run moltbook:setup\n');
    process.exit(1);
  }

  // ShareQueue 로드
  const queue = new ShareQueue();
  await queue.load();
  await queue.loadTimeWindowFromStrategy();

  // 발행된 포스트 수집 → 큐에 추가
  const allPosts = await collectPublishedPosts();
  for (const post of allPosts) {
    queue.addPost({
      filePath: post.filePath,
      title: post.title,
      category: post.category,
      publishedAt: post.date
    });
  }
  await queue.save();

  // 상태/큐 대시보드
  if (mode === 'status' || mode === 'queue') {
    const status = queue.getStatus();

    console.log(`📚 전체 포스트: ${status.stats.totalPosts}개`);
    console.log(`✅ 공유 완료: ${status.stats.shared}개`);
    console.log(`📋 대기 중: ${status.stats.pending}개`);
    console.log(`❌ 실패: ${status.stats.failed}개`);
    console.log(`⏭️  스킵됨: ${status.stats.skipped}개`);
    console.log(`⏰ 시간대: ${queue.isInTimeWindow() ? '활성' : '비활성'}`);
    console.log(`🚦 공유 가능: ${status.canShareNow ? '예' : `아니오 (${Math.ceil(status.waitMinutes)}분 대기)`}\n`);

    if (mode === 'queue' && status.pendingPosts.length > 0) {
      console.log('📋 대기 큐 (우선순위순):');
      for (const item of status.pendingPosts.slice(0, 10)) {
        console.log(`  [${item.priority}점] ${item.title || item.filePath}`);
      }
      console.log('');
    }

    if (status.failedPosts.length > 0) {
      console.log('❌ 실패 목록:');
      for (const item of status.failedPosts) {
        console.log(`  ${item.title || item.filePath} (재시도 ${item.retryCount}/${5})`);
        if (item.lastError) console.log(`    └ ${item.lastError}`);
      }
    }

    return;
  }

  // 1회 실행 (Task Scheduler용)
  if (mode === 'once') {
    const next = queue.getNextPost();

    if (!next) {
      if (!queue.isInTimeWindow()) {
        console.log('⏰ 공유 시간대 밖입니다.\n');
      } else if (!queue.canShare()) {
        console.log(`⏳ Rate limit - ${Math.ceil(queue.getWaitMinutes())}분 후 재시도\n`);
      } else {
        console.log('✅ 공유할 포스트 없음\n');
      }
      return;
    }

    const post = allPosts.find(p => normalizePath(p.filePath) === next.filePath);
    if (!post) {
      console.log(`  포스트 정보를 찾을 수 없음: ${next.filePath}\n`);
      return;
    }

    const result = await sharePost(post, moltbookConfig);
    if (result.success) {
      queue.markShared(post.filePath, result.postId);
    } else {
      queue.markFailed(post.filePath, result.error || '알 수 없는 오류', result.isClientError);
    }

    await queue.save();

    const status = queue.getStatus();
    console.log(`📊 진행률: ${status.stats.shared}/${status.stats.totalPosts}\n`);
    return;
  }

  // 자동 모드
  if (mode === 'auto') {
    console.log('🔄 자동 모드 시작 (Ctrl+C로 중지)\n');

    while (true) {
      const next = queue.getNextPost();

      if (!next) {
        // 대기 중인 포스트가 하나도 없으면 종료
        const status = queue.getStatus();
        if (status.stats.pending === 0 && status.stats.failed === 0) {
          console.log('✅ 모든 포스트 공유 완료\n');
          break;
        }

        // 시간대 밖이면 대기
        if (!queue.isInTimeWindow()) {
          console.log('⏰ 공유 시간대 밖 - 1시간 대기...\n');
          await new Promise(resolve => setTimeout(resolve, 60 * 60 * 1000));
          continue;
        }

        // Rate limit 대기
        const waitMs = queue.getWaitMinutes() * 60 * 1000;
        if (waitMs > 0) {
          console.log(`⏳ ${Math.ceil(waitMs / 60000)}분 대기...\n`);
          await new Promise(resolve => setTimeout(resolve, waitMs + 1000));
          continue;
        }

        // 다음 재시도까지 대기
        console.log('⏳ 다음 재시도까지 대기...\n');
        await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));
        continue;
      }

      const post = allPosts.find(p => normalizePath(p.filePath) === next.filePath);
      if (!post) {
        queue.markFailed(next.filePath, '포스트 정보 없음', true);
        await queue.save();
        continue;
      }

      const result = await sharePost(post, moltbookConfig);
      if (result.success) {
        queue.markShared(post.filePath, result.postId);
      } else {
        queue.markFailed(post.filePath, result.error || '알 수 없는 오류', result.isClientError);
      }

      await queue.save();

      const status = queue.getStatus();
      console.log(`📊 진행률: ${status.stats.shared}/${status.stats.totalPosts}\n`);

      // 30분 대기
      console.log(`⏰ ${queue['state'].config.rateLimitMinutes}분 대기...\n`);
      await new Promise(resolve => setTimeout(resolve, queue['state'].config.rateLimitMinutes * 60 * 1000));
    }
  }
}

main().catch(console.error);
