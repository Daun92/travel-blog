/**
 * 2/14 포스트 테마 매칭 AI 스틸컷 생성
 * - 야경 TOP 7: 4곳 야경 스틸컷 (조회영/viral)
 * - 벚꽃 개화시기: 5곳 벚꽃 스틸컷 (한교양/informative)
 *
 * Usage:
 *   npx tsx scripts/gen-feb14-themed-stillcuts.mts
 *   npx tsx scripts/gen-feb14-themed-stillcuts.mts --dry-run
 *   npx tsx scripts/gen-feb14-themed-stillcuts.mts --target night   # 야경만
 *   npx tsx scripts/gen-feb14-themed-stillcuts.mts --target cherry  # 벚꽃만
 */
import { config } from 'dotenv';
config();

import { writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { GeminiImageClient } from '../src/images/gemini-imagen.js';

const OUTPUT_DIR = 'blog/static/images';
const DRY_RUN = process.argv.includes('--dry-run');
const TARGET = process.argv.find(a => a.startsWith('--target'));
const TARGET_FILTER = TARGET ? process.argv[process.argv.indexOf(TARGET) + 1] : 'all';

interface StillcutSpec {
  filename: string;
  replaces: string;       // 교체 대상 KTO 파일명
  alt: string;
  caption: string;
  postSlug: string;
  personaId: string;
  group: 'night' | 'cherry';
  prompt: string;
}

// ── 야경 스틸컷 (조회영/viral) ────────────────────────────────────────
const nightSpecs: StillcutSpec[] = [
  {
    filename: 'stillcut-nightview-eungbongsan.jpeg',
    replaces: 'kto-nightview-eungbongsan.jpg',
    alt: '응봉산 정상에서 바라본 서울 야경 파노라마',
    caption: '응봉산 20분 등반의 보상 — 한강이 갈라지는 순간, 이건 반칙이야',
    postSlug: '2026-02-14-top-7',
    personaId: 'viral',
    group: 'night',
    prompt: `A breathtaking night cityscape photograph taken from the summit of a small mountain (94m elevation) in Seoul, South Korea, showing where the Han River splits into two branches.

SUBJECT: A sweeping 180-degree panoramic view of Seoul's nighttime skyline from an elevated hilltop vantage point. To the left, the brilliantly lit Lotte World Tower (555m, distinctive tapered silhouette) dominates the Jamsil skyline with its LED-lit crown. To the right, the dense cluster of Gangnam office towers creates a wall of warm golden windows. In the center, the wide Han River flows toward the viewer, its dark surface reflecting thousands of city lights like scattered diamonds. Multiple illuminated bridges span the river — their lights creating long colorful reflections. In the immediate foreground, a simple wooden bench and railing mark the mountain summit viewing platform, with a few silhouetted visitors. The city extends to the horizon in every direction, a sea of lights with occasional dark patches of mountain parks.

ATMOSPHERE: Clear winter night with excellent visibility — the cold air sharpens every light point to a crisp twinkle. Deep navy blue sky with no clouds, transitioning to a warm amber glow near the horizon from light pollution. The scene radiates quiet grandeur — the contrast between the intimate hilltop silence and the vast living city below. Temperature feels cold — you can almost see your breath.

PHOTOGRAPHY STYLE: Editorial magazine photography — dramatic diagonal composition with the river creating a strong leading line from center-bottom to upper-left. High contrast between the black river surface and the brilliant city lights. Saturated warm tones in the building lights against cool blue sky. Shot with a wide-angle lens to capture the full panoramic sweep. Deep blacks in shadow areas with pinpoint light sources creating star-like diffraction. Bold, hero-shot framing that makes you want to grab your phone and share immediately.

CRITICAL: Photorealistic night photograph only. NO illustration, NO 3D render, NO daytime scene. The split of the Han River must be clearly visible. Korean cityscape must be unmistakable. Must fill entire frame edge-to-edge.`,
  },
  {
    filename: 'stillcut-nightview-sebitseum.jpeg',
    replaces: 'kto-nightview-sebitseum.jpg',
    alt: '반포대교 세빛섬 야경 — 한강 위에 떠있는 세 개의 빛나는 섬',
    caption: '물 위에 뜬 세 개의 별 — 반포한강공원 잔디밭에서 본 이 뷰가 무료라고?',
    postSlug: '2026-02-14-top-7',
    personaId: 'viral',
    group: 'night',
    prompt: `A stunning night photograph of three futuristic floating island structures on the Han River in Seoul, South Korea, each glowing with different colored LED lighting.

SUBJECT: Three modern architectural pavilions sitting directly on the Han River surface, connected by walkways. Each structure has a distinctive flowing, organic form with curved glass facades. The leftmost glows deep blue-purple, the center one radiates warm amber-gold, and the rightmost shines in vivid magenta-pink. Their brilliant colors reflect perfectly in the calm, dark river water below, creating mirror-like double images. Behind them, the Banpo Bridge stretches across the river with its own string of lights. The distant Seoul skyline provides a backdrop of twinkling city lights. In the foreground, the grassy riverside park with a few couples sitting on the lawn, watching the illuminated islands. A gentle mist rises from the warm river surface, adding a dreamlike haze around the structures.

ATMOSPHERE: Romantic, dreamlike winter evening. The stillness of the river creates perfect reflections that double every light. The colored glow from the three islands creates pools of tinted light on the surrounding water — blue, gold, and pink mixing where they overlap. A sense of floating, ethereal beauty — these structures seem to exist outside of normal reality, like something from a science fiction film set on Earth.

PHOTOGRAPHY STYLE: Editorial magazine photography — center-weighted composition with the three floating islands arranged in a gentle arc across the middle third. High contrast between the dark river and the brilliant LED-lit structures. Saturated, vivid colors with deep blacks in the water. Shot from the riverside park at eye level, with the grass foreground providing depth. Long exposure feel with smooth water reflections. Bold framing that demands attention — this is the kind of shot that stops a social media scroll.

CRITICAL: Photorealistic night photograph only. NO illustration, NO daytime. Three distinct structures with THREE DIFFERENT colors of LED illumination. River reflections must be prominent. Must fill entire frame edge-to-edge.`,
  },
  {
    filename: 'stillcut-nightview-naksan.jpeg',
    replaces: 'kto-nightview-naksan.jpg',
    alt: '낙산공원 성곽길 야경 — 조선 시대 돌담 너머로 빛나는 동대문 네온사인',
    caption: '600년 성곽 위에서 본 21세기 — 이 대비감, 서울에서만 가능',
    postSlug: '2026-02-14-top-7',
    personaId: 'viral',
    group: 'night',
    prompt: `A dramatic night photograph from atop an ancient Joseon dynasty stone fortress wall overlooking the modern neon-lit cityscape of Dongdaemun district in Seoul, South Korea.

SUBJECT: In the immediate foreground, a weathered stone fortress wall made of irregular grey granite blocks runs diagonally from lower-left to upper-right — the wall is about 2 meters tall with a flat stone walkway on top. Traditional Korean stone lanterns line the pathway at intervals, casting warm amber pools of light on the ancient stones. Beyond the wall, the dramatic drop reveals the bustling Dongdaemun district below — the futuristic curves of DDP (Dongdaemun Design Plaza) glowing white-blue, surrounded by the dense grid of the fashion district with neon signs in Korean (핫딜, 원단, 패션) blazing in red, blue, and green. The contrast is stark — 600-year-old dark stone in the foreground versus a sea of modern LED and neon in the background. A couple walks along the fortress wall path, silhouetted against the city glow.

ATMOSPHERE: Cold winter night with crystal-clear air. The ancient stone radiates cold silence while the city below pulses with electric energy. This is Seoul's defining paradox — centuries of history and cutting-edge modernity existing in the same frame. The stone fortress wall feels permanent, timeless, while the neon signs below flicker and change. Wind rustles bare tree branches that frame the view on both sides.

PHOTOGRAPHY STYLE: Editorial magazine photography — diagonal composition following the fortress wall from foreground to mid-ground, with the modern city filling the background. Extreme contrast between the dark, textured stone (cool blue-grey tones) and the vivid neon city (warm saturated colors). Bold perspective with strong leading lines along the wall. Deep blacks in the shadow areas of the fortress with explosion of light beyond. Shot from slightly above eye level, looking along the wall and down at the city. Hero framing — this is the kind of contrast shot that defines Seoul.

CRITICAL: Photorealistic night photograph only. NO illustration, NO daytime. The ancient stone wall and modern neon city must both be clearly visible in the same frame. Korean neon signs must be visible. Must fill entire frame edge-to-edge.`,
  },
  {
    filename: 'stillcut-nightview-nodeul.jpeg',
    replaces: 'kto-nightview-nodeul.jpg',
    alt: '노들섬에서 본 양방향 서울 스카이라인 야경',
    caption: '한강 한복판에서 양쪽 다 보이는 건 여기뿐 — 맥주 한 캔이면 완벽',
    postSlug: '2026-02-14-top-7',
    personaId: 'viral',
    group: 'night',
    prompt: `A cinematic night photograph taken from a cultural island in the middle of the Han River in Seoul, showing city skylines on both sides simultaneously.

SUBJECT: Standing on a modern wooden deck platform on an island in the center of the Han River. To the left, the Yongsan/Itaewon skyline with Namsan Tower's distinctive needle silhouette lit in white-blue at the top of the mountain, surrounded by residential hillside lights. To the right, the Yeouido financial district skyline with the 63 Building's distinctive golden-windowed tower and several modern office towers. The wide Han River stretches in both directions, its surface catching reflections from both skylines. The island itself has modern landscaping with ambient lighting — warm-toned LED strips along pathways, a few architectural steel structures with integrated lighting. Two people sit on a bench facing the river, one holding a beer can, enjoying the dual skyline view. The sky is deep indigo with a thin crescent moon.

ATMOSPHERE: Peaceful winter night on the river — the island creates a calm oasis between two vibrant city banks. The water acts as a mirror, doubling every light. The dual-skyline view creates a unique sensation of being surrounded by city while standing in nature. Cool river breeze, the distant hum of traffic on the bridges, but here on the island it's quiet enough to hear the water lapping.

PHOTOGRAPHY STYLE: Editorial magazine photography — wide-angle symmetrical composition with the viewer at center, city skylines balanced on left and right. The river creates horizontal bands of reflection. High contrast between the dark water and brilliant city lights. Warm amber from the island lighting in the foreground contrasts with the cool blue-white of the distant skylines. Hero framing — panoramic feel that emphasizes the unique dual-view advantage. Bold, attention-grabbing composition.

CRITICAL: Photorealistic night photograph only. NO illustration, NO daytime. BOTH city skylines (Yongsan/Namsan on one side, Yeouido/63 Building on the other) must be clearly visible. Must fill entire frame edge-to-edge.`,
  },
];

// ── 벚꽃 스틸컷 (한교양/informative) ──────────────────────────────────
const cherrySpecs: StillcutSpec[] = [
  {
    filename: 'stillcut-cherry-bomun.jpeg',
    replaces: 'kto-cherry-bomun.jpg',
    alt: '경주 보문단지 벚꽃길 — 보문호를 감싸는 8km 벚꽃 터널',
    caption: '보문호 수면에 비친 벚꽃 — 자전거로 8km를 달리는 것이 이 풍경을 만나는 최적의 방법입니다',
    postSlug: '2026-02-14-2026',
    personaId: 'informative',
    group: 'cherry',
    prompt: `An architectural landscape photograph of a scenic lakeside cycling path lined with cherry blossom trees in full bloom, in Gyeongju, South Korea.

SUBJECT: A paved cycling path curves gently along the shore of a large artificial lake (Bomun Lake). On both sides of the path, mature Yoshino cherry trees (Prunus × yedoensis) form a continuous canopy overhead — their branches heavy with clusters of pale pink-white blossoms creating a tunnel effect. A cyclist in casual clothing pedals through the tunnel, about 20 meters ahead. The lake is visible through gaps in the trees on the left side, its calm surface reflecting the pink cherry blossoms and blue sky. Fallen petals scatter across the path surface like pink snow. In the distance, a traditional Korean-style pavilion sits on a small peninsula jutting into the lake. The path extends into the distance, disappearing into more cherry trees.

ATMOSPHERE: Spring morning with soft, diffused sunlight filtering through the blossom canopy, creating dappled light patterns on the path. The air feels fresh and slightly cool — early April in southern Korea. Pink petals drift slowly downward in a gentle breeze. The scene communicates serenity and the quiet joy of experiencing nature at its peak — this is not a crowded tourist moment but a peaceful early-morning ride.

PHOTOGRAPHY STYLE: Architectural landscape photography — balanced, symmetrical composition with the path creating a strong central leading line. Even lighting with attention to the delicate texture of individual cherry blossoms. Rule of thirds with the cyclist at the intersection point. Balanced exposure preserving both the bright white blossoms and the cool shadows beneath the canopy. Cool shadows, neutral mid-tones. Geometric framing using the natural arch of the cherry tree canopy.

CRITICAL: Photorealistic photograph only. Cherry blossoms must be in FULL BLOOM (만개) — dense clusters of pale pink-white flowers. NO autumn leaves, NO bare branches, NO summer green. Korean spring atmosphere must be unmistakable. Must fill entire frame edge-to-edge.`,
  },
  {
    filename: 'stillcut-cherry-bulguksa.jpeg',
    replaces: 'kto-cherry-bulguksa.jpg',
    alt: '불국사 진입로 벚꽃 터널 — 신라 천년의 사찰로 향하는 분홍빛 길',
    caption: '1.2km 벚꽃 터널의 끝에서 신라 1,400년의 사찰이 기다립니다 — 이 구도가 경주만의 특별함입니다',
    postSlug: '2026-02-14-2026',
    personaId: 'informative',
    group: 'cherry',
    prompt: `An architectural photograph of the entrance road to a historic Korean Buddhist temple, lined with cherry blossom trees in full bloom, in Gyeongju, South Korea.

SUBJECT: A 1.2km paved road climbing gently uphill toward an ancient Buddhist temple complex. On both sides, tall mature cherry trees in full bloom create a continuous pink-white canopy overhead. Through the blossoming branches at the far end, the traditional Korean temple gate (일주문) is partially visible — its dark wooden pillars and curved tile roof providing a focal point. Several visitors walk along the road, some taking photos. The road is clean asphalt with stone curbs. On the ground, a carpet of fallen pink petals covers the shoulders. Between the trees on the right side, a traditional stone lantern (석등) stands among low flowering shrubs. The temple architecture visible through the blossoms uses traditional dancheong (단청) coloring — red, green, and blue geometric patterns.

ATMOSPHERE: Mid-morning spring light — bright but diffused by thin clouds, creating soft shadows. The juxtaposition of the ancient temple architecture and the ephemeral cherry blossoms creates a contemplative mood — the impermanence of the blossoms against the permanence of 1,400 years of Buddhist practice. A sense of pilgrimage — walking this road feels like transitioning from the modern world into historical Silla dynasty.

PHOTOGRAPHY STYLE: Architectural photography — centered composition with the road creating a strong vanishing point perspective toward the temple gate. Balanced exposure with attention to architectural and botanical detail. Symmetrical framing with the cherry tree canopy creating a natural frame. Cool shadows, neutral mid-tones. The temple gate at the end serves as the anchoring focal point, seen through a veil of cherry blossoms.

CRITICAL: Photorealistic photograph only. Cherry blossoms must be in FULL BLOOM — dense pink-white clusters. The Korean Buddhist temple architecture must be clearly visible at the end of the road. NO autumn foliage. Must fill entire frame edge-to-edge.`,
  },
  {
    filename: 'stillcut-cherry-daereungwon.jpeg',
    replaces: 'kto-cherry-daereungwon.jpg',
    alt: '경주 대릉원 고분과 벚꽃 — 신라 왕릉의 녹색 능선과 분홍 벚꽃의 조합',
    caption: '1,500년 된 왕릉 위로 벚꽃이 흩날립니다 — 시간을 거슬러 올라간 듯한 이 풍경이 경주의 본질입니다',
    postSlug: '2026-02-14-2026',
    personaId: 'informative',
    group: 'cherry',
    prompt: `An architectural landscape photograph of ancient Silla dynasty royal tombs (tumuli) surrounded by cherry blossom trees in full bloom, in Gyeongju, South Korea.

SUBJECT: Several large, perfectly rounded grass-covered burial mounds (고분, tumuli) rising 10-20 meters above ground level, their smooth green slopes creating gentle dome shapes against the sky. Cherry blossom trees planted around the base of the mounds are in full bloom, their pink-white branches arching over walking paths and reaching toward the green mound surfaces. The largest tumulus dominates the center of the frame, its perfect dome shape a striking geometric form. A paved walking path curves between the mounds, with a few visitors strolling. Fallen cherry petals create pink patches on the green grass slopes. A traditional wooden fence (한옥 울타리) lines portions of the path. In the background, more tumuli are visible among cherry trees, extending into the distance. The grass on the mounds is vivid spring green.

ATMOSPHERE: Soft spring morning light with the sun slightly behind thin clouds. The scene evokes a powerful sense of time — these 1,500-year-old tombs beneath cherry trees that bloom and fade each year. The rounded tumuli shapes create a surreal, almost dreamlike landscape — as if giant green hemispheres were placed in a cherry blossom garden. Quiet, contemplative, slightly otherworldly — the kind of place where past and present feel simultaneous.

PHOTOGRAPHY STYLE: Architectural photography — balanced composition with the main tumulus placed slightly off-center using the golden ratio. The cherry blossoms frame the mound from the left side of the frame. Balanced exposure with equal attention to the green grass texture and delicate blossom detail. Symmetrical elements in the mound shapes balanced by asymmetric cherry tree placement. Cool shadows on the north-facing mound surfaces, warm light catching the blossoms. Geometric interplay between the circular mounds and organic tree forms.

CRITICAL: Photorealistic photograph only. Cherry blossoms MUST be in full bloom. The grass-covered tumuli must have their distinctive rounded dome shape. Spring green grass, NOT autumn brown. Korean landscape must be unmistakable. Must fill entire frame edge-to-edge.`,
  },
  {
    filename: 'stillcut-cherry-seokchon.jpeg',
    replaces: 'kto-cherry-seokchon.jpg',
    alt: '석촌호수 벚꽃과 롯데타워 — 도시적 벚꽃 풍경의 정수',
    caption: '호수 둘레 1,000그루의 벚꽃과 555m 타워의 조합 — 도심 속 벚꽃의 가장 현대적인 풍경입니다',
    postSlug: '2026-02-14-2026',
    personaId: 'informative',
    group: 'cherry',
    prompt: `An architectural photograph of a cherry blossom-lined urban lake with a massive modern skyscraper rising behind it, in Seoul, South Korea.

SUBJECT: A calm urban lake (about 500m across) surrounded by a walking path lined with mature cherry blossom trees in full bloom. The trees' branches extend over the water's edge, their pink-white blossoms reflected in the still lake surface. Rising dramatically behind the far shore, a 555-meter supertall skyscraper with a distinctive tapered form dominates the skyline — its glass facade reflecting the blue sky and pink cherry blossoms below. The walking path is crowded with spring visitors — families, couples, people taking photos with the tower-and-blossom combination. A few swan-shaped pedal boats float on the lake. Cherry petals dot the water surface. Modern commercial buildings and apartment towers frame the scene on the sides, but the tower-and-blossom combination commands attention.

ATMOSPHERE: Bright spring afternoon with clear blue sky. The urban setting creates a distinctly modern cherry blossom experience — this is not a rural scene but a thoroughly metropolitan one. The massive skyscraper provides dramatic scale contrast with the delicate blossoms. The lake acts as a mirror, doubling both the pink cherry lines and the tower reflection. Spring energy — people enjoying the first warm days, the annual ritual of walking under the blossoms.

PHOTOGRAPHY STYLE: Architectural photography — the supertall tower anchors the upper center of the frame while cherry blossoms fill the lower two-thirds, creating a powerful vertical composition. The lake creates a horizontal dividing line with reflection symmetry. Balanced exposure capturing both the bright sky and the detailed blossoms. Clean, precise framing typical of architectural photography. Neutral color balance with the natural pink of blossoms and blue of sky providing the color palette.

CRITICAL: Photorealistic photograph only. Cherry blossoms MUST be in full bloom. The 555m tapered skyscraper must be clearly prominent. Urban Korean spring atmosphere. NO autumn colors. Must fill entire frame edge-to-edge.`,
  },
  {
    filename: 'stillcut-cherry-yeouido.jpeg',
    replaces: 'kto-cherry-yeouido.jpg',
    alt: '여의도 윤중로 벚꽃길 — 1,886그루 왕벚나무가 만든 1.7km 분홍빛 터널',
    caption: '대한민국에서 가장 유명한 벚꽃길 — 1,886그루의 왕벚나무가 1.7km에 걸쳐 만개한 풍경입니다',
    postSlug: '2026-02-14-2026',
    personaId: 'informative',
    group: 'cherry',
    prompt: `An architectural photograph of South Korea's most famous urban cherry blossom road — a wide boulevard completely canopied by mature cherry trees in full bloom, on Yeouido island in Seoul.

SUBJECT: A wide multi-lane boulevard (temporarily closed to traffic, pedestrian-only during festival) lined on both sides with enormous mature Yoshino cherry trees (왕벚나무). The trees are so large and closely planted that their branches interlock overhead, forming a complete pink-white tunnel stretching into the far distance. Thousands of visitors walk beneath the canopy — the road is busy but not oppressively crowded in this section. Fallen petals cover the road surface in a pink blanket. On the sides, cherry blossom festival banners and small vendor stalls are visible. Through the blossoms on the left, glimpses of the Han River and distant apartments are visible. The blossom density is extraordinary — every branch is loaded with dense flower clusters, and the overall effect is a ceiling of pink.

ATMOSPHERE: Warm spring afternoon with golden sunlight filtering through the blossom canopy, creating dramatic light-and-shadow patterns on the road and visitors below. A gentle breeze sends petals spinning through the air — 꽃비 (flower rain). The atmosphere is festive but also meditative — even in a crowd, looking up into the pink canopy creates a moment of wonder. This is Seoul's annual spring ritual at its peak.

PHOTOGRAPHY STYLE: Architectural photography — strong central vanishing point perspective down the boulevard, with the cherry tunnel creating a natural frame converging in the distance. Balanced exposure with the bright blossom canopy and shadowed road surface. Symmetrical composition with the tree lines creating parallel walls of pink. Attention to the individual blossom clusters while maintaining the overwhelming scale of the entire 1.7km vista. Neutral color balance letting the natural pink-white of the blossoms and the green of occasional leaves speak for themselves.

CRITICAL: Photorealistic photograph only. Cherry blossoms MUST be in absolute FULL BLOOM (만개) — the canopy must be almost solid pink-white. This is the most famous cherry blossom road in Korea — the scale and density of blossoms must be impressive. NO bare branches, NO autumn. Must fill entire frame edge-to-edge.`,
  },
];

const ALL_SPECS = [...nightSpecs, ...cherrySpecs];

async function main() {
  const specs = TARGET_FILTER === 'night' ? nightSpecs
    : TARGET_FILTER === 'cherry' ? cherrySpecs
    : ALL_SPECS;

  console.log(`\n🎬 테마 매칭 AI 스틸컷 생성 (${DRY_RUN ? 'DRY RUN' : 'LIVE'})`);
  console.log(`📦 대상: ${specs.length}장 (${TARGET_FILTER})`);
  console.log(`📁 Output: ${OUTPUT_DIR}\n`);

  if (DRY_RUN) {
    for (const s of specs) {
      console.log(`  ${s.group === 'night' ? '🌙' : '🌸'} ${s.filename} → replaces ${s.replaces}`);
      console.log(`     ${s.alt}\n`);
    }
    console.log('\n📝 마크다운 교체 매핑:');
    for (const s of specs) {
      console.log(`  ${s.replaces} → ${s.filename}`);
    }
    return;
  }

  const client = new GeminiImageClient();
  if (!client.isConfigured() || !client.isEnabled()) {
    console.error('❌ GEMINI_API_KEY와 GEMINI_IMAGE_ENABLED=true 필요');
    process.exit(1);
  }

  const usage = await client.getDailyUsage();
  console.log(`📊 Gemini 이미지 쿼터: ${usage}/50 (${specs.length}장 생성 예정)\n`);

  if (usage + specs.length > 50) {
    console.error(`❌ 쿼터 부족: ${usage}/${50} 사용, ${specs.length}장 필요`);
    process.exit(1);
  }

  const results: { spec: StillcutSpec; success: boolean }[] = [];

  for (const spec of specs) {
    const icon = spec.group === 'night' ? '🌙' : '🌸';
    console.log(`\n${icon} 생성 중: ${spec.alt}...`);

    // 이미 존재하면 스킵
    if (existsSync(join(OUTPUT_DIR, spec.filename))) {
      console.log(`  ⏭️ 이미 존재 — 건너뜀`);
      results.push({ spec, success: true });
      continue;
    }

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
        console.log(`  ⚠️ 시도 ${attempt}/3 실패: ${(err as Error).message.slice(0, 80)}`);
        if (attempt < 3) {
          console.log(`  ⏳ ${5 * attempt}초 후 재시도...`);
          await new Promise(r => setTimeout(r, 5000 * attempt));
        }
      }
    }

    if (!image) {
      console.log(`  ❌ 최종 실패`);
      results.push({ spec, success: false });
      continue;
    }

    const outputPath = join(OUTPUT_DIR, spec.filename);
    const buffer = Buffer.from(image.base64Data, 'base64');
    await writeFile(outputPath, buffer);
    const sizeKB = Math.round(buffer.length / 1024);
    console.log(`  ✅ ${spec.filename} (${sizeKB}KB)`);
    results.push({ spec, success: true });

    // Rate limit
    await new Promise(r => setTimeout(r, 3000));
  }

  // ── Summary ─────────────────────────────────────────────────────────
  console.log('\n\n📋 결과 요약:');
  console.log('─'.repeat(80));

  const ok = results.filter(r => r.success).length;
  console.log(`\n  🎯 ${ok}/${results.length} 성공\n`);

  for (const r of results) {
    const icon = r.success ? '✅' : '❌';
    const group = r.spec.group === 'night' ? '🌙' : '🌸';
    console.log(`  ${icon} ${group} ${r.spec.filename} (replaces ${r.spec.replaces})`);
  }

  // 성공한 항목의 마크다운 교체 매핑 출력
  const successes = results.filter(r => r.success);
  if (successes.length > 0) {
    console.log('\n\n📝 포스트 내 이미지 경로 교체 필요:');
    for (const r of successes) {
      console.log(`  ${r.spec.replaces} → ${r.spec.filename}`);
      console.log(`  alt: ${r.spec.alt}`);
      console.log(`  caption: *${r.spec.caption}*\n`);
    }
  }
}

main().catch(err => {
  console.error('오류:', err);
  process.exit(1);
});
