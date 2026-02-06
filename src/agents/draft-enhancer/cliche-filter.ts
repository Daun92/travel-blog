/**
 * 클리셰 필터
 * AI 냄새 나는 표현 감지 및 대체 제안
 */

import { Persona } from './persona-loader.js';

// ============================================================================
// 타입 정의
// ============================================================================

export interface ClicheMatch {
  text: string;
  pattern: string;
  position: number;
  suggestion: string;
  severity: 'high' | 'medium' | 'low';
}

export interface ClicheReport {
  found: ClicheMatch[];
  score: number;  // 100 - (클리셰 수 * 가중치)
  summary: string;
}

// ============================================================================
// 클리셰 패턴 정의
// ============================================================================

interface ClichePattern {
  pattern: RegExp;
  text: string;
  suggestion: string;
  severity: 'high' | 'medium' | 'low';
}

// 기본 클리셰 패턴 (페르소나 설정과 별도로 항상 적용)
const BASE_CLICHE_PATTERNS: ClichePattern[] = [
  // 높은 심각도 - 전형적인 AI 표현
  {
    pattern: /과거와\s*현재가\s*(공존|어우러|만나)/g,
    text: '과거와 현재가 공존',
    suggestion: '1930년대 건물 옆에 요즘 핫한 카페가 붙어있는',
    severity: 'high'
  },
  {
    pattern: /전통과\s*현대가\s*(어우러|조화|만나)/g,
    text: '전통과 현대가 어우러진',
    suggestion: '한옥 사이에 유리벽 카페가 끼어있는',
    severity: 'high'
  },
  {
    pattern: /눈과\s*입이\s*(즐거운|행복)/g,
    text: '눈과 입이 즐거운',
    suggestion: '사진 찍느라 음식이 식었는데 그래도 맛있었던',
    severity: 'high'
  },
  {
    pattern: /오감이?\s*(만족|즐거운|행복)/g,
    text: '오감이 만족하는',
    suggestion: '보고, 먹고, 걷고 하루가 금방 간',
    severity: 'high'
  },
  {
    pattern: /힐링\s*(여행|스팟|명소|공간)/g,
    text: '힐링 여행/스팟',
    suggestion: '휴대폰 꺼놓고 멍때린',
    severity: 'high'
  },
  {
    pattern: /인생(샷|사진)\s*(명소|스팟|포인트)?/g,
    text: '인생샷 명소',
    suggestion: '친구들이 "어디야?" 물어본 곳',
    severity: 'high'
  },
  {
    pattern: /감성\s*(카페|공간|여행|숙소)/g,
    text: '감성 카페/공간',
    suggestion: '인테리어는 예쁜데 커피값은 센',
    severity: 'high'
  },
  {
    pattern: /숨은\s*(명소|맛집|보석|카페)/g,
    text: '숨은 명소',
    suggestion: '네이버에 안 나오는데 주차장은 꽉 찬',
    severity: 'high'
  },

  // 중간 심각도 - 흔한 블로그 표현
  {
    pattern: /꼭\s*(가봐야|먹어봐야|해봐야)\s*할/g,
    text: '꼭 가봐야 할',
    suggestion: '개인적으로 추천하는',
    severity: 'medium'
  },
  {
    pattern: /놓치면\s*(후회|아쉬울)/g,
    text: '놓치면 후회할',
    suggestion: '모르고 지나치면 좀 아까운',
    severity: 'medium'
  },
  {
    pattern: /현지인\s*(맛집|추천|단골)/g,
    text: '현지인 맛집',
    suggestion: '카카오맵 리뷰 3개인데 웨이팅 30분인',
    severity: 'medium'
  },
  {
    pattern: /완전\s*대박/g,
    text: '완전 대박',
    suggestion: '예상보다 훨씬 좋았던',
    severity: 'medium'
  },
  {
    pattern: /강추합니다?/g,
    text: '강추',
    suggestion: '다시 갈 것 같은',
    severity: 'medium'
  },
  {
    pattern: /꿀팁/g,
    text: '꿀팁',
    suggestion: '알아두면 좋은 점',
    severity: 'medium'
  },
  {
    pattern: /핫플(레이스)?/g,
    text: '핫플',
    suggestion: '요즘 사람 많은 곳',
    severity: 'medium'
  },
  {
    pattern: /~의\s*매력에\s*빠져/g,
    text: '~의 매력에 빠져들다',
    suggestion: '~가 생각보다 괜찮아서',
    severity: 'medium'
  },

  // 낮은 심각도 - 개선 권장
  {
    pattern: /다양한\s*(먹거리|볼거리|즐길거리)/g,
    text: '다양한 볼거리',
    suggestion: '구경할 게 ~개 정도 있는',
    severity: 'low'
  },
  {
    pattern: /~만의\s*특별함/g,
    text: '~만의 특별함',
    suggestion: '다른 데랑 다른 점은',
    severity: 'low'
  },
  {
    pattern: /아늑한\s*(분위기|공간)/g,
    text: '아늑한 분위기',
    suggestion: '테이블 간격이 좁아서 조용히 얘기할 수 있는',
    severity: 'low'
  },
  {
    pattern: /운치\s*있는/g,
    text: '운치 있는',
    suggestion: '오래된 느낌이 나는',
    severity: 'low'
  },
  {
    pattern: /여유로운\s*(시간|하루)/g,
    text: '여유로운 시간',
    suggestion: '급하게 안 돌아다녀도 되는',
    severity: 'low'
  }
];

// ============================================================================
// 클리셰 감지
// ============================================================================

/**
 * 클리셰 감지
 */
export function detectCliches(content: string, persona: Persona): ClicheReport {
  const found: ClicheMatch[] = [];

  // 1. 기본 패턴 검사
  for (const cliche of BASE_CLICHE_PATTERNS) {
    const matches = content.matchAll(cliche.pattern);
    for (const match of matches) {
      found.push({
        text: match[0],
        pattern: cliche.text,
        position: match.index || 0,
        suggestion: cliche.suggestion,
        severity: cliche.severity
      });
    }
  }

  // 2. 페르소나의 never_say 검사
  for (const phrase of persona.voice.never_say) {
    const escapedPhrase = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedPhrase, 'gi');
    const matches = content.matchAll(regex);

    for (const match of matches) {
      // 이미 기본 패턴에서 감지한 것은 제외
      if (!found.some(f => f.position === match.index)) {
        found.push({
          text: match[0],
          pattern: phrase,
          position: match.index || 0,
          suggestion: `구체적인 표현으로 대체 필요`,
          severity: 'high'
        });
      }
    }
  }

  // 점수 계산
  let score = 100;
  for (const cliche of found) {
    switch (cliche.severity) {
      case 'high':
        score -= 10;
        break;
      case 'medium':
        score -= 5;
        break;
      case 'low':
        score -= 2;
        break;
    }
  }
  score = Math.max(0, score);

  // 요약 생성
  const summary = found.length === 0
    ? '클리셰 없음. 고품질 콘텐츠입니다.'
    : `${found.length}개의 클리셰 발견 (높음: ${found.filter(f => f.severity === 'high').length}, 중간: ${found.filter(f => f.severity === 'medium').length}, 낮음: ${found.filter(f => f.severity === 'low').length})`;

  return { found, score, summary };
}

/**
 * 클리셰 자동 대체 (간단한 케이스만)
 */
export function replaceSimpleCliches(content: string): string {
  let result = content;

  const simpleReplacements: [RegExp, string][] = [
    [/꿀팁/g, '알아두면 좋은 점'],
    [/핫플(레이스)?/g, '요즘 사람 많은 곳'],
    [/강추합니다?/g, '추천합니다'],
    [/완전 대박/g, '예상보다 좋았던'],
  ];

  for (const [pattern, replacement] of simpleReplacements) {
    result = result.replace(pattern, replacement);
  }

  return result;
}

/**
 * 클리셰 리포트 포맷팅
 */
export function formatClicheReport(report: ClicheReport): string {
  if (report.found.length === 0) {
    return '✅ 클리셰 없음\n';
  }

  const lines: string[] = [
    `⚠️ 클리셰 ${report.found.length}개 발견 (점수: ${report.score}/100)`,
    ''
  ];

  // 심각도별 그룹핑
  const high = report.found.filter(f => f.severity === 'high');
  const medium = report.found.filter(f => f.severity === 'medium');
  const low = report.found.filter(f => f.severity === 'low');

  if (high.length > 0) {
    lines.push('🔴 높은 심각도:');
    for (const c of high) {
      lines.push(`   "${c.text}" → ${c.suggestion}`);
    }
    lines.push('');
  }

  if (medium.length > 0) {
    lines.push('🟡 중간 심각도:');
    for (const c of medium) {
      lines.push(`   "${c.text}" → ${c.suggestion}`);
    }
    lines.push('');
  }

  if (low.length > 0) {
    lines.push('🟢 낮은 심각도:');
    for (const c of low.slice(0, 5)) {
      lines.push(`   "${c.text}" → ${c.suggestion}`);
    }
    if (low.length > 5) {
      lines.push(`   ... 외 ${low.length - 5}개`);
    }
  }

  return lines.join('\n');
}

export default detectCliches;
