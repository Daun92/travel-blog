/**
 * 경복궁 향원정 야경 AI 스틸컷 생성
 */
import { config } from 'dotenv'; config();
import { generateAndSaveImage } from '../src/images/gemini-imagen.js';

const SLUG = '2026-02-20-seoul-five-palaces-spring-tour-guide';
const IMG_DIR = 'blog/static/images';

async function main() {
  console.log('=== 경복궁 향원정 야경 스틸컷 생성 ===');
  const result = await generateAndSaveImage(
    {
      prompt: `SUBJECT: Hyangwonjeong Pavilion (향원정) at Gyeongbokgung Palace at night. A traditional Korean hexagonal wooden pavilion standing on a small round island in the center of a rectangular lotus pond. The Chwihyanggyo bridge (취향교) — a long wooden footbridge with low railings — extends from the shore to the island.

ATMOSPHERE: Deep blue twilight, 8pm in spring. Warm golden artificial lighting illuminates the pavilion and bridge from below, creating perfect mirror reflections on the still water surface. The water reflects both the lit pavilion and the dark silhouette of surrounding pine trees. A few visitors' silhouettes visible on the bridge, creating a sense of scale. The sky retains a deep indigo gradient above the treeline.

PHOTOGRAPHY STYLE: Architectural night photography. Shot from the south bank at eye level, showing the full bridge leading to the pavilion. Long exposure effect — the water surface is glass-smooth, creating a perfect symmetrical reflection. Color temperature balanced between warm (pavilion lights) and cool (twilight sky). Sharp focus on the pavilion structure with slight softness in the reflection. No HDR, no oversaturation — natural night atmosphere with balanced exposure. The composition follows the rule of thirds with the pavilion at the upper-right intersection point.

CRITICAL DETAILS: Traditional Korean dancheong (단청) colors visible on the pavilion eaves under the lighting. The curved roofline of the pavilion contrasts with the straight railings of the bridge. No modern elements visible — no street lights, no buildings in background.`,
      style: 'cover_photo',
      aspectRatio: '16:9',
      topic: '경복궁 향원정 야경',
      personaId: 'informative',
    },
    IMG_DIR,
    `inline-${SLUG}-night.jpeg`
  );
  console.log(result ? `OK: ${result.filename}` : 'FAILED');
}

main().catch(e => { console.error(e); process.exit(1); });
