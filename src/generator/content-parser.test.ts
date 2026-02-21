/**
 * content-parser.ts 테스트
 * 섹션 파싱 + 장소/키워드 추출 검증
 */

import { describe, it, expect } from 'vitest';
import { parseSections, extractImageMarkers, insertAutoMarkers, summarizeSectionNarrative } from './content-parser.js';

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

describe('summarizeSectionNarrative', () => {
  it('섹션 본문에서 핵심 문장을 추출한다', () => {
    const content = '경복궁은 조선 왕조의 정궁으로 1395년에 창건되었다. 근정전은 왕의 즉위식이 열린 곳으로 웅장한 규모를 자랑한다. 경회루 연못에 비친 누각의 모습이 특히 아름답다. 주변에 많은 관광객이 방문한다.';
    const result = summarizeSectionNarrative(content, '경복궁 산책');
    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThanOrEqual(200);
    // 제목 키워드 '경복궁'이 포함된 문장이 우선 선택되어야 함
    expect(result).toContain('경복궁');
  });

  it('빈 콘텐츠는 빈 문자열 반환', () => {
    expect(summarizeSectionNarrative('', '제목')).toBe('');
    expect(summarizeSectionNarrative('   ', '제목')).toBe('');
  });

  it('마크다운 아티팩트를 제거한다', () => {
    const content = '**경복궁**은 아름답다. ![이미지](path.jpg) [LINK:map:경복궁] 근정전을 둘러보세요.';
    const result = summarizeSectionNarrative(content, '경복궁');
    expect(result).not.toContain('**');
    expect(result).not.toContain('![');
    expect(result).not.toContain('[LINK:');
  });

  it('200자 제한을 지킨다', () => {
    const longContent = '이 장소는 정말 아름다운 곳이다. '.repeat(30);
    const result = summarizeSectionNarrative(longContent, '장소');
    expect(result.length).toBeLessThanOrEqual(200);
  });

  it('비굵은 글씨 장소명도 추출한다 (Pass 2)', () => {
    const content = `
## 해운대 해변 투어

해운대해변은 부산의 대표적인 관광지입니다. 광안리해수욕장도 가볼 만합니다.
동백섬공원에서는 아름다운 해안 산책로를 걸을 수 있습니다.
`.trim();

    const sections = parseSections(content);
    const locations = sections[0].mentionedLocations ?? [];
    // 비굵은 글씨 복합 접미사 패턴도 추출되어야 함
    expect(locations).toContain('해운대해변');
    expect(locations).toContain('광안리해수욕장');
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
