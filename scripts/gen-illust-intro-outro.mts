/**
 * 을지로 디깅 포스트 — 도입부/마감부 일러스트 생성
 * 기존 AI 일러스트 스타일 (diagram, bucketlist)
 */
import { config } from 'dotenv';
config();

import { writeFile } from 'fs/promises';
import { join } from 'path';
import { GeminiImageClient } from '../src/images/gemini-imagen.js';

const OUTPUT_DIR = 'blog/static/images';

interface IllustSpec {
  filename: string;
  alt: string;
  caption: string;
  style: 'diagram' | 'bucketlist';
  prompt: string;
}

const specs: IllustSpec[] = [
  {
    filename: 'inline-2026-02-11-12-4.jpeg',
    alt: '을지로 4-Layer 디깅 단면도',
    caption: '을지로 골목, 몇 번째 방문이냐에 따라 보이는 세계가 달라진다',
    style: 'diagram',
    prompt: `을지로 공구골목 디깅 가이드: 방문 횟수별로 보이는 4개의 레이어

LAYERS (top to bottom, like geological cross-section):

Layer 1 - 표면 (1~2회 방문): 노가리골목, 플라스틱 의자, 맥주잔, 형광등, 시끌벅적한 관광객
→ Icon: beer mug + dried fish

Layer 2 - 단골 (3~5회 방문): 철제가구거리, 용접 불꽃, 철 프레임, 도면, 장인의 손
→ Icon: welding sparks + steel frame

Layer 3 - 인사이더 (6~9회 방문): 지하상가, 겹겹이 붙은 전단지, 백반집, 공구 부품 대화
→ Icon: layered flyers + rice bowl

Layer 4 - 덕질 (10회+): 맨홀 뚜껑 "1987", 간판 글씨체 변화, 바닥 타일 패턴
→ Icon: manhole cover + magnifying glass

Style: Cross-section diagram like a treasure map. Hand-drawn feel, warm tones.
Each layer gets deeper and more detailed. An arrow or path winds down through all 4 layers.
Korean labels for each layer name. Charming hand-drawn icons for each discovery.
Color palette: warm cream base, terracotta, industrial grey, teal accents.`
  },
  {
    filename: 'inline-2026-02-11-12-5.jpeg',
    alt: '오덕우의 을지로 디깅 체크리스트',
    caption: '을지로 디깅 체크리스트 — 몇 개나 해봤나요?',
    style: 'bucketlist',
    prompt: `오덕우의 을지로 디깅 체크리스트 (Euljiro Digging Checklist)

A gamified exploration checklist for Euljiro alley adventures:

BEGINNER (초보 디거):
□ 노가리골목에서 맥주 한 잔 마시기
□ 플라스틱 의자 간격 15cm 규칙 확인하기
□ 인쇄소 기계 소리 들어보기

INTERMEDIATE (중급 디거):
□ 철제가구거리 용접 자국 관찰하기
□ "도면 가져와 봐" 사장님 만나기
□ 백반집에서 8,000원 점심 먹기

ADVANCED (고급 디거):
□ 지하상가 천장 전단지 연도별 구분하기
□ 간판 글씨체 시대별 차이 발견하기

MASTER (마스터 디거):
□ 산림동 맨홀 뚜껑 "1987" 찾기
□ 바닥 타일 패턴 3가지 이상 구분하기
□ 공구 사장님과 5분 이상 대화하기

Achievement badges: "첫 디깅 완료" "을지로 단골" "시간의 고고학자"
Style: Gamified journal page, hand-drawn checkboxes, stamp-style badges.
Color palette: cream paper, teal (#0D9488) accents, warm grey, terracotta highlights.
Korean text labels. Playful but sophisticated.`
  }
];

async function main() {
  const client = new GeminiImageClient();
  if (!client.isConfigured() || !client.isEnabled()) {
    console.error('GEMINI_API_KEY와 GEMINI_IMAGE_ENABLED=true 필요');
    process.exit(1);
  }

  const usage = await client.getDailyUsage();
  console.log(`📊 Gemini 이미지 쿼터: ${usage}/50 (2장 생성 예정 → ${usage + 2}/50)`);

  if (usage + 2 > 50) {
    console.error('❌ 쿼터 부족! 내일 다시 시도하세요.');
    process.exit(1);
  }

  for (const spec of specs) {
    console.log(`\n🎨 생성 중: ${spec.alt} (${spec.style})...`);

    let image;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        image = await client.generateImage({
          prompt: spec.prompt,
          style: spec.style as any,
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

    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('\n✅ 완료!');
}

main().catch(err => {
  console.error('오류:', err);
  process.exit(1);
});
