/**
 * AI 콘텐츠 생성을 위한 프롬프트 템플릿
 */

export interface PromptContext {
  topic: string;
  type: 'travel' | 'culture';
  keywords?: string[];
  tone?: string;
  length?: 'short' | 'medium' | 'long';
}

/**
 * 여행 포스트 생성 프롬프트
 */
export function getTravelPrompt(context: PromptContext): string {
  const { topic, keywords = [], length = 'medium' } = context;

  const lengthGuide = {
    short: '1500-2000자',
    medium: '2500-3500자',
    long: '4000-5000자'
  };

  return `당신은 한국 여행 블로거입니다. 다음 주제에 대해 SEO에 최적화된 블로그 포스트를 작성해주세요.

## 주제
${topic}

## 키워드 (자연스럽게 포함)
${keywords.length > 0 ? keywords.join(', ') : '주제에서 적절한 키워드 선정'}

## 작성 지침
1. **분량**: ${lengthGuide[length]}
2. **톤**: 친근하고 정보가 풍부한 톤 (개인 경험처럼)
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
   - 실제 장소명, 주소, 가격 정보 포함
   - "~습니다"체 사용
   - 이모지 최소화
   - 링크 플레이스홀더: [장소명](링크)

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

   - 장소 소개 시: [LINK:map:성산일출봉] → 네이버 지도 검색
   - 상세 정보 안내: [LINK:place:제주 올레길] → 네이버 검색
   - 공식 웹사이트: [LINK:official:https://www.visitjeju.net:제주관광공사]

   예시:
   "성산일출봉은 [LINK:map:성산일출봉]에서 위치를 확인할 수 있습니다."
   "자세한 정보는 [LINK:official:https://www.visitjeju.net:제주관광공사 공식 사이트]를 참고하세요."

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
  const { topic, keywords = [], length = 'medium' } = context;

  const lengthGuide = {
    short: '1500-2000자',
    medium: '2500-3500자',
    long: '4000-5000자'
  };

  return `당신은 문화예술 전문 블로거입니다. 다음 주제에 대해 SEO에 최적화된 리뷰/소개 글을 작성해주세요.

## 주제
${topic}

## 키워드 (자연스럽게 포함)
${keywords.length > 0 ? keywords.join(', ') : '주제에서 적절한 키워드 선정'}

## 작성 지침
1. **분량**: ${lengthGuide[length]}
2. **톤**: 전문적이면서도 친근한 톤
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
   - 실제 정보 (장소, 날짜, 가격) 포함
   - "~습니다"체 사용
   - 이모지 최소화
   - 사진 위치 표시: ![설명](이미지URL)

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

   - 장소 안내: [LINK:map:국립현대미술관 서울] → 네이버 지도 검색
   - 티켓 예매: [LINK:booking:뮤지컬 오페라의 유령] → 인터파크 티켓
   - 예스24 예매: [LINK:yes24:라이온 킹 뮤지컬] → 예스24 티켓
   - 공식 웹사이트: [LINK:official:https://www.mmca.go.kr:국립현대미술관]

   예시:
   "예매는 [LINK:booking:뮤지컬 오페라의 유령:인터파크 티켓]에서 가능합니다."
   "전시 일정은 [LINK:official:https://www.mmca.go.kr:공식 홈페이지]에서 확인하세요."
   "위치는 [LINK:map:국립현대미술관 서울]에서 확인할 수 있습니다."

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
