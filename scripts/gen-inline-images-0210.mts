/**
 * 2026-02-10 포스트용 인라인 AI 이미지 생성
 */

import { config } from 'dotenv';
config();

import { GeminiImageClient, saveImage, type ImageStyle } from '../src/images/gemini-imagen.js';

const OUTPUT_DIR = 'blog/static/images';
const DELAY_MS = 5000;

interface ImageTask {
  filename: string;
  style: ImageStyle;
  alt: string;
  prompt: string;
}

const TASKS: ImageTask[] = [
  {
    filename: 'inline-2026-02-10-gangneung-1',
    style: 'infographic',
    alt: '강릉 겨울 여행 코스 가이드',
    prompt: `강릉 겨울 여행 코스 가이드 (Travel Diary Page Style)

Visual Concept: 따뜻한 수채화 톤의 여행 다이어리 페이지
- 경포대 누각에서 바라본 겨울 경포호 풍경
- 굴산사지 당간지주 실루엣
- 3·1운동 기념공원 산책로
- 겨울 강릉의 차가운 바람과 눈 표현

Style: 손글씨 메모와 화살표가 있는 여행 노트 느낌
Color: 차가운 블루톤 + 따뜻한 베이지/갈색 포인트
Text: 한국어 손글씨 스타일 (경포대, 굴산사지, 3·1운동공원)
Layout: A4 세로형 여행 다이어리 페이지`,
  },
  {
    filename: 'inline-2026-02-10-busan-1',
    style: 'infographic',
    alt: '부산 감천사~F1963 여행 코스 가이드',
    prompt: `부산 문화 여행 코스 가이드 (Travel Diary Page Style)

Visual Concept: 따뜻한 수채화 톤의 여행 다이어리 페이지
- 묘봉산 감천사 등산길과 약수터
- F1963 와이어공장 외관과 갤러리 내부
- 광복로 겨울빛 트리축제 야경
- 기장 아울렛과 광안리 드론쇼

Style: 손글씨 메모와 화살표가 있는 여행 노트 느낌
Color: 따뜻한 오렌지/코랄톤 + 부산 바다 블루 포인트
Text: 한국어 손글씨 스타일 (감천사, F1963, 광복로)
Layout: A4 세로형 여행 다이어리 페이지`,
  },
];

async function main() {
  const client = new GeminiImageClient();

  if (!client.isConfigured() || !client.isEnabled()) {
    console.error('❌ Gemini 이미지 생성이 비활성화되어 있습니다.');
    process.exit(1);
  }

  console.log(`🎨 ${TASKS.length}개 AI 인라인 이미지 생성 시작\n`);

  for (const task of TASKS) {
    console.log(`  생성 중: ${task.filename} (${task.style})`);
    try {
      const image = await client.generateImage({
        prompt: task.prompt,
        style: task.style,
        topic: task.alt,
        locale: 'ko',
      });
      const saved = await saveImage(image, OUTPUT_DIR, task.filename);
      console.log(`  ✅ 저장: ${saved.filename} (${saved.fileSize} bytes)\n`);
    } catch (err: any) {
      console.error(`  ❌ 실패: ${err.message}\n`);
    }

    // 레이트 리밋 존중
    if (TASKS.indexOf(task) < TASKS.length - 1) {
      await new Promise(r => setTimeout(r, DELAY_MS));
    }
  }

  console.log('🎨 완료!');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
