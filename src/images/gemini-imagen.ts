/**
 * Gemini AI 이미지 생성 모듈
 * Google Gemini API를 사용한 인포그래픽, 다이어그램, 지도 등 설명 이미지 생성
 */

import { writeFile, mkdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { existsSync } from 'fs';

export type ImageStyle = 'infographic' | 'diagram' | 'map' | 'comparison' | 'moodboard' | 'bucketlist' | 'cover_photo';
export type AspectRatio = '16:9' | '4:3' | '1:1';

export interface ImageGenerationOptions {
  prompt: string;
  style: ImageStyle;
  aspectRatio?: AspectRatio;
  topic?: string;
  locale?: string;
}

export interface GeneratedImage {
  base64Data: string;
  mimeType: string;
  prompt: string;
  style: ImageStyle;
}

export interface SavedImage {
  filepath: string;
  relativePath: string;
  alt: string;
  caption: string;
}

interface UsageStats {
  date: string;
  count: number;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
        inlineData?: {
          data: string;
          mimeType: string;
        };
      }>;
    };
  }>;
}

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-3.0-pro-preview';

// 일일 사용량 제한
const DAILY_IMAGE_LIMIT = parseInt(process.env.GEMINI_IMAGE_MAX_COUNT || '50', 10);
const WARNING_THRESHOLD = Math.floor(DAILY_IMAGE_LIMIT * 0.8);
const MAX_IMAGES_PER_POST = 5;

/**
 * Gemini 이미지 생성 클라이언트
 */
export class GeminiImageClient {
  private apiKey: string;
  private model: string;
  private usageFilePath: string;

  constructor(apiKey?: string, model?: string) {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY || '';
    this.model = model || process.env.GEMINI_IMAGE_MODEL || DEFAULT_MODEL;
    this.usageFilePath = join(process.cwd(), 'data', 'gemini-usage.json');
  }

  /**
   * API 키 유효성 확인
   */
  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  /**
   * 이미지 생성 기능 활성화 여부
   */
  isEnabled(): boolean {
    const enabled = process.env.GEMINI_IMAGE_ENABLED;
    return enabled === 'true' || enabled === '1';
  }

  /**
   * 일일 사용량 확인
   */
  async getDailyUsage(): Promise<number> {
    const today = new Date().toISOString().split('T')[0];

    try {
      if (existsSync(this.usageFilePath)) {
        const data = await readFile(this.usageFilePath, 'utf-8');
        const stats: UsageStats = JSON.parse(data);

        if (stats.date === today) {
          return stats.count;
        }
      }
    } catch {
      // 파일 읽기 실패 시 0 반환
    }

    return 0;
  }

  /**
   * 사용량 증가
   */
  private async incrementUsage(): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    let count = 0;

    try {
      if (existsSync(this.usageFilePath)) {
        const data = await readFile(this.usageFilePath, 'utf-8');
        const stats: UsageStats = JSON.parse(data);

        if (stats.date === today) {
          count = stats.count;
        }
      }
    } catch {
      // 무시
    }

    count += 1;

    await mkdir(dirname(this.usageFilePath), { recursive: true });
    await writeFile(
      this.usageFilePath,
      JSON.stringify({ date: today, count }, null, 2),
      'utf-8'
    );

    return count;
  }

  /**
   * 사용량 한도 확인
   */
  async checkUsageLimit(requestCount: number = 1): Promise<{
    allowed: boolean;
    current: number;
    limit: number;
    warning?: string;
  }> {
    const current = await this.getDailyUsage();
    const afterRequest = current + requestCount;

    if (afterRequest > DAILY_IMAGE_LIMIT) {
      return {
        allowed: false,
        current,
        limit: DAILY_IMAGE_LIMIT,
        warning: `일일 이미지 생성 한도(${DAILY_IMAGE_LIMIT}개) 초과`
      };
    }

    if (afterRequest >= WARNING_THRESHOLD) {
      return {
        allowed: true,
        current,
        limit: DAILY_IMAGE_LIMIT,
        warning: `일일 한도의 ${Math.round((afterRequest / DAILY_IMAGE_LIMIT) * 100)}% 사용 중`
      };
    }

    return {
      allowed: true,
      current,
      limit: DAILY_IMAGE_LIMIT
    };
  }

  /**
   * 이미지 생성
   */
  async generateImage(options: ImageGenerationOptions): Promise<GeneratedImage> {
    if (!this.isConfigured()) {
      throw new Error('Gemini API 키가 설정되지 않았습니다. GEMINI_API_KEY 환경변수를 설정하세요.');
    }

    if (!this.isEnabled()) {
      throw new Error('Gemini 이미지 생성이 비활성화되어 있습니다. GEMINI_IMAGE_ENABLED=true로 설정하세요.');
    }

    // 사용량 확인
    const usageCheck = await this.checkUsageLimit();
    if (!usageCheck.allowed) {
      throw new Error(usageCheck.warning);
    }

    const { prompt, style, aspectRatio = '16:9' } = options;

    // 프롬프트 구성
    const fullPrompt = this.buildPrompt(prompt, style, aspectRatio);

    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: fullPrompt
            }
          ]
        }
      ],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE']
      }
    };

    const response = await fetch(
      `${GEMINI_API_URL}/${this.model}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API 오류: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as GeminiResponse;

    // 응답에서 이미지 추출
    const parts = data.candidates?.[0]?.content?.parts;
    if (!parts) {
      throw new Error('Gemini 응답에서 콘텐츠를 찾을 수 없습니다.');
    }

    const imagePart = parts.find((p: { inlineData?: { data: string; mimeType: string } }) =>
      p.inlineData?.data
    );

    if (!imagePart?.inlineData) {
      throw new Error('Gemini 응답에서 이미지를 찾을 수 없습니다.');
    }

    // 사용량 기록
    await this.incrementUsage();

    return {
      base64Data: imagePart.inlineData.data,
      mimeType: imagePart.inlineData.mimeType || 'image/png',
      prompt,
      style
    };
  }

  /**
   * 스타일별 프롬프트 구성 - 감성적이고 공유하고 싶은 이미지
   */
  private buildPrompt(prompt: string, style: ImageStyle, aspectRatio: AspectRatio): string {
    const aspectGuide: Record<AspectRatio, string> = {
      '16:9': 'horizontal layout optimized for blog posts and social sharing',
      '4:3': 'slightly horizontal layout, good for Pinterest',
      '1:1': 'square layout, perfect for Instagram'
    };

    const styleGuides: Record<ImageStyle, string> = {
      infographic: `Create a beautiful, shareable Korean travel infographic.
Style: Hand-drawn journal aesthetic with watercolor textures.
Colors: Warm cream base, muted terracotta, sage green, dusty blue accents.
Layout: Scrapbook-style arrangement, NOT rigid corporate grid.
Elements: Small stamps, tickets, dotted lines, charming hand-drawn icons.
Text: Mix of neat Korean labels and casual handwritten notes.
Mood: Like a page from a friend's travel journal.
Do NOT create cold corporate infographics or sterile layouts.`,

      diagram: `Create an illustrated adventure path diagram.
Style: Treasure map meets travel blog - exciting and inviting.
Colors: Warm yellows, coral highlights, forest green, sky blue.
Layout: Winding illustrated path, NOT straight arrows or flowcharts.
Elements: Charming landmark illustrations, cute transport icons, time bubbles.
Line quality: Hand-drawn with confident, slightly wobbly charm.
Mood: The journey IS the destination - make it feel like an adventure.
Do NOT create metro-style technical diagrams or corporate flowcharts.`,

      map: `Create a hand-illustrated walking tour map.
Style: Treasure map aesthetic - invites exploration and discovery.
Colors: Paper-tan background, ink-blue outlines, watercolor spot colors.
Perspective: Playful isometric or tilted bird's-eye view.
Elements: Illustrated buildings with personality, photo spot icons, secret tip bubbles.
Details: Reward close inspection with tiny surprises and hidden gems.
Text: Handwritten Korean labels for authentic local feel.
Mood: Like a map your cool local friend drew just for you.
Do NOT use Google Maps style, generic pins, or sterile digital look.`,

      comparison: `Create a delightful menu-board style comparison.
Style: Cute cafe chalkboard aesthetic - choosing is half the fun.
Colors: Cream background, warm accent colors, appetizing food tones.
Layout: Playful cards, NOT boring spreadsheet tables.
Elements: Charming food/item illustrations, vintage-style price tags, star ratings as cute icons.
Badges: "Staff pick", "Most popular", "Best for couples" recommendations.
Typography: Chalkboard menu aesthetic with Korean charm.
Mood: Everything looks good - happy dilemma!
Do NOT create clinical comparison tables or corporate charts.`,

      moodboard: `Create an evocative travel mood board.
Style: Pinterest-worthy collage that captures a destination's soul.
Colors: Extracted from the destination's visual identity.
Layout: Organic collage with overlapping elements, texture samples.
Elements: Atmospheric scenes, local details, color swatches, weather icons.
Textures: Paper grain, fabric, natural materials feeling.
Text: Evocative Korean words describing the feeling of the place.
Mood: "I NEED to go there" inspiration - feel before you visit.
Do NOT create generic travel posters or stock photo collages.`,

      bucketlist: `Create an illustrated bucket list checklist.
Style: Gamified exploration - achievement unlocked aesthetic.
Layout: Vertical checklist with illustrated checkbox squares.
Elements: Mini illustrated scenes (not just text), "unlock achievement" badges.
Mix: Obvious highlights AND hidden gems, "bonus" secret items.
Interaction: Empty checkboxes invite engagement - looks printable.
Mood: Make visitors want to complete the FULL list.
Do NOT create plain text checklists or boring todo lists.`,

      cover_photo: `Generate a photorealistic photograph for a Korean travel blog cover.
Style: Professional travel photography, authentic Korean atmosphere.
Composition: Fill the ENTIRE frame edge-to-edge with the photograph. No margins, no white space, no empty areas.
Quality: DSLR-quality, sharp focus, professional color grading.
CRITICAL: Must look like a REAL photograph. NO illustration, NO digital art, NO cartoon.
Do NOT include any text, watermark, logo, caption, title, description, or overlay. Pure photograph only.
The image must extend to ALL four edges — top, bottom, left, right. No border, no padding.`
    };

    // cover_photo는 getCoverPhotoPrompt()에서 자체 CRITICAL REQUIREMENTS를 포함하므로
    // 일반 스타일 가이드와 공통 요구사항이 충돌하지 않도록 분기
    if (style === 'cover_photo') {
      return `${styleGuides[style]}

Aspect ratio: ${aspectGuide[aspectRatio]}

${prompt}`;
    }

    return `${styleGuides[style]}

Aspect ratio: ${aspectGuide[aspectRatio]}

Content to visualize:
${prompt}

CRITICAL REQUIREMENTS:
- All Korean text must be CLEARLY READABLE (no blur)
- Make it INSTAGRAM/PINTEREST WORTHY - people should want to save and share
- Vector-style graphics, optimized for web display
- Consistent illustration style throughout
- This should look like premium content, not generic AI output`;
  }
}

/**
 * 이미지 저장
 */
export async function saveImage(
  image: GeneratedImage,
  outputDir: string,
  filename: string
): Promise<SavedImage> {
  // MIME 타입에서 확장자 추출
  const ext = image.mimeType.split('/')[1] || 'png';
  const fullFilename = filename.endsWith(`.${ext}`) ? filename : `${filename}.${ext}`;
  const filepath = join(outputDir, fullFilename);

  // 디렉토리 생성
  await mkdir(dirname(filepath), { recursive: true });

  // Base64 디코딩 및 저장
  const buffer = Buffer.from(image.base64Data, 'base64');
  await writeFile(filepath, buffer);

  // Hugo baseURL 포함 절대 경로 (/travel-blog/images/...)
  const baseURL = process.env.HUGO_BASE_URL || '/travel-blog';
  const relativePath = `${baseURL}/images/${fullFilename}`;

  return {
    filepath,
    relativePath,
    alt: image.prompt,
    caption: `AI 생성 ${getStyleKorean(image.style)}`
  };
}

/**
 * 스타일 한국어 변환
 */
function getStyleKorean(style: ImageStyle): string {
  const styleMap: Record<ImageStyle, string> = {
    infographic: '여행 가이드',
    diagram: '여정 일러스트',
    map: '코스 지도',
    comparison: '비교 가이드',
    moodboard: '무드보드',
    bucketlist: '버킷리스트',
    cover_photo: '커버 사진'
  };
  return styleMap[style] || '일러스트';
}

/**
 * 포스트당 최대 이미지 수 확인
 */
export function getMaxImagesPerPost(): number {
  return MAX_IMAGES_PER_POST;
}

/**
 * 편의 함수: 단일 이미지 생성 및 저장
 */
export async function generateAndSaveImage(
  options: ImageGenerationOptions,
  outputDir: string,
  filename: string,
  apiKey?: string
): Promise<SavedImage | null> {
  const client = new GeminiImageClient(apiKey);

  if (!client.isConfigured() || !client.isEnabled()) {
    console.warn('Gemini 이미지 생성이 비활성화되어 있습니다.');
    return null;
  }

  try {
    const image = await client.generateImage(options);
    return await saveImage(image, outputDir, filename);
  } catch (error) {
    console.error('이미지 생성 실패:', error);
    return null;
  }
}
