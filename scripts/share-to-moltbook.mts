/**
 * Moltbook 자동 포스트 공유 스크립트
 * 발행된 포스트를 Moltbook에 자동으로 공유합니다.
 */

import { config } from 'dotenv';
import { readFile } from 'fs/promises';
import { join } from 'path';
import matter from 'gray-matter';
import { loadMoltbookConfig, MoltbookShareAgent } from '../src/agents/moltbook/index.js';

// 환경 변수 로드
config();

interface PostMetadata {
  title: string;
  description: string;
  summary: string;
  tags: string[];
  categories: string[];
  date: string;
}

async function sharePost(filePath: string, baseUrl: string = 'https://daun92.github.io/travel-blog') {
  // 포스트 파일 읽기
  const content = await readFile(filePath, 'utf-8');
  const { data } = matter(content) as { data: PostMetadata };

  // URL 생성 (Hugo permalink 형식)
  const filename = filePath.split('/').pop()?.replace('.md', '') || '';
  const dateMatch = filename.match(/^(\d{4})-(\d{2})-(\d{2})/);

  let postUrl = `${baseUrl}/posts/`;
  if (dateMatch) {
    const [, year, month] = dateMatch;
    postUrl += `${year}/${month}/${filename}/`;
  } else {
    postUrl += `${filename}/`;
  }

  // 카테고리 추출
  const category = data.categories?.[0] || 'travel';

  // 태그 추출
  const topics = data.tags?.slice(0, 5) || [];

  // Moltbook 설정 로드
  const moltbookConfig = await loadMoltbookConfig();

  if (!moltbookConfig || !moltbookConfig.apiKey) {
    console.error('❌ Moltbook이 설정되지 않았습니다.');
    console.log('설정하려면: npm run moltbook setup');
    process.exit(1);
  }

  // 포스트 공유
  console.log('\n🦞 Moltbook 포스트 공유\n');
  console.log(`📝 제목: ${data.title}`);
  console.log(`🔗 URL: ${postUrl}`);
  console.log(`📄 요약: ${data.summary || data.description}`);
  console.log(`📂 카테고리: ${category}`);
  console.log(`🏷️  태그: ${topics.join(', ')}\n`);

  const shareAgent = new MoltbookShareAgent(moltbookConfig);

  try {
    const result = await shareAgent.sharePost({
      title: data.title,
      url: postUrl,
      summary: data.summary || data.description,
      category,
      topics
    });

    if (result) {
      console.log('✅ Moltbook 공유 완료!');
      console.log(`📍 Post ID: ${result.id}`);
      console.log(`🔗 Moltbook URL: https://moltbook.com/posts/${result.id}\n`);
    } else {
      console.log('⚠️ 공유 실패\n');
    }
  } catch (error) {
    console.error('❌ 공유 중 오류:', error);
    process.exit(1);
  }
}

// 메인 실행
const filePath = process.argv[2];
const baseUrl = process.env.BLOG_BASE_URL || 'https://daun92.github.io/travel-blog';

if (!filePath) {
  console.log(`
사용법:
  npx tsx scripts/share-to-moltbook.mts <포스트-파일-경로>

예시:
  npx tsx scripts/share-to-moltbook.mts blog/content/posts/culture/2026-02-04-mmca-exhibition.md
  `);
  process.exit(1);
}

sharePost(filePath, baseUrl).catch(console.error);
