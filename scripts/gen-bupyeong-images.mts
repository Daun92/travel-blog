/**
 * 부평 산업유산 포스트 — KTO 다운로드 + AI Batch 이미지 생성
 *
 * 이미지 계획 (10장):
 *   - KTO 2장: 부평모두몰(2021033), 부평시장(2768142)
 *   - AI 7장: 지층단면도(diagram), GM공장·캠프마켓·줄사택·지하호내부·지하호출구(stillcut), 무드보드(moodboard)
 *   - 커버 1장: cover_photo + 관인 오버레이
 *
 * Usage:
 *   npx tsx scripts/gen-bupyeong-images.mts              # 전체 (KTO + AI)
 *   npx tsx scripts/gen-bupyeong-images.mts --dry-run     # 프롬프트만 미리보기
 *   npx tsx scripts/gen-bupyeong-images.mts --kto-only    # KTO 다운로드만
 *   npx tsx scripts/gen-bupyeong-images.mts --ai-only     # AI 배치만
 *   npx tsx scripts/gen-bupyeong-images.mts --sequential  # 순차 모드 (배치 대신)
 */
import { config } from 'dotenv';
config();

import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { GeminiImageClient, type BatchImageRequest, type ImageStyle, saveImage } from '../src/images/gemini-imagen.js';
import { getCoverPhotoPrompt, getVisualIdentity } from '../src/images/cover-styles.js';
import { applyOverlayToBase64 } from '../src/images/cover-overlay.js';
import { getDiagramPrompt, getMoodboardPrompt, type ImageContext } from '../src/generator/image-prompts.js';
import { getDataGoKrClient } from '../src/api/data-go-kr/index.js';

// ── CLI ────────────────────────────────────────────────────────────────
const DRY_RUN = process.argv.includes('--dry-run');
const KTO_ONLY = process.argv.includes('--kto-only');
const AI_ONLY = process.argv.includes('--ai-only');
const SEQUENTIAL = process.argv.includes('--sequential');

const OUTPUT_DIR = 'blog/static/images';
const SLUG = 'bupyeong-industrial-heritage-walking';
const DATE = '2026-02-21';
const TOPIC = '부평역 지하 150m, 네 겹의 시간을 걷다';
const PERSONA = 'informative';
const POST_TYPE: 'travel' | 'culture' = 'culture';
const HEADINGS = [
  '지표면: 세계 기록의 지하도시, 부평모두몰',
  '1층 지층: 깡시장, 전쟁이 남긴 이름',
  '2층 지층: 두 개의 굴뚝, 64년의 조립 라인',
  '3층 지층: 84년 만에 열린 문 — 캠프마켓',
  '미쓰비시 줄사택',
  '암반층: 정 자국이 말하는 것 — 지하호 150m',
  '다시 부평역, 같은 발걸음 다른 시선',
];

// ── KTO 이미지 다운로드 ────────────────────────────────────────────────

interface KtoTarget {
  contentId: string;
  name: string;
  outputName: string;
  caption: string;
}

const KTO_TARGETS: KtoTarget[] = [
  {
    contentId: '2768142',
    name: '부평시장',
    outputName: `kto-${DATE}-${SLUG}-market.jpg`,
    caption: '부평종합시장 — \'깡시장\'이라는 이름에 한국전쟁 이후의 경제사가 담겨 있습니다. 출처: 한국관광공사',
  },
];

async function downloadKtoImages() {
  console.log('\n📷 KTO 이미지 다운로드 시작...');
  const client = getDataGoKrClient();

  for (const target of KTO_TARGETS) {
    console.log(`\n  [${target.name}] contentId: ${target.contentId}`);
    try {
      // detailImage2로 상세 이미지 가져오기
      const images = await client.detailImage(target.contentId);
      if (!images || images.length === 0) {
        console.log(`    ⚠️ 상세 이미지 없음, firstimage 사용 시도...`);
        // firstimage fallback
        const detail = await client.detailCommon(target.contentId);
        if (detail?.firstimage) {
          await downloadAndSave(detail.firstimage, target.outputName);
          console.log(`    ✅ firstimage 다운로드 완료: ${target.outputName}`);
        } else {
          console.log(`    ❌ firstimage도 없음`);
        }
        continue;
      }

      console.log(`    📸 ${images.length}장 발견`);
      for (let i = 0; i < Math.min(images.length, 3); i++) {
        const url = images[i].originimgurl || images[i].smallimageurl;
        if (!url) continue;
        const suffix = i === 0 ? '' : `-${i + 1}`;
        const fname = target.outputName.replace('.jpg', `${suffix}.jpg`);
        if (!DRY_RUN) {
          await downloadAndSave(url, fname);
          console.log(`    ✅ ${fname}`);
        } else {
          console.log(`    [DRY] ${fname} ← ${url}`);
        }
      }
    } catch (e: any) {
      console.error(`    ❌ ${target.name} 실패:`, e.message);
    }
  }
}

async function downloadAndSave(url: string, filename: string) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${url}`);
  const buf = Buffer.from(await resp.arrayBuffer());
  const outPath = join(OUTPUT_DIR, filename);
  if (!existsSync(OUTPUT_DIR)) await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(outPath, buf);
}

// ── AI 이미지 배치 생성 ────────────────────────────────────────────────

interface AiImageDef {
  filename: string;
  style: ImageStyle;
  role: string;
  prompt: string;
}

function buildAiImageDefs(): AiImageDef[] {
  const defs: AiImageDef[] = [];

  // 1) 지층 단면도 — diagram
  const diagramCtx: ImageContext = {
    topic: TOPIC,
    type: POST_TYPE,
    section: '부평의 네 겹 시간 지층',
    narrativeHint: 'A cross-section diagram showing 4 time layers of Bupyeong: surface (underground mall 2026), Layer 1 (market 1950s), Layer 2 (automobile factory 1962), Layer 3 (Camp Market 1945), bedrock (underground tunnel 1939). Each layer shows key visual elements of that era.',
    locations: ['부평모두몰', '깡시장', 'GM공장', '캠프마켓', '조병창 지하호'],
    personaId: PERSONA,
  };
  defs.push({
    filename: `inline-${DATE}-${SLUG}-1.jpeg`,
    style: 'diagram',
    role: '도입 — 시간 지층 단면도',
    prompt: getDiagramPrompt(diagramCtx),
  });

  // 2) GM 공장 — stillcut
  defs.push({
    filename: `inline-${DATE}-${SLUG}-2.jpeg`,
    style: 'cover_photo',
    role: 'GM 부평공장 원경',
    prompt: `A photorealistic photograph for a Korean culture blog post about: ${TOPIC}

SUBJECT: Korean GM Bupyeong automobile factory viewed from Bupyeong-daero road. Two smokestacks with white steam rising against the sky. Factory wall with automobile murals painted on concrete. Industrial scale — massive factory complex stretching along a wide urban road. Korean signage visible. Late afternoon light casting long shadows on the industrial architecture.

NARRATIVE CONTEXT: This photograph illustrates a section about Korea's first modern automobile assembly line, established in 1962. The same factory has changed owners 7 times in 64 years — from Saenara Motors to GM Korea. The image should convey the weight of industrial time embedded in the architecture.

ATMOSPHERE: The contemplative atmosphere of an industrial landscape. Natural afternoon light creating depth on concrete and steel surfaces. A sense of scale and duration — decades of manufacturing compressed into one view.

PHOTOGRAPHY STYLE: Architectural photography approach. Balanced exposure capturing both the factory structure and sky. Clean composition emphasizing geometric lines of industrial buildings. Documentary style — observational, not dramatic. Neutral color temperature with slight warm tones from late afternoon sun.

CRITICAL: Photorealistic photograph ONLY. NO illustration, NO digital art, NO cartoon, NO text overlay, NO watermark. Must look like an actual photograph taken on location. Must fill entire frame edge-to-edge. Korean industrial atmosphere must be unmistakable.`,
  });

  // 3) 캠프마켓 — stillcut
  defs.push({
    filename: `inline-${DATE}-${SLUG}-3.jpeg`,
    style: 'cover_photo',
    role: '캠프마켓 옛 건물',
    prompt: `A photorealistic photograph for a Korean culture blog post about: ${TOPIC}

SUBJECT: A former US military base compound being returned to civilian use. Tall concrete perimeter wall with traces of barbed wire removed. Beyond the wall, old Japanese colonial-era warehouse buildings (1939) are partially visible — weathered brick and concrete structures with industrial windows. Some areas show green space reclamation. A contrast between the sealed military boundary and the glimpse of preserved historical buildings inside.

NARRATIVE CONTEXT: Camp Market in Bupyeong, Incheon — a US military base that operated for 84 years on the site of a Japanese imperial army arsenal. The base was fully returned in 2023. Because the military occupied this land for 80 years, the colonial-era buildings were accidentally preserved while everything outside the walls was redeveloped.

ATMOSPHERE: A liminal space between past and present. Quiet, almost archaeological stillness. The contrast between weathered historical structures and the surrounding modern city. Overcast or soft diffused light emphasizing textures of old concrete and brick.

PHOTOGRAPHY STYLE: Architectural photography. Balanced, documentary approach. Clean framing showing the relationship between the wall (boundary) and the buildings beyond it (preserved time). Neutral tones, generous depth of field capturing both foreground and background detail.

CRITICAL: Photorealistic photograph ONLY. NO illustration, NO digital art, NO cartoon, NO text overlay, NO watermark. Must look like an actual photograph taken on location. Korean urban/industrial context.`,
  });

  // 4) 미쓰비시 줄사택 — stillcut
  defs.push({
    filename: `inline-${DATE}-${SLUG}-4.jpeg`,
    style: 'cover_photo',
    role: '미쓰비시 줄사택',
    prompt: `A photorealistic photograph for a Korean culture blog post about: ${TOPIC}

SUBJECT: A row of Japanese colonial-era worker dormitories (julsa-taek / row houses) built in 1939. Low, narrow brick and concrete buildings with 10 small rooms per unit connected by a cramped corridor. Weathered exterior walls showing decades of patching and aging. A cultural heritage designation sign visible nearby. The building stands in a quiet residential neighborhood, dwarfed by modern apartment buildings in the background.

NARRATIVE CONTEXT: The Mitsubishi Row Houses in Sangok-dong, Bupyeong — the only surviving forced-labor dormitory of Mitsubishi in Korea. Built for conscripted Korean workers at the Incheon Arsenal. Designated as National Registered Cultural Heritage No. 858 in August 2024.

ATMOSPHERE: A solemn, contemplative scene. The small scale of the dormitory against modern buildings creates a powerful temporal contrast. Quiet residential street. Soft natural light revealing the texture of old walls and patched surfaces.

PHOTOGRAPHY STYLE: Documentary architectural photography. Even exposure, clean framing. Focus on the building's structural details — narrow doorways, low ceilings suggested by window placement, repetitive room units. Respectful, observational tone without dramatization.

CRITICAL: Photorealistic photograph ONLY. NO illustration. Must look like an actual photograph of a real historical building in Korea.`,
  });

  // 5) 지하호 내부 — stillcut
  defs.push({
    filename: `inline-${DATE}-${SLUG}-5.jpeg`,
    style: 'cover_photo',
    role: '지하호 내부 — 정 자국과 종유석',
    prompt: `A photorealistic photograph for a Korean culture blog post about: ${TOPIC}

SUBJECT: Inside a dark underground tunnel (jihaho) carved into rock during the Japanese colonial period. The tunnel extends approximately 150 meters into a mountainside. Rough-hewn rock walls with visible chisel marks (jeong jaguk) — the physical traces of forced labor from 1939-1945. Tiny stalactites (fingernail-sized) growing from the ceiling, formed over 87 years. The only light comes from a handheld flashlight, creating dramatic directional illumination on the wet, textured rock surface.

NARRATIVE CONTEXT: Bupyeong Arsenal Underground Tunnel C-zone No. 6 — one of 24 tunnels carved into Hambongsan mountain for underground weapons manufacturing. Approximately 15,000 Koreans including teenage boys were forced to dig these tunnels. The chisel marks on the walls are 87-year-old physical evidence of this labor.

ATMOSPHERE: Profound darkness with a single beam of flashlight. Damp air suggested by moisture on rock surfaces. The silence and weight of being underground. A sense of geological time meeting human history — the tiny stalactites are nature's slow response to human violence.

PHOTOGRAPHY STYLE: Low-light documentary photography. Single directional light source (flashlight) creating strong contrast between illuminated rock texture and surrounding darkness. Close-up on chisel marks and stalactites. Textural, almost tactile quality.

CRITICAL: Photorealistic photograph ONLY. Must look like a real cave/tunnel interior lit by flashlight. NO illustration. Dark, atmospheric, documentary.`,
  });

  // 6) 지하호 출구 — stillcut
  defs.push({
    filename: `inline-${DATE}-${SLUG}-6.jpeg`,
    style: 'cover_photo',
    role: '지하호 출구 — 어둠에서 빛으로',
    prompt: `A photorealistic photograph for a Korean culture blog post about: ${TOPIC}

SUBJECT: View from inside a dark underground tunnel looking toward the exit. The tunnel opening frames bright natural daylight and green mountain vegetation (Korean deciduous forest in spring/summer). The contrast between the pitch-dark tunnel interior and the bright green exit creates a powerful visual metaphor. Rock walls of the tunnel frame the opening like a portal. A person wearing a safety helmet is silhouetted near the exit.

NARRATIVE CONTEXT: Exiting the Bupyeong Arsenal Underground Tunnel after walking 150 meters in darkness. The same sunlight feels different after experiencing the tunnel's history of forced labor and wartime production.

ATMOSPHERE: Dramatic light contrast — darkness behind, bright natural light ahead. The green of Hambongsan mountain vegetation feels especially vivid after the darkness. A moment of emotional transition.

PHOTOGRAPHY STYLE: Compositional framing using the tunnel opening as a natural frame. Expose for the highlights (outside vegetation) letting the tunnel interior go dark, or balanced HDR showing both. Documentary style with artistic framing.

CRITICAL: Photorealistic photograph ONLY. NO illustration. Cave/tunnel exit photography. Korean mountain landscape visible through the opening.`,
  });

  // 7) 마감 무드보드
  const moodCtx: ImageContext = {
    topic: TOPIC,
    type: POST_TYPE,
    section: '네 겹의 시간이 겹친 도시, 부평',
    narrativeHint: 'A visual summary of four time layers: underground mall crowds, factory smokestacks, military base walls, and dark tunnel with chisel marks. These four images overlap and blend like geological strata, creating a layered visual essay about industrial heritage.',
    locations: ['부평모두몰', '깡시장', 'GM공장', '캠프마켓', '조병창 지하호'],
    personaId: PERSONA,
  };
  defs.push({
    filename: `inline-${DATE}-${SLUG}-7.jpeg`,
    style: 'moodboard',
    role: '마감 — 시간 지층 무드보드',
    prompt: getMoodboardPrompt(moodCtx),
  });

  return defs;
}

function buildCoverDef(): AiImageDef {
  const coverPrompt = getCoverPhotoPrompt(
    TOPIC,
    POST_TYPE,
    PERSONA,
    undefined,
    HEADINGS,
  );
  return {
    filename: `cover-${DATE}-${SLUG}.jpg`,
    style: 'cover_photo',
    role: '커버',
    prompt: coverPrompt,
  };
}

async function generateAiImages() {
  const imageClient = new GeminiImageClient();
  const defs = buildAiImageDefs();
  const coverDef = buildCoverDef();
  const allDefs = [...defs, coverDef];

  console.log(`\n🎨 AI 이미지 ${allDefs.length}장 생성 시작...`);

  if (DRY_RUN) {
    for (const def of allDefs) {
      console.log(`\n  [${def.role}] ${def.filename} (${def.style})`);
      console.log(`    프롬프트: ${def.prompt.slice(0, 200)}...`);
    }
    return;
  }

  if (!existsSync(OUTPUT_DIR)) await mkdir(OUTPUT_DIR, { recursive: true });

  if (SEQUENTIAL) {
    // 순차 모드
    for (const def of allDefs) {
      console.log(`\n  🔄 [${def.role}] 생성 중...`);
      try {
        const result = await imageClient.generateImage({
          prompt: def.prompt,
          style: def.style,
          aspectRatio: '16:9',
          topic: TOPIC,
          personaId: PERSONA,
        });
        if (result) {
          // 커버는 관인 오버레이 적용
          if (def.role === '커버') {
            const identity = getVisualIdentity(PERSONA);
            const outPath = join(OUTPUT_DIR, def.filename);
            await applyOverlayToBase64(result.base64Data, outPath, TOPIC, identity);
          } else {
            await saveImage(result, OUTPUT_DIR, def.filename, { optimize: true });
          }
          console.log(`    ✅ ${def.filename}`);
        }
      } catch (e: any) {
        console.error(`    ❌ ${def.role} 실패:`, e.message);
      }
    }
  } else {
    // Batch API
    console.log('  📦 Batch API 모드');
    const batchRequests: BatchImageRequest[] = allDefs.map(def => ({
      prompt: def.prompt,
      style: def.style,
      aspectRatio: '16:9' as const,
      topic: TOPIC,
      personaId: PERSONA,
    }));

    try {
      const results = await imageClient.generateImagesBatch(batchRequests, {
        timeoutMs: 600000, // 10분
        onProgress: (msg) => console.log(`    ${msg}`),
      });

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const def = allDefs[i];
        if (result.success && result.image) {
          // 커버는 관인 오버레이 적용
          if (def.role === '커버') {
            const identity = getVisualIdentity(PERSONA);
            const outPath = join(OUTPUT_DIR, def.filename);
            await applyOverlayToBase64(result.image.base64Data, outPath, TOPIC, identity);
          } else {
            await saveImage(result.image, OUTPUT_DIR, def.filename, { optimize: true });
          }
          console.log(`    ✅ [${i + 1}/${results.length}] ${def.filename}`);
        } else {
          console.error(`    ❌ [${i + 1}/${results.length}] ${def.role}: ${result.error}`);
        }
      }
    } catch (e: any) {
      if (e.name === 'BatchTimeoutError') {
        console.log('    ⏰ 배치 타임아웃 — 순차 모드로 폴백');
        // 순차 폴백 — 재귀적으로 처리
        process.argv.push('--sequential');
        await generateAiImages();
      } else {
        throw e;
      }
    }
  }
}

// ── 메인 ────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log(`🏭 부평 산업유산 포스트 이미지 생성`);
  console.log(`   slug: ${SLUG}`);
  console.log(`   모드: ${DRY_RUN ? 'DRY RUN' : KTO_ONLY ? 'KTO만' : AI_ONLY ? 'AI만' : '전체'}`);
  console.log('═══════════════════════════════════════════════');

  if (!AI_ONLY) {
    await downloadKtoImages();
  }

  if (!KTO_ONLY) {
    await generateAiImages();
  }

  console.log('\n✅ 완료');
}

main().catch(err => {
  console.error('\n❌ 치명적 오류:', err);
  process.exit(1);
});
