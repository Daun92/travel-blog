/**
 * 데이터 수집 Agent
 * 공공 API 및 외부 소스에서 여행/문화 데이터 수집
 */

import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

// ============================================================================
// 타입 정의
// ============================================================================

export interface TourismData {
  title: string;
  address: string;
  tel?: string;
  overview?: string;
  image?: string;
  mapx?: number;
  mapy?: number;
  contentTypeId?: string;
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

export interface CollectedData {
  keyword: string;
  timestamp: string;
  tourismData: TourismData[];
  cultureEvents: CultureEvent[];
  trendKeywords: string[];
  images: string[];
}

// ============================================================================
// 한국관광공사 API 연동
// ============================================================================

const KTO_API_KEY = process.env.KTO_API_KEY || '';
const KTO_BASE_URL = 'http://apis.data.go.kr/B551011/KorService1';

/**
 * 한국관광공사 API에서 관광지 검색
 */
export async function searchTourism(keyword: string): Promise<TourismData[]> {
  if (!KTO_API_KEY) {
    console.log('⚠️ 한국관광공사 API 키가 설정되지 않았습니다. (KTO_API_KEY)');
    return getMockTourismData(keyword);
  }

  try {
    const params = new URLSearchParams({
      serviceKey: KTO_API_KEY,
      MobileOS: 'ETC',
      MobileApp: 'BlogAgent',
      _type: 'json',
      keyword: keyword,
      numOfRows: '20'
    });

    const response = await fetch(`${KTO_BASE_URL}/searchKeyword1?${params}`);

    if (!response.ok) {
      throw new Error(`API 오류: ${response.status}`);
    }

    const data = await response.json() as { response?: { body?: { items?: { item?: Record<string, unknown>[] } } } };
    const items = data.response?.body?.items?.item || [];

    return items.map((item: Record<string, unknown>) => ({
      title: item.title as string,
      address: item.addr1 as string,
      tel: item.tel as string,
      overview: item.overview as string,
      image: item.firstimage as string,
      mapx: item.mapx as number,
      mapy: item.mapy as number,
      contentTypeId: item.contenttypeid as string
    }));
  } catch (error) {
    console.log(`⚠️ 관광 데이터 수집 오류: ${error}`);
    return getMockTourismData(keyword);
  }
}

/**
 * Mock 관광 데이터 (API 키 없을 때 사용)
 */
function getMockTourismData(keyword: string): TourismData[] {
  // 키워드 기반 예시 데이터
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

  // 키워드에 매칭되는 데이터 반환
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

  const [tourismData, cultureEvents, travelTrends, cultureTrends] = await Promise.all([
    searchTourism(keyword),
    searchCultureEvents(keyword),
    getTrendKeywords('travel'),
    getTrendKeywords('culture')
  ]);

  const collectedData: CollectedData = {
    keyword,
    timestamp: new Date().toISOString(),
    tourismData,
    cultureEvents,
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

  console.log(`✅ 데이터 수집 완료: 관광지 ${tourismData.length}개, 문화행사 ${cultureEvents.length}개`);

  return collectedData;
}

/**
 * 수집된 데이터를 프롬프트용 텍스트로 변환
 */
export function dataToPromptContext(data: CollectedData): string {
  let context = `## 수집된 데이터 (${data.keyword})\n\n`;

  if (data.tourismData.length > 0) {
    context += '### 관광지 정보\n';
    for (const item of data.tourismData.slice(0, 5)) {
      context += `- **${item.title}**: ${item.address}\n`;
      if (item.overview) context += `  ${item.overview.slice(0, 100)}...\n`;
    }
    context += '\n';
  }

  if (data.cultureEvents.length > 0) {
    context += '### 문화 행사\n';
    for (const event of data.cultureEvents.slice(0, 5)) {
      context += `- **${event.title}** @ ${event.place}\n`;
      context += `  기간: ${event.startDate} ~ ${event.endDate}\n`;
      if (event.price) context += `  가격: ${event.price}\n`;
    }
    context += '\n';
  }

  if (data.trendKeywords.length > 0) {
    context += '### 트렌드 키워드\n';
    context += data.trendKeywords.join(', ') + '\n';
  }

  return context;
}
