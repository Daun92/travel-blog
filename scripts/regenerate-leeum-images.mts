/**
 * 리움미술관 포스트 인라인 이미지 재생성 스크립트
 * 기존 Unsplash 외부 URL → Gemini AI 생성 로컬 이미지로 교체
 */
import { config } from 'dotenv';
config();

import { GeminiImageClient, saveImage } from '../src/images/gemini-imagen.js';
import { getMoodboardPrompt, getDiagramPrompt, getInfographicPrompt } from '../src/generator/image-prompts.js';
import type { ImageContext } from '../src/generator/image-prompts.js';
import { join } from 'path';

const OUTPUT_DIR = join(process.cwd(), 'blog', 'static', 'images');
const SLUG = 'leeum-museum';

const context: ImageContext = {
  topic: '리움미술관 - 서울 한남동, 고미술과 현대미술의 정수',
  type: 'culture',
};

// 3개 이미지 정의
const imageConfigs = [
  {
    index: 1,
    style: 'moodboard' as const,
    promptFn: () => getMoodboardPrompt({
      ...context,
      section: '리움미술관의 건축과 예술 감성 - 마리오 보타의 테라코타, 장 누벨의 스테인리스 스틸, 렘 쿨하스의 블랙박스. 세 건축 거장의 철학이 만나는 곳. 한국 고미술(고려청자, 조선백자)과 세계 현대미술(마크 로스코, 데미안 허스트)의 조화.',
    }),
    alt: '리움미술관 건축과 예술의 감성 무드보드',
    caption: 'AI 생성 무드보드',
  },
  {
    index: 2,
    style: 'diagram' as const,
    promptFn: () => getDiagramPrompt({
      ...context,
      section: '리움미술관 추천 관람 동선',
      locations: ['블랙박스(입구/교육센터)', 'M1 고미술관(마리오 보타)', 'M2 현대미술관(장 누벨)', '야외 조각공원(아니쉬 카푸어)'],
      data: {
        '총 소요시간': '약 2~3시간',
        'M1 추천': '로툰다 나선형 계단 포토존',
        'M2 추천': '디지털 가이드 활용',
        '야외': '한남동 전경과 조각 작품 감상',
      },
    }),
    alt: '리움미술관 추천 관람 동선 가이드',
    caption: 'AI 생성 여정 일러스트',
  },
  {
    index: 3,
    style: 'infographic' as const,
    promptFn: () => getInfographicPrompt({
      ...context,
      section: '리움미술관 관람 실용 정보',
      data: {
        '위치': '서울 용산구 이태원로55길 60-16 한남동',
        '운영시간': '화~일 10:00~18:00 (월요일 휴관)',
        '상설전': '무료 (예약 필수)',
        '기획전': '12,000~18,000원',
        '예약': '방문일 14일 전 공식 홈페이지',
        '주차': '관람객 무료',
        '교통': '한남역 2번 출구 도보 10분',
      },
    }),
    alt: '리움미술관 관람 실용 정보 인포그래픽',
    caption: 'AI 생성 여행 가이드',
  },
];

async function main() {
  const client = new GeminiImageClient();

  if (!client.isConfigured()) {
    console.error('GEMINI_API_KEY가 설정되지 않았습니다.');
    process.exit(1);
  }

  // isEnabled 체크 - 환경변수 강제 설정
  if (!process.env.GEMINI_IMAGE_ENABLED) {
    process.env.GEMINI_IMAGE_ENABLED = 'true';
  }

  const usage = await client.checkUsageLimit(3);
  console.log(`일일 사용량: ${usage.current}/${usage.limit}`);
  if (!usage.allowed) {
    console.error('일일 한도 초과:', usage.warning);
    process.exit(1);
  }

  const results: Array<{ index: number; path: string; alt: string; caption: string }> = [];

  for (const cfg of imageConfigs) {
    const filename = `inline-${SLUG}-${cfg.index}`;
    console.log(`\n[${cfg.index}/3] ${cfg.style} 이미지 생성 중...`);

    try {
      const prompt = cfg.promptFn();
      const generated = await client.generateImage({
        prompt,
        style: cfg.style,
        aspectRatio: '16:9',
        topic: context.topic,
      });

      const saved = await saveImage(generated, OUTPUT_DIR, filename);
      console.log(`  ✅ 저장: ${saved.filepath}`);
      console.log(`  📐 경로: ${saved.relativePath}`);

      results.push({
        index: cfg.index,
        path: saved.relativePath,
        alt: cfg.alt,
        caption: cfg.caption,
      });
    } catch (err) {
      console.error(`  ❌ 실패:`, err);
    }
  }

  console.log('\n=== 생성 결과 ===');
  for (const r of results) {
    console.log(`[${r.index}] ${r.path}`);
    console.log(`    alt: ${r.alt}`);
    console.log(`    caption: ${r.caption}`);
  }

  console.log(`\n총 ${results.length}/3개 이미지 생성 완료`);
}

main().catch(console.error);
