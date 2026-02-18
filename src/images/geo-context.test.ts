/**
 * geo-context.ts 테스트
 * 지리적 스코프 추출 + 호환성 검증
 */

import { describe, it, expect } from 'vitest';
import { extractGeoScope, isGeoCompatible, normalizeRegion, type GeoScope } from './geo-context.js';

describe('normalizeRegion', () => {
  it('광역시/도 정식 명칭을 정규화한다', () => {
    expect(normalizeRegion('서울특별시')).toBe('서울');
    expect(normalizeRegion('제주특별자치도')).toBe('제주');
    expect(normalizeRegion('강원특별자치도')).toBe('강원');
  });

  it('약칭을 정규화한다', () => {
    expect(normalizeRegion('서울')).toBe('서울');
    expect(normalizeRegion('경기도')).toBe('경기');
    expect(normalizeRegion('충남')).toBe('충남');
  });

  it('시/군을 광역 단위로 매핑한다', () => {
    expect(normalizeRegion('전주')).toBe('전북');
    expect(normalizeRegion('경주')).toBe('경북');
    expect(normalizeRegion('강릉')).toBe('강원');
    expect(normalizeRegion('여수')).toBe('전남');
    expect(normalizeRegion('통영')).toBe('경남');
  });

  it('알 수 없는 지역은 null 반환', () => {
    expect(normalizeRegion('뉴욕')).toBeNull();
    expect(normalizeRegion('')).toBeNull();
  });
});

describe('extractGeoScope', () => {
  it('주제에서 주요 지역을 추출한다', () => {
    const scope = extractGeoScope('서울의 도자기 공방을 찾아서', '서울 도자기 체험');
    expect(scope.primaryRegion).toBe('서울');
    expect(scope.mentionedRegions).toContain('서울');
    expect(scope.isMultiRegion).toBe(false);
  });

  it('본문의 시/군도 인식한다', () => {
    const content = '전주 한옥마을에서 시작해 군산 근대문화거리까지';
    const scope = extractGeoScope(content, '전북 여행');
    expect(scope.primaryRegion).toBe('전북');
    expect(scope.mentionedRegions).toContain('전북');
  });

  it('멀티지역 포스트를 식별한다 (TOP 5 리스트)', () => {
    const content = `
## 1. 서울 경복궁
서울의 대표 궁궐
## 2. 경주 불국사
경북의 세계문화유산
## 3. 제주 성산일출봉
제주도의 랜드마크
## 4. 부산 해운대
해변 도시의 매력
    `;
    const scope = extractGeoScope(content, '한국 여행지 TOP 5');
    expect(scope.isMultiRegion).toBe(true);
    expect(scope.mentionedRegions.length).toBeGreaterThanOrEqual(3);
  });

  it('주제의 지역명에 더 높은 가중치를 부여한다', () => {
    // 주제는 "서울", 본문에 "전주"가 한 번 언급
    const content = '전주에서 유명한 비빔밥을 먹고 서울로 돌아왔다';
    const scope = extractGeoScope(content, '서울 주말 나들이');
    expect(scope.primaryRegion).toBe('서울');
  });

  it('지역 정보가 없으면 null', () => {
    const scope = extractGeoScope('맛있는 음식을 먹었다', '맛집 추천');
    expect(scope.primaryRegion).toBeNull();
    expect(scope.mentionedRegions).toHaveLength(0);
  });
});

describe('isGeoCompatible', () => {
  const seoulScope: GeoScope = {
    primaryRegion: '서울',
    mentionedRegions: ['서울'],
    isMultiRegion: false,
  };

  const multiScope: GeoScope = {
    primaryRegion: '서울',
    mentionedRegions: ['서울', '경기', '강원'],
    isMultiRegion: true,
  };

  it('같은 지역이면 호환', () => {
    expect(isGeoCompatible('서울특별시 종로구 세종로 1-1', seoulScope)).toBe(true);
  });

  it('다른 지역이면 불호환', () => {
    expect(isGeoCompatible('전라북도 전주시 완산구 풍남동', seoulScope)).toBe(false);
  });

  it('주소가 없으면 보수적으로 호환 판정', () => {
    expect(isGeoCompatible(undefined, seoulScope)).toBe(true);
    expect(isGeoCompatible('', seoulScope)).toBe(true);
  });

  it('primaryRegion이 없으면 호환 판정', () => {
    const emptyScope: GeoScope = {
      primaryRegion: null,
      mentionedRegions: [],
      isMultiRegion: false,
    };
    expect(isGeoCompatible('전라북도 전주시', emptyScope)).toBe(true);
  });

  it('멀티지역 포스트는 어떤 지역이든 허용', () => {
    expect(isGeoCompatible('제주특별자치도 서귀포시', multiScope)).toBe(true);
  });

  it('mentionedRegions에 포함된 지역이면 호환', () => {
    expect(isGeoCompatible('강원도 강릉시', multiScope)).toBe(true);
  });
});

describe('동명 지역 맥락 기반 판별', () => {
  it('광주 + 무등산 맥락 → 광주광역시로 해소', () => {
    const content = '광주 무등산 등반 후 충장로에서 저녁';
    const scope = extractGeoScope(content, '광주 여행');
    expect(scope.primaryRegion).toBe('광주');
    // 경기가 포함되지 않아야 함
    expect(scope.mentionedRegions).not.toContain('경기');
  });

  it('광주 + 남한산성 맥락 → 경기도 광주시로 해소', () => {
    const content = '광주 남한산성 둘레길 걷기';
    const scope = extractGeoScope(content, '광주 남한산성');
    expect(scope.mentionedRegions).toContain('경기');
  });

  it('고성 + DMZ 맥락 → 강원도 고성, 공룡 맥락 → 경남 고성', () => {
    const scopeGangwon = extractGeoScope('고성 통일전망대에서 금강산 조망', '고성 DMZ 투어');
    expect(scopeGangwon.mentionedRegions).toContain('강원');

    const scopeGyeongnam = extractGeoScope('고성 상족암 공룡발자국 화석', '고성 공룡 탐방');
    expect(scopeGyeongnam.mentionedRegions).toContain('경남');
  });

  it('맥락 단서 없으면 두 지역 모두 허용 (보수적 폴백)', () => {
    const scope = extractGeoScope('', '광주 맛집');
    // 단서 없이 "광주"만 → 광주+경기 둘 다 mentionedRegions에 포함
    expect(scope.mentionedRegions).toContain('광주');
    expect(scope.mentionedRegions).toContain('경기');

    // 두 지역 모두 호환 판정
    expect(isGeoCompatible('광주광역시 동구', scope)).toBe(true);
    expect(isGeoCompatible('경기도 광주시 곤지암', scope)).toBe(true);
  });
});
