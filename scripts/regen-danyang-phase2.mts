/**
 * 단양 포스트 2차 개선 — 이미지 4장 교체
 * 1. KTO API: 도담삼봉 검색 → detailImage → 다운로드 (kto-{SLUG}-2.jpg)
 * 2. 관광특구: data/cover-preview/danyang/tourist-1.jpg 복사 (kto-{SLUG}-3.jpg)
 * 3. AI inline-3: 구인사 회랑 스틸컷 생성 + Sharp 최적화
 * 4. AI cover: 늦겨울 구인사 커버 생성 + Sharp 최적화 + 관인 오버레이
 */
import { config } from 'dotenv'; config();

import { copyFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import sharp from 'sharp';
import { getDataGoKrClient } from '../src/api/data-go-kr/index.js';
import { GeminiImageClient, saveImage } from '../src/images/gemini-imagen.js';
import { getVisualIdentity } from '../src/images/cover-styles.js';
import { applyOverlayToBase64 } from '../src/images/cover-overlay.js';

const SLUG = '2026-02-20-danyang-day-trip-course-and-cost';
const IMG_DIR = 'blog/static/images';
const AGENT_ID = 'friendly';

// ============================================================================
// Step 1: KTO 도담삼봉 이미지 확보
// ============================================================================

async function step1_ktoDodamsambong(): Promise<void> {
  console.log('\n=== Step 1: KTO 도담삼봉 이미지 검색 ===\n');

  const client = getDataGoKrClient();
  if (!client) {
    console.error('KTO_API_KEY가 설정되지 않았습니다.');
    process.exit(1);
  }

  // 도담삼봉 검색 (관광지 contentTypeId: 12)
  const results = await client.searchKeyword('도담삼봉', { contentTypeId: '12', numOfRows: 5 });
  console.log(`검색 결과: ${results.length}건`);

  if (results.length === 0) {
    console.error('도담삼봉 검색 결과 없음 — 수동 확인 필요');
    process.exit(1);
  }

  // 첫 번째 결과 사용
  const target = results[0];
  console.log(`선택: ${target.title} (contentId: ${target.contentid})`);
  if (target.firstimage) {
    console.log(`대표 이미지: ${target.firstimage}`);
  }

  // detailImage2로 상세 이미지 조회
  const images = await client.detailImage(target.contentid);
  console.log(`상세 이미지: ${images.length}장`);

  // 이미지 후보 선택: firstimage 또는 detailImage 중 첫 번째
  let imageUrl = target.firstimage || target.firstimage2;

  if (images.length > 0) {
    // detailImage에서 다양한 시점 선택 가능
    // 첫 번째 상세 이미지 사용 (보통 대표적인 전경)
    console.log('상세 이미지 목록:');
    images.forEach((img, i) => {
      const url = (img as any).originimgurl || (img as any).smallimageurl;
      console.log(`  ${i}: ${url}`);
    });
    // originimgurl이 원본 해상도
    const bestImg = images[0] as any;
    imageUrl = bestImg.originimgurl || bestImg.smallimageurl || imageUrl;
  }

  if (!imageUrl) {
    console.error('도담삼봉 이미지 URL 확보 실패');
    process.exit(1);
  }

  console.log(`다운로드 URL: ${imageUrl}`);

  // 다운로드
  const response = await fetch(imageUrl);
  if (!response.ok) {
    console.error(`이미지 다운로드 실패: ${response.status}`);
    process.exit(1);
  }
  const buffer = Buffer.from(await response.arrayBuffer());

  // Sharp로 리사이즈 + JPEG 최적화
  const outputPath = join(IMG_DIR, `kto-${SLUG}-2.jpg`);
  await mkdir(IMG_DIR, { recursive: true });
  await sharp(buffer)
    .resize(1200, undefined, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toFile(outputPath);

  console.log(`저장 완료: ${outputPath}`);
}

// ============================================================================
// Step 2: 관광특구 이미지 복사
// ============================================================================

async function step2_touristCopy(): Promise<void> {
  console.log('\n=== Step 2: 관광특구 이미지 복사 ===\n');

  const src = 'data/cover-preview/danyang/tourist-1.jpg';
  const destPath = join(IMG_DIR, `kto-${SLUG}-3.jpg`);

  // Sharp로 리사이즈 + JPEG 최적화 (원본이 큰 경우 대비)
  await sharp(src)
    .resize(1200, undefined, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toFile(destPath);

  console.log(`복사 완료: ${src} → ${destPath}`);
}

// ============================================================================
// Step 3: AI inline-3 구인사 회랑 스틸컷
// ============================================================================

async function step3_inlineGuinsa(): Promise<void> {
  console.log('\n=== Step 3: AI 구인사 회랑 스틸컷 생성 ===\n');

  const client = new GeminiImageClient();
  if (!client.isConfigured() || !client.isEnabled()) {
    console.error('Gemini API 비활성화 상태');
    process.exit(1);
  }

  const usage = await client.checkUsageLimit(1);
  console.log(`이미지 사용량: ${usage.current}/${usage.limit}`);
  if (!usage.allowed) {
    console.error(`일일 한도 초과: ${usage.current}/${usage.limit}`);
    process.exit(1);
  }

  const prompt = `A photorealistic photograph for a Korean travel blog post about: 단양 구인사 당일치기 여행

SUBJECT: The multi-story corridor (회랑) of Guinsa Temple (구인사), Danyang, South Korea.
Looking UPWARD from below the concrete staircase — the viewer stands at the bottom of the tiered temple complex, gazing up through multiple levels of buildings stacked along the narrow valley.
Slanting morning sunlight pours through the gaps between the 5-story main hall (대법당) and the corridors, creating dramatic light shafts that cut through the cold mountain air.
The warm golden light catches the edges of the eaves (처마) at the very top, while the lower levels remain in cool shadow.
Layered concrete and traditional Korean temple architecture rising tier upon tier up the mountainside.
NO people, NO text, NO signs — pure architectural scene.

ATMOSPHERE: The stillness of an early morning mountain temple. Cold, crisp air of late winter (잔설 on distant peaks).
The contrast between the warm shaft of morning light and the cool blue shadows in the corridors.
A profound sense of vertical scale — buildings rising like a fortress up the valley.

PHOTOGRAPHY STYLE: Lifestyle photography with golden hour warmth and soft bokeh.
Eye-level perspective looking upward along the staircase, warm vignetting at edges.
Golden highlights where sunlight hits, cool blue-grey shadows in the corridors.
The feeling should be intimate yet awe-inspiring — a quiet moment of discovery.

CRITICAL: Photorealistic photograph ONLY. NO illustration, NO digital art, NO text overlay, NO watermark. Must look like an actual photograph taken at a Korean Buddhist temple complex. Must fill entire frame edge-to-edge. Late winter setting — bare branches visible, NO autumn foliage, NO cherry blossoms.`;

  console.log('구인사 회랑 스틸컷 생성 중...');
  const image = await client.generateImage({
    prompt,
    style: 'cover_photo',
    aspectRatio: '16:9',
    topic: '단양 구인사 회랑',
    personaId: AGENT_ID,
  });

  console.log('Sharp 최적화 + 저장 중...');
  const saved = await saveImage(image, IMG_DIR, `inline-${SLUG}-3`, {
    optimize: true,
    maxWidth: 1200,
    quality: 85,
  });

  console.log(`저장 완료: ${saved.filepath}`);
}

// ============================================================================
// Step 4: AI 커버 재생성 — 늦겨울
// ============================================================================

async function step4_coverLateWinter(): Promise<void> {
  console.log('\n=== Step 4: AI 늦겨울 커버 생성 + 관인 오버레이 ===\n');

  const client = new GeminiImageClient();
  if (!client.isConfigured() || !client.isEnabled()) {
    console.error('Gemini API 비활성화 상태');
    process.exit(1);
  }

  const usage = await client.checkUsageLimit(1);
  console.log(`이미지 사용량: ${usage.current}/${usage.limit}`);
  if (!usage.allowed) {
    console.error(`일일 한도 초과: ${usage.current}/${usage.limit}`);
    process.exit(1);
  }

  const prompt = `Generate a photorealistic cover photograph for a Korean blog post.

Topic: "단양 당일치기 현실 코스: 구인사에서 도담삼봉까지"
Content type: Travel destination — day trip itinerary

WHAT TO SHOW:
A traveler's back (silhouette, not facing camera) standing at the top of Guinsa Temple's tiered corridor, looking DOWN over the layered temple complex nestled in a narrow valley.
Late winter setting — bare tree branches frame the scene, patches of lingering snow on the mountainsides. The air is cold and crystal clear.
Morning golden light floods the valley from the east, illuminating the temple rooftops below.
The viewer should feel the vast vertical scale of the temple complex and the serenity of a mountain winter morning.

CREATIVE DIRECTION — Travel vlogger's authentic thumbnail:
- Show the REAL, lived-in atmosphere as if the viewer is standing there right now.
- Eye-level, first-person perspective — "I was actually here, and this is what it felt like."
- Warm, inviting mood despite the winter cold — golden light counterbalances the chill.
- Think: popular Korean travel YouTuber's vlog thumbnail — genuine, relatable, warm.

PHOTOGRAPHY STYLE:
- Style: lifestyle photography with golden hour warmth and soft bokeh
- Composition: eye-level perspective, warm vignetting, centered subject, inviting framing
- Color grading: warm golden highlights from morning sun, cool blue-grey shadows, natural skin tones
- Mood: warm, cozy, golden-hour, casual, authentic

CRITICAL REQUIREMENTS:
- Must look like a REAL photograph by a professional photographer. NO illustration, NO digital art, NO cartoon, NO painting, NO 3D render.
- Aspect ratio: 16:9 landscape (1200x675 pixels).
- The photograph MUST fill the ENTIRE frame edge-to-edge. NO white space, NO margins.
- Do NOT include any text, caption, watermark, logo, title, or overlay.
- LATE WINTER setting is CRITICAL: bare branches, patches of snow on mountains, cold clear air.
- ABSOLUTELY NO autumn foliage, NO cherry blossoms, NO green leaves. This is February — winter's end.
- Korean Buddhist temple architecture must be unmistakable.`;

  console.log('늦겨울 커버 생성 중...');
  const image = await client.generateImage({
    prompt,
    style: 'cover_photo',
    aspectRatio: '16:9',
    personaId: AGENT_ID,
  });

  console.log('관인 오버레이 적용 중...');
  const identity = getVisualIdentity(AGENT_ID);
  const outputPath = join(IMG_DIR, `cover-${SLUG}.jpg`);
  await applyOverlayToBase64(image.base64Data, outputPath, '', identity);

  console.log(`저장 완료 (관인 포함): ${outputPath}`);
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('🏔️  단양 포스트 2차 개선 — 이미지 4장 교체\n');

  await step1_ktoDodamsambong();
  await step2_touristCopy();
  await step3_inlineGuinsa();
  await step4_coverLateWinter();

  console.log('\n✅ 이미지 4장 교체 완료!');
  console.log(`  kto-${SLUG}-2.jpg  → 도담삼봉 KTO`);
  console.log(`  kto-${SLUG}-3.jpg  → 관광특구 상가`);
  console.log(`  inline-${SLUG}-3.jpg → 구인사 회랑 AI`);
  console.log(`  cover-${SLUG}.jpg   → 늦겨울 커버 AI + 관인`);
}

main().catch(err => {
  console.error('❌ 오류:', err);
  process.exit(1);
});
