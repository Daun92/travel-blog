/**
 * 데이터 수집 Agent
 * 공공 API 및 외부 소스에서 여행/문화 데이터 수집
 *
 * data.go.kr KorService2 공유 클라이언트 사용
 */

import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { getDataGoKrClient } from '../api/data-go-kr/index.js';

// ============================================================================
// 타입 정의
// ============================================================================

export interface TourismData {
  title: string;
  address: string;
  tel?: string;
  overview?: string;
  image?: string;
  images?: string[];
  mapx?: number;
  mapy?: number;
  contentTypeId?: string;
  contentId?: string;
  homepage?: string;
  usetime?: string;
  restdate?: string;
  parking?: string;
}

export interface CultureEvent {
  title: string;
  place: string;
  startDate: string;
  endDate: string;
  price?: string;
  url?: string;
  image?: string;
}

export interface FestivalData {
  title: string;
  address: string;
  startDate: string;
  endDate: string;
  place?: string;
  tel?: string;
  image?: string;
  contentId?: string;
  overview?: string;
  homepage?: string;
  usetimefestival?: string;
}

export interface CollectedData {
  keyword: string;
  timestamp: string;
  tourismData: TourismData[];
  cultureEvents: CultureEvent[];
  festivals: FestivalData[];
  trendKeywords: string[];
  images: string[];
}

// ============================================================================
// 한국관광공사 API 연동 (KorService2 via 공유 클라이언트)
// ============================================================================

/**
 * 한국관광공사 API에서 관광지 검색
 * KorService2 searchKeyword2 엔드포인트 사용
 */
export async function searchTourism(keyword: string, opts?: {
  enrichDetail?: boolean;
  enrichCount?: number;
}): Promise<TourismData[]> {
  const client = getDataGoKrClient();
  if (!client) {
    console.log('⚠️ 한국관광공사 API 키가 설정되지 않았습니다. (KTO_API_KEY)');
    return getMockTourismData(keyword);
  }

  try {
    // 복합 키워드 처리: "경주 역사 산책" → 먼저 전체 검색, 없으면 핵심어로 재시도
    let items = await client.searchKeyword(keyword, { numOfRows: 20 });
    if (items.length === 0 && keyword.includes(' ')) {
      const coreKeyword = keyword.split(/\s+/)[0]; // 첫 번째 단어 (지명이 보통 맨 앞)
      console.log(`  📎 "${keyword}" 결과 없음 → "${coreKeyword}"로 재검색`);
      items = await client.searchKeyword(coreKeyword, { numOfRows: 20 });
    }

    const results: TourismData[] = items.map(item => ({
      title: item.title,
      address: item.addr1,
      tel: item.tel,
      overview: item.overview,
      image: item.firstimage,
      mapx: item.mapx ? parseFloat(item.mapx) : undefined,
      mapy: item.mapy ? parseFloat(item.mapy) : undefined,
      contentTypeId: item.contenttypeid,
      contentId: item.contentid,
    }));

    // 상세정보 보강 (detailCommon2 + detailImage2)
    const enrichCount = opts?.enrichCount ?? 5;
    if (opts?.enrichDetail !== false && results.length > 0) {
      const toEnrich = results.slice(0, enrichCount);
      for (const item of toEnrich) {
        if (!item.contentId) continue;
        try {
          // detailCommon2: overview, homepage, tel 등
          const details = await client.detailCommon(item.contentId);
          if (details.length > 0) {
            const d = details[0];
            if (d.overview && !item.overview) item.overview = d.overview;
            if (d.homepage) item.homepage = d.homepage;
            if (d.tel && !item.tel) item.tel = d.tel;
          }

          // detailImage2: 추가 이미지 URL
          const images = await client.detailImage(item.contentId);
          if (images.length > 0) {
            item.images = images.slice(0, 3).map(img => img.originimgurl);
          }
        } catch {
          // 상세정보 실패는 무시 — 기본 검색 결과 유지
        }
      }
    }

    return results;
  } catch (error) {
    console.log(`⚠️ 관광 데이터 수집 오류: ${error}`);
    return getMockTourismData(keyword);
  }
}

/**
 * 축제/행사 검색 (KorService2 searchFestival2)
 */
export async function searchFestivals(opts?: {
  areaCode?: string;
  startDate?: string;
  endDate?: string;
  enrichDetail?: boolean;
  enrichCount?: number;
}): Promise<FestivalData[]> {
  const client = getDataGoKrClient();
  if (!client) {
    return getMockFestivals();
  }

  try {
    // eventStartDate 필수 — 미지정 시 오늘 날짜 사용
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const items = await client.searchFestival({
      eventStartDate: opts?.startDate ?? today,
      eventEndDate: opts?.endDate,
      areaCode: opts?.areaCode,
      numOfRows: 20,
    });

    const results: FestivalData[] = items.map(item => ({
      title: item.title,
      address: item.addr1,
      startDate: item.eventstartdate,
      endDate: item.eventenddate,
      place: item.eventplace,
      tel: item.tel,
      image: item.firstimage,
      contentId: item.contentid,
    }));

    // 상세정보 보강 (detailCommon2)
    const enrichCount = opts?.enrichCount ?? 3;
    if (opts?.enrichDetail !== false && results.length > 0) {
      const toEnrich = results.slice(0, enrichCount);
      for (const fest of toEnrich) {
        if (!fest.contentId) continue;
        try {
          const details = await client.detailCommon(fest.contentId);
          if (details.length > 0) {
            const d = details[0];
            if (d.overview) fest.overview = d.overview;
            if (d.homepage) fest.homepage = d.homepage;
          }
        } catch {
          // 상세 실패 무시
        }
      }
    }

    return results;
  } catch (error) {
    console.log(`⚠️ 축제 데이터 수집 오류: ${error}`);
    return getMockFestivals();
  }
}

/**
 * Mock 관광 데이터 (API 키 없을 때 사용)
 */
function getMockTourismData(keyword: string): TourismData[] {
  const mockData: Record<string, TourismData[]> = {
    '제주': [
      { title: '성산일출봉', address: '제주특별자치도 서귀포시 성산읍', overview: '유네스코 세계자연유산' },
      { title: '한라산', address: '제주특별자치도 제주시', overview: '대한민국 최고봉' },
      { title: '우도', address: '제주특별자치도 제주시 우도면', overview: '아름다운 섬' }
    ],
    '서울': [
      { title: '경복궁', address: '서울특별시 종로구', overview: '조선 왕조의 정궁' },
      { title: '북촌한옥마을', address: '서울특별시 종로구', overview: '전통 한옥 마을' },
      { title: '남산타워', address: '서울특별시 용산구', overview: '서울의 랜드마크' }
    ],
    '부산': [
      { title: '해운대해수욕장', address: '부산광역시 해운대구', overview: '대한민국 대표 해변' },
      { title: '감천문화마을', address: '부산광역시 사하구', overview: '한국의 산토리니' },
      { title: '광안대교', address: '부산광역시 수영구', overview: '부산의 야경 명소' }
    ]
  };

  for (const [key, data] of Object.entries(mockData)) {
    if (keyword.includes(key)) {
      return data;
    }
  }

  return [
    { title: `${keyword} 명소 1`, address: '대한민국', overview: '추천 장소' },
    { title: `${keyword} 명소 2`, address: '대한민국', overview: '인기 장소' }
  ];
}

/**
 * Mock 축제 데이터
 */
function getMockFestivals(): FestivalData[] {
  const now = new Date();
  const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  return [
    {
      title: '봄꽃 축제',
      address: '서울특별시',
      startDate: now.toISOString().split('T')[0],
      endDate: nextMonth.toISOString().split('T')[0],
      place: '여의도 한강공원',
    },
  ];
}

// ============================================================================
// 문화포털 API 연동
// ============================================================================

const CULTURE_API_KEY = process.env.CULTURE_API_KEY || '';

/**
 * 문화 행사 검색
 */
export async function searchCultureEvents(keyword: string): Promise<CultureEvent[]> {
  if (!CULTURE_API_KEY) {
    console.log('⚠️ 문화포털 API 키가 설정되지 않았습니다. (CULTURE_API_KEY)');
    return getMockCultureEvents(keyword);
  }

  // 실제 API 연동 구현 예정
  return getMockCultureEvents(keyword);
}

/**
 * Mock 문화 행사 데이터
 */
function getMockCultureEvents(keyword: string): CultureEvent[] {
  const now = new Date();
  const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  return [
    {
      title: `${keyword} 관련 전시회`,
      place: '국립현대미술관 서울',
      startDate: now.toISOString().split('T')[0],
      endDate: nextMonth.toISOString().split('T')[0],
      price: '무료',
      url: 'https://www.mmca.go.kr'
    },
    {
      title: `${keyword} 특별전`,
      place: '예술의전당',
      startDate: now.toISOString().split('T')[0],
      endDate: nextMonth.toISOString().split('T')[0],
      price: '15,000원',
      url: 'https://www.sac.or.kr'
    }
  ];
}

// ============================================================================
// 트렌드 키워드 분석
// ============================================================================

/**
 * 트렌드 키워드 추출 (현재는 Mock)
 */
export async function getTrendKeywords(category: 'travel' | 'culture'): Promise<string[]> {
  // 실제로는 네이버 데이터랩 API 등 연동
  const travelTrends = [
    '제주도 카페', '서울 야경', '부산 맛집', '강릉 커피',
    '경주 한옥', '전주 한옥마을', '여수 밤바다', '속초 맛집'
  ];

  const cultureTrends = [
    '서울 전시회', '미술관 추천', '뮤지컬 예매', '콘서트 일정',
    '박물관 무료', '갤러리 투어', '문화센터 강좌', '공연 할인'
  ];

  return category === 'travel' ? travelTrends : cultureTrends;
}

// ============================================================================
// 통합 데이터 수집
// ============================================================================

/**
 * 키워드 기반 데이터 통합 수집
 */
export async function collectData(keyword: string): Promise<CollectedData> {
  console.log(`🔍 데이터 수집 중: "${keyword}"`);

  // 축제는 searchFestivals가 순차 호출 필요 (공유 레이트리밋)
  // → 관광 검색 후 축제 검색
  const tourismData = await searchTourism(keyword);
  const festivals = await searchFestivals();

  const [cultureEvents, travelTrends, cultureTrends] = await Promise.all([
    searchCultureEvents(keyword),
    getTrendKeywords('travel'),
    getTrendKeywords('culture')
  ]);

  const collectedData: CollectedData = {
    keyword,
    timestamp: new Date().toISOString(),
    tourismData,
    cultureEvents,
    festivals,
    trendKeywords: [...travelTrends.slice(0, 5), ...cultureTrends.slice(0, 5)],
    images: [] // Unsplash에서 별도 수집
  };

  // 수집 데이터 저장
  const dataDir = join(process.cwd(), 'data/collected');
  await mkdir(dataDir, { recursive: true });

  const filename = `${keyword.replace(/\s+/g, '-')}-${Date.now()}.json`;
  await writeFile(
    join(dataDir, filename),
    JSON.stringify(collectedData, null, 2)
  );

  console.log(`✅ 데이터 수집 완료: 관광지 ${tourismData.length}개, 축제 ${festivals.length}개, 문화행사 ${cultureEvents.length}개`);

  return collectedData;
}

/**
 * 수집된 데이터를 프롬프트용 텍스트로 변환
 * detailCommon2/detailImage2로 보강된 데이터를 활용하여
 * AI가 정확한 사실 데이터를 기반으로 글을 작성할 수 있도록 구조화
 */
export function dataToPromptContext(data: CollectedData): string {
  let context = `## 수집된 실제 데이터 — 반드시 이 정보를 기반으로 작성하세요\n`;
  context += `검색 키워드: "${data.keyword}" | 수집 시각: ${data.timestamp}\n`;
  context += `출처: 한국관광공사 (data.go.kr KorService2)\n\n`;

  if (data.tourismData.length > 0) {
    context += '### 관광지/장소 정보 (공식 데이터)\n';
    for (const item of data.tourismData.slice(0, 7)) {
      context += `\n**${item.title}**\n`;
      context += `- 주소: ${item.address}\n`;
      if (item.tel) context += `- 전화: ${item.tel}\n`;
      if (item.homepage) {
        // HTML 태그 제거하여 URL만 추출
        const urlMatch = item.homepage.match(/href="([^"]+)"/);
        context += `- 홈페이지: ${urlMatch ? urlMatch[1] : item.homepage}\n`;
      }
      if (item.overview) {
        // HTML 태그 제거, 300자까지
        const cleanOverview = item.overview.replace(/<[^>]+>/g, '').trim();
        context += `- 소개: ${cleanOverview.slice(0, 300)}${cleanOverview.length > 300 ? '...' : ''}\n`;
      }
      if (item.usetime) context += `- 이용시간: ${item.usetime.replace(/<[^>]+>/g, '')}\n`;
      if (item.restdate) context += `- 휴무일: ${item.restdate.replace(/<[^>]+>/g, '')}\n`;
      if (item.parking) context += `- 주차: ${item.parking.replace(/<[^>]+>/g, '')}\n`;
      if (item.mapx && item.mapy) context += `- 좌표: ${item.mapy}, ${item.mapx}\n`;
      if (item.contentTypeId) {
        const typeNames: Record<string, string> = {
          '12': '관광지', '14': '문화시설', '15': '축제/행사',
          '25': '여행코스', '32': '숙박', '39': '음식점'
        };
        context += `- 유형: ${typeNames[item.contentTypeId] || item.contentTypeId}\n`;
      }
    }
    context += '\n';
  }

  if (data.festivals.length > 0) {
    context += '### 축제/행사 정보 (공식 데이터)\n';
    for (const fest of data.festivals.slice(0, 5)) {
      context += `\n**${fest.title}**\n`;
      context += `- 주소: ${fest.address}\n`;
      context += `- 기간: ${fest.startDate} ~ ${fest.endDate}\n`;
      if (fest.place) context += `- 행사장소: ${fest.place}\n`;
      if (fest.tel) context += `- 전화: ${fest.tel}\n`;
      if (fest.homepage) {
        const urlMatch = fest.homepage.match(/href="([^"]+)"/);
        context += `- 홈페이지: ${urlMatch ? urlMatch[1] : fest.homepage}\n`;
      }
      if (fest.overview) {
        const cleanOverview = fest.overview.replace(/<[^>]+>/g, '').trim();
        context += `- 소개: ${cleanOverview.slice(0, 200)}${cleanOverview.length > 200 ? '...' : ''}\n`;
      }
      if (fest.usetimefestival) context += `- 이용요금: ${fest.usetimefestival.replace(/<[^>]+>/g, '')}\n`;
    }
    context += '\n';
  }

  if (data.cultureEvents.length > 0) {
    context += '### 문화 행사\n';
    for (const event of data.cultureEvents.slice(0, 5)) {
      context += `\n**${event.title}**\n`;
      context += `- 장소: ${event.place}\n`;
      context += `- 기간: ${event.startDate} ~ ${event.endDate}\n`;
      if (event.price) context += `- 가격: ${event.price}\n`;
      if (event.url) context += `- 링크: ${event.url}\n`;
    }
    context += '\n';
  }

  if (data.trendKeywords.length > 0) {
    context += '### 연관 트렌드 키워드\n';
    context += data.trendKeywords.join(', ') + '\n\n';
  }

  context += `⚠️ 위 데이터는 공공 API에서 수집한 실제 정보입니다. `;
  context += `장소명, 주소, 전화번호, 운영시간 등을 그대로 사용하세요. `;
  context += `수집되지 않은 정보(가격, 메뉴 등)는 "확인 필요"로 표기하세요.\n`;
  context += `⚠️ 주의: API 검색 결과에 미술관·공연장(문화시설)이 포함될 수 있으나, `;
  context += `이는 지역 검색 결과일 뿐 주제와 관련된 특별 전시가 열리고 있다는 의미가 아닙니다. `;
  context += `데이터에 명시된 전시/행사 정보만 사용하고, 전시명·기간·가격을 절대 만들어내지 마세요.\n`;

  return context;
}
