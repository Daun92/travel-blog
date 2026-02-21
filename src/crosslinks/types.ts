/**
 * 크로스 링크 시스템 타입 정의
 */

/** 포스트 인덱스 엔트리 — 크로스링크 매칭에 필요한 메타데이터 */
export interface PostIndexEntry {
  /** 파일 기반 slug, e.g. "2026-02-18-ulsan-taehwagang" */
  fileSlug: string;
  /** Hugo frontmatter slug, e.g. "ulsan-taehwagang" */
  slug: string;
  /** Hugo permalink 경로, e.g. "/travel-blog/posts/2026/02/ulsan-taehwagang/" */
  permalink: string;
  /** 포스트 제목 (한국어) */
  title: string;
  /** travel | culture */
  category: 'travel' | 'culture';
  /** 페르소나 ID: viral | friendly | informative | niche */
  personaId: string;
  /** ISO date string */
  date: string;
  /** frontmatter tags */
  tags: string[];
  /** frontmatter keywords */
  keywords: string[];
  /** 지역 정보 (geo-context 추출) */
  regions: string[];
  /** 본문에서 언급된 장소명 */
  locations: string[];
  /** 섹션별 키워드 통합 */
  sectionKeywords: string[];
  /** H2 헤딩 목록 */
  sectionTitles: string[];
  /** 리스트형 포스트 여부 (TOP 5, BEST 등) */
  isListPost: boolean;
  /** 커버 이미지 경로 */
  coverImage?: string;
}

/** 포스트 인덱스 파일 구조 */
export interface PostIndex {
  version: number;
  generatedAt: string;
  count: number;
  entries: PostIndexEntry[];
}

/** 관련 포스트 매칭 결과 */
export interface RelatedPostMatch {
  entry: PostIndexEntry;
  score: number;
  reasons: string[];
}

/** 인라인 링크 후보 */
export interface InlineLinkCandidate {
  /** 링크 대상 포스트 */
  targetPost: PostIndexEntry;
  /** 링크를 삽입할 섹션 제목 */
  sectionTitle: string;
  /** 매칭을 트리거한 키워드/지역명 */
  matchTerm: string;
  /** 신뢰도 (0~1) */
  confidence: number;
}

/** 인라인 링크 삽입 결과 */
export interface InlineLinkInsertion {
  sectionTitle: string;
  sentence: string;
  targetPermalink: string;
}

/** "함께 읽기" 엔트리 */
export interface HamkkeEntry {
  title: string;
  permalink: string;
  reason: string;
}
