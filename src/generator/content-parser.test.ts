/**
 * content-parser.ts 테스트
 * 섹션 파싱 + 장소/키워드 추출 검증
 */

import { describe, it, expect } from 'vitest';
import { parseSections, extractImageMarkers, insertAutoMarkers } from './content-parser.js';

describe('parseSections - 장소/키워드 추출', () => {
  const sampleContent = `
## 경복궁 산책

**경복궁**은 서울의 대표적인 궁궐입니다. 근정전과 경회루를 둘러보세요.

## 북촌 한옥마을 탐방

**북촌한옥마을**의 좁은 골목을 거닐며 전통 가옥을 감상할 수 있습니다.
**삼청동거리**에서 카페와 갤러리를 즐겨보세요.

## 예술의전당 전시

**예술의전당**에서 현대미술 전시를 관람하고 **한가람미술관**도 방문해보세요.
`.trim();

  it('섹션별 mentionedLocations를 추출한다', () => {
    const sections = parseSections(sampleContent);
    expect(sections).toHaveLength(3);

    // 첫 번째 섹션: 경복궁
    expect(sections[0].title).toBe('경복궁 산책');
    expect(sections[0].mentionedLocations).toBeDefined();
    // 경복궁은 LOCATION_SUFFIX_REGEX의 '궁'으로 매칭
    expect(sections[0].mentionedLocations).toContain('경복궁');

    // 두 번째 섹션: 북촌 한옥마을 → 마을, 거리
    expect(sections[1].mentionedLocations).toContain('북촌한옥마을');
    expect(sections[1].mentionedLocations).toContain('삼청동거리');
  });

  it('섹션별 sectionKeywords를 추출한다', () => {
    const sections = parseSections(sampleContent);

    // 첫 번째 섹션 키워드에 "경복궁", "근정전" 등이 포함되어야 함
    expect(sections[0].sectionKeywords).toBeDefined();
    expect(sections[0].sectionKeywords!.length).toBeGreaterThan(0);
  });

  it('장소가 없는 섹션은 빈 배열', () => {
    const plainContent = `
## 여행 팁

짐은 가볍게 싸세요. 편한 신발을 신으세요.
`.trim();

    const sections = parseSections(plainContent);
    expect(sections[0].mentionedLocations).toEqual([]);
  });

  it('기존 ContentSection 필드가 유지된다', () => {
    const sections = parseSections(sampleContent);
    expect(sections[0]).toHaveProperty('title');
    expect(sections[0]).toHaveProperty('level');
    expect(sections[0]).toHaveProperty('startLine');
    expect(sections[0]).toHaveProperty('endLine');
    expect(sections[0]).toHaveProperty('content');
  });
});

describe('extractImageMarkers', () => {
  it('유효한 마커를 추출한다', () => {
    const content = `
## 섹션 1
[IMAGE:infographic:교통-비용-시간 요약]
## 섹션 2
[IMAGE:diagram:관람 동선]
`;
    const markers = extractImageMarkers(content);
    expect(markers).toHaveLength(2);
    expect(markers[0].style).toBe('infographic');
    expect(markers[1].style).toBe('diagram');
  });
});
