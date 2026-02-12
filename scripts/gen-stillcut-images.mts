/**
 * 을지로 디깅 포스트 — 섹션별 스틸컷 이미지 생성
 * 기존 AI 일러스트를 맥락에 맞는 포토리얼리스틱 스틸컷으로 교체
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
  {
    filename: 'inline-2026-02-11-12-1.jpeg',
    alt: '을지로 노가리골목 저녁 풍경',
    caption: '노가리골목의 밤 — 플라스틱 의자 사이로 흐르는 을지로의 리듬',
    prompt: `A documentary-style still photograph of a narrow Seoul alley (Euljiro Nogari Alley) at dusk.

SUBJECT: Tight alley lined with plastic chairs and foldable tables on both sides. On the nearest table, a plate of dried pollack (nogari) and two sweating glasses of draft beer under warm fluorescent tube lights. The tables maintain precise 15cm spacing — a subtle order in the chaos.

ATMOSPHERE: Golden-hour-to-blue-hour transition. Warm incandescent bulbs from the drinking stalls contrast with cool blue twilight visible at the end of the narrow alley. Faint silhouettes of people at distant tables. Haze from grilling smoke drifts through the light.

PHOTOGRAPHY STYLE: 35mm film grain, slightly desaturated warm tones, shallow depth of field focusing on the nearest table's nogari plate. Muted, documentary feel — like a frame from a Korean indie film. Eye-level perspective, as if sitting at the table.

CRITICAL: Photorealistic photograph only. NO illustration, NO text, NO watermark. Must fill entire frame edge-to-edge. Shot on film camera aesthetic.`
  },
  {
    filename: 'inline-2026-02-11-12-2.jpeg',
    alt: '을지로 철제가구거리 용접 작업장',
    caption: '철제가구거리의 시간 — 장인의 손끝에서 태어나는 1mm의 정밀함',
    prompt: `A documentary-style still photograph inside a small metalwork workshop on Euljiro's Steel Furniture Street, Seoul.

SUBJECT: Close-up of a rough-welded steel furniture frame resting on a workbench. Focus on the irregular, hand-made weld beads — bumpy, imperfect, clearly done by human hands, not factory machines. Behind the frame, blurred background shows metal dust particles floating in a shaft of daylight from the workshop entrance. A worn blueprint/drawing is partially visible under the steel piece.

ATMOSPHERE: Industrial warmth. Natural daylight streaming through a half-open corrugated metal door, mixing with the cool interior shadow. Fine iron dust particles catching the light like fireflies. The patina of decades of metalwork on every surface.

PHOTOGRAPHY STYLE: Macro-ish close-up with shallow depth of field. 50mm lens feel. Slightly cool color temperature with warm highlights where sunlight hits the metal. Film grain texture. Documentary photography — capturing the beauty in industrial craft. Low angle, looking slightly up at the weld joints.

CRITICAL: Photorealistic photograph only. NO illustration, NO text, NO watermark. Must fill entire frame edge-to-edge. The texture of the weld marks must be visible in detail.`
  },
  {
    filename: 'inline-2026-02-11-12-3.jpeg',
    alt: '을지로 산림동 맨홀 뚜껑 1987',
    caption: '1987년이 새겨진 맨홀 — 을지로 골목 바닥에 잠든 시간의 지층',
    prompt: `A documentary-style still photograph looking straight down at a weathered cast-iron manhole cover on a Seoul back-alley floor (Euljiro Sallim-dong area).

SUBJECT: A round cast-iron manhole cover with the year "1987" cast into the metal surface, surrounded by cracked and patched asphalt. The iron has a dark patina from 40 years of foot traffic. Around the manhole, the ground shows layers of time: original stone pavement peeking through cracked asphalt, a patch of different-era concrete repair, and faded paint markings. A few fallen ginkgo leaves or urban debris rest in the grooves.

ATMOSPHERE: Overcast daylight creating soft, even illumination that reveals every texture. The ground tells a geological story — layers of repairs from different decades. Subtle color variations between old asphalt (blue-grey), newer patches (warm grey), and the dark iron manhole.

PHOTOGRAPHY STYLE: Bird's-eye view, shot directly from above looking straight down. Wide-ish angle to include the surrounding pavement context. Sharp focus across the entire frame (deep depth of field). Slightly desaturated, documentary color palette. The "1987" numbers should be clearly legible but naturally worn. Film-like grain.

CRITICAL: Photorealistic photograph only. NO illustration, NO text overlay, NO watermark. Must fill entire frame edge-to-edge. The year "1987" must be naturally cast into the iron, not added digitally.`
  }
];

async function main() {
  const client = new GeminiImageClient();
  if (!client.isConfigured() || !client.isEnabled()) {
    console.error('GEMINI_API_KEY와 GEMINI_IMAGE_ENABLED=true 필요');
    process.exit(1);
  }

  const usage = await client.getDailyUsage();
  console.log(`📊 Gemini 이미지 쿼터: ${usage}/50 (3장 생성 예정 → ${usage + 3}/50)`);

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
          throw err;
        }
      }
    }

    const outputPath = join(OUTPUT_DIR, spec.filename);
    const buffer = Buffer.from(image!.base64Data, 'base64');
    await writeFile(outputPath, buffer);

    const sizeKB = Math.round(buffer.length / 1024);
    console.log(`   ✅ ${spec.filename} (${sizeKB}KB, ${image!.mimeType})`);

    // 요청 간 2초 대기
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('\n📝 마크다운 업데이트 필요:');
  for (const spec of specs) {
    console.log(`   ![${spec.alt}](/travel-blog/images/${spec.filename})`);
    console.log(`   *${spec.caption}*\n`);
  }
}

main().catch(err => {
  console.error('오류:', err);
  process.exit(1);
});
