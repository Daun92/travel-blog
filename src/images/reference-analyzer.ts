/**
 * 레퍼런스 이미지 분석 파이프라인
 * KTO/Unsplash에서 이미지를 찾고 Gemini Flash(텍스트)로 시각 요소 추출
 */

import { generate } from '../generator/gemini.js';
import { findImageForTopic } from './unsplash.js';
import type { ReferenceAnalysis } from './cover-styles.js';

interface ReferenceImage {
  url: string;
  source: string;
  title: string;
}

/**
 * 포스트 주제에 대해 레퍼런스 이미지 URL 획득
 * KTO → Unsplash 순서로 시도
 */
export async function findReferenceImages(
  topic: string,
  type: string,
  agentId: string,
): Promise<ReferenceImage[]> {
  const refs: ReferenceImage[] = [];

  // Unsplash 검색
  try {
    const ctx = { type: type as 'travel' | 'culture', persona: agentId as 'friendly' | 'viral' | 'informative' };
    const photo = await findImageForTopic(topic, undefined, ctx);
    if (photo) {
      refs.push({
        url: photo.urls.regular,
        source: 'unsplash',
        title: photo.alt_description || photo.description || topic,
      });
    }
  } catch (err) {
    console.log(`  레퍼런스 Unsplash 검색 실패: ${err instanceof Error ? err.message : String(err)}`);
  }

  return refs;
}

// ─── Gemini Flash 시각 분석 ─────────────────────────────────────

/**
 * 레퍼런스 이미지 URL 또는 주제 키워드로 시각 요소 분석
 * Gemini Flash 텍스트 호출 (이미지 쿼터 소모 안 함)
 */
export async function analyzeVisualElements(
  topic: string,
  type: string,
  referenceTitle?: string,
): Promise<ReferenceAnalysis> {
  const prompt = `You are a visual analysis expert for a Korean travel/culture blog.
Analyze the visual characteristics of this topic and suggest the ideal photographic composition.

Topic: "${topic}"
Content type: ${type}
${referenceTitle ? `Reference image description: "${referenceTitle}"` : ''}

Respond in this EXACT JSON format (no markdown, no code blocks, just raw JSON):
{
  "dominantColors": ["color1", "color2", "color3"],
  "keySubjects": ["subject1", "subject2", "subject3"],
  "mood": "one-line mood description",
  "composition": "composition style suggestion",
  "season": "season or 'year-round'",
  "timeOfDay": "best time for photo (golden hour, midday, night, etc)",
  "architecturalElements": ["element1", "element2"],
  "landscapeElements": ["element1", "element2"]
}

Focus on what would make a compelling cover photo for this specific Korean destination/topic.`;

  try {
    const response = await generate(prompt, { temperature: 0.3, max_tokens: 500 });
    // JSON 파싱 (코드블록 래핑 제거)
    const jsonStr = response.replace(/```(?:json)?\n?/g, '').replace(/\n?```/g, '').trim();
    const parsed = JSON.parse(jsonStr) as ReferenceAnalysis;

    // 필수 필드 검증
    if (!parsed.dominantColors || !parsed.keySubjects || !parsed.mood) {
      throw new Error('Missing required fields');
    }
    return parsed;
  } catch (err) {
    console.log(`  시각 분석 실패, 기본값 사용: ${err instanceof Error ? err.message : String(err)}`);
    return getDefaultAnalysis(topic, type);
  }
}

/**
 * 분석 실패 시 기본 ReferenceAnalysis
 */
function getDefaultAnalysis(topic: string, type: string): ReferenceAnalysis {
  if (type === 'travel') {
    return {
      dominantColors: ['sky blue', 'earthy brown', 'green'],
      keySubjects: [topic, 'Korean landscape', 'traditional architecture'],
      mood: 'inviting and authentic Korean travel atmosphere',
      composition: 'wide shot with leading lines',
      season: 'year-round',
      timeOfDay: 'golden hour',
      architecturalElements: ['traditional Korean architecture'],
      landscapeElements: ['natural scenery', 'mountains or sea'],
    };
  }

  return {
    dominantColors: ['gallery white', 'warm amber', 'neutral gray'],
    keySubjects: [topic, 'cultural space', 'art installation'],
    mood: 'refined and intellectually stimulating cultural atmosphere',
    composition: 'balanced symmetrical framing',
    season: 'year-round',
    timeOfDay: 'even indoor lighting',
    architecturalElements: ['modern gallery space', 'cultural venue'],
    landscapeElements: [],
  };
}

// ─── 통합 분석 파이프라인 ────────────────────────────────────────

/**
 * 레퍼런스 검색 + 시각 분석 통합 파이프라인
 * 실패 시 graceful degradation (주제 키워드만으로 진행)
 */
export async function analyzeReference(
  topic: string,
  type: string,
  agentId: string,
): Promise<{ analysis: ReferenceAnalysis; referenceUrl?: string }> {
  console.log(`  📷 레퍼런스 분석: "${topic}"`);

  // 1. 레퍼런스 이미지 검색
  const refs = await findReferenceImages(topic, type, agentId);
  const bestRef = refs[0];

  if (bestRef) {
    console.log(`  ✓ 레퍼런스 발견 (${bestRef.source}): ${bestRef.title || bestRef.url.slice(0, 60)}`);
  } else {
    console.log(`  △ 레퍼런스 없음, 주제 키워드로 분석 진행`);
  }

  // 2. 시각 요소 분석
  const analysis = await analyzeVisualElements(topic, type, bestRef?.title);

  return {
    analysis,
    referenceUrl: bestRef?.url,
  };
}
