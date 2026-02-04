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
      const validStyles: ImageStyle[] = ['infographic', 'diagram', 'map', 'comparison', 'moodboard', 'bucketlist'];
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

/**
 * 콘텐츠를 섹션별로 파싱
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
  const suggestions: Array<{
    afterSection: string;
    style: ImageStyle;
    description: string;
  }> = [];

  // 여행 콘텐츠
  if (type === 'travel') {
    const sectionKeywords: Record<string, { style: ImageStyle; description: string }> = {
      '기본': { style: 'infographic', description: '교통-비용-시간 요약' },
      '교통': { style: 'diagram', description: '교통편 안내' },
      '정보': { style: 'infographic', description: '여행 정보 요약' },
      '코스': { style: 'map', description: '추천 코스 지도' },
      '일정': { style: 'map', description: '여행 일정 지도' },
      '추천': { style: 'map', description: '추천 스팟 지도' },
      '맛집': { style: 'comparison', description: '맛집 비교' },
      '카페': { style: 'comparison', description: '카페 비교' },
      '메뉴': { style: 'comparison', description: '메뉴 가격 비교' },
      '가격': { style: 'comparison', description: '가격 비교' }
    };

    for (const section of sections) {
      if (suggestions.length >= maxImages) break;

      for (const [keyword, suggestion] of Object.entries(sectionKeywords)) {
        if (section.title.includes(keyword)) {
          // 중복 스타일 방지
          if (!suggestions.some(s => s.style === suggestion.style)) {
            suggestions.push({
              afterSection: section.title,
              ...suggestion
            });
          }
          break;
        }
      }
    }
  }

  // 문화 콘텐츠
  if (type === 'culture') {
    const sectionKeywords: Record<string, { style: ImageStyle; description: string }> = {
      '기본': { style: 'infographic', description: '관람 정보 요약' },
      '정보': { style: 'infographic', description: '전시 정보 요약' },
      '관람': { style: 'diagram', description: '추천 관람 동선' },
      '포인트': { style: 'diagram', description: '관람 포인트 동선' },
      '작품': { style: 'infographic', description: '주요 작품 소개' },
      '티켓': { style: 'comparison', description: '티켓 종류 비교' },
      '예매': { style: 'infographic', description: '예매 정보 요약' }
    };

    for (const section of sections) {
      if (suggestions.length >= maxImages) break;

      for (const [keyword, suggestion] of Object.entries(sectionKeywords)) {
        if (section.title.includes(keyword)) {
          if (!suggestions.some(s => s.style === suggestion.style)) {
            suggestions.push({
              afterSection: section.title,
              ...suggestion
            });
          }
          break;
        }
      }
    }
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
