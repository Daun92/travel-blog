import { config } from 'dotenv'; config();
import { GeminiImageClient } from '../src/images/gemini-imagen.js';
import { getVisualIdentity } from '../src/images/cover-styles.js';
import { applyOverlayToBase64 } from '../src/images/cover-overlay.js';
import { join } from 'path';

async function main() {
  process.env.GEMINI_IMAGE_ENABLED = 'true';

  const slug = 'march-theatre-performances-top-5-seoul';
  const agentId = 'viral';
  const identity = getVisualIdentity(agentId);
  const outputDir = 'blog/static/images';

  const client = new GeminiImageClient();

  // ── 3가지 자극적 커버 프롬프트 ──────────────────────────────
  const variants = [
    {
      label: 'spotlight-tension',
      prompt: `Generate a photorealistic cover photograph for a Korean blog post.

Topic: "3월 연극 TOP 5: 소극장이 미쳐버린 이유"
Content type: Culture & arts

WHAT TO SHOW:
A dramatically lit Korean small theater (소극장) in Seoul's Daehakro district at night.
The image captures the EXACT MOMENT a single intense spotlight cuts through pitch darkness onto an empty stage,
creating a razor-sharp pool of light. In the foreground, rows of empty velvet seats wait in the dark,
creating deep leading lines toward the illuminated stage. The contrast between absolute darkness and the searing spotlight
creates an almost cinematic tension — as if something extraordinary is about to happen.
A faint haze of theatrical fog drifts through the beam of light.

CREATIVE DIRECTION — Maximum provocation, stop-scrolling impact:
- This should feel like a FORBIDDEN glimpse behind the curtain — the viewer must feel "What is about to happen on that stage?"
- Extreme contrast: near-total darkness vs. blinding spotlight creates visual tension
- The emptiness of the theater IS the story — anticipation before the storm
- Think: Christopher Nolan's "The Prestige" meets Korean indie theater
- The mood should be electric, mysterious, almost unsettling

PHOTOGRAPHY STYLE:
- Style: ${identity.photoStyle}
- Composition: ${identity.composition}
- Color grading: ${identity.colorGrading}
- Ultra-wide angle lens, f/1.4, shallow depth with foreground seat bokeh

CRITICAL REQUIREMENTS:
- Must look like a REAL photograph by a professional photographer. NO illustration, NO digital art.
- Aspect ratio: 16:9 landscape (1200x675 pixels).
- Fill the ENTIRE frame edge-to-edge. NO white space, NO margins.
- Do NOT include any text, watermark, logo, or overlay. Pure photograph only.
- Korean theater atmosphere must be unmistakable.`,
    },
    {
      label: 'actor-closeup',
      prompt: `Generate a photorealistic cover photograph for a Korean blog post.

Topic: "3월 연극 TOP 5: 안 보면 손해 보는 소극장 라인업"
Content type: Culture & arts

WHAT TO SHOW:
A powerful close-up of a Korean theater actor's face, half-lit by a single stage light from the side.
One eye is brilliantly illuminated, intense and piercing, staring directly at the camera.
The other half of the face dissolves into deep shadow. The actor wears subtle theatrical makeup
that enhances their dramatic expression — a look of raw intensity and vulnerability.
Behind them, out of focus, the warm glow of a small Korean theater stage (소극장) is barely visible.
Beads of sweat catch the stage light on their forehead, suggesting the physical intensity of live performance.

CREATIVE DIRECTION — Provocative and intimate:
- This should feel UNCOMFORTABLY close — like the actor broke the fourth wall and is looking right at YOU
- The half-shadow creates mystery: "What story are they about to tell me?"
- Raw human emotion is the most provocative visual — no set, no costume, just FACE and LIGHT
- Think: Annie Leibovitz portrait meets Korean independent theater intensity
- The viewer should feel challenged: "Can you handle what I'm about to show you?"

PHOTOGRAPHY STYLE:
- Style: ${identity.photoStyle}
- Composition: extreme close-up, Rembrandt lighting, shallow depth of field
- Color grading: ${identity.colorGrading}
- 85mm portrait lens, f/1.8, razor-thin focus on the illuminated eye

CRITICAL REQUIREMENTS:
- Must look like a REAL photograph by a professional photographer. NO illustration, NO digital art.
- Aspect ratio: 16:9 landscape (1200x675 pixels).
- Fill the ENTIRE frame edge-to-edge. NO white space, NO margins.
- Do NOT include any text, watermark, logo, or overlay. Pure photograph only.
- Korean person, Korean theater setting.`,
    },
    {
      label: 'daehakro-neon',
      prompt: `Generate a photorealistic cover photograph for a Korean blog post.

Topic: "3월 연극 TOP 5: 엘시노어부터 센과 치히로까지"
Content type: Culture & arts

WHAT TO SHOW:
Seoul's Daehakro (대학로) theater district at night, captured from a low angle looking up at
the glowing theater signboards and neon lights. Multiple small theater facades compete for attention
with their illuminated marquees. The street is alive with the warm glow spilling from theater entrances.
A dramatic diagonal composition cuts through the frame — a line of bright theater posters on one side,
deep urban shadows on the other. Silhouettes of theatergoers create dynamic human shapes against
the backlit theater entrances. The wet pavement reflects all the colors creating a cinematic mirror effect.

CREATIVE DIRECTION — Urban energy and FOMO:
- This should scream "THIS is where the real culture happens — and you're missing it RIGHT NOW"
- The abundance of theaters creates visual overload — so much to see, so little time
- Wet reflections double the visual impact and create a film noir mood
- The low angle makes the viewer feel like they just arrived and are looking up in wonder
- Think: Wong Kar-wai's neon-soaked Hong Kong, but it's Seoul's theater district
- Maximum FOMO energy: these lights are on TONIGHT, tickets are selling out

PHOTOGRAPHY STYLE:
- Style: ${identity.photoStyle}
- Composition: ${identity.composition}
- Color grading: neon-warm highlights against deep teal shadows, cinematic color contrast
- 24mm wide angle, f/2.8, night photography with intentional light bloom

CRITICAL REQUIREMENTS:
- Must look like a REAL photograph by a professional photographer. NO illustration, NO digital art.
- Aspect ratio: 16:9 landscape (1200x675 pixels).
- Fill the ENTIRE frame edge-to-edge. NO white space, NO margins.
- Do NOT include any text, watermark, logo, or overlay. Pure photograph only.
- Korean theater district atmosphere, Korean signage style (but no readable text required).`,
    },
  ];

  console.log('=== 3월 연극 TOP 5 커버 이미지 생성 (순차) ===\n');
  console.log(`에이전트: 조회영 (viral) | 후보: ${variants.length}개\n`);

  for (let i = 0; i < variants.length; i++) {
    const v = variants[i];
    const filename = `cover-${slug}-${v.label}`;

    console.log(`[${i + 1}/${variants.length}] ${v.label} 생성 중...`);

    try {
      const image = await client.generateImage({
        prompt: v.prompt,
        style: 'cover_photo',
        aspectRatio: '16:9',
        personaId: agentId,
      });

      // 관인 오버레이 적용
      const outputPath = join(outputDir, `${filename}.jpg`);
      await applyOverlayToBase64(
        image.base64Data,
        outputPath,
        '3월 연극 TOP 5',
        identity,
      );

      console.log(`  ✅ 완료: ${outputPath}`);
      console.log(`  Hugo: /travel-blog/images/${filename}.jpg\n`);
    } catch (err) {
      console.error(`  ❌ 실패: ${err}\n`);
    }
  }

  console.log('=== 완료 ===');
  console.log('3개 후보 중 선택하여 frontmatter cover.image 교체');
}

main().catch(console.error);
