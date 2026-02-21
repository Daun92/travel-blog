/**
 * "함께 읽기" 하단 섹션 생성
 * API 비용 0 — 결정론적 템플릿
 */

import type { RelatedPostMatch, HamkkeEntry } from './types.js';

/** 매칭 reasons에서 가장 적합한 한 줄 사유 선택 */
function pickBestReason(match: RelatedPostMatch): string {
  // reasons 중 가장 구체적인 것 선택
  if (match.reasons.length === 0) return '관련 콘텐츠';

  // 지역 > 테마 > 기타 우선순위
  const regionReason = match.reasons.find(r => r.includes('지역'));
  if (regionReason) return regionReason;

  const themeReason = match.reasons.find(r => r.includes('테마'));
  if (themeReason) return themeReason;

  const locReason = match.reasons.find(r => r.includes('리뷰') || r.includes('현장'));
  if (locReason) return locReason;

  return match.reasons[0];
}

/** 페르소나별 사유 보강 */
function enhanceReasonWithPersona(reason: string, personaId: string, personaMap: Record<string, string>): string {
  const personaName = personaMap[personaId];
  if (!personaName) return reason;

  // 이미 페르소나 정보가 있으면 스킵
  if (reason.includes(personaName)) return reason;

  // 다른 페르소나의 포스트면 시선 추가
  return reason;
}

/** 페르소나 ID → 표시명 매핑 */
const PERSONA_DISPLAY: Record<string, string> = {
  viral: '조회영',
  friendly: '김주말',
  informative: '한교양',
  niche: '오덕우',
};

/** "함께 읽기" 마크다운 섹션 생성 */
export function generateHamkkeSection(
  matches: RelatedPostMatch[],
  currentPersonaId?: string,
  count: number = 3
): string {
  const selected = matches.slice(0, Math.min(count, 5));
  if (selected.length === 0) return '';

  const entries: HamkkeEntry[] = selected.map(m => {
    let reason = pickBestReason(m);

    // 다른 페르소나이면 시선 정보 추가
    if (currentPersonaId && m.entry.personaId !== currentPersonaId) {
      const otherName = PERSONA_DISPLAY[m.entry.personaId];
      if (otherName && !reason.includes(otherName)) {
        reason = `${otherName}의 시선 · ${reason}`;
      }
    }

    return {
      title: m.entry.title,
      permalink: m.entry.permalink,
      reason,
    };
  });

  const lines = [
    '',
    '---',
    '',
    '## 함께 읽기',
    '',
    ...entries.map(e => `- [${e.title}](${e.permalink}) — ${e.reason}`),
    '',
  ];

  return lines.join('\n');
}

/** FAQ 헤딩 감지 정규식 */
const FAQ_HEADING_REGEX = /^##\s+(자주\s*묻는\s*질문|FAQ)/m;

/** 기존 "함께 읽기" 섹션 감지 정규식 */
const HAMKKE_SECTION_REGEX = /\n---\n\n## 함께 읽기\n[\s\S]*?(?=\n## |\n---\n|$)/;

/**
 * 포스트 본문에 "함께 읽기" 섹션 삽입/교체
 * - 기존 섹션 있으면 교체 (멱등성)
 * - FAQ 섹션 앞에 삽입
 * - FAQ 없으면 본문 끝에 추가
 */
export function appendHamkkeSection(content: string, hamkkeSection: string): string {
  if (!hamkkeSection) return content;

  // 1. 기존 "함께 읽기" 섹션 제거 (멱등성)
  let cleaned = content.replace(HAMKKE_SECTION_REGEX, '');

  // 2. FAQ 섹션 위치 찾기
  const faqMatch = FAQ_HEADING_REGEX.exec(cleaned);

  if (faqMatch && faqMatch.index !== undefined) {
    // FAQ 앞에 삽입
    const before = cleaned.slice(0, faqMatch.index).trimEnd();
    const after = cleaned.slice(faqMatch.index);
    return `${before}\n${hamkkeSection}\n${after}`;
  }

  // 3. FAQ 없으면 본문 끝에 추가 (Schema.org 주석 앞)
  const schemaMatch = cleaned.match(/\n<!--\s*Schema\.org/);
  if (schemaMatch && schemaMatch.index !== undefined) {
    const before = cleaned.slice(0, schemaMatch.index).trimEnd();
    const after = cleaned.slice(schemaMatch.index);
    return `${before}\n${hamkkeSection}\n${after}`;
  }

  // 4. 맨 끝에 추가
  return `${cleaned.trimEnd()}\n${hamkkeSection}`;
}
