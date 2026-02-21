/**
 * 관련 포스트 매칭 알고리즘
 * 다중 신호 점수화: 태그/키워드/지역/위치/카테고리/페르소나
 * API 비용 0 — 순수 계산
 */

import type { PostIndexEntry, RelatedPostMatch } from './types.js';

/** 인접 지역 맵 (광역시/도 단위) */
const NEIGHBOR_REGIONS: Record<string, string[]> = {
  '서울': ['경기', '인천'],
  '경기': ['서울', '인천', '강원', '충남', '충북'],
  '인천': ['서울', '경기'],
  '부산': ['경남', '울산'],
  '대구': ['경북', '경남'],
  '광주': ['전남', '전북'],
  '대전': ['충남', '충북', '세종'],
  '울산': ['부산', '경남', '경북'],
  '세종': ['대전', '충남', '충북'],
  '강원': ['경기', '충북', '경북'],
  '충북': ['경기', '강원', '충남', '세종', '대전', '경북'],
  '충남': ['경기', '충북', '세종', '대전', '전북'],
  '전북': ['충남', '전남', '경남'],
  '전남': ['전북', '광주', '경남'],
  '경북': ['강원', '충북', '대구', '울산', '경남'],
  '경남': ['부산', '울산', '대구', '경북', '전남', '전북'],
  '제주': [],
};

/** 매칭에서 제외할 범용 태그 (거의 모든 포스트가 공유) */
const GENERIC_TAGS = new Set([
  '여행', '국내여행', '문화', '예술', '한국', '추천', '가이드',
  'travel', 'culture', 'korea',
]);

/** 범용 태그를 제외한 의미있는 태그만 필터 */
function filterMeaningfulTags(tags: string[]): string[] {
  return tags.filter(t => !GENERIC_TAGS.has(t));
}

/** Jaccard similarity */
function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 0;
  const setA = new Set(a.map(s => s.toLowerCase()));
  const setB = new Set(b.map(s => s.toLowerCase()));
  const intersection = [...setA].filter(x => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

/** 공유 항목 수 (대소문자 무시) */
function sharedCount(a: string[], b: string[]): number {
  const setB = new Set(b.map(s => s.toLowerCase()));
  return a.filter(x => setB.has(x.toLowerCase())).length;
}

/** 공유 항목 목록 (원본 문자열 반환) */
function sharedItems(a: string[], b: string[]): string[] {
  const setB = new Set(b.map(s => s.toLowerCase()));
  return a.filter(x => setB.has(x.toLowerCase()));
}

/** 제목에서 의미있는 단어 추출 */
const TITLE_STOPWORDS = new Set([
  '의', '에', '와', '과', '로', '를', '을', '이', '가', '은', '는', '한',
  '그', '더', '또', '및', '등', '위', '부터', '까지', '대한민국',
  '완벽', '솔직', '현실', '전격', '총정리', '공유', '손해', '공개',
]);

function extractTitleWords(title: string): string[] {
  return title
    .replace(/[^\w\s가-힣]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 2 && !TITLE_STOPWORDS.has(w));
}

/** 두 포스트 간 관련도 점수 계산 */
function computeScore(a: PostIndexEntry, b: PostIndexEntry): RelatedPostMatch {
  let score = 0;
  const reasons: string[] = [];

  // 1. 태그 중복 (0-25) — 범용 태그 제외
  const aMeaningful = filterMeaningfulTags(a.tags);
  const bMeaningful = filterMeaningfulTags(b.tags);
  const shared = sharedCount(aMeaningful, bMeaningful);
  const maxTags = Math.max(aMeaningful.length, bMeaningful.length);
  if (maxTags > 0 && shared > 0) {
    const tagScore = (shared / maxTags) * 25;
    score += tagScore;
    const sharedTags = sharedItems(aMeaningful, bMeaningful);
    reasons.push(`비슷한 테마: ${sharedTags.slice(0, 3).join(', ')}`);
  }

  // 2. 키워드 중복 (0-20)
  const kwShared = sharedCount(a.keywords, b.keywords);
  const maxKw = Math.max(a.keywords.length, b.keywords.length);
  if (maxKw > 0 && kwShared > 0) {
    score += (kwShared / maxKw) * 20;
  }

  // 3. 지역 일치 (0-20) — primaryRegion(첫번째) 우선
  if (a.regions.length > 0 && b.regions.length > 0) {
    // 주 지역 일치: 양쪽의 첫 번째(주) 지역이 같으면 최고 점수
    const aPrimary = a.regions[0];
    const bPrimary = b.regions[0];

    if (aPrimary === bPrimary) {
      score += 20;
      reasons.push(`같은 ${aPrimary} 지역`);
    } else if (a.regions.includes(bPrimary) || b.regions.includes(aPrimary)) {
      // 부 지역 일치
      score += 10;
      const commonRegion = a.regions.find(r => b.regions.includes(r));
      reasons.push(`같은 ${commonRegion} 지역`);
    } else {
      // 인접 지역 체크 (주 지역 기준)
      if (NEIGHBOR_REGIONS[aPrimary]?.includes(bPrimary)) {
        score += 5;
        reasons.push('인접 지역');
      }
    }
  }

  // 4. 위치 중복 (0-15)
  const locJaccard = jaccard(a.locations, b.locations);
  if (locJaccard > 0) {
    score += locJaccard * 15;
    const commonLocs = sharedItems(a.locations, b.locations);
    if (commonLocs.length > 0) {
      reasons.push(`${commonLocs[0]} 현장 리뷰`);
    }
  }

  // 5. 섹션 키워드 중복 (0-10)
  const skJaccard = jaccard(a.sectionKeywords, b.sectionKeywords);
  if (skJaccard > 0) {
    score += skJaccard * 10;
  }

  // 6. 카테고리 일치 (0-5)
  if (a.category === b.category) {
    score += 5;
  }

  // 7. 페르소나 다양성 (0-5)
  if (a.personaId !== b.personaId) {
    score += 3;
  }

  // 8. 제목 키워드 유사도 (0-15) — 공연↔공연, 카페↔카페 매칭 핵심
  const aTitleWords = extractTitleWords(a.title);
  const bTitleWords = extractTitleWords(b.title);
  const titleShared = sharedCount(aTitleWords, bTitleWords);
  const maxTitle = Math.max(aTitleWords.length, bTitleWords.length);
  if (maxTitle > 0 && titleShared > 0) {
    const titleScore = (titleShared / maxTitle) * 15;
    score += titleScore;
    if (titleShared >= 2 && reasons.length === 0) {
      const commonWords = sharedItems(aTitleWords, bTitleWords);
      reasons.push(`유사한 주제: ${commonWords.slice(0, 2).join(', ')}`);
    }
  }

  // reason이 비어있으면 기본 reason 추가
  if (reasons.length === 0 && score > 0) {
    reasons.push('관련 콘텐츠');
  }

  return { entry: b, score: Math.round(score * 10) / 10, reasons };
}

/** 관련 포스트 찾기 (메인 함수) */
export function findRelatedPosts(
  currentPost: PostIndexEntry,
  allPosts: PostIndexEntry[],
  options?: { maxResults?: number; minScore?: number }
): RelatedPostMatch[] {
  const maxResults = options?.maxResults ?? 5;
  const minScore = options?.minScore ?? 10;

  return allPosts
    .filter(p => p.slug !== currentPost.slug) // 자기 자신 제외
    .map(p => computeScore(currentPost, p))
    .filter(m => m.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
}
