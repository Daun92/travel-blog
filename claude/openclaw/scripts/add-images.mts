import { config } from 'dotenv';
config();

import { GeminiImageClient, saveImage } from '../src/images/gemini-imagen.js';
import { getInfographicPrompt, getDiagramPrompt } from '../src/generator/image-prompts.js';

const client = new GeminiImageClient();
const outputDir = './blog/static/images';
const slug = 'mmca-exhibition';

async function generateImages() {
  console.log('Gemini 상태:', client.isConfigured() ? '✓ 설정됨' : '✗ API 키 없음');
  console.log('이미지 생성:', client.isEnabled() ? '✓ 활성화' : '✗ 비활성화');

  if (!client.isConfigured() || !client.isEnabled()) {
    console.log('Gemini 설정을 확인하세요.');
    return;
  }

  const usage = await client.getDailyUsage();
  console.log('일일 사용량:', usage);

  const context = {
    topic: '국립현대미술관 서울 2026 기획전',
    type: 'culture' as const
  };

  // 1. 관람 정보 인포그래픽
  console.log('\n[1/2] 관람 정보 인포그래픽 생성 중...');
  const infoPrompt = getInfographicPrompt({
    ...context,
    section: '관람 정보 가이드',
    data: {
      '장소': '서울 종로구 삼청로 30',
      '운영시간': '10:00-18:00 (수,토 21:00)',
      '입장료': '무료 (기획전 4,000원)',
      '휴관일': '매주 월요일',
      '소요시간': '약 2-3시간'
    }
  });

  try {
    const img1 = await client.generateImage({
      prompt: infoPrompt,
      style: 'infographic',
      aspectRatio: '16:9',
      topic: context.topic
    });
    const saved1 = await saveImage(img1, outputDir, 'inline-' + slug + '-1');
    console.log('✓ 저장:', saved1.relativePath);

    // 2. 관람 동선 다이어그램
    console.log('\n[2/2] 관람 동선 다이어그램 생성 중...');
    const diagramPrompt = getDiagramPrompt({
      ...context,
      section: '추천 관람 동선',
      locations: ['5층 옥상정원', '4층 기획전시실', '3층 상설전시', '2층 특별전', '1층 아트샵'],
      data: {
        '추천동선': '5층부터 내려오며 관람',
        '포토존': '옥상정원 경복궁 뷰',
        '휴식공간': '1층 카페'
      }
    });

    const img2 = await client.generateImage({
      prompt: diagramPrompt,
      style: 'diagram',
      aspectRatio: '16:9',
      topic: context.topic
    });
    const saved2 = await saveImage(img2, outputDir, 'inline-' + slug + '-2');
    console.log('✓ 저장:', saved2.relativePath);

    console.log('\n완료!');
  } catch (err: any) {
    console.error('오류:', err.message);
  }
}

generateImages();
