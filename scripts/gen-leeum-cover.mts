/**
 * 리움미술관 포스트 커버 이미지 재생성
 * 한교양(informative) — 건축 사진, 다큐멘터리 포스터 스타일
 * contentHints: 세 거장 건축, 고미술+현대미술, 한남동
 *
 * Usage: npx tsx scripts/gen-leeum-cover.mts
 */
import { config } from 'dotenv';
config();

import { join } from 'path';
import { GeminiImageClient } from '../src/images/gemini-imagen.js';
import { applyOverlayToBase64 } from '../src/images/cover-overlay.js';
import { AGENT_VISUAL_IDENTITIES } from '../src/images/cover-styles.js';

const OUTPUT_DIR = 'blog/static/images';
const FILENAME = 'cover-refresh-2026-02-05-post.jpg';

const COVER_PROMPT = `A documentary-style architectural photograph of a world-class private art museum complex on a hillside in Seoul's Hannam-dong neighborhood, featuring three radically different buildings by three legendary architects standing in dialogue.

WHAT TO SHOW: The exterior of an art museum complex where three buildings of completely different materials and forms stand side by side on a sloping hillside. The leftmost building is a striking INVERTED TRUNCATED CONE clad entirely in hand-fired terracotta bricks — thousands of warm reddish-brown rectangular bricks laid in precise horizontal courses, the form widening as it rises, creating a monumental yet earthy presence. The center building is a massive BLACK CONCRETE BOX that appears to cantilever and float — raw exposed concrete with minimal fenestration, brutalist and gravity-defying. The rightmost building features DARK PATINATED STAINLESS STEEL panels with reflective angular surfaces and tinted glass — sleek, sharp, industrial-futuristic. Between the three buildings, a landscaped courtyard with mature trees (bare winter branches), geometric stone pathways, and a few outdoor sculptures on granite pedestals. A handful of visitors in elegant winter coats walk between the structures. Small Korean directional signage is visible.

CREATIVE DIRECTION: Documentary poster / exhibition catalog aesthetic — the kind of image that belongs on the cover of an architectural monograph. Cinematic framing that captures the philosophical conversation between the three radically different buildings. The composition should make the viewer feel the intellectual weight and cultural significance of the space. NOT a tourist snapshot — this is architectural criticism in photographic form.

PHOTOGRAPHY STYLE: Architectural photography with meticulous attention to structural detail and material texture. Wide-angle composition capturing all three buildings in a single frame, with the terracotta cone building slightly emphasized through placement at the golden ratio point. Perfectly balanced exposure — warm terracotta highlights, cool steel reflections, deep concrete shadows all rendered with equal fidelity. The low winter afternoon sun rakes across the facades at approximately 30 degrees, revealing the full depth of the brick texture and casting long architectural shadows. Color grading: neutral mid-tones with slightly cool shadows and clean whites. Geometric framing with strong horizontal and vertical lines from the buildings creating a structured, intellectual composition. Shot from a slightly elevated vantage point across the courtyard to capture the spatial relationship and hillside terrain.

CRITICAL REQUIREMENTS:
- Photorealistic photograph ONLY — NO illustration, NO 3D render, NO digital art, NO watermark, NO text overlay
- Three DISTINCT buildings must be clearly visible: terracotta brick cone, black concrete box, dark steel/glass angular form
- Korean winter atmosphere: bare deciduous trees, low-angle sunlight, visitors in padded winter coats
- The material contrast (brick vs concrete vs steel) must be the visual thesis of the image
- Must fill the entire frame edge-to-edge with NO borders or margins
- Aspect ratio: 16:9 landscape orientation`;

async function main() {
  const client = new GeminiImageClient();
  if (!client.isConfigured() || !client.isEnabled()) {
    console.error('❌ GEMINI_API_KEY와 GEMINI_IMAGE_ENABLED=true 필요');
    process.exit(1);
  }

  const usage = await client.getDailyUsage();
  console.log(`📊 Gemini 이미지 쿼터: ${usage}/50`);
  console.log(`🎬 리움미술관 커버 생성 중 (한교양/informative)...`);

  let image;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      image = await client.generateImage({
        prompt: COVER_PROMPT,
        style: 'cover_photo',
        aspectRatio: '16:9',
        topic: '리움미술관 세 거장 건축 외관',
      });
      break;
    } catch (err) {
      console.log(`   ⚠️ 시도 ${attempt}/3 실패: ${(err as Error).message.slice(0, 80)}`);
      if (attempt < 3) {
        console.log(`   ⏳ ${5 * attempt}초 후 재시도...`);
        await new Promise(r => setTimeout(r, 5000 * attempt));
      } else {
        console.error(`   ❌ 최종 실패`);
        process.exit(1);
      }
    }
  }

  if (!image) process.exit(1);

  // 관인 오버레이 적용 (한교양 블루)
  const identity = AGENT_VISUAL_IDENTITIES.informative;
  const outputPath = join(OUTPUT_DIR, FILENAME);

  await applyOverlayToBase64(image.base64Data, outputPath, '리움미술관 완벽 가이드', identity);

  const { statSync } = await import('fs');
  const sizeKB = Math.round(statSync(outputPath).size / 1024);
  console.log(`   ✅ ${FILENAME} (${sizeKB}KB, 관인 오버레이 적용)`);
}

main().catch(err => {
  console.error('오류:', err);
  process.exit(1);
});
