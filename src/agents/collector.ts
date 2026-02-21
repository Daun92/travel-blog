/**
 * 데이터 수집 Agent
 * 공공 API 및 외부 소스에서 여행/문화 데이터 수집
 *
 * data.go.kr KorService2 공유 클라이언트 사용
 */

import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { getDataGoKrClient } from '../api/data-go-kr/index.js';
import { getWeatherClient, type WeatherData } from '../api/weather/index.js';
import { getBigDataClient, type BigDataStats } from '../api/bigdata/index.js';
import { getMarketClient, type MarketData } from '../api/market/index.js';
import { getTrailClient, type TrailData } from '../api/trail/index.js';
import { getHeritageClient, type HeritageData } from '../api/heritage/index.js';
import { getFestivalStdClient, type FestivalStdData } from '../api/festival-std/index.js';
import { getCulturePortalClient, type PerformanceData } from '../api/culture-portal/index.js';
import { getKopisClient } from '../api/kopis/index.js';

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
  images?: string[];
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
  // 신규 API 데이터 (모두 optional — 하위 호환)
  weatherData?: WeatherData[];
  heritageData?: HeritageData[];
  trailData?: TrailData[];
  marketData?: MarketData[];
  bigdataStats?: BigDataStats;
  performances?: PerformanceData[];
  festivalStdData?: FestivalStdData[];
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

          // detailImage2: 추가 이미지
          const festImages = await client.detailImage(fest.contentId);
          if (festImages.length > 0) {
            fest.images = festImages.slice(0, 3).map(img => img.originimgurl);
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
// KOPIS 지역 코드 매핑
// ============================================================================

/** 키워드에서 KOPIS 지역 코드를 추출 (시/도 + 주요 시/군 별칭) */
const KOPIS_AREA_MAP: Record<string, string> = {
  '서울': '11', '부산': '26', '대구': '27', '인천': '28',
  '광주': '29', '대전': '30', '울산': '31', '세종': '36',
  '경기': '41', '강원': '42', '충북': '43', '충남': '44',
  '전북': '45', '전남': '46', '경북': '47', '경남': '48', '제주': '50',
  // 시/군 → 도 매핑 (주요 관광지)
  '수원': '41', '용인': '41', '양평': '41', '가평': '42',
  '강릉': '42', '속초': '42', '양양': '42', '평창': '42',
  '논산': '44', '공주': '44', '서천': '44', '제천': '43',
  '전주': '45', '군산': '45', '완주': '45',
  '광양': '46', '여수': '46', '순천': '46', '구례': '46', '담양': '46', '강진': '46', '하동': '48',
  '경주': '47', '안동': '47', '고령': '47', '영양': '47',
  '진해': '48', '창원': '48', '통영': '48', '거제': '48', '남해': '48', '진주': '48',
};

function extractKopisArea(keyword: string): string | undefined {
  // 키워드의 첫 단어부터 매칭 시도
  const words = keyword.split(/\s+/);
  for (const word of words) {
    if (KOPIS_AREA_MAP[word]) return KOPIS_AREA_MAP[word];
  }
  return undefined;
}

function getDateRange30Days(): { start: string; end: string } {
  const now = new Date();
  const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  return {
    start: now.toISOString().split('T')[0].replace(/-/g, ''),
    end: end.toISOString().split('T')[0].replace(/-/g, ''),
  };
}

// ============================================================================
// 문화포털 API 연동
// ============================================================================

/**
 * 문화 행사 검색 — 문화포털 + KOPIS 실제 API 연동
 * KOPIS: 키워드 대신 기간+지역 기반 검색 (공연명이 주제와 일치할 리 없으므로)
 */
export async function searchCultureEvents(keyword: string): Promise<CultureEvent[]> {
  const results: CultureEvent[] = [];

  // 1. 전국공연행사정보 표준데이터 API (기존 culture.go.kr → data.go.kr 전환)
  const cultureClient = getCulturePortalClient();
  if (cultureClient) {
    try {
      const items = await cultureClient.searchPerformances({
        keyword,
        rows: 10,
      });
      for (const item of items) {
        results.push({
          title: item.eventNm ?? '',
          place: item.opar ?? '',
          startDate: item.eventStartDate ?? '',
          endDate: item.eventEndDate ?? '',
          price: item.admfee,
          url: item.homepageUrl,
          image: undefined,
        });
      }
    } catch (error) {
      console.log(`⚠️ 공연행사 검색 오류: ${error}`);
    }
  }

  // 2. KOPIS API — 기간+지역 기반 검색 (키워드 필터 제거)
  const kopisClient = getKopisClient();
  if (kopisClient) {
    try {
      const { start, end } = getDateRange30Days();
      const area = extractKopisArea(keyword);
      if (area) {
        console.log(`  🎭 KOPIS: 지역 ${area} 기간 ${start}~${end} 공연 검색`);
      }
      const items = await kopisClient.searchPerformances({
        startDate: start,
        endDate: end,
        area,
        rows: 10,
      });
      for (const item of items) {
        results.push({
          title: item.prfnm ?? '',
          place: item.fcltynm ?? '',
          startDate: item.prfpdfrom ?? '',
          endDate: item.prfpdto ?? '',
          price: item.pcseguidance,
          image: item.poster,
        });
      }
      if (items.length > 0) {
        console.log(`  🎭 KOPIS: ${items.length}건 공연 수집 완료`);
      }
    } catch (error) {
      console.log(`⚠️ KOPIS 검색 오류: ${error}`);
    }
  }

  if (results.length === 0) {
    console.log('⚠️ 문화포털/KOPIS API 사용 불가 — Mock 데이터 사용');
    return getMockCultureEvents(keyword);
  }

  return results;
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

/** 수집 옵션 — 개별 API 활성화 제어 */
export interface CollectOptions {
  weather?: boolean;
  heritage?: boolean;
  trail?: boolean;
  market?: boolean;
  bigdata?: boolean;
  performances?: boolean;
  festivalStd?: boolean;
  /** 모든 API 활성화 */
  allApis?: boolean;
}

/**
 * 키워드 기반 데이터 통합 수집
 */
export async function collectData(keyword: string, opts?: CollectOptions): Promise<CollectedData> {
  console.log(`🔍 데이터 수집 중: "${keyword}"`);
  const enableAll = opts?.allApis ?? false;

  // 기존 API — KorService2 (순차 호출)
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
    images: [],
  };

  // ── 신규 API 수집 (각 API 실패 시 해당 필드만 비움) ──

  // 날씨
  if (enableAll || opts?.weather) {
    collectedData.weatherData = await collectWeather(keyword);
  }

  // 국가유산 — KHS 제외 (별도 API 키 필요, 현재 미사용)
  // heritage는 --all-apis에서 제외, 명시적 opts.heritage일 때만 수집
  if (opts?.heritage) {
    collectedData.heritageData = await collectHeritage(keyword);
  }

  // 둘레길 — openapi.forest.go.kr 도메인 접속 불가 (2026-02 확인)
  // --all-apis에서 제외, 명시적 opts.trail일 때만 시도
  if (opts?.trail) {
    collectedData.trailData = await collectTrails(keyword);
  }

  // 전통시장
  if (enableAll || opts?.market) {
    collectedData.marketData = await collectMarkets(keyword);
  }

  // 빅데이터 트렌드
  if (enableAll || opts?.bigdata) {
    collectedData.bigdataStats = await collectBigData(keyword);
  }

  // 공연/전시 (문화포털 + KOPIS — 이미 cultureEvents에 포함되므로 별도 필드)
  if (enableAll || opts?.performances) {
    collectedData.performances = await collectPerformances(keyword);
  }

  // 문화축제 표준데이터
  if (enableAll || opts?.festivalStd) {
    collectedData.festivalStdData = await collectFestivalStd(keyword);
  }

  // 수집 데이터 저장
  const dataDir = join(process.cwd(), 'data/collected');
  await mkdir(dataDir, { recursive: true });

  const filename = `${keyword.replace(/\s+/g, '-')}-${Date.now()}.json`;
  await writeFile(
    join(dataDir, filename),
    JSON.stringify(collectedData, null, 2)
  );

  const counts = [
    `관광지 ${tourismData.length}`,
    `축제 ${festivals.length}`,
    `문화행사 ${cultureEvents.length}`,
    collectedData.weatherData?.length ? `날씨 ${collectedData.weatherData.length}` : '',
    collectedData.heritageData?.length ? `유산 ${collectedData.heritageData.length}` : '',
    collectedData.trailData?.length ? `둘레길 ${collectedData.trailData.length}` : '',
    collectedData.marketData?.length ? `시장 ${collectedData.marketData.length}` : '',
    collectedData.performances?.length ? `공연 ${collectedData.performances.length}` : '',
    collectedData.festivalStdData?.length ? `문화축제 ${collectedData.festivalStdData.length}` : '',
  ].filter(Boolean).join(', ');

  console.log(`✅ 데이터 수집 완료: ${counts}`);

  return collectedData;
}

// ============================================================================
// 신규 API 수집 함수
// ============================================================================

async function collectWeather(keyword: string): Promise<WeatherData[]> {
  const client = getWeatherClient();
  if (!client) return [];

  try {
    // 키워드에서 지역 번호 추정은 복잡하므로, 코스 검색으로 시도
    const items = await client.getCourseWeather('1', { numOfRows: 5 });
    return items.map(item => ({
      spotName: item.spotName ?? '',
      date: item.tm ?? '',
      sky: item.sky ?? '',
      minTemp: item.tmn ?? '',
      maxTemp: item.tmx ?? '',
      rainProb: item.pop ?? '',
      humidity: item.reh ?? '',
    }));
  } catch (error) {
    console.log(`⚠️ 관광 날씨 수집 오류: ${error}`);
    return [];
  }
}

async function collectHeritage(keyword: string): Promise<HeritageData[]> {
  const client = getHeritageClient();
  if (!client) return [];

  try {
    const items = await client.searchHeritage(keyword, { numOfRows: 10 });
    return items.map(item => ({
      name: item.ccbaMnm1 ?? '',
      type: item.ccbaKdnm ?? '',
      era: item.ccceName ?? '',
      location: item.ccbaLcad ?? '',
      description: item.content ?? '',
      designationNo: item.ccbaAsno ?? '',
      imageUrl: item.imageUrl ?? '',
    }));
  } catch (error) {
    console.log(`⚠️ 국가유산 수집 오류: ${error}`);
    return [];
  }
}

async function collectTrails(keyword: string): Promise<TrailData[]> {
  const client = getTrailClient();
  if (!client) return [];

  try {
    const items = await client.searchTrails(keyword, { numOfRows: 10 });
    return items.map(item => ({
      name: item.frtrlNm ?? '',
      course: item.crsKorNm ?? '',
      distance: item.crsDstnc ?? '',
      duration: item.crsTotlRqrmHour ?? '',
      difficulty: item.crsLevel ?? '',
      description: item.crsContents ?? '',
      location: item.sigun ?? '',
    }));
  } catch (error) {
    console.log(`⚠️ 둘레길 수집 오류: ${error}`);
    return [];
  }
}

async function collectMarkets(keyword: string): Promise<MarketData[]> {
  const client = getMarketClient();
  if (!client) return [];

  try {
    const items = await client.searchMarkets(keyword, { numOfRows: 10 });
    return items.map(item => ({
      name: item.mrktNm ?? '',
      type: item.mrktType ?? '',
      address: item.rdnmadr ?? item.lnmadr ?? '',
      storeCount: item.storCo ?? '',
      products: item.prdlst ?? '',
      phone: item.telno ?? '',
      parking: item.parkngPsbltyAt ?? '',
    }));
  } catch (error) {
    console.log(`⚠️ 전통시장 수집 오류: ${error}`);
    return [];
  }
}

async function collectBigData(keyword: string): Promise<BigDataStats> {
  const client = getBigDataClient();
  if (!client) return { keywordTrends: [], visitorStats: [] };

  try {
    const keywordTrends = await client.getKeywordTrend(keyword, { numOfRows: 6 });
    return { keywordTrends, visitorStats: [] };
  } catch (error) {
    console.log(`⚠️ 빅데이터 수집 오류: ${error}`);
    return { keywordTrends: [], visitorStats: [] };
  }
}

async function collectPerformances(keyword: string): Promise<PerformanceData[]> {
  const results: PerformanceData[] = [];

  // 전국공연행사정보 표준데이터
  const cultureClient = getCulturePortalClient();
  if (cultureClient) {
    try {
      const items = await cultureClient.searchPerformances({ keyword, rows: 10 });
      for (const item of items) {
        results.push({
          title: item.eventNm ?? '',
          startDate: item.eventStartDate ?? '',
          endDate: item.eventEndDate ?? '',
          venue: item.opar ?? '',
          category: '',
          area: item.rdnmadr ?? item.lnmadr ?? '',
          price: item.admfee ?? '',
          thumbnail: '',
          url: item.homepageUrl ?? '',
          source: 'culture-portal',
        });
      }
    } catch (error) {
      console.log(`⚠️ 공연행사 수집 오류: ${error}`);
    }
  }

  // KOPIS — 기간+지역 기반 검색 (키워드 제거)
  const kopisClient = getKopisClient();
  if (kopisClient) {
    try {
      const { start, end } = getDateRange30Days();
      const area = extractKopisArea(keyword);
      const items = await kopisClient.searchPerformances({
        startDate: start,
        endDate: end,
        area,
        rows: 20,
      });
      for (const item of items) {
        results.push({
          title: item.prfnm ?? '',
          startDate: item.prfpdfrom ?? '',
          endDate: item.prfpdto ?? '',
          venue: item.fcltynm ?? '',
          category: item.genrenm ?? '',
          area: item.area ?? '',
          price: item.pcseguidance ?? '',
          thumbnail: item.poster ?? '',
          url: '',
          source: 'kopis',
        });
      }
    } catch (error) {
      console.log(`⚠️ KOPIS 공연 수집 오류: ${error}`);
    }
  }

  return results;
}

async function collectFestivalStd(keyword: string): Promise<FestivalStdData[]> {
  const client = getFestivalStdClient();
  if (!client) return [];

  try {
    const items = await client.searchFestivals({ keyword, numOfRows: 10 });
    return items.map(item => ({
      name: item.fstvlNm ?? '',
      venue: item.opar ?? '',
      startDate: item.fstvlStartDate ?? '',
      endDate: item.fstvlEndDate ?? '',
      description: item.fstvlCo ?? '',
      organizer: item.mnnstNm ?? '',
      phone: item.phoneNumber ?? '',
      address: item.rdnmadr ?? item.lnmadr ?? '',
      homepage: item.homepageUrl ?? '',
    }));
  } catch (error) {
    console.log(`⚠️ 문화축제 수집 오류: ${error}`);
    return [];
  }
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

  // ── 허용 장소 목록 (Allowlist) ──
  const allowedVenues: string[] = [];
  for (const item of data.tourismData.slice(0, 7)) {
    allowedVenues.push(`${item.title} (${item.address})`);
  }
  for (const fest of data.festivals.slice(0, 5)) {
    allowedVenues.push(`${fest.title} (${fest.address})`);
  }
  for (const event of data.cultureEvents.slice(0, 5)) {
    allowedVenues.push(`${event.title} (${event.place})`);
  }

  if (allowedVenues.length > 0) {
    context += `### ⛔ 허용된 장소/시설 목록 (ALLOWLIST)\n`;
    context += `포스트에서 언급할 수 있는 장소는 아래 목록으로 **한정**됩니다.\n`;
    context += `이 목록에 없는 장소, 전시, 행사, 갤러리, 카페를 만들어내면 **날조**입니다.\n\n`;
    for (const venue of allowedVenues) {
      context += `- ${venue}\n`;
    }
    context += `\n일반 상식(지하철역, 공항, 터미널 등 교통 시설)은 허용 목록 외에도 사용 가능합니다.\n\n`;
  }

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

  // ── 신규 API 데이터 섹션 ──

  if (data.weatherData && data.weatherData.length > 0) {
    context += '### 관광지 날씨 정보\n';
    for (const w of data.weatherData.slice(0, 5)) {
      context += `- ${w.spotName}: ${w.sky}, ${w.minTemp}~${w.maxTemp}°C, 강수 ${w.rainProb}%\n`;
    }
    context += '\n';
  }

  if (data.heritageData && data.heritageData.length > 0) {
    context += '### 주변 문화유산 (출처: 국가유산청)\n';
    for (const h of data.heritageData.slice(0, 5)) {
      context += `\n**${h.name}** (${h.type})\n`;
      if (h.era) context += `- 시대: ${h.era}\n`;
      if (h.location) context += `- 소재지: ${h.location}\n`;
      if (h.description) context += `- 설명: ${h.description.slice(0, 200)}${h.description.length > 200 ? '...' : ''}\n`;
    }
    context += '\n';
  }

  if (data.trailData && data.trailData.length > 0) {
    context += '### 추천 산책/둘레길 (출처: 산림청)\n';
    for (const t of data.trailData.slice(0, 5)) {
      context += `- ${t.name} ${t.course ? `(${t.course})` : ''}: 거리 ${t.distance}, 소요 ${t.duration}, 난이도 ${t.difficulty}\n`;
      if (t.description) context += `  설명: ${t.description.slice(0, 150)}${t.description.length > 150 ? '...' : ''}\n`;
    }
    context += '\n';
  }

  if (data.marketData && data.marketData.length > 0) {
    context += '### 인근 전통시장\n';
    for (const m of data.marketData.slice(0, 5)) {
      context += `- **${m.name}** (${m.type}): ${m.address}`;
      if (m.products) context += `, 취급품목: ${m.products}`;
      if (m.storeCount) context += `, 점포 ${m.storeCount}개`;
      context += '\n';
    }
    context += '\n';
  }

  if (data.bigdataStats && data.bigdataStats.keywordTrends.length > 0) {
    context += '### 방문 트렌드 (출처: 관광빅데이터)\n';
    for (const t of data.bigdataStats.keywordTrends.slice(0, 6)) {
      context += `- ${t.baseYm}: "${t.keyword}" 검색량 ${t.searchCnt}\n`;
    }
    context += '\n';
  }

  if (data.performances && data.performances.length > 0) {
    context += '### 공연/전시 정보 (출처: 문화포털, KOPIS)\n';
    for (const p of data.performances.slice(0, 5)) {
      context += `\n**${p.title}** [${p.source}]\n`;
      context += `- 장소: ${p.venue}\n`;
      context += `- 기간: ${p.startDate} ~ ${p.endDate}\n`;
      if (p.category) context += `- 분야: ${p.category}\n`;
      if (p.price) context += `- 요금: ${p.price}\n`;
    }
    context += '\n';
  }

  if (data.festivalStdData && data.festivalStdData.length > 0) {
    context += '### 문화축제 (출처: 전국문화축제 표준데이터)\n';
    for (const f of data.festivalStdData.slice(0, 5)) {
      context += `\n**${f.name}**\n`;
      context += `- 장소: ${f.venue}\n`;
      context += `- 기간: ${f.startDate} ~ ${f.endDate}\n`;
      if (f.organizer) context += `- 주최: ${f.organizer}\n`;
      if (f.description) context += `- 내용: ${f.description.slice(0, 200)}${f.description.length > 200 ? '...' : ''}\n`;
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
