/**
 * content-parser.ts 테스트
 * 섹션 파싱 + 장소/키워드 추출 검증
 */

import { describe, it, expect } from 'vitest';
import { parseSections, extractImageMarkers, insertAutoMarkers, summarizeSectionNarrative, planImagePlacement } from './content-parser.js';

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

describe('planImagePlacement', () => {
  const blogContent = `
# 경주 불국사 깊이 보기

> **경주 불국사 핵심 요약** — 경주 불국사는 유네스코 세계문화유산입니다.

## 불국사의 역사와 건축

불국사는 751년에 창건되었다. **불국사** 대웅전은 신라 건축의 정수를 보여준다. 석가탑과 다보탑이 대표적인 국보이다.

## 석굴암 가는 길

석굴암은 불국사에서 버스로 15분 거리에 있다. **석굴암**의 본존불상은 동해를 바라보고 있다.

## 자주 묻는 질문

입장료는 성인 6,000원이다. 주차장은 무료이다.
`.trim();

  it('서사 기반 이미지 계획을 생성한다', () => {
    const plan = planImagePlacement(blogContent, 'travel', '경주 불국사', 3);
    expect(plan.entries.length).toBeLessThanOrEqual(3);
    expect(plan.totalSlots).toBe(3);
  });

  it('장소명이 있는 본문 섹션을 body_evidence로 분류한다', () => {
    // 본문 섹션이 더 많은 콘텐츠 (i>1인 장소 섹션 필요)
    const richContent = `
# 경주 완전 가이드

## 개요

경주는 신라의 수도였다.

## 불국사의 역사

**불국사**는 751년에 창건되었다. 석가탑과 다보탑이 유명하다.

## 석굴암 방문

**석굴암**은 불국사에서 버스로 15분이다. 본존불상이 동해를 바라보고 있다.

## 첨성대 산책

**첨성대**는 동양 최고의 천문대이다. 야경이 아름답다.

## 자주 묻는 질문

입장료는 6,000원이다.
`.trim();

    const plan = planImagePlacement(richContent, 'travel', '경주', 5);
    const evidenceEntries = plan.entries.filter(e => e.role === 'body_evidence');
    expect(evidenceEntries.length).toBeGreaterThan(0);
    // 장소명 있는 섹션은 preferKto=true
    for (const entry of evidenceEntries) {
      expect(entry.preferKto).toBe(true);
    }
  });

  it('마감 섹션을 closing_summary로 분류한다', () => {
    const plan = planImagePlacement(blogContent, 'travel', '경주 불국사', 5);
    const closingEntries = plan.entries.filter(e => e.role === 'closing_summary');
    // "자주 묻는 질문"은 마감 키워드에 매칭
    expect(closingEntries.some(e => e.sectionTitle.includes('자주'))).toBe(true);
  });

  it('subject에 범용 표현을 사용하지 않는다', () => {
    const plan = planImagePlacement(blogContent, 'travel', '경주 불국사', 3);
    for (const entry of plan.entries) {
      expect(entry.subject).not.toContain('현장 스틸컷');
      expect(entry.subject).not.toContain('감성 무드보드');
      expect(entry.subject.length).toBeGreaterThan(0);
    }
  });

  it('ktoSlots와 aiSlots 합이 entries 수와 일치한다', () => {
    const plan = planImagePlacement(blogContent, 'travel', '경주 불국사', 3, { ktoAvailable: 2 });
    expect(plan.ktoSlots + plan.aiSlots).toBe(plan.entries.length);
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
