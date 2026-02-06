/**
 * 중복 콘텐츠 검사 모듈
 */

import { readFile } from 'fs/promises';
import { glob } from 'glob';
import matter from 'gray-matter';

/**
 * 중복 검사 결과
 */
export interface DuplicateCheckResult {
  isDuplicate: boolean;
  similarPosts: Array<{
    path: string;
    title: string;
    similarity: number;  // 0-100
    matchType: 'title' | 'content' | 'both';
  }>;
  recommendation: 'publish' | 'merge' | 'skip';
  details?: string;
}

/**
 * 텍스트 정규화
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s가-힣]/g, '')  // 특수문자 제거
    .replace(/\s+/g, ' ')          // 공백 정규화
    .trim();
}

/**
 * 단어 집합 생성
 */
function getWordSet(text: string): Set<string> {
  const normalized = normalizeText(text);
  return new Set(normalized.split(' ').filter(w => w.length >= 2));
}

/**
 * Jaccard 유사도 계산
 */
function jaccardSimilarity(set1: Set<string>, set2: Set<string>): number {
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  if (union.size === 0) return 0;
  return (intersection.size / union.size) * 100;
}

/**
 * 제목 유사도 계산 (더 엄격)
 */
function titleSimilarity(title1: string, title2: string): number {
  const words1 = getWordSet(title1);
  const words2 = getWordSet(title2);

  return jaccardSimilarity(words1, words2);
}

/**
 * 콘텐츠 유사도 계산
 */
function contentSimilarity(content1: string, content2: string): number {
  // 앞부분만 비교 (성능 최적화)
  const snippet1 = content1.slice(0, 2000);
  const snippet2 = content2.slice(0, 2000);

  const words1 = getWordSet(snippet1);
  const words2 = getWordSet(snippet2);

  return jaccardSimilarity(words1, words2);
}

/**
 * 기존 발행 포스트 목록 가져오기
 */
async function getPublishedPosts(): Promise<Array<{
  path: string;
  title: string;
  content: string;
  date: string;
}>> {
  const posts: Array<{
    path: string;
    title: string;
    content: string;
    date: string;
  }> = [];

  // blog/content/posts 폴더의 모든 마크다운 파일
  const files = await glob('blog/content/posts/**/*.md');

  for (const filePath of files) {
    try {
      const content = await readFile(filePath, 'utf-8');
      const { data, content: body } = matter(content);

      posts.push({
        path: filePath,
        title: data.title || '',
        content: body,
        date: data.date || ''
      });
    } catch {
      // 파일 읽기 실패 무시
    }
  }

  return posts;
}

/**
 * 중복 검사 실행
 */
export async function checkDuplicate(
  filePath: string,
  options: {
    titleThreshold?: number;   // 제목 유사도 기준 (기본: 80)
    contentThreshold?: number; // 콘텐츠 유사도 기준 (기본: 70)
    combinedThreshold?: number; // 복합 유사도 기준 (기본: 75)
  } = {}
): Promise<DuplicateCheckResult> {
  const {
    titleThreshold = 80,
    contentThreshold = 70,
    combinedThreshold = 75
  } = options;

  // 대상 파일 읽기
  const targetContent = await readFile(filePath, 'utf-8');
  const { data: targetData, content: targetBody } = matter(targetContent);
  const targetTitle = targetData.title || '';

  // 기존 발행 포스트 가져오기
  const publishedPosts = await getPublishedPosts();

  const similarPosts: DuplicateCheckResult['similarPosts'] = [];

  for (const post of publishedPosts) {
    // 같은 파일이면 스킵
    if (post.path === filePath) continue;

    // 제목 유사도
    const titleSim = titleSimilarity(targetTitle, post.title);

    // 콘텐츠 유사도
    const contentSim = contentSimilarity(targetBody, post.content);

    // 복합 유사도 (제목 40% + 콘텐츠 60%)
    const combinedSim = titleSim * 0.4 + contentSim * 0.6;

    // 유사한 포스트 판별
    let matchType: 'title' | 'content' | 'both' | null = null;

    if (titleSim >= titleThreshold && contentSim >= contentThreshold) {
      matchType = 'both';
    } else if (titleSim >= titleThreshold) {
      matchType = 'title';
    } else if (contentSim >= contentThreshold) {
      matchType = 'content';
    } else if (combinedSim >= combinedThreshold) {
      matchType = 'content';  // 복합 기준 충족
    }

    if (matchType) {
      similarPosts.push({
        path: post.path,
        title: post.title,
        similarity: Math.round(combinedSim),
        matchType
      });
    }
  }

  // 유사도 순 정렬
  similarPosts.sort((a, b) => b.similarity - a.similarity);

  // 결과 판정
  const isDuplicate = similarPosts.length > 0;
  let recommendation: DuplicateCheckResult['recommendation'] = 'publish';
  let details: string | undefined;

  if (similarPosts.length > 0) {
    const topMatch = similarPosts[0];

    if (topMatch.matchType === 'both' || topMatch.similarity >= 90) {
      recommendation = 'skip';
      details = `매우 유사한 포스트 발견: "${topMatch.title}" (${topMatch.similarity}%)`;
    } else if (topMatch.similarity >= 80) {
      recommendation = 'merge';
      details = `유사한 포스트와 병합 고려: "${topMatch.title}" (${topMatch.similarity}%)`;
    } else {
      recommendation = 'publish';
      details = `약간 유사한 포스트 있음: "${topMatch.title}" (${topMatch.similarity}%)`;
    }
  }

  return {
    isDuplicate,
    similarPosts,
    recommendation,
    details
  };
}

/**
 * 중복 검사 점수 계산 (100 = 유니크, 0 = 완전 중복)
 */
export function calculateDuplicateScore(result: DuplicateCheckResult): number {
  if (result.similarPosts.length === 0) {
    return 100;  // 완전 유니크
  }

  const topSimilarity = result.similarPosts[0].similarity;
  return Math.max(0, 100 - topSimilarity);
}
