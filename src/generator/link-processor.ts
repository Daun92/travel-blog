/**
 * 실용 링크 처리 모듈
 * 마크다운 콘텐츠에서 링크 마커를 실제 URL 링크로 변환
 * AI 기반 장소명 추출 및 자동 링크 추가
 */

import { generate } from './ollama.js';

export interface LinkMarker {
  marker: string;
  type: LinkType;
  query: string;
  displayText?: string;
  position: number;
  line: number;
}

export type LinkType = 'map' | 'place' | 'booking' | 'yes24' | 'official';

export interface LinkAnalysis {
  totalMarkers: number;
  byType: Record<LinkType, number>;
  markers: LinkMarker[];
}

export interface ProcessedLink {
  marker: LinkMarker;
  url: string;
  markdown: string;
}

/**
 * 링크 타입별 URL 템플릿
 */
const URL_TEMPLATES: Record<LinkType, (query: string) => string> = {
  map: (query) => `https://map.naver.com/v5/search/${encodeURIComponent(query)}`,
  place: (query) => `https://search.naver.com/search.naver?where=nexearch&query=${encodeURIComponent(query)}`,
  booking: (query) => `https://ticket.interpark.com/search?q=${encodeURIComponent(query)}`,
  yes24: (query) => `https://www.yes24.com/Product/Search?query=${encodeURIComponent(query)}`,
  official: (query) => query // 직접 URL 사용
};

/**
 * 링크 마커 정규식
 * 형식: [LINK:type:query] 또는 [LINK:type:query:표시텍스트]
 * official 타입은 URL을 포함하므로 특수 처리 필요
 *
 * 패턴 설명:
 * - official: [LINK:official:https://...] 또는 [LINK:official:https://...:텍스트]
 * - 기타: [LINK:type:검색어] 또는 [LINK:type:검색어:텍스트]
 */
const LINK_MARKER_OFFICIAL_REGEX = /\[LINK:official:(https?:\/\/[^\]:\s]+)(?::([^\]\n]+))?\]/g;
const LINK_MARKER_STANDARD_REGEX = /\[LINK:(map|place|booking|yes24):([^\]:\n]+)(?::([^\]\n]+))?\]/g;

/**
 * 유효한 링크 타입 목록
 */
const VALID_LINK_TYPES: LinkType[] = ['map', 'place', 'booking', 'yes24', 'official'];

/**
 * 콘텐츠에서 링크 마커 추출
 */
export function extractLinkMarkers(content: string): LinkMarker[] {
  const markers: LinkMarker[] = [];
  const lines = content.split('\n');

  let position = 0;
  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];
    let match: RegExpExecArray | null;

    // official 타입 마커 찾기 (URL 포함)
    const officialRegex = new RegExp(LINK_MARKER_OFFICIAL_REGEX.source, 'g');
    while ((match = officialRegex.exec(line)) !== null) {
      const [fullMatch, url, displayText] = match;
      markers.push({
        marker: fullMatch,
        type: 'official',
        query: url.trim(),
        displayText: displayText?.trim(),
        position: position + match.index,
        line: lineNum + 1
      });
    }

    // 일반 타입 마커 찾기 (map, place, booking, yes24)
    const standardRegex = new RegExp(LINK_MARKER_STANDARD_REGEX.source, 'g');
    while ((match = standardRegex.exec(line)) !== null) {
      const [fullMatch, typeStr, query, displayText] = match;
      const type = typeStr.toLowerCase() as LinkType;

      markers.push({
        marker: fullMatch,
        type,
        query: query.trim(),
        displayText: displayText?.trim(),
        position: position + match.index,
        line: lineNum + 1
      });
    }

    position += line.length + 1; // +1 for newline
  }

  // 위치 순으로 정렬
  markers.sort((a, b) => a.position - b.position);

  return markers;
}

/**
 * 링크 마커를 실제 URL로 변환
 */
export function generateUrl(type: LinkType, query: string): string {
  const template = URL_TEMPLATES[type];
  if (!template) {
    throw new Error(`Unknown link type: ${type}`);
  }
  return template(query);
}

/**
 * 링크 마커를 마크다운 링크로 변환
 */
export function markerToMarkdown(marker: LinkMarker): string {
  const url = generateUrl(marker.type, marker.query);
  const displayText = marker.displayText || marker.query;
  return `[${displayText}](${url})`;
}

/**
 * 콘텐츠의 모든 링크 마커를 실제 마크다운 링크로 변환
 */
export function processLinks(content: string): string {
  const markers = extractLinkMarkers(content);

  if (markers.length === 0) {
    return content;
  }

  // 마커를 위치 역순으로 정렬 (뒤에서부터 교체하여 위치 변경 방지)
  const sortedMarkers = [...markers].sort((a, b) => b.position - a.position);

  let result = content;

  for (const marker of sortedMarkers) {
    try {
      const markdown = markerToMarkdown(marker);
      result = result.replace(marker.marker, markdown);
    } catch (error) {
      // 변환 실패 시 마커 텍스트만 남김
      const displayText = marker.displayText || marker.query;
      result = result.replace(marker.marker, displayText);
    }
  }

  return result;
}

/**
 * 링크 마커 제거 (변환 실패 시 사용)
 * 마커를 표시 텍스트 또는 쿼리로 대체
 */
export function removeLinkMarkers(content: string): string {
  // official 타입 마커 제거
  let result = content.replace(LINK_MARKER_OFFICIAL_REGEX, (match, url, displayText) => {
    return displayText?.trim() || url.trim();
  });

  // 일반 타입 마커 제거
  result = result.replace(LINK_MARKER_STANDARD_REGEX, (match, type, query, displayText) => {
    return displayText?.trim() || query.trim();
  });

  return result;
}

/**
 * 콘텐츠의 링크 마커 분석
 */
export function analyzeLinkMarkers(content: string): LinkAnalysis {
  const markers = extractLinkMarkers(content);

  const byType: Record<LinkType, number> = {
    map: 0,
    place: 0,
    booking: 0,
    yes24: 0,
    official: 0
  };

  for (const marker of markers) {
    byType[marker.type]++;
  }

  return {
    totalMarkers: markers.length,
    byType,
    markers
  };
}

/**
 * 링크 처리 결과 정보 반환
 */
export function processLinksWithInfo(content: string): {
  content: string;
  processed: ProcessedLink[];
  failed: LinkMarker[];
} {
  const markers = extractLinkMarkers(content);
  const processed: ProcessedLink[] = [];
  const failed: LinkMarker[] = [];

  if (markers.length === 0) {
    return { content, processed, failed };
  }

  // 마커를 위치 역순으로 정렬
  const sortedMarkers = [...markers].sort((a, b) => b.position - a.position);

  let result = content;

  for (const marker of sortedMarkers) {
    try {
      const url = generateUrl(marker.type, marker.query);
      const markdown = markerToMarkdown(marker);
      result = result.replace(marker.marker, markdown);
      processed.push({ marker, url, markdown });
    } catch (error) {
      // 변환 실패 시 마커 텍스트만 남김
      const displayText = marker.displayText || marker.query;
      result = result.replace(marker.marker, displayText);
      failed.push(marker);
    }
  }

  return { content: result, processed, failed };
}

/**
 * 특정 타입의 링크 마커만 처리
 */
export function processLinksByType(content: string, types: LinkType[]): string {
  const markers = extractLinkMarkers(content);
  const filteredMarkers = markers.filter(m => types.includes(m.type));

  if (filteredMarkers.length === 0) {
    return content;
  }

  // 마커를 위치 역순으로 정렬
  const sortedMarkers = [...filteredMarkers].sort((a, b) => b.position - a.position);

  let result = content;

  for (const marker of sortedMarkers) {
    try {
      const markdown = markerToMarkdown(marker);
      result = result.replace(marker.marker, markdown);
    } catch (error) {
      const displayText = marker.displayText || marker.query;
      result = result.replace(marker.marker, displayText);
    }
  }

  return result;
}

/**
 * (링크) 플레이스홀더 패턴
 * [텍스트](링크) 형태를 찾아서 네이버 지도 링크로 변환
 */
const PLACEHOLDER_LINK_REGEX = /\[([^\]]+)\]\(링크\)/g;

export interface PlaceholderLink {
  fullMatch: string;
  text: string;
  position: number;
  line: number;
}

/**
 * (링크) 플레이스홀더 추출
 */
export function extractPlaceholderLinks(content: string): PlaceholderLink[] {
  const placeholders: PlaceholderLink[] = [];
  const lines = content.split('\n');

  let position = 0;
  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];
    let match: RegExpExecArray | null;

    const regex = new RegExp(PLACEHOLDER_LINK_REGEX.source, 'g');
    while ((match = regex.exec(line)) !== null) {
      const [fullMatch, text] = match;
      placeholders.push({
        fullMatch,
        text: text.trim(),
        position: position + match.index,
        line: lineNum + 1
      });
    }

    position += line.length + 1;
  }

  return placeholders;
}

/**
 * (링크) 플레이스홀더를 네이버 지도 링크로 변환
 */
export function processPlaceholderLinks(content: string): {
  content: string;
  processed: Array<{ text: string; url: string }>;
} {
  const placeholders = extractPlaceholderLinks(content);
  const processed: Array<{ text: string; url: string }> = [];

  if (placeholders.length === 0) {
    return { content, processed };
  }

  // 위치 역순으로 정렬
  const sorted = [...placeholders].sort((a, b) => b.position - a.position);

  let result = content;

  for (const placeholder of sorted) {
    const url = generateUrl('map', placeholder.text);
    const markdown = `[${placeholder.text}](${url})`;
    result = result.replace(placeholder.fullMatch, markdown);
    processed.push({ text: placeholder.text, url });
  }

  return { content: result, processed };
}

/**
 * 모든 링크 처리 (마커 + 플레이스홀더)
 */
export function processAllLinks(content: string): {
  content: string;
  markers: { processed: ProcessedLink[]; failed: LinkMarker[] };
  placeholders: Array<{ text: string; url: string }>;
} {
  // 1. [LINK:type:query] 마커 처리
  const markerResult = processLinksWithInfo(content);

  // 2. (링크) 플레이스홀더 처리
  const placeholderResult = processPlaceholderLinks(markerResult.content);

  return {
    content: placeholderResult.content,
    markers: {
      processed: markerResult.processed,
      failed: markerResult.failed
    },
    placeholders: placeholderResult.processed
  };
}

/**
 * (링크) 플레이스홀더 분석
 */
export function analyzePlaceholderLinks(content: string): number {
  return extractPlaceholderLinks(content).length;
}

// ============================================================
// AI 기반 장소 추출 및 링크 추가
// ============================================================

export interface ExtractedPlace {
  name: string;
  type: 'cafe' | 'restaurant' | 'attraction' | 'parking' | 'transport' | 'venue' | 'other';
  context: string;
}

/**
 * AI를 사용하여 콘텐츠에서 장소명 추출
 */
export async function extractPlacesWithAI(content: string): Promise<ExtractedPlace[]> {
  const prompt = `다음 블로그 포스트에서 네이버 지도에서 검색 가능한 실제 장소명을 추출해주세요.

## 추출 대상
- 카페, 음식점, 맛집 이름
- 관광지, 명소, 해변 이름
- 주차장, 터미널 등 시설명
- 미술관, 박물관, 공연장 등 문화시설

## 제외 대상
- 일반 명사 (예: "카페", "해변", "주차장")
- 지역명만 단독으로 (예: "강릉", "서울")
- 이미 링크가 걸려있는 장소 (예: [장소명](http...))

## 출력 형식
JSON 배열로 출력하세요. 장소가 없으면 빈 배열 []을 반환하세요.

\`\`\`json
[
  {"name": "장소명", "type": "cafe|restaurant|attraction|parking|transport|venue|other", "context": "본문에서 등장하는 문맥"}
]
\`\`\`

## 블로그 포스트
${content.slice(0, 8000)}
`;

  try {
    const response = await generate(prompt, {
      temperature: 0.3,
      max_tokens: 2048
    });

    // JSON 추출
    const jsonMatch = response.match(/```json\s*([\s\S]*?)```/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1]) as ExtractedPlace[];
      return Array.isArray(parsed) ? parsed : [];
    }

    // JSON 블록 없이 직접 배열인 경우
    const directMatch = response.match(/\[[\s\S]*\]/);
    if (directMatch) {
      const parsed = JSON.parse(directMatch[0]) as ExtractedPlace[];
      return Array.isArray(parsed) ? parsed : [];
    }

    return [];
  } catch (error) {
    console.error('AI 장소 추출 실패:', error);
    return [];
  }
}

/**
 * 이미 링크가 걸려있는 텍스트인지 확인
 */
function isAlreadyLinked(content: string, placeName: string): boolean {
  // [장소명](URL) 패턴 확인
  const linkPattern = new RegExp(`\\[${escapeRegex(placeName)}\\]\\([^)]+\\)`, 'i');
  return linkPattern.test(content);
}

/**
 * 정규식 특수문자 이스케이프
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 장소명에 링크 추가 (첫 번째 등장에만)
 */
export function addLinkToPlace(content: string, place: ExtractedPlace): {
  content: string;
  added: boolean;
} {
  // 이미 링크가 있으면 스킵
  if (isAlreadyLinked(content, place.name)) {
    return { content, added: false };
  }

  // 장소명 찾기 (단어 경계 고려)
  const placePattern = new RegExp(
    `(?<!\\[)${escapeRegex(place.name)}(?!\\]\\()`,
    'g'
  );

  const matches = content.match(placePattern);
  if (!matches || matches.length === 0) {
    return { content, added: false };
  }

  // 첫 번째 등장만 링크로 변환
  const url = generateUrl('map', place.name);
  const linkedText = `[${place.name}](${url})`;

  let replaced = false;
  const newContent = content.replace(placePattern, (match) => {
    if (!replaced) {
      replaced = true;
      return linkedText;
    }
    return match;
  });

  return { content: newContent, added: replaced };
}

/**
 * frontmatter 영역 분리
 */
function separateFrontmatter(content: string): {
  frontmatter: string;
  body: string;
} {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (frontmatterMatch) {
    return {
      frontmatter: `---\n${frontmatterMatch[1]}\n---\n`,
      body: frontmatterMatch[2]
    };
  }
  return { frontmatter: '', body: content };
}

/**
 * AI로 추출한 장소들에 링크 추가
 * frontmatter 영역은 제외하고 본문에만 링크 추가
 */
export async function enhanceWithLinks(content: string): Promise<{
  content: string;
  places: ExtractedPlace[];
  added: string[];
  skipped: string[];
}> {
  // frontmatter와 본문 분리
  const { frontmatter, body } = separateFrontmatter(content);

  // 1. AI로 장소 추출 (본문만 전달)
  const places = await extractPlacesWithAI(body);

  if (places.length === 0) {
    return { content, places: [], added: [], skipped: [] };
  }

  // 2. 본문에만 링크 추가
  let result = body;
  const added: string[] = [];
  const skipped: string[] = [];

  for (const place of places) {
    const { content: newContent, added: wasAdded } = addLinkToPlace(result, place);
    result = newContent;

    if (wasAdded) {
      added.push(place.name);
    } else {
      skipped.push(place.name);
    }
  }

  // frontmatter + 수정된 본문 합치기
  return { content: frontmatter + result, places, added, skipped };
}
