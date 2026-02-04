/**
 * 모든 포스트 이미지 일괄 생성
 * 각 포스트의 핵심 정보를 전략적으로 시각화
 */

import { config } from 'dotenv';
config();

import { GeminiImageClient, saveImage, ImageStyle } from '../src/images/gemini-imagen.js';

const OUTPUT_DIR = 'blog/static/images';

interface ImageConfig {
  filename: string;
  style: ImageStyle;
  prompt: string;
  post: string;
}

// ============================================
// 해운대 맛집 포스트 이미지
// ============================================
const HAEUNDAE_IMAGES: ImageConfig[] = [
  {
    post: '해운대 맛집',
    filename: 'inline-haeundae-food-map',
    style: 'map',
    prompt: `해운대 맛집 위치 지도 (Hand-drawn Food Tour Map)

[해운대역 중심 맛집 투어 지도]

🚇 해운대역 (2호선) - 출발점

도보 5분 ↓
① 오복돼지국밥 ⭐⭐⭐⭐⭐
   "아침 8시 오픈, 해장 성지"

도보 10분 ↓
② 가야밀면 ⭐⭐⭐⭐⭐
   "60시간 숙성 육수의 전설"

도보 7분 ↓
③ 해성막창집 ⭐⭐⭐⭐⭐
   "줄 서서 먹는 막창 성지"

해리단길 방면 →
④ 타이가텐푸라 ⭐⭐⭐⭐
   "후쿠오카 스타일 텐동"

[랜드마크 표시]
🏖️ 해운대 해수욕장
🏢 마린시티
🛒 해운대 전통시장

Treasure map style, hand-drawn buildings, dotted walking paths, Korean labels.`
  },
  {
    post: '해운대 맛집',
    filename: 'inline-haeundae-menu-guide',
    style: 'comparison',
    prompt: `해운대 맛집 메뉴 & 가격 가이드 (Cafe Menu Board Style)

[해운대 4대 맛집 완벽 비교]

━━━━━━━━━━━━━━━━━━━━━━

🥇 오복돼지국밥 | 아침식사 추천
   ├ 돼지국밥: 10,000원
   ├ 내장국밥: 10,000원
   └ 수육(맛보기): 13,000원
   💡 "잡내 없는 뽀얀 사골육수"
   ⏰ 08:00 오픈

━━━━━━━━━━━━━━━━━━━━━━

🥈 가야밀면 | 점심 추천
   ├ 물밀면: 9,000원
   ├ 비빔밀면: 9,500원
   └ 만두: 6,000원
   💡 "비빔밀면 + 온육수 조합 강추"
   🏆 현지인 사랑

━━━━━━━━━━━━━━━━━━━━━━

🥉 해성막창집 | 저녁/술자리
   ├ 소막창(180g): 12,000원
   ├ 대창구이(250g): 12,000원
   └ 곱창전골: 11,000원
   💡 "볶음밥 마무리 필수!"
   ⚠️ 웨이팅 30분+

━━━━━━━━━━━━━━━━━━━━━━

🎖️ 타이가텐푸라 | 데이트코스
   ├ 타이가텐동: 11,000원
   ├ 에비텐동: 13,000원
   └ 아나고텐동: 16,000원
   💡 "바삭함의 정석"
   📸 인스타 감성

Warm chalkboard menu aesthetic, appetizing layout, price tags, recommendation badges.`
  }
];

// ============================================
// 겨울 국내여행 포스트 이미지
// ============================================
const WINTER_TRAVEL_IMAGES: ImageConfig[] = [
  {
    post: '겨울 국내여행',
    filename: 'inline-winter-destinations-map',
    style: 'map',
    prompt: `2월 겨울여행 베스트 5 전국 지도 (Illustrated Korea Map)

[대한민국 겨울 여행 지도]

━━━ 강원도 ━━━
① 평창 발왕산 ❄️
   "눈꽃 터널 & 스카이워크"
   케이블카 25,000원

⑤ 인제 자작나무숲 🌲
   "순백의 숲속 힐링"
   입장료 무료

━━━ 경상도 ━━━
② 울진 덕구온천 ♨️
   "자연용출 노천탕"
   스파 20,000원~
   + 대게 맛집 근처!

━━━ 충청도 ━━━
③ 청양 알프스마을 🧊
   "거대 얼음분수 축제"
   입장권 9,000원
   아이들 최고!

━━━ 제주도 ━━━
④ 한라산 어승생악 🏔️
   "1시간 눈꽃 트레킹"
   + 동백꽃 콜라보

[아이콘 범례]
❄️ 눈꽃 명소
♨️ 온천
🧊 얼음 축제
🌲 자연 힐링

Hand-drawn Korea map, illustrated landmarks, warm watercolor style, travel journal aesthetic.`
  },
  {
    post: '겨울 국내여행',
    filename: 'inline-winter-bucketlist',
    style: 'bucketlist',
    prompt: `2월 겨울여행 버킷리스트 (Achievement Checklist)

[🏔️ 2월 겨울여행 버킷리스트]

□ 평창 발왕산 눈꽃 터널 걷기
  └ 🎿 난이도: ★☆☆ | 💰 25,000원
  └ 📸 상고대 인생샷 GET!

□ 덕구온천 노천탕에서 별 보기
  └ ♨️ 난이도: ★☆☆ | 💰 35,000원
  └ 🦀 울진 대게 보너스!

□ 청양 얼음분수 앞 인증샷
  └ 🧊 난이도: ★☆☆ | 💰 9,000원
  └ 👨‍👩‍👧 가족여행 추천

□ 한라산 어승생악 정복하기
  └ 🥾 난이도: ★★☆ | 💰 무료
  └ 🌺 동백꽃 + 눈 조합!

□ 자작나무숲에서 힐링 산책
  └ 🌲 난이도: ★★☆ | 💰 무료
  └ 🤫 숲의 속삭임 듣기

━━━━━━━━━━━━━━━━━━
⭐ BONUS: 전부 완료하면?
   → "겨울왕국 마스터" 칭호 획득!

Gamified checklist style, achievement badges, cute icons, printable design, Korean text.`
  }
];

// ============================================
// 북촌한옥마을 포스트 이미지
// ============================================
const BUKCHON_IMAGES: ImageConfig[] = [
  {
    post: '북촌한옥마을',
    filename: 'inline-bukchon-walking-map',
    style: 'map',
    prompt: `북촌한옥마을 산책 코스 지도 (Hand-drawn Walking Map)

[북촌 완벽 산책 코스]

🚇 안국역 2번 출구 START!

↓ 도보 5분
① 북촌문화센터
   "무료 한옥체험 가능"

↓ 골목길 10분
② 북촌 5경 📸
   "한옥 지붕 물결"
   오전 9-10시 베스트!

↓ 계단 오르기 5분
③ 북촌 6경 📸📸
   "서울 시내 + 한옥 파노라마"
   인생샷 포인트!

↓ 내리막 7분
④ 가회동 골목
   "실제 주민 거주지"
   조용히 관람해주세요 🤫

↓ 도보 10분
⑤ 삼청동길 FINISH!
   "카페 & 갤러리 천국"

[포토스팟 TIP]
📸 오전 9-10시 = 한적 + 좋은 빛
👘 한복 대여 2-3만원 = 인생샷 보장

Hand-drawn treasure map style, cute Korean hanok illustrations, dotted walking path, photo spot markers.`
  },
  {
    post: '북촌한옥마을',
    filename: 'inline-bukchon-cafe-guide',
    style: 'comparison',
    prompt: `북촌 & 삼청동 카페 맛집 가이드 (Cafe Chalkboard)

[☕ 북촌 감성 카페 & 맛집]

━━━ 맛집 추천 ━━━

🥟 북촌손만두
   위치: 북촌로 47
   추천: 손만두, 만두전골
   가격: 1-2만원
   "40년 전통, 두툼한 피!"

🍜 삼청동 수제비
   위치: 삼청로 101-1
   추천: 감자수제비, 팥칼국수
   "현지인 단골 맛집"

━━━ 카페 추천 ━━━

🏡 온유월 (한옥카페)
   위치: 계동길 89
   추천: 쑥라떼, 인절미빙수
   "한옥 개조 감성 끝판왕"
   📸 사진 맛집!

☕ 스컹크웍스
   대형 한옥 카페
   다양한 베이커리
   "넓은 마당에서 여유롭게"

━━━━━━━━━━━━━━━━
💡 예산 가이드
식사: 1-2만원 | 카페: 8천-1.5만원
반나절 코스 총 예산: 3-5만원

Warm cafe menu board style, hand-drawn food illustrations, cozy Korean aesthetic.`
  }
];

// 모든 이미지 합치기
const ALL_IMAGES = [
  ...HAEUNDAE_IMAGES,
  ...WINTER_TRAVEL_IMAGES,
  ...BUKCHON_IMAGES
];

async function main() {
  console.log('🎨 전체 포스트 이미지 일괄 생성\n');
  console.log('=' .repeat(50));

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

  const usage = await client.checkUsageLimit(ALL_IMAGES.length);
  console.log(`📊 API 사용량: ${usage.current}/${usage.limit}`);
  console.log(`📝 생성 예정: ${ALL_IMAGES.length}장\n`);

  if (!usage.allowed) {
    console.error(`❌ ${usage.warning}`);
    process.exit(1);
  }

  // 포스트별 그룹화하여 표시
  console.log('생성할 이미지 목록:');
  let currentPost = '';
  ALL_IMAGES.forEach((img, i) => {
    if (img.post !== currentPost) {
      currentPost = img.post;
      console.log(`\n📄 ${currentPost}`);
    }
    console.log(`   ${i + 1}. ${img.filename} (${img.style})`);
  });

  console.log('\n' + '='.repeat(50));
  console.log('이미지 생성 시작...\n');

  const results: Map<string, string[]> = new Map();

  for (const imageConfig of ALL_IMAGES) {
    console.log(`🖼️  [${imageConfig.post}] ${imageConfig.filename} 생성 중...`);

    try {
      const image = await client.generateImage({
        prompt: imageConfig.prompt,
        style: imageConfig.style,
        aspectRatio: '16:9'
      });

      const saved = await saveImage(image, OUTPUT_DIR, imageConfig.filename);
      console.log(`   ✅ 저장 완료`);

      // 포스트별 결과 저장
      if (!results.has(imageConfig.post)) {
        results.set(imageConfig.post, []);
      }
      results.get(imageConfig.post)!.push(saved.relativePath);

    } catch (error) {
      console.error(`   ❌ 실패:`, error instanceof Error ? error.message : error);
    }
  }

  // 결과 출력
  console.log('\n' + '='.repeat(50));
  console.log('📝 포스트별 마크다운 이미지 태그:\n');

  results.forEach((paths, postName) => {
    console.log(`\n### ${postName}\n`);
    paths.forEach(path => {
      const filename = path.split('/').pop()?.replace('.jpeg', '') || '';
      console.log(`![${filename}](${path})`);
      console.log(`*AI 생성 가이드*\n`);
    });
  });

  const finalUsage = await client.getDailyUsage();
  console.log('='.repeat(50));
  console.log(`\n✨ 완료! 총 ${ALL_IMAGES.length}장 생성`);
  console.log(`📊 최종 API 사용량: ${finalUsage}/${usage.limit}`);
}

main().catch(console.error);
