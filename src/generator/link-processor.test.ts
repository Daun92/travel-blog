/**
 * 링크 프로세서 테스트
 */

import { describe, it, expect } from 'vitest';
import {
  extractLinkMarkers,
  generateUrl,
  markerToMarkdown,
  processLinks,
  removeLinkMarkers,
  analyzeLinkMarkers,
  processLinksWithInfo,
  processLinksByType
} from './link-processor.js';

describe('extractLinkMarkers', () => {
  it('기본 마커 추출', () => {
    const content = '방문하세요 [LINK:map:성산일출봉]';
    const markers = extractLinkMarkers(content);

    expect(markers).toHaveLength(1);
    expect(markers[0].type).toBe('map');
    expect(markers[0].query).toBe('성산일출봉');
    expect(markers[0].displayText).toBeUndefined();
  });

  it('표시 텍스트 포함 마커 추출', () => {
    const content = '예매: [LINK:booking:뮤지컬 오페라의 유령:인터파크에서 예매]';
    const markers = extractLinkMarkers(content);

    expect(markers).toHaveLength(1);
    expect(markers[0].type).toBe('booking');
    expect(markers[0].query).toBe('뮤지컬 오페라의 유령');
    expect(markers[0].displayText).toBe('인터파크에서 예매');
  });

  it('여러 마커 추출', () => {
    const content = `
      장소: [LINK:map:국립현대미술관]
      예매: [LINK:booking:전시 티켓]
      공식: [LINK:official:https://www.mmca.go.kr:공식 사이트]
    `;
    const markers = extractLinkMarkers(content);

    expect(markers).toHaveLength(3);
    expect(markers.map(m => m.type)).toEqual(['map', 'booking', 'official']);
  });

  it('잘못된 타입은 무시', () => {
    const content = '[LINK:invalid:테스트] [LINK:map:유효한 마커]';
    const markers = extractLinkMarkers(content);

    expect(markers).toHaveLength(1);
    expect(markers[0].type).toBe('map');
  });
});

describe('generateUrl', () => {
  it('네이버 지도 URL 생성', () => {
    const url = generateUrl('map', '성산일출봉');
    expect(url).toBe('https://map.naver.com/v5/search/%EC%84%B1%EC%82%B0%EC%9D%BC%EC%B6%9C%EB%B4%89');
  });

  it('네이버 검색 URL 생성', () => {
    const url = generateUrl('place', '제주 올레길');
    expect(url).toContain('search.naver.com');
    expect(url).toContain('query=');
  });

  it('인터파크 티켓 URL 생성', () => {
    const url = generateUrl('booking', '뮤지컬');
    expect(url).toContain('ticket.interpark.com');
  });

  it('예스24 티켓 URL 생성', () => {
    const url = generateUrl('yes24', '공연');
    expect(url).toContain('yes24.com');
  });

  it('공식 URL은 그대로 반환', () => {
    const url = generateUrl('official', 'https://www.example.com');
    expect(url).toBe('https://www.example.com');
  });
});

describe('markerToMarkdown', () => {
  it('기본 마크다운 링크 생성', () => {
    const marker = {
      marker: '[LINK:map:성산일출봉]',
      type: 'map' as const,
      query: '성산일출봉',
      position: 0,
      line: 1
    };
    const markdown = markerToMarkdown(marker);

    expect(markdown).toMatch(/\[성산일출봉\]\(https:\/\/map\.naver\.com/);
  });

  it('표시 텍스트가 있으면 사용', () => {
    const marker = {
      marker: '[LINK:map:성산일출봉:일출봉 지도]',
      type: 'map' as const,
      query: '성산일출봉',
      displayText: '일출봉 지도',
      position: 0,
      line: 1
    };
    const markdown = markerToMarkdown(marker);

    expect(markdown).toMatch(/\[일출봉 지도\]/);
  });
});

describe('processLinks', () => {
  it('모든 링크 마커 변환', () => {
    const content = `
# 제주도 여행

성산일출봉은 [LINK:map:성산일출봉]에서 확인하세요.
자세한 정보는 [LINK:official:https://www.visitjeju.net:제주관광공사]를 참고하세요.
    `;
    const result = processLinks(content);

    expect(result).not.toContain('[LINK:');
    expect(result).toContain('[성산일출봉](https://map.naver.com');
    expect(result).toContain('[제주관광공사](https://www.visitjeju.net)');
  });

  it('마커가 없으면 그대로 반환', () => {
    const content = '일반 텍스트입니다.';
    const result = processLinks(content);

    expect(result).toBe(content);
  });
});

describe('removeLinkMarkers', () => {
  it('마커를 텍스트로 대체', () => {
    const content = '방문: [LINK:map:성산일출봉] 추천';
    const result = removeLinkMarkers(content);

    expect(result).toBe('방문: 성산일출봉 추천');
  });

  it('표시 텍스트가 있으면 표시 텍스트 사용', () => {
    const content = '예매: [LINK:booking:뮤지컬:인터파크 예매]';
    const result = removeLinkMarkers(content);

    expect(result).toBe('예매: 인터파크 예매');
  });
});

describe('analyzeLinkMarkers', () => {
  it('마커 분석 결과 반환', () => {
    const content = `
      [LINK:map:장소1]
      [LINK:map:장소2]
      [LINK:booking:공연]
      [LINK:official:https://example.com:공식]
    `;
    const analysis = analyzeLinkMarkers(content);

    expect(analysis.totalMarkers).toBe(4);
    expect(analysis.byType.map).toBe(2);
    expect(analysis.byType.booking).toBe(1);
    expect(analysis.byType.official).toBe(1);
    expect(analysis.markers).toHaveLength(4);
  });
});

describe('processLinksWithInfo', () => {
  it('처리 결과 정보 반환', () => {
    const content = '[LINK:map:성산일출봉] [LINK:booking:뮤지컬]';
    const result = processLinksWithInfo(content);

    expect(result.processed).toHaveLength(2);
    expect(result.failed).toHaveLength(0);
    expect(result.content).not.toContain('[LINK:');
  });
});

describe('processLinksByType', () => {
  it('특정 타입만 처리', () => {
    const content = '[LINK:map:장소] [LINK:booking:공연]';
    const result = processLinksByType(content, ['map']);

    expect(result).not.toContain('[LINK:map:');
    expect(result).toContain('[LINK:booking:');
  });
});
