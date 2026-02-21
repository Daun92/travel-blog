/**
 * 단양 고수동굴 내부 스틸컷 재생성
 * 기존 inline-4 (매표소 외부) → 동굴 내부 서사에 맞는 이미지로 교체
 */
import { config } from 'dotenv'; config();
import { GeminiImageClient, saveImage } from '../src/images/gemini-imagen.js';

const SLUG = '2026-02-20-danyang-day-trip-course-and-cost';
const IMG_DIR = 'blog/static/images';
const FILENAME = `inline-${SLUG}-4`;

async function main() {
  const client = new GeminiImageClient();

  // 사용량 체크
  const usage = await client.checkUsageLimit(1);
  if (!usage.allowed) {
    console.error(`일일 이미지 한도 초과: ${usage.current}/${usage.limit}`);
    process.exit(1);
  }
  console.log(`이미지 사용량: ${usage.current}/${usage.limit}`);

  // 고수동굴 내부 스틸컷 프롬프트 — 본문 서사 반영
  const prompt = `A photorealistic photograph for a Korean travel blog post about: 단양 고수동굴 당일치기 여행

SUBJECT: Interior of Gosu Cave (고수동굴), Danyang, South Korea. Massive stalactites and stalagmites formed over tens of thousands of years, dramatically lit by warm artificial spotlights that reveal their silhouettes against the dark cave walls. Narrow steel walkway with metal railings winding through the cave passage. Wet, glistening rock surfaces catching the light. Low ceiling sections where visitors need to duck. The sense of geological time frozen in limestone formations. NO people, NO text, NO signs — pure cave interior geology.

ATMOSPHERE: Complete absence of natural light. Cool, humid underground air. The profound silence of a space untouched by weather or seasons. Warm artificial lighting creates dramatic contrast between illuminated formations and deep shadows. The feeling of stepping into a world millions of years old. Korean limestone cave interior with characteristic formations.

PHOTOGRAPHY STYLE: Lifestyle photography — warm tone lighting with soft bokeh on background formations. Eye-level perspective along the walkway, looking ahead into the cave depth. Warm highlights from spotlights on wet rock surfaces, deep shadows in recesses. The feeling should be atmospheric and immersive, as if the viewer is walking through the cave themselves. Rich warm tones from the artificial lighting contrasting with cool blue shadows in the depths.

CRITICAL: Photorealistic photograph ONLY. NO illustration, NO digital art, NO cartoon, NO text overlay, NO watermark. Must look like an actual photograph taken inside a Korean limestone cave. Must fill entire frame edge-to-edge. Cave interior atmosphere must be unmistakable — stalactites, stalagmites, wet rock, artificial lighting.`;

  console.log('고수동굴 내부 스틸컷 생성 중...');
  const image = await client.generateImage({
    prompt,
    style: 'cover_photo',
    aspectRatio: '16:9',
    topic: '단양 고수동굴 내부',
    personaId: 'friendly',
  });

  console.log('Sharp 최적화 + 저장 중...');
  const saved = await saveImage(image, IMG_DIR, FILENAME, {
    optimize: true,
    maxWidth: 1200,
    quality: 85,
  });

  console.log(`저장 완료: ${saved.filepath}`);
  console.log(`Hugo 경로: ${saved.relativePath}`);
}

main().catch(e => { console.error(e); process.exit(1); });
