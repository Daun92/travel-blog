/**
 * 인라인 링크 삽입
 * - 템플릿 기반: confidence >= 0.7 (API 0)
 * - LLM 기반: confidence 0.5~0.7 (포스트당 1회 Gemini 호출)
 */

import { parseSections } from '../generator/content-parser.js';
import type { PostIndexEntry, InlineLinkCandidate, InlineLinkInsertion } from './types.js';

/** 페르소나별 인라인 링크 템플릿 */
const PERSONA_TEMPLATES: Record<string, string[]> = {
  friendly: [
    '{term} 여행을 계획 중이라면 [{title}]({url})도 참고해 보세요.',
    '{term}이 궁금하다면 [{title}]({url})에서 더 자세히 다루고 있어요.',
    '{term} 이야기는 [{title}]({url})에서 이어집니다.',
  ],
  viral: [
    '{term} 관련 꿀팁은 [{title}]({url})에서 전격 공개했으니 같이 확인해 보세요.',
    '{term} 더 알고 싶다면 [{title}]({url})도 놓치지 마세요.',
    '이 주제가 흥미롭다면 [{title}]({url})도 추천합니다.',
  ],
  informative: [
    '{term}의 역사적 맥락은 [{title}]({url})에서 더 깊이 다루고 있습니다.',
    '{term}에 관한 보다 상세한 분석은 [{title}]({url})을 참고하시기 바랍니다.',
    '이와 관련하여 [{title}]({url})에서 추가적인 고찰을 확인할 수 있습니다.',
  ],
  niche: [
    '{term}의 숨은 디테일은 [{title}]({url})에서 발견할 수 있습니다.',
    '이 흐름의 연장선에서 [{title}]({url})도 한번 탐색해 볼 만합니다.',
    '{term}을 더 깊이 디깅하고 싶다면 [{title}]({url})을 추천합니다.',
  ],
};

/** 템플릿에서 링크 문장 생성 */
function generateFromTemplate(
  candidate: InlineLinkCandidate,
  personaId: string
): string {
  const templates = PERSONA_TEMPLATES[personaId] || PERSONA_TEMPLATES.friendly;
  // 후보의 matchTerm을 기반으로 템플릿 선택 (다양성을 위해 해시 기반)
  const hash = candidate.matchTerm.length + candidate.sectionTitle.length;
  const template = templates[hash % templates.length];

  return template
    .replace('{term}', candidate.matchTerm)
    .replace('{title}', candidate.targetPost.title)
    .replace('{url}', candidate.targetPost.permalink);
}

/**
 * 인라인 링크 삽입 (템플릿 기반)
 * LLM 기반은 batch-crosslinks.mts에서 별도 처리
 */
export function generateInlineLinkSentences(
  candidates: InlineLinkCandidate[],
  currentPersonaId: string
): InlineLinkInsertion[] {
  return candidates.map(c => ({
    sectionTitle: c.sectionTitle,
    sentence: generateFromTemplate(c, currentPersonaId),
    targetPermalink: c.targetPost.permalink,
  }));
}

/**
 * 포스트 본문에 인라인 링크 문장 삽입
 * 각 삽입은 해당 섹션의 마지막 문단 앞에 추가
 */
export function insertInlineLinks(
  content: string,
  insertions: InlineLinkInsertion[]
): string {
  if (insertions.length === 0) return content;

  // frontmatter 분리
  const fmEnd = content.indexOf('---', content.indexOf('---') + 3);
  if (fmEnd === -1) return content; // frontmatter 없음

  const frontmatter = content.slice(0, fmEnd + 3);
  let body = content.slice(fmEnd + 3);

  for (const insertion of insertions) {
    // 이미 같은 URL이 본문에 있으면 스킵
    if (body.includes(insertion.targetPermalink)) continue;

    // 섹션 헤딩 찾기
    const headingRegex = new RegExp(
      `^(## ${escapeRegex(insertion.sectionTitle)})\\s*$`,
      'm'
    );
    const headingMatch = headingRegex.exec(body);
    if (!headingMatch || headingMatch.index === undefined) continue;

    // 이 섹션의 끝 찾기 (다음 ## 또는 문서 끝)
    const sectionStart = headingMatch.index + headingMatch[0].length;
    const nextHeadingMatch = body.slice(sectionStart).match(/^## /m);
    const sectionEnd = nextHeadingMatch?.index !== undefined
      ? sectionStart + nextHeadingMatch.index
      : body.length;

    const sectionContent = body.slice(sectionStart, sectionEnd);

    // 마지막 문단 찾기 (비어있지 않은 마지막 문단 앞에 삽입)
    const paragraphs = sectionContent.split(/\n\n+/);
    if (paragraphs.length < 2) continue;

    // 마지막 비어있지 않은 문단 인덱스
    let lastNonEmptyIdx = paragraphs.length - 1;
    while (lastNonEmptyIdx > 0 && paragraphs[lastNonEmptyIdx].trim() === '') {
      lastNonEmptyIdx--;
    }

    // 마지막 문단 앞에 링크 문장 삽입
    if (lastNonEmptyIdx > 0) {
      paragraphs.splice(lastNonEmptyIdx, 0, insertion.sentence);
      const newSectionContent = paragraphs.join('\n\n');
      body = body.slice(0, sectionStart) + newSectionContent + body.slice(sectionEnd);
    }
  }

  return frontmatter + body;
}

/** 정규식 특수문자 이스케이프 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
