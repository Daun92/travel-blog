/**
 * 실용 링크 처리 모듈
 * 마크다운 콘텐츠에서 링크 마커를 실제 URL 링크로 변환
 * AI 기반 장소명 추출 및 자동 링크 추가
 */

import { generate } from './gemini.js';
import matter from 'gray-matter';

export interface LinkMarker {
  marker: string;
  type: LinkType;
  query: string;
  displayText?: string;
  position: number;
  line: number;
}

export type LinkType = 'map' | 'place' | 'booking' | 'yes24' | 'official' | 'info';

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
 * AI 추출 결과 (내부 상세 타입)
 */
export interface AIExtractionResult {
  places: ExtractedPlace[];
  truncated: boolean;
  error?: string;
}

/**
 * 링크 타입별 URL 템플릿
 */
const URL_TEMPLATES: Record<LinkType, (query: string) => string> = {
  map: (query) => `https://map.naver.com/v5/search/${encodeURIComponent(query)}`,
  place: (query) => `https://search.naver.com/search.naver?where=nexearch&query=${encodeURIComponent(query)}`,
  booking: (query) => `https://ticket.interpark.com/search?q=${encodeURIComponent(query)}`,
  yes24: (query) => `https://www.yes24.com/Product/Search?query=${encodeURIComponent(query)}`,
  official: (query) => query, // 직접 URL 사용
  info: (query) => `https://korean.visitkorea.or.kr/search/search_list.do?keyword=${encodeURIComponent(query)}`,
};

/**
 * 링크 마커 정규식 (대소문자 무관 — gi 플래그)
 * 형식: [LINK:type:query] 또는 [LINK:type:query:표시텍스트]
 */
const LINK_MARKER_OFFICIAL_REGEX = /\[LINK:official:(https?:\/\/[^\]:\s]+)(?::([^\]\n]+))?\]/gi;
const LINK_MARKER_STANDARD_REGEX = /\[LINK:(map|place|booking|yes24|info):([^\]:\n]+)(?::([^\]\n]+))?\]/gi;

/**
 * 유효한 링크 타입 목록
 */
const VALID_LINK_TYPES: LinkType[] = ['map', 'place', 'booking', 'yes24', 'official', 'info'];

const CONTENT_TRUNCATION_LIMIT = 8000;

// ============================================================
// URL 검증
// ============================================================

/**
 * URL 유효성 검증
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// ============================================================
// Frontmatter 파싱 (gray-matter 기반 + fallback)
// ============================================================

/**
 * frontmatter 영역 분리 (크로스플랫폼 호환)
 * gray-matter 사용으로 \r\n, BOM 등 처리
 */
function separateFrontmatter(content: string): {
  frontmatter: string;
  body: string;
} {
  try {
    const parsed = matter(content);
    // gray-matter가 파싱에 성공하면 원본 frontmatter를 재구성
    if (parsed.data && Object.keys(parsed.data).length > 0) {
      return {
        frontmatter: parsed.matter ? `---\n${parsed.matter}\n---\n` : '',
        body: parsed.content
      };
    }
  } catch {
    // gray-matter 실패 시 fallback
  }

  // Fallback: 수동 파싱 (\r\n 호환)
  const normalized = content.replace(/\r\n/g, '\n');
  const frontmatterMatch = normalized.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (frontmatterMatch) {
    return {
      frontmatter: `---\n${frontmatterMatch[1]}\n---\n`,
      body: frontmatterMatch[2]
    };
  }
  return { frontmatter: '', body: content };
}

/**
 * 텍스트가 frontmatter 영역 내부인지 확인
 */
function getFrontmatterEndIndex(content: string): number {
  const normalized = content.replace(/\r\n/g, '\n');
  const match = normalized.match(/^---\n[\s\S]*?\n---\n/);
  return match ? match[0].length : 0;
}

// ============================================================
// 링크 마커 추출 및 변환
// ============================================================

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

    // official 타입 마커 찾기 (URL 포함, 대소문자 무관)
    const officialRegex = new RegExp(LINK_MARKER_OFFICIAL_REGEX.source, 'gi');
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

    // 일반 타입 마커 찾기 (대소문자 무관)
    const standardRegex = new RegExp(LINK_MARKER_STANDARD_REGEX.source, 'gi');
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
 * 링크 마커를 실제 URL로 변환 (URL 검증 포함)
 */
export function generateUrl(type: LinkType, query: string): string {
  const template = URL_TEMPLATES[type];
  if (!template) {
    throw new Error(`Unknown link type: ${type}`);
  }
  const url = template(query);

  // official 타입은 사용자 제공 URL이므로 검증
  if (type === 'official' && !isValidUrl(url)) {
    throw new Error(`Invalid URL for official link: ${query}`);
  }

  return url;
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
  let result = content.replace(
    new RegExp(LINK_MARKER_OFFICIAL_REGEX.source, 'gi'),
    (_match: string, url: string, displayText?: string) => {
      return displayText?.trim() || url.trim();
    }
  );

  // 일반 타입 마커 제거
  result = result.replace(
    new RegExp(LINK_MARKER_STANDARD_REGEX.source, 'gi'),
    (_match: string, _type: string, query: string, displayText?: string) => {
      return displayText?.trim() || query.trim();
    }
  );

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
    official: 0,
    info: 0,
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
 * 모든 링크 처리 (마커 + 플레이스홀더) — 에러 격리
 */
export function processAllLinks(content: string): {
  content: string;
  markers: { processed: ProcessedLink[]; failed: LinkMarker[] };
  placeholders: Array<{ text: string; url: string }>;
  errors: string[];
} {
  const errors: string[] = [];
  let currentContent = content;

  // 1. [LINK:type:query] 마커 처리 (에러 격리)
  let markerResult: { content: string; processed: ProcessedLink[]; failed: LinkMarker[] };
  try {
    markerResult = processLinksWithInfo(currentContent);
    currentContent = markerResult.content;
  } catch (error) {
    errors.push(`마커 처리 실패: ${error instanceof Error ? error.message : error}`);
    markerResult = { content: currentContent, processed: [], failed: [] };
  }

  // 2. (링크) 플레이스홀더 처리 (에러 격리)
  let placeholderResult: { content: string; processed: Array<{ text: string; url: string }> };
  try {
    placeholderResult = processPlaceholderLinks(currentContent);
    currentContent = placeholderResult.content;
  } catch (error) {
    errors.push(`플레이스홀더 처리 실패: ${error instanceof Error ? error.message : error}`);
    placeholderResult = { content: currentContent, processed: [] };
  }

  return {
    content: currentContent,
    markers: {
      processed: markerResult.processed,
      failed: markerResult.failed
    },
    placeholders: placeholderResult.processed,
    errors
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
 * JSON 안전 파싱 (필드 검증 포함)
 */
function safeParseJSON(text: string): ExtractedPlace[] {
  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item: unknown): item is Record<string, unknown> =>
        typeof item === 'object' && item !== null &&
        typeof (item as Record<string, unknown>).name === 'string' &&
        ((item as Record<string, unknown>).name as string).trim().length > 0
      )
      .map((item: Record<string, unknown>) => ({
        name: (item.name as string).trim(),
        type: (item.type as ExtractedPlace['type']) || 'other',
        context: typeof item.context === 'string' ? item.context : ''
      }));
  } catch {
    return [];
  }
}

/**
 * AI 응답 파싱 (3단계: JSON코드블록 → 배어배열 → 빈배열)
 */
function parseAIResponse(response: string): ExtractedPlace[] {
  // 1단계: JSON 코드블록
  const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    const result = safeParseJSON(jsonMatch[1]);
    if (result.length > 0) return result;
  }

  // 2단계: 배어 JSON 배열
  const directMatch = response.match(/\[[\s\S]*\]/);
  if (directMatch) {
    const result = safeParseJSON(directMatch[0]);
    if (result.length > 0) return result;
  }

  // 3단계: 빈 배열 반환
  return [];
}

/**
 * 장소 중복 제거 (대소문자 무관)
 */
function deduplicatePlaces(places: ExtractedPlace[]): ExtractedPlace[] {
  const seen = new Set<string>();
  return places.filter(place => {
    const key = place.name.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * AI를 사용하여 콘텐츠에서 장소명 추출 (내부 상세 버전)
 */
async function extractPlacesWithAIInternal(content: string): Promise<AIExtractionResult> {
  const truncated = content.length > CONTENT_TRUNCATION_LIMIT;
  if (truncated) {
    console.warn(`[link-processor] 콘텐츠 ${content.length}자 → ${CONTENT_TRUNCATION_LIMIT}자로 절단됨`);
  }

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

## 주의사항
- 중복된 장소명을 절대 포함하지 마세요
- 2자 미만의 장소명은 제외하세요

## 출력 형식
JSON 배열로 출력하세요. 장소가 없으면 빈 배열 []을 반환하세요.

\`\`\`json
[
  {"name": "장소명", "type": "cafe|restaurant|attraction|parking|transport|venue|other", "context": "본문에서 등장하는 문맥"}
]
\`\`\`

## 블로그 포스트
${content.slice(0, CONTENT_TRUNCATION_LIMIT)}
`;

  try {
    const response = await generate(prompt, {
      temperature: 0.2,
      max_tokens: 2048
    });

    const places = deduplicatePlaces(parseAIResponse(response));
    return { places, truncated };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[link-processor] AI 장소 추출 실패:', errorMsg);
    return { places: [], truncated, error: errorMsg };
  }
}

/**
 * AI를 사용하여 콘텐츠에서 장소명 추출 (하위호환 래퍼)
 */
export async function extractPlacesWithAI(content: string): Promise<ExtractedPlace[]> {
  const result = await extractPlacesWithAIInternal(content);
  return result.places;
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
 * 텍스트 위치가 마크다운 링크 내부인지 확인
 * [text](url) 패턴 내부이면 true
 */
function isInsideMarkdownLink(content: string, matchIndex: number, matchLength: number): boolean {
  // 매치 이전 텍스트에서 가장 가까운 [ 와 ]( 찾기
  const before = content.slice(0, matchIndex);
  const after = content.slice(matchIndex + matchLength);

  // [text](url) 패턴에서 text 부분에 있는지 확인
  const lastOpenBracket = before.lastIndexOf('[');
  const lastCloseBracket = before.lastIndexOf(']');

  if (lastOpenBracket > lastCloseBracket) {
    // [ 이후에 ] 없이 매치가 발생 → 링크 텍스트 내부일 가능성
    const afterMatch = content.slice(matchIndex + matchLength);
    if (/^\s*\]\(/.test(afterMatch) || /\]\([^)]+\)/.test(afterMatch.slice(0, 200))) {
      return true;
    }
  }

  // ](url) 패턴에서 url 부분에 있는지 확인
  const parenBefore = before.lastIndexOf('](');
  const closeParen = after.indexOf(')');
  if (parenBefore >= 0 && closeParen >= 0) {
    const afterParen = before.slice(parenBefore);
    if (!afterParen.includes(')')) {
      return true; // URL 내부
    }
  }

  return false;
}

/**
 * 장소명에 링크 추가 (첫 번째 등장에만)
 * 한국어 호환: 위치 기반 스캔, frontmatter/마크다운 링크 내부 방지
 */
export function addLinkToPlace(content: string, place: ExtractedPlace): {
  content: string;
  added: boolean;
} {
  // 2자 미만 장소명 스킵
  if (place.name.trim().length < 2) {
    return { content, added: false };
  }

  // 이미 링크가 있으면 스킵
  if (isAlreadyLinked(content, place.name)) {
    return { content, added: false };
  }

  const frontmatterEnd = getFrontmatterEndIndex(content);
  const searchContent = content.slice(frontmatterEnd);

  // 위치 기반 스캔으로 장소명 찾기 (한국어 호환)
  const escapedName = escapeRegex(place.name);
  const placePattern = new RegExp(escapedName, 'g');

  let match: RegExpExecArray | null;
  let firstValidIndex = -1;

  while ((match = placePattern.exec(searchContent)) !== null) {
    const absIndex = frontmatterEnd + match.index;

    // 마크다운 링크 내부인지 확인
    if (isInsideMarkdownLink(content, absIndex, match[0].length)) {
      continue;
    }

    firstValidIndex = absIndex;
    break;
  }

  if (firstValidIndex < 0) {
    return { content, added: false };
  }

  // 첫 번째 유효 위치에 링크 삽입
  const url = generateUrl('map', place.name);
  const linkedText = `[${place.name}](${url})`;

  const newContent =
    content.slice(0, firstValidIndex) +
    linkedText +
    content.slice(firstValidIndex + place.name.length);

  return { content: newContent, added: true };
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
  truncated?: boolean;
  error?: string;
}> {
  // frontmatter와 본문 분리
  const { frontmatter, body } = separateFrontmatter(content);

  // 1. AI로 장소 추출 (본문만 전달, 상세 결과)
  const extraction = await extractPlacesWithAIInternal(body);

  if (extraction.places.length === 0) {
    return {
      content,
      places: [],
      added: [],
      skipped: [],
      truncated: extraction.truncated,
      error: extraction.error
    };
  }

  // 2. 본문에만 링크 추가 (개별 try-catch로 격리)
  let result = body;
  const added: string[] = [];
  const skipped: string[] = [];

  for (const place of extraction.places) {
    try {
      const { content: newContent, added: wasAdded } = addLinkToPlace(result, place);
      result = newContent;

      if (wasAdded) {
        added.push(place.name);
      } else {
        skipped.push(place.name);
      }
    } catch (error) {
      console.warn(`[link-processor] 장소 링크 추가 실패 (${place.name}):`, error);
      skipped.push(place.name);
    }
  }

  // frontmatter + 수정된 본문 합치기
  return {
    content: frontmatter + result,
    places: extraction.places,
    added,
    skipped,
    truncated: extraction.truncated,
    error: extraction.error
  };
}
