/**
 * 영등굿 포스트 스틸컷 재생성
 * §2 inline-2-3 교체 (실내 전시 → 야외 굿판) + §3 inline-2-5 신규 (씨드림/배방선)
 */
import { config } from 'dotenv';
config();

import { GeminiImageClient } from '../src/images/gemini-imagen.js';
import { writeFile } from 'fs/promises';
import { join } from 'path';

const OUTPUT_DIR = join(process.cwd(), 'blog', 'static', 'images');

interface StillcutTarget {
  filename: string;
  section: string;
  prompt: string;
  topic: string;
}

const targets: StillcutTarget[] = [
  {
    filename: 'inline-2026-02-18-jeju-yeongdeung-haenyeo-2-3.jpeg',
    section: '§2 칠머리당 영등굿 의례',
    topic: '칠머리당 영등굿 의례',
    prompt: `A photorealistic photograph of a traditional Korean shamanic ritual (굿) at a seaside shrine in Jeju Island.

SUBJECT: The Chilmeoridang Yeongdeunggut ritual — a UNESCO Intangible Cultural Heritage ceremony.
A female shaman (심방) in traditional white ceremonial robes performing a dynamic dance with flowing fabric movements.
Colorful paper spirit flags (기메) are strung on ropes, fluttering vigorously in the strong sea wind.
A humble stone altar with ritual offerings — rice cakes, dried fish, fruit — arranged on a low table.
The shrine area faces the open ocean, with waves crashing against dark volcanic rocks visible in the background.

ATMOSPHERE: Late afternoon golden light filtering through scattered clouds.
The intense Jeju wind is palpable — fabric, paper flags, and hair all streaming in the same direction.
A sense of sacred solemnity mixed with raw natural power.
The ocean is visible as a vast grey-blue expanse behind the ritual space.
Authentic Jeju volcanic stone walls partially visible.

PHOTOGRAPHY STYLE: Documentary photography with architectural precision.
Even, balanced lighting with attention to structural detail of the ritual setup.
Medium-wide angle capturing both the ritual performers and the ocean backdrop.
Balanced exposure, cool shadows from the overcast sky, warm accent from candles and offerings.
Clean composition emphasizing the geometric contrast between the orderly ritual space and the wild ocean.

CRITICAL: Photorealistic photograph ONLY. NO illustration, NO digital art, NO cartoon, NO text overlay, NO watermark.
Must look like an actual documentary photograph taken on location at a real Jeju shamanic ceremony.
Korean atmosphere must be unmistakable — volcanic stone, ocean wind, traditional ritual elements.`,
  },
  {
    filename: 'inline-2026-02-18-jeju-yeongdeung-haenyeo-2-5.jpeg',
    section: '§3 씨드림과 배방선',
    topic: '영등굿 씨드림과 배방선',
    prompt: `A photorealistic photograph of the Baebangson (배방선) ritual at a Jeju Island seashore during the Yeongdeunggut ceremony.

SUBJECT: A small straw boat (짚배) loaded with ritual offerings — bundles of dried fish, fruits, and paper prayers — being released into the ocean at dusk.
The boat floats on gentle waves just beyond the volcanic rock shoreline, slowly drifting toward the open horizon.
Several elderly women in simple work clothing stand at the water's edge watching the boat depart.
The rocky Jeju coastline with dark basalt stones stretches along the shore.

ATMOSPHERE: Magic hour — the sun is setting low on the horizon, casting long warm orange and purple light across the ocean surface.
Gentle sea mist softens the distance where sky meets water.
The mood is contemplative and solemn — a farewell to misfortune, a prayer carried away by the tide.
Wind is present but calmer than before, as if the sea itself is holding its breath for the departing boat.

PHOTOGRAPHY STYLE: Documentary photography with architectural precision.
Low angle from the shoreline, emphasizing the small boat against the vast ocean and sunset sky.
Balanced exposure capturing both the detail of the straw boat and the expansive sunset behind it.
Cool foreground tones from volcanic rock contrasting with warm background light.
Sharp focus on the boat with the horizon line at the upper third.

CRITICAL: Photorealistic photograph ONLY. NO illustration, NO digital art, NO cartoon, NO text overlay, NO watermark.
Must look like an actual documentary photograph of a Korean coastal ritual.
The straw boat should look handcrafted and authentic, not polished or artificial.`,
  },
];

async function generateImage(client: GeminiImageClient, target: StillcutTarget): Promise<boolean> {
  console.log(`\n🎨 ${target.section}: ${target.filename} 생성 중...`);

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const image = await client.generateImage({
        prompt: target.prompt,
        style: 'cover_photo',
        aspectRatio: '16:9',
        topic: target.topic,
        personaId: 'informative',
      });

      const buffer = Buffer.from(image.base64Data, 'base64');
      const outPath = join(OUTPUT_DIR, target.filename);
      await writeFile(outPath, buffer);
      console.log(`✅ 저장: ${target.filename} (${(buffer.length / 1024).toFixed(0)}KB)`);
      return true;
    } catch (err) {
      console.log(`⚠️ 시도 ${attempt} 실패: ${(err as Error).message}`);
      if (attempt < 3) {
        const delay = 5000 * attempt;
        console.log(`   ${delay / 1000}초 후 재시도...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  console.error(`❌ ${target.section}: 3회 시도 모두 실패`);
  return false;
}

async function main() {
  const client = new GeminiImageClient();

  if (!client.isConfigured()) {
    console.error('❌ GEMINI_API_KEY 미설정');
    process.exit(1);
  }

  const usage = await client.getDailyUsage();
  console.log(`📊 Gemini 이미지 쿼터: ${usage}/50 (${targets.length}장 생성 예정)`);

  const results: { section: string; success: boolean }[] = [];

  for (const target of targets) {
    const success = await generateImage(client, target);
    results.push({ section: target.section, success });
  }

  console.log('\n=== 결과 요약 ===');
  for (const r of results) {
    console.log(`${r.success ? '✅' : '❌'} ${r.section}`);
  }
}

main().catch(console.error);
