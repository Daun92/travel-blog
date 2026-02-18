/**
 * 성수동 팝업스토어 포스트용 스틸컷 생성
 * 1위 무신사 뷰티 페스타 + 2위 탬버린즈 성수 플래그십
 *
 * Usage: npx tsx scripts/gen-seongsu-stillcut.mts
 */
import { config } from 'dotenv';
config();

import { writeFile } from 'fs/promises';
import { join } from 'path';
import { GeminiImageClient } from '../src/images/gemini-imagen.js';

const OUTPUT_DIR = 'blog/static/images';

interface StillcutSpec {
  filename: string;
  alt: string;
  caption: string;
  prompt: string;
}

const specs: StillcutSpec[] = [
  // ── 1위: 무신사 뷰티 페스타 (viral/조회영) ──────────────────────
  {
    filename: 'stillcut-seongsu-beautyfesta.jpeg',
    alt: '무신사 뷰티 페스타 부스 — 컬러풀한 화장품 샘플과 인파',
    caption: '입장료 1.5만 원에 쇼핑백이 이렇게 됨 — 남는 장사 인정',
    prompt: `An editorial magazine photograph of a crowded beauty festival event inside a converted warehouse space in Seoul's Seongsu-dong industrial district.

SUBJECT: A wide view of a bustling indoor beauty festival with 40+ brand booths arranged in rows inside a renovated industrial warehouse. Colorful cosmetic displays fill every booth — lipstick testers in gradient racks, skincare ampoules lit from below, perfume bottles on mirrored surfaces. Several visitors (mostly women in their 20s-30s in trendy Korean winter outfits — padded jackets, crossbody bags) carry oversized branded paper shopping bags already bulging with product samples. One visitor in the foreground holds three shopping bags in one hand and a matcha latte in the other, checking her phone. The warehouse ceiling shows exposed steel trusses and industrial pendant lights with warm Edison bulbs. Neon LED brand signage in Korean and English glows at each booth. A "GAME ZONE" corner is visible in the background with a short queue.

ATMOSPHERE: The electric energy of a must-attend event — buzzing conversations, the rustle of shopping bags, the sweet mix of perfume samples in the air. Warm artificial lighting from booth displays creates pools of color — pink from one brand, gold from another, cool blue from a third. Despite the crowd, there's a sense of organized excitement rather than chaos. Late morning weekend light filters through high industrial windows, mixing with the warm booth lighting.

PHOTOGRAPHY STYLE: Editorial magazine photography — dramatic diagonal composition following the row of booths receding into the background. High contrast with deep blacks in the ceiling structure and saturated, vivid colors from the cosmetic displays. Strong color pops — the coral pink of a lipstick display, the gold of a luxury brand booth, the neon green of a game zone sign. Shot from a slightly elevated angle (standing on tiptoes or a step) to capture both the crowd density and the colorful booth landscape. Bold, aggressive framing that says "this is THE event."

CRITICAL: Photorealistic photograph only. NO illustration, NO 3D render, NO digital art, NO text overlay, NO watermark. Must show Korean text on signage naturally. Must convey the sense of "I got way more than my money's worth." Must fill entire frame edge-to-edge.`
  },

  // ── 2위: 탬버린즈 성수 플래그십 (viral/조회영) ─────────────────
  {
    filename: 'stillcut-seongsu-tamburins.jpeg',
    alt: '탬버린즈 성수 플래그십 외관 — 노출 콘크리트 건물 뼈대와 대기 행렬',
    caption: '건물 뼈대만 남긴 이 외관 — 멋있긴 한데 150번 대기는 좀',
    prompt: `An editorial magazine photograph of the exterior facade of a high-end perfume brand flagship store in Seoul's Seongsu-dong, featuring a dramatically deconstructed industrial building.

SUBJECT: A striking two-story building where the original factory facade has been intentionally stripped to its raw structural skeleton — exposed concrete columns, bare steel I-beams, and sections of original brick wall deliberately left unfinished. Large floor-to-ceiling glass panels are set within the raw structure, revealing a minimalist white interior with sparse perfume displays on concrete pedestals. A long queue of about 25-30 well-dressed young Koreans (trendy streetwear, bucket hats, oversized coats) snakes along the sidewalk from the entrance. Some people in line are checking phones, others taking photos of the facade. A small Korean sign near the entrance shows a queue number in the 150s. The sidewalk is clean gray pavement with young ginkgo trees (bare winter branches) planted at regular intervals. Neighboring buildings show the typical Seongsu-dong mix of old industrial and new trendy.

ATMOSPHERE: A crisp winter afternoon — bright but cold. The raw concrete absorbs the pale winter sunlight, creating subtle warm tones on its rough texture. The contrast between the deliberately ruined exterior and the pristine white interior visible through the glass creates architectural tension. The queue has a resigned patience to it — people are cold but committed. The overall mood says "this place is worth the wait, maybe."

PHOTOGRAPHY STYLE: Editorial magazine photography — hero framing of the building facade with dramatic perspective. Shot from across the street at a slight upward angle to emphasize the building's imposing deconstructed form. Strong diagonal lines from the exposed beams create dynamic composition. High contrast — deep shadows in the structural voids, bright highlights on the glass and concrete surfaces. Bold, graphic quality with the queue of people providing human scale against the architectural drama. Color grading: cool shadows with warm concrete midtones.

CRITICAL: Photorealistic photograph only. NO illustration, NO 3D render, NO digital art, NO text overlay, NO watermark. The building should look like a deliberately deconstructed industrial space converted into luxury retail — NOT a ruin or construction site. Korean winter atmosphere must be evident. Must fill entire frame edge-to-edge.`
  },
];

async function main() {
  const client = new GeminiImageClient();
  if (!client.isConfigured() || !client.isEnabled()) {
    console.error('❌ GEMINI_API_KEY와 GEMINI_IMAGE_ENABLED=true 필요');
    process.exit(1);
  }

  const usage = await client.getDailyUsage();
  console.log(`📊 Gemini 이미지 쿼터: ${usage}/50 (${specs.length}장 생성 예정)`);

  for (const spec of specs) {
    console.log(`\n🎬 생성 중: ${spec.alt}...`);

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
    console.log(`   ✅ ${spec.filename} (${sizeKB}KB, ${image.mimeType})`);
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('\n📝 마크다운 삽입용:');
  for (const spec of specs) {
    console.log(`   ![${spec.alt}](/travel-blog/images/${spec.filename})`);
    console.log(`   *${spec.caption}*\n`);
  }
}

main().catch(err => {
  console.error('오류:', err);
  process.exit(1);
});
