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
  BatchTimeoutError,
  type ImageStyle,
  type BatchImageRequest,
} from './gemini-imagen.js';
import {
  insertImages,
  removeImageMarkers,
  insertAutoMarkers,
  extractImageMarkers,
  type ImageResult,
  type ImageMarker,
} from '../generator/content-parser.js';
import { generatePromptFromMarker, type ImageContext } from '../generator/image-prompts.js';
import type { CollectedData } from '../agents/collector.js';
import { extractGeoScope, isGeoCompatible, type GeoScope } from './geo-context.js';
import { parseSections, summarizeSectionNarrative, type ContentSection } from '../generator/content-parser.js';

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
  /** 페르소나 ID (스틸컷 비주얼 아이덴티티 적용용) */
  personaId?: string;
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
      // 지리적 스코프로 미스매치 후보 감점
      const geoScope = extractGeoScope('', topic);
      const bestCover = selectBestCoverImage(ktoCandidates, topic, geoScope);
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
 * 텍스트에서 한글/알파벳 단어만 추출 (구두점·마크다운 제거)
 */
function extractWords(text: string): string[] {
  return text.replace(/[^\p{Script=Hangul}\p{L}\s]/gu, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 2);
}

/**
 * 토픽에서 지역명 stopword 추출
 * 2~3자 한글 단어는 대부분 지역명 (양평, 가평, 거제, 서울 등)
 * 4자+ 단어는 고유명사(국립양평치유의숲)이므로 제외
 */
function buildGeoStopwords(topic: string, geoScope?: GeoScope): Set<string> {
  const topicShortWords = extractWords(topic).filter(w => w.length <= 3);
  const regionNames = geoScope?.mentionedRegions ?? [];
  return new Set([...topicShortWords, ...regionNames]);
}

/**
 * KTO 이미지 제목과 헤딩 텍스트의 유사도 점수 계산
 * 지역명 stopword 제외 후 고유명사 매칭 (맥락 불일치 방지)
 */
function headingImageSimilarity(
  headingText: string,
  imageTitle: string,
  stopwords?: Set<string>
): number {
  const headingWords = extractWords(headingText);
  const titleWords = extractWords(imageTitle);
  let score = 0;
  for (const hw of headingWords) {
    if (stopwords?.has(hw)) continue;
    for (const tw of titleWords) {
      if (stopwords?.has(tw)) continue;
      if (hw.includes(tw) || tw.includes(hw)) {
        score += 1;
      }
    }
  }
  return score;
}

/**
 * KTO 실사진을 콘텐츠 H2/H3 섹션 뒤에 삽입
 * 이미지 제목과 헤딩 텍스트 유사도 매칭으로 배치 (기존: 인덱스 순서)
 */
function insertKtoImages(content: string, ktoResults: KtoImageResult[], geoScope?: GeoScope, topic?: string): { content: string; insertedCount: number } {
  if (ktoResults.length === 0) return { content, insertedCount: 0 };

  const lines = content.split('\n');
  const headings: Array<{ index: number; text: string }> = [];

  for (let i = 0; i < lines.length; i++) {
    if (/^#{2,3}\s/.test(lines[i])) {
      headings.push({ index: i, text: lines[i] });
    }
  }

  if (headings.length === 0) {
    const imageBlocks = ktoResults.map(r =>
      `\n![${r.alt}](${r.relativePath})\n*${r.caption}*\n`
    );
    return { content: imageBlocks.join('') + '\n' + content, insertedCount: ktoResults.length };
  }

  // 지역명 stopword: topic + H1 제목 + geoScope 결합
  const h1Title = content.match(/^#\s+(.+)$/m)?.[1] ?? '';
  const stopwords = buildGeoStopwords(
    topic ? `${topic} ${h1Title}` : h1Title,
    geoScope
  );

  // 각 KTO 이미지를 가장 유사한 헤딩에 매칭 (stopword 제외)
  const assignments: Array<{ headingIdx: number; result: KtoImageResult }> = [];
  const usedHeadings = new Set<number>();

  for (const result of ktoResults) {
    let bestHeading = -1;
    let bestScore = 0; // 최소 1 이상이어야 배치

    for (let h = 0; h < headings.length; h++) {
      if (usedHeadings.has(h)) continue;
      const score = headingImageSimilarity(headings[h].text, result.title, stopwords);
      if (score > bestScore) {
        bestScore = score;
        bestHeading = h;
      }
    }

    // score > 0 (stopword 제외 후)인 경우에만 배치
    // score 0이면 맥락 매칭 실패 → 스킵 (강제 배치하지 않음)
    if (bestHeading >= 0 && bestScore > 0) {
      usedHeadings.add(bestHeading);
      assignments.push({ headingIdx: bestHeading, result });
    }
  }

  // 역순 삽입 (인덱스 변동 방지)
  assignments.sort((a, b) => headings[b.headingIdx].index - headings[a.headingIdx].index);

  for (const { headingIdx, result } of assignments) {
    const pos = findInsertAfterHeading(lines, headings[headingIdx].index);
    const imageBlock = `\n![${result.alt}](${result.relativePath})\n*${result.caption}*\n`;
    lines.splice(pos + 1, 0, imageBlock);
  }

  return { content: lines.join('\n'), insertedCount: assignments.length };
}

/**
 * 마커의 라인 번호로 속한 섹션 찾기
 */
/** 페르소나별 캡션 톤 */
const PERSONA_CAPTION_TONE: Record<string, (subject: string) => string> = {
  viral: (s) => `${s} — 이건 직접 봐야 됨`,
  friendly: (s) => `${s} — 직접 다녀왔어요`,
  informative: (s) => `${s} — 알면 더 깊은 여행`,
  niche: (s) => `${s} — 파면 팔수록 빠져들어요`,
};

/**
 * 역할 기반 캡션 생성 ("AI 생성 ~" 대신 맥락 내러티브)
 */
function buildImageCaption(style: ImageStyle, sectionTitle: string, personaId?: string): string {
  // 헤딩에서 번호/마크다운 제거
  const cleanTitle = sectionTitle.replace(/^[#\s\d.:]+/, '').trim();
  const shortTitle = cleanTitle.length > 20 ? cleanTitle.slice(0, 20) : cleanTitle;

  if (style === 'cover_photo') {
    // 스틸컷: 페르소나 톤 내러티브
    const toneFn = PERSONA_CAPTION_TONE[personaId ?? ''];
    return toneFn ? toneFn(shortTitle) : shortTitle;
  }

  // 일러스트: 간결한 설명 (AI 생성 없이)
  const illustMap: Partial<Record<ImageStyle, string>> = {
    moodboard: '감성 무드보드',
    diagram: '여정 일러스트',
    infographic: '정보 가이드',
    bucketlist: '버킷리스트',
    map: '코스 지도',
    comparison: '비교 가이드',
  };
  return `${shortTitle} ${illustMap[style] ?? '일러스트'}`;
}

function findSectionForMarker(sections: ContentSection[], markerLine: number): ContentSection | null {
  for (let i = sections.length - 1; i >= 0; i--) {
    if (markerLine >= sections[i].startLine) {
      return sections[i];
    }
  }
  return sections.length > 0 ? sections[0] : null;
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
  const { content, topic, type, slug, imageCount, collectedImages, personaId, onProgress = () => {} } = options;

  const imageOutputDir = join(process.cwd(), 'blog', 'static', 'images');
  const imagePaths: string[] = [];

  // ── Step 0: 지리적 스코프 추출 ──
  const geoScope = extractGeoScope(content, topic);

  // ── Step 1: KTO 실사진 다운로드 (커버에 안 쓴 것들, 지리적 필터링) ──
  let ktoResults: KtoImageResult[] = [];
  if (collectedImages && collectedImages.length > 0) {
    // 커버에 사용한 첫 번째 후보(index 0)는 제외
    let inlineCandidates = collectedImages.slice(1);

    // 지리적 미스매치 후보 필터링
    if (geoScope.primaryRegion) {
      const filtered = inlineCandidates.filter(c => isGeoCompatible(c.address, geoScope));
      if (filtered.length > 0) {
        inlineCandidates = filtered;
      }
      // 필터 후 후보가 0이면 원본 유지 (보수적)
    }

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

  // ── Step 2: KTO 사진을 content 중간에 삽입 (헤딩-제목 유사도 매칭) ──
  let processedContent = content;
  let ktoInsertedCount = 0;
  if (ktoResults.length > 0) {
    const ktoInsertResult = insertKtoImages(processedContent, ktoResults, geoScope, topic);
    processedContent = ktoInsertResult.content;
    ktoInsertedCount = ktoInsertResult.insertedCount;
  }

  // ── Step 3: 나머지 슬롯은 AI 마커 기반 생성 ──
  // 실제 삽입된 KTO 수 기준 (다운로드만 되고 미삽입된 것은 제외)
  const remainingSlots = imageCount - ktoInsertedCount;

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

    // 기존 Gemini 마커를 제거하고 역할 기반 마커로 재삽입
    // (Gemini가 모든 마커를 infographic/diagram으로 생성하는 문제 방지)
    processedContent = removeImageMarkers(processedContent);
    processedContent = insertAutoMarkers(processedContent, type, remainingSlots);
    let markers = extractImageMarkers(processedContent);

    const markersToProcess = markers.slice(0, remainingSlots);

    if (markersToProcess.length > 0) {
      const useBatch = process.env.GEMINI_BATCH_ENABLED !== 'false';
      const modeLabel = useBatch ? '배치' : '순차';
      onProgress(`${markersToProcess.length}개의 AI 인라인 이미지 생성 중 (${modeLabel} 모드)...`);

      const globalContext = extractContentContext(processedContent);
      const sections = parseSections(processedContent);

      // 섹션별 내러티브 힌트 맵 구축 (이미지 프롬프트에 서사 컨텍스트 제공)
      const sectionNarratives = new Map<string, string>();
      for (const section of sections) {
        const hint = summarizeSectionNarrative(section.content, section.title);
        if (hint) sectionNarratives.set(section.title, hint);
      }

      // Phase 1: 프롬프트 사전 수집
      const markerContexts: Array<{
        marker: ImageMarker;
        section: ContentSection | null;
        promptInfo: { prompt: string; style: ImageStyle } | null;
      }> = [];

      for (let i = 0; i < markersToProcess.length; i++) {
        const marker = markersToProcess[i];
        const section = findSectionForMarker(sections, marker.line);
        const sectionLocations = section?.mentionedLocations ?? [];
        const sectionKeywords = section?.sectionKeywords ?? [];

        const imageContext: ImageContext = {
          topic,
          type,
          section: section?.title,
          narrativeHint: section ? sectionNarratives.get(section.title) : undefined,
          locations: sectionLocations.length > 0 ? sectionLocations : globalContext.locations,
          items: sectionKeywords.length > 0 ? sectionKeywords : globalContext.items,
          personaId,
        };

        const promptInfo = generatePromptFromMarker(marker.marker, imageContext);
        markerContexts.push({ marker, section, promptInfo });
      }

      let imageResults: ImageResult[] = [];

      if (useBatch) {
        // Phase 2a: 배치 제출 + 폴링
        const batchRequests: BatchImageRequest[] = [];
        for (const ctx of markerContexts) {
          if (ctx.promptInfo) {
            batchRequests.push({
              prompt: ctx.promptInfo.prompt,
              style: ctx.promptInfo.style,
              aspectRatio: '16:9',
              topic,
              personaId,
            });
          }
        }

        if (batchRequests.length > 0) {
          try {
            const batchResults = await geminiClient.generateImagesBatch(
              batchRequests,
              { pollIntervalMs: 5000, timeoutMs: 600_000, onProgress }
            );

            // Phase 3: 결과 매핑 + 저장
            let batchIdx = 0;
            for (let i = 0; i < markerContexts.length; i++) {
              const { marker, section, promptInfo } = markerContexts[i];
              if (!promptInfo) {
                onProgress(`  스킵: 잘못된 마커 형식`);
                continue;
              }

              const result = batchResults[batchIdx++];
              if (result?.success && result.image) {
                const filename = `inline-${slug}-${i + 1}`;
                const savedImage = await saveImage(
                  result.image, imageOutputDir, filename,
                  { optimize: true, maxWidth: 1200, quality: 85 }
                );

                const caption = buildImageCaption(
                  marker.style,
                  section?.title ?? marker.description,
                  personaId
                );

                imageResults.push({
                  marker,
                  relativePath: savedImage.relativePath,
                  alt: marker.description,
                  caption,
                });

                imagePaths.push(savedImage.filepath);
                onProgress(`  완료: ${savedImage.relativePath}`);
              } else {
                onProgress(`  실패 [${i + 1}]: ${result?.error || '알 수 없는 오류'}`);
              }
            }
          } catch (error) {
            if (error instanceof BatchTimeoutError) {
              onProgress(`배치 시간 초과 — 순차 모드로 폴백합니다...`);
              imageResults = await processMarkersSequentially(
                markerContexts, geminiClient, slug, imageOutputDir, personaId, imagePaths, onProgress
              );
            } else {
              throw error;
            }
          }
        }
      } else {
        // Phase 2b: 순차 모드 (GEMINI_BATCH_ENABLED=false 또는 폴백)
        imageResults = await processMarkersSequentially(
          markerContexts, geminiClient, slug, imageOutputDir, personaId, imagePaths, onProgress
        );
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

// ─── 순차 이미지 생성 (배치 실패 시 폴백) ─────────────────────────

async function processMarkersSequentially(
  markerContexts: Array<{
    marker: ImageMarker;
    section: ContentSection | null;
    promptInfo: { prompt: string; style: ImageStyle } | null;
  }>,
  geminiClient: GeminiImageClient,
  slug: string,
  imageOutputDir: string,
  personaId: string | undefined,
  imagePaths: string[],
  onProgress: (msg: string) => void,
): Promise<ImageResult[]> {
  const results: ImageResult[] = [];

  for (let i = 0; i < markerContexts.length; i++) {
    const { marker, section, promptInfo } = markerContexts[i];
    if (!promptInfo) {
      onProgress(`  스킵: 잘못된 마커 형식`);
      continue;
    }

    onProgress(`  [${i + 1}/${markerContexts.length}] ${marker.style} 이미지 생성 중 (순차)...`);

    try {
      const generatedImage = await geminiClient.generateImage({
        prompt: promptInfo.prompt,
        style: promptInfo.style,
        aspectRatio: '16:9',
        topic: marker.description
      });

      const filename = `inline-${slug}-${i + 1}`;
      const savedImage = await saveImage(
        generatedImage, imageOutputDir, filename,
        { optimize: true, maxWidth: 1200, quality: 85 }
      );

      const caption = buildImageCaption(
        marker.style,
        section?.title ?? marker.description,
        personaId
      );

      results.push({
        marker,
        relativePath: savedImage.relativePath,
        alt: marker.description,
        caption,
      });

      imagePaths.push(savedImage.filepath);
      onProgress(`    완료: ${savedImage.relativePath}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      onProgress(`    실패: ${errorMessage}`);
    }
  }

  return results;
}
