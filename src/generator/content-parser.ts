/**
 * 콘텐츠 파서 모듈
 * 마크다운 콘텐츠에서 이미지 삽입 지점 파싱 및 이미지 삽입
 */

import type { ImageStyle } from '../images/gemini-imagen.js';

export interface ImageMarker {
  marker: string;
  style: ImageStyle;
  description: string;
  position: number;
  line: number;
}

export interface ParsedContent {
  content: string;
  markers: ImageMarker[];
  sections: ContentSection[];
}

export interface ContentSection {
  title: string;
  level: number;
  startLine: number;
  endLine: number;
  content: string;
  /** 섹션 본문에서 추출된 장소명 */
  mentionedLocations?: string[];
  /** 섹션 헤딩+본문에서 추출된 핵심 키워드 */
  sectionKeywords?: string[];
}

export interface ImageResult {
  marker: ImageMarker;
  relativePath: string;
  alt: string;
  caption: string;
}

const IMAGE_MARKER_REGEX = /\[IMAGE:(\w+):([^\]]+)\]/g;
const HEADING_REGEX = /^(#{1,6})\s+(.+)$/;

/**
 * 콘텐츠에서 이미지 마커 추출
 */
export function extractImageMarkers(content: string): ImageMarker[] {
  const markers: ImageMarker[] = [];
  const lines = content.split('\n');

  let position = 0;
  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];
    let match: RegExpExecArray | null;

    // 각 줄에서 마커 찾기
    const regex = new RegExp(IMAGE_MARKER_REGEX.source, 'g');
    while ((match = regex.exec(line)) !== null) {
      const [fullMatch, styleStr, description] = match;
      const style = styleStr as ImageStyle;

      // 유효한 스타일인지 확인
      const validStyles: ImageStyle[] = ['infographic', 'diagram', 'map', 'comparison', 'moodboard', 'bucketlist', 'cover_photo'];
      if (validStyles.includes(style)) {
        markers.push({
          marker: fullMatch,
          style,
          description: description.trim(),
          position: position + match.index,
          line: lineNum + 1
        });
      }
    }

    position += line.length + 1; // +1 for newline
  }

  return markers;
}

/** 장소/시설 이름 패턴 (한국어) */
const LOCATION_SUFFIX_REGEX = /(?:[관점원장역사당궁각실집루대탑문교산천호섬항포곶]|해변|해수욕장|시장|거리|마을|길|골목|카페|갤러리|미술관|박물관|공원|사찰|절|성|궁|전시관|기념관|수목원|식물원|동물원|수족관|해양관|공연장)$/;

/**
 * 텍스트에서 장소명 후보 추출 (굵은 글씨, 고유명사 패턴)
 */
function extractLocationsFromText(text: string): string[] {
  const locations: string[] = [];
  const seen = new Set<string>();

  // **장소명** 패턴
  const boldRegex = /\*\*([^*]{2,25})\*\*/g;
  let match;
  while ((match = boldRegex.exec(text)) !== null) {
    const name = match[1].trim();
    if (LOCATION_SUFFIX_REGEX.test(name) && !seen.has(name)) {
      seen.add(name);
      locations.push(name);
    }
  }

  return locations;
}

/**
 * 텍스트에서 핵심 키워드 추출 (2자+ 한글 명사, 불용어 제거)
 */
function extractKeywordsFromText(title: string, body: string): string[] {
  const combined = `${title} ${body}`;
  // 한글 단어 추출 (2자 이상)
  const words = combined.match(/[가-힣]{2,}/g) || [];
  const stopwords = new Set([
    '그리고', '하지만', '그래서', '때문에', '이라는', '있는', '없는', '것은',
    '하는', '되는', '이런', '저런', '여기', '저기', '위한', '대한', '통해',
    '따라', '관한', '같은', '다른', '모든', '어떤', '함께', '그런', '이미',
    '바로', '가장', '정말', '아주', '매우', '특히', '또한', '이후', '이전',
  ]);

  const counts = new Map<string, number>();
  for (const w of words) {
    if (!stopwords.has(w)) {
      counts.set(w, (counts.get(w) || 0) + 1);
    }
  }

  // 헤딩에 나온 단어 가중치 2배
  const titleWords = title.match(/[가-힣]{2,}/g) || [];
  for (const tw of titleWords) {
    if (counts.has(tw)) {
      counts.set(tw, (counts.get(tw) || 0) + 2);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);
}

/**
 * 콘텐츠를 섹션별로 파싱
 * 각 섹션에 장소명과 핵심 키워드도 추출
 */
export function parseSections(content: string): ContentSection[] {
  const sections: ContentSection[] = [];
  const lines = content.split('\n');

  let currentSection: ContentSection | null = null;
  let contentBuffer: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headingMatch = line.match(HEADING_REGEX);

    if (headingMatch) {
      // 이전 섹션 저장
      if (currentSection) {
        currentSection.endLine = i;
        currentSection.content = contentBuffer.join('\n').trim();
        currentSection.mentionedLocations = extractLocationsFromText(currentSection.content);
        currentSection.sectionKeywords = extractKeywordsFromText(currentSection.title, currentSection.content);
        sections.push(currentSection);
        contentBuffer = [];
      }

      // 새 섹션 시작
      currentSection = {
        title: headingMatch[2].trim(),
        level: headingMatch[1].length,
        startLine: i + 1,
        endLine: lines.length,
        content: ''
      };
    } else if (currentSection) {
      contentBuffer.push(line);
    }
  }

  // 마지막 섹션 저장
  if (currentSection) {
    currentSection.endLine = lines.length;
    currentSection.content = contentBuffer.join('\n').trim();
    currentSection.mentionedLocations = extractLocationsFromText(currentSection.content);
    currentSection.sectionKeywords = extractKeywordsFromText(currentSection.title, currentSection.content);
    sections.push(currentSection);
  }

  return sections;
}

/**
 * 콘텐츠 전체 파싱
 */
export function parseContent(content: string): ParsedContent {
  return {
    content,
    markers: extractImageMarkers(content),
    sections: parseSections(content)
  };
}

/**
 * 마커 위치에 이미지 삽입
 */
export function insertImages(content: string, images: ImageResult[]): string {
  if (images.length === 0) return content;

  // 마커를 위치 역순으로 정렬 (뒤에서부터 교체하여 위치 변경 방지)
  const sortedImages = [...images].sort((a, b) => b.marker.position - a.marker.position);

  let result = content;

  for (const image of sortedImages) {
    const { marker, relativePath, alt, caption } = image;

    // 마크다운 이미지 문법으로 변환
    const imageMarkdown = `\n![${alt}](${relativePath})\n*${caption}*\n`;

    // 마커 교체
    result = result.replace(marker.marker, imageMarkdown);
  }

  return result;
}

/**
 * 이미지 마커 없이 콘텐츠 반환 (이미지 생성 실패 시)
 */
export function removeImageMarkers(content: string): string {
  return content.replace(IMAGE_MARKER_REGEX, '').replace(/\n{3,}/g, '\n\n');
}

/**
 * 섹션별 적절한 이미지 위치 추천
 */
export function suggestImagePositions(
  content: string,
  type: 'travel' | 'culture',
  maxImages: number = 3
): Array<{
  afterSection: string;
  style: ImageStyle;
  description: string;
}> {
  const sections = parseSections(content);
  if (sections.length === 0) return [];

  // ── 이미 이미지가 있는 섹션 식별 ──
  const hasImage = (s: ContentSection) => /!\[.*?\]\(/.test(s.content);

  // ── 마감/보조 섹션 키워드 (일러스트 배치 대상) ──
  const closingKeywords = ['자주', 'FAQ', '비용', '정산', '마무리', '여운', '요약', '가이드', '질문'];

  // ── 섹션 분류: intro / body / closing ──
  const introIndices: number[] = [];
  const bodyIndices: number[] = [];
  const closingIndices: number[] = [];

  for (let i = 0; i < sections.length; i++) {
    if (hasImage(sections[i])) continue; // 이미 이미지 있으면 스킵

    const isClosing = closingKeywords.some(k => sections[i].title.includes(k));

    if (i <= 1 && !isClosing) {
      introIndices.push(i);
    } else if (isClosing || i >= sections.length - 1) {
      closingIndices.push(i);
    } else {
      bodyIndices.push(i);
    }
  }

  const suggestions: Array<{
    afterSection: string;
    style: ImageStyle;
    description: string;
  }> = [];
  let remaining = maxImages;

  // ── 1. 도입 일러스트 (최대 1장) ──
  if (introIndices.length > 0 && remaining > 0) {
    const section = sections[introIndices[0]];
    const introStyles: Record<string, ImageStyle> = {
      travel: 'moodboard',
      culture: 'diagram',
    };
    suggestions.push({
      afterSection: section.title,
      style: introStyles[type] ?? 'moodboard',
      description: type === 'travel' ? '여행지 감성 무드보드' : '전시 감성 다이어그램',
    });
    remaining--;
  }

  // ── 2. 본문 스틸컷 (나머지 슬롯 - 마감 1장 예약) ──
  const closingReserve = closingIndices.length > 0 ? 1 : 0;
  const bodySlots = Math.min(bodyIndices.length, Math.max(0, remaining - closingReserve));

  for (let i = 0; i < bodySlots; i++) {
    const section = sections[bodyIndices[i]];
    // 섹션 콘텐츠에서 피사체 추출: 장소명 > 키워드 > 헤딩 텍스트
    const subject = section.mentionedLocations?.[0]
      || section.sectionKeywords?.[0]
      || section.title.replace(/^[#\s\d.:]+/, '').trim();
    suggestions.push({
      afterSection: section.title,
      style: 'cover_photo',
      description: `${subject} 현장 스틸컷`,
    });
    remaining--;
  }

  // ── 3. 마감 일러스트 (최대 1장) ──
  if (closingIndices.length > 0 && remaining > 0) {
    const section = sections[closingIndices[0]];
    suggestions.push({
      afterSection: section.title,
      style: 'infographic',
      description: type === 'travel' ? '여행 준비 가이드' : '관람 정보 요약',
    });
    remaining--;
  }

  return suggestions;
}

/**
 * 자동 이미지 마커 삽입
 * 콘텐츠에 마커가 없을 때 적절한 위치에 자동 삽입
 */
export function insertAutoMarkers(
  content: string,
  type: 'travel' | 'culture',
  maxImages: number = 3
): string {
  // 이미 마커가 있으면 그대로 반환
  const existingMarkers = extractImageMarkers(content);
  if (existingMarkers.length > 0) {
    return content;
  }

  const suggestions = suggestImagePositions(content, type, maxImages);
  if (suggestions.length === 0) {
    return content;
  }

  const lines = content.split('\n');
  const sections = parseSections(content);
  const insertions: Array<{ lineNum: number; marker: string }> = [];

  for (const suggestion of suggestions) {
    const section = sections.find(s => s.title === suggestion.afterSection);
    if (section) {
      const marker = `[IMAGE:${suggestion.style}:${suggestion.description}]`;
      insertions.push({
        lineNum: section.endLine,
        marker
      });
    }
  }

  // 역순으로 삽입하여 라인 번호 변경 방지
  insertions.sort((a, b) => b.lineNum - a.lineNum);

  for (const insertion of insertions) {
    lines.splice(insertion.lineNum, 0, '', insertion.marker, '');
  }

  return lines.join('\n');
}
