/**
 * AI 콘텐츠 생성을 위한 프롬프트 템플릿
 */

import type { Persona } from '../agents/draft-enhancer/persona-loader.js';
import { buildPersonaPromptSection, getContentTypeGuidance } from '../agents/draft-enhancer/persona-loader.js';

export interface PromptContext {
  topic: string;
  type: 'travel' | 'culture';
  keywords?: string[];
  tone?: string;
  length?: 'short' | 'medium' | 'long';
  persona?: Persona;
  /** 콘텐츠 프레이밍 유형 (list_ranking, deep_dive, experience, ...) */
  framingType?: string;
  /** dataToPromptContext()로 생성된 수집 데이터 텍스트 */
  collectedData?: string;
}

/**
 * 프레이밍 유형에 따른 콘텐츠 가이던스 생성
 */
function getFramingGuidance(framingType?: string): string {
  if (!framingType) return '';

  const guidance: Record<string, string> = {
    list_ranking: `**프레이밍: 순위/리스트형**
- TOP N, 베스트, 순위 비교 형식으로 작성
- 명확한 순위 기준을 제시하고 각 항목에 한줄 평가
- 공유하고 싶은 "리스트형 콘텐츠" 느낌으로`,

    deep_dive: `**프레이밍: 심층 탐구형**
- 역사, 의미, 배경 해설 중심으로 작성
- "알고 가면 다르게 보인다" 식의 깊이 있는 정보 제공
- 교양/지식 전달에 초점, 단순 나열 지양`,

    experience: `**프레이밍: 비주얼 내러티브형**
- 이미지가 먼저, 텍스트가 따라가는 포토 에세이 구조
- 시간대별 빛과 분위기 변화를 축으로 스팟을 소개
- 공간의 질감(소리, 온도, 공기)과 포토 가이드(앵글, 구도) 포함
- 가격/영업시간 등 팩트 클레임 최소화, 분위기와 순간에 집중`,

    seasonal: `**프레이밍: 시즌/시의성형**
- 현재 시기에 특히 좋은 이유를 강조
- "지금 가야 하는" 시의성 있는 포인트 부각
- 계절감, 한정 이벤트, 시기별 차이점 설명`,

    comparison: `**프레이밍: 핏 매칭형**
- A vs B 승부가 아닌, "당신 성향에 맞는 곳은?" 구조
- 객관적 기준(가격, 거리, 분위기, 난이도)으로 양쪽 특성 분석
- 성향별 추천 (액티브파 vs 여유파, 가성비파 vs 프리미엄파 등)
- 결론에서 독자가 자기 핏을 찾을 수 있도록 가이드`,

    local_story: `**프레이밍: 로컬 스토리형**
- 현지인 시점, 숨은 골목, 동네 이야기 중심
- 관광 가이드에 없는 로컬 정보 강조
- 사람과 장소의 이야기로 풀어내기`,

    niche_digging: `**프레이밍: 취향 디깅형**
- 하나의 소재를 다층적으로 해체 (표면 → 단골 → 인사이더 → 오타쿠 디깅)
- "12번 가서 알아낸" 식의 깊이 있는 발견 공유
- 디테일 클로즈업: 간판 글씨, 벽면 흔적, 메뉴 뒷이야기 등
- 현지인/사장님과의 대화, 자체 리서치 결과 포함`
  };

  return guidance[framingType] || '';
}

/**
 * 여행 포스트 생성 프롬프트
 */
export function getTravelPrompt(context: PromptContext): string {
  const { topic, keywords = [], length = 'medium', persona, framingType, collectedData } = context;

  const lengthGuide = {
    short: '1500-2000자',
    medium: '2500-3500자',
    long: '4000-5000자'
  };

  // 페르소나가 있으면 페르소나 기반 프리앰블 사용
  const preamble = persona
    ? `당신은 "${persona.name}"입니다. ${persona.tagline}

${buildPersonaPromptSection(persona)}

${getContentTypeGuidance(persona, 'travel')}

다음 주제에 대해 위 페르소나의 관점과 말투로 SEO에 최적화된 블로그 포스트를 작성해주세요.`
    : `당신은 한국 여행 블로거입니다. 다음 주제에 대해 SEO에 최적화된 블로그 포스트를 작성해주세요.`;

  const toneGuide = persona
    ? `${persona.voice.tone} (${persona.voice.formality})`
    : '친근하고 정보가 풍부한 톤 (개인 경험처럼)';

  const framingGuide = getFramingGuidance(framingType);

  return `${preamble}

## 주제
${topic}

## 키워드 (자연스럽게 포함)
${keywords.length > 0 ? keywords.join(', ') : '주제에서 적절한 키워드 선정'}
${framingGuide ? `
## 콘텐츠 프레이밍
${framingGuide}
` : ''}${collectedData ? `
${collectedData}
` : ''}
## 작성 지침
1. **분량**: ${lengthGuide[length]}
2. **톤**: ${toneGuide}
3. **구조**:
   - 매력적인 도입부 (왜 이 장소인가?)
   - 상세한 여행 정보 (위치, 교통, 비용)
   - 추천 코스나 스팟 (구체적 장소명 포함)
   - 실용적인 팁 (현지인만 아는 정보)
   - 맺음말

4. **SEO 요소**:
   - H2, H3 소제목 활용
   - 키워드 자연스럽게 3-5회 사용
   - 메타 디스크립션용 요약 문장 제공

5. **주의사항**:
   - ${collectedData ? '위 수집 데이터의 장소명, 주소, 전화번호를 그대로 사용' : '실제 장소명, 주소, 가격 정보 포함'}
   - ${collectedData ? '수집되지 않은 정보(가격, 메뉴 등)는 "확인 필요"로 표기' : '"~습니다"체 사용'}
   - "~습니다"체 사용
   - 이모지 최소화
   - 링크 플레이스홀더: [장소명](링크)
   - ⚠️ **날조 금지**: 수집 데이터에 미술관·공연장이 포함되어 있더라도, 해당 장소에서 주제와 관련된 특별 전시/행사가 열린다고 **절대 가정하지 마세요**. 전시명, 기간, 가격을 직접 만들어내지 마세요. 수집 데이터에 명시된 전시/행사 정보만 사용하세요.
   - ⚠️ **키워드 스터핑 금지**: 키워드를 기계적으로 반복하지 마세요. 전시회명이나 섹션 제목에 주제 키워드를 억지로 결합하지 마세요 (예: "제주도 카페 관련 전시회" ← 이런 식의 제목 금지).${collectedData?.includes('ALLOWLIST') ? `
   - ⛔ **허용 목록 엄수**: 위 '허용된 장소 목록(ALLOWLIST)'의 장소만 사용하세요. 목록에 없는 장소, 갤러리, 카페, 전시를 등장시키면 날조로 간주됩니다. 당신이 아는 장소라도 허용 목록에 없으면 사용하지 마세요. 허용 목록의 장소를 자연스럽게 엮어 콘텐츠를 구성하세요.` : ''}

6. **이미지 삽입 가이드** (선택적):
   적절한 섹션 끝에 다음 형식의 이미지 마커를 추가할 수 있습니다:
   - 기본 정보/교통 섹션 후: [IMAGE:infographic:여행 준비 가이드]
   - 추천 코스/일정 섹션 후: [IMAGE:map:추천 코스 지도]
   - 맛집/카페 소개 후: [IMAGE:comparison:맛집 비교 가이드]
   - 여정 설명 후: [IMAGE:diagram:여정 일러스트]
   - 글 도입부나 마무리: [IMAGE:moodboard:여행지 감성 무드보드]
   - 실용 팁 섹션: [IMAGE:bucketlist:꼭 해볼 것 리스트]

   마커 형식: [IMAGE:스타일:설명]
   스타일 옵션: infographic, diagram, map, comparison, moodboard, bucketlist

7. **실용 링크 삽입** (권장):
   독자가 실제로 활용할 수 있는 링크를 마커 형식으로 추가하세요.
   마커 형식: [LINK:타입:검색어] 또는 [LINK:타입:검색어:표시텍스트]

   - 장소 소개 시: [LINK:map:{장소명}] → 네이버 지도 검색
   - 상세 정보 안내: [LINK:place:{검색어}] → 네이버 검색
   - 공식 웹사이트: [LINK:official:{URL}:{표시텍스트}]

   예시:
   "{장소명}은 [LINK:map:{장소명}]에서 위치를 확인할 수 있습니다."
   "자세한 정보는 [LINK:official:{URL}:{사이트명}]를 참고하세요."

## 출력 형식
마크다운 형식으로 작성하세요. 맨 앞에 SEO 메타 정보를 JSON 주석으로 포함하세요.

<!--SEO
{
  "title": "제목",
  "description": "150자 이내 설명",
  "keywords": ["키워드1", "키워드2"]
}
-->

# 제목

본문...`;
}

/**
 * 문화예술 포스트 생성 프롬프트
 */
export function getCulturePrompt(context: PromptContext): string {
  const { topic, keywords = [], length = 'medium', persona, framingType, collectedData } = context;

  const lengthGuide = {
    short: '1500-2000자',
    medium: '2500-3500자',
    long: '4000-5000자'
  };

  // 페르소나가 있으면 페르소나 기반 프리앰블 사용
  const preamble = persona
    ? `당신은 "${persona.name}"입니다. ${persona.tagline}

${buildPersonaPromptSection(persona)}

${getContentTypeGuidance(persona, 'culture')}

다음 주제에 대해 위 페르소나의 관점과 말투로 SEO에 최적화된 리뷰/소개 글을 작성해주세요.`
    : `당신은 문화예술 전문 블로거입니다. 다음 주제에 대해 SEO에 최적화된 리뷰/소개 글을 작성해주세요.`;

  const toneGuide = persona
    ? `${persona.voice.tone} (${persona.voice.formality})`
    : '전문적이면서도 친근한 톤';

  const framingGuide = getFramingGuidance(framingType);

  return `${preamble}

## 주제
${topic}

## 키워드 (자연스럽게 포함)
${keywords.length > 0 ? keywords.join(', ') : '주제에서 적절한 키워드 선정'}
${framingGuide ? `
## 콘텐츠 프레이밍
${framingGuide}
` : ''}${collectedData ? `
${collectedData}
` : ''}
## 작성 지침
1. **분량**: ${lengthGuide[length]}
2. **톤**: ${toneGuide}
3. **구조**:
   - 흥미로운 도입부 (이 전시/공연의 특별한 점)
   - 상세 소개 (작가, 작품, 내용)
   - 관람 포인트 (놓치면 안 될 부분)
   - 실용 정보 (위치, 시간, 가격, 예매)
   - 주변 볼거리/맛집
   - 총평 및 추천 대상

4. **SEO 요소**:
   - H2, H3 소제목 활용
   - 키워드 자연스럽게 3-5회 사용
   - 메타 디스크립션용 요약 문장 제공

5. **주의사항**:
   - ${collectedData ? '위 수집 데이터의 장소, 날짜, 전화번호를 그대로 사용' : '실제 정보 (장소, 날짜, 가격) 포함'}
   - ${collectedData ? '수집되지 않은 정보는 "확인 필요"로 표기' : '"~습니다"체 사용'}
   - "~습니다"체 사용
   - 이모지 최소화
   - 사진 위치 표시: ![설명](이미지URL)
   - ⚠️ **날조 금지**: 수집 데이터에 미술관·공연장이 포함되어 있더라도, 해당 장소에서 주제와 관련된 특별 전시/행사가 열린다고 **절대 가정하지 마세요**. 전시명, 기간, 가격을 직접 만들어내지 마세요. 수집 데이터에 명시된 전시/행사 정보만 사용하세요.
   - ⚠️ **키워드 스터핑 금지**: 키워드를 기계적으로 반복하지 마세요. 전시회명이나 섹션 제목에 주제 키워드를 억지로 결합하지 마세요 (예: "전통주 양조장 탐방 관련 전시회" ← 이런 식의 제목 금지).${collectedData?.includes('ALLOWLIST') ? `
   - ⛔ **허용 목록 엄수**: 위 '허용된 장소 목록(ALLOWLIST)'의 장소만 사용하세요. 목록에 없는 장소, 갤러리, 카페, 전시를 등장시키면 날조로 간주됩니다. 당신이 아는 장소라도 허용 목록에 없으면 사용하지 마세요. 허용 목록의 장소를 자연스럽게 엮어 콘텐츠를 구성하세요.` : ''}

6. **이미지 삽입 가이드** (선택적):
   적절한 섹션 끝에 다음 형식의 이미지 마커를 추가할 수 있습니다:
   - 전시/공연 정보 섹션 후: [IMAGE:infographic:관람 정보 가이드]
   - 관람 포인트 섹션 후: [IMAGE:diagram:추천 관람 동선]
   - 티켓/예매 정보 후: [IMAGE:comparison:티켓 종류 비교]
   - 글 도입부나 마무리: [IMAGE:moodboard:전시 감성 무드보드]
   - 필수 관람 포인트: [IMAGE:bucketlist:놓치면 안 될 체크리스트]

   마커 형식: [IMAGE:스타일:설명]
   스타일 옵션: infographic, diagram, map, comparison, moodboard, bucketlist

7. **실용 링크 삽입** (권장):
   독자가 실제로 활용할 수 있는 링크를 마커 형식으로 추가하세요.
   마커 형식: [LINK:타입:검색어] 또는 [LINK:타입:검색어:표시텍스트]

   - 장소 안내: [LINK:map:{장소명}] → 네이버 지도 검색
   - 티켓 예매: [LINK:booking:{공연/전시명}] → 인터파크 티켓
   - 예스24 예매: [LINK:yes24:{공연/전시명}] → 예스24 티켓
   - 공식 웹사이트: [LINK:official:{URL}:{표시텍스트}]

   예시:
   "예매는 [LINK:booking:{공연/전시명}:인터파크 티켓]에서 가능합니다."
   "일정은 [LINK:official:{URL}:공식 홈페이지]에서 확인하세요."
   "위치는 [LINK:map:{장소명}]에서 확인할 수 있습니다."

## 출력 형식
마크다운 형식으로 작성하세요. 맨 앞에 SEO 메타 정보를 JSON 주석으로 포함하세요.

<!--SEO
{
  "title": "제목",
  "description": "150자 이내 설명",
  "keywords": ["키워드1", "키워드2"]
}
-->

# 제목

본문...`;
}

/**
 * 키워드 추천 프롬프트
 */
export function getKeywordPrompt(category: 'travel' | 'culture' | 'all'): string {
  const currentMonth = new Date().toLocaleDateString('ko-KR', { month: 'long' });

  return `당신은 한국 블로그 SEO 전문가입니다. 현재 ${currentMonth} 기준으로 ${
    category === 'all' ? '여행 및 문화예술' : category === 'travel' ? '여행' : '문화예술'
  } 분야에서 검색량이 많을 것으로 예상되는 롱테일 키워드를 추천해주세요.

## 추천 기준
1. 검색 의도가 명확한 롱테일 키워드 (3-5단어)
2. 경쟁이 너무 치열하지 않은 틈새 키워드
3. 시즌/트렌드를 반영한 키워드
4. 실제 블로그 포스트로 작성 가능한 주제

## 출력 형식
JSON 배열로 10개의 키워드를 추천해주세요.

\`\`\`json
[
  {
    "keyword": "키워드",
    "category": "travel|culture",
    "difficulty": "low|medium|high",
    "reason": "추천 이유"
  }
]
\`\`\``;
}

/**
 * 제목 생성 프롬프트
 */
export function getTitlePrompt(topic: string, type: 'travel' | 'culture'): string {
  return `다음 주제에 대해 클릭률이 높은 한국어 블로그 제목 5개를 생성해주세요.

주제: ${topic}
카테고리: ${type === 'travel' ? '여행' : '문화예술'}

## 제목 작성 원칙
1. 30-50자 내외
2. 구체적인 숫자나 장소명 포함
3. 호기심 유발 또는 유용한 정보 암시
4. 검색 키워드 자연스럽게 포함
5. 과장된 표현 지양

## 출력 형식
\`\`\`json
[
  "제목1",
  "제목2",
  "제목3",
  "제목4",
  "제목5"
]
\`\`\``;
}
