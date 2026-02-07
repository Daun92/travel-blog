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
  unsplashId: string;
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
  return new Set(registry.entries.map(e => e.unsplashId));
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

  // 5. 부정적 시그널 감지 (감점)
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

  // 6. 페르소나 스타일 매칭 (최대 +5)
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

// ─── 스마트 이미지 검색 (메인 진입점) ───────────────────────────

const MIN_ACCEPTABLE_SCORE = 45;

/**
 * 맥락 인식 이미지 검색 — 스코어링 + 중복 방지 + 다단계 폴백
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
  const queries = buildContextualQuery(ctx);

  console.log(`  검색 쿼리 후보: ${queries.map(q => `"${q}"`).join(', ')}`);

  try {
    let bestCandidate: ScoredPhoto | null = null;

    // 각 쿼리 후보로 순차 검색, 최고 점수 후보를 추적
    for (const query of queries) {
      const results = await client.search(query, {
        perPage: 10,
        orientation: 'landscape'
      });

      if (results.results.length === 0) continue;

      // 전체 결과 스코어링
      for (const photo of results.results) {
        // 중복 제외
        if (usedIds.has(photo.id)) continue;

        const scored = scoreImageRelevance(photo, ctx);

        if (!bestCandidate || scored.score > bestCandidate.score) {
          bestCandidate = scored;
        }
      }

      // 현재 최고점이 충분히 높으면 더 검색하지 않음
      if (bestCandidate && bestCandidate.score >= 70) break;
    }

    // 결과 로깅
    if (bestCandidate) {
      const { photo, score, reasons } = bestCandidate;
      const label = score >= 70 ? '✓ 높은 관련성' :
                    score >= MIN_ACCEPTABLE_SCORE ? '△ 보통 관련성' :
                    '✗ 낮은 관련성';
      console.log(`  ${label} (${score}점): ${photo.alt_description || photo.description || photo.id}`);
      if (reasons.length > 0) {
        console.log(`    스코어 상세: ${reasons.join(', ')}`);
      }

      if (score < MIN_ACCEPTABLE_SCORE) {
        console.warn(`  ⚠️ 스코어 ${score}점 < ${MIN_ACCEPTABLE_SCORE}점 — 주제와 무관할 수 있음`);
      }

      return photo;
    }

    console.warn('  모든 검색 쿼리에서 적합한 이미지를 찾지 못했습니다.');
  } catch (error) {
    console.error('이미지 검색 오류:', error);
  }

  return null;
}
