import { config } from 'dotenv';
config();

import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import matter from 'gray-matter';

const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
const HUGO_BASE_URL = process.env.HUGO_BASE_URL || '/travel-blog';

interface UnsplashPhoto {
  id: string;
  urls: { regular: string; small: string };
  alt_description: string;
  user: { name: string; links: { html: string } };
  links: { download_location: string };
}

async function searchUnsplash(query: string): Promise<UnsplashPhoto | null> {
  try {
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`;
    const response = await fetch(url, {
      headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` }
    });

    if (!response.ok) {
      console.log(`    Unsplash API 에러: ${response.status}`);
      return null;
    }

    const data = await response.json() as { results: UnsplashPhoto[] };
    return data.results[0] || null;
  } catch (error) {
    console.log(`    검색 실패: ${(error as Error).message}`);
    return null;
  }
}

async function downloadImage(photo: UnsplashPhoto, filename: string): Promise<string | null> {
  try {
    // Unsplash download tracking
    await fetch(`${photo.links.download_location}?client_id=${UNSPLASH_ACCESS_KEY}`);

    const imageResponse = await fetch(photo.urls.regular);
    const buffer = await imageResponse.arrayBuffer();

    const outputPath = join(process.cwd(), 'blog', 'static', 'images', filename);
    await writeFile(outputPath, Buffer.from(buffer));

    return `${HUGO_BASE_URL}/images/${filename}`;
  } catch (error) {
    console.log(`    다운로드 실패: ${(error as Error).message}`);
    return null;
  }
}

const drafts = [
  { file: '2026-02-05-2026-best-5.md', query: 'musical theater stage', name: 'cover-musical' },
  { file: '2026-02-05-7.md', query: 'jeju island cafe ocean view', name: 'cover-jeju-cafe' },
  { file: '2026-02-05-daegu-alley.md', query: 'korean traditional alley street', name: 'cover-daegu' },
  { file: '2026-02-05-gangneung-cafe.md', query: 'gangneung korea beach cafe', name: 'cover-gangneung' },
  { file: '2026-02-05-jeonju-hanok.md', query: 'jeonju hanok village korea', name: 'cover-jeonju' },
  { file: '2026-02-05-seoul-museum.md', query: 'seoul museum interior', name: 'cover-museum' },
  { file: '2026-02-05-yeosu-night.md', query: 'yeosu night view korea sea', name: 'cover-yeosu' },
];

async function addCoverImages() {
  console.log('🖼️  커버 이미지 추가 시작\n');

  for (const draft of drafts) {
    console.log(`📄 ${draft.file}`);

    const filePath = join(process.cwd(), 'drafts', draft.file);
    const content = await readFile(filePath, 'utf-8');
    const { data: frontmatter, content: body } = matter(content);

    // 이미 커버 이미지가 있으면 스킵
    if (frontmatter.image || frontmatter.cover) {
      console.log('    ⏭️  이미 커버 이미지 있음, 스킵\n');
      continue;
    }

    // Unsplash 검색
    console.log(`    🔍 검색: "${draft.query}"`);
    const photo = await searchUnsplash(draft.query);

    if (!photo) {
      console.log('    ❌ 이미지를 찾을 수 없음\n');
      continue;
    }

    // 이미지 다운로드
    const filename = `${draft.name}-${photo.id}.jpg`;
    console.log(`    ⬇️  다운로드 중...`);
    const imagePath = await downloadImage(photo, filename);

    if (!imagePath) {
      console.log('    ❌ 다운로드 실패\n');
      continue;
    }

    // Frontmatter 업데이트
    frontmatter.image = imagePath;
    frontmatter.imageAlt = photo.alt_description || frontmatter.title;
    frontmatter.imageCredit = `Photo by ${photo.user.name} on Unsplash`;

    // 파일 저장
    const newContent = matter.stringify(body, frontmatter);
    await writeFile(filePath, newContent, 'utf-8');

    console.log(`    ✅ 완료: ${imagePath}\n`);

    // API 레이트 리밋 방지
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('✅ 모든 커버 이미지 추가 완료!');
}

addCoverImages().catch(console.error);
