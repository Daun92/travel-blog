/**
 * KTO (한국관광공사) 이미지 활용 모듈
 * data.go.kr KorService2 API에서 수집된 실사진 다운로드, 선택, 레지스트리 등록
 */

import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import type { CollectedData, TourismData, FestivalData } from '../agents/collector.js';

// ─── 타입 정의 ────────────────────────────────────────────────────

export interface KtoImageCandidate {
  url: string;
  title: string;
  source: 'firstimage' | 'gallery';
  contentId?: string;
}

export interface KtoImageResult {
  localPath: string;
  relativePath: string;
  alt: string;
  caption: string;
  sourceUrl: string;
  title: string;
}

// ─── 이미지 추출 ──────────────────────────────────────────────────

/**
 * CollectedData에서 유효한 KTO 이미지 URL 추출
 * firstimage 우선, gallery 이미지 후순위
 */
export function extractKtoImages(data: CollectedData): KtoImageCandidate[] {
  const candidates: KtoImageCandidate[] = [];
  const seenUrls = new Set<string>();

  const addCandidate = (
    url: string | undefined,
    title: string,
    source: 'firstimage' | 'gallery',
    contentId?: string
  ) => {
    if (!url || seenUrls.has(url)) return;
    if (!isValidKtoUrl(url)) return;
    seenUrls.add(url);
    candidates.push({ url, title, source, contentId });
  };

  // 관광지 데이터
  for (const item of data.tourismData) {
    addCandidate(item.image, item.title, 'firstimage', item.contentId);
    if (item.images) {
      for (const imgUrl of item.images) {
        addCandidate(imgUrl, item.title, 'gallery', item.contentId);
      }
    }
  }

  // 축제 데이터
  for (const fest of data.festivals) {
    addCandidate(fest.image, fest.title, 'firstimage', fest.contentId);
    if (fest.images) {
      for (const imgUrl of fest.images) {
        addCandidate(imgUrl, fest.title, 'gallery', fest.contentId);
      }
    }
  }

  // firstimage 우선 정렬
  candidates.sort((a, b) => {
    if (a.source === 'firstimage' && b.source !== 'firstimage') return -1;
    if (a.source !== 'firstimage' && b.source === 'firstimage') return 1;
    return 0;
  });

  return candidates;
}

/**
 * URL이 유효한 KTO 이미지인지 확인
 */
function isValidKtoUrl(url: string): boolean {
  if (!url || url.trim() === '') return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// ─── 커버 이미지 선택 ─────────────────────────────────────────────

/**
 * 커버 이미지로 최적의 후보 선택
 * firstimage 소스 +20점, 제목에 topic 키워드 매칭 +30점
 */
export function selectBestCoverImage(
  candidates: KtoImageCandidate[],
  topic: string
): KtoImageCandidate | null {
  if (candidates.length === 0) return null;

  const topicWords = topic.split(/\s+/).filter(w => w.length >= 2);

  let bestCandidate: KtoImageCandidate | null = null;
  let bestScore = -1;

  for (const candidate of candidates) {
    let score = 0;

    // firstimage 소스 보너스
    if (candidate.source === 'firstimage') {
      score += 20;
    }

    // 제목에 topic 키워드 매칭
    for (const word of topicWords) {
      if (candidate.title.includes(word)) {
        score += 30;
        break;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestCandidate = candidate;
    }
  }

  return bestCandidate;
}

// ─── 이미지 다운로드 ──────────────────────────────────────────────

/**
 * 단일 KTO 이미지 다운로드
 * 실패 시 null 반환 (graceful fallback)
 */
export async function downloadKtoImage(
  candidate: KtoImageCandidate,
  outputDir: string,
  slug: string,
  index: number
): Promise<KtoImageResult | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(candidate.url, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      console.log(`  KTO 이미지 다운로드 실패 (${response.status}): ${candidate.title}`);
      return null;
    }

    const buffer = await response.arrayBuffer();
    const filename = `kto-${slug}-${index}.jpg`;
    const filepath = join(outputDir, filename);

    await mkdir(dirname(filepath), { recursive: true });
    await writeFile(filepath, Buffer.from(buffer));

    const baseURL = process.env.HUGO_BASE_URL || '/travel-blog';
    const relativePath = `${baseURL}/images/${filename}`;

    return {
      localPath: filepath,
      relativePath,
      alt: candidate.title,
      caption: '출처: 한국관광공사',
      sourceUrl: candidate.url,
      title: candidate.title,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(`  KTO 이미지 다운로드 오류: ${msg}`);
    return null;
  }
}

/**
 * 복수 KTO 이미지 순차 다운로드
 */
export async function downloadKtoImages(
  candidates: KtoImageCandidate[],
  slug: string,
  outputDir: string,
  maxCount: number
): Promise<KtoImageResult[]> {
  const results: KtoImageResult[] = [];
  const toDownload = candidates.slice(0, maxCount);

  for (let i = 0; i < toDownload.length; i++) {
    const result = await downloadKtoImage(toDownload[i], outputDir, slug, i + 1);
    if (result) {
      results.push(result);
    }
  }

  return results;
}
