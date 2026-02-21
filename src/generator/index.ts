/**
 * 콘텐츠 생성기 메인 모듈
 */

import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import {
  getTravelPrompt,
  getCulturePrompt,
  getKeywordPrompt,
  getTitlePrompt,
  type PromptContext
} from './prompts.js';
import {
  generate,
  checkGeminiStatus,
  listModels
} from './gemini.js';
import {
  generateFrontmatter,
  generateSlug,
  extractSlugWithoutDate,
  parseSeoMeta,
  generateMarkdownFile,
  type FrontmatterData
} from './frontmatter.js';
import {
  removeImageMarkers,
} from './content-parser.js';
import {
  processLinks,
  processLinksWithInfo,
  analyzeLinkMarkers
} from './link-processor.js';
import {
  getMaxImagesPerPost,
} from '../images/gemini-imagen.js';
import { selectPersona } from '../agents/draft-enhancer/persona-loader.js';
import {
  processInlineImages,
} from '../images/image-orchestrator.js';
import type { KtoImageCandidate } from '../images/kto-images.js';

export interface GeneratePostOptions {
  topic: string;
  type: 'travel' | 'culture';
  keywords?: string[];
  length?: 'short' | 'medium' | 'long';
  draft?: boolean;
  outputDir?: string;
  coverImage?: string;
  coverAlt?: string;
  coverCaption?: string;
  inlineImages?: boolean;
  imageCount?: number;
  persona?: string;
  /** 콘텐츠 프레이밍 유형 (list_ranking, deep_dive, experience, ...) */
  framingType?: string;
  /** dataToPromptContext()로 생성된 수집 데이터 텍스트 */
  collectedData?: string;
  /** KTO API에서 추출된 이미지 후보 목록 */
  collectedImages?: KtoImageCandidate[];
  /** KTO 이미지가 커버에 사용되었는지 여부 */
  ktoImagesUsed?: boolean;
  onProgress?: (message: string) => void;
}

export interface GeneratedPost {
  filename: string;
  filepath: string;
  frontmatter: FrontmatterData;
  content: string;
  inlineImages?: string[];
}

/**
 * 블로그 포스트 생성
 */
export async function generatePost(options: GeneratePostOptions): Promise<GeneratedPost> {
  const {
    topic,
    type,
    keywords = [],
    length = 'medium',
    draft = true,
    outputDir = './drafts',
    coverImage,
    coverAlt,
    coverCaption,
    inlineImages = false,
    imageCount = 3,
    persona: personaOverride,
    framingType,
    collectedData,
    collectedImages,
    ktoImagesUsed = false,
    onProgress = () => {}
  } = options;

  // LLM API 상태 확인
  onProgress('Gemini API 연결 확인 중...');
  const isOnline = await checkGeminiStatus();
  if (!isOnline) {
    throw new Error('Gemini API 키가 설정되지 않았습니다. .env에 GEMINI_API_KEY를 설정하세요.');
  }

  // 페르소나 선택
  onProgress('에이전트 페르소나 선택 중...');
  const selectedPersona = await selectPersona(topic, type, keywords, personaOverride);
  if (selectedPersona) {
    onProgress(`에이전트 선택: ${selectedPersona.name} (${selectedPersona.id})`);
  }

  // 프롬프트 생성
  onProgress('프롬프트 생성 중...');
  const context: PromptContext = { topic, type, keywords, length, persona: selectedPersona || undefined, framingType, collectedData };
  const prompt = type === 'travel'
    ? getTravelPrompt(context)
    : getCulturePrompt(context);

  // AI 콘텐츠 생성
  onProgress('AI가 콘텐츠 생성 중... (1-2분 소요)');
  const rawContent = await generate(prompt, {
    temperature: 0.7,
    max_tokens: 4096
  });

  // SEO 메타데이터 추출
  onProgress('SEO 메타데이터 추출 중...');
  const { title, description, keywords: seoKeywords, slug: seoSlug, content: parsedContent } = parseSeoMeta(rawContent);

  // 제목 추출 (SEO에서 못 찾으면 본문에서 추출)
  const finalTitle = title || extractTitleFromContent(parsedContent) || topic;
  const finalDescription = description || extractDescriptionFromContent(parsedContent) || topic;
  const finalKeywords = seoKeywords || keywords;

  // 슬러그 생성: LLM SEO slug 우선 → generateSlug 폴백
  const slug = seoSlug
    ? generateSlug(seoSlug, outputDir)
    : generateSlug(finalTitle, outputDir, topic);
  if (seoSlug) {
    onProgress(`LLM 생성 slug 사용: ${seoSlug}`);
  }

  // 인라인 이미지 처리
  let finalContent = parsedContent;
  const generatedImagePaths: string[] = [];

  if (inlineImages) {
    onProgress('인라인 이미지 처리 중...');
    const imageResult = await processInlineImages({
      content: parsedContent,
      topic,
      type,
      slug,
      imageCount: Math.min(imageCount, getMaxImagesPerPost()),
      collectedImages,
      personaId: selectedPersona?.id,
      onProgress
    });
    finalContent = imageResult.content;
    generatedImagePaths.push(...imageResult.imagePaths);
  } else {
    // 인라인 이미지 비활성화 시 마커 제거
    finalContent = removeImageMarkers(parsedContent);
  }

  // 실용 링크 처리
  const linkAnalysis = analyzeLinkMarkers(finalContent);
  if (linkAnalysis.totalMarkers > 0) {
    onProgress(`실용 링크 처리 중... (${linkAnalysis.totalMarkers}개 마커 발견)`);
    const linkResult = processLinksWithInfo(finalContent);
    finalContent = linkResult.content;
    if (linkResult.processed.length > 0) {
      onProgress(`  ${linkResult.processed.length}개 링크 변환 완료`);
    }
    if (linkResult.failed.length > 0) {
      onProgress(`  ${linkResult.failed.length}개 링크 변환 실패 (텍스트로 대체)`);
    }
  }

  // 프론트매터 데이터 구성
  const authorName = selectedPersona?.authorLine || 'Blog Author';
  const frontmatter: FrontmatterData = {
    title: finalTitle,
    slug: extractSlugWithoutDate(slug),
    date: new Date(),
    draft,
    description: finalDescription,
    summary: finalDescription,
    tags: type === 'travel'
      ? ['여행', '국내여행', ...finalKeywords.slice(0, 3)]
      : ['문화', '예술', ...finalKeywords.slice(0, 3)],
    categories: [type],
    keywords: finalKeywords,
    author: authorName,
    personaId: selectedPersona?.id,
    ...(framingType ? { framingType } : {}),
    ...(ktoImagesUsed ? { dataSources: ['한국관광공사'] } : {}),
    ...(coverImage && {
      cover: {
        image: coverImage,
        alt: coverAlt || finalTitle,
        caption: coverCaption,
        relative: false,
        hidden: false
      }
    })
  };

  // 파일명 생성
  const filename = `${slug}.md`;

  // 출력 디렉토리 생성
  const filepath = join(outputDir, filename);
  await mkdir(dirname(filepath), { recursive: true });

  // 마크다운 파일 생성
  const markdown = generateMarkdownFile(frontmatter, finalContent);
  await writeFile(filepath, markdown, 'utf-8');

  onProgress(`포스트 생성 완료: ${filename}`);

  return {
    filename,
    filepath,
    frontmatter,
    content: finalContent,
    ...(generatedImagePaths.length > 0 && { inlineImages: generatedImagePaths })
  };
}

/**
 * 키워드 추천
 */
export async function recommendKeywords(
  category: 'travel' | 'culture' | 'all' = 'all'
): Promise<Array<{
  keyword: string;
  category: string;
  difficulty: string;
  reason: string;
}>> {
  const isOnline = await checkGeminiStatus();
  if (!isOnline) {
    throw new Error('Gemini API 키가 설정되지 않았습니다.');
  }

  const prompt = getKeywordPrompt(category);
  const response = await generate(prompt, {
    temperature: 0.8,
    max_tokens: 2048
  });

  // JSON 추출
  const jsonMatch = response.match(/```json\s*([\s\S]*?)```/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1]);
    } catch {
      return [];
    }
  }

  return [];
}

/**
 * 제목 추천
 */
export async function suggestTitles(
  topic: string,
  type: 'travel' | 'culture'
): Promise<string[]> {
  const isOnline = await checkGeminiStatus();
  if (!isOnline) {
    throw new Error('Gemini API 키가 설정되지 않았습니다.');
  }

  const prompt = getTitlePrompt(topic, type);
  const response = await generate(prompt, {
    temperature: 0.9,
    max_tokens: 1024
  });

  // JSON 추출
  const jsonMatch = response.match(/```json\s*([\s\S]*?)```/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1]);
    } catch {
      return [];
    }
  }

  return [];
}

/**
 * 콘텐츠에서 제목 추출
 */
function extractTitleFromContent(content: string): string | null {
  const titleMatch = content.match(/^#\s+(.+)$/m);
  return titleMatch ? titleMatch[1].trim() : null;
}

/**
 * 콘텐츠에서 설명 추출
 */
function extractDescriptionFromContent(content: string): string | null {
  // 첫 번째 문단 추출
  const lines = content.split('\n').filter(line =>
    line.trim() && !line.startsWith('#') && !line.startsWith('!')
  );

  if (lines.length > 0) {
    const firstPara = lines[0].trim();
    return firstPara.length > 150
      ? firstPara.slice(0, 147) + '...'
      : firstPara;
  }

  return null;
}

// 모듈 내보내기
export {
  checkGeminiStatus,
  listModels,
  generateFrontmatter,
  generateSlug,
  parseSeoMeta
};
