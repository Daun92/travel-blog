/**
 * 깨진 내부 링크 URL 수정
 * /posts/travel/slug/ → /travel-blog/posts/YYYY/MM/slug/
 */

import type { PostIndex } from './types.js';

/** 깨진 내부 링크 패턴: [text](/posts/(travel|culture)/slug/) */
const BROKEN_INTERNAL_LINK = /\[([^\]]+)\]\(\/posts\/(travel|culture)\/([^)/]+)\/?\)/g;

/** 깨진 내부 링크 패턴 (baseURL 포함): [text](/travel-blog/posts/(travel|culture)/slug/) */
const BROKEN_INTERNAL_LINK_WITH_BASE = /\[([^\]]+)\]\(\/travel-blog\/posts\/(travel|culture)\/([^)/]+)\/?\)/g;

/**
 * 깨진 내부 링크를 올바른 permalink로 교체
 * @returns { content, fixed: 수정된 링크 수, details: 수정 내역 }
 */
export function fixBrokenInternalLinks(
  content: string,
  index: PostIndex
): { content: string; fixed: number; details: string[] } {
  let fixed = 0;
  const details: string[] = [];

  // slug로 엔트리 빠르게 찾기 위한 맵
  const slugMap = new Map<string, string>();
  for (const entry of index.entries) {
    slugMap.set(entry.slug, entry.permalink);
    // fileSlug의 날짜 제거 부분도 매핑
    const shortSlug = entry.fileSlug.replace(/^\d{4}-\d{2}-\d{2}-/, '');
    if (shortSlug !== entry.slug) {
      slugMap.set(shortSlug, entry.permalink);
    }
  }

  // 패턴 1: /posts/(travel|culture)/slug/
  let result = content.replace(BROKEN_INTERNAL_LINK, (match, text, _cat, slug) => {
    const permalink = slugMap.get(slug);
    if (permalink) {
      fixed++;
      details.push(`"${text}" → ${permalink}`);
      return `[${text}](${permalink})`;
    }
    return match;
  });

  // 패턴 2: /travel-blog/posts/(travel|culture)/slug/
  result = result.replace(BROKEN_INTERNAL_LINK_WITH_BASE, (match, text, _cat, slug) => {
    const permalink = slugMap.get(slug);
    if (permalink) {
      fixed++;
      details.push(`"${text}" → ${permalink}`);
      return `[${text}](${permalink})`;
    }
    return match;
  });

  return { content: result, fixed, details };
}
