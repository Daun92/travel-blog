/**
 * 2026-02-12 포스트 이미지 생성
 * 공주 백제유적 (오덕우/niche): 스틸컷 2장 + 마감 일러스트 1장
 * 제천 청풍호 (김주말/friendly): 스틸컷 2장
 * 총 5 Gemini API 호출
 */
import { config } from 'dotenv';
config();

import { writeFile } from 'fs/promises';
import { join } from 'path';
import { GeminiImageClient } from '../src/images/gemini-imagen.js';

const OUTPUT_DIR = 'blog/static/images';

interface ImageSpec {
  filename: string;
  alt: string;
  caption: string;
  prompt: string;
  style: string;
}

const specs: ImageSpec[] = [
  // ── 공주 백제유적 (오덕우/niche) ──────────────────────────
  {
    filename: 'stillcut-2026-02-12-12-1.jpeg',
    alt: '공주 왕릉원 능선 — 이른 아침 안개 속 1500년 전 도시 계획의 윤곽',
    caption: '새벽 5시 능선 — 안개가 걷히면 보이는 백제의 도면',
    style: 'cover_photo',
    prompt: `A documentary-style still photograph of the Gongju Royal Tombs (공주 무령왕릉과 왕릉원) burial mounds at early dawn.

SUBJECT: Several grass-covered dome-shaped tumuli rising gently from the ground, arranged in a deliberate south-facing slope. Morning dew glistens on the perfectly maintained grass. A narrow stone walking path curves between the mounds. Korean red pines (소나무) stand behind the mounds in the background. No people visible — the stillness of an archaeological site before opening hours.

ATMOSPHERE: Pre-dawn to early morning with low-lying mist clinging to the base of the mounds. Diffused, silvery light before the sun fully rises. The mist partially obscures the furthest mounds, creating layers of depth. A sense of profound quietude — the weight of 1500 years of history in the silence.

PHOTOGRAPHY STYLE: 35mm film emulation with visible grain. Off-center composition — the nearest mound dominates the left third of the frame while the stone path leads the eye diagonally to the right. Muted, desaturated palette: olive greens, cool greys, earthy browns. Slight vignetting at edges. Eye-level perspective looking slightly upward at the mounds. Shallow depth of field with the nearest mound tack-sharp and distant ones softening into mist.

CRITICAL: Photorealistic photograph only. NO illustration, NO cartoon, NO 3D render, NO text, NO watermark. Must fill entire frame edge-to-edge. Korean archaeological landscape.`
  },
  {
    filename: 'stillcut-2026-02-12-12-2.jpeg',
    alt: '무령왕릉 전축분 벽돌 연꽃무늬 클로즈업 — 1500년 전 그리드 시스템',
    caption: '유리 너머 연꽃 한 송이 — 1mm 단위의 백제 정밀공학',
    style: 'cover_photo',
    prompt: `A documentary-style still photograph of an ancient Baekje tomb brick (전축분 벽돌) displayed in a museum exhibition case.

SUBJECT: Extreme close-up of a terracotta-colored brick with an intricate lotus flower pattern carved into its surface. The lotus has geometric petals arranged in a precise radial pattern — evidence of 1500-year-old precision engineering. Visible tool marks and slight weathering on the surface. The brick is displayed behind museum glass on a dark fabric mount. Adjacent bricks show the systematic "three horizontal, one vertical" stacking pattern.

ATMOSPHERE: Controlled museum lighting — soft directional LED from above-left creating gentle shadows in the carved grooves, revealing depth and texture. The glass display case adds a subtle reflection. Cool, contemplative exhibition space. A faint reflection of the photographer visible in the glass.

PHOTOGRAPHY STYLE: Macro-style tight close-up with the lotus pattern filling 70% of the frame. Very shallow depth of field — the front carved edge is tack sharp while the back falls into soft bokeh. 50mm lens equivalent. Desaturated warm earth tones — terracotta, ochre, dusty gold against the dark exhibition background. Film grain texture. Off-center composition with the lotus in the lower-right third. Muted museum palette.

CRITICAL: Photorealistic photograph only. NO illustration, NO cartoon, NO 3D render, NO text, NO watermark. Must fill entire frame edge-to-edge. Museum exhibition photograph aesthetic.`
  },
  {
    filename: 'closing-2026-02-12-12.jpeg',
    alt: '공주 백제 디깅 레벨 체크리스트',
    caption: '디깅 레벨 자가진단 — 당신은 지금 몇 층?',
    style: 'bucketlist',
    prompt: `A whimsical hand-drawn checklist illustration titled "공주 백제 디깅 레벨" (Gongju Baekje Digging Level).

Style: Vintage field journal aesthetic with warm parchment-toned background. Hand-lettered Korean text with sketchy pen-and-ink doodles next to each checklist item. Teal (#0D9488) accent color for checked items.

Checklist items with small doodles:
- Level 1: 능선만 보고 돌아가기 (doodle: simple dome mound)
- Level 2: 벽돌 무늬 집착 시작 (doodle: lotus pattern close-up)
- Level 3: 새벽 금강 안개 산책 (doodle: misty river scene)
- Level 4: 경비행기 레이아웃 읽기 (doodle: aerial view)
- Level 5: 12회차 이상 재방문 (doodle: person with magnifying glass)

Some items have checkmarks, others empty boxes. Decorative elements: compass rose, small map fragments, archaeological trowel sketch. The overall feel is an explorer's field notebook progress tracker — charming and slightly nerdy.`
  },

  // ── 제천 청풍호 (김주말/friendly) ──────────────────────────
  {
    filename: 'stillcut-2026-02-12-post-1.jpeg',
    alt: '리솜포레스트 야간 도착 — 전동카트와 겨울 숲길',
    caption: '밤 10시 체크인 — 전동카트 헤드라이트가 비추는 첫 번째 설렘',
    style: 'cover_photo',
    prompt: `A lifestyle photograph of a nighttime arrival at Resom Forest (리솜포레스트) resort in Jecheon, winter.

SUBJECT: A small white electric golf cart with warm yellow headlights sits on a forest-lined asphalt pathway leading toward guest buildings. Tall pine trees flank both sides, their branches dusted with light snow. The resort building's warm window lights glow orange-amber through the trees in the background. Frost crystals glisten on surfaces. Two small suitcases rest in the cart's rear cargo area.

ATMOSPHERE: Late evening, approximately 10 PM in deep winter. Strong contrast between the cold blue-black night sky and warm amber glow from the cart headlights and distant building windows. A few soft snowflakes drift through the headlight beams. The cozy anticipation of arriving at a winter retreat after a long Friday commute. Pine-scented cold air feeling.

PHOTOGRAPHY STYLE: Eye-level lifestyle shot from slightly behind and to the side of the cart, looking forward down the lit pathway. Warm vignetting at edges. Golden highlights on snow from headlights contrast with cool blue shadows in the trees. Soft bokeh on distant building lights. Slightly elevated color temperature in highlights — warm, inviting. Center-weighted composition with the illuminated path drawing the eye forward. Soft grain.

CRITICAL: Photorealistic photograph only. NO illustration, NO cartoon, NO 3D render, NO text, NO watermark. Must fill entire frame edge-to-edge. Korean winter resort atmosphere.`
  },
  {
    filename: 'stillcut-2026-02-12-post-2.jpeg',
    alt: '비봉산 케이블카 안에서 본 청풍호 겨울 파노라마',
    caption: '케이블카 유리 너머 — 말없이 "와" 만 나오는 1분 30초',
    style: 'cover_photo',
    prompt: `A lifestyle photograph taken from inside a cable car cabin overlooking Cheongpungho Lake (청풍호) in winter.

SUBJECT: Through the large glass window panel of the cable car, a panoramic vista of the lake surrounded by snow-dusted mountains. The lake surface is partially frozen near the edges with deep blue-green water in the center. The cable car window frame and metal handrail create a natural border in the foreground. Two gloved hands — one in a navy puffer jacket sleeve, one in a cream knit — rest close together on the handrail. Another cable car cabin is visible ahead on the line, descending toward the lake.

ATMOSPHERE: Late morning winter sunlight creating a golden haze over the lake surface. Mountains layer in receding blue-grey tones with wispy clouds sitting below peaks. Cold outside but warm inside the cabin — slight condensation on the lower glass edge. A moment of shared quiet wonder between a couple.

PHOTOGRAPHY STYLE: Eye-level perspective as if sitting inside the cable car. The glass window creates a frame-within-a-frame composition. Warm color grading — golden highlights where sunlight hits the lake, soft warm tones inside the cabin. Hands in soft foreground focus, tack-sharp mid-ground on lake panorama. Lifestyle warmth, golden hour color temperature. Natural vignetting from the cabin interior. Soft film grain.

CRITICAL: Photorealistic photograph only. NO illustration, NO cartoon, NO 3D render, NO text, NO watermark. Must fill entire frame edge-to-edge. Korean winter lake landscape.`
  }
];

async function main() {
  const client = new GeminiImageClient();
  if (!client.isConfigured() || !client.isEnabled()) {
    console.error('GEMINI_API_KEY와 GEMINI_IMAGE_ENABLED=true 필요');
    process.exit(1);
  }

  const usage = await client.getDailyUsage();
  console.log(`📊 Gemini 이미지 쿼터: ${usage}/50 (5장 생성 예정 → ${usage + 5}/50)`);

  const results: { filename: string; success: boolean; sizeKB?: number }[] = [];

  for (const spec of specs) {
    console.log(`\n🎬 생성 중: ${spec.alt}...`);
    console.log(`   스타일: ${spec.style}`);

    let image;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        image = await client.generateImage({
          prompt: spec.prompt,
          style: spec.style as any,
          aspectRatio: '16:9',
          topic: spec.alt,
        });
        break;
      } catch (err) {
        console.log(`   ⚠️ 시도 ${attempt}/3 실패: ${(err as Error).message.slice(0, 100)}`);
        if (attempt < 3) {
          console.log(`   ⏳ ${5 * attempt}초 후 재시도...`);
          await new Promise(r => setTimeout(r, 5000 * attempt));
        } else {
          console.error(`   ❌ 3회 실패 — 건너뜀: ${spec.filename}`);
          results.push({ filename: spec.filename, success: false });
          image = null;
        }
      }
    }

    if (image) {
      const outputPath = join(OUTPUT_DIR, spec.filename);
      const buffer = Buffer.from(image.base64Data, 'base64');
      await writeFile(outputPath, buffer);

      const sizeKB = Math.round(buffer.length / 1024);
      console.log(`   ✅ ${spec.filename} (${sizeKB}KB, ${image.mimeType})`);
      results.push({ filename: spec.filename, success: true, sizeKB });
    }

    // 요청 간 2초 대기
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 결과 요약:');
  for (const r of results) {
    console.log(`   ${r.success ? '✅' : '❌'} ${r.filename}${r.sizeKB ? ` (${r.sizeKB}KB)` : ''}`);
  }

  console.log('\n📝 공주 포스트 마크다운:');
  for (const spec of specs.slice(0, 3)) {
    console.log(`   ![${spec.alt}](/travel-blog/images/${spec.filename})`);
    console.log(`   *${spec.caption}*\n`);
  }

  console.log('📝 제천 포스트 마크다운:');
  for (const spec of specs.slice(3)) {
    console.log(`   ![${spec.alt}](/travel-blog/images/${spec.filename})`);
    console.log(`   *${spec.caption}*\n`);
  }
}

main().catch(err => {
  console.error('오류:', err);
  process.exit(1);
});
