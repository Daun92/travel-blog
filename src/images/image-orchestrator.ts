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
  extractImageMarkers,
  type ImageResult,
  type ImageMarker,
} from '../generator/content-parser.js';
import { generatePromptFromMarker, type ImageContext } from '../generator/image-prompts.js';
import type { CollectedData } from '../agents/collector.js';
import { extractGeoScope, isGeoCompatible, type GeoScope } from './geo-context.js';
import {
  parseSections,
  summarizeSectionNarrative,
  planImagePlacement,
  planToMarkers,
  type ContentSection,
  type ImagePlanEntry,
  type ImagePlan,
} from '../generator/content-parser.js';
import { validateImageNarrativeCoherence } from './image-validator.js';

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
 * 계획 기반 KTO 이미지 매칭
 * 각 plan entry의 mentionedLocations + narrativeContext를 활용하여
 * headingImageSimilarity보다 풍부한 맥락으로 매칭
 */
function matchKtoToPlan(
  plan: ImagePlan,
  ktoResults: KtoImageResult[],
  geoScope?: GeoScope,
  topic?: string
): Map<number, KtoImageResult> {
  const mapping = new Map<number, KtoImageResult>();
  const usedKto = new Set<number>();

  // plan 엔트리 중 preferKto=true인 것만 대상
  const ktoEntries = plan.entries.filter(e => e.preferKto);

  // 지역명 stopword 구축
  const h1Title = topic ?? '';
  const stopwords = buildGeoStopwords(h1Title, geoScope);

  for (const entry of ktoEntries) {
    let bestKtoIdx = -1;
    let bestScore = 0;

    for (let k = 0; k < ktoResults.length; k++) {
      if (usedKto.has(k)) continue;

      const ktoTitle = ktoResults[k].title;
      let score = 0;

      // 1. 헤딩 텍스트 매칭 (기존 로직)
      score += headingImageSimilarity(entry.sectionTitle, ktoTitle, stopwords);

      // 2. mentionedLocations 매칭 (확장)
      for (const loc of entry.mentionedLocations) {
        const locWords = extractWords(loc);
        const titleWords = extractWords(ktoTitle);
        for (const lw of locWords) {
          if (stopwords.has(lw)) continue;
          for (const tw of titleWords) {
            if (stopwords.has(tw)) continue;
            if (lw.includes(tw) || tw.includes(lw)) {
              score += 2; // 장소명 직접 매칭은 가중치 2배
            }
          }
        }
      }

      // 3. narrativeContext 키워드 매칭
      if (entry.narrativeContext) {
        const narrativeWords = extractWords(entry.narrativeContext).filter(w => !stopwords.has(w));
        const titleWords = extractWords(ktoTitle).filter(w => !stopwords.has(w));
        for (const nw of narrativeWords.slice(0, 5)) { // 상위 5개 키워드만
          for (const tw of titleWords) {
            if (nw.includes(tw) || tw.includes(nw)) {
              score += 1;
            }
          }
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestKtoIdx = k;
      }
    }

    if (bestKtoIdx >= 0 && bestScore > 0) {
      usedKto.add(bestKtoIdx);
      mapping.set(entry.sectionIndex, ktoResults[bestKtoIdx]);
    }
  }

  return mapping;
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

  // ── Step 2: 서사 기반 이미지 계획 생성 ──
  let processedContent = content;

  // LLM이 생성했을 수 있는 마커를 먼저 제거 (계획 기반으로 재배치)
  processedContent = removeImageMarkers(processedContent);

  // KTO 실사진을 계획 기반으로 삽입
  let ktoInsertedCount = 0;
  const imagePlan = planImagePlacement(processedContent, type, topic, imageCount, {
    ktoAvailable: ktoResults.length,
  });
  onProgress(`이미지 계획: ${imagePlan.entries.length}개 슬롯 (KTO ${imagePlan.ktoSlots} + AI ${imagePlan.aiSlots})`);

  // ── Step 3: 계획 기반 KTO 매칭 + 삽입 ──
  if (ktoResults.length > 0 && imagePlan.ktoSlots > 0) {
    const ktoMapping = matchKtoToPlan(imagePlan, ktoResults, geoScope, topic);

    if (ktoMapping.size > 0) {
      // 계획 순서대로 KTO 이미지 삽입
      const sections = parseSections(processedContent);
      const ktoAssignments: Array<{ sectionTitle: string; result: KtoImageResult }> = [];

      for (const [sectionIdx, ktoResult] of ktoMapping) {
        const entry = imagePlan.entries.find(e => e.sectionIndex === sectionIdx);
        if (entry) {
          ktoAssignments.push({ sectionTitle: entry.sectionTitle, result: ktoResult });
        }
      }

      const ktoInsertResult = insertKtoImages(processedContent, ktoAssignments.map(a => a.result), geoScope, topic);
      processedContent = ktoInsertResult.content;
      ktoInsertedCount = ktoInsertResult.insertedCount;
      onProgress(`  KTO 실사진 ${ktoInsertedCount}개 계획 위치에 삽입 완료`);
      imagePaths.push(...ktoResults.slice(0, ktoInsertedCount).map(r => r.localPath));
    }
  }

  // ── Step 4: 나머지 AI 슬롯 마커 삽입 ──
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

    // 서사 기반 마커 삽입 (기계적 insertAutoMarkers 대신 계획 기반)
    processedContent = removeImageMarkers(processedContent);
    const sections = parseSections(processedContent);
    processedContent = planToMarkers(processedContent, imagePlan, sections);
    let markers = extractImageMarkers(processedContent);

    const markersToProcess = markers.slice(0, remainingSlots);

    if (markersToProcess.length > 0) {
      const useBatch = process.env.GEMINI_BATCH_ENABLED !== 'false';
      const modeLabel = useBatch ? '배치' : '순차';
      onProgress(`${markersToProcess.length}개의 AI 인라인 이미지 생성 중 (${modeLabel} 모드)...`);

      const globalContext = extractContentContext(processedContent);
      const allSections = parseSections(processedContent);

      // 계획 엔트리에서 직접 서사 컨텍스트 가져오기
      const planEntryMap = new Map<string, ImagePlanEntry>();
      for (const entry of imagePlan.entries) {
        planEntryMap.set(entry.sectionTitle, entry);
      }

      // Phase 1: 프롬프트 사전 수집 (계획 기반 컨텍스트)
      const markerContexts: Array<{
        marker: ImageMarker;
        section: ContentSection | null;
        promptInfo: { prompt: string; style: ImageStyle } | null;
      }> = [];

      for (let i = 0; i < markersToProcess.length; i++) {
        const marker = markersToProcess[i];
        const section = findSectionForMarker(allSections, marker.line);
        const planEntry = section ? planEntryMap.get(section.title) : undefined;

        const imageContext: ImageContext = {
          topic,
          type,
          section: section?.title,
          narrativeHint: planEntry?.narrativeContext || (section ? summarizeSectionNarrative(section.content, section.title) : undefined),
          locations: planEntry?.mentionedLocations ?? section?.mentionedLocations ?? globalContext.locations,
          items: section?.sectionKeywords ?? globalContext.items,
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

  // ── Step 6: 서사-이미지 일관성 사후 검증 ──
  const coherenceResults = validateImageNarrativeCoherence(processedContent, topic, geoScope);

  const removeTargets = coherenceResults
    .filter(r => r.action === 'remove')
    .map(r => r.imagePath);

  if (removeTargets.length > 0) {
    onProgress(`서사 불일치 이미지 ${removeTargets.length}개 제거 중...`);
    for (const target of removeTargets) {
      const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const imgLineRegex = new RegExp(
        `\\n?!\\[[^\\]]*\\]\\(${escaped}\\)\\n?(?:\\*[^*]*\\*\\n?)?`, 'g'
      );
      processedContent = processedContent.replace(imgLineRegex, '\n');
    }
  }

  const warnings = coherenceResults.filter(r => r.action === 'warn');
  if (warnings.length > 0) {
    for (const w of warnings) {
      onProgress(`  경고: "${w.sectionTitle}" 섹션 이미지 서사 일관성 낮음 (${w.coherenceScore}점)`);
    }
  }

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
