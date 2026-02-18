/**
 * KTO 검색 실패 시 AI 스틸컷 폴백 생성
 * 워크플로우 Step 3b: 수집된 정보 기반 포토리얼리스틱 이미지 생성
 *
 * Usage:
 *   npx tsx scripts/gen-kto-fallback-stillcut.mts
 *   npx tsx scripts/gen-kto-fallback-stillcut.mts --slug 2026-02-05-2026-best-5
 */
import { config } from 'dotenv';
config();

import { writeFile } from 'fs/promises';
import { join } from 'path';
import { GeminiImageClient } from '../src/images/gemini-imagen.js';

const OUTPUT_DIR = 'blog/static/images';
const SLUG_FILTER = process.argv.find(a => a.startsWith('--slug'));
const FILTER_SLUG = SLUG_FILTER ? process.argv[process.argv.indexOf(SLUG_FILTER) + 1] : '';

interface FallbackSpec {
  filename: string;
  alt: string;
  caption: string;
  postSlug: string;
  personaId: string;
  prompt: string;
}

const specs: FallbackSpec[] = [
  // ── 리움미술관 (informative/한교양) ────────────────────────────────
  {
    filename: 'stillcut-leeum-museum.jpeg',
    alt: '리움미술관 건축 외관 — 마리오 보타의 테라코타 M1과 렘 쿨하스의 블랙박스',
    caption: '세 거장의 건축이 한자리에 — 테라코타 벽돌의 M1이 오후 빛을 받아 붉게 물드는 순간',
    postSlug: '2026-02-05-post',
    personaId: 'informative',
    prompt: `An architectural photograph of a contemporary museum complex in Seoul's Hannam-dong hillside, featuring three distinct buildings by three world-renowned architects standing side by side.

SUBJECT: The primary focus is a striking building clad entirely in hand-fired terracotta bricks in warm reddish-brown tones, with an inverted truncated cone form that widens as it rises — thousands of precisely laid rectangular bricks creating a rich, textured surface. To its right, a sharply contrasting building of darkly patinated stainless steel panels and tinted glass — angular, sleek, and industrial. Between them, a massive black concrete box structure appears to hover just above ground level, its cantilevered mass creating visual tension against gravity. A landscaped courtyard with mature deciduous trees (bare winter branches) connects the three structures. Clean geometric stone pathways lead between the buildings. A few visitors in winter coats walk between the structures, dwarfed by the architectural scale. Small Korean directional signage is visible near the entrance.

ATMOSPHERE: Late afternoon winter light — the low-angle sun catches the terracotta bricks, turning them from earthen brown to a deep, warm amber-red glow. Cool blue-grey shadows fall across the stainless steel building, emphasizing the dramatic material contrast. The pale winter sky transitions from steel blue overhead to warm golden near the horizon line. The scene is quiet and contemplative — the hushed reverence of a cultural institution. Bare tree silhouettes add delicate linear patterns against the geometric architecture.

PHOTOGRAPHY STYLE: Architectural photography — even, balanced lighting with meticulous attention to structural detail. Symmetrical composition anchored on the terracotta cone building at center, with the steel and black box buildings framing left and right in balanced proportion. Rule of thirds placement with the horizon at the lower third. Balanced exposure preserving both the warm brick highlights and cool steel shadows. Neutral mid-tones with clean whites. Shot from a slightly elevated vantage point to capture the spatial relationship and scale contrast between all three structures. Medium telephoto compression to emphasize the buildings' proximity and material dialogue.

CRITICAL: Photorealistic photograph only. NO illustration, NO 3D render, NO digital art, NO text, NO watermark. Must clearly show the material contrast between terracotta brick, dark patinated steel, and black concrete. Korean winter atmosphere must be unmistakable. Must fill entire frame edge-to-edge.`
  },

  // ── 뮤지컬 가이드 (friendly/김주말) — 저작권 안전: 공연장 공간만 촬영 ─
  {
    filename: 'stillcut-musical-opera-hall.jpeg',
    alt: '예술의전당 오페라극장 객석 — 공연 시작 전 붉은 좌석과 샹들리에',
    caption: '18만 원 내고 앉은 자리 — 좌석 간격은 좁지만 샹들리에 올려다보면 용서가 돼요',
    postSlug: '2026-02-05-2026-best-5',
    personaId: 'friendly',
    prompt: `A lifestyle photograph of a grand opera house interior before the show starts. No performers on stage.

SUBJECT: Rows of deep red velvet seats stretching toward a large proscenium stage with its heavy velvet curtain drawn closed. A massive crystal chandelier hangs from the ornate ceiling, glittering with hundreds of warm lights. The seats are narrow with tight legroom — a coat draped over one armrest and a playbill program resting on a seat. The theater is about half-full, with audience members settling in. The architecture features gilded balcony tiers rising three levels on both sides.

ATMOSPHERE: The warm anticipation of a show about to begin. Golden incandescent glow from the chandelier contrasts with the deep burgundy of the seats and curtain. A soft murmur of conversation fills the hall. The sense of occasion — dressed-up couples, the rustle of programs being opened.

PHOTOGRAPHY STYLE: Lifestyle photography — warm golden-hour tone, soft bokeh on the background seats. Eye-level perspective from a center seat about 10 rows back, looking toward the stage. Warm color grading with golden highlights and soft shadows. Slight vignetting at edges. The chandelier should be slightly overexposed, creating a dreamy glow.

CRITICAL: Photorealistic photograph only. NO performers, NO specific show branding, NO text, NO illustration, NO watermark. The stage curtain must be CLOSED — no performance visible. Must fill entire frame edge-to-edge.`
  },
  {
    filename: 'stillcut-musical-bluesquare.jpeg',
    alt: '블루스퀘어 한강진 입구 — 퇴근 후 공연장으로 향하는 저녁 풍경',
    caption: '퇴근하고 바로 달려왔는데 주차장은 이미 만차 — 한강진역에서 걸어오길 잘했어요',
    postSlug: '2026-02-05-2026-best-5',
    personaId: 'friendly',
    prompt: `A lifestyle photograph of the entrance area of a modern performing arts complex in Seoul at dusk. No specific show branding visible.

SUBJECT: A sleek, contemporary building facade with large glass panels glowing warm from interior lighting. A line of about 15-20 people queuing at the entrance — mostly office workers in business casual, some still carrying laptop bags and takeaway coffee cups. LED strips outline the building's clean architectural lines. A narrow underground parking garage entrance ramp is visible to one side with a "만차" (FULL) sign. Bare winter trees line the sidewalk. Street-level Korean signage for nearby cafes.

ATMOSPHERE: The blue hour transition — deep indigo sky with the last traces of sunset orange at the horizon. The building's interior warmth spills through glass walls, creating inviting pools of golden light on the sidewalk. The energy of office workers who rushed here straight from work — checking their phones for e-tickets, adjusting scarves.

PHOTOGRAPHY STYLE: Lifestyle photography — street-level eye perspective, warm bokeh from the building lights. Warm color temperature overall with cool blue sky contrast. Soft vignetting. Center-weighted composition with the queue of people leading the eye toward the glowing entrance. Shallow depth of field with the nearest people in focus, the building slightly soft.

CRITICAL: Photorealistic photograph only. NO specific musical/show titles or logos, NO illustration, NO text overlay, NO watermark. Building should look modern and premium but NOT be identifiable as a specific real venue. Must fill entire frame edge-to-edge.`
  },

  // ── 인디 공연장 (viral/조회영) — 저작권 안전: 공연장 외관+내부 공간만 ─
  {
    filename: 'stillcut-indie-rollinghall.jpeg',
    alt: '홍대 롤링홀 골목 — 30년 역사의 인디 성지로 향하는 지하 계단',
    caption: '1995년부터 인디 씬을 지켜온 이 계단 — 내려가는 순간 시간이 멈춤',
    postSlug: '2026-02-08-indie-venue',
    personaId: 'viral',
    prompt: `An editorial magazine photograph of a legendary underground live music venue entrance in Seoul's Hongdae district at night. No performers visible.

SUBJECT: A narrow concrete staircase descending into a basement venue. The walls flanking the stairs are completely covered — layer upon layer of band posters, flyers, and stickers accumulated over 30 years, some peeling, some fresh. A single bare bulb hangs above the stairwell entrance, casting dramatic shadows down the steps. At the bottom, a heavy black door is partially open, revealing a sliver of red stage lighting inside. A small hand-painted sign with Korean text marks the venue name. The concrete steps are worn smooth by decades of foot traffic.

ATMOSPHERE: Late-night Hongdae energy. The warm yellow of the bare bulb contrasts sharply with the cold blue of the narrow alley behind. Faint bass vibrations seem to emanate from below. The accumulated history visible in the poster layers — some dating back to the 2000s, faded and partially torn, with newer neon-colored flyers pasted on top.

PHOTOGRAPHY STYLE: Editorial magazine photography — dramatic shadows, strong contrast. Diagonal composition following the staircase descent. High contrast, deep blacks in the stairwell, saturated colors on the posters. Shot from above, looking down the stairs at a steep angle — hero framing of the descent into the underground. Bold perspective with strong leading lines.

CRITICAL: Photorealistic photograph only. NO real band names on posters (use blurred/illegible Korean text), NO illustration, NO text overlay, NO watermark. Must fill entire frame edge-to-edge.`
  },
  {
    filename: 'stillcut-indie-livehouse.jpeg',
    alt: '홍대 라이브 클럽 스탠딩 공연 — 400명 관객 머리 위로 쏟아지는 무대 조명',
    caption: '스탠딩 400명 — 이 열기를 모르면 인디를 모르는 거임',
    postSlug: '2026-02-08-indie-venue',
    personaId: 'viral',
    prompt: `An editorial magazine photograph of an indie live music venue interior during a concert, shot from the back of the venue. Focus on the space and crowd atmosphere, NOT on specific performers.

SUBJECT: A packed standing-room concert venue seen from behind the crowd. About 300-400 people standing shoulder to shoulder, many with raised hands and phones. The stage is at the far end — dramatic beams of red, blue, and white stage lighting cut through a haze of stage fog, but the performers are silhouetted and unidentifiable, just dark shapes behind instruments. The venue ceiling is low with exposed pipes and black-painted industrial infrastructure. PA speakers are mounted on either side of the stage. The crowd nearest the camera is in shadow, creating a sea of silhouettes against the bright stage.

ATMOSPHERE: Electric intensity of a sold-out indie show. The haze from the fog machine catches every light beam, creating visible shafts of colored light. The warmth of bodies packed together. Bass vibrations you can feel. The contrast between the dark crowd and the explosively bright stage creates a cathedral-like drama.

PHOTOGRAPHY STYLE: Editorial magazine photography — extreme contrast, dramatic lighting. Wide-angle shot from the back of the venue, capturing the full scale of the crowd and stage. High contrast with deep blacks (crowd silhouettes) and saturated stage lighting colors. Diagonal light beams create dynamic composition. Bold, aggressive framing — the kind of shot that makes you want to BE there.

CRITICAL: Photorealistic photograph only. Performers must be SILHOUETTES ONLY — no identifiable faces or specific band imagery. NO illustration, NO text, NO watermark. Must fill entire frame edge-to-edge.`
  },

  // ── 대흥동 인디씬 디깅 (niche/오덕우) ─────────────────────────────
  {
    filename: 'stillcut-daeheung-signage.jpeg',
    alt: '대흥동 골목 손글씨 간판 — 80년대 인쇄소 간판의 퇴색된 서체와 겹겹이 쌓인 시간',
    caption: '이 서체를 보려고 세 번째 왔다 — 80년대 인쇄소 간판의 획 하나에 담긴 시간',
    postSlug: '2026-02-13-12-1',
    personaId: 'niche',
    prompt: `An indie street photograph of weathered Korean hand-painted signage in a narrow back alley of an old urban neighborhood in a mid-sized Korean city.

SUBJECT: A tight close-up of a hand-painted shop sign on a crumbling concrete wall. The Korean characters are written in a distinctive brush-style script from the 1980s-90s era — slightly uneven strokes, faded mint green and coral pink paint partially peeling away to reveal older layers of paint beneath in different pastel shades. To the left, fragments of torn concert posters and circular sticker residue overlap on the wall. A thin rusty pipe runs vertically along the wall edge. The sign advertises something mundane — a printing shop or tailor. A small fluorescent tube light is mounted above the sign, turned off in daytime. The concrete texture shows decades of repainting. A sliver of the narrow alley is visible at the edge — worn asphalt, a parked bicycle wheel.

ATMOSPHERE: Late afternoon winter light filtering into the narrow alley at a low angle, creating a warm amber wash across the upper wall surface while the lower portion remains in cool blue-grey shadow. Quiet — the kind of stillness you find in alleys behind main streets where time moves slower. A sense of accumulated decades visible in every paint layer, crack, and sticker scar. The air feels cold and dry.

PHOTOGRAPHY STYLE: Indie street photography with visible film grain texture. Tight close-up composition with the sign placed off-center in the left third of the frame. Shallow depth of field — the Korean characters in sharp focus while the alley behind dissolves into soft creamy bokeh. Muted, desaturated tones with warm shadows — film emulation reminiscent of Kodak Portra 400. Slight vignetting at all edges. The framing suggests discovery — as if the photographer stopped mid-walk to capture this detail that most people walk past without noticing.

CRITICAL: Photorealistic photograph only. NO illustration, NO digital art, NO text overlay, NO watermark. Korean hand-painted signage must be prominent but naturally aged and partially illegible. Must fill entire frame edge-to-edge.`
  },
  {
    filename: 'stillcut-daeheung-bookshelf.jpeg',
    alt: '대흥동 독립서점 선반 — 로컬 잡지와 실크스크린 포스터가 빼곡한 합판 선반',
    caption: '다다르다 선반 한 칸에 대전 인디씬 10년이 꽂혀 있다',
    postSlug: '2026-02-13-12-1',
    personaId: 'niche',
    prompt: `An indie street photograph of a carefully curated shelf display inside a tiny independent bookshop in a Korean neighborhood cultural district.

SUBJECT: A tight close-up of a narrow raw plywood shelf in a small independent bookshop. The shelf holds a mix of hand-stapled zines with risograph-printed covers, silkscreen-printed indie music event posters rolled loosely, and small-press local magazines with distinctive hand-drawn typographic covers. One magazine prominently visible has a simple bold Korean title in a handset typeface. Several handmade flyers for local music events are tucked between publications — photocopied on colored paper. The shelf wood is raw and unfinished — plywood with visible grain and slightly rough edges. A small handwritten price tag in blue ballpoint pen is clipped to one zine with a tiny binder clip. Behind the front row, more publications are stacked horizontally. A few postcards with illustration prints lean against the back. The overall impression is obsessive curation — every single item placed with deliberate intention by someone who knows this scene deeply.

ATMOSPHERE: Warm interior light from a single exposed Edison bulb above, creating a golden pool of light on the shelf surface while the background falls into soft amber darkness. The intimate scale — this is clearly not a chain bookstore but someone's personal vision made physical. Quiet enough to hear pages turning. The warmth of old paper and fresh ink.

PHOTOGRAPHY STYLE: Indie street photography — extremely tight close-up with the shelf occupying the full frame. Shallow depth of field — the nearest zine covers are in crisp focus while the background stacks dissolve into creamy warm bokeh. Muted tones with film emulation — slightly desaturated with warm shadows and cooler highlights. Visible film grain adds organic texture. Off-center composition with the main subject cluster in the right two-thirds, negative space on the left showing the dark shop interior. Natural light mixed with the warm bulb creates a two-tone color temperature.

CRITICAL: Photorealistic photograph only. NO illustration, NO digital art, NO text overlay, NO watermark. Korean text on publications should be visible but naturally small or partially obscured by angles. Must fill entire frame edge-to-edge.`
  },
  // ── 도자기 물레 체험 (friendly/김주말) ──────────────────────────
  {
    filename: 'stillcut-craft-pottery-wheel.jpeg',
    alt: '도자기 물레 체험 — 흙 묻은 손으로 빚어가는 나만의 찻잔',
    caption: '선생님이 90% 해주셨지만 흙 만지는 감촉은 확실히 힐링이에요',
    postSlug: '2026-02-08-craft-experience',
    personaId: 'friendly',
    prompt: `A lifestyle photograph of a pottery wheel experience in a small Korean traditional craft workshop in Seoul's Bukchon area.

SUBJECT: A pair of hands shaping wet clay on a spinning pottery wheel — the hands have grey-brown clay residue up to the wrists. A half-formed ceramic teacup wobbles charmingly on the wheel, slightly lopsided and imperfect. The potter wears a natural linen apron with fresh clay smudges. In the background, wooden shelves display finished greenware pieces — simple Korean-style teacups, moon jars, and small buncheong-style plates in various stages of air-drying. The workshop has warm exposed wooden ceiling beams, white plastered hanok-style walls, and soft natural light pouring through a traditional wooden lattice window. A small handwritten Korean instruction card is propped against the wall. Clay tools — wire cutters, wooden ribs, sponges — are arranged neatly on a side table. Another workstation with a damp cloth-covered clay lump is visible to the side.

ATMOSPHERE: Late afternoon golden light filtering through the lattice window, casting warm geometric shadow patterns across the clay-covered work surface. The peaceful concentration of creating something with your hands after a week of office monitors — therapeutic and meditative. The earthy, mineral scent of wet clay. A quiet Saturday afternoon moment in a hanok-converted workshop, far from the weekend crowds outside.

PHOTOGRAPHY STYLE: Lifestyle photography — warm golden-hour lighting with soft creamy bokeh on the background shelves and greenware. Eye-level perspective looking at the hands and wheel from across the table, as if you're a friend watching the experience. Warm color grading with golden highlights on the wet clay surface and soft, gentle shadows. Slight vignetting at edges creating an intimate frame. The imperfect teacup on the wheel should be in crisp focus with beautiful specular highlights on the wet clay, while the workshop background dissolves into warm amber softness.

CRITICAL: Photorealistic photograph only. NO illustration, NO 3D render, NO digital art, NO text, NO watermark. Must clearly show Korean hanok-style craft workshop interior with traditional wooden elements. The clay work should look authentically beginner-level — charmingly imperfect. Must fill entire frame edge-to-edge.`
  },

  // ── 오지탐험 영양 자작나무 숲 (viral/조회영) ─────────────────────
  {
    filename: 'stillcut-oji-birch-forest.jpeg',
    alt: '영양 자작나무 숲 — 하얀 수피의 자작나무가 끝없이 이어지는 산기슭 오솔길',
    caption: '인제 원대리? 거긴 인파 지옥이야 — 여기는 내 발자국 소리만 울림',
    postSlug: '2026-02-07-top-5',
    personaId: 'viral',
    prompt: `An editorial magazine photograph of a vast birch forest on a remote Korean mountain slope, emphasizing the dramatic scale and solitude.

SUBJECT: Hundreds of silver-white birch trees standing in dense formation on a gently sloping hillside, their pale bark glowing against the dark forest floor. The trunks create strong vertical lines that stretch upward into a canopy of vivid green leaves filtering dappled sunlight. A narrow dirt trail — barely a footpath — winds through the center of the forest, covered in fallen leaves and scattered twigs. A single hiker in a dark jacket and backpack walks alone on the path, dwarfed by the towering birches around them, about 30 meters ahead. No other people visible anywhere. The forest floor is a carpet of wild ferns and low groundcover in muted greens. Some birch bark peels in thin white curls. The trees show natural variation — some perfectly straight, others leaning slightly, a few younger saplings mixed among mature specimens 15-20 meters tall.

ATMOSPHERE: Late morning summer light penetrating through the birch canopy — shafts of bright sunlight alternate with cool shadow patches, creating a dramatic chiaroscuro pattern on the forest floor. The air feels cool and still despite summer — the altitude and dense canopy create a microclimate. A faint mist or humidity haze softens the deeper layers of trees, adding atmospheric depth. The overwhelming sensation is silence and solitude — this forest feels untouched, wild, and far from any city.

PHOTOGRAPHY STYLE: Editorial magazine photography — dramatic shadow play, strong contrast between the brilliant white birch bark and deep forest shadows. Diagonal composition following the winding path from lower-left to upper-right, with the lone hiker positioned at the golden ratio intersection point. Hero framing — wide-angle perspective emphasizing the forest's overwhelming scale versus the tiny human figure. High contrast with saturated greens in the canopy and cool shadows on the forest floor. Deep blacks in the shadowed areas between distant trees. Shot from a slightly low angle to emphasize the height and majesty of the birch trunks converging overhead.

CRITICAL: Photorealistic photograph only. NO illustration, NO 3D render, NO digital art, NO text, NO watermark. The birch trunks must have clearly visible white papery bark characteristic of Korean birch forests. Must fill entire frame edge-to-edge.`
  },
];

async function main() {
  const client = new GeminiImageClient();
  if (!client.isConfigured() || !client.isEnabled()) {
    console.error('❌ GEMINI_API_KEY와 GEMINI_IMAGE_ENABLED=true 필요');
    process.exit(1);
  }

  const targetSpecs = FILTER_SLUG
    ? specs.filter(s => s.postSlug.includes(FILTER_SLUG))
    : specs;

  const activeSpecs = targetSpecs.filter(s => s.prompt);
  const usage = await client.getDailyUsage();
  console.log(`📊 Gemini 이미지 쿼터: ${usage}/50 (${activeSpecs.length}장 생성 예정)`);

  for (const spec of targetSpecs) {
    if (!spec.prompt) {
      console.log(`⏭️ ${spec.filename} — 프롬프트 미작성, 건너뜀`);
      continue;
    }

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

  console.log('\n📝 마크다운 삽입:');
  for (const spec of targetSpecs.filter(s => s.prompt)) {
    console.log(`   ![${spec.alt}](/travel-blog/images/${spec.filename})`);
    console.log(`   *${spec.caption}*\n`);
  }
}

main().catch(err => {
  console.error('오류:', err);
  process.exit(1);
});
