/**
 * 이미지 검증 모듈
 * AI 생성 이미지와 Unsplash 이미지의 적절성 검증
 */

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import matter from 'gray-matter';
import { generate } from '../generator/gemini.js';
import { scoreImageRelevance, type UnsplashPhoto, type ImageSearchContext } from './unsplash.js';

/**
 * 이미지 검증 결과
 */
export interface ImageValidationResult {
  imagePath: string;
  isValid: boolean;
  isRelevant: boolean;           // 주제와 관련성
  hasWatermark: boolean;         // 워터마크 존재 여부
  isCopyrightSafe: boolean;      // 저작권 안전 (AI 생성 또는 Unsplash)
  matchesLocation: boolean;      // 장소와 일치 여부
  recommendation: 'use' | 'replace' | 'manual_check';
  issues: string[];
  details?: string;
}

/**
 * 포스트 이미지 검증 결과
 */
export interface PostImageValidationResult {
  filePath: string;
  title: string;
  validatedAt: string;
  coverImage: ImageValidationResult | null;
  inlineImages: ImageValidationResult[];
  overallScore: number;          // 0-100
  passesGate: boolean;
  recommendations: string[];
}

/**
 * 이미지 소스 타입
 */
type ImageSource = 'unsplash' | 'gemini' | 'kto' | 'local' | 'external' | 'unknown';

/**
 * 이미지 경로에서 소스 타입 추론
 */
function inferImageSource(imagePath: string): ImageSource {
  // Unsplash URL
  if (imagePath.includes('unsplash.com') || imagePath.includes('unsplash')) {
    return 'unsplash';
  }

  // KTO 한국관광공사 이미지
  if (imagePath.includes('kto-') || imagePath.includes('visitkorea')) {
    return 'kto';
  }

  // Refreshed cover (Gemini cover_photo)
  if (imagePath.includes('cover-refresh-')) {
    return 'gemini';
  }

  // AI 생성 이미지 (파일명 패턴)
  if (imagePath.includes('gemini-') ||
      imagePath.includes('inline-') ||
      imagePath.includes('ai-generated')) {
    return 'gemini';
  }

  // 로컬 이미지
  if (imagePath.startsWith('/') || imagePath.startsWith('./') || imagePath.startsWith('../')) {
    return 'local';
  }

  // 외부 URL
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return 'external';
  }

  return 'unknown';
}

/**
 * 이미지 파일 존재 확인
 */
function checkImageExists(imagePath: string, baseDir: string = 'blog/static'): boolean {
  // 상대 경로 처리
  let fullPath = imagePath;

  if (imagePath.startsWith('/travel-blog/')) {
    fullPath = `${baseDir}${imagePath.replace('/travel-blog', '')}`;
  } else if (imagePath.startsWith('/')) {
    fullPath = `${baseDir}${imagePath}`;
  }

  return existsSync(fullPath);
}

/**
 * 이미지 파일명에서 키워드 추출
 */
function extractKeywordsFromFilename(filename: string): string[] {
  // 파일명에서 확장자 제거 및 단어 분리
  const name = filename.replace(/\.[^.]+$/, '');
  const words = name.split(/[-_\s]+/).filter(w => w.length > 2);

  // 날짜 패턴 제거
  return words.filter(w => !/^\d{4}$/.test(w) && !/^\d{1,2}$/.test(w));
}

/**
 * AI를 사용한 이미지-콘텐츠 관련성 검증
 * (실제 이미지 분석이 아닌 메타데이터 기반)
 */
async function checkRelevanceWithAI(
  imageKeywords: string[],
  postTitle: string,
  postKeywords: string[]
): Promise<{ isRelevant: boolean; confidence: number; details: string }> {
  const prompt = `
다음 정보를 바탕으로 이미지가 포스트 주제와 관련이 있는지 판단해주세요.

이미지 키워드: ${imageKeywords.join(', ')}
포스트 제목: ${postTitle}
포스트 키워드: ${postKeywords.join(', ')}

다음 형식으로 응답해주세요:
RELEVANT: [YES/NO]
CONFIDENCE: [0-100]
REASON: [간단한 설명]
`.trim();

  try {
    const response = await generate(prompt, { temperature: 0.3, max_tokens: 200 });

    const relevantMatch = response.match(/RELEVANT:\s*(YES|NO)/i);
    const confidenceMatch = response.match(/CONFIDENCE:\s*(\d+)/);
    const reasonMatch = response.match(/REASON:\s*(.+)/);

    return {
      isRelevant: relevantMatch?.[1]?.toUpperCase() === 'YES',
      confidence: confidenceMatch ? parseInt(confidenceMatch[1], 10) : 50,
      details: reasonMatch?.[1]?.trim() || ''
    };
  } catch {
    // AI 분석 실패 시 기본값
    return {
      isRelevant: true,  // 보수적으로 관련 있다고 가정
      confidence: 30,
      details: 'AI 분석 실패, 수동 확인 권장'
    };
  }
}

/**
 * 단일 이미지 검증
 */
export async function validateImage(
  imagePath: string,
  context: {
    postTitle: string;
    postKeywords?: string[];
    venue?: string;
    isAiGenerated?: boolean;
  }
): Promise<ImageValidationResult> {
  const issues: string[] = [];
  let recommendation: ImageValidationResult['recommendation'] = 'use';

  // 1. 소스 타입 확인
  const source = inferImageSource(imagePath);

  // 2. 저작권 안전성
  const isCopyrightSafe = source === 'unsplash' || source === 'gemini' || source === 'kto' || source === 'local';
  if (!isCopyrightSafe) {
    issues.push('저작권 확인 필요 (외부 이미지)');
    recommendation = 'manual_check';
  }

  // 3. 이미지 존재 확인 (로컬 이미지만)
  if (source === 'local') {
    const exists = checkImageExists(imagePath);
    if (!exists) {
      issues.push('이미지 파일이 존재하지 않음');
      recommendation = 'replace';
    }
  }

  // 4. 워터마크 검사 (파일명 기반 휴리스틱)
  const filename = imagePath.split('/').pop() || '';
  const hasWatermark = filename.toLowerCase().includes('watermark') ||
                       filename.toLowerCase().includes('preview');

  if (hasWatermark) {
    issues.push('워터마크 있는 이미지로 추정');
    recommendation = 'replace';
  }

  // 5. 관련성 검사
  const imageKeywords = extractKeywordsFromFilename(filename);
  const postKeywords = context.postKeywords || [];

  let isRelevant = true;
  let matchesLocation = true;
  let relevanceDetails = '';

  // 키워드가 충분하면 AI 검증 시도
  if (imageKeywords.length > 0 && (context.postTitle || postKeywords.length > 0)) {
    try {
      const relevanceResult = await checkRelevanceWithAI(
        imageKeywords,
        context.postTitle,
        postKeywords
      );

      isRelevant = relevanceResult.isRelevant || relevanceResult.confidence >= 50;
      relevanceDetails = relevanceResult.details;

      if (!isRelevant && relevanceResult.confidence >= 60) {
        issues.push(`이미지가 주제와 관련 없을 수 있음: ${relevanceDetails}`);
        if (recommendation === 'use') {
          recommendation = 'manual_check';
        }
      }
    } catch {
      // AI 검증 실패 시 기본값 유지
    }
  }

  // 6. 장소 일치 검사 (AI 생성 이미지의 경우)
  if (context.isAiGenerated && context.venue) {
    // AI 이미지는 실제 장소와 정확히 일치하지 않을 수 있음
    matchesLocation = false;  // 보수적으로 불일치로 표시
    issues.push('AI 생성 이미지는 실제 장소와 다를 수 있음');

    // 실제 장소 사진이 중요한 경우
    if (context.venue.includes('맛집') || context.venue.includes('카페')) {
      recommendation = 'manual_check';
    }
  }

  // 최종 유효성 판단
  const isValid = issues.length === 0 ||
                  (issues.length <= 2 && recommendation !== 'replace');

  return {
    imagePath,
    isValid,
    isRelevant,
    hasWatermark,
    isCopyrightSafe,
    matchesLocation,
    recommendation,
    issues,
    details: relevanceDetails || undefined
  };
}

/**
 * 포스트의 모든 이미지 검증
 */
export async function validatePostImages(
  filePath: string,
  options: {
    skipAiCheck?: boolean;
    minScore?: number;
  } = {}
): Promise<PostImageValidationResult> {
  const { skipAiCheck = false, minScore = 70 } = options;

  // 파일 읽기
  const content = await readFile(filePath, 'utf-8');
  const { data: frontmatter, content: body } = matter(content);

  const title = frontmatter.title as string || 'Untitled';
  const keywords = [
    ...(frontmatter.tags || []),
    ...(frontmatter.keywords || [])
  ] as string[];
  const venue = frontmatter.venue as string;

  // 커버 이미지 검증
  let coverImage: ImageValidationResult | null = null;
  if (frontmatter.image) {
    coverImage = await validateImage(frontmatter.image as string, {
      postTitle: title,
      postKeywords: keywords,
      venue,
      isAiGenerated: (frontmatter.image as string).includes('gemini-')
    });
  }

  // 인라인 이미지 추출 및 검증
  const inlineImagePattern = /!\[([^\]]*)\]\(([^)]+)\)/g;
  const inlineImages: ImageValidationResult[] = [];
  let match;

  while ((match = inlineImagePattern.exec(body)) !== null) {
    const imagePath = match[2];

    // 이미 검증한 이미지 스킵
    if (inlineImages.some(img => img.imagePath === imagePath)) {
      continue;
    }

    const result = await validateImage(imagePath, {
      postTitle: title,
      postKeywords: keywords,
      venue,
      isAiGenerated: imagePath.includes('inline-') || imagePath.includes('gemini-')
    });

    inlineImages.push(result);

    // 너무 많은 이미지는 처음 10개만 검증
    if (inlineImages.length >= 10) break;
  }

  // 전체 점수 계산
  let totalScore = 100;
  const recommendations: string[] = [];

  // 커버 이미지 점수
  if (!coverImage) {
    totalScore -= 20;
    recommendations.push('커버 이미지 추가 권장');
  } else if (!coverImage.isValid) {
    totalScore -= 15;
    if (coverImage.recommendation === 'replace') {
      recommendations.push(`커버 이미지 교체 필요: ${coverImage.issues.join(', ')}`);
    }
  } else if (coverImage.recommendation === 'manual_check') {
    totalScore -= 5;
    recommendations.push('커버 이미지 수동 확인 권장');
  }

  // 인라인 이미지 최소 기준 패널티
  const categories = (frontmatter.categories as string[]) || [];
  const contentType = categories.includes('culture') ? 'culture' : 'travel';
  const minInlineImages = contentType === 'travel' ? 2 : 1;
  const penaltyPerMissing = contentType === 'travel' ? 15 : 10;
  const inlineCount = inlineImages.length;

  if (inlineCount < minInlineImages) {
    const missing = minInlineImages - inlineCount;
    totalScore -= missing * penaltyPerMissing;
    recommendations.push(
      `인라인 이미지 ${missing}개 추가 필요 (현재 ${inlineCount}개, ${contentType} 최소 ${minInlineImages}개)`
    );
  }

  // 인라인 이미지 품질 점수
  const invalidInlineCount = inlineImages.filter(img => !img.isValid).length;
  const replaceCount = inlineImages.filter(img => img.recommendation === 'replace').length;

  if (invalidInlineCount > 0) {
    totalScore -= invalidInlineCount * 5;
    recommendations.push(`${invalidInlineCount}개의 인라인 이미지 문제 발견`);
  }

  if (replaceCount > 0) {
    recommendations.push(`${replaceCount}개의 이미지 교체 필요`);
  }

  // AI 생성 이미지 경고 (KTO 실사진이 이미 있으면 불필요)
  const aiGeneratedCount = inlineImages.filter(img =>
    img.imagePath.includes('gemini-') || img.imagePath.includes('inline-')
  ).length;
  const ktoImageCount = inlineImages.filter(img =>
    img.imagePath.includes('kto-')
  ).length;

  if (aiGeneratedCount > 0 && ktoImageCount === 0 && venue) {
    recommendations.push(`${aiGeneratedCount}개의 AI 생성 이미지 - 실제 장소 사진으로 교체 고려`);
  }

  const passesGate = totalScore >= minScore;

  return {
    filePath,
    title,
    validatedAt: new Date().toISOString(),
    coverImage,
    inlineImages,
    overallScore: Math.max(0, totalScore),
    passesGate,
    recommendations
  };
}

/**
 * 이미지 검증 점수 계산 (품질 게이트용)
 */
export function calculateImageScore(result: PostImageValidationResult): number {
  return result.overallScore;
}
