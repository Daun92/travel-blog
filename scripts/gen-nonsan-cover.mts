import { config } from 'dotenv'; config();
import { GeminiImageClient, saveImage } from '../src/images/gemini-imagen.js';
import { getCoverPhotoPrompt } from '../src/images/cover-styles.js';

async function main() {
  // 이미지 생성 활성화
  process.env.GEMINI_IMAGE_ENABLED = 'true';

  const topic = '논산 딸기축제 가족 체험 비용 정산, 빛을 따라 걷는 주말의 기록';
  const contentHints = [
    '오전 10시, 첫 빛이 닿는 딸기삼촌농장',
    '오후 1시, 시간이 멈춘 논산 명재고택과 노강서원',
    '오후 3시, 백제의 미소를 만나는 관촉사',
    '오후 5시, 골든아워의 논산 노성산성',
  ];

  const prompt = getCoverPhotoPrompt(topic, 'travel', 'friendly', undefined, contentHints);

  console.log('=== 커버 프롬프트 (friendly 에이전트) ===');
  console.log(prompt.substring(0, 300) + '...\n');

  const client = new GeminiImageClient();
  console.log('Gemini 이미지 생성 중...');

  const image = await client.generateImage({
    prompt,
    style: 'cover_photo',
    aspectRatio: '16:9',
    personaId: 'friendly',
  });

  const saved = await saveImage(
    image,
    'blog/static/images',
    'cover-nonsan-strawberry-family',
  );

  console.log('\n=== 생성 완료 ===');
  console.log('파일:', saved.filepath);
  console.log('Hugo 경로:', saved.relativePath);
  console.log('\nfrontmatter cover.image 값:');
  console.log(`  image: ${saved.relativePath}`);
}

main().catch(console.error);
