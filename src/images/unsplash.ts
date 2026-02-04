/**
 * Unsplash API 연동 모듈
 * 키워드 기반 무료 이미지 검색 및 다운로드
 */

import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';

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
}

export interface SearchResult {
  total: number;
  total_pages: number;
  results: UnsplashPhoto[];
}

const UNSPLASH_API_URL = 'https://api.unsplash.com';

/**
 * Unsplash API 클라이언트
 */
export class UnsplashClient {
  private accessKey: string;

  constructor(accessKey?: string) {
    this.accessKey = accessKey || process.env.UNSPLASH_ACCESS_KEY || '';
  }

  /**
   * API 키 유효성 확인
   */
  isConfigured(): boolean {
    return this.accessKey.length > 0;
  }

  /**
   * 이미지 검색
   */
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

  /**
   * 랜덤 이미지 가져오기
   */
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

  /**
   * 이미지 다운로드 (Unsplash 가이드라인 준수)
   */
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

    // 이미지 다운로드
    const response = await fetch(photo.urls.regular);
    if (!response.ok) {
      throw new Error('이미지 다운로드 실패');
    }

    const buffer = await response.arrayBuffer();
    const finalFilename = filename || `${photo.id}.jpg`;
    const filepath = join(outputDir, finalFilename);

    await mkdir(dirname(filepath), { recursive: true });
    await writeFile(filepath, Buffer.from(buffer));

    // 저작자 표시 (Unsplash 요구사항)
    const attribution = `Photo by [${photo.user.name}](${photo.user.links.html}) on [Unsplash](https://unsplash.com)`;

    return {
      filepath,
      attribution
    };
  }
}

/**
 * 한국어-영어 번역 매핑 (검색 정확도 향상)
 */
const KOREAN_TO_ENGLISH: Record<string, string> = {
  // 여행 관련
  '여행': 'travel',
  '해변': 'beach',
  '산': 'mountain',
  '바다': 'ocean',
  '카페': 'cafe',
  '맛집': 'restaurant food',
  '음식': 'food cuisine',
  '야경': 'night cityscape',
  '일출': 'sunrise',
  '일몰': 'sunset',
  '거리': 'street',
  '시장': 'market',
  '골목': 'alley street',
  '해수욕장': 'beach',
  '벚꽃': 'cherry blossom',
  '단풍': 'autumn leaves',
  '눈': 'snow winter',
  '봄': 'spring',
  '여름': 'summer',
  '가을': 'autumn fall',
  '겨울': 'winter',

  // 도시/지역
  '서울': 'Seoul',
  '부산': 'Busan',
  '제주': 'Jeju',
  '경주': 'Gyeongju',
  '전주': 'Jeonju',
  '강릉': 'Gangneung',
  '해운대': 'Haeundae beach',
  '광안리': 'Gwangalli beach',
  '명동': 'Myeongdong',
  '홍대': 'Hongdae',
  '이태원': 'Itaewon',
  '인사동': 'Insadong',
  '남산': 'Namsan',
  '한강': 'Han River',
  '경복궁': 'Gyeongbokgung palace',
  '북촌': 'Bukchon hanok',
  '성산일출봉': 'Seongsan Ilchulbong',
  '한라산': 'Hallasan',

  // 문화예술
  '전시회': 'art exhibition',
  '미술관': 'art museum',
  '박물관': 'museum',
  '공연': 'performance',
  '축제': 'festival',
  '예술': 'art',
  '갤러리': 'gallery',
  '현대미술': 'contemporary art',
  '사진전': 'photography',
  '콘서트': 'concert',
  '한옥': 'hanok traditional',
  '사찰': 'temple',
  '절': 'temple',
  '궁': 'palace',

  // 음식 관련
  '고기': 'meat grill',
  '갈비': 'galbi ribs',
  '삼겹살': 'samgyeopsal pork',
  '국밥': 'soup rice',
  '냉면': 'naengmyeon noodle',
  '회': 'sashimi fish',
  '횟집': 'seafood restaurant',
  '치킨': 'korean fried chicken',
  '김치': 'kimchi',
  '비빔밥': 'bibimbap',
  '떡볶이': 'tteokbokki',
  '분식': 'korean street food',
  '해산물': 'seafood',
  '곰장어': 'hagfish eel',
  '돼지국밥': 'pork soup',
  '밀면': 'milmyeon noodle'
};

/**
 * 한국어 키워드를 영어로 변환 (모든 매칭 키워드 번역)
 */
export function translateKeyword(keyword: string): string {
  const words: string[] = [];
  let remaining = keyword;

  // 긴 키워드부터 매칭 (더 정확한 번역)
  const sortedKeys = Object.keys(KOREAN_TO_ENGLISH).sort((a, b) => b.length - a.length);

  for (const ko of sortedKeys) {
    if (remaining.includes(ko)) {
      words.push(KOREAN_TO_ENGLISH[ko]);
      remaining = remaining.replace(ko, ' ');
    }
  }

  // 번역된 단어가 있으면 조합, 없으면 원본 반환
  if (words.length > 0) {
    return words.join(' ').trim();
  }

  return keyword;
}

/**
 * 검색 쿼리 최적화 (핵심 키워드 추출)
 */
export function optimizeSearchQuery(topic: string): string {
  // 1. 한국어를 영어로 번역
  let query = translateKeyword(topic);

  // 2. 일반적인 불용어 제거
  const stopWords = ['베스트', 'BEST', 'best', '추천', '가이드', '완벽', '최고', '인기', '유명', '정보'];
  for (const word of stopWords) {
    query = query.replace(new RegExp(word, 'gi'), '');
  }

  // 3. 중복 공백 제거
  query = query.replace(/\s+/g, ' ').trim();

  // 4. 너무 길면 처음 3개 단어만 사용
  const words = query.split(' ').filter(w => w.length > 0);
  if (words.length > 4) {
    query = words.slice(0, 4).join(' ');
  }

  return query;
}

/**
 * 편의 함수: 주제에 맞는 이미지 검색 및 선택
 */
export async function findImageForTopic(
  topic: string,
  accessKey?: string
): Promise<UnsplashPhoto | null> {
  const client = new UnsplashClient(accessKey);

  if (!client.isConfigured()) {
    console.warn('Unsplash API 키가 없어 이미지 검색을 건너뜁니다.');
    return null;
  }

  // 최적화된 검색 쿼리 생성
  const query = optimizeSearchQuery(topic);
  console.log(`  검색 쿼리: "${query}"`);

  try {
    // 첫 번째 검색 시도
    let results = await client.search(query, {
      perPage: 5,
      orientation: 'landscape'
    });

    // 결과가 없으면 폴백 검색어로 재시도
    if (results.results.length === 0) {
      const fallbackQueries = [
        'Korea travel',
        'Korean food',
        'Seoul cityscape',
        'Korean landscape'
      ];

      // topic에서 힌트 추출
      if (topic.includes('맛집') || topic.includes('음식') || topic.includes('식당')) {
        results = await client.search('Korean food restaurant', { perPage: 5, orientation: 'landscape' });
      } else if (topic.includes('해운대') || topic.includes('부산')) {
        results = await client.search('Busan beach cityscape', { perPage: 5, orientation: 'landscape' });
      } else if (topic.includes('서울')) {
        results = await client.search('Seoul Korea cityscape', { perPage: 5, orientation: 'landscape' });
      } else if (topic.includes('제주')) {
        results = await client.search('Jeju Island Korea', { perPage: 5, orientation: 'landscape' });
      } else if (topic.includes('벚꽃') || topic.includes('봄')) {
        results = await client.search('cherry blossom Korea spring', { perPage: 5, orientation: 'landscape' });
      } else {
        // 기본 폴백
        results = await client.search('Korea travel landscape', { perPage: 5, orientation: 'landscape' });
      }
    }

    if (results.results.length > 0) {
      return results.results[0];
    }
  } catch (error) {
    console.error('이미지 검색 오류:', error);
  }

  return null;
}
