/**
 * 7개 포스트 인라인 이미지 생성 스크립트
 * 대구, 강릉, 서울 박물관, 전주, 여수, 제주, 뮤지컬
 */

import { config } from 'dotenv';
import { generateAndSaveImage } from '../src/images/gemini-imagen.js';
import chalk from 'chalk';

config();

interface ImageSpec {
  filename: string;
  prompt: string;
  style: string;
}

const IMAGE_SPECS: Record<string, ImageSpec[]> = {
  'daegu-alley': [
    {
      filename: 'inline-daegu-course-map.jpeg',
      prompt: `대구 도보 여행 코스 지도.
동선: 경대병원역 → 김광석 다시 그리기 길(도보 10분) → 대구 근대골목(도보 15분) → 서문시장(도보 20분)
주요 포토스팟: 김광석 벽화, 계산성당, 약령시 한의약박물관
소요시간: 약 4-6시간
보물지도 스타일, 귀여운 일러스트, 포토스팟 카메라 아이콘`,
      style: 'map'
    },
    {
      filename: 'inline-daegu-food-guide.jpeg',
      prompt: `서문시장 먹거리 TOP 메뉴 가이드.
1. 칼제비 - 진한 육수, 쫄깃한 면발
2. 납작만두 - 대구 명물, 바삭한 식감
3. 씨앗호떡 - 해바라기씨 가득, 달콤
가격대: 5,000-8,000원
카페 칠판 메뉴판 스타일, 손글씨, 따뜻한 색감`,
      style: 'comparison'
    }
  ],
  'gangneung-cafe': [
    {
      filename: 'inline-gangneung-cafe-map.jpeg',
      prompt: `강릉 안목해변 커피거리 카페 투어 지도.
위치: 강릉 안목해변 일대
추천 카페: 테라로사, 보헤미안, 산토리니
특징: 바다 뷰, 커피 원산지 직배송
주차: 강릉항 여객터미널 무료 주차장 추천
친구가 그려준 약도 스타일, 바다와 카페 일러스트`,
      style: 'map'
    },
    {
      filename: 'inline-gangneung-cafe-compare.jpeg',
      prompt: `강릉 바다 뷰 카페 3곳 비교 가이드.
1. 테라로사: 넓은 공간, 원두 직접 로스팅, 아메리카노 6,000원
2. 보헤미안: 커피 명가, 드립커피 추천, 7,000원대
3. 산토리니: 오션뷰 최강, 시그니처 라떼 8,000원
웨이팅: 주말 30분-1시간
칠판 메뉴판 스타일, 바다색 포인트`,
      style: 'comparison'
    }
  ],
  'seoul-museum': [
    {
      filename: 'inline-seoul-museum-map.jpeg',
      prompt: `서울 이색 박물관 5곳 위치 지도.
1. 시몬느 핸드백 박물관 (가로수길, 5,000원)
2. 뮤지엄김치간 (인사동, 20,000원)
3. 서울공예박물관 (안국동, 무료)
4. 떡박물관 (와룡동, 3,000원)
5. 쇳대박물관 (이화동, 5,000원)
서울 지하철 노선 표시, 귀여운 일러스트`,
      style: 'map'
    },
    {
      filename: 'inline-seoul-museum-compare.jpeg',
      prompt: `서울 이색 박물관 5곳 비교 가이드.
시몬느: 명품백 역사, 5,000원, 신사역
뮤지엄김치간: 김치 체험, 20,000원, 안국역
서울공예박물관: 공예품 전시, 무료, 안국역
떡박물관: 전통 떡 역사, 3,000원, 혜화역
쇳대박물관: 전통 자물쇠, 5,000원, 혜화역
데이트 추천도: ★★★★★
칠판 스타일, 박물관 아이콘`,
      style: 'comparison'
    }
  ],
  'jeonju-hanok': [
    {
      filename: 'inline-jeonju-course-map.jpeg',
      prompt: `전주 한옥마을 당일치기 코스 지도.
동선: 전주역 → 한옥마을(버스 20분) → 경기전 → 태조로 맛집골목 → 오목대 야경
주요 스팟: 전동성당, 경기전, 오목대 전망대
소요시간: 6-8시간
보물지도 스타일, 한옥 일러스트`,
      style: 'map'
    },
    {
      filename: 'inline-jeonju-food-guide.jpeg',
      prompt: `전주 한옥마을 먹거리 가이드.
비빔밥: 한국집 육회비빔밥 15,000원, 고궁 돌솥비빔밥 13,000원
길거리: 바게트 버거 5,500원, 삼겹살 김밥 5,000원(남부시장)
카페: 교동다원(한옥카페), 전망좋은카페
예산: 2-3만원/1인
칠판 메뉴판 스타일, 전통 느낌`,
      style: 'comparison'
    }
  ],
  'yeosu-night': [
    {
      filename: 'inline-yeosu-night-map.jpeg',
      prompt: `여수 밤바다 야경 명소 지도.
1. 돌산대교 야경 (낭만포차 거리)
2. 해상 케이블카 (왕복 15,000원)
3. 오동도 등대 (무료)
4. 이순신광장 (밤바다 노래비)
추천 동선: 케이블카 → 낭만포차 → 이순신광장
보물지도 스타일, 야경 느낌, 별빛 표현`,
      style: 'map'
    },
    {
      filename: 'inline-yeosu-info.jpeg',
      prompt: `여수 밤바다 여행 정보 인포그래픽.
교통: KTX 2시간 30분(용산 기준), 왕복 100,000원
숙박: 호텔 10-15만원/1박
케이블카: 일반 15,000원, 크리스탈 22,000원
낭만포차: 해산물 2-3만원/1인
총 예산: 약 35만원/1인 1박
여행 다이어리 스타일, 바다색 포인트`,
      style: 'infographic'
    }
  ],
  'jeju-cafe': [
    {
      filename: 'inline-jeju-cafe-map.jpeg',
      prompt: `제주도 감성 카페 7곳 투어 지도.
서쪽: 허니문하우스(애월), 몽상드애월
동쪽: 카페델문도, 테디베어뮤지엄카페
남쪽: 오설록티뮤지엄
제주도 지도에 카페 위치 표시
렌터카 필수, 일정: 2박3일 추천
보물지도 스타일, 제주 감성 일러스트`,
      style: 'map'
    },
    {
      filename: 'inline-jeju-cafe-compare.jpeg',
      prompt: `제주 오션뷰 카페 베스트 3 비교.
1. 허니문하우스: 탁트인 바다뷰, 산책로, 아메리카노 7,000원
2. 몽상드애월: 지중해 감성, 일몰 명소, 시그니처 8,000원
3. 카페델문도: 성산일출봉 뷰, 테라스, 7,500원
웨이팅: 주말 1-2시간
방문 팁: 오전 11시 전 오픈런 추천
칠판 스타일, 바다색 톤`,
      style: 'comparison'
    }
  ],
  'musical-2026': [
    {
      filename: 'inline-musical-guide.jpeg',
      prompt: `2026 봄 뮤지컬 BEST 5 비교 가이드.
1. 오페라의 유령: 샹들리에 명장면, VIP 18만원
2. 레미제라블: 3시간 대서사시, R석 15만원
3. 하데스타운: 재즈+신화, R석 14만원
4. 물랑루즈!: 화려한 무대, VIP 19만원
5. 웃는 남자: 감동 서사, R석 14만원
공연장: 블루스퀘어, 예술의전당
칠판 스타일, 무대 조명 느낌`,
      style: 'comparison'
    },
    {
      filename: 'inline-musical-venue-map.jpeg',
      prompt: `서울 주요 뮤지컬 공연장 지도.
1. 블루스퀘어 신한카드홀 (한남동, 6호선 한강진역)
2. 예술의전당 오페라극장 (서초동, 3호선 남부터미널역)
3. 샤롯데씨어터 (잠실, 2호선 잠실역)
4. LG아트센터 서울 (마곡, 9호선 마곡나루역)
지하철 노선 표시, 공연장 아이콘
친구가 그려준 약도 스타일`,
      style: 'map'
    }
  ]
};

async function generateImageForPost(spec: ImageSpec): Promise<boolean> {
  console.log(chalk.cyan(`\n🎨 생성 중: ${spec.filename}`));
  console.log(chalk.gray(`프롬프트: ${spec.prompt.substring(0, 80)}...`));

  try {
    const result = await generateAndSaveImage(
      {
        prompt: spec.prompt,
        style: spec.style as any,
        aspectRatio: '16:9',
        locale: 'ko-KR'
      },
      'blog/static/images',
      spec.filename
    );

    if (result) {
      console.log(chalk.green(`✅ 저장 완료: ${result.filepath}`));
      return true;
    } else {
      throw new Error('이미지 생성 실패');
    }
  } catch (error) {
    console.error(chalk.red(`❌ 생성 실패: ${spec.filename}`));
    console.error(error);
    return false;
  }
}

async function main() {
  console.log(chalk.cyan.bold('\n📸 7개 포스트 이미지 생성 시작\n'));

  const totalImages = Object.values(IMAGE_SPECS).flat().length;
  console.log(chalk.white(`총 ${totalImages}개 이미지 생성 예정\n`));

  let successCount = 0;
  let failCount = 0;

  for (const [postKey, specs] of Object.entries(IMAGE_SPECS)) {
    console.log(chalk.yellow.bold(`\n📁 ${postKey} (${specs.length}개)`));

    for (const spec of specs) {
      const success = await generateImageForPost(spec);
      if (success) {
        successCount++;
      } else {
        failCount++;
      }

      // Rate limit 방지 (5초 대기)
      if (successCount + failCount < totalImages) {
        console.log(chalk.gray('⏳ 5초 대기...'));
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  console.log(chalk.cyan.bold('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.cyan.bold('📊 이미지 생성 결과'));
  console.log(chalk.cyan.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
  console.log(chalk.green(`✅ 성공: ${successCount}개`));
  console.log(chalk.red(`❌ 실패: ${failCount}개`));
  console.log(chalk.white(`📁 저장: blog/static/images/\n`));

  if (failCount > 0) {
    process.exit(1);
  }

  console.log(chalk.green.bold('🎉 완료!\n'));
}

main().catch(error => {
  console.error(chalk.red('\n❌ 실행 실패:'), error);
  process.exit(1);
});
