/**
 * 팩트체크 완료된 포스트의 이미지 재생성 스크립트
 * 수정된 내용에 맞춰 정확한 이미지를 생성합니다
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

// 각 포스트별 이미지 사양
const IMAGE_SPECS: Record<string, ImageSpec[]> = {
  'mmca-exhibition': [
    {
      filename: 'inline-mmca-exhibition-1.jpeg',
      prompt: `국립현대미술관 서울관 관람 정보 인포그래픽.
운영시간: 월화목금일 10:00-18:00, 수토 10:00-21:00(야간개장)
입장료: 통합권 10,000원, 야간 무료(수·토 18:00-21:00), 24세 미만 무료
휴관일: 매주 월요일, 1월 1일, 설/추석
위치: 서울 종로구 삼청로 30
따뜻한 색감, 친근한 손글씨 스타일, 여행 다이어리 느낌`,
      style: 'infographic'
    },
    {
      filename: 'inline-mmca-exhibition-2.jpeg',
      prompt: `국립현대미술관 서울관 관람 동선 안내도.
지하1층 + 지상3층 건물 구조
1층: 로비, 아트샵 → 2층: 전시실 → 3층: 전시실, 경복궁 마당(전망)
추천 동선: 1층→2층→3층 순서 또는 자유 관람
주요 포스트: 1층 아트샵, 3층 경복궁 마당
보물지도 여정 스타일, 귀여운 일러스트`,
      style: 'diagram'
    }
  ],
  'gyeongju-travel': [
    {
      filename: 'inline-gyeongju-travel-info.jpeg',
      prompt: `경주 1박2일 여행 교통편과 예산 정리 인포그래픽.
교통: KTX 왕복 90,000원(서울 기준), 경주역→시내 버스 50/51/700번 20-30분
숙박: 한옥스테이 70,000-150,000원/1박
식비: 50,000원/1일
입장료: 대릉원 무료(천마총 내부 3,000원), 동궁과월지 3,000원
총 예산: 약 260,000원/1인
여행 다이어리 페이지 스타일, 친근한 손글씨`,
      style: 'infographic'
    },
    {
      filename: 'inline-gyeongju-course-map.jpeg',
      prompt: `경주 도보 여행 황금 코스 지도.
동선: 황리단길 → 대릉원(도보 5분) → 동궁과월지(도보 10분)
주요 포토스팟: 대릉원 목련나무, 동궁과월지 야경, 황리단길 골목
소요시간: 약 4-5시간
보물지도 스타일, 귀여운 일러스트, 포토스팟 카메라 아이콘 표시`,
      style: 'map'
    },
    {
      filename: 'inline-gyeongju-food-guide.jpeg',
      prompt: `경주 현지인 추천 맛집 TOP 3 + 감성 카페.
맛집: 함양집(한우물회), 황남경주식당(고기정식), 가마솥족발
카페: 올리브(한옥카페), 스컹크웍스(넓은 한옥)
가격대: 1-2만원대
특징: 웨이팅 많음, 테이블링 앱 추천
카페 칠판 메뉴판 스타일, 따뜻한 색감`,
      style: 'comparison'
    }
  ],
  'haeundae-food': [
    {
      filename: 'inline-haeundae-food-map.jpeg',
      prompt: `해운대역 중심 4대 맛집 위치 지도.
해운대역 2호선 출구 기준
1. 해운대 오복돼지국밥 (구남로 15, 도보 5분)
2. 해운대 가야밀면 (좌동순환로 27, 도보 7분)
3. 해성막창집 본점 (중동1로19번길 29, 도보 10분)
4. 타이가텐푸라 (우동1로38번길, 해리단길, 도보 8분)
친구가 그려준 약도 스타일, 귀여운 일러스트`,
      style: 'map'
    },
    {
      filename: 'inline-haeundae-menu-guide.jpeg',
      prompt: `해운대 맛집 메뉴 & 가격 비교 가이드.
오복돼지국밥: 돼지국밥 9,500원, 내장국밥 9,500원
가야밀면: 물밀면 9,000원, 비빔밀면 9,500원
해성막창: 소막창 12,000원, 대창구이 12,000원
타이가텐푸라: 타이가텐동 11,000원, 에비텐동 13,000원
상황별 추천: 아침-오복국밥, 점심-가야밀면, 저녁-해성막창, 디저트-타이가
카페 칠판 메뉴판 스타일, 손글씨`,
      style: 'comparison'
    }
  ],
  'winter-travel': [
    {
      filename: 'inline-winter-destinations-map.jpeg',
      prompt: `2월 전국 5대 겨울 명소 지도.
1. 강원 평창 발왕산(눈꽃, 케이블카 25,000원)
2. 경북 울진 덕구온천(온천, 26,000-32,000원)
3. 충남 청양 칠갑산(얼음축제, 1-2월)
4. 제주 한라산 어승생악(눈꽃+동백, 무료)
5. 강원 인제 원대리(자작나무숲, 무료)
테마: 눈꽃, 온천, 얼음축제
한국 지도에 아이콘 표시, 보물지도 스타일`,
      style: 'map'
    },
    {
      filename: 'inline-winter-bucketlist.jpeg',
      prompt: `2월 겨울여행 버킷리스트 체크리스트.
☐ 발왕산 상고대 인증샷
☐ 덕구온천 노천탕에서 힐링
☐ 칠갑산 얼음분수 앞 인증샷
☐ 한라산 눈꽃+동백꽃 투샷
☐ 자작나무숲 순백 설경
완료 시: "겨울왕국 마스터" 칭호 획득!
게이미피케이션 체크리스트, 귀여운 일러스트, 스티커 느낌`,
      style: 'infographic'
    }
  ],
  'bukchon-hanok': [
    {
      filename: 'inline-bukchon-walking-map.jpeg',
      prompt: `안국역에서 삼청동까지 북촌 완벽 산책 동선.
안국역 2번 출구 → 북촌문화센터 → 북촌 8경(포토스팟) → 삼청동길
주요 포토스팟: 북촌 5경(한옥지붕 전망), 북촌 6경(서울 시내 조망)
소요시간: 2-3시간
포토스팟에 카메라 아이콘 표시
친구가 그려준 약도 스타일, 귀여운 손글씨`,
      style: 'map'
    },
    {
      filename: 'inline-bukchon-cafe-guide.jpeg',
      prompt: `북촌 맛집 & 한옥 카페 추천 가이드.
맛집:
- 북촌손만두(손만두 1-2만원, 북촌로 47)
- 삼청동 수제비(감자수제비, 삼청로 101-1)
카페:
- 온유월(쑥라떼, 인절미 빙수, 계동길 89, 한옥카페)
예산: 3-5만원/반나절
영업시간: 10:00-20:30
카페 칠판 메뉴판 스타일, 따뜻한 색감, 손글씨`,
      style: 'comparison'
    }
  ]
};

/**
 * 이미지 생성 및 저장
 */
async function generateImageForPost(spec: ImageSpec): Promise<void> {
  console.log(chalk.cyan(`\n🎨 생성 중: ${spec.filename}`));
  console.log(chalk.gray(`프롬프트: ${spec.prompt.substring(0, 100)}...`));

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
    } else {
      throw new Error('이미지 생성 실패 (null 반환)');
    }
  } catch (error) {
    console.error(chalk.red(`❌ 생성 실패: ${spec.filename}`));
    console.error(error);
    throw error;
  }
}

/**
 * 메인 실행
 */
async function main() {
  console.log(chalk.cyan.bold('\n📸 포스트 이미지 재생성 시작\n'));
  console.log(chalk.white(`총 ${Object.values(IMAGE_SPECS).flat().length}개 이미지 생성 예정\n`));

  let successCount = 0;
  let failCount = 0;

  for (const [postKey, specs] of Object.entries(IMAGE_SPECS)) {
    console.log(chalk.yellow.bold(`\n📁 ${postKey} (${specs.length}개 이미지)`));

    for (const spec of specs) {
      try {
        await generateImageForPost(spec);
        successCount++;

        // API Rate Limit 방지를 위한 대기 (5초)
        console.log(chalk.gray('⏳ 5초 대기 중...'));
        await new Promise(resolve => setTimeout(resolve, 5000));
      } catch (error) {
        failCount++;
      }
    }
  }

  console.log(chalk.cyan.bold('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.cyan.bold('📊 이미지 생성 완료 요약'));
  console.log(chalk.cyan.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
  console.log(chalk.green(`✅ 성공: ${successCount}개`));
  console.log(chalk.red(`❌ 실패: ${failCount}개`));
  console.log(chalk.white(`📁 저장 위치: blog/static/images/\n`));

  if (failCount > 0) {
    console.log(chalk.yellow('⚠️  일부 이미지 생성 실패. 재시도가 필요할 수 있습니다.\n'));
    process.exit(1);
  }

  console.log(chalk.green.bold('🎉 모든 이미지 생성 완료!\n'));
}

main().catch(error => {
  console.error(chalk.red('\n❌ 스크립트 실행 실패:'), error);
  process.exit(1);
});
