/**
 * March TOP 5 — AI Illustration + Stillcut Generation
 *
 * 4 illustrations (type-guide + moodboard x2) + 5 stillcuts (KTO gap fallback)
 * Persona: viral (조회영) — editorial magazine, high contrast, dramatic
 *
 * Usage:
 *   npx tsx scripts/gen-march-top5-images.mts              # All 9
 *   npx tsx scripts/gen-march-top5-images.mts --only illust # 4 illustrations
 *   npx tsx scripts/gen-march-top5-images.mts --only still  # 5 stillcuts
 *   npx tsx scripts/gen-march-top5-images.mts --dry-run     # Preview prompts
 */
import { config } from 'dotenv';
config();

import { writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { GeminiImageClient } from '../src/images/gemini-imagen.js';

const OUTPUT_DIR = 'blog/static/images';
const DRY_RUN = process.argv.includes('--dry-run');
const ONLY = (() => {
  const idx = process.argv.indexOf('--only');
  return idx >= 0 ? process.argv[idx + 1] : 'all';
})();

interface ImageSpec {
  filename: string;
  alt: string;
  caption: string;
  prompt: string;
  style: 'cover_photo' | 'comparison' | 'moodboard';
  aspectRatio: '16:9' | '3:4' | '1:1';
  category: 'illust' | 'still';
  postSlug: string;
  note: string;
}

// ── Illustrations ────────────────────────────────────────────────────

const illustrations: ImageSpec[] = [
  // Festival type-guide
  {
    filename: 'inline-march-spring-festival-top5-typeguide.jpeg',
    alt: '3월 봄 축제 성향 매칭 가이드',
    caption: '작성자: 조회영 · 어떤 축제가 내 취향? 5초 테스트',
    style: 'comparison',
    aspectRatio: '3:4',
    category: 'illust',
    postSlug: 'march-spring-festival-top5',
    note: '도입부 type-guide',
    prompt: `A vibrant editorial infographic illustration comparing 5 Korean spring festivals in a magazine-style layout.

LAYOUT: Split into 5 horizontal rows, each showing a festival type with playful Korean-style illustrations:
Row 1: "꽃+한우" — yellow sansuyu flowers next to sizzling Korean beef on a grill
Row 2: "꽃+해산물" — red camellia flowers next to cute octopus (jukkumi) illustration
Row 3: "벚꽃 터널" — pink cherry blossom tunnel with a walking couple silhouette
Row 4: "산수유 마을" — golden yellow village scene with traditional stone walls
Row 5: "수도권 당일치기" — a clock icon showing "1hr from Seoul" with spring flowers

STYLE: Clean, bold magazine infographic. Korean editorial design aesthetic with strong color blocks. Each row has a distinct color theme (yellow, red, pink, gold, green). Playful hand-drawn illustration feel mixed with modern typography layout. White background with colorful content blocks.

CRITICAL: This is an ILLUSTRATION, not a photograph. Clean graphic design, hand-drawn elements welcome. NO real photos. Fill the entire frame. Korean spring festival theme throughout.`
  },

  // Festival moodboard
  {
    filename: 'inline-march-spring-festival-top5-moodboard.jpeg',
    alt: '3월 봄 축제 콜라주 무드보드',
    caption: '작성자: 조회영 · 3월 봄축제 이건 꼭 봐야 됨',
    style: 'moodboard',
    aspectRatio: '16:9',
    category: 'illust',
    postSlug: 'march-spring-festival-top5',
    note: '마무리 moodboard',
    prompt: `A dreamy collage moodboard of Korean spring festivals — the feeling of a travel magazine's closing spread.

COMPOSITION: Overlapping polaroid-style frames and torn paper edges creating a scrapbook collage effect. 5 scenes blended together:
- Golden yellow sansuyu (cornus) flowers covering a hillside village with traditional stone walls
- Red camellia blooms with a harbor and fishing boats in the background
- A tunnel of pink cherry blossoms with petals falling like snow
- A steaming bowl of Korean beef soup next to spring flowers
- A winding country road through green rice paddies with distant mountains

COLOR PALETTE: Warm spring tones — sansuyu yellow, camellia red, cherry blossom pink, fresh green, warm sunlight gold. Overall warm and inviting.

STYLE: Collage/scrapbook aesthetic with soft edges, overlapping layers, and a handwritten note feel. Watercolor wash background connecting the scenes. Nostalgic but vibrant. Travel journal aesthetic.

CRITICAL: This is an ILLUSTRATION/collage, not a photograph. Dreamy, artistic, magazine editorial closing page feel. NO text, NO watermark. Fill entire frame.`
  },

  // Exhibition type-guide
  {
    filename: 'inline-march-seoul-exhibition-top5-typeguide.jpeg',
    alt: '3월 서울 전시 성향 매칭 가이드',
    caption: '작성자: 조회영 · 전시? 다 비슷비슷? 5초 테스트',
    style: 'comparison',
    aspectRatio: '3:4',
    category: 'illust',
    postSlug: 'march-seoul-exhibition-top5',
    note: '도입부 type-guide',
    prompt: `A sophisticated editorial infographic illustration comparing 5 Seoul art exhibitions in a gallery magazine layout.

LAYOUT: Split into 5 sections with distinct visual identities:
Section 1: "현대미술 충격" — a diamond-encrusted skull silhouette (Damien Hirst style) with dramatic spotlight
Section 2: "살아있는 전시" — abstract human figures in motion, performance art feel (Tino Sehgal style)
Section 3: "미니멀 가구" — clean geometric furniture shapes, minimal lines (Donald Judd style)
Section 4: "서브컬처 체험" — colorful pop-art style collage with brand logos and street culture elements
Section 5: "그림책 원화" — delicate watercolor children's illustration style frames

STYLE: High-end art magazine infographic. Each section has its own distinct artistic style matching the exhibition genre. Clean white space between sections. Sophisticated color palette: gallery whites, dramatic blacks, and accent colors unique to each section. Modern typography layout feel.

CRITICAL: This is an ILLUSTRATION, not a photograph. Gallery/museum editorial design. NO real photos. Fill entire frame. Seoul art scene sophistication.`
  },

  // Exhibition moodboard
  {
    filename: 'inline-march-seoul-exhibition-top5-moodboard.jpeg',
    alt: '3월 서울 전시 무드보드',
    caption: '작성자: 조회영 · 3월 서울 미술관 이건 꼭 봐야 됨',
    style: 'moodboard',
    aspectRatio: '16:9',
    category: 'illust',
    postSlug: 'march-seoul-exhibition-top5',
    note: '마무리 moodboard',
    prompt: `A sophisticated collage moodboard of Seoul's art exhibition scene — cinematic, gallery-inspired closing spread.

COMPOSITION: Overlapping frames with gallery-white backgrounds and dramatic spot lighting. 5 scenes blended together:
- A dramatic spotlight on a glass vitrine in a dark gallery space (contemporary art)
- Silhouettes of people interacting in an empty white gallery room (performance art)
- Clean minimal furniture forms in a concrete space with natural light (design exhibition)
- A vibrant, crowded pop-culture marketplace with neon colors (subcultural fair)
- Delicate watercolor illustrations pinned on white walls with warm gallery lighting (illustration exhibition)

COLOR PALETTE: Gallery sophistication — deep blacks, pure whites, warm gallery spotlights, occasional bold color accents. The overall mood transitions from dramatic dark to warm inviting light.

STYLE: Art book/gallery catalog closing spread. Clean, sophisticated collage with film-strip and gallery-wall framing elements. Subtle texture overlays. Cinematic lighting transitions between sections.

CRITICAL: This is an ILLUSTRATION/collage, not a photograph. Museum/gallery editorial feel. NO text, NO watermark. Fill entire frame. Seoul contemporary art scene aesthetic.`
  },
];

// ── Stillcuts (KTO gap fallback) ─────────────────────────────────────

const stillcuts: ImageSpec[] = [
  // Festival: 3위 양평 산수유·한우
  {
    filename: 'stillcut-march-spring-festival-top5-yangpyeong.jpeg',
    alt: '양평 산수유·한우 축제 현장',
    caption: '양평 개군면 산수유 — 노란 꽃 아래 한우 먹방, 이게 진짜 봄축제지',
    style: 'cover_photo',
    aspectRatio: '16:9',
    category: 'still',
    postSlug: 'march-spring-festival-top5',
    note: '3위 양평 AI 폴백',
    prompt: `A photorealistic editorial magazine photograph of a Korean spring festival in Yangpyeong county, Gyeonggi Province.

SUBJECT: A festival food court under golden sansuyu (cornus officinalis) trees in full bloom. In the foreground, a large outdoor grill with premium Korean beef (hanwoo) sizzling, sending smoke curling up through the yellow flower canopy above. Behind: festival tents, families sitting at tables, mountains in the background. The contrast of rustic outdoor dining under delicate yellow spring flowers.

ATMOSPHERE: Bright spring morning. Warm sunlight filtering through the dense yellow sansuyu canopy creating dappled light on the tables below. The air feels crisp but warming. Festival energy — people moving between food stalls and flower-viewing paths. Rural Korean countryside charm with mountains visible.

PHOTOGRAPHY STYLE: Editorial magazine cover shot. Diagonal composition — the grill and smoke leading the eye upward into the yellow flower canopy. Hero framing of the food+flowers combination. High contrast — deep shadows under the trees against brilliant yellow blossoms. Strong saturation on the yellows. Shot at eye level, as if you just arrived at the festival. 35mm lens, shallow depth of field on the grill with bokeh flowers behind.

CRITICAL: Photorealistic photograph ONLY. NO illustration, NO text, NO watermark. Must fill entire frame edge-to-edge. Korean spring festival atmosphere. The YELLOW sansuyu flowers and SIZZLING BEEF must both be clearly visible.`
  },

  // Festival: 5위 이천 백사
  {
    filename: 'stillcut-march-spring-festival-top5-icheon.jpeg',
    alt: '이천 백사 산수유 마을 풍경',
    caption: '이천 백사면 — 서울에서 1시간, 100년 산수유 나무 아래 봄이 온다',
    style: 'cover_photo',
    aspectRatio: '16:9',
    category: 'still',
    postSlug: 'march-spring-festival-top5',
    note: '5위 이천 AI 폴백',
    prompt: `A photorealistic editorial magazine photograph of Baeksa-myeon sansuyu village in Icheon, Gyeonggi Province, Korea.

SUBJECT: A winding village path between traditional Korean stone walls, with century-old sansuyu (cornus) trees arching overhead in full golden-yellow bloom. The trees are massive — thick, gnarled trunks showing their 100+ year age, branches creating a yellow tunnel effect. A few visitors walking the path in spring jackets. Traditional Korean hanok roof tiles visible beyond the stone walls.

ATMOSPHERE: Late morning spring light. The entire scene is bathed in warm golden yellow from the dense sansuyu canopy. Peaceful, rural Korean countryside. The stone walls are weathered grey contrasting with the vivid yellow. Distant mountains (suburban Seoul proximity implied by the modern but peaceful setting).

PHOTOGRAPHY STYLE: Editorial magazine hero shot. Bold diagonal perspective along the winding path, creating dramatic depth. Strong contrast between the dark gnarled tree trunks and the brilliant yellow blossoms. High saturation on yellows, deep shadows on the stone walls. Slightly low angle looking up into the flower canopy. 24mm wide-angle lens feel to capture the tunnel effect. Magazine-cover worthy framing.

CRITICAL: Photorealistic photograph ONLY. NO illustration, NO text, NO watermark. Must fill entire frame. The AGED GNARLED TREE TRUNKS and STONE WALLS are key visual elements distinguishing this from other sansuyu festivals.`
  },

  // Exhibition: 2위 리움미술관
  {
    filename: 'stillcut-march-seoul-exhibition-top5-leeum.jpeg',
    alt: '리움미술관 외관 한남동',
    caption: '한남동 리움 — 작품이 없는 전시? 여기서 뒤집어진다',
    style: 'cover_photo',
    aspectRatio: '16:9',
    category: 'still',
    postSlug: 'march-seoul-exhibition-top5',
    note: '2위 리움 AI 폴백',
    prompt: `A photorealistic editorial magazine photograph of the Leeum Museum of Art in Hannam-dong, Seoul, South Korea.

SUBJECT: The distinctive modern architecture of Leeum Museum — three buildings by world-famous architects (Mario Botta's terracotta cylinder, Jean Nouvel's black stainless steel, Rem Koolhaas's concrete and glass). Focus on the dramatic contrast between the buildings' different materials and forms. A few well-dressed visitors walking between the buildings. The Samsung Foundation logo subtly visible.

ATMOSPHERE: Dramatic late afternoon light. Strong directional sunlight creating deep shadows on the architectural surfaces. The terracotta of Botta's building glows warm, while Nouvel's black steel creates stark reflections. Urban Seoul hillside setting — glimpses of Hannam-dong neighborhood beyond. The feeling of entering a world-class art sanctuary in the middle of a city.

PHOTOGRAPHY STYLE: Architectural magazine editorial. Dramatic diagonal composition emphasizing the contrast between the three architectural styles. Hero framing — the buildings as imposing art objects. High contrast — deep blacks in the shadows, blown-out highlights where sun hits the glass. Strong geometrical lines. 24mm wide-angle lens, shot from a slightly low angle to make the architecture feel monumental. Bold, magazine-cover composition.

CRITICAL: Photorealistic photograph ONLY. NO illustration, NO text, NO watermark. Must fill entire frame. The THREE DISTINCT ARCHITECTURAL STYLES (terracotta, black steel, concrete/glass) must be visible and contrasting.`
  },

  // Exhibition: 4위 DDP
  {
    filename: 'stillcut-march-seoul-exhibition-top5-ddp.jpeg',
    alt: 'DDP 동대문디자인플라자 야경',
    caption: 'DDP 야경 — 자하 하디드의 우주선, 밤에 더 미쳤다',
    style: 'cover_photo',
    aspectRatio: '16:9',
    category: 'still',
    postSlug: 'march-seoul-exhibition-top5',
    note: '4위 DDP AI 폴백',
    prompt: `A photorealistic editorial magazine photograph of Dongdaemun Design Plaza (DDP) in Seoul at night.

SUBJECT: The iconic Zaha Hadid-designed DDP building at blue hour/night. Its flowing, organic silvery-white curves illuminated by dramatic LED lighting. The building's futuristic neo-futuristic form — no straight lines, all curves — reflecting city lights. A few people walking along the illuminated pathways around the building. The contrast between the ultra-modern DDP and the traditional Dongdaemun gate area visible in the background.

ATMOSPHERE: Blue hour transitioning to night. The sky is deep cobalt blue, the DDP's aluminum panels glow silver-white from embedded LED lighting. The surrounding area has warm city light tones — streetlamps, nearby buildings, car trails. A sense of futuristic calm against urban energy. Cool temperature overall with warm accents.

PHOTOGRAPHY STYLE: Dramatic architectural magazine editorial. Bold diagonal composition following the building's flowing curves. High contrast — the illuminated DDP against the dark sky. Strong blue-silver color palette with orange city light accents. Long exposure feel — silky smooth building surface, slight light trails from traffic. 16mm ultra-wide-angle lens to capture the sweeping curves. Shot from a low angle to maximize the building's dramatic presence. Magazine hero shot.

CRITICAL: Photorealistic photograph ONLY. NO illustration, NO text, NO watermark. Must fill entire frame. DDP's FLOWING CURVED ARCHITECTURE and NIGHT ILLUMINATION are the key visual elements. Must look like Zaha Hadid's design.`
  },

  // Exhibition: 5위 예술의전당
  {
    filename: 'stillcut-march-seoul-exhibition-top5-artscenter.jpeg',
    alt: '예술의전당 한가람미술관 전경',
    caption: '예술의전당 한가람미술관 — 77명 작가 380점, 이 안에 다 있다',
    style: 'cover_photo',
    aspectRatio: '16:9',
    category: 'still',
    postSlug: 'march-seoul-exhibition-top5',
    note: '5위 예술의전당 AI 폴백',
    prompt: `A photorealistic editorial magazine photograph of Seoul Arts Center (예술의전당) Hangaram Art Museum in Seocho-dong, Seoul.

SUBJECT: The distinctive traditional Korean-inspired roof architecture of Seoul Arts Center. The sweeping curved roofline echoing a traditional Korean hat (갓) shape, with modern glass and concrete below. Focus on the Hangaram Art Museum entrance area with exhibition banners visible. Spring cherry blossom trees or magnolia blooming near the building. A few art enthusiasts walking toward the entrance. The wide cultural plaza in front.

ATMOSPHERE: Bright spring afternoon. Clear blue sky above the dramatic roofline. Spring flowers (magnolia or early cherry blossoms) adding soft pink/white accents against the grey architecture. The open plaza creates a sense of cultural importance and accessibility. Mount Umyeon visible in the background. The feeling of approaching a major cultural destination.

PHOTOGRAPHY STYLE: Architectural editorial magazine shot. Dramatic composition emphasizing the sweeping traditional roofline against modern materials below. Bold perspective — shot from the plaza looking up slightly to capture the roofline's full drama. High contrast between the dark roof and bright spring sky. Strong structural lines. 24mm lens, symmetrical composition with the entrance as center point. Magazine-worthy framing that captures both Korean tradition and modern cultural institution.

CRITICAL: Photorealistic photograph ONLY. NO illustration, NO text, NO watermark. Must fill entire frame. The TRADITIONAL KOREAN HAT-SHAPED ROOFLINE (갓 모양) is the most distinctive architectural feature and must be clearly visible.`
  },
];

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  const specs = [
    ...(ONLY === 'all' || ONLY === 'illust' ? illustrations : []),
    ...(ONLY === 'all' || ONLY === 'still' ? stillcuts : []),
  ];

  console.log(`\n🎬 March TOP 5 AI Image Generation — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`📦 Images: ${specs.length}개 (${ONLY})`);
  console.log(`📁 Output: ${OUTPUT_DIR}\n`);

  if (DRY_RUN) {
    for (const spec of specs) {
      console.log(`\n── ${spec.filename} (${spec.category}) ──`);
      console.log(`   Alt: ${spec.alt}`);
      console.log(`   Style: ${spec.style} | Ratio: ${spec.aspectRatio}`);
      console.log(`   Prompt: ${spec.prompt.substring(0, 150)}...`);
    }
    return;
  }

  const client = new GeminiImageClient();
  if (!client.isConfigured() || !client.isEnabled()) {
    console.error('❌ GEMINI_API_KEY와 GEMINI_IMAGE_ENABLED=true 필요');
    process.exit(1);
  }

  const usage = await client.getDailyUsage();
  console.log(`📊 Gemini 이미지 쿼터: ${usage}/50 (${specs.length}장 생성 예정 → ${usage + specs.length}/50)`);

  if (usage + specs.length > 50) {
    console.error(`❌ 쿼터 초과 예상 (${usage + specs.length}/50). 내일 다시 시도하세요.`);
    process.exit(1);
  }

  let successCount = 0;
  let failCount = 0;

  for (const spec of specs) {
    // Skip if already exists
    if (existsSync(join(OUTPUT_DIR, spec.filename))) {
      console.log(`\n⏭️ ${spec.filename} already exists — skip`);
      successCount++;
      continue;
    }

    console.log(`\n🎬 [${spec.category}] ${spec.alt}...`);

    let image;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        image = await client.generateImage({
          prompt: spec.prompt,
          style: spec.style,
          aspectRatio: spec.aspectRatio,
          topic: spec.alt,
        });
        break;
      } catch (err) {
        console.log(`   ⚠️ 시도 ${attempt}/3 실패: ${(err as Error).message.slice(0, 100)}`);
        if (attempt < 3) {
          console.log(`   ⏳ ${5 * attempt}초 후 재시도...`);
          await new Promise(r => setTimeout(r, 5000 * attempt));
        } else {
          console.log(`   ❌ 최종 실패 — skip`);
          failCount++;
          image = null;
        }
      }
    }

    if (!image) continue;

    const outputPath = join(OUTPUT_DIR, spec.filename);
    const buffer = Buffer.from(image.base64Data, 'base64');
    await writeFile(outputPath, buffer);

    const sizeKB = Math.round(buffer.length / 1024);
    console.log(`   ✅ ${spec.filename} (${sizeKB}KB, ${image.mimeType})`);
    successCount++;

    // 요청 간 3초 대기 (이미지 생성은 heavy)
    await new Promise(r => setTimeout(r, 3000));
  }

  // ── Summary ──
  console.log('\n\n══════════════════════════════════════════════════════════');
  console.log(`  📋 GENERATION SUMMARY: ${successCount} success, ${failCount} fail`);
  console.log('══════════════════════════════════════════════════════════\n');

  console.log('📝 마크다운 삽입 코드:\n');
  for (const spec of specs) {
    console.log(`  <!-- ${spec.note} -->`);
    console.log(`  ![${spec.alt}](/travel-blog/images/${spec.filename})`);
    console.log(`  *${spec.caption}*\n`);
  }

  console.log('\n📝 image-registry.json 엔트리:\n');
  for (const spec of specs) {
    console.log(JSON.stringify({
      source: 'gemini-ai',
      filename: spec.filename,
      postSlug: spec.postSlug,
      personaId: 'viral',
      subject: spec.alt,
      usedAt: new Date().toISOString(),
      note: spec.note,
    }));
  }
}

main().catch(err => {
  console.error('오류:', err);
  process.exit(1);
});
