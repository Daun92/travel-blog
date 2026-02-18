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

// ============================================================================
// 페르소나별 클리셰 대체안 DB
// 같은 클리셰를 4명이 자기 톤으로 다르게 바꾼다
// ============================================================================

const PERSONA_REPLACEMENTS: Record<string, Record<string, string>> = {
  // --- HIGH severity ---
  '과거와 현재가 공존': {
    viral:       '100년 된 건물인데 카페가 대박인',
    friendly:    '오래된 벽에 오후 햇살이 내려앉는',
    informative: '1920년대 건축물이 현대적 용도로 전환된',
    niche:       '벽 한 면에 세월이 켜켜이 쌓인',
  },
  '전통과 현대가 어우러진': {
    viral:       '한옥인데 에어컨 빵빵한',
    friendly:    '기와 사이로 오후의 빛이 갈라지는',
    informative: '전통 양식 위에 현대 설비를 접목한',
    niche:       '나무 기둥 사이로 네온 불빛이 새는',
  },
  '눈과 입이 즐거운': {
    viral:       '사진 찍다가 음식 식을 뻔한',
    friendly:    '접시 위에 창가 빛이 내려앉은',
    informative: '시각적 연출과 미각적 완성도를 동시에 갖춘',
    niche:       '플레이팅부터 이미 작품인',
  },
  '오감이 만족하는': {
    viral:       '눈·코·입 다 털린',
    friendly:    '바람과 빛과 소리가 한꺼번에 닿는',
    informative: '복합 감각 체험이 설계된',
    niche:       '발바닥 감촉까지 기억나는',
  },
  '힐링 여행/스팟': {
    viral:       '주말 탈출 가성비 명소',
    friendly:    '퇴근 후 멍때리기 좋은 곳',
    informative: '정신적 재충전이 가능한 장소',
    niche:       '아무도 없는 골목 끝 벤치',
  },
  '인생샷 명소': {
    viral:       'SNS에서 난리 난 뷰포인트',
    friendly:    '셔터 누르기 전에 먼저 서 있게 되는 곳',
    informative: '촬영 조건이 우수한 포인트',
    niche:       '아는 사람만 아는 앵글',
  },
  '감성 카페/공간': {
    viral:       'SNS에서 터진 카페',
    friendly:    '창으로 들어오는 빛이 좋은',
    informative: '공간 디자인에 의도가 읽히는',
    niche:       '사장님 취향이 벽면에 가득한',
  },
  '숨은 명소': {
    viral:       '아직 안 알려진 핫플',
    friendly:    '네이버에 안 나오는데 주차장은 꽉 찬',
    informative: '관광 안내서에 미등재된',
    niche:       '현지인도 설명 못 하는 골목 안쪽',
  },
  // --- MEDIUM severity ---
  '꼭 가봐야 할': {
    viral:       '안 가면 손해인',
    friendly:    '빛이 좋은 시간에 한번쯤 서 볼',
    informative: '방문 가치가 높은',
    niche:       '한 번 빠지면 재방문하게 되는',
  },
  '놓치면 후회할': {
    viral:       '패스하면 후회 각인',
    friendly:    '모르고 지나치면 좀 아까운',
    informative: '일정에 포함할 가치가 있는',
    niche:       '그냥 지나치면 영원히 모를',
  },
  '현지인 맛집': {
    viral:       '리뷰 0개인데 웨이팅 30분인',
    friendly:    '카카오맵 리뷰 3개인데 웨이팅 30분인',
    informative: '지역 주민 이용률이 높은 음식점',
    niche:       '단골만 아는 메뉴가 따로 있는',
  },
  '완전 대박': {
    viral:       '레전드급',
    friendly:    '걸음을 멈추게 하는',
    informative: '기대 이상의 결과를 보여준',
    niche:       '소름 돋을 정도로 좋았던',
  },
  '강추': {
    viral:       '무조건 가세요',
    friendly:    '빛이 좋은 날 다시 올',
    informative: '적극 권장하는',
    niche:       '깊이 들어갈수록 빠지는',
  },
  '꿀팁': {
    viral:       '이거 모르면 호구',
    friendly:    '알아두면 좋은 점',
    informative: '참고할 만한 정보',
    niche:       '아는 사람은 아는 포인트',
  },
  '핫플': {
    viral:       '지금 가장 뜨는 곳',
    friendly:    '요즘 사람 많은 곳',
    informative: '최근 방문객이 증가한 장소',
    niche:       '곧 사라질 수도 있는 공간',
  },
  '~의 매력에 빠져들다': {
    viral:       '~에 완전 꽂힌',
    friendly:    '~의 빛에 눈이 머물러서',
    informative: '~의 가치를 재발견한',
    niche:       '~의 깊이를 알게 된',
  },
  // --- LOW severity ---
  '다양한 볼거리': {
    viral:       '볼거리가 미친',
    friendly:    '구경할 게 ~개 정도 있는',
    informative: '복수의 관람 포인트가 배치된',
    niche:       '눈이 바빠지는',
  },
  '~만의 특별함': {
    viral:       '여기서만 가능한',
    friendly:    '다른 데랑 다른 점은',
    informative: '차별화된 특성은',
    niche:       '다른 곳에선 절대 못 느끼는',
  },
  '아늑한 분위기': {
    viral:       '분위기 대박인',
    friendly:    '낮은 조명 아래 소곤소곤 앉게 되는',
    informative: '소규모 공간에 적합한 동선의',
    niche:       '혼자 앉아도 어색하지 않은',
  },
  '운치 있는': {
    viral:       '감성 터지는',
    friendly:    '시간이 천천히 흐르는 느낌의',
    informative: '시간의 흔적이 공간에 반영된',
    niche:       '빛 바랜 벽이 이야기를 하는',
  },
  '여유로운 시간': {
    viral:       '시간 순삭되는',
    friendly:    '급하게 안 돌아다녀도 되는',
    informative: '충분한 체류 시간이 확보되는',
    niche:       '시계를 안 보게 되는',
  },
};

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

  // 1. 기본 패턴 검사 (페르소나별 대체안 우선 적용)
  const personaId = persona.id || 'friendly';
  for (const cliche of BASE_CLICHE_PATTERNS) {
    const matches = content.matchAll(cliche.pattern);
    for (const match of matches) {
      // 페르소나별 대체안이 있으면 우선 사용, 없으면 공통 대체안 폴백
      const personaSuggestion = PERSONA_REPLACEMENTS[cliche.text]?.[personaId]
        ?? cliche.suggestion;
      found.push({
        text: match[0],
        pattern: cliche.text,
        position: match.index || 0,
        suggestion: personaSuggestion,
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
 * 클리셰 자동 대체 (간단한 케이스만, 페르소나별 대체안 적용)
 */
export function replaceSimpleCliches(content: string, personaId?: string): string {
  let result = content;
  const pid = personaId || 'friendly';

  const simpleReplacements: [RegExp, string, string][] = [
    // [패턴, PERSONA_REPLACEMENTS 키, 공통 폴백]
    [/꿀팁/g, '꿀팁', '알아두면 좋은 점'],
    [/핫플(레이스)?/g, '핫플', '요즘 사람 많은 곳'],
    [/강추합니다?/g, '강추', '추천합니다'],
    [/완전 대박/g, '완전 대박', '예상보다 좋았던'],
  ];

  for (const [pattern, key, fallback] of simpleReplacements) {
    const replacement = PERSONA_REPLACEMENTS[key]?.[pid] ?? fallback;
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
