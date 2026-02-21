/**
 * 인라인 링크 후보 감지
 * 관련 포스트의 고유 키워드가 현재 포스트 본문에 등장하는지 검사
 * API 비용 0 — 규칙 기반
 */

import { parseSections } from '../generator/content-parser.js';
import type { PostIndexEntry, RelatedPostMatch, InlineLinkCandidate } from './types.js';

/** 제목에서 검색 가능한 키워드 추출 (조사/범용어 제거) */
function extractTitleKeywords(title: string): string[] {
  // 불용어 + 범용어 제거
  const stopwords = new Set([
    '의', '에', '와', '과', '로', '를', '을', '이', '가', '은', '는',
    '한', '그', '이런', '저런', '더', '또', '및', '등', '위', '부터',
    'TOP', 'BEST', '베스트', '추천', '가이드', '완벽', '솔직', '후기',
    '현실', '비용', '총정리', '전격', '공개', '비교', '여행', '국내여행',
    '문화', '예술', '코스', '관광', '맛집', '명소', '카페', '체험',
    '서울', '부산', // 대도시는 너무 범용적
    '이야기', '이야기를', '정리', '모음',
  ]);

  return title
    .replace(/[^\w\s가-힣]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 2 && !stopwords.has(w));
}

/** 텍스트에 특정 단어가 포함되어 있는지 검사 */
function textContains(text: string, term: string): boolean {
  return text.includes(term);
}

/** 헤딩에 특정 단어가 포함되어 있는지 검사 */
function headingContains(heading: string, term: string): boolean {
  return heading.includes(term);
}

/** 이미 해당 URL로의 링크가 존재하는지 확인 */
function hasExistingLink(sectionContent: string, permalink: string): boolean {
  return sectionContent.includes(permalink);
}

/**
 * 인라인 링크 후보 감지
 * - 관련 포스트의 고유 키워드/지역명이 현재 포스트 본문에 등장하면 후보 생성
 * - 포스트당 최대 3개, 섹션당 최대 1개
 */
export function detectInlineLinkCandidates(
  currentPost: PostIndexEntry,
  currentContent: string,
  relatedPosts: RelatedPostMatch[]
): InlineLinkCandidate[] {
  const sections = parseSections(currentContent);
  const candidates: InlineLinkCandidate[] = [];
  const usedSections = new Set<string>();

  // frontmatter 영역 스킵 — content-parser의 parseSections은 본문만 처리
  // 하지만 ## 레벨만 대상으로 제한 (H3 이하는 너무 세부적)
  const h2Sections = sections.filter(s => s.level === 2);

  for (const match of relatedPosts) {
    if (candidates.length >= 3) break; // 포스트당 최대 3개

    const target = match.entry;

    // 대상 포스트에서 검색할 키워드 수집 (범용 지역명 제외)
    const genericLocations = new Set(['서울', '부산', '대구', '인천', '대전', '광주', '울산', '한국']);
    const meaningfulLocations = target.locations.filter(l => !genericLocations.has(l));
    const searchTerms: string[] = [
      ...meaningfulLocations,
      ...extractTitleKeywords(target.title),
    ];
    // 중복 제거 + 최소 길이 필터
    const uniqueTerms = [...new Set(searchTerms)].filter(t => t.length >= 2);

    for (const section of h2Sections) {
      if (usedSections.has(section.title)) continue; // 섹션당 최대 1개
      if (hasExistingLink(section.content, target.permalink)) continue;

      // 섹션 본문이 너무 짧으면 스킵 (2문단 미만)
      const paragraphs = section.content.split(/\n\n+/).filter(p => p.trim().length > 0);
      if (paragraphs.length < 2) continue;

      for (const term of uniqueTerms) {
        let confidence = 0;

        // 헤딩에 등장 (+0.3)
        if (headingContains(section.title, term)) {
          confidence += 0.3;
        }

        // 본문에 등장 (+0.2)
        if (textContains(section.content, term)) {
          confidence += 0.2;
        }

        // 관련도 점수 높음 (+0.2)
        if (match.score >= 30) {
          confidence += 0.2;
        }

        // 위치/지역 매칭 (+0.3)
        if (target.locations.includes(term) || target.regions.includes(term)) {
          confidence += 0.3;
        }

        if (confidence >= 0.5) {
          candidates.push({
            targetPost: target,
            sectionTitle: section.title,
            matchTerm: term,
            confidence,
          });
          usedSections.add(section.title);
          break; // 이 섹션에서는 하나만
        }
      }
    }
  }

  // 신뢰도 높은 순으로 정렬 후 최대 3개
  return candidates
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);
}
