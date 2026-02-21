/**
 * 상세정보 링크 생성기
 * 포스트의 주요 장소에 VisitKorea 검색 링크를 추가하는 "참고 정보" 섹션 생성
 * API 비용 0 — post-index.json의 locations 데이터 활용
 */

import type { PostIndexEntry } from './types.js';

const VISITKOREA_SEARCH_BASE = 'https://korean.visitkorea.or.kr/search/search_list.do?keyword=';

/** VisitKorea 검색 URL 생성 */
export function buildVisitKoreaUrl(keyword: string): string {
  return `${VISITKOREA_SEARCH_BASE}${encodeURIComponent(keyword)}`;
}

/** 상세정보 링크 엔트리 */
export interface InfoLinkEntry {
  name: string;
  url: string;
}

/**
 * 범용적이거나 너무 짧은 장소명 필터
 * VisitKorea 검색에서 유의미한 결과를 반환하지 않는 이름 제외
 */
const EXCLUDED_LOCATIONS = new Set([
  '서울', '부산', '대구', '인천', '대전', '광주', '울산', '세종',
  '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
  '한국', '대한민국', '일본', '중국',
  '카페', '맛집', '호텔', '식당', '공원', '시장', '역',
]);

/** 비장소 패턴 감지 */
function isNonLocationPattern(text: string): boolean {
  // 연도/시대 (1990년대, 2020년)
  if (/^\d{3,4}년/.test(text)) return true;
  // 가격 (2만원, 15,000원)
  if (/\d+[만천백]?\s*원/.test(text)) return true;
  // 순수 숫자
  if (/^\d+$/.test(text)) return true;
  // 화살표 포함 (코스 표기: A → B → C)
  if (text.includes('→') || text.includes('->')) return true;
  // 추상적 단어
  const abstractWords = new Set([
    '접근성', '기대', '현실', '분위기', '전석', '무료', '유료',
    '추천', '비교', '후기', '코스', '가이드', '팁', '주의사항',
    '영업시간', '입장료', '주차', '교통', '위치', '전화',
    '먹거리', '맺음말', '마무리', '산책', '정리', '요약',
  ]);
  if (abstractWords.has(text)) return true;
  // 텍스트 내부에 비장소 단어 포함
  if (/먹거리|맺음말|마무리|산책 코스|실용 정보|방문 팁/.test(text)) return true;
  // 인명 패턴 (2~3글자 한글만 + 일반적 성씨)
  if (/^[김이박최정강조윤장임한오서신권황안송류홍전고문양손배백허유남심노하곽성차주우구신][가-힣]{1,2}$/.test(text)) return true;
  return false;
}

/**
 * 포스트의 주요 장소에서 상세정보 링크 생성
 * - post-index의 locations + sectionTitles 데이터 사용
 * - 범용 지명/비장소 패턴 제외
 * - 최대 5개
 */
export function generateInfoLinks(
  entry: PostIndexEntry,
  maxLinks: number = 5
): InfoLinkEntry[] {
  // 관광지/장소 패턴 키워드 (이 키워드를 포함하면 장소명일 가능성 높음)
  const PLACE_MARKERS = /[산강호숲길섬봉곶역관원당궁릉](울산|서울|부산|대구)?$|해수욕장|계곡|동굴|마을|공원|폭포|오름|사찰|성곽|고궁|전당|미술관|박물관|공연장|극장|콘서트홀|광장|시장|거리|해변|포구|항구/;

  // locations + sectionTitles(장소 패턴만)에서 후보 수집
  const rawCandidates = [
    ...entry.locations,
    // sectionTitles에서 장소명만 추출 — 관광지 패턴 매칭 필수
    ...entry.sectionTitles
      .map(t => t.replace(/^\d+[위번째.]?\s*[:.]?\s*/, '').replace(/\s*[—–\-:].+$/, '').trim())
      .filter(t => t.length >= 3 && t.length <= 20 && PLACE_MARKERS.test(t)),
  ];

  const candidates = rawCandidates
    .filter(loc => {
      if (loc.length < 3) return false;
      if (loc.length > 30) return false; // 너무 긴 텍스트 제외
      if (EXCLUDED_LOCATIONS.has(loc)) return false;
      if (isNonLocationPattern(loc)) return false;
      return true;
    });

  // 중복 제거 (부분 문자열 포함 관계도 처리)
  const unique = [...new Set(candidates)];
  // 짧은 것이 긴 것에 포함되면 긴 것만 유지
  const filtered = unique.filter((name, _i, arr) =>
    !arr.some(other => other !== name && other.includes(name) && other.length > name.length)
  );

  return filtered.slice(0, maxLinks).map(name => ({
    name,
    url: buildVisitKoreaUrl(name),
  }));
}

/**
 * "참고 정보" 마크다운 섹션 생성
 * 주요 장소별 VisitKorea 검색 링크 + KTO 데이터 출처 표기
 */
export function generateInfoSection(
  entries: InfoLinkEntry[],
  dataSources?: string[]
): string {
  if (entries.length === 0) return '';

  const lines = [
    '',
    '---',
    '',
    '## 참고 정보',
    '',
    ...entries.map(e =>
      `- [${e.name} — 대한민국 구석구석](${e.url})`
    ),
  ];

  // 데이터 출처가 있으면 추가
  if (dataSources && dataSources.length > 0) {
    lines.push('');
    lines.push(`> 본 포스트의 관광 정보는 ${dataSources.join(', ')} 데이터를 기반으로 작성되었습니다.`);
  }

  lines.push('');
  return lines.join('\n');
}

/** 기존 "참고 정보" 섹션 감지 */
const INFO_SECTION_REGEX = /\n---\n\n## 참고 정보\n[\s\S]*?(?=\n---\n\n## 함께 읽기|\n## 함께 읽기|\n## 자주 묻는 질문|\n## FAQ|$)/;

/**
 * 포스트 본문에 "참고 정보" 섹션 삽입/교체
 * 위치: "함께 읽기" 앞, FAQ 앞
 */
export function appendInfoSection(content: string, infoSection: string): string {
  if (!infoSection) return content;

  // 1. 기존 섹션 제거 (멱등성)
  let cleaned = content.replace(INFO_SECTION_REGEX, '');

  // 2. "함께 읽기" 섹션 앞에 삽입
  const hamkkeMatch = cleaned.match(/\n---\n\n## 함께 읽기/);
  if (hamkkeMatch && hamkkeMatch.index !== undefined) {
    const before = cleaned.slice(0, hamkkeMatch.index).trimEnd();
    const after = cleaned.slice(hamkkeMatch.index);
    return `${before}\n${infoSection}${after}`;
  }

  // 3. FAQ 앞에 삽입
  const faqMatch = cleaned.match(/\n## (자주\s*묻는\s*질문|FAQ)/);
  if (faqMatch && faqMatch.index !== undefined) {
    const before = cleaned.slice(0, faqMatch.index).trimEnd();
    const after = cleaned.slice(faqMatch.index);
    return `${before}\n${infoSection}\n${after}`;
  }

  // 4. Schema.org 앞에 삽입
  const schemaMatch = cleaned.match(/\n<!--\s*Schema\.org/);
  if (schemaMatch && schemaMatch.index !== undefined) {
    const before = cleaned.slice(0, schemaMatch.index).trimEnd();
    const after = cleaned.slice(schemaMatch.index);
    return `${before}\n${infoSection}\n${after}`;
  }

  // 5. 맨 끝
  return `${cleaned.trimEnd()}\n${infoSection}`;
}
