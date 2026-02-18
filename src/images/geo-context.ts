/**
 * 지리적 스코프 추출 + 호환성 검증 모듈
 * 포스트 본문/주제에서 지역 정보를 추출하고,
 * KTO 이미지의 주소와 교차 검증하여 미스매치 차단
 */

// ─── 타입 정의 ────────────────────────────────────────────────────

export interface GeoScope {
  /** 주요 지역 (가장 자주 언급되는 광역 단위) */
  primaryRegion: string | null;
  /** 본문에서 언급된 모든 지역 */
  mentionedRegions: string[];
  /** 여러 지역을 다루는 포스트인지 (TOP 5 리스트 등) */
  isMultiRegion: boolean;
}

// ─── 한국 행정구역 ────────────────────────────────────────────────

/** 17개 광역시/도 + 흔히 사용되는 약칭/별칭 매핑 */
const REGION_ALIASES: Record<string, string> = {
  // 특별시/광역시
  '서울': '서울',
  '서울특별시': '서울',
  '서울시': '서울',
  '부산': '부산',
  '부산광역시': '부산',
  '대구': '대구',
  '대구광역시': '대구',
  '인천': '인천',
  '인천광역시': '인천',
  '광주': '광주',
  '광주광역시': '광주',
  '대전': '대전',
  '대전광역시': '대전',
  '울산': '울산',
  '울산광역시': '울산',
  '세종': '세종',
  '세종특별자치시': '세종',
  '세종시': '세종',

  // 도
  '경기': '경기',
  '경기도': '경기',
  '강원': '강원',
  '강원도': '강원',
  '강원특별자치도': '강원',
  '충북': '충북',
  '충청북도': '충북',
  '충남': '충남',
  '충청남도': '충남',
  '전북': '전북',
  '전라북도': '전북',
  '전북특별자치도': '전북',
  '전남': '전남',
  '전라남도': '전남',
  '경북': '경북',
  '경상북도': '경북',
  '경남': '경남',
  '경상남도': '경남',
  '제주': '제주',
  '제주도': '제주',
  '제주특별자치도': '제주',
};

/** 주요 시/군 → 광역 매핑 (자주 언급되는 관광지 도시) */
const CITY_TO_REGION: Record<string, string> = {
  // 경기도 (주의: '광주'와 '양평'은 동명 지역 — AMBIGUOUS_CITIES에서 별도 처리)
  '수원': '경기', '성남': '경기', '고양': '경기', '용인': '경기',
  '파주': '경기', '가평': '경기', '포천': '경기',
  '화성': '경기', '이천': '경기', '여주': '경기', '안산': '경기',

  // 강원도 (주의: '고성'은 동명 지역 — AMBIGUOUS_CITIES에서 별도 처리)
  '춘천': '강원', '원주': '강원', '강릉': '강원', '속초': '강원',
  '동해': '강원', '삼척': '강원', '태백': '강원', '정선': '강원',
  '평창': '강원', '양양': '강원', '인제': '강원', '홍천': '강원',
  '횡성': '강원', '영월': '강원', '철원': '강원', '화천': '강원',

  // 충청남도
  '천안': '충남', '아산': '충남', '공주': '충남', '보령': '충남',
  '서산': '충남', '논산': '충남', '당진': '충남', '부여': '충남',
  '태안': '충남', '예산': '충남', '홍성': '충남',

  // 충청북도
  '청주': '충북', '충주': '충북', '제천': '충북', '단양': '충북',
  '옥천': '충북', '보은': '충북', '괴산': '충북', '영동': '충북',

  // 전라북도
  '전주': '전북', '군산': '전북', '익산': '전북', '남원': '전북',
  '정읍': '전북', '김제': '전북', '무주': '전북', '진안': '전북',
  '부안': '전북', '고창': '전북', '장수': '전북', '순창': '전북',
  '완주': '전북', '임실': '전북',

  // 전라남도
  '목포': '전남', '여수': '전남', '순천': '전남', '광양': '전남',
  '나주': '전남', '담양': '전남', '곡성': '전남', '구례': '전남',
  '보성': '전남', '화순': '전남', '장흥': '전남', '해남': '전남',
  '강진': '전남', '완도': '전남', '진도': '전남', '신안': '전남',
  '영광': '전남', '영암': '전남', '무안': '전남',

  // 경상북도
  '포항': '경북', '경주': '경북', '김천': '경북', '안동': '경북',
  '구미': '경북', '영주': '경북', '영천': '경북', '상주': '경북',
  '문경': '경북', '경산': '경북', '청도': '경북', '고령': '경북',
  '성주': '경북', '칠곡': '경북', '예천': '경북', '봉화': '경북',
  '울진': '경북', '영덕': '경북', '청송': '경북', '영양': '경북',
  '울릉': '경북', '의성': '경북',

  // 경상남도 (주의: '고성'은 AMBIGUOUS_CITIES에서 처리)
  '창원': '경남', '진주': '경남', '통영': '경남', '김해': '경남',
  '밀양': '경남', '거제': '경남', '양산': '경남', '사천': '경남',
  '함안': '경남', '거창': '경남', '합천': '경남', '하동': '경남',
  '산청': '경남', '남해': '경남', '함양': '경남', '의령': '경남',
  '창녕': '경남',
};

/**
 * 동명 지역 3쌍 — 맥락 기반 판별, 폴백 시 두 지역 모두 허용
 * contextClues: 해당 지역 주변에서 자주 언급되는 단서 키워드
 */
interface AmbiguousCity {
  name: string;
  candidates: Array<{
    region: string;
    contextClues: string[];
  }>;
}

const AMBIGUOUS_CITIES: AmbiguousCity[] = [
  {
    name: '광주',
    candidates: [
      { region: '광주', contextClues: ['무등산', '상무', '충장로', '비엔날레', '양림동', '전남'] },
      { region: '경기', contextClues: ['남한산성', '곤지암', '경안', '태전', '팔당', '경기도'] },
    ],
  },
  {
    name: '고성',
    candidates: [
      { region: '강원', contextClues: ['통일전망대', 'DMZ', '화진포', '금강산', '속초', '38선'] },
      { region: '경남', contextClues: ['공룡', '당항포', '상족암', '통영', '사천', '고성공룡'] },
    ],
  },
  {
    name: '양평',
    candidates: [
      { region: '경기', contextClues: ['두물머리', '세미원', '양수리', '용문사', '북한강', '경기도'] },
      { region: '서울', contextClues: ['양평동', '영등포', '선유도', '문래'] },
    ],
  },
];

// 모든 지역명 키를 길이 내림차순 정렬 (긴 이름 먼저 매칭)
const ALL_REGION_KEYS = Object.keys(REGION_ALIASES).sort((a, b) => b.length - a.length);
const ALL_CITY_KEYS = Object.keys(CITY_TO_REGION).sort((a, b) => b.length - a.length);

// ─── 지역 추출 ────────────────────────────────────────────────────

/**
 * 텍스트에서 지역명을 정규화
 * "서울특별시" → "서울", "전주" → "전북" 등
 * 동명 지역은 첫 번째 후보 반환 (맥락 없는 단독 호출용)
 */
export function normalizeRegion(region: string): string | null {
  const trimmed = region.trim();

  // 직접 광역 매칭
  if (REGION_ALIASES[trimmed]) {
    return REGION_ALIASES[trimmed];
  }

  // 동명 지역 체크 — 맥락 없이 호출되면 첫 번째 후보 반환
  const ambig = AMBIGUOUS_CITIES.find(a => a.name === trimmed);
  if (ambig) {
    return ambig.candidates[0].region;
  }

  // 시/군 → 광역 매핑
  if (CITY_TO_REGION[trimmed]) {
    return CITY_TO_REGION[trimmed];
  }

  return null;
}

/**
 * 동명 지역의 맥락 기반 해소
 * 주변 텍스트의 단서 키워드를 세어 더 많이 매칭되는 쪽을 선택
 * 단서가 없으면 두 지역 모두 반환 (보수적 폴백)
 */
function resolveAmbiguousCity(cityName: string, text: string): string[] {
  const entry = AMBIGUOUS_CITIES.find(a => a.name === cityName);
  if (!entry) return [];

  // 각 후보의 맥락 단서 매칭 점수 계산
  const scores = entry.candidates.map(candidate => {
    let score = 0;
    for (const clue of candidate.contextClues) {
      if (text.includes(clue)) {
        score += 1;
      }
    }
    return { region: candidate.region, score };
  });

  const maxScore = Math.max(...scores.map(s => s.score));

  if (maxScore === 0) {
    // 단서 없음 → 두 지역 모두 허용 (보수적 폴백)
    return entry.candidates.map(c => c.region);
  }

  // 가장 높은 점수의 지역만 반환 (동점이면 모두)
  return scores.filter(s => s.score === maxScore).map(s => s.region);
}

/**
 * 텍스트에서 모든 지역 언급을 추출
 * @param text 검색 대상 텍스트
 * @param contextForAmbiguity 동명 지역 해소 시 사용할 확장 맥락 (topic+content 결합)
 */
function extractRegionsFromText(text: string, contextForAmbiguity?: string): string[] {
  const found: string[] = [];
  const normalized = new Set<string>();
  const ambiguityContext = contextForAmbiguity || text;

  // 광역 단위 검색
  for (const key of ALL_REGION_KEYS) {
    if (text.includes(key)) {
      const norm = REGION_ALIASES[key];
      if (!normalized.has(norm)) {
        normalized.add(norm);
        found.push(norm);
      }
    }
  }

  // 동명 지역 맥락 해소 — 결합 맥락 텍스트 사용
  for (const ambig of AMBIGUOUS_CITIES) {
    if (text.includes(ambig.name)) {
      const resolved = resolveAmbiguousCity(ambig.name, ambiguityContext);
      for (const region of resolved) {
        if (!normalized.has(region)) {
          normalized.add(region);
          found.push(region);
        }
      }
    }
  }

  // 시/군 단위 검색 (동명 지역은 위에서 처리됨)
  for (const key of ALL_CITY_KEYS) {
    if (text.includes(key)) {
      const norm = CITY_TO_REGION[key];
      if (!normalized.has(norm)) {
        normalized.add(norm);
        found.push(norm);
      }
    }
  }

  return found;
}

/**
 * 포스트 콘텐츠와 주제에서 지리적 스코프 추출
 * API 호출 없이 텍스트 매칭만 사용
 * 동명 지역은 topic+content 결합 텍스트로 맥락 해소
 */
export function extractGeoScope(content: string, topic: string): GeoScope {
  // 동명 지역 해소를 위해 결합 텍스트 사용 (단서가 content에 있을 수 있음)
  const combinedText = `${topic} ${content}`;

  // 주제에서 지역 추출 (가중치 높음) — 동명 해소는 결합 텍스트 기준
  const topicRegions = extractRegionsFromText(topic, combinedText);

  // 본문에서 지역 추출 — 동명 해소는 결합 텍스트 기준
  const contentRegions = extractRegionsFromText(content, combinedText);

  // 빈도 기반 주요 지역 결정
  const regionCounts = new Map<string, number>();

  // 주제 언급은 가중치 3배
  for (const r of topicRegions) {
    regionCounts.set(r, (regionCounts.get(r) || 0) + 3);
  }
  for (const r of contentRegions) {
    regionCounts.set(r, (regionCounts.get(r) || 0) + 1);
  }

  // 빈도순 정렬
  const sortedRegions = [...regionCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([region]) => region);

  const mentionedRegions = [...new Set([...topicRegions, ...contentRegions])];
  const isMultiRegion = mentionedRegions.length >= 3;

  return {
    primaryRegion: sortedRegions[0] || null,
    mentionedRegions,
    isMultiRegion,
  };
}

// ─── 호환성 검증 ──────────────────────────────────────────────────

/**
 * 이미지의 주소가 포스트의 지리적 스코프와 호환되는지 검증
 *
 * @returns true = 호환, false = 불일치
 */
export function isGeoCompatible(imageAddress: string | undefined, scope: GeoScope): boolean {
  // 주소가 없거나 스코프가 없으면 보수적으로 호환 판정
  if (!imageAddress || !scope.primaryRegion) return true;

  // 멀티지역 포스트(TOP 5 리스트 등)는 어떤 지역이든 허용
  if (scope.isMultiRegion) return true;

  // 이미지 주소에서 지역 추출
  const imageRegions = extractRegionsFromText(imageAddress);

  if (imageRegions.length === 0) {
    // 주소에서 지역을 판별 못하면 보수적으로 허용
    return true;
  }

  // 이미지 지역이 포스트에서 언급된 지역과 겹치는지 확인
  for (const imgRegion of imageRegions) {
    if (scope.mentionedRegions.includes(imgRegion)) {
      return true;
    }
  }

  return false;
}
