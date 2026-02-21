/**
 * 클레임 추출기
 * 마크다운 콘텐츠에서 팩트체크가 필요한 클레임을 추출
 */

import { ExtractedClaim, ClaimType, ClaimSeverity } from './types.js';

// 클레임 타입별 심각도 매핑
const SEVERITY_MAP: Record<ClaimType, ClaimSeverity> = {
  venue_exists: 'critical',
  location: 'critical',
  hours: 'major',
  event_period: 'major',
  price: 'minor',
  facilities: 'minor',
  contact: 'minor',
  transport: 'minor',
  heritage: 'major',
  trail: 'minor',
  general: 'minor'
};

// 클레임 추출 패턴
const CLAIM_PATTERNS: Array<{
  type: ClaimType;
  patterns: RegExp[];
  extractor?: (match: RegExpMatchArray, content: string) => string | null;
}> = [
  // 주소/위치 패턴
  {
    type: 'location',
    patterns: [
      /(?:주소|위치|장소)\s*[:：]\s*([^\n]+)/gi,
      /(?:서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)[시도]?\s+[가-힣]+(?:구|군|시)\s+[가-힣\s\d-]+/g,
      /([가-힣]+(?:로|길|대로)\s*\d+(?:-\d+)?(?:\s*\d+층)?)/g
    ]
  },

  // 운영시간 패턴
  {
    type: 'hours',
    patterns: [
      /(?:운영시간|영업시간|오픈|마감)\s*[:：]?\s*(\d{1,2}:\d{2}\s*[-~]\s*\d{1,2}:\d{2})/gi,
      /(\d{1,2}:\d{2}\s*[-~]\s*\d{1,2}:\d{2})/g,
      /(?:오전|오후)\s*\d{1,2}시\s*[-~]\s*(?:오전|오후)?\s*\d{1,2}시/g
    ]
  },

  // 휴무일 패턴
  {
    type: 'hours',
    patterns: [
      /(?:휴무|정기휴무|휴일|휴관)\s*[:：]?\s*([^\n]+)/gi,
      /매주\s*([월화수목금토일])요일\s*휴무/g
    ]
  },

  // 전시/이벤트 기간 패턴
  {
    type: 'event_period',
    patterns: [
      /(?:전시|기간|일정)\s*[:：]?\s*(\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}\s*[-~]\s*\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2})/gi,
      /(\d{1,2}월\s*\d{1,2}일\s*[-~]\s*\d{1,2}월\s*\d{1,2}일)/g,
      /(\d{4}년\s*\d{1,2}월\s*\d{1,2}일\s*[-~]\s*\d{1,2}월\s*\d{1,2}일)/g
    ]
  },

  // 가격 패턴
  {
    type: 'price',
    patterns: [
      /(?:가격|요금|입장료|티켓|비용)\s*[:：]?\s*(\d{1,3}(?:,\d{3})*\s*원)/gi,
      /(\d{1,3}(?:,\d{3})*\s*원)/g,
      /(?:무료|FREE|free)/gi
    ]
  },

  // 연락처 패턴
  {
    type: 'contact',
    patterns: [
      /(?:전화|연락처|문의)\s*[:：]?\s*(0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4})/gi,
      /(0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4})/g
    ]
  },

  // 층수/규모 패턴
  {
    type: 'facilities',
    patterns: [
      /(\d+)층\s*(?:건물|규모)?/g,
      /(?:좌석|수용)\s*(\d+)(?:석|명)/gi
    ]
  },

  // 교통/접근성 패턴
  {
    type: 'transport',
    patterns: [
      /([가-힣]+역)\s*(?:\d+번\s*출구|\d+번출구)/g,
      /(?:버스|지하철|전철)\s*[:：]?\s*([^\n]+)/gi
    ]
  }
];

/**
 * Frontmatter에서 클레임 추출
 */
function extractFromFrontmatter(frontmatter: Record<string, unknown>): ExtractedClaim[] {
  const claims: ExtractedClaim[] = [];
  let claimId = 0;

  // 장소 정보
  if (frontmatter.venue) {
    claims.push({
      id: `fm-${claimId++}`,
      type: 'venue_exists',
      text: `장소: ${frontmatter.venue}`,
      value: String(frontmatter.venue),
      severity: 'critical'
    });
  }

  // 주소
  if (frontmatter.address || frontmatter.location) {
    claims.push({
      id: `fm-${claimId++}`,
      type: 'location',
      text: `주소: ${frontmatter.address || frontmatter.location}`,
      value: String(frontmatter.address || frontmatter.location),
      severity: 'critical'
    });
  }

  // 운영시간
  if (frontmatter.openingHours || frontmatter.hours) {
    claims.push({
      id: `fm-${claimId++}`,
      type: 'hours',
      text: `운영시간: ${frontmatter.openingHours || frontmatter.hours}`,
      value: String(frontmatter.openingHours || frontmatter.hours),
      severity: 'major'
    });
  }

  // 가격
  if (frontmatter.ticketPrice || frontmatter.price) {
    claims.push({
      id: `fm-${claimId++}`,
      type: 'price',
      text: `가격: ${frontmatter.ticketPrice || frontmatter.price}`,
      value: String(frontmatter.ticketPrice || frontmatter.price),
      severity: 'minor'
    });
  }

  // 이벤트 기간
  if (frontmatter.eventDate || frontmatter.period) {
    claims.push({
      id: `fm-${claimId++}`,
      type: 'event_period',
      text: `기간: ${frontmatter.eventDate || frontmatter.period}`,
      value: String(frontmatter.eventDate || frontmatter.period),
      severity: 'major'
    });
  }

  return claims;
}

/**
 * 본문에서 클레임 추출
 */
function extractFromContent(content: string): ExtractedClaim[] {
  const claims: ExtractedClaim[] = [];
  const seenValues = new Set<string>();
  let claimId = 0;

  const lines = content.split('\n');

  for (const patternConfig of CLAIM_PATTERNS) {
    for (const pattern of patternConfig.patterns) {
      // 라인별로 매칭하여 라인 번호 추적
      lines.forEach((line, lineIndex) => {
        const matches = line.matchAll(new RegExp(pattern.source, pattern.flags));

        for (const match of matches) {
          const value = match[1] || match[0];
          const normalizedValue = value.trim().toLowerCase();

          // 중복 제거
          if (seenValues.has(normalizedValue)) continue;
          seenValues.add(normalizedValue);

          // 너무 짧은 값 필터링
          if (value.length < 3) continue;

          claims.push({
            id: `ct-${claimId++}`,
            type: patternConfig.type,
            text: match[0],
            value: value.trim(),
            severity: SEVERITY_MAP[patternConfig.type],
            context: line.trim(),
            lineNumber: lineIndex + 1
          });
        }
      });
    }
  }

  return claims;
}

/**
 * 클레임 우선순위 정렬
 */
function sortClaimsByPriority(claims: ExtractedClaim[]): ExtractedClaim[] {
  const priorityOrder: Record<ClaimSeverity, number> = {
    critical: 0,
    major: 1,
    minor: 2
  };

  return claims.sort((a, b) => {
    // 심각도 우선
    const severityDiff = priorityOrder[a.severity] - priorityOrder[b.severity];
    if (severityDiff !== 0) return severityDiff;

    // 같은 심각도면 타입별 정렬
    return a.type.localeCompare(b.type);
  });
}

/**
 * 중복 클레임 병합
 */
function deduplicateClaims(claims: ExtractedClaim[]): ExtractedClaim[] {
  const uniqueClaims = new Map<string, ExtractedClaim>();

  for (const claim of claims) {
    // 값 기준으로 중복 체크
    const key = `${claim.type}:${claim.value.toLowerCase()}`;

    if (!uniqueClaims.has(key)) {
      uniqueClaims.set(key, claim);
    } else {
      // 이미 있으면 더 높은 심각도 유지
      const existing = uniqueClaims.get(key)!;
      const severityOrder = { critical: 0, major: 1, minor: 2 };
      if (severityOrder[claim.severity] < severityOrder[existing.severity]) {
        uniqueClaims.set(key, claim);
      }
    }
  }

  return Array.from(uniqueClaims.values());
}

/**
 * 메인 클레임 추출 함수
 */
export function extractClaims(
  content: string,
  frontmatter: Record<string, unknown> = {}
): ExtractedClaim[] {
  // Frontmatter에서 추출
  const fmClaims = extractFromFrontmatter(frontmatter);

  // 본문에서 추출
  const contentClaims = extractFromContent(content);

  // 병합 및 중복 제거
  const allClaims = [...fmClaims, ...contentClaims];
  const uniqueClaims = deduplicateClaims(allClaims);

  // 우선순위 정렬
  return sortClaimsByPriority(uniqueClaims);
}

/**
 * 팩트체크 필요 여부 판단
 */
export function needsFactCheck(
  content: string,
  frontmatter: Record<string, unknown>
): boolean {
  // 장소/관광지 포스트
  if (frontmatter.venue || frontmatter.location || frontmatter.address) {
    return true;
  }

  // 전시/공연 포스트
  if (frontmatter.eventDate || frontmatter.ticketPrice || frontmatter.period) {
    return true;
  }

  // 본문에 검증 가능한 정보 포함
  const testPatterns = [
    /운영시간|영업시간/,
    /주소\s*[:：]/,
    /입장료|가격/,
    /\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}/  // 날짜 패턴
  ];

  return testPatterns.some(pattern => pattern.test(content));
}

/**
 * 클레임 통계 생성
 */
export function getClaimStats(claims: ExtractedClaim[]): {
  total: number;
  bySeverity: Record<ClaimSeverity, number>;
  byType: Record<ClaimType, number>;
} {
  const bySeverity: Record<ClaimSeverity, number> = {
    critical: 0,
    major: 0,
    minor: 0
  };

  const byType: Record<ClaimType, number> = {
    venue_exists: 0,
    location: 0,
    hours: 0,
    event_period: 0,
    price: 0,
    facilities: 0,
    contact: 0,
    transport: 0,
    heritage: 0,
    trail: 0,
    general: 0
  };

  for (const claim of claims) {
    bySeverity[claim.severity]++;
    byType[claim.type]++;
  }

  return {
    total: claims.length,
    bySeverity,
    byType
  };
}
