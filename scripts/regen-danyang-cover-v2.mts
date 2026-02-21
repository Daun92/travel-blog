/**
 * 단양 커버 v2 — 도담삼봉 + 남한강 항공뷰 (산-강-하늘 파노라마)
 */
import { config } from 'dotenv'; config();

import { join } from 'path';
import { GeminiImageClient } from '../src/images/gemini-imagen.js';
import { getVisualIdentity } from '../src/images/cover-styles.js';
import { applyOverlayToBase64 } from '../src/images/cover-overlay.js';

const SLUG = '2026-02-20-danyang-day-trip-course-and-cost';
const IMG_DIR = 'blog/static/images';
const AGENT_ID = 'friendly';

const PROMPT = `Generate a photorealistic cover photograph for a Korean blog post.

Topic: "단양 당일치기 현실 코스: 구인사에서 도담삼봉까지"
Content type: Travel destination — day trip itinerary through Danyang, South Korea

WHAT TO SHOW:
An elevated aerial-perspective view of Dodamsambong (도담삼봉) — three dramatic rocky peaks rising from the middle of the Namhan River (남한강) in Danyang, South Korea.
The river wraps around the town in a sweeping curve, flanked by forested mountain ridges on both sides.
The hexagonal pavilion (삼도정) sits atop the central peak, reflected in the calm turquoise-green river water.

KEY VISUAL ELEMENTS:
- The three rocky peaks (삼봉) standing dramatically in the middle of the wide, calm river — this is the HERO subject
- The river curving gracefully around the valley, creating that signature Danyang landscape where water embraces mountains
- Mountain ridges layered in the background, fading into atmospheric haze — creating depth and mystery
- Late winter atmosphere: bare tree branches on the ridgelines, patches of remaining snow on higher peaks, crisp clear air
- Late afternoon golden light casting long shadows from the peaks onto the water surface
- The sky is vast — taking up at least 1/3 of the frame — pale blue fading to warm golden near the horizon
- Small-town rooftops and a bridge visible in the mid-ground to provide human scale

MOOD & FEELING:
- Ethereal, mystical, awe-inspiring — the kind of view that makes you stop and stare
- The feeling of "I can see the entire world from here" — panoramic grandeur
- Clean, crisp, refreshing mountain air — you can almost feel the cold breeze
- A sense of timeless beauty — this landscape has looked like this for thousands of years

CREATIVE DIRECTION — Travel vlogger's authentic thumbnail:
- This should be the ONE image that makes someone immediately think "DANYANG" — the river, the mountains, the peaks
- Wide panoramic composition showing the full sweep of the river valley
- NOT a close-up of the rocks — show the GRAND LANDSCAPE with the peaks as the focal point within it
- Think: the hero shot from a drone flying over Danyang that captures its soul in a single frame

PHOTOGRAPHY STYLE:
- Style: landscape photography with golden hour warmth, slight aerial perspective (as if from a hillside viewpoint or moderate drone altitude)
- Composition: wide panoramic, rule of thirds with peaks at intersection point, vast sky, layered mountains
- Color grading: turquoise-green river water, warm golden light on peaks, cool blue-grey distant mountains, pale sky
- Mood: warm, awe-inspiring, refreshing, authentic

CRITICAL REQUIREMENTS:
- Must look like a REAL photograph by a professional photographer or high-quality drone shot. NO illustration, NO digital art, NO cartoon, NO painting, NO 3D render.
- Aspect ratio: 16:9 landscape (1200x675 pixels).
- The photograph MUST fill the ENTIRE frame edge-to-edge. NO white space, NO margins.
- Do NOT include any text, caption, watermark, logo, title, or overlay.
- LATE WINTER setting: bare branches, patches of snow on mountain peaks, cold clear air. NO autumn foliage, NO cherry blossoms.
- The three rocky peaks in the river MUST be clearly visible and recognizable as Dodamsambong.
- Korean mountain-river landscape must be unmistakable — this is NOT a generic river valley.`;

async function main() {
  console.log('🏔️  단양 커버 v2 — 도담삼봉 + 남한강 항공뷰\n');

  const client = new GeminiImageClient();
  if (!client.isConfigured() || !client.isEnabled()) {
    console.error('Gemini API 비활성화 상태');
    process.exit(1);
  }

  const usage = await client.checkUsageLimit(1);
  console.log(`이미지 사용량: ${usage.current}/${usage.limit}`);
  if (!usage.allowed) {
    console.error(`일일 한도 초과`);
    process.exit(1);
  }

  console.log('도담삼봉 + 남한강 파노라마 생성 중...');
  const image = await client.generateImage({
    prompt: PROMPT,
    style: 'cover_photo',
    aspectRatio: '16:9',
    personaId: AGENT_ID,
  });

  console.log('관인 오버레이 적용 중...');
  const identity = getVisualIdentity(AGENT_ID);
  const outputPath = join(IMG_DIR, `cover-${SLUG}.jpg`);
  await applyOverlayToBase64(image.base64Data, outputPath, '', identity);

  console.log(`저장 완료: ${outputPath}`);
  console.log('\n✅ 커버 교체 완료!');
}

main().catch(err => {
  console.error('❌ 오류:', err);
  process.exit(1);
});
