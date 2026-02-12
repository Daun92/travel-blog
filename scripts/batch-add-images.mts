/**
 * 블로그 전체 이미지 일괄 보강 스크립트
 * 19개 포스트에 ~31개 이미지를 Tier 순서로 생성하여 삽입
 */

import { config } from 'dotenv';
config();

import { readFile, writeFile } from 'fs/promises';
import { GeminiImageClient, saveImage, type ImageStyle } from '../src/images/gemini-imagen.js';

const OUTPUT_DIR = 'blog/static/images';
const POSTS_DIR = 'blog/content/posts';
const BASE_URL = '/travel-blog/images';
const DELAY_MS = 5000; // 이미지 생성 간 딜레이

interface ImageSpec {
  filename: string;
  style: ImageStyle;
  alt: string;
  prompt: string;
}

interface PostImagePlan {
  file: string;         // 포스트 파일 경로 (POSTS_DIR 기준)
  tier: 1 | 2 | 3;
  title: string;
  type: 'travel' | 'culture';
  images: ImageSpec[];
}

// ============================================================
// 전체 이미지 계획 — 31개 이미지
// ============================================================

const PLANS: PostImagePlan[] = [
  // ─── Tier 1: 0개 → 3개 (5포스트, 15이미지) ───────────────────

  {
    file: 'travel/2026-02-04-seoul-hanok-village.md',
    tier: 1,
    title: '서울 북촌 한옥마을',
    type: 'travel',
    images: [
      {
        filename: 'inline-bukchon-course-map',
        style: 'map',
        alt: '북촌 한옥마을 산책 코스 지도',
        prompt: `북촌 한옥마을 산책 코스 지도 (Hand-drawn Walking Tour Map)

[북촌 한옥마을 핵심 코스]

🚇 안국역 3번 출구 - 출발점

도보 5분 ↓
① 북촌문화센터
   "한옥 체험 & 지도 수령"

도보 3분 ↓
② 북촌 1~8경 코스
   "포토 스팟 총집합"

도보 10분 ↓
③ 가회동 골목길
   "실제 주민 거주 지역 — 조용히"

도보 7분 ↓
④ 삼청동 카페거리
   "산책 후 휴식, 전통 디저트"

[랜드마크 표시]
🏛️ 경복궁
📸 북촌 8경 포토존
🍵 삼청동 카페거리

Treasure map style, hand-drawn Korean hanok buildings, dotted walking paths, Korean labels.`
      },
      {
        filename: 'inline-bukchon-visitor-info',
        style: 'infographic',
        alt: '북촌 한옥마을 관람 정보 가이드',
        prompt: `북촌 한옥마을 관람 정보 가이드 (Travel Journal Page Style)

[알아두면 좋은 북촌 관람 Tip]

⏰ 추천 방문 시간
   오전 10시 ~ 오후 2시 (관광객 적음)
   주중 방문 강추

📍 가는 법
   지하철 3호선 안국역 3번 출구
   도보 5분

💰 비용
   한옥마을 산책: 무료
   한옥 체험: 10,000~30,000원
   북촌문화센터: 무료

⚠️ 에티켓
   - 실제 거주지 — 소음 자제
   - 10:00~17:00 탐방 시간 준수
   - 사진 촬영 시 주민 배려

🎒 준비물
   편한 운동화 (오르막 많음)
   보조 배터리 (포토존 다수)

Scrapbook style, warm cream background, stamps, hand-drawn icons.`
      },
      {
        filename: 'inline-bukchon-mood',
        style: 'moodboard',
        alt: '북촌 한옥마을 감성 무드보드',
        prompt: `북촌 한옥마을 감성 무드보드 (Destination Essence)

[서울 속 조선시대 타임슬립]

중앙: 기와지붕 한옥마을 골목 일러스트
주변 요소:
- 기와지붕 패턴 텍스처
- 한지 질감, 돌담 텍스처
- 전통 문살 무늬
- 은행나무 / 단풍나무
- 한복 입은 사람들 실루엣
- 전통 다과 (쌍화차, 한과)

컬러 팔레트:
- 한옥 갈색, 기와 회색
- 은행 노란색, 단풍 빨간색
- 하늘 파란색

감성 키워드: "고즈넉한" "시간이 멈춘" "골목 산책"

Pinterest-worthy collage, Korean aesthetic, warm nostalgic mood.`
      }
    ]
  },

  {
    file: 'culture/2026-02-05-seoul-museum.md',
    tier: 1,
    title: '서울 이색 박물관 5곳',
    type: 'culture',
    images: [
      {
        filename: 'inline-seoul-museum-info',
        style: 'infographic',
        alt: '서울 이색 박물관 5곳 요약 인포그래픽',
        prompt: `서울 이색 박물관 5곳 요약 가이드 (Art Gallery Card Style)

[서울에서 만나는 이색 박물관 TOP 5]

🏛️ 박물관별 핵심 정보

① 국립중앙박물관 — "한국 역사 종합"
   📍 이촌역 | ⏰ 10-18시 | 💰 무료

② 국립한글박물관 — "한글의 모든 것"
   📍 이촌역 | ⏰ 10-18시 | 💰 무료

③ 뮤지엄김치간 — "김치 체험"
   📍 인사동 | ⏰ 10-18시 | 💰 5,000원

④ 서울역사박물관 — "서울 타임머신"
   📍 경희궁 | ⏰ 9-18시 | 💰 무료

⑤ 떡박물관 — "전통 떡 문화"
   📍 족자동 | ⏰ 10-17시 | 💰 3,000원

Clean editorial layout, art gallery card aesthetic, Korean text clearly readable.`
      },
      {
        filename: 'inline-seoul-museum-comparison',
        style: 'comparison',
        alt: '서울 이색 박물관 비교 가이드',
        prompt: `서울 이색 박물관 5곳 비교 가이드 (Curator's Recommendation Card)

[누구와 함께? 상황별 추천]

━━━━━━━━━━━━━━━━━━━━━━
🏆 데이트 BEST
국립중앙박물관
"넓은 공간에서 여유로운 산책 데이트"
소요시간: 2~3시간

━━━━━━━━━━━━━━━━━━━━━━
👨‍👩‍👧 가족 BEST
뮤지엄김치간
"아이와 함께하는 김치 체험"
소요시간: 1~1.5시간

━━━━━━━━━━━━━━━━━━━━━━
📸 인스타 BEST
국립한글박물관
"한글 타이포그래피 포토존"
소요시간: 1~2시간

━━━━━━━━━━━━━━━━━━━━━━
🎓 교양 BEST
서울역사박물관
"서울 600년 역사 한눈에"
소요시간: 1.5~2시간

Elegant comparison cards, magazine style, Korean labels.`
      },
      {
        filename: 'inline-seoul-museum-tour-map',
        style: 'map',
        alt: '서울 박물관 투어 코스 지도',
        prompt: `서울 이색 박물관 투어 코스 지도 (Hand-drawn Tour Map)

[1일 박물관 투어 코스]

🚇 이촌역 출발

도보 5분 →
① 국립중앙박물관 (2시간)
   "오전에 방문, 여유롭게"

도보 3분 →
② 국립한글박물관 (1시간)
   "바로 옆, 동선 효율적"

🚇 이촌역 → 종로3가역

도보 10분 →
③ 뮤지엄김치간 (1시간)
   "인사동 점심 후 방문"

도보 15분 →
④ 서울역사박물관 (1.5시간)
   "경희궁 산책 겸 방문"

Treasure map style, illustrated buildings, dotted metro and walking paths.`
      }
    ]
  },

  {
    file: 'travel/2026-02-06-seoul-travel.md',
    tier: 1,
    title: '서울 여행 완벽 가이드',
    type: 'travel',
    images: [
      {
        filename: 'inline-seoul-travel-map',
        style: 'map',
        alt: '서울 핵심 관광 코스 지도',
        prompt: `서울 핵심 관광 코스 지도 (Adventure Walking Map)

[서울 3대 핵심 권역 지도]

🏛️ 종로/광화문 권역
   ① 경복궁
   ② 북촌 한옥마을
   ③ 인사동
   ④ 광장시장

🌆 강남/잠실 권역
   ⑤ 롯데월드타워
   ⑥ 코엑스
   ⑦ 봉은사

🏙️ 홍대/이태원 권역
   ⑧ 홍대거리
   ⑨ 이태원 앤틱거리
   ⑩ 남산타워

[권역 간 이동]
종로 ↔ 강남: 지하철 30분
종로 ↔ 홍대: 지하철 15분
강남 ↔ 홍대: 지하철 25분

Illustrated city map, hand-drawn landmarks, colorful area zones.`
      },
      {
        filename: 'inline-seoul-budget-info',
        style: 'infographic',
        alt: '서울 여행 예산 가이드',
        prompt: `서울 여행 예산 가이드 (Travel Journal Page Style)

[서울 여행 1일 예산 총정리]

💰 예산별 플랜

━━ 알뜰 여행 (5만원/일) ━━
🍜 식비: 20,000원
   아침 김밥 3,000원
   점심 국밥 9,000원
   저녁 치킨 8,000원
🚇 교통: 5,000원 (T-money)
🎫 관광: 무료 (경복궁, 박물관)
🏨 숙소: 25,000원 (게스트하우스)

━━ 여유 여행 (15만원/일) ━━
🍽️ 식비: 50,000원
🚕 교통: 20,000원
🎫 관광: 30,000원
🏨 숙소: 50,000원

Scrapbook layout, price tags, stamps, warm tones, Korean labels.`
      },
      {
        filename: 'inline-seoul-area-comparison',
        style: 'comparison',
        alt: '서울 지역별 특색 비교',
        prompt: `서울 지역별 특색 비교 가이드 (Menu Board Style)

[서울 5대 관광 에어리어 비교]

🏛️ 종로/광화문
   "역사와 전통"
   ⭐ 경복궁, 북촌, 인사동
   👥 가족, 외국인 관광객
   💰 가성비 ⭐⭐⭐⭐⭐

🌃 홍대/연남
   "젊음과 트렌드"
   ⭐ 카페, 클럽, 벽화거리
   👥 20~30대, 친구
   💰 가성비 ⭐⭐⭐⭐

🏙️ 강남/잠실
   "쇼핑과 엔터"
   ⭐ 코엑스, 롯데타워
   👥 커플, 쇼핑러버
   💰 가성비 ⭐⭐⭐

🏔️ 남산/명동
   "클래식 서울"
   ⭐ N서울타워, 명동성당
   👥 외국인, 처음 방문
   💰 가성비 ⭐⭐⭐

🎨 이태원/한남
   "글로벌 & 갤러리"
   ⭐ 리움미술관, 앤틱거리
   👥 감성 여행자
   💰 가성비 ⭐⭐

Playful cards, charming illustrations per area, Korean labels.`
      }
    ]
  },

  {
    file: 'culture/2026-02-09-top-5.md',
    tier: 1,
    title: '성수동 다음 문화 동네 TOP 5',
    type: 'culture',
    images: [
      {
        filename: 'inline-culture-hotspot-map',
        style: 'map',
        alt: '서울 문화 핫플 TOP 5 지도',
        prompt: `서울 문화 핫플 TOP 5 위치 지도 (Hand-drawn Cultural Map)

[성수동 다음! 문화로 뜨는 동네 5곳]

📍 서울 전체 지도에 5개 핫스팟 표시

① 신당동 (힙당동)
   🎨 전통시장 + 갤러리 결합
   "성수 초기와 똑같은 흐름"

② 서촌 (세종마을)
   🖼️ 한옥 갤러리 밀집
   "예약 필수, 인기 폭발"

③ 문래동 (문래창작촌)
   🔧 철공소 + 예술 공존
   "날것의 매력"

④ 한남동
   🏛️ 프리미엄 갤러리 거리
   "리움, 디뮤지엄"

⑤ 을지로 (을지다락)
   🏭 세운상가 재생 프로젝트
   "레트로 감성"

Metro lines connecting each spot, illustrated neighborhood vibes, Korean labels.`
      },
      {
        filename: 'inline-culture-hotspot-comparison',
        style: 'comparison',
        alt: '문화 핫플 5곳 비교 가이드',
        prompt: `성수동 다음 문화 동네 비교 (Curator's Recommendation Card)

[5곳 스타일 완전 비교]

━━━━━━━━━━━━━━━━━━━━━━
🏆 가장 핫한 곳
신당동 (힙당동)
"지금 안 가면 후회"
분위기: ★★★★★
접근성: ★★★★☆
가격대: ★★★★★ (가성비 甲)

━━━━━━━━━━━━━━━━━━━━━━
🎨 가장 예술적인 곳
문래창작촌
"인스타 감성 폭발"
분위기: ★★★★★
접근성: ★★★★☆
가격대: ★★★★☆

━━━━━━━━━━━━━━━━━━━━━━
🏛️ 가장 고급스러운 곳
한남동 갤러리 거리
"데이트 코스 원탑"
분위기: ★★★★☆
접근성: ★★★☆☆
가격대: ★★☆☆☆

Elegant cards, cultural vibe illustrations, Korean text.`
      },
      {
        filename: 'inline-culture-hotspot-mood',
        style: 'moodboard',
        alt: '서울 문화 핫플 감성 무드보드',
        prompt: `서울 문화 핫플 감성 무드보드 (Exhibition Atmosphere)

[도시 재생 × 예술 = 새로운 핫플]

중앙: 오래된 건물에 현대 미술이 결합된 장면
주변 요소:
- 철공소 + 아트 스튜디오 이미지
- 전통시장 골목 + 갤러리 간판
- 한옥 + 네온사인 대비
- 벽돌 텍스처, 콘크리트 질감
- 빈티지 간판 컬렉션

컬러 팔레트:
- 도시 회색, 벽돌 빨강
- 네온 핑크, 갤러리 화이트
- 빈티지 카키

감성 키워드: "힙하다" "발견의 즐거움" "날것의 매력"

Pinterest collage, urban art culture aesthetic, Korean mood words.`
      }
    ]
  },

  {
    file: 'culture/2026-02-09-post.md',
    tier: 1,
    title: '성수동은 왜 떴나 — 도시 재생의 인문학',
    type: 'culture',
    images: [
      {
        filename: 'inline-seongsu-diagram',
        style: 'diagram',
        alt: '성수동 도시 재생 타임라인',
        prompt: `성수동 도시 재생 타임라인 (Gallery Floor Plan Style)

[성수동 변천사 — 공장 지대에서 문화 허브로]

🏭 1960s-2000s
   구두 공장 밀집 지대
   "수제화 골목"

🔧 2010s 초
   임대료 저렴 → 예술가 유입
   소규모 카페, 작업실

☕ 2015-2018
   카페 붐, SNS 확산
   "성수동 카페 투어"

🎨 2019-2022
   팝업스토어 성지
   브랜드 × 공간 실험

🏛️ 2023-현재
   문화 허브 정착
   갤러리, 복합문화공간

Illustrated timeline, winding path, landmark sketches at each era, Korean labels.`
      },
      {
        filename: 'inline-seongsu-infographic',
        style: 'infographic',
        alt: '차세대 문화 허브 조건 분석',
        prompt: `차세대 문화 허브가 되려면? (Art Gallery Card Style)

[문화 허브 탄생의 3대 조건]

① 저렴한 임대료
   📉 평당 월세 < 3만원
   "예술가가 먼저 들어간다"
   사례: 성수동 2015, 문래동 2020

② 교통 접근성
   🚇 지하철역 도보 10분 이내
   "방문자 유입의 핵심"
   사례: 성수역, 문래역

③ 이야기가 있는 공간
   🏭 산업 유산, 한옥, 골목
   "공간 자체가 콘텐츠"
   사례: 성수 구두공장, 문래 철공소

[다음 문화 허브 후보]
🔮 고령 대가야 — 역사 자산
🔮 고창 — 자연 + 축제
🔮 부산 영도 — 산업 유산

Clean editorial layout, elegant Korean typography, analytical aesthetic.`
      }
    ]
  },

  // ─── Tier 2: 1개 → 3개 (2포스트, 4이미지) ───────────────────

  {
    file: 'culture/2026-02-08-2.md',
    tier: 2,
    title: '미술관/전시 관련 포스트',
    type: 'culture',
    images: [
      {
        filename: 'inline-2026-02-08-2-comparison',
        style: 'comparison',
        alt: '전시 관람 비교 가이드',
        prompt: `서울 전시 관람 비교 가이드 (Curator's Recommendation Card)

[서울 주요 전시 공간 비교]

━━━━━━━━━━━━━━━━━━━━━━
🏆 대규모 기획전
국립현대미술관 서울
"한국 현대미술의 중심"
규모: ★★★★★ | 접근성: ★★★★☆
가격: 무료~4,000원

━━━━━━━━━━━━━━━━━━━━━━
🎨 트렌디한 전시
성수동 팝업 갤러리
"MZ 감성 폭발"
규모: ★★★☆☆ | 접근성: ★★★★★
가격: 무료~15,000원

━━━━━━━━━━━━━━━━━━━━━━
🏛️ 프리미엄 경험
리움미술관
"세계 수준 컬렉션"
규모: ★★★★☆ | 접근성: ★★★☆☆
가격: 12,000원

Elegant comparison cards, art gallery aesthetic, Korean labels.`
      },
      {
        filename: 'inline-2026-02-08-2-mood',
        style: 'moodboard',
        alt: '미술관 감성 무드보드',
        prompt: `서울 미술관 감성 무드보드 (Exhibition Atmosphere)

[서울에서 만나는 예술의 순간들]

중앙: 갤러리 내부 일러스트 (넓은 화이트 큐브)
주변 요소:
- 액자 속 현대미술 작품 스케치
- 미술관 카페 라떼아트
- 전시 관람 티켓 스텁
- 도록과 아트 굿즈
- 갤러리 외관 스케치
- 관람객 실루엣

컬러 팔레트:
- 화이트 큐브 흰색
- 전시 조명 웜 옐로우
- 작품 액센트 컬러

감성 키워드: "영감" "여백의 미" "미적 경험"

Pinterest collage, gallery aesthetic, sophisticated mood.`
      }
    ]
  },

  {
    file: 'travel/2026-02-06-bukhansan.md',
    tier: 2,
    title: '북한산 등산',
    type: 'travel',
    images: [
      {
        filename: 'inline-bukhansan-hiking-info',
        style: 'infographic',
        alt: '북한산 등산 준비 가이드',
        prompt: `북한산 등산 준비 가이드 (Travel Journal Page Style)

[북한산 등산 완벽 준비]

👟 필수 준비물
   등산화, 스틱, 물 1L+
   간식 (에너지바, 김밥)
   방풍 자켓

⏰ 코스별 소요시간
   백운대 (정상): 3~4시간
   인수봉 조망: 2~3시간
   둘레길 (가벼운 산책): 1~2시간

📍 출발점
   북한산성입구역 (3호선)
   구파발역 (3호선)

⚠️ 주의사항
   - 주말 오전 10시 이후 주차 불가
   - 산악 사고 대비 등산 앱 필수
   - 겨울 아이젠 필수

💡 꿀팁
   "오전 7시 출발하면 주차+혼잡 해결"

Scrapbook style, hiking icons, mountain texture, Korean labels.`
      },
      {
        filename: 'inline-bukhansan-course-map',
        style: 'map',
        alt: '북한산 등산 코스 지도',
        prompt: `북한산 등산 코스 지도 (Adventure Treasure Map)

[북한산 3대 인기 코스]

🏔️ 코스 A: 백운대 정상
   북한산성입구 → 대서문 → 백운대
   거리: 5.3km | 시간: 3~4시간
   난이도: ★★★★☆
   "정상 뷰 최고!"

🌲 코스 B: 둘레길 (가벼운 산책)
   구파발역 → 북한산둘레길
   거리: 3.5km | 시간: 1~2시간
   난이도: ★★☆☆☆
   "초보자 추천"

⛰️ 코스 C: 인수봉 조망
   도선사 → 인수봉 조망대
   거리: 4km | 시간: 2~3시간
   난이도: ★★★☆☆
   "암벽 등반 포인트"

Illustrated mountain map, trail paths, altitude markers, Korean labels.`
      }
    ]
  },

  // ─── Tier 3: 2개 → 3개 (12포스트, 12이미지) ─────────────────

  {
    file: 'travel/2026-02-04-4.md',
    tier: 3,
    title: '부산 해운대 맛집',
    type: 'travel',
    images: [{
      filename: 'inline-haeundae-course-map',
      style: 'map',
      alt: '해운대 맛집 코스 지도',
      prompt: `해운대 맛집 코스 지도 (Walking Food Tour Map)

[해운대 1일 맛집 루트]

🚇 해운대역 출발
도보 5분 → ① 오복돼지국밥 (아침)
도보 10분 → ② 가야밀면 (점심)
해리단길 방면 → ③ 해리단길 카페거리 (디저트)
도보 7분 → ④ 해성막창집 (저녁)

🏖️ 해운대 해수욕장 산책 (식후)

Treasure map, food illustrations at each stop, Korean labels, dotted walking paths.`
    }]
  },

  {
    file: 'travel/2026-02-05-daegu-alley.md',
    tier: 3,
    title: '대구 근대골목',
    type: 'travel',
    images: [{
      filename: 'inline-daegu-alley-info',
      style: 'infographic',
      alt: '대구 근대골목 가이드',
      prompt: `대구 근대골목 가이드 (Travel Journal Page)

[대구 근대골목 투어 핵심 정보]

📍 위치: 중구 일대 (반월당역 기준)
⏰ 소요: 약 2~3시간
💰 비용: 무료 (가이드 투어 무료)

🏛️ 하이라이트
   ① 이상화 고택 — 시인의 집
   ② 계산성당 — 대구 최초 성당
   ③ 제일교회 — 근대 건축
   ④ 향촌문화관 — 카페거리

💡 꿀팁
   "스탬프 투어 참여하면 기념품 증정"

Scrapbook page, vintage Korean building sketches, stamp icons, warm tones.`
    }]
  },

  {
    file: 'travel/2026-02-05-gangneung-cafe.md',
    tier: 3,
    title: '강릉 카페',
    type: 'travel',
    images: [{
      filename: 'inline-gangneung-cafe-mood',
      style: 'moodboard',
      alt: '강릉 카페 감성 무드보드',
      prompt: `강릉 카페 감성 무드보드 (Destination Essence)

[강릉, 커피 도시의 영혼]

중앙: 바다가 보이는 카페 테라스 일러스트
주변 요소:
- 드리퍼로 내리는 핸드드립 커피
- 강릉 바다 파도 텍스처
- 안목해변 카페거리 스카이라인
- 커피 원두 패턴
- 서핑보드 & 해변 아이콘
- 라떼아트 클로즈업

컬러 팔레트:
- 바다 블루, 모래 베이지
- 커피 브라운, 크림 화이트

감성 키워드: "바다가 보이는 카페" "커피 향" "여유"

Pinterest collage, coastal cafe aesthetic, warm and cozy mood.`
    }]
  },

  {
    file: 'travel/2026-02-05-yeosu-night.md',
    tier: 3,
    title: '여수 밤바다',
    type: 'travel',
    images: [{
      filename: 'inline-yeosu-night-mood',
      style: 'moodboard',
      alt: '여수 밤바다 감성 무드보드',
      prompt: `여수 밤바다 감성 무드보드 (Destination Essence)

[여수, 밤바다의 감성]

중앙: 여수 밤바다 야경 일러스트 (돌산대교 조명)
주변 요소:
- 해상 케이블카 야경
- 낭만포차거리 불빛
- 갓김치 & 게장 일러스트
- 바다 위 달빛 반사
- 어선 불빛 점점이
- 해풍에 흔들리는 야자수

컬러 팔레트:
- 밤하늘 남색, 바다 검푸름
- 조명 따뜻한 오렌지
- 달빛 은색

감성 키워드: "밤바다" "낭만" "여수의 밤"

Pinterest collage, night sea aesthetic, romantic warm lights.`
    }]
  },

  {
    file: 'travel/2026-02-04-2-5.md',
    tier: 3,
    title: '겨울 여행지 TOP 5',
    type: 'travel',
    images: [{
      filename: 'inline-winter-5-comparison',
      style: 'comparison',
      alt: '겨울 여행지 5곳 비교',
      prompt: `겨울 여행지 5곳 비교 (Menu Board Style)

[2월 겨울여행 5곳 핵심 비교]

❄️ 강릉 — 겨울 바다 + 커피
   👥 커플 | 💰 ₩15~20만 | ⏰ 1박2일
   ⭐⭐⭐⭐⭐

🏔️ 태백 — 눈꽃 축제
   👥 가족 | 💰 ₩10~15만 | ⏰ 1박2일
   ⭐⭐⭐⭐☆

♨️ 아산 — 온천 힐링
   👥 부모님 | 💰 ₩8~12만 | ⏰ 당일
   ⭐⭐⭐⭐☆

🌊 여수 — 밤바다 낭만
   👥 커플 | 💰 ₩20~25만 | ⏰ 1박2일
   ⭐⭐⭐⭐⭐

🏛️ 전주 — 한옥마을 겨울
   👥 친구 | 💰 ₩10~15만 | ⏰ 1박2일
   ⭐⭐⭐⭐☆

Playful cards, seasonal snowflake decorations, Korean labels.`
    }]
  },

  {
    file: 'travel/2026-02-05-7.md',
    tier: 3,
    title: '제주 카페',
    type: 'travel',
    images: [{
      filename: 'inline-jeju-cafe-mood',
      style: 'moodboard',
      alt: '제주 카페 감성 무드보드',
      prompt: `제주 카페 감성 무드보드 (Destination Essence)

[제주, 자연 속 카페 천국]

중앙: 제주 오름 뷰 카페 테라스 일러스트
주변 요소:
- 감귤밭 텍스처
- 현무암 돌담 패턴
- 제주 오름 실루엣
- 당근 케이크 & 감귤 에이드
- 바람에 흔들리는 억새
- 해녀 캐릭터 아이콘

컬러 팔레트:
- 감귤 오렌지, 오름 그린
- 현무암 다크그레이, 바다 블루

감성 키워드: "자연 속 쉼표" "제주 감성" "힐링"

Pinterest collage, Jeju nature aesthetic, citrus and volcanic stone textures.`
    }]
  },

  {
    file: 'travel/2026-02-05-jeonju-hanok.md',
    tier: 3,
    title: '전주 한옥마을',
    type: 'travel',
    images: [{
      filename: 'inline-jeonju-food-comparison',
      style: 'comparison',
      alt: '전주 한옥마을 먹거리 비교',
      prompt: `전주 한옥마을 먹거리 비교 (Cafe Menu Board)

[전주 한옥마을 필수 먹거리 TOP 5]

🥇 전주 비빔밥 (가족회관)
   "원조 비빔밥의 성지"
   💰 12,000원 | ⏰ 대기 30분+
   ⭐⭐⭐⭐⭐

🥈 콩나물국밥 (현대옥)
   "해장 성지, 24시간"
   💰 8,000원 | ⏰ 대기 없음
   ⭐⭐⭐⭐⭐

🥉 초코파이 (PNB)
   "전주판 마카롱"
   💰 2,000원/개 | ⏰ 대기 20분
   ⭐⭐⭐⭐☆

④ 한옥마을 족발
   "콜라겐 폭탄"
   💰 35,000원 | ⏰ 대기 10분
   ⭐⭐⭐⭐☆

⑤ 막걸리+전
   "한옥에서 한 잔"
   💰 15,000원 | ⏰ 대기 없음
   ⭐⭐⭐⭐⭐

Chalkboard menu style, food illustrations, Korean labels, charming icons.`
    }]
  },

  {
    file: 'culture/2026-02-08-indie-venue.md',
    tier: 3,
    title: '인디 공연장',
    type: 'culture',
    images: [{
      filename: 'inline-indie-venue-comparison',
      style: 'comparison',
      alt: '인디 공연장 비교 가이드',
      prompt: `서울 인디 공연장 비교 (Curator's Recommendation Card)

[서울 인디 공연장 핵심 비교]

🎸 롤링홀
   📍 홍대 | 💰 20,000~30,000원
   "인디 씬의 성지"
   규모: 200석 | 음향: ★★★★★

🎤 벨로주
   📍 홍대 | 💰 10,000~20,000원
   "재즈/어쿠스틱 특화"
   규모: 50석 | 음향: ★★★★☆

🎹 무대륙
   📍 합정 | 💰 15,000~25,000원
   "실험 음악의 전초기지"
   규모: 100석 | 음향: ★★★★☆

🎶 클럽 빵
   📍 이태원 | 💰 15,000~25,000원
   "다양한 장르 라인업"
   규모: 150석 | 음향: ★★★★☆

Elegant cards, music venue sketches, neon accents, Korean labels.`
    }]
  },

  {
    file: 'culture/2026-02-08-craft-experience.md',
    tier: 3,
    title: '공예 체험',
    type: 'culture',
    images: [{
      filename: 'inline-craft-experience-mood',
      style: 'moodboard',
      alt: '공예 체험 감성 무드보드',
      prompt: `공예 체험 감성 무드보드 (Exhibition Atmosphere)

[손끝으로 만나는 한국 전통]

중앙: 도자기 물레 돌리는 손 일러스트
주변 요소:
- 다양한 도자기 작품들
- 한지 공예 패턴
- 옻칠 텍스처
- 매듭 공예 샘플
- 목공 도구 스케치
- 천연 염색 색상표

컬러 팔레트:
- 도자기 아이보리, 옻칠 적갈색
- 한지 크림, 천연 염색 남색

감성 키워드: "장인의 손길" "나만의 작품" "전통과 현대"

Pinterest collage, artisan craft aesthetic, natural material textures.`
    }]
  },

  {
    file: 'culture/2026-02-07-7.md',
    tier: 3,
    title: '독립서점',
    type: 'culture',
    images: [{
      filename: 'inline-bookstore-tour-map',
      style: 'map',
      alt: '서울 독립서점 투어 코스 지도',
      prompt: `서울 독립서점 투어 코스 지도 (Hand-drawn Walking Tour Map)

[서울 독립서점 1일 코스]

📚 코스: 합정 → 연남 → 홍대 → 서촌

🚇 합정역 출발
도보 5분 → ① 땡스북스
   "독립 출판물 큐레이션"

도보 15분 → ② 스토리지북앤필름
   "영화 + 책 복합 공간"

도보 10분 → ③ 유어마인드
   "아트북 & 진 전문"

🚇 경복궁역으로 이동
도보 7분 → ④ 더북소사이어티
   "서촌 한옥 서점"

Illustrated bookshop facades, dotted walking paths, book icons at each stop.`
    }]
  },

  {
    file: 'culture/2026-02-04-mmca-exhibition.md',
    tier: 3,
    title: '국립현대미술관 기획전',
    type: 'culture',
    images: [{
      filename: 'inline-mmca-exhibition-diagram',
      style: 'diagram',
      alt: '국립현대미술관 관람 동선',
      prompt: `국립현대미술관 추천 관람 동선 (Gallery Floor Plan)

[효율적 관람을 위한 큐레이터 추천 동선]

🏛️ 국립현대미술관 서울관

5F 옥상정원 (시작!) ↓
   📸 경복궁 뷰 포토존
   ⏰ 10분

4F 기획전시실 ↓
   🎨 메인 기획전
   ⏰ 40분
   "이번 시즌 하이라이트"

3F 상설전시 ↓
   🖼️ 한국 근현대미술
   ⏰ 30분

2F 특별전 ↓
   ✨ 주제 기획전
   ⏰ 30분

1F 아트샵 & 카페 (마무리)
   🛍️ 기념품 + 커피 한 잔
   ⏰ 20분

총 소요: 약 2~2.5시간

Elegant gallery floor plan, artwork previews, viewing path arrows, Korean labels.`
    }]
  },

  {
    file: 'travel/2026-02-08-top-5.md',
    tier: 3,
    title: '속초 양양 겨울 바다 핫플 TOP 5',
    type: 'travel',
    images: [{
      filename: 'inline-sokcho-yangyang-comparison',
      style: 'comparison',
      alt: '속초 양양 핫플 5곳 비교',
      prompt: `속초 양양 겨울 바다 핫플 5곳 비교 (Menu Board Style)

[카페 말고 진짜 핫플 TOP 5]

🏔️ 1위: 설악산 국립공원
   "65년 만에 개방된 비경"
   난이도: ★★★☆☆ | 소요: 반나절
   "겨울 설경 최고봉"

🌊 2위: 서피비치
   "겨울 서핑의 성지"
   난이도: ★★☆☆☆ | 소요: 2~3시간
   "초보자도 가능"

🏛️ 3위: 속초 중앙시장
   "닭강정 원조"
   난이도: ★☆☆☆☆ | 소요: 1~2시간
   "먹방 천국"

🚠 4위: 속초 해상케이블카
   "바다 위 10분 비행"
   난이도: ★☆☆☆☆ | 소요: 1시간
   "포토존 최고"

🎣 5위: 양양 낙산사
   "동해 일출 명소"
   난이도: ★★☆☆☆ | 소요: 1~2시간
   "겨울 고즈넉한 사찰"

Playful comparison cards, winter beach illustrations, Korean labels.`
    }]
  }
];

// ============================================================
// 마크다운 이미지 삽입 로직
// ============================================================

/**
 * 포스트에 이미지 마크다운 삽입
 * - 기존 이미지가 있으면 마지막 이미지 뒤에 삽입
 * - 없으면 --- (섹션 구분선) 기준으로 분산 삽입
 */
function insertImagesIntoPost(content: string, images: Array<{ alt: string; path: string }>): string {
  const lines = content.split('\n');

  // frontmatter 끝 위치 찾기
  let frontmatterEnd = -1;
  let dashCount = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      dashCount++;
      if (dashCount === 2) {
        frontmatterEnd = i;
        break;
      }
    }
  }

  if (frontmatterEnd === -1) return content;

  const bodyLines = lines.slice(frontmatterEnd + 1);

  // 기존 인라인 이미지 위치 찾기
  const existingImageIndices: number[] = [];
  bodyLines.forEach((line, i) => {
    if (/^!\[.*\]\(\/travel-blog\/images\/inline-/.test(line)) {
      existingImageIndices.push(i);
    }
  });

  // --- 섹션 구분선 위치 찾기 (본문 내)
  const sectionBreaks: number[] = [];
  bodyLines.forEach((line, i) => {
    if (line.trim() === '---') {
      sectionBreaks.push(i);
    }
  });

  // ## 헤딩 위치도 후보로 사용
  const headings: number[] = [];
  bodyLines.forEach((line, i) => {
    if (/^##\s/.test(line)) {
      headings.push(i);
    }
  });

  // 삽입 위치 결정 — 본문 중간에 고르게 분산
  const insertPositions: number[] = [];
  const totalBodyLines = bodyLines.length;

  if (images.length === 1) {
    // 1개: 본문 중간(60% 지점)
    const pos = Math.floor(totalBodyLines * 0.6);
    insertPositions.push(findNearestParagraphBreak(bodyLines, pos));
  } else if (images.length === 2) {
    // 2개: 40%, 75% 지점
    insertPositions.push(findNearestParagraphBreak(bodyLines, Math.floor(totalBodyLines * 0.4)));
    insertPositions.push(findNearestParagraphBreak(bodyLines, Math.floor(totalBodyLines * 0.75)));
  } else {
    // 3개: 30%, 55%, 80% 지점
    insertPositions.push(findNearestParagraphBreak(bodyLines, Math.floor(totalBodyLines * 0.3)));
    insertPositions.push(findNearestParagraphBreak(bodyLines, Math.floor(totalBodyLines * 0.55)));
    insertPositions.push(findNearestParagraphBreak(bodyLines, Math.floor(totalBodyLines * 0.8)));
  }

  // 중복 제거 및 정렬
  const uniquePositions = [...new Set(insertPositions)].sort((a, b) => a - b);

  // 뒤에서부터 삽입 (인덱스 밀림 방지)
  const resultLines = [...bodyLines];
  for (let i = Math.min(uniquePositions.length, images.length) - 1; i >= 0; i--) {
    const pos = uniquePositions[i];
    const img = images[i];
    const imgLine = `\n![${img.alt}](${img.path})\n`;
    resultLines.splice(pos, 0, imgLine);
  }

  return [...lines.slice(0, frontmatterEnd + 1), ...resultLines].join('\n');
}

/**
 * 가장 가까운 빈 줄(단락 경계) 찾기
 */
function findNearestParagraphBreak(lines: string[], target: number): number {
  // 타겟 주변 ±15줄 내에서 빈 줄 찾기
  for (let offset = 0; offset <= 15; offset++) {
    const after = target + offset;
    const before = target - offset;

    if (after < lines.length && lines[after].trim() === '') return after;
    if (before > 0 && lines[before].trim() === '') return before;
  }
  return target;
}

// ============================================================
// 메인 실행
// ============================================================

async function main() {
  const client = new GeminiImageClient();

  // 상태 확인
  console.log('═══════════════════════════════════════');
  console.log('  블로그 전체 이미지 일괄 보강 스크립트');
  console.log('═══════════════════════════════════════');
  console.log(`Gemini API: ${client.isConfigured() ? '✓ 설정됨' : '✗ 키 없음'}`);
  console.log(`이미지 생성: ${client.isEnabled() ? '✓ 활성화' : '✗ 비활성화'}`);

  if (!client.isConfigured() || !client.isEnabled()) {
    console.error('GEMINI_API_KEY와 GEMINI_IMAGE_ENABLED=true 설정이 필요합니다.');
    process.exit(1);
  }

  const usage = await client.getDailyUsage();
  // CLI 인자 파싱 (usage check 전에 필요)
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const tierArg = args.find(a => a.startsWith('--tier'));
  const tierIdx = args.indexOf('--tier');
  const targetTier = tierArg
    ? parseInt(tierArg.includes('=') ? tierArg.split('=')[1] : args[tierIdx + 1])
    : null;

  const filteredPlans = targetTier ? PLANS.filter(p => p.tier === targetTier) : PLANS;
  const totalImages = filteredPlans.reduce((sum, p) => sum + p.images.length, 0);
  console.log(`일일 사용량: ${usage}/50`);
  console.log(`생성 예정: ${totalImages}개 이미지 (${filteredPlans.length}개 포스트)${targetTier ? ` [Tier ${targetTier}]` : ''}`);

  const usageCheck = await client.checkUsageLimit(totalImages);
  if (!usageCheck.allowed) {
    console.error(`일일 한도 초과: ${usageCheck.warning}`);
    process.exit(1);
  }
  if (usageCheck.warning) {
    console.warn(`⚠️ ${usageCheck.warning}`);
  }

  console.log('\n시작합니다...\n');

  let generated = 0;
  let failed = 0;

  for (const plan of filteredPlans) {

    console.log(`\n${'─'.repeat(50)}`);
    console.log(`📄 [Tier ${plan.tier}] ${plan.title}`);
    console.log(`   ${plan.file} (${plan.images.length}개 이미지)`);

    if (dryRun) {
      for (const img of plan.images) {
        console.log(`   📷 [DRY] ${img.style}: ${img.alt}`);
        console.log(`      → ${BASE_URL}/${img.filename}.jpeg`);
      }
      generated += plan.images.length;
      continue;
    }

    // 이미지 생성
    const savedImages: Array<{ alt: string; path: string }> = [];

    for (let i = 0; i < plan.images.length; i++) {
      const img = plan.images[i];
      const progress = `[${i + 1}/${plan.images.length}]`;

      console.log(`   ${progress} ${img.style}: ${img.alt}...`);

      try {
        const result = await client.generateImage({
          prompt: img.prompt,
          style: img.style,
          aspectRatio: '16:9',
          topic: plan.title
        });

        const saved = await saveImage(result, OUTPUT_DIR, img.filename);
        console.log(`   ✓ 저장: ${saved.relativePath}`);

        savedImages.push({ alt: img.alt, path: saved.relativePath });
        generated++;

        // 다음 이미지 전 딜레이
        if (i < plan.images.length - 1) {
          console.log(`   ⏳ ${DELAY_MS / 1000}초 대기...`);
          await new Promise(resolve => setTimeout(resolve, DELAY_MS));
        }
      } catch (err: any) {
        console.error(`   ✗ 실패: ${err.message}`);
        failed++;
      }
    }

    // 포스트에 이미지 삽입
    if (savedImages.length > 0) {
      const postPath = `${POSTS_DIR}/${plan.file}`;
      try {
        const content = await readFile(postPath, 'utf-8');
        const updated = insertImagesIntoPost(content, savedImages);
        await writeFile(postPath, updated, 'utf-8');
        console.log(`   📝 포스트 업데이트: ${savedImages.length}개 이미지 삽입됨`);
      } catch (err: any) {
        console.error(`   ✗ 포스트 업데이트 실패: ${err.message}`);
      }
    }

    // 포스트 간 딜레이
    if (plan !== filteredPlans[filteredPlans.length - 1]) {
      console.log(`   ⏳ 다음 포스트까지 ${DELAY_MS / 1000}초 대기...`);
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }
  }

  // 결과 요약
  console.log(`\n${'═'.repeat(50)}`);
  console.log('  결과 요약');
  console.log(`${'═'.repeat(50)}`);
  console.log(`  ✓ 생성: ${generated}개`);
  console.log(`  ✗ 실패: ${failed}개`);
  console.log(`  ⊘ 스킵: ${PLANS.reduce((s, p) => s + p.images.length, 0) - generated - failed}개`);
  console.log(`  일일 사용량: ${await client.getDailyUsage()}/50`);
  console.log(`${'═'.repeat(50)}\n`);
}

main().catch(err => {
  console.error('치명적 오류:', err);
  process.exit(1);
});
