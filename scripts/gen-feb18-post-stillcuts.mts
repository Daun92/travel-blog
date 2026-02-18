/**
 * 2026-02-18 post (망원·문래·신당) — 망원동/문래동 AI 스틸컷 폴백
 * KTO DB에 미등록된 도심 동네 → 오덕우(niche) 페르소나 스틸컷 생성
 */
import { config } from 'dotenv';
config();

import { writeFile } from 'fs/promises';
import { join } from 'path';
import { GeminiImageClient } from '../src/images/gemini-imagen.js';

const OUTPUT_DIR = 'blog/static/images';

interface FallbackSpec {
  filename: string;
  alt: string;
  caption: string;
  prompt: string;
}

const specs: FallbackSpec[] = [
  // ── 섹션 1: 망원동 (niche/오덕우) ──────────────────────────────
  {
    filename: 'stillcut-2026-02-18-post-mangwon.jpeg',
    alt: '망원동즉석우동 — 태양초 국물 위로 피어오르는 김과 낡은 포미카 테이블',
    caption: '8번째 방문에서 발견한 것 — 태양초와 청양의 이중 레이어가 이 한 그릇에 다 있다',
    prompt: `An indie street photograph of a steaming bowl of spicy udon noodles at a tiny local noodle shop in Seoul's Mangwon-dong neighborhood.

SUBJECT: A tight close-up of a metal bowl filled with thick udon noodles submerged in an intensely red-orange broth made from sun-dried chili flakes. Thick steam rises from the surface, catching the overhead fluorescent light. Sliced fish cakes and green onion rings float on top. A pair of well-used stainless steel chopsticks rest across the bowl's edge, showing wear marks from decades of use. The bowl sits on a scratched formica table in a faded mint-green tone — the kind found in 1990s Korean neighborhood restaurants. Behind the bowl, slightly blurred: a small plastic container holding wooden chopsticks and spoons, a bottle of soy sauce, and a worn paper menu taped to the tile wall with prices in handwritten Korean. The wall tiles are white ceramic with visible grout lines and a few chips. A folded newspaper sits on the adjacent seat.

ATMOSPHERE: Midday lunch rush energy in a cramped neighborhood eatery — the fluorescent tube light creates a flat, honest illumination that makes no attempt at ambiance. This is pure function: hot noodles, fast. The steam creates a micro-atmosphere above the bowl, catching light and softening the harsh fluorescence into something almost tender. The background hum of a small TV mounted in the corner, the click of chopsticks, the slurp of broth — a daily ritual for locals, a discovery for those who dig deeper.

PHOTOGRAPHY STYLE: Indie street photography — extremely tight close-up with the bowl occupying the lower two-thirds of the frame. Shallow depth of field with the chili flake granules visible on the broth surface in crisp focus, while the tiled wall and menu dissolve into creamy soft bokeh. Muted, slightly desaturated color palette with warm shadows — film emulation reminiscent of Fuji Superia 400. Visible film grain adds organic texture. Off-center composition with the steam trail drifting to the upper-left corner. Slight vignetting at edges. The color of the broth should be vibrant red-orange even within the muted overall palette — the one saturated element in a desaturated world.

CRITICAL: Photorealistic photograph only. NO illustration, NO digital art, NO text overlay, NO watermark. Korean neighborhood restaurant atmosphere must be unmistakable — this is NOT a styled food photography setup, it's candid and real. Must fill entire frame edge-to-edge.`
  },

  // ── 섹션 2: 문래동 (niche/오덕우) ──────────────────────────────
  {
    filename: 'stillcut-2026-02-18-post-mullae.jpeg',
    alt: '문래창작촌 골목 — 용접 불꽃이 벽면 그래피티를 비추는 오후 3시',
    caption: '다섯 번째 왔을 때 깨달은 것 — 오후 3시, 불꽃과 그래피티가 겹치는 그 순간',
    prompt: `An indie street photograph of an alley in Seoul's Mullae-dong creative village where metalworking sparks illuminate wall graffiti art.

SUBJECT: A narrow industrial alley between aging concrete buildings. On the left wall, vivid spray-painted graffiti art — abstract geometric shapes in teal, coral, and gold — covers an entire concrete wall surface from ground to about 3 meters high. On the right side, through an open roll-up metal shutter door, the interior of a small metalworking shop is partially visible. Inside, a welding arc produces brilliant white-blue sparks that fan outward, casting a sharp temporary light on the graffiti wall opposite. The sparks catch suspended iron dust particles in the air, creating tiny floating points of light. The alley floor is rough asphalt with scattered metal shavings and a few discarded steel rods leaning against the shop wall. A faded blue plastic crate serves as a makeshift chair near the shop entrance. Electrical cables run along the buildings overhead. Beyond the immediate alley, a sliver of another workshop with stacked steel sheets is visible.

ATMOSPHERE: Mid-afternoon — approximately 3 PM — with angled winter sunlight entering the narrow alley from above, creating a warm amber band across the upper wall while the lower portion stays in cool shadow. The welding sparks add a momentary flash of industrial blue-white to the warm ambient light. The juxtaposition is extraordinary: raw industrial labor and contemporary street art occupying the same narrow space, neither apologizing for the other's presence. Iron dust gives the air a faint metallic shimmer. The distant sound of an angle grinder from another shop. The alley smells of metal and spray paint.

PHOTOGRAPHY STYLE: Indie street photography — medium-close composition capturing the wall-to-wall width of the narrow alley. Off-center framing with the graffiti wall occupying the left 60% and the welding shop entrance on the right 40%. Shallow-to-medium depth of field — the sparks and nearest graffiti details in sharp focus, the deeper alley dissolving into atmospheric softness. Muted tonal palette with film emulation — desaturated base with the graffiti colors and welding sparks providing selective chromatic accents. Visible film grain texture. Slight vignetting. The welding sparks should have a slight motion blur suggesting their rapid trajectory, while everything else is static. Cool shadows with warm highlights where sunlight penetrates.

CRITICAL: Photorealistic photograph only. NO illustration, NO digital art, NO text overlay, NO watermark. The industrial metalworking environment must look authentic — real wear, real grime, real working conditions. The graffiti should be abstract/geometric, not containing readable text or identifiable artist signatures. Must fill entire frame edge-to-edge.`
  },
];

async function main() {
  const client = new GeminiImageClient();
  if (!client.isConfigured() || !client.isEnabled()) {
    console.error('❌ GEMINI_API_KEY와 GEMINI_IMAGE_ENABLED=true 필요');
    process.exit(1);
  }

  const usage = await client.getDailyUsage();
  console.log(`📊 Gemini 이미지 쿼터: ${usage}/50 (${specs.length}장 생성 예정)\n`);

  for (const spec of specs) {
    console.log(`🎬 생성 중: ${spec.alt}...`);

    let image;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        image = await client.generateImage({
          prompt: spec.prompt,
          style: 'cover_photo',
          aspectRatio: '16:9',
          topic: spec.alt,
        });
        break;
      } catch (err) {
        console.log(`   ⚠️ 시도 ${attempt}/3 실패: ${(err as Error).message.slice(0, 80)}`);
        if (attempt < 3) {
          console.log(`   ⏳ ${5 * attempt}초 후 재시도...`);
          await new Promise(r => setTimeout(r, 5000 * attempt));
        } else {
          console.error(`   ❌ 최종 실패: ${spec.filename}`);
        }
      }
    }

    if (!image) continue;

    const outputPath = join(OUTPUT_DIR, spec.filename);
    const buffer = Buffer.from(image.base64Data, 'base64');
    await writeFile(outputPath, buffer);

    const sizeKB = Math.round(buffer.length / 1024);
    console.log(`   ✅ ${spec.filename} (${sizeKB}KB)\n`);
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('\n📝 마크다운 삽입 코드:');
  for (const spec of specs) {
    console.log(`![${spec.alt}](/travel-blog/images/${spec.filename})`);
    console.log(`*${spec.caption}*\n`);
  }
}

main().catch(err => {
  console.error('오류:', err);
  process.exit(1);
});
