/**
 * 포스트 인덱스 빌더
 * blog/content/posts/{travel,culture}/*.md를 스캔하여 data/post-index.json 생성
 * API 비용 0 — 파일시스템 + 정규식만 사용
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join, basename } from 'path';
import matter from 'gray-matter';
import { parseSections } from '../generator/content-parser.js';
import { extractGeoScope } from '../images/geo-context.js';
import type { PostIndex, PostIndexEntry } from './types.js';

const BLOG_POSTS_DIR = join(process.cwd(), 'blog', 'content', 'posts');
const POST_INDEX_PATH = join(process.cwd(), 'data', 'post-index.json');
const BASE_URL_PREFIX = '/travel-blog';

/** 리스트형 포스트 감지 키워드 */
const LIST_POST_KEYWORDS = ['TOP', 'BEST', 'Best', '순위', '비교', '베스트', '추천'];

/** 파일명에서 날짜 제거한 slug 추출 */
function extractFileSlug(filename: string): string {
  return basename(filename, '.md');
}

/** frontmatter date에서 permalink 생성 */
function buildPermalink(date: Date | string, slug: string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${BASE_URL_PREFIX}/posts/${year}/${month}/${slug}/`;
}

/** 제목에서 리스트형 포스트 여부 판단 */
function detectListPost(title: string): boolean {
  return LIST_POST_KEYWORDS.some(kw => title.includes(kw));
}

/** 단일 포스트 파일에서 인덱스 엔트리 생성 */
function buildEntryFromFile(filePath: string, category: 'travel' | 'culture'): PostIndexEntry | null {
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const { data: fm, content } = matter(raw);

    if (!fm.title || !fm.date) return null;

    const fileSlug = extractFileSlug(basename(filePath));
    const slug = fm.slug || fileSlug.replace(/^\d{4}-\d{2}-\d{2}-/, '');
    const permalink = buildPermalink(fm.date, slug);

    // 본문 섹션 분석
    const sections = parseSections(content);
    const allLocations = new Set<string>();
    const allSectionKeywords = new Set<string>();
    const sectionTitles: string[] = [];

    for (const section of sections) {
      if (section.level === 2) {
        sectionTitles.push(section.title);
      }
      if (section.mentionedLocations) {
        for (const loc of section.mentionedLocations) {
          allLocations.add(loc);
        }
      }
      if (section.sectionKeywords) {
        for (const kw of section.sectionKeywords) {
          allSectionKeywords.add(kw);
        }
      }
    }

    // 지역 추출
    const geoScope = extractGeoScope(content, fm.title);
    const regions: string[] = [];
    if (geoScope.primaryRegion) regions.push(geoScope.primaryRegion);
    for (const r of geoScope.mentionedRegions) {
      if (!regions.includes(r)) regions.push(r);
    }

    return {
      fileSlug,
      slug,
      permalink,
      title: fm.title,
      category,
      personaId: fm.personaId || 'friendly',
      date: new Date(fm.date).toISOString().split('T')[0],
      tags: Array.isArray(fm.tags) ? fm.tags : [],
      keywords: Array.isArray(fm.keywords) ? fm.keywords : [],
      regions,
      locations: [...allLocations],
      sectionKeywords: [...allSectionKeywords],
      sectionTitles,
      isListPost: detectListPost(fm.title),
      ...(fm.cover?.image ? { coverImage: fm.cover.image } : {}),
    };
  } catch (error) {
    console.warn(`[build-index] 파일 파싱 실패: ${filePath}`, error);
    return null;
  }
}

/** 디렉토리 내 모든 .md 파일 스캔 */
function scanPostDirectory(dir: string, category: 'travel' | 'culture'): PostIndexEntry[] {
  if (!existsSync(dir)) return [];

  const files = readdirSync(dir).filter(f => f.endsWith('.md') && !f.startsWith('_'));
  const entries: PostIndexEntry[] = [];

  for (const file of files) {
    const entry = buildEntryFromFile(join(dir, file), category);
    if (entry) entries.push(entry);
  }

  return entries;
}

/** 포스트 인덱스 빌드 (메인 함수) */
export function buildPostIndex(): PostIndex {
  console.log('[build-index] 포스트 인덱스 빌드 시작...');

  const travelEntries = scanPostDirectory(join(BLOG_POSTS_DIR, 'travel'), 'travel');
  const cultureEntries = scanPostDirectory(join(BLOG_POSTS_DIR, 'culture'), 'culture');

  const entries = [...travelEntries, ...cultureEntries].sort(
    (a, b) => b.date.localeCompare(a.date)
  );

  const index: PostIndex = {
    version: 1,
    generatedAt: new Date().toISOString(),
    count: entries.length,
    entries,
  };

  console.log(`[build-index] ${entries.length}개 포스트 인덱싱 완료 (travel: ${travelEntries.length}, culture: ${cultureEntries.length})`);

  return index;
}

/** 포스트 인덱스를 파일로 저장 */
export function savePostIndex(index: PostIndex): void {
  writeFileSync(POST_INDEX_PATH, JSON.stringify(index, null, 2), 'utf-8');
  console.log(`[build-index] 인덱스 저장: ${POST_INDEX_PATH}`);
}

/** 저장된 포스트 인덱스 로드 */
export function loadPostIndex(): PostIndex | null {
  if (!existsSync(POST_INDEX_PATH)) return null;
  try {
    return JSON.parse(readFileSync(POST_INDEX_PATH, 'utf-8'));
  } catch {
    return null;
  }
}

/** CLI 직접 실행 시 */
if (process.argv[1]?.includes('build-index')) {
  const index = buildPostIndex();
  savePostIndex(index);
}
