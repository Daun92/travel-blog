/**
 * 이미지 오케스트레이터
 * 커버 이미지 선택(KTO→Unsplash 폴백) + 인라인 이미지 처리(KTO+AI 하이브리드)를
 * 단일 모듈로 통합
 */

import { join } from 'path';
import {
  extractKtoImages,
  selectBestCoverImage,
  downloadKtoImage,
  downloadKtoImages,
  type KtoImageCandidate,
  type KtoImageResult,
} from './kto-images.js';
import {
  findImageForTopic,
  UnsplashClient,
  registerImage,
  registerKtoImage,
} from './unsplash.js';
import {
  GeminiImageClient,
  saveImage,
  type ImageStyle,
} from './gemini-imagen.js';
import {
  insertImages,
  removeImageMarkers,
  insertAutoMarkers,
  extractImageMarkers,
  type ImageResult,
} from '../generator/content-parser.js';
import { generatePromptFromMarker, type ImageContext } from '../generator/image-prompts.js';
import type { CollectedData } from '../agents/collector.js';

// ─── 타입 ────────────────────────────────────────────────────────

export interface CoverImageResult {
  coverImage: string;
  imageAttribution: string;
  imageAlt: string;
  ktoImagesUsed: boolean;
}

export interface SelectCoverImageOptions {
  topic: string;
  type: 'travel' | 'culture';
  collectedData?: CollectedData;
  persona?: string;
  keywords?: string[];
  slug: string;
  /** inquirer prompt 여부 (false = 비대화 모드) */
  interactive?: boolean;
  onProgress?: (msg: string) => void;
}

export interface ProcessInlineImagesOptions {
  content: string;
  topic: string;
  type: 'travel' | 'culture';
  slug: string;
  imageCount: number;
  collectedImages?: KtoImageCandidate[];
  onProgress?: (msg: string) => void;
}

export interface ProcessInlineImagesResult {
  content: string;
  imagePaths: string[];
}

// ─── 커버 이미지 선택 ────────────────────────────────────────────

/**
 * 커버 이미지 선택 (KTO → Unsplash 폴백)
 * 비대화 모드(interactive=false)에서는 Unsplash 검색을 자동 실행
 */
export async function selectCoverImage(
  options: SelectCoverImageOptions
): Promise<CoverImageResult | null> {
  const { topic, type, collectedData, persona, keywords, slug, interactive, onProgress = () => {} } = options;

  // 1. KTO 이미지 시도 (auto-collect 데이터가 있는 경우)
  if (collectedData) {
    const ktoCandidates = extractKtoImages(collectedData);
    if (ktoCandidates.length > 0) {
      const bestCover = selectBestCoverImage(ktoCandidates, topic);
      if (bestCover) {
        onProgress('KTO 커버 이미지 다운로드 중...');
        const ktoResult = await downloadKtoImage(bestCover, './blog/static/images', slug, 0);

        if (ktoResult) {
          await registerKtoImage(bestCover.contentId, bestCover.url, slug, topic);
          return {
            coverImage: ktoResult.relativePath,
            imageAttribution: ktoResult.caption,
            imageAlt: ktoResult.alt,
            ktoImagesUsed: true,
          };
        }
      }
    }
  }

  // 2. Unsplash 폴백
  if (!process.env.UNSPLASH_ACCESS_KEY) {
    return null;
  }

  // 비대화 모드에서는 바로 검색, 대화 모드에서는 호출부가 inquirer로 확인
  // (interactive 프롬프트는 호출부에서 처리 — 오케스트레이터는 항상 검색 수행)
  onProgress('커버 이미지 검색 중 (스코어링 적용)...');
  const photo = await findImageForTopic(topic, undefined, {
    type,
    persona: persona as 'viral' | 'friendly' | 'informative' | undefined,
    keywords: keywords && keywords.length > 0 ? keywords : undefined,
  });

  if (!photo) {
    return null;
  }

  const client = new UnsplashClient();
  const { filepath, attribution } = await client.download(
    photo,
    './blog/static/images',
    `cover-${Date.now()}.jpg`
  );

  await registerImage(photo.id, slug, topic);

  const coverImage = '/' + filepath
    .replace(/\\/g, '/')
    .replace(/^\.\/blog\/static\//, '')
    .replace(/^blog\/static\//, '');

  return {
    coverImage,
    imageAttribution: attribution,
    imageAlt: photo.alt_description || topic,
    ktoImagesUsed: false,
  };
}

// ─── 콘텐츠 컨텍스트 추출 ──────────────────────────────────────

/**
 * 생성된 콘텐츠에서 장소명/항목 추출 → 이미지 프롬프트 컨텍스트용
 */
export function extractContentContext(content: string): { locations: string[]; items: string[] } {
  const locations: string[] = [];
  const items: string[] = [];

  // H2/H3 헤딩에서 장소명 추출 (숫자 접두사, 이모지 제거)
  const headingRegex = /^#{2,3}\s+(?:\d+[.)]\s*)?(?:[^\w\s가-힣]*\s*)?(.+)/gm;
  let match;
  while ((match = headingRegex.exec(content)) !== null) {
    const heading = match[1]
      .replace(/[*_`]/g, '')           // 마크다운 서식 제거
      .replace(/\s*[-–—:].*/g, '')     // 부제 제거 ("경복궁 - 역사의 숨결" → "경복궁")
      .trim();
    if (heading.length >= 2 && heading.length <= 30) {
      locations.push(heading);
    }
  }

  // 굵은 글씨(**text**) 중 장소/시설명 패턴 추출
  const boldRegex = /\*\*([^*]{2,25})\*\*/g;
  const locationKeywords = /(?:[관점원장역사당궁각실집루대탑문교산천호섬항포곶]|해변|해수욕장|시장|거리|마을|길|골목|카페|갤러리)$/;
  while ((match = boldRegex.exec(content)) !== null) {
    const text = match[1].trim();
    if (locationKeywords.test(text) && !locations.includes(text)) {
      items.push(text);
    }
  }

  return { locations: locations.slice(0, 8), items: items.slice(0, 6) };
}

// ─── KTO 실사진 삽입 ────────────────────────────────────────────

/**
 * KTO 실사진을 콘텐츠 H2/H3 섹션 뒤에 삽입
 */
function insertKtoImages(content: string, ktoResults: KtoImageResult[]): string {
  if (ktoResults.length === 0) return content;

  const lines = content.split('\n');
  const headingIndices: number[] = [];

  // H2, H3 헤딩 위치 수집
  for (let i = 0; i < lines.length; i++) {
    if (/^#{2,3}\s/.test(lines[i])) {
      headingIndices.push(i);
    }
  }

  if (headingIndices.length === 0) {
    // 헤딩이 없으면 콘텐츠 맨 앞에 삽입
    const imageBlocks = ktoResults.map(r =>
      `\n![${r.alt}](${r.relativePath})\n*${r.caption}*\n`
    );
    return imageBlocks.join('') + '\n' + content;
  }

  // 헤딩 뒤 적절한 위치에 이미지 삽입
  const insertPositions: number[] = [];
  if (headingIndices.length >= 1) {
    insertPositions.push(findInsertAfterHeading(lines, headingIndices[0]));
  }
  if (ktoResults.length > 1 && headingIndices.length >= 3) {
    const midIdx = Math.floor(headingIndices.length / 2);
    insertPositions.push(findInsertAfterHeading(lines, headingIndices[midIdx]));
  }

  // 역순으로 삽입 (인덱스 변동 방지)
  const sortedPairs: Array<{ pos: number; result: KtoImageResult }> = [];
  for (let i = 0; i < Math.min(ktoResults.length, insertPositions.length); i++) {
    sortedPairs.push({ pos: insertPositions[i], result: ktoResults[i] });
  }
  sortedPairs.sort((a, b) => b.pos - a.pos);

  for (const { pos, result } of sortedPairs) {
    const imageBlock = `\n![${result.alt}](${result.relativePath})\n*${result.caption}*\n`;
    lines.splice(pos + 1, 0, imageBlock);
  }

  return lines.join('\n');
}

/**
 * 헤딩 뒤 첫 번째 문단 끝 위치 반환
 */
function findInsertAfterHeading(lines: string[], headingIdx: number): number {
  for (let i = headingIdx + 1; i < lines.length; i++) {
    if (lines[i].trim() === '' && i > headingIdx + 1) {
      return i;
    }
    if (/^#{1,3}\s/.test(lines[i]) && i > headingIdx + 1) {
      return i - 1;
    }
  }
  return Math.min(headingIdx + 2, lines.length - 1);
}

// ─── 인라인 이미지 처리 ─────────────────────────────────────────

/**
 * 인라인 이미지 처리 (KTO 하이브리드 + AI 마커 기반 생성)
 */
export async function processInlineImages(
  options: ProcessInlineImagesOptions
): Promise<ProcessInlineImagesResult> {
  const { content, topic, type, slug, imageCount, collectedImages, onProgress = () => {} } = options;

  const imageOutputDir = join(process.cwd(), 'blog', 'static', 'images');
  const imagePaths: string[] = [];

  // ── Step 1: KTO 실사진 다운로드 (커버에 안 쓴 것들) ──
  let ktoResults: KtoImageResult[] = [];
  if (collectedImages && collectedImages.length > 0) {
    // 커버에 사용한 첫 번째 후보(index 0)는 제외
    const inlineCandidates = collectedImages.slice(1);
    if (inlineCandidates.length > 0) {
      const ktoCount = Math.min(Math.ceil(imageCount / 2), inlineCandidates.length);
      onProgress(`KTO 실사진 ${ktoCount}개 다운로드 중...`);
      ktoResults = await downloadKtoImages(inlineCandidates, slug, imageOutputDir, ktoCount);
      if (ktoResults.length > 0) {
        onProgress(`  KTO 실사진 ${ktoResults.length}개 다운로드 완료`);
        imagePaths.push(...ktoResults.map(r => r.localPath));
      }
    }
  }

  // ── Step 2: KTO 사진을 content 중간에 삽입 ──
  let processedContent = content;
  if (ktoResults.length > 0) {
    processedContent = insertKtoImages(processedContent, ktoResults);
  }

  // ── Step 3: 나머지 슬롯은 기존 AI 마커 기반 생성 ──
  const remainingSlots = imageCount - ktoResults.length;

  if (remainingSlots > 0) {
    const geminiClient = new GeminiImageClient();

    if (!geminiClient.isConfigured() || !geminiClient.isEnabled()) {
      if (ktoResults.length === 0) {
        onProgress('Gemini 이미지 생성이 비활성화되어 있습니다. 마커를 제거합니다.');
      }
      processedContent = removeImageMarkers(processedContent);
      return { content: processedContent, imagePaths };
    }

    const usageCheck = await geminiClient.checkUsageLimit(remainingSlots);
    if (!usageCheck.allowed) {
      onProgress(`${usageCheck.warning} AI 이미지 생성을 건너뜁니다.`);
      processedContent = removeImageMarkers(processedContent);
      return { content: processedContent, imagePaths };
    }

    if (usageCheck.warning) {
      onProgress(`주의: ${usageCheck.warning}`);
    }

    // 마커 추출 또는 자동 삽입
    let markers = extractImageMarkers(processedContent);
    if (markers.length === 0) {
      onProgress('이미지 마커가 없습니다. 적절한 위치에 자동 삽입합니다.');
      processedContent = insertAutoMarkers(processedContent, type, remainingSlots);
      markers = extractImageMarkers(processedContent);
    }

    const markersToProcess = markers.slice(0, remainingSlots);

    if (markersToProcess.length > 0) {
      onProgress(`${markersToProcess.length}개의 AI 인라인 이미지 생성 중...`);

      const imageResults: ImageResult[] = [];
      const { locations, items } = extractContentContext(processedContent);
      const imageContext: ImageContext = { topic, type, locations, items };

      for (let i = 0; i < markersToProcess.length; i++) {
        const marker = markersToProcess[i];
        onProgress(`  [${i + 1}/${markersToProcess.length}] ${marker.style} 이미지 생성 중...`);

        try {
          const promptInfo = generatePromptFromMarker(marker.marker, imageContext);
          if (!promptInfo) {
            onProgress(`    스킵: 잘못된 마커 형식`);
            continue;
          }

          const generatedImage = await geminiClient.generateImage({
            prompt: promptInfo.prompt,
            style: promptInfo.style,
            aspectRatio: '16:9',
            topic
          });

          const filename = `inline-${slug}-${i + 1}`;
          const savedImage = await saveImage(generatedImage, imageOutputDir, filename);

          imageResults.push({
            marker,
            relativePath: savedImage.relativePath,
            alt: marker.description,
            caption: savedImage.caption
          });

          imagePaths.push(savedImage.filepath);
          onProgress(`    완료: ${savedImage.relativePath}`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          onProgress(`    실패: ${errorMessage}`);
        }
      }

      if (imageResults.length > 0) {
        processedContent = insertImages(processedContent, imageResults);
      }
    }
  }

  // 처리되지 않은 마커 제거
  processedContent = removeImageMarkers(processedContent);

  return {
    content: processedContent,
    imagePaths
  };
}
