/**
 * 경주 여행 포스트 이미지 재생성
 * 실제 블로그 품질의 구체적인 내용으로 이미지 생성
 */

import { config } from 'dotenv';
config();

import { GeminiImageClient, saveImage, ImageStyle } from '../src/images/gemini-imagen.js';

const OUTPUT_DIR = 'blog/static/images';

// 경주 여행 이미지 정의 - 구체적이고 매력적인 내용
const GYEONGJU_IMAGES = [
  {
    filename: 'inline-gyeongju-travel-info',
    style: 'infographic' as ImageStyle,
    prompt: `경주 1박2일 여행 필수 정보 (Korean Travel Journal Page)

[교통편]
• 서울→경주 KTX: 2시간, 편도 45,000원
• 경주역→시내: 버스 50번/700번 20분
• 버스터미널→황리단길: 도보 10분

[1박2일 예산 가이드]
교통비: 90,000원 (KTX 왕복)
숙박: 80,000원 (한옥스테이)
식비: 60,000원 (2일)
입장료: 10,000원
카페/간식: 20,000원
━━━━━━━━━━━━
총 예상: 약 26만원

[꿀팁 스탬프]
🎫 "통합권으로 절약!" - 대릉원+동궁월지 할인
🚲 "타실라 공영자전거 무료"
📱 "테이블링 앱 필수"

Hand-drawn travel journal aesthetic, watercolor stamps, ticket stubs collage feel.`
  },
  {
    filename: 'inline-gyeongju-course-map',
    style: 'map' as ImageStyle,
    prompt: `경주 황금 코스 일러스트 지도 (Hand-drawn Treasure Map)

[1일차 루트] 도보 여행 코스
① 경주역/버스터미널 출발
   ↓ (버스 20분 또는 택시 15분)
② 황리단길 도착 ⭐
   - 십원빵 (줄 서서라도 먹어야 해!)
   - 황남옥수수
   - 감성 카페 투어
   ↓ (도보 5분)
③ 대릉원 & 천마총
   - 고분 산책로
   - 목련나무 포토존 📸
   ↓ (도보 10분)
④ 동궁과 월지 (야경 명소)
   - 일몰 30분 전 도착 추천!
   - 연못에 비친 궁궐 ✨

[포토스팟 마크]
📸 대릉원 목련나무 - 봄 인생샷
📸 동궁과월지 야경 - 매직아워
📸 황리단길 골목 - 감성샷

Treasure map style, illustrated landmarks, winding path, Korean hand-written labels.`
  },
  {
    filename: 'inline-gyeongju-food-guide',
    style: 'comparison' as ImageStyle,
    prompt: `경주 맛집 비교 가이드 (Cafe Chalkboard Menu Style)

[추천 맛집 TOP 3]

🥇 함양집 - 한우물회 전문
   메뉴: 한우물회 15,000원
   특징: 새콤달콤 시원한 국물!
   팁: 웨이팅 30분+ → 테이블링 필수
   추천: ⭐⭐⭐⭐⭐ "경주 필수 코스"

🥈 황남경주식당 - 고기정식
   메뉴: 불고기정식 25,000원
   특징: 한옥에서 즐기는 정갈한 상차림
   팁: 부모님 모시기 딱!
   추천: ⭐⭐⭐⭐⭐ "분위기 맛집"

🥉 가마솥족발
   메뉴: 족발(중) 28,000원
   특징: 야들야들 현지인 맛집
   팁: 늦은 밤까지 영업
   추천: ⭐⭐⭐⭐ "로컬 찐맛집"

[카페 추천]
☕ 올리브: 마당 넓은 한옥 카페, 사진 맛집
☕ 스컹크웍스: 대형 한옥, 베이커리 굿

Warm cafe menu board aesthetic, appetizing illustrations, friendly Korean typography.`
  }
];

async function main() {
  console.log('🎨 경주 여행 포스트 이미지 재생성\n');

  const client = new GeminiImageClient();

  // 상태 확인
  if (!client.isConfigured()) {
    console.error('❌ GEMINI_API_KEY가 설정되지 않았습니다.');
    process.exit(1);
  }

  if (!client.isEnabled()) {
    console.error('❌ GEMINI_IMAGE_ENABLED=true로 설정해주세요.');
    process.exit(1);
  }

  const usage = await client.checkUsageLimit(3);
  console.log(`📊 API 사용량: ${usage.current}/${usage.limit}`);

  if (!usage.allowed) {
    console.error(`❌ ${usage.warning}`);
    process.exit(1);
  }

  console.log('\n생성할 이미지:');
  GYEONGJU_IMAGES.forEach((img, i) => {
    console.log(`  ${i + 1}. ${img.filename} (${img.style})`);
  });

  console.log('\n이미지 생성 중...\n');

  const results: string[] = [];

  for (const imageConfig of GYEONGJU_IMAGES) {
    console.log(`🖼️  ${imageConfig.filename} 생성 중...`);

    try {
      const image = await client.generateImage({
        prompt: imageConfig.prompt,
        style: imageConfig.style,
        aspectRatio: '16:9'
      });

      const saved = await saveImage(image, OUTPUT_DIR, imageConfig.filename);
      console.log(`   ✅ 저장: ${saved.filepath}`);
      results.push(saved.relativePath);

    } catch (error) {
      console.error(`   ❌ 실패:`, error);
    }
  }

  console.log('\n📝 마크다운 이미지 태그:\n');
  results.forEach((path, i) => {
    const alt = ['경주 여행 정보 인포그래픽', '경주 1박2일 코스 지도', '경주 맛집 비교 가이드'][i];
    console.log(`![${alt}](${path})`);
    console.log(`*AI 생성 ${['여행 가이드', '코스 지도', '맛집 가이드'][i]}*\n`);
  });

  console.log('✨ 완료! 위 태그를 포스트에 반영하세요.');
}

main().catch(console.error);
