/**
 * Unsplash API 연동 모듈
 * 키워드 기반 무료 이미지 검색, 관련성 스코어링, 중복 방지
 */

import { writeFile, mkdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { existsSync } from 'fs';

export interface UnsplashPhoto {
  id: string;
  description: string | null;
  alt_description: string | null;
  urls: {
    raw: string;
    full: string;
    regular: string;
    small: string;
    thumb: string;
  };
  user: {
    name: string;
    username: string;
    links: {
      html: string;
    };
  };
  links: {
    download: string;
    download_location: string;
  };
  tags?: Array<{ title: string }>;
}

export interface ScoredPhoto {
  photo: UnsplashPhoto;
  score: number;
  reasons: string[];
}

export interface SearchResult {
  total: number;
  total_pages: number;
  results: UnsplashPhoto[];
}

export interface ImageSearchContext {
  topic: string;
  type?: 'travel' | 'culture';
  persona?: 'viral' | 'friendly' | 'informative';
  keywords?: string[];
}

const UNSPLASH_API_URL = 'https://api.unsplash.com';
const IMAGE_REGISTRY_PATH = 'data/image-registry.json';

// ─── 이미지 레지스트리 (중복 방지) ──────────────────────────────

interface ImageRegistryEntry {
  unsplashId?: string;
  ktoContentId?: string;
  ktoUrl?: string;
  source?: 'unsplash' | 'kto';
  postSlug: string;
  query: string;
  usedAt: string;
}

interface ImageRegistry {
  entries: ImageRegistryEntry[];
}

async function loadRegistry(): Promise<ImageRegistry> {
  try {
    if (existsSync(IMAGE_REGISTRY_PATH)) {
      const raw = await readFile(IMAGE_REGISTRY_PATH, 'utf-8');
      return JSON.parse(raw) as ImageRegistry;
    }
  } catch { /* 파일 없으면 빈 레지스트리 */ }
  return { entries: [] };
}

async function saveRegistry(registry: ImageRegistry): Promise<void> {
  await mkdir(dirname(IMAGE_REGISTRY_PATH), { recursive: true });
  await writeFile(IMAGE_REGISTRY_PATH, JSON.stringify(registry, null, 2), 'utf-8');
}

export async function registerImage(unsplashId: string, postSlug: string, query: string): Promise<void> {
  const registry = await loadRegistry();
  registry.entries.push({
    unsplashId,
    postSlug,
    query,
    usedAt: new Date().toISOString()
  });
  await saveRegistry(registry);
}

async function getUsedImageIds(): Promise<Set<string>> {
  const registry = await loadRegistry();
  return new Set(registry.entries.filter(e => e.unsplashId).map(e => e.unsplashId!));
}

export async function getUsedKtoContentIds(): Promise<Set<string>> {
  const registry = await loadRegistry();
  return new Set(registry.entries.filter(e => e.ktoContentId).map(e => e.ktoContentId!));
}

export async function registerKtoImage(
  contentId: string | undefined,
  url: string,
  postSlug: string,
  topic: string
): Promise<void> {
  const registry = await loadRegistry();
  registry.entries.push({
    ktoContentId: contentId,
    ktoUrl: url,
    source: 'kto',
    postSlug,
    query: topic,
    usedAt: new Date().toISOString()
  });
  await saveRegistry(registry);
}

// ─── Unsplash API 클라이언트 ────────────────────────────────────

export class UnsplashClient {
  private accessKey: string;

  constructor(accessKey?: string) {
    this.accessKey = accessKey || process.env.UNSPLASH_ACCESS_KEY || '';
  }

  isConfigured(): boolean {
    return this.accessKey.length > 0;
  }

  async search(
    query: string,
    options: {
      page?: number;
      perPage?: number;
      orientation?: 'landscape' | 'portrait' | 'squarish';
    } = {}
  ): Promise<SearchResult> {
    if (!this.isConfigured()) {
      throw new Error('Unsplash API 키가 설정되지 않았습니다.');
    }

    const { page = 1, perPage = 10, orientation = 'landscape' } = options;

    const params = new URLSearchParams({
      query,
      page: String(page),
      per_page: String(perPage),
      orientation
    });

    const response = await fetch(
      `${UNSPLASH_API_URL}/search/photos?${params}`,
      {
        headers: {
          Authorization: `Client-ID ${this.accessKey}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Unsplash API 오류: ${response.status}`);
    }

    return response.json() as Promise<SearchResult>;
  }

  async getRandom(
    query: string,
    count: number = 1
  ): Promise<UnsplashPhoto[]> {
    if (!this.isConfigured()) {
      throw new Error('Unsplash API 키가 설정되지 않았습니다.');
    }

    const params = new URLSearchParams({
      query,
      count: String(count),
      orientation: 'landscape'
    });

    const response = await fetch(
      `${UNSPLASH_API_URL}/photos/random?${params}`,
      {
        headers: {
          Authorization: `Client-ID ${this.accessKey}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Unsplash API 오류: ${response.status}`);
    }

    const data = await response.json() as UnsplashPhoto | UnsplashPhoto[];
    return Array.isArray(data) ? data : [data];
  }

  async download(
    photo: UnsplashPhoto,
    outputDir: string,
    filename?: string
  ): Promise<{
    filepath: string;
    attribution: string;
  }> {
    // 다운로드 트래킹 (Unsplash API 요구사항)
    if (this.isConfigured()) {
      try {
        await fetch(photo.links.download_location, {
          headers: {
            Authorization: `Client-ID ${this.accessKey}`
          }
        });
      } catch {
        // 트래킹 실패해도 계속 진행
      }
    }

    const response = await fetch(photo.urls.regular);
    if (!response.ok) {
      throw new Error('이미지 다운로드 실패');
    }

    const buffer = await response.arrayBuffer();
    const finalFilename = filename || `${photo.id}.jpg`;
    const filepath = join(outputDir, finalFilename);

    await mkdir(dirname(filepath), { recursive: true });
    await writeFile(filepath, Buffer.from(buffer));

    const attribution = `Photo by [${photo.user.name}](${photo.user.links.html}) on [Unsplash](https://unsplash.com)`;

    return {
      filepath,
      attribution
    };
  }
}

// ─── 한국어-영어 번역 사전 (확장) ───────────────────────────────

const KOREAN_TO_ENGLISH: Record<string, string> = {
  // 여행 관련
  '여행': 'travel',
  '해변': 'beach',
  '산': 'mountain',
  '바다': 'ocean sea',
  '카페': 'cafe coffee',
  '맛집': 'Korean restaurant food',
  '음식': 'Korean food cuisine',
  '야경': 'night view cityscape illuminated',
  '일출': 'sunrise',
  '일몰': 'sunset',
  '거리': 'street',
  '시장': 'traditional market',
  '골목': 'alley narrow street',
  '해수욕장': 'beach shore',
  '벚꽃': 'cherry blossom',
  '단풍': 'autumn leaves foliage',
  '눈': 'snow winter',
  '봄': 'spring',
  '여름': 'summer',
  '가을': 'autumn fall',
  '겨울': 'winter cold',
  '등산': 'hiking mountain trail',
  '산책': 'walking path stroll',
  '드라이브': 'scenic drive road',
  '숙박': 'hotel accommodation',
  '호텔': 'hotel resort',
  '게스트하우스': 'guesthouse',
  '민박': 'traditional guesthouse',
  '펜션': 'pension cottage',
  '캠핑': 'camping outdoor',
  '오지': 'remote wilderness nature',
  '섬': 'island',
  '포장마차': 'Korean street food stall night',
  '밤바다': 'ocean night view',
  '밤': 'night',

  // 도시/지역
  '서울': 'Seoul Korea',
  '부산': 'Busan Korea',
  '제주': 'Jeju Korea',
  '경주': 'Gyeongju Korea',
  '전주': 'Jeonju Korea',
  '강릉': 'Gangneung Korea',
  '대구': 'Daegu Korea',
  '대전': 'Daejeon Korea',
  '광주': 'Gwangju Korea',
  '인천': 'Incheon Korea',
  '수원': 'Suwon Korea',
  '여수': 'Yeosu Korea',
  '통영': 'Tongyeong Korea',
  '안동': 'Andong Korea',
  '속초': 'Sokcho Korea',
  '춘천': 'Chuncheon Korea',
  '목포': 'Mokpo Korea',
  '군산': 'Gunsan Korea',
  '파주': 'Paju Korea',
  '성수동': 'Seongsu Seoul',
  '해운대': 'Haeundae Busan beach',
  '광안리': 'Gwangalli Busan beach',
  '명동': 'Myeongdong Seoul',
  '홍대': 'Hongdae Seoul',
  '이태원': 'Itaewon Seoul',
  '인사동': 'Insadong Seoul',
  '남산': 'Namsan Seoul tower',
  '한강': 'Han River Seoul',
  '익선동': 'Ikseon-dong Seoul hanok',
  '을지로': 'Euljiro Seoul',

  // 랜드마크
  '경복궁': 'Gyeongbokgung palace',
  '북촌': 'Bukchon hanok village',
  '성산일출봉': 'Seongsan Ilchulbong',
  '한라산': 'Hallasan mountain',
  '화성': 'Hwaseong fortress gate',
  '불국사': 'Bulguksa temple',
  '석굴암': 'Seokguram grotto',
  '해인사': 'Haeinsa temple',
  '종묘': 'Jongmyo shrine',
  '창덕궁': 'Changdeokgung palace',
  '덕수궁': 'Deoksugung palace',
  '남대문': 'Namdaemun gate',
  '동피랑': 'Dongpirang mural village',
  '감천문화마을': 'Gamcheon culture village colorful',
  '북한산': 'Bukhansan mountain rocks trail',

  // 문화예술
  '전시회': 'art exhibition gallery',
  '미술관': 'art museum gallery interior',
  '박물관': 'museum exhibit',
  '공연': 'performance stage show',
  '현대무용': 'contemporary dance performance',
  '뮤지컬': 'musical theater stage',
  '연극': 'theater play stage',
  '오페라': 'opera concert',
  '축제': 'festival celebration',
  '예술': 'art artwork',
  '갤러리': 'gallery exhibition',
  '현대미술': 'contemporary art installation',
  '사진전': 'photography exhibition',
  '콘서트': 'concert music',
  '한옥': 'Korean hanok traditional house',
  '사찰': 'Korean Buddhist temple',
  '절': 'Korean temple',
  '궁': 'Korean palace',
  '서점': 'bookstore bookshop',
  '독립서점': 'indie bookstore bookshop',
  '도서관': 'library',
  '템플스테이': 'Korean temple stay meditation',
  '팝업스토어': 'popup store retail exhibition',
  '팝업': 'popup store modern retail',

  // 음식 관련
  '고기': 'Korean meat grill barbecue',
  '갈비': 'galbi Korean ribs',
  '삼겹살': 'samgyeopsal Korean pork',
  '국밥': 'Korean soup rice bowl',
  '냉면': 'Korean naengmyeon cold noodle',
  '회': 'Korean sashimi raw fish',
  '횟집': 'Korean seafood restaurant',
  '치킨': 'Korean fried chicken',
  '김치': 'kimchi',
  '비빔밥': 'bibimbap Korean',
  '떡볶이': 'tteokbokki Korean street food',
  '분식': 'Korean street food snack',
  '해산물': 'Korean seafood',
  '곰장어': 'Korean eel grill',
  '돼지국밥': 'Korean pork soup',
  '밀면': 'Korean cold noodle',

  // 활동/상황
  '여가': 'leisure activity',
  '추위': 'winter cold',
  '강추위': 'winter cold snowy',
  '더위': 'summer heat',
  '비': 'rain rainy',
  '직장인': '',
  '체험': 'experience',
  '코스': 'course route',
  '순례': 'tour visit',

  // 프레이밍/포맷 (검색 보강용)
  'TOP': '',
  'BEST': '',
  '순위': '',
  '비교': '',
  'vs': '',
  '핫플': 'trendy popular',
  '트렌드': 'trendy modern',
  '솔직': '',
  '후기': '',
  '주말': 'weekend',
  '당일치기': 'day trip',
  '1박2일': 'weekend getaway',
  '가성비': '',
  '역사': 'historic heritage',
  '건축': 'architecture building',
  '교양': '',
  '해설': '',
};

// ─── 장소/개념 → 시각적 연상 키워드 (사진작가가 실제 태그할 용어) ──

const LOCATION_ASSOCIATIONS: Record<string, string[]> = {
  // ─── 도시 ───
  '서울': ['Seoul skyline cityscape', 'neon lights urban night Korea', 'palace traditional architecture', 'Han River bridge sunset'],
  '부산': ['harbor port ocean Korea', 'colorful village hillside Busan', 'seafood market coastal', 'beach urban skyline Korea'],
  '제주': ['volcanic landscape Jeju', 'stone wall tangerine grove', 'black basalt coast ocean', 'crater lake emerald Jeju'],
  '경주': ['ancient temple pagoda Korea', 'cherry blossom historic park', 'royal tomb grass mound', 'stone Buddha statue'],
  '전주': ['hanok village traditional roof', 'Korean bibimbap food', 'paper craft traditional art', 'old town alley Korea'],
  '강릉': ['ocean beach sunrise Korea', 'coffee cafe coastal town', 'pine tree seaside', 'traditional village mountain coast'],
  '대구': ['modern city Korea alley', 'market traditional Daegu', 'Apsan mountain view urban'],
  '대전': ['science city Korea expo', 'hot spring nature', 'modern architecture bridge'],
  '광주': ['art biennale contemporary', 'democracy memorial Korea', 'food alley night market'],
  '인천': ['Chinatown colorful gate', 'harbor island ferry Korea', 'modern architecture Songdo'],
  '수원': ['fortress wall gate historic', 'Korean palace architecture stone', 'traditional market lantern'],
  '여수': ['night sea bridge illuminated', 'cable car ocean view', 'port sunset fishing boat'],
  '통영': ['harbor island panorama Korea', 'mural village art', 'oyster seafood coastal'],
  '안동': ['Hahoe village mask Korea', 'traditional house Confucian', 'river cliff mountain heritage'],
  '속초': ['Seoraksan mountain rock peak', 'seafood port fishing Korea', 'beach resort east coast'],
  '춘천': ['lake mountain scenic Korea', 'dakgalbi chicken food', 'rail bike nature trail'],
  '목포': ['harbor sunset port Korea', 'Japanese colonial architecture', 'Yudalsan mountain view', 'Korean port city coastal'],
  '군산': ['retro Japanese colonial street', 'bakery old town vintage', 'port industrial heritage Korea'],
  '파주': ['DMZ border bridge Korea', 'book city library', 'Provence village colorful'],
  '성수동': ['industrial loft cafe Seoul', 'trendy brick building', 'popup store modern design'],
  '해운대': ['beach highrise skyline Busan', 'ocean wave sand Korea', 'night market seafood coast'],
  '광안리': ['diamond bridge night Busan', 'beach sunset urban Korea'],
  '홍대': ['street art mural graffiti', 'indie music live club Seoul', 'youth culture night'],
  '이태원': ['multicultural street food Seoul', 'hillside cafe urban', 'diverse nightlife'],
  '인사동': ['traditional crafts pottery', 'calligraphy art gallery Seoul', 'tea house hanok'],
  '익선동': ['hanok cafe retro Seoul', 'narrow alley traditional Korea'],
  '을지로': ['retro industrial Seoul neon', 'old workshop craftsman', 'vintage sign night alley'],
  '남산': ['Seoul tower panorama city', 'mountain park observation', 'love lock viewpoint'],
  '한강': ['river bridge city night Seoul', 'cycling path park', 'sunset riverside urban'],
  '명동': ['shopping neon street crowd Seoul', 'street food stall Korea'],

  // ─── 랜드마크 ───
  '경복궁': ['palace gate guard ceremony', 'hanbok traditional dress Korea', 'royal garden pavilion'],
  '북촌': ['hanok rooftop village alley Seoul', 'traditional house narrow street'],
  '한라산': ['mountain peak crater lake Jeju', 'hiking trail alpine meadow', 'cloud forest moss'],
  '성산일출봉': ['volcanic crater ocean sunrise', 'cliff coast dramatic Jeju'],
  '불국사': ['temple stone pagoda Korea', 'Buddhist architecture autumn', 'historic stone bridge'],
  '감천문화마을': ['colorful houses hillside Busan', 'mural art village steps', 'rainbow rooftop ocean view'],

  // ─── 개념 ───
  '오름': ['volcanic hill grassland Jeju', 'crater hiking panorama', 'parasite cone green meadow'],
  '지질학': ['basalt column formation', 'volcanic rock layer', 'geological cliff coast'],
  '근대역사': ['colonial architecture vintage Korea', 'retro street heritage building', 'old town preservation'],
  '한옥': ['traditional roof tile curve', 'wooden house courtyard Korea', 'hanok interior warm floor'],
  '사찰': ['temple bell lantern', 'Buddhist monk meditation Korea', 'mountain temple morning mist'],
  '궁': ['palace courtyard ceremony Korea', 'royal architecture night illuminated', 'traditional gate entrance'],
  '맛집': ['Korean food table colorful', 'restaurant interior cozy', 'street food steam night'],
  '카페': ['coffee interior design cozy', 'latte art window light', 'bookshelf warm cafe'],
  '야경': ['city lights reflection river', 'bridge illuminated night Korea', 'skyline neon glow'],
  '해변': ['beach sunrise calm wave', 'sand ocean horizon Korea', 'coastal cliff scenic'],
  '산': ['mountain peak trail hiker', 'forest path morning Korea', 'ridge cloud dramatic'],
  '축제': ['lantern festival colorful Korea', 'crowd celebration parade', 'traditional dance performance'],
  '전시회': ['gallery white wall art', 'modern installation space', 'exhibition visitor perspective'],
  '미술관': ['museum interior architecture', 'contemporary art space', 'gallery lighting artwork'],
  '박물관': ['museum exhibit artifact', 'historical display collection', 'heritage interior hall'],
  '공연': ['stage spotlight performer', 'theater audience dark', 'concert live music'],
  '템플스테이': ['meditation zen peaceful Korea', 'temple dawn mountain', 'Buddhist ceremony prayer'],
  '서점': ['bookstore shelves cozy', 'indie bookshop interior', 'reading corner warm light'],
  '벚꽃': ['cherry blossom pink spring Korea', 'sakura tree path', 'flower tunnel romantic'],
  '단풍': ['autumn foliage red orange Korea', 'maple leaf mountain', 'fall color forest path'],
};

// ─── 계절 키워드 ────────────────────────────────────────────────

const SEASON_KEYWORDS: Record<string, string> = {
  '봄': 'spring blossom',
  '여름': 'summer green',
  '가을': 'autumn foliage',
  '겨울': 'winter snow',
  '벚꽃': 'spring cherry blossom',
  '단풍': 'autumn maple leaves',
  '눈': 'winter snow',
};

// ─── 에이전트 페르소나별 이미지 스타일 힌트 ─────────────────────

const PERSONA_STYLE_HINTS: Record<string, string[]> = {
  viral: ['vibrant', 'colorful', 'dramatic', 'eye-catching', 'aerial'],
  friendly: ['cozy', 'warm', 'authentic', 'casual', 'street-level'],
  informative: ['clean', 'architectural', 'heritage', 'educational', 'detailed'],
};

// ─── 포스트 타입별 검색 보강 ────────────────────────────────────

const TYPE_SEARCH_BOOST: Record<string, string> = {
  travel: 'Korea travel destination',
  culture: 'Korea culture art',
};

// ─── 번역 및 쿼리 최적화 ───────────────────────────────────────

export function translateKeyword(keyword: string): string {
  const words: string[] = [];
  let remaining = keyword;

  const sortedKeys = Object.keys(KOREAN_TO_ENGLISH).sort((a, b) => b.length - a.length);

  for (const ko of sortedKeys) {
    if (remaining.includes(ko)) {
      const eng = KOREAN_TO_ENGLISH[ko];
      if (eng) words.push(eng);
      remaining = remaining.replace(ko, ' ');
    }
  }

  if (words.length > 0) {
    return words.join(' ').trim();
  }

  return keyword;
}

export function optimizeSearchQuery(topic: string): string {
  let query = translateKeyword(topic);

  // 불용어 제거
  const stopWords = ['베스트', 'BEST', 'best', '추천', '가이드', '완벽', '최고', '인기', '유명', '정보',
    '필수', '난리', '화제', '논란', '꼭', '입문', '에티켓', '의미', '배경', '유래'];
  for (const word of stopWords) {
    query = query.replace(new RegExp(word, 'gi'), '');
  }

  query = query.replace(/\s+/g, ' ').trim();

  // 너무 길면 처음 5개 단어 (4→5로 확장)
  const words = query.split(' ').filter(w => w.length > 0);
  if (words.length > 5) {
    query = words.slice(0, 5).join(' ');
  }

  return query;
}

/**
 * 맥락 인식 검색 쿼리 생성
 * topic + type + persona를 결합하여 정밀한 쿼리 구성
 */
export function buildContextualQuery(ctx: ImageSearchContext): string[] {
  const base = optimizeSearchQuery(ctx.topic);

  // 페르소나 스타일 힌트
  const styleHint = ctx.persona ? PERSONA_STYLE_HINTS[ctx.persona]?.[0] || '' : '';

  // 타입 부스트
  const typeBoost = ctx.type ? TYPE_SEARCH_BOOST[ctx.type] || '' : '';

  // 쿼리 후보들 (우선순위 순)
  const queries: string[] = [];

  // 1순위: 원본 쿼리 (가장 구체적)
  queries.push(base);

  // 2순위: 스타일 힌트 포함
  if (styleHint) {
    queries.push(`${base} ${styleHint}`);
  }

  // 3순위: Korea 보강 (Unsplash에서 한국 관련 이미지 우선)
  if (!base.toLowerCase().includes('korea') && !base.toLowerCase().includes('korean')) {
    queries.push(`${base} Korea`);
  }

  // 4순위: 타입 부스트 (travel/culture 맥락)
  if (typeBoost) {
    const baseWords = base.split(' ').slice(0, 3).join(' ');
    queries.push(`${baseWords} ${typeBoost}`);
  }

  return queries;
}

// ─── 다양한 연관 검색 쿼리 생성 ──────────────────────────────────

const MAX_QUERY_BUDGET = 5;

/**
 * 6~8가지 전략으로 개념적으로 다른 쿼리를 생성
 * buildContextualQuery의 상위 호환 — 연관 확장 + 계절 + CLI 키워드
 */
export function generateDiverseQueries(ctx: ImageSearchContext): string[] {
  const base = optimizeSearchQuery(ctx.topic);
  const queries = new Set<string>();

  // Strategy 1: 직역 (기존 optimizeSearchQuery 결과)
  queries.add(base);

  // topic에서 연관 키워드 추출
  const topicWords = ctx.topic.split(/[\s\-·,]+/).filter(w => w.length >= 2);
  const associations: string[] = [];
  for (const word of topicWords) {
    const assoc = LOCATION_ASSOCIATIONS[word];
    if (assoc) {
      associations.push(...assoc);
    }
  }

  // Strategy 2 & 3: 연관 확장 (서로 다른 시각적 개념 2개)
  if (associations.length > 0) {
    queries.add(associations[0]);
    if (associations.length > 1) {
      queries.add(associations[1]);
    }
  }

  // 주요 지명 추출 (Korea가 포함된 번역 결과에서 첫 단어)
  const locationKeys = Object.keys(KOREAN_TO_ENGLISH).filter(k =>
    ctx.topic.includes(k) && KOREAN_TO_ENGLISH[k].toLowerCase().includes('korea')
  );
  const primaryLocation = locationKeys.length > 0
    ? translateKeyword(locationKeys[0]).split(' ')[0]
    : '';

  // Strategy 4: 페르소나 + 주요 지명
  if (ctx.persona && primaryLocation) {
    const personaHint = PERSONA_STYLE_HINTS[ctx.persona]?.[0] || '';
    if (personaHint) {
      queries.add(`${primaryLocation} ${personaHint}`);
    }
  }

  // Strategy 5: 타입별 장면
  if (ctx.type && primaryLocation) {
    const sceneMap: Record<string, string> = {
      travel: 'landscape scenery destination',
      culture: 'heritage art museum',
    };
    queries.add(`${primaryLocation} ${sceneMap[ctx.type] || ''}`);
  }

  // Strategy 6: Korea 부스트
  if (primaryLocation && !base.toLowerCase().includes('korea')) {
    queries.add(`${primaryLocation} Korea`);
  }

  // Strategy 7: 계절/시간 (topic에서 감지)
  for (const [ko, eng] of Object.entries(SEASON_KEYWORDS)) {
    if (ctx.topic.includes(ko)) {
      queries.add(primaryLocation ? `${primaryLocation} ${eng}` : `Korea ${eng}`);
      break;
    }
  }

  // Strategy 8: CLI 키워드
  if (ctx.keywords && ctx.keywords.length > 0) {
    for (const kw of ctx.keywords.slice(0, 2)) {
      const translated = translateKeyword(kw);
      if (translated !== kw && translated.trim().length > 0) {
        queries.add(translated);
      }
    }
  }

  // 빈 쿼리 제거 + 최대 8개
  return [...queries].filter(q => q.trim().length > 0).slice(0, 8);
}

// ─── 관련성 스코어링 ────────────────────────────────────────────

/**
 * Unsplash 이미지의 메타데이터를 기반으로 주제 관련성 점수를 계산
 * 0-100 스코어, 50 미만이면 부적합
 */
export function scoreImageRelevance(
  photo: UnsplashPhoto,
  ctx: ImageSearchContext
): ScoredPhoto {
  let score = 50; // 기본 점수 (Unsplash 검색 결과 자체가 어느 정도 관련)
  const reasons: string[] = [];

  const topicEng = optimizeSearchQuery(ctx.topic).toLowerCase();
  const topicWords = topicEng.split(' ').filter(w => w.length > 2);

  // 1. description/alt_description 키워드 매칭 (최대 +30)
  const desc = (photo.description || '').toLowerCase();
  const alt = (photo.alt_description || '').toLowerCase();
  const combined = `${desc} ${alt}`;

  let keywordHits = 0;
  for (const word of topicWords) {
    if (combined.includes(word)) {
      keywordHits++;
    }
  }

  if (topicWords.length > 0) {
    const hitRatio = keywordHits / topicWords.length;
    const keywordScore = Math.round(hitRatio * 30);
    score += keywordScore;
    if (keywordHits > 0) {
      reasons.push(`키워드 ${keywordHits}/${topicWords.length} 매칭 (+${keywordScore})`);
    }
  }

  // 2. tags 매칭 (최대 +15)
  if (photo.tags && photo.tags.length > 0) {
    const tagTitles = photo.tags.map(t => t.title.toLowerCase());
    let tagHits = 0;
    for (const word of topicWords) {
      if (tagTitles.some(t => t.includes(word))) {
        tagHits++;
      }
    }
    if (tagHits > 0) {
      const tagScore = Math.min(15, tagHits * 5);
      score += tagScore;
      reasons.push(`태그 ${tagHits}건 매칭 (+${tagScore})`);
    }
  }

  // 3. Korea/Korean 키워드 보너스 (한국 관련 콘텐츠이므로)
  if (combined.includes('korea') || combined.includes('korean') ||
      combined.includes('seoul') || combined.includes('busan') ||
      combined.includes('jeju')) {
    score += 10;
    reasons.push('한국 관련 이미지 (+10)');
  }

  // 4. 사진 설명 존재 여부 (품질 지표)
  if (alt && alt.length > 10) {
    score += 5;
    reasons.push('상세 설명 존재 (+5)');
  }

  // 5. 연관 키워드 보너스 (LOCATION_ASSOCIATIONS 매칭, 최대 +15)
  const topicParts = ctx.topic.split(/[\s\-·,]+/).filter(w => w.length >= 2);
  const assocTerms: string[] = [];
  for (const part of topicParts) {
    const assoc = LOCATION_ASSOCIATIONS[part];
    if (assoc) {
      for (const a of assoc) {
        assocTerms.push(...a.toLowerCase().split(' '));
      }
    }
  }
  if (assocTerms.length > 0) {
    const uniqueAssoc = [...new Set(assocTerms)];
    let assocHits = 0;
    for (const term of uniqueAssoc) {
      if (term.length > 2 && combined.includes(term)) {
        assocHits++;
      }
    }
    if (assocHits > 0) {
      const assocScore = Math.min(15, assocHits * 5);
      score += assocScore;
      reasons.push(`연관 키워드 ${assocHits}건 매칭 (+${assocScore})`);
    }
  }

  // 6. 부정적 시그널 감지 (감점)
  const negativePatterns = [
    { pattern: /politic|protest|rally|demonstration/i, label: '정치/시위', penalty: -40 },
    { pattern: /military|weapon|war|soldier/i, label: '군사/무기', penalty: -40 },
    { pattern: /car\s|suv\s|vehicle|automobile|driving/i, label: '차량 중심', penalty: -25 },
    { pattern: /stock\s?photo|generic|placeholder/i, label: '스톡포토', penalty: -15 },
    { pattern: /india|china|japan|thai|vietnam/i, label: '다른 나라', penalty: -20 },
  ];

  // topic에 해당 국가가 포함되어 있으면 감점하지 않음
  for (const neg of negativePatterns) {
    if (neg.pattern.test(combined) && !neg.pattern.test(topicEng)) {
      score += neg.penalty;
      reasons.push(`${neg.label} 감지 (${neg.penalty})`);
    }
  }

  // 7. 페르소나 스타일 매칭 (최대 +5)
  if (ctx.persona) {
    const hints = PERSONA_STYLE_HINTS[ctx.persona] || [];
    for (const hint of hints) {
      if (combined.includes(hint)) {
        score += 5;
        reasons.push(`페르소나 스타일 매칭: ${hint} (+5)`);
        break;
      }
    }
  }

  return {
    photo,
    score: Math.max(0, Math.min(100, score)),
    reasons,
  };
}

// ─── 후보 풀에서 최적 이미지 선택 ─────────────────────────────────

/**
 * 후보 풀에서 최종 1장을 선택 — 다양성 반영
 * 1. score 내림차순 정렬
 * 2. 최근 레지스트리(20개)와 겹침 → diversity penalty
 * 3. 상위 3개 후보 진단 로그
 */
async function selectBestCandidate(
  candidates: ScoredPhoto[]
): Promise<ScoredPhoto | null> {
  if (candidates.length === 0) return null;

  // 점수 내림차순 정렬
  candidates.sort((a, b) => b.score - a.score);

  // 최근 레지스트리 사용 이력으로 다양성 페널티 적용
  const registry = await loadRegistry();
  const recentEntries = registry.entries.slice(-20);
  const recentTexts = recentEntries.map(e => e.query.toLowerCase()).join(' ');

  for (const cand of candidates) {
    const desc = (
      (cand.photo.description || '') + ' ' + (cand.photo.alt_description || '')
    ).toLowerCase();
    const descWords = desc.split(/\s+/).filter(w => w.length > 3);
    let overlapCount = 0;
    for (const word of descWords) {
      if (recentTexts.includes(word)) overlapCount++;
    }
    const diversityPenalty = Math.min(10, Math.floor(overlapCount / 2));
    if (diversityPenalty > 0) {
      cand.score = Math.max(0, cand.score - diversityPenalty);
      cand.reasons.push(`다양성 감점 (-${diversityPenalty})`);
    }
  }

  // 페널티 후 재정렬
  candidates.sort((a, b) => b.score - a.score);

  // 상위 3개 후보 진단 로그
  const top3 = candidates.slice(0, 3);
  console.log(`  후보 ${candidates.length}장 중 상위 ${top3.length}개:`);
  for (let i = 0; i < top3.length; i++) {
    const c = top3[i];
    const desc = c.photo.alt_description || c.photo.description || c.photo.id;
    console.log(`    ${i + 1}. [${c.score}점] ${desc.slice(0, 60)}`);
  }

  return candidates[0];
}

// ─── 스마트 이미지 검색 (메인 진입점) ───────────────────────────

const MIN_ACCEPTABLE_SCORE = 45;

/**
 * 맥락 인식 이미지 검색 — 다양한 쿼리 → 후보 풀 수집 → 최적 선택
 *
 * 개선: 기존 first-fit(score>=70 early-exit) 대신
 * 모든 쿼리(예산 내) 실행 → 전체 후보 스코어링 → 최고점 선택
 */
export async function findImageForTopic(
  topic: string,
  accessKey?: string,
  context?: Partial<ImageSearchContext>
): Promise<UnsplashPhoto | null> {
  const client = new UnsplashClient(accessKey);

  if (!client.isConfigured()) {
    console.warn('Unsplash API 키가 없어 이미지 검색을 건너뜁니다.');
    return null;
  }

  const ctx: ImageSearchContext = {
    topic,
    type: context?.type,
    persona: context?.persona,
    keywords: context?.keywords,
  };

  const usedIds = await getUsedImageIds();
  const queries = generateDiverseQueries(ctx);
  const queryBudget = Math.min(queries.length, MAX_QUERY_BUDGET);

  console.log(`  다양한 검색 쿼리 ${queries.length}개 (실행: ${queryBudget}개):`);
  for (const q of queries.slice(0, queryBudget)) {
    console.log(`    -> "${q}"`);
  }

  try {
    // 모든 쿼리로 후보 수집
    const allCandidates: ScoredPhoto[] = [];
    const seenPhotoIds = new Set<string>();

    for (const query of queries.slice(0, queryBudget)) {
      const results = await client.search(query, {
        perPage: 8,
        orientation: 'landscape'
      });

      if (results.results.length === 0) continue;

      for (const photo of results.results) {
        // 쿼리 간 중복 + 이전 사용 이력 제외
        if (seenPhotoIds.has(photo.id) || usedIds.has(photo.id)) continue;
        seenPhotoIds.add(photo.id);

        const scored = scoreImageRelevance(photo, ctx);
        if (scored.score >= MIN_ACCEPTABLE_SCORE) {
          allCandidates.push(scored);
        }
      }
    }

    console.log(`  후보 수집: ${seenPhotoIds.size}장 검토, ${allCandidates.length}장 통과 (>= ${MIN_ACCEPTABLE_SCORE}점)`);

    // 후보 풀에서 최적 선택
    const best = await selectBestCandidate(allCandidates);

    if (best) {
      const { photo, score, reasons } = best;
      const label = score >= 70 ? '✓ 높은 관련성' :
                    score >= MIN_ACCEPTABLE_SCORE ? '△ 보통 관련성' :
                    '✗ 낮은 관련성';
      console.log(`  ${label} (${score}점): ${photo.alt_description || photo.description || photo.id}`);
      if (reasons.length > 0) {
        console.log(`    스코어 상세: ${reasons.join(', ')}`);
      }

      if (score < MIN_ACCEPTABLE_SCORE) {
        console.warn(`  스코어 ${score}점 < ${MIN_ACCEPTABLE_SCORE}점 — 주제와 무관할 수 있음`);
      }

      return photo;
    }

    console.warn('  모든 검색 쿼리에서 적합한 이미지를 찾지 못했습니다.');
  } catch (error) {
    console.error('이미지 검색 오류:', error);
  }

  return null;
}
