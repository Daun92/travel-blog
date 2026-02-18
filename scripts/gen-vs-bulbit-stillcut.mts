/**
 * 양평 vs 가평 포스트 — 섹션 4 "불빛:애" 스틸컷 생성
 * 기존 빙송어축제 이미지 → 겨울 빛 축제 맥락 매칭 AI 스틸컷으로 교체
 */
import { config } from 'dotenv';
config();

import { writeFile } from 'fs/promises';
import { join } from 'path';
import { GeminiImageClient } from '../src/images/gemini-imagen.js';

const OUTPUT_DIR = 'blog/static/images';

const spec = {
  filename: 'stillcut-2026-02-18-vs-bulbit.jpeg',
  alt: '겨울엔 양평, 불빛:애 — 남한강 위로 번지는 겨울밤의 온기',
  caption: '강바람은 차가운데, 빛은 따뜻하더라고요 — 이게 양평 겨울의 매력',
  prompt: `A lifestyle photograph of a winter light festival along the Namhan River in Yangpyeong, South Korea at night.

SUBJECT: A wide view of an illuminated riverside terrace promenade at dusk transitioning to night. Hundreds of warm-toned LED light installations line both sides of a walking path along the riverbank — string lights draped between wooden poles, ground-level light tubes in amber and soft gold creating pathways, and a few larger sculptural light installations shaped like trees and stars glowing in warm white. Couples and small groups of visitors in thick winter coats walk along the path, some holding hot drinks in paper cups, their breath visible in the cold air. The Namhan River reflects the lights in long, shimmering streaks of gold and amber on its dark surface. In the middle distance, a temporary stage area with colorful spotlights suggests upcoming fireworks or performances. Korean signage on a banner reads event information. A few food vendor stalls with warm yellow awning lights dot the edge of the promenade, steam rising from their cooking stations.

ATMOSPHERE: The magical transition moment when the deep blue of twilight yields to the warm glow of artificial lights — the sky retains a band of dark navy-blue at the horizon while the rest has gone to black. The winter air is crisp and biting — around minus 2 degrees — but the density of warm lights creates pockets of visual warmth. The river acts as a dark mirror, doubling every light source. There is a festive but intimate energy — this is not a massive commercial event but a community celebration, with locals walking their dogs alongside visiting couples. The cold makes people huddle closer together, creating natural groupings of warmth.

PHOTOGRAPHY STYLE: Lifestyle photography — eye-level perspective as if walking among the visitors. Medium-wide composition capturing the depth of the illuminated path stretching into the distance. Warm color temperature overall with the cool blue sky providing complementary contrast at the top of frame. Soft warm vignetting at edges. Bokeh from string lights creates circular light spots in the foreground and background. Slightly slow shutter speed to capture the gentle movement of walking visitors as subtle motion blur while the lights remain sharp. Golden highlights dominate the lower two-thirds while cool blue occupies the upper third — a natural warm-cool split that emphasizes the cozy atmosphere against winter's chill.

CRITICAL: Photorealistic photograph only. NO illustration, NO digital art, NO text overlay, NO watermark. Must convey Korean winter festival atmosphere — bundled-up visitors, Korean signage, riverside setting. The feeling should be "worth braving the cold for." Must fill entire frame edge-to-edge.`
};

async function main() {
  const client = new GeminiImageClient();
  if (!client.isConfigured() || !client.isEnabled()) {
    console.error('❌ GEMINI_API_KEY와 GEMINI_IMAGE_ENABLED=true 필요');
    process.exit(1);
  }

  const usage = await client.getDailyUsage();
  console.log(`📊 Gemini 이미지 쿼터: ${usage}/50\n`);

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
        console.error(`   ❌ 최종 실패`);
      }
    }
  }

  if (!image) process.exit(1);

  const outputPath = join(OUTPUT_DIR, spec.filename);
  const buffer = Buffer.from(image.base64Data, 'base64');
  await writeFile(outputPath, buffer);

  const sizeKB = Math.round(buffer.length / 1024);
  console.log(`   ✅ ${spec.filename} (${sizeKB}KB)\n`);

  console.log('📝 마크다운:');
  console.log(`![${spec.alt}](/travel-blog/images/${spec.filename})`);
  console.log(`*${spec.caption}*`);
}

main().catch(err => {
  console.error('오류:', err);
  process.exit(1);
});
