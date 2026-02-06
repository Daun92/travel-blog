/**
 * 디테일 수준 분석기
 * 콘텐츠의 구체성과 실용성 분석
 */

import { Persona } from './persona-loader.js';

// ============================================================================
// 타입 정의
// ============================================================================

export interface DetailAnalysis {
  score: number;  // 0-100

  // 숫자 관련
  specificNumbers: number;
  numberTypes: {
    time: number;      // 시간 (분, 시간)
    money: number;     // 금액 (원, 만원)
    distance: number;  // 거리 (m, km, 분 거리)
    waiting: number;   // 대기 (분, 팀)
    quantity: number;  // 수량 (개, 명)
  };

  // 스토리텔링 요소
  hasFailureStory: boolean;
  hasComparison: boolean;
  hasSubjectiveJudgment: boolean;
  hasTimeline: boolean;

  // 실용 정보
  hasTransportInfo: boolean;
  hasPriceInfo: boolean;
  hasWaitingInfo: boolean;
  hasRecommendation: boolean;

  // 부족한 요소
  missingDetails: string[];

  // 품질 지표
  qualityIndicators: {
    good: string[];
    bad: string[];
  };
}

// ============================================================================
// 패턴 정의
// ============================================================================

// 숫자 패턴
const NUMBER_PATTERNS = {
  time: [
    /(\d+)\s*분/g,
    /(\d+)\s*시간/g,
    /(\d+)\s*시\s*(\d+)\s*분/g,
    /오전\s*(\d+)\s*시/g,
    /오후\s*(\d+)\s*시/g,
    /(\d+)\s*박\s*(\d+)\s*일/g
  ],
  money: [
    /(\d{1,3}(,\d{3})*)\s*원/g,
    /(\d+)\s*만\s*원/g,
    /약\s*(\d+)\s*만원/g,
    /총\s*(\d{1,3}(,\d{3})*)\s*원/g
  ],
  distance: [
    /(\d+)\s*m/gi,
    /(\d+(\.\d+)?)\s*km/gi,
    /도보\s*(\d+)\s*분/g,
    /(\d+)\s*분\s*거리/g
  ],
  waiting: [
    /웨이팅\s*(\d+)\s*분/g,
    /대기\s*(\d+)\s*분/g,
    /(\d+)\s*팀\s*대기/g,
    /(\d+)\s*분\s*(기다|대기)/g
  ],
  quantity: [
    /(\d+)\s*개/g,
    /(\d+)\s*명/g,
    /(\d+)\s*곳/g,
    /(\d+)\s*가지/g
  ]
};

// 실패/불편 패턴
const FAILURE_PATTERNS = [
  /실수/,
  /아쉬[웠운]/,
  /불편/,
  /헤맸/,
  /잘못/,
  /후회/,
  /실패/,
  /예상과\s*달[랐리]/,
  /생각보다\s*(안|별로|그닥)/,
  /솔직히\s*(별로|그닥|안)/,
  /다음에[는]?\s*(안|바꿀)/,
  /근데\s*문제는/,
  /단점/
];

// 비교 패턴
const COMPARISON_PATTERNS = [
  /보다\s*(더|덜|비싸|싸|좋|나[았쁜])/,
  /에\s*비해/,
  /반면/,
  /차이[가는]/,
  /vs/i,
  /기대[와]?\s*(달리|다르)/,
  /예상[과와]?\s*(달리|다르)/,
  /다른\s*곳[과은]?\s*(다르|비교)/,
  /옆\s*(가게|집|곳)/
];

// 주관적 판단 패턴
const SUBJECTIVE_PATTERNS = [
  /솔직히/,
  /개인적으로/,
  /내\s*생각[에은]/,
  /~것\s*같[다아]/,
  /추천[은]?\s*(안|드리)/,
  /다시\s*(갈|안\s*갈)/,
  /모르겠/
];

// 시간순 패턴
const TIMELINE_PATTERNS = [
  /(\d+)\s*시\s*(\d+)?\s*분?\s*(에|쯤|경)/,
  /오전|오후/,
  /첫\s*번째|두\s*번째|세\s*번째/,
  /먼저|그\s*다음|마지막/,
  /1일[차]?|2일[차]?/,
  /도착\s*후/
];

// ============================================================================
// 분석 함수
// ============================================================================

/**
 * 디테일 수준 분석
 */
export function analyzeDetailLevel(
  content: string,
  persona: Persona,
  contentType: 'travel' | 'culture'
): DetailAnalysis {
  // 숫자 분석
  const numberTypes = {
    time: countMatches(content, NUMBER_PATTERNS.time),
    money: countMatches(content, NUMBER_PATTERNS.money),
    distance: countMatches(content, NUMBER_PATTERNS.distance),
    waiting: countMatches(content, NUMBER_PATTERNS.waiting),
    quantity: countMatches(content, NUMBER_PATTERNS.quantity)
  };

  const specificNumbers = Object.values(numberTypes).reduce((a, b) => a + b, 0);

  // 스토리텔링 요소
  const hasFailureStory = FAILURE_PATTERNS.some(p => p.test(content));
  const hasComparison = COMPARISON_PATTERNS.some(p => p.test(content));
  const hasSubjectiveJudgment = SUBJECTIVE_PATTERNS.some(p => p.test(content));
  const hasTimeline = TIMELINE_PATTERNS.some(p => p.test(content));

  // 실용 정보
  const hasTransportInfo = /KTX|버스|지하철|택시|도보|출구|역/.test(content);
  const hasPriceInfo = numberTypes.money > 0;
  const hasWaitingInfo = numberTypes.waiting > 0 || /웨이팅|대기|줄/.test(content);
  const hasRecommendation = /추천|권장|다시\s*(갈|가)|좋았/.test(content);

  // 부족한 요소 분석
  const missingDetails = analyzeMissingDetails(
    persona,
    contentType,
    {
      specificNumbers,
      hasFailureStory,
      hasComparison,
      hasTransportInfo,
      hasPriceInfo,
      hasWaitingInfo
    }
  );

  // 품질 지표 분석
  const qualityIndicators = analyzeQualityIndicators(content, persona, {
    specificNumbers,
    hasFailureStory,
    hasComparison,
    hasSubjectiveJudgment
  });

  // 점수 계산
  const score = calculateDetailScore({
    specificNumbers,
    hasFailureStory,
    hasComparison,
    hasSubjectiveJudgment,
    hasTimeline,
    hasTransportInfo,
    hasPriceInfo,
    hasWaitingInfo,
    missingDetails,
    persona
  });

  return {
    score,
    specificNumbers,
    numberTypes,
    hasFailureStory,
    hasComparison,
    hasSubjectiveJudgment,
    hasTimeline,
    hasTransportInfo,
    hasPriceInfo,
    hasWaitingInfo,
    hasRecommendation,
    missingDetails,
    qualityIndicators
  };
}

/**
 * 패턴 매칭 카운트
 */
function countMatches(content: string, patterns: RegExp[]): number {
  let count = 0;
  for (const pattern of patterns) {
    const matches = content.match(pattern);
    if (matches) {
      count += matches.length;
    }
  }
  return count;
}

/**
 * 부족한 디테일 분석
 */
function analyzeMissingDetails(
  persona: Persona,
  contentType: 'travel' | 'culture',
  analysis: {
    specificNumbers: number;
    hasFailureStory: boolean;
    hasComparison: boolean;
    hasTransportInfo: boolean;
    hasPriceInfo: boolean;
    hasWaitingInfo: boolean;
  }
): string[] {
  const missing: string[] = [];

  // 페르소나 필수 요소 체크
  if (analysis.specificNumbers < persona.detailing_rules.number_requirements.min_specific_numbers) {
    missing.push(`구체적 숫자 부족 (현재 ${analysis.specificNumbers}개, 최소 ${persona.detailing_rules.number_requirements.min_specific_numbers}개 필요)`);
  }

  if (persona.detailing_rules.failure_story_required && !analysis.hasFailureStory) {
    missing.push('실패/불편 경험 없음 - 하나 이상 추가 필요');
  }

  if (persona.detailing_rules.comparison_required && !analysis.hasComparison) {
    missing.push('비교 문장 없음 - 다른 곳과의 비교 추가 필요');
  }

  // 콘텐츠 타입별 체크
  const variant = persona.content_type_variants[contentType];

  if (contentType === 'travel') {
    if (!analysis.hasTransportInfo) {
      missing.push('교통 정보 없음 - 서울 출발 기준 이동 방법 추가');
    }
    if (!analysis.hasPriceInfo) {
      missing.push('가격 정보 없음 - 실제 지출 금액 추가');
    }
    if (!analysis.hasWaitingInfo) {
      missing.push('혼잡도/웨이팅 정보 없음 - 주말 기준 대기 시간 추가');
    }
  }

  return missing;
}

/**
 * 품질 지표 분석
 */
function analyzeQualityIndicators(
  content: string,
  persona: Persona,
  analysis: {
    specificNumbers: number;
    hasFailureStory: boolean;
    hasComparison: boolean;
    hasSubjectiveJudgment: boolean;
  }
): { good: string[]; bad: string[] } {
  const good: string[] = [];
  const bad: string[] = [];

  // Good signs
  if (analysis.specificNumbers >= 5) {
    good.push('구체적 숫자 충분');
  }
  if (analysis.hasFailureStory) {
    good.push('실패/불편 경험 포함');
  }
  if (analysis.hasComparison) {
    good.push('비교 문장 포함');
  }
  if (analysis.hasSubjectiveJudgment) {
    good.push('주관적 판단 포함');
  }

  // 시그니처 문구 사용 체크
  const usedSignatures = persona.voice.signature_phrases.filter(p =>
    content.includes(p)
  );
  if (usedSignatures.length > 0) {
    good.push(`페르소나 시그니처 사용 (${usedSignatures.length}개)`);
  }

  // Bad signs
  if (analysis.specificNumbers < 3) {
    bad.push('구체적 숫자 매우 부족');
  }
  if (!analysis.hasFailureStory && !analysis.hasComparison) {
    bad.push('모든 것이 긍정적 - 진정성 부족');
  }

  // 클리셰 사용 체크 (간단 버전)
  const usedCliches = persona.voice.never_say.filter(phrase =>
    content.toLowerCase().includes(phrase.toLowerCase())
  );
  if (usedCliches.length > 0) {
    bad.push(`금지 표현 사용 (${usedCliches.length}개)`);
  }

  return { good, bad };
}

/**
 * 디테일 점수 계산
 */
function calculateDetailScore(params: {
  specificNumbers: number;
  hasFailureStory: boolean;
  hasComparison: boolean;
  hasSubjectiveJudgment: boolean;
  hasTimeline: boolean;
  hasTransportInfo: boolean;
  hasPriceInfo: boolean;
  hasWaitingInfo: boolean;
  missingDetails: string[];
  persona: Persona;
}): number {
  let score = 50;  // 기본 점수

  // 숫자 (최대 +20)
  const minNumbers = params.persona.detailing_rules.number_requirements.min_specific_numbers;
  const numberScore = Math.min(20, (params.specificNumbers / minNumbers) * 20);
  score += numberScore;

  // 스토리텔링 요소 (최대 +20)
  if (params.hasFailureStory) score += 8;
  if (params.hasComparison) score += 7;
  if (params.hasSubjectiveJudgment) score += 5;

  // 실용 정보 (최대 +15)
  if (params.hasTransportInfo) score += 5;
  if (params.hasPriceInfo) score += 5;
  if (params.hasWaitingInfo) score += 5;

  // 시간순 구성 (최대 +5)
  if (params.hasTimeline) score += 5;

  // 부족 요소 감점 (최대 -10)
  score -= Math.min(10, params.missingDetails.length * 3);

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * 디테일 분석 리포트 포맷팅
 */
export function formatDetailReport(analysis: DetailAnalysis): string {
  const lines: string[] = [
    `📊 디테일 점수: ${analysis.score}/100`,
    ''
  ];

  // 숫자 통계
  lines.push('📝 구체적 숫자:');
  lines.push(`   총 ${analysis.specificNumbers}개`);
  lines.push(`   - 시간: ${analysis.numberTypes.time}개`);
  lines.push(`   - 금액: ${analysis.numberTypes.money}개`);
  lines.push(`   - 거리: ${analysis.numberTypes.distance}개`);
  lines.push(`   - 대기: ${analysis.numberTypes.waiting}개`);
  lines.push('');

  // 스토리텔링 요소
  lines.push('📖 스토리텔링:');
  lines.push(`   실패/불편담: ${analysis.hasFailureStory ? '✅' : '❌'}`);
  lines.push(`   비교 문장: ${analysis.hasComparison ? '✅' : '❌'}`);
  lines.push(`   주관적 판단: ${analysis.hasSubjectiveJudgment ? '✅' : '❌'}`);
  lines.push(`   시간순 구성: ${analysis.hasTimeline ? '✅' : '❌'}`);
  lines.push('');

  // 실용 정보
  lines.push('🔧 실용 정보:');
  lines.push(`   교통: ${analysis.hasTransportInfo ? '✅' : '❌'}`);
  lines.push(`   가격: ${analysis.hasPriceInfo ? '✅' : '❌'}`);
  lines.push(`   혼잡도: ${analysis.hasWaitingInfo ? '✅' : '❌'}`);
  lines.push('');

  // 부족한 요소
  if (analysis.missingDetails.length > 0) {
    lines.push('⚠️ 개선 필요:');
    for (const detail of analysis.missingDetails) {
      lines.push(`   - ${detail}`);
    }
    lines.push('');
  }

  // 품질 지표
  if (analysis.qualityIndicators.good.length > 0) {
    lines.push('✅ 좋은 점:');
    for (const item of analysis.qualityIndicators.good) {
      lines.push(`   - ${item}`);
    }
  }

  if (analysis.qualityIndicators.bad.length > 0) {
    lines.push('❌ 개선점:');
    for (const item of analysis.qualityIndicators.bad) {
      lines.push(`   - ${item}`);
    }
  }

  return lines.join('\n');
}

export default analyzeDetailLevel;
