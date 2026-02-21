/**
 * 궁궐 포스트 커버 이미지 교체 — 봄-야경 AI 커버
 * 한교양(informative) 페르소나 + 관인 오버레이 적용
 */

import { config } from 'dotenv';
config();

import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import matter from 'gray-matter';
import { GeminiImageClient } from '../src/images/gemini-imagen.js';
import { getVisualIdentity, getCoverCaption } from '../src/images/cover-styles.js';
import { applyOverlayToBase64 } from '../src/images/cover-overlay.js';

const POST_PATH = 'blog/content/posts/travel/2026-02-20-seoul-five-palaces-spring-tour-guide.md';
const OUTPUT_DIR = 'blog/static/images';
const BASE_URL = process.env.HUGO_BASE_URL || '/travel-blog';
const COVER_FILENAME = 'cover-2026-02-20-seoul-five-palaces-spring-tour-guide.jpg';

const SPRING_NIGHT_PROMPT = `Generate a photorealistic cover photograph for a Korean blog post.

Topic: "서울 5대 궁궐 봄 투어: 경복궁 별빛야행부터 창덕궁 후원까지"
Content type: Travel destination — in-depth architectural heritage tour

WHAT TO SHOW:
A breathtaking SPRING NIGHT scene at one of Seoul's grand palaces (Gyeongbokgung or Changdeokgung).
- Cherry blossoms in full bloom, their pale pink petals illuminated by warm traditional lantern light
- The palace pavilion (like Gyeonghoeru or Hyangwonjeong) reflected perfectly in the palace pond at night
- Soft, atmospheric lighting that mixes warm lantern glow with cool moonlight — creating a dreamlike, ethereal atmosphere
- The viewer should feel transported to a magical, timeless moment where ancient palace architecture meets spring's most beautiful expression
- This is NOT a daytime tourist photo — it is a cinematic NIGHT scene with dramatic lighting that stirs the imagination
- Include subtle details: fallen petals on still water, distant palace rooftops silhouetted against a deep blue-purple sky, gentle mist

CREATIVE DIRECTION — Documentary poster / museum exhibition banner:
- Elegant, cinematic framing that rewards careful observation.
- Capture the architectural beauty, historical depth, and structural elegance of the subject.
- A single frame that conveys heritage, mystery, and the magic of Korean spring nights.
- Think: National Geographic "Asia's Hidden Wonders" cover, or a Netflix K-drama promotional still.
- The mood should be: serene yet awe-inspiring, intimate yet grand — the kind of image that makes someone stop scrolling and dream.

PHOTOGRAPHY STYLE:
- Style: architectural photography with dramatic night lighting and attention to detail
- Composition: symmetry, rule of thirds, geometric framing, balanced elements, strong reflection
- Color grading: deep blue-purple sky, warm golden lantern highlights, soft pink cherry blossom tones, cool shadows
- Mood: refined, dreamlike, ethereal, intellectual, romantic

CRITICAL REQUIREMENTS:
- Must look like a REAL photograph by a professional photographer. NO illustration, NO digital art, NO cartoon, NO painting, NO 3D render.
- Aspect ratio: 16:9 landscape (1200x675 pixels).
- The photograph MUST fill the ENTIRE frame edge-to-edge. NO white space, NO margins, NO empty areas.
- Do NOT include any text, caption, watermark, logo, title, or overlay anywhere in the image. Pure photograph only.
- Korean palace architecture must be unmistakable — traditional curved rooflines (처마), dancheong patterns, stone foundations.
- NIGHT TIME with spring cherry blossoms is the core concept — this must be obvious at a glance.`;

async function main() {
  console.log('🏯 궁궐 포스트 봄-야경 커버 생성 시작...\n');

  // 1. 포스트 읽기
  const postContent = await readFile(POST_PATH, 'utf-8');
  const { data: frontmatter, content } = matter(postContent);
  const agentId = frontmatter.personaId || 'informative';
  const identity = getVisualIdentity(agentId);

  console.log(`📄 포스트: ${frontmatter.title}`);
  console.log(`🎭 페르소나: ${identity.displayName} (${agentId})`);
  console.log(`🎨 현재 커버: ${frontmatter.cover?.image}\n`);

  // 2. Gemini로 봄-야경 커버 생성
  const client = new GeminiImageClient();
  if (!client.isConfigured() || !client.isEnabled()) {
    console.error('❌ Gemini API가 비활성화 상태입니다.');
    process.exit(1);
  }

  console.log('🖼️  Gemini 이미지 생성 중 (봄-야경 궁궐)...');
  const image = await client.generateImage({
    prompt: SPRING_NIGHT_PROMPT,
    style: 'cover_photo',
    aspectRatio: '16:9',
    personaId: agentId,
  });

  console.log('✅ 이미지 생성 완료\n');

  // 3. 관인 오버레이 적용 + 저장
  const outputPath = join(OUTPUT_DIR, COVER_FILENAME);
  console.log(`🔏 관인(${identity.sealChars}) 오버레이 적용 중...`);
  await applyOverlayToBase64(image.base64Data, outputPath, '', identity);
  console.log(`💾 저장: ${outputPath}\n`);

  // 4. frontmatter 업데이트
  const newCoverPath = `${BASE_URL}/images/${COVER_FILENAME}`;
  const caption = getCoverCaption(agentId, frontmatter.title || '서울 5대 궁궐');

  frontmatter.cover = {
    image: newCoverPath,
    alt: '벚꽃 야경 속 서울 궁궐 — 봄밤의 고궁이 품은 조선 500년의 고요',
    caption,
    relative: false,
    hidden: false,
  };

  const updated = matter.stringify(content, frontmatter);
  await writeFile(POST_PATH, updated, 'utf-8');

  console.log('📝 frontmatter 업데이트 완료:');
  console.log(`   image: ${newCoverPath}`);
  console.log(`   alt: ${frontmatter.cover.alt}`);
  console.log(`   caption: ${caption}`);
  console.log('\n🎉 봄-야경 궁궐 커버 교체 완료!');
}

main().catch(err => {
  console.error('❌ 오류:', err);
  process.exit(1);
});
