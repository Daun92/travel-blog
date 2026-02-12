/**
 * 에이전트별 시각 아이덴티티 정의 + 포토리얼리스틱 커버 프롬프트 빌더
 * 조회영(viral) / 김주말(friendly) / 한교양(informative) / 오덕우(niche) 시각 차별화
 */

// ─── 타입 정의 ──────────────────────────────────────────────────

export interface AgentVisualIdentity {
  agentId: string;
  displayName: string;
  primaryColor: string;
  mood: string[];
  photoStyle: string;
  composition: string;
  colorGrading: string;
  badgeLabel: string;
  titleFontWeight: 'bold' | 'regular' | 'medium';
  sealChars: string;
  commentSuffix: string;
}

export interface ReferenceAnalysis {
  dominantColors: string[];
  keySubjects: string[];
  mood: string;
  composition: string;
  season: string;
  timeOfDay: string;
  architecturalElements: string[];
  landscapeElements: string[];
}

// ─── 에이전트 시각 아이덴티티 상수 ────────────────────────────────

export const AGENT_VISUAL_IDENTITIES: Record<string, AgentVisualIdentity> = {
  viral: {
    agentId: 'viral',
    displayName: '조회영',
    primaryColor: '#FF3B30',
    mood: ['dramatic', 'high-contrast', 'vivid', 'eye-catching'],
    photoStyle: 'editorial magazine photography with strong shadows and dramatic lighting',
    composition: 'diagonal lines, hero framing, bold perspective, leading lines',
    colorGrading: 'high contrast, punchy saturation, deep blacks, vibrant highlights',
    badgeLabel: '조회영',
    titleFontWeight: 'bold',
    sealChars: '회영',
    commentSuffix: '이건 꼭 봐야 됨',
  },
  friendly: {
    agentId: 'friendly',
    displayName: '김주말',
    primaryColor: '#FF9500',
    mood: ['warm', 'cozy', 'golden-hour', 'casual', 'authentic'],
    photoStyle: 'lifestyle photography with golden hour warmth and soft bokeh',
    composition: 'eye-level perspective, warm vignetting, centered subject, inviting framing',
    colorGrading: 'warm tones, golden highlights, soft shadows, natural skin tones',
    badgeLabel: '김주말',
    titleFontWeight: 'regular',
    sealChars: '주말',
    commentSuffix: '직접 다녀왔어요',
  },
  informative: {
    agentId: 'informative',
    displayName: '한교양',
    primaryColor: '#007AFF',
    mood: ['refined', 'structured', 'symmetrical', 'clean', 'intellectual'],
    photoStyle: 'architectural photography with even lighting and attention to detail',
    composition: 'symmetry, rule of thirds, geometric framing, balanced elements',
    colorGrading: 'balanced exposure, cool shadows, neutral mid-tones, clean whites',
    badgeLabel: '한교양',
    titleFontWeight: 'medium',
    sealChars: '교양',
    commentSuffix: '알면 더 깊은 여행',
  },
  niche: {
    agentId: 'niche',
    displayName: '오덕우',
    primaryColor: '#0D9488',
    mood: ['intimate', 'candid', 'gritty', 'curious', 'raw'],
    photoStyle: 'indie street photography with film grain, close-up details, and candid framing',
    composition: 'tight close-ups, off-center subject, shallow depth of field, detail-focused framing',
    colorGrading: 'muted tones, film emulation, slight vignetting, desaturated highlights with warm shadows',
    badgeLabel: '오덕우',
    titleFontWeight: 'regular',
    sealChars: '소문',
    commentSuffix: '파면 팔수록 빠져들어요',
  },
};

// ─── 기본 에이전트 결정 ──────────────────────────────────────────

/**
 * personaId가 없는 포스트에 대해 키워드 기반 에이전트 추론
 */
export function inferAgentId(title: string, tags?: string[]): string {
  const text = `${title} ${(tags || []).join(' ')}`.toLowerCase();

  const viralKeywords = ['top', 'best', '순위', '비교', 'vs', '최고', '최악', '핫플', '트렌드', 'sns', '난리', '화제', '논란', '꼭', '필수'];
  const informativeKeywords = ['역사', '건축', '미술사', '작가', '작품', '해설', '교양', '유네스코', '의미', '배경', '유래', '입문', '가이드', '에티켓', '인문'];
  const nicheKeywords = ['숨은', '로컬', '골목', '현지인', '비밀', '숨겨진', '뒷골목', '디깅', '파고', '취향', '덕질', '심화', '매니아', '마니아', '찐', '언더', '인디', '동네', '소문', '발견'];

  if (viralKeywords.some(kw => text.includes(kw))) return 'viral';
  if (nicheKeywords.some(kw => text.includes(kw))) return 'niche';
  if (informativeKeywords.some(kw => text.includes(kw))) return 'informative';
  return 'friendly';
}

/**
 * agentId로 시각 아이덴티티 가져오기 (기본값: friendly)
 */
export function getVisualIdentity(agentId: string): AgentVisualIdentity {
  return AGENT_VISUAL_IDENTITIES[agentId || 'friendly'] || AGENT_VISUAL_IDENTITIES.friendly;
}

// ─── 커버 캡션 생성 ──────────────────────────────────────────────

/**
 * 주제를 15자 이내로 축약 (첫 번째 구분자에서 잘라냄)
 */
function shortenTopic(topic: string): string {
  const limit = 15;
  if (topic.length <= limit) return topic;

  // :, |, —, , 등 구분자에서 자르기
  const separators = [':', '|', '—', ',', ' - '];
  for (const sep of separators) {
    const idx = topic.indexOf(sep);
    if (idx > 0 && idx <= limit) return topic.slice(0, idx).trim();
  }

  // 공백에서 자르기
  const truncated = topic.slice(0, limit);
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > limit * 0.4) return truncated.slice(0, lastSpace).trim();
  return truncated;
}

/**
 * AI 생성 커버 이미지용 캡션 생성
 * 형식: "작성자: {에이전트명} · {주제 축약} {한마디}"
 *
 * 예시:
 *   "작성자: 조회영 · 발렌타인 여행지 이건 꼭 봐야 됨"
 *   "작성자: 김주말 · 전주 한옥마을 직접 다녀왔어요"
 *   "작성자: 한교양 · 통영 동피랑 알면 더 깊은 여행"
 */
export function getCoverCaption(agentId: string, topic: string): string {
  const identity = getVisualIdentity(agentId);
  const shortTopic = shortenTopic(topic);
  return `작성자: ${identity.displayName} · ${shortTopic} ${identity.commentSuffix}`;
}

// ─── 크리에이티브 디렉션 ─────────────────────────────────────────

/**
 * 에이전트별 크리에이티브 디렉션
 * viral    → 매거진 표지 / 인기 유튜브 썸네일
 * friendly → 여행 브이로거 썸네일 / 솔직 후기 현장감
 * informative → 다큐멘터리 포스터 / 전시 도록 표지
 */
const CREATIVE_DIRECTION: Record<string, string> = {
  viral: `CREATIVE DIRECTION — Magazine cover / hit YouTube thumbnail:
- One powerful hero shot that tells the entire story at a glance.
- High-impact "stop-scrolling" composition — the viewer must feel "I NEED to see this."
- Bold perspective, dramatic angle, or striking contrast that provokes instant curiosity.
- Think: Condé Nast Traveler cover, or a viral travel YouTuber's most-clicked thumbnail.`,

  friendly: `CREATIVE DIRECTION — Travel vlogger's authentic thumbnail:
- Show the REAL, lived-in atmosphere as if the viewer is standing there right now.
- Eye-level, first-person perspective — "I was actually here, and this is what it felt like."
- Include human-scale elements: bustling streets, steaming food, cozy café interiors, real signage.
- Warm, inviting mood that makes viewers think "I want to go there this weekend."
- Think: popular Korean travel YouTuber's vlog thumbnail — genuine, relatable, warm.`,

  informative: `CREATIVE DIRECTION — Documentary poster / museum exhibition banner:
- Elegant, cinematic framing that rewards careful observation.
- Capture the architectural beauty, historical depth, or structural elegance of the subject.
- Clean, balanced composition with visual storytelling — a single frame that conveys heritage and meaning.
- Think: National Geographic feature, Netflix documentary poster, or museum catalog cover.`,

  niche: `CREATIVE DIRECTION — Indie zine / street photography snapshot:
- Capture a DETAIL that most people walk past — a weathered sign, a narrow alley entrance, a hand-written menu, a texture on a wall.
- The image should feel like a discovery moment — "I stumbled upon this and had to photograph it."
- Tight, intimate framing with shallow depth of field. Focus on texture, pattern, and the overlooked.
- Film-like quality: slight grain, muted tones, natural light only, no flash.
- Think: independent travel zine, Kinfolk magazine detail shot, or a film photographer's personal project.`,
};

// ─── 피사체 지시 ─────────────────────────────────────────────────

/**
 * 콘텐츠 타입별 피사체 구체화 지시
 * Gemini에게 "무엇을" 보여줄지 명확하게 전달
 */
function getSubjectDirection(topic: string, type: 'travel' | 'culture', contentHints?: string[]): string {
  // 포스트 본문에서 추출한 실제 장소/키워드가 있으면 프롬프트에 포함
  const hintsBlock = contentHints && contentHints.length > 0
    ? `\n\nACTUAL CONTENT of this post covers these specific places/topics:\n${contentHints.map((h, i) => `  ${i + 1}. ${h}`).join('\n')}\nThe cover image MUST represent one or more of these ACTUAL places/topics — NOT a generic or stereotypical interpretation of the title.`
    : '';

  if (type === 'travel') {
    return `WHAT TO SHOW:
Visualize the SPECIFIC place or destination in "${topic}".
- Show the iconic, recognizable visual identity of this exact location — its signature streets, landmarks, architecture, food, or scenery.
- The viewer should immediately know WHERE this is. A generic "pretty Korean landscape" is NOT acceptable.
- If the topic names a neighborhood (e.g. 성수동, 익선동, 을지로), show that neighborhood's distinctive streetscape, buildings, and atmosphere.
- If the topic names a city or region (e.g. 여수, 통영, 전주), show that destination's most representative visual — the thing you'd photograph first upon arrival.
- Include environmental context: weather, time of day, street life, signage — details that anchor the image to a REAL place.${hintsBlock}`;
  }

  return `WHAT TO SHOW:
Visualize the SPECIFIC cultural subject in "${topic}".
- Show the actual cultural space, artwork, performance, or exhibition atmosphere that this topic is about.
- The viewer should immediately sense WHAT this cultural experience is. A generic gallery or museum shot is NOT acceptable.
- If the topic names a specific place (e.g. 성수동 팝업스토어, 익선동 카페), show that place's distinctive interior/exterior and the cultural activity happening there.
- If the topic discusses an art form or cultural trend, show it in action — people engaging, spaces alive with activity.
- Include contextual details: exhibition posters, architectural features, crowd energy, lighting mood — details that make the scene specific and alive.${hintsBlock}`;
}

// ─── 커버 사진 프롬프트 빌더 ─────────────────────────────────────

/**
 * 에이전트 시각 아이덴티티 + 크리에이티브 디렉션 + 피사체 지시를 결합한 커버 프롬프트 생성
 *
 * 프롬프트 구조:
 *   1. WHAT TO SHOW — 구체적 피사체 지시 (장소/주제 특정)
 *   2. CREATIVE DIRECTION — 매거진/썸네일/다큐 크리에이티브 방향
 *   3. Photography style — 에이전트별 촬영 스타일
 *   4. Reference hints — 레퍼런스 분석 결과 (있으면)
 *   5. CRITICAL REQUIREMENTS — 품질 가드레일
 */
export interface CoverPromptOptions {
  topic: string;
  type: 'travel' | 'culture';
  agentId: string;
  referenceAnalysis?: ReferenceAnalysis;
  /** 포스트 본문에서 추출한 핵심 장소/키워드 목록 (## 헤딩 등) */
  contentHints?: string[];
}

export function getCoverPhotoPrompt(
  topic: string,
  type: 'travel' | 'culture',
  agentId: string,
  referenceAnalysis?: ReferenceAnalysis,
  contentHints?: string[],
): string {
  const identity = getVisualIdentity(agentId);
  const creativeDir = CREATIVE_DIRECTION[agentId] || CREATIVE_DIRECTION.friendly;
  const subjectDir = getSubjectDirection(topic, type, contentHints);

  // 레퍼런스 기반 힌트 (있으면 보조 정보로 활용)
  const refHints = referenceAnalysis
    ? `
REFERENCE HINTS (use as supplementary inspiration, not as the primary subject):
- Key subjects: ${referenceAnalysis.keySubjects.join(', ')}
- Dominant colors: ${referenceAnalysis.dominantColors.join(', ')}
- Season/time: ${referenceAnalysis.season}, ${referenceAnalysis.timeOfDay}
- Architectural elements: ${referenceAnalysis.architecturalElements.join(', ') || 'none'}`
    : '';

  return `Generate a photorealistic cover photograph for a Korean blog post.

Topic: "${topic}"
Content type: ${type === 'travel' ? 'Travel destination' : 'Culture & arts'}

${subjectDir}

${creativeDir}

PHOTOGRAPHY STYLE:
- Style: ${identity.photoStyle}
- Composition: ${identity.composition}
- Color grading: ${identity.colorGrading}
- Mood: ${identity.mood.join(', ')}
${refHints}

CRITICAL REQUIREMENTS:
- Must look like a REAL photograph by a professional photographer. NO illustration, NO digital art, NO cartoon, NO painting, NO 3D render.
- Aspect ratio: 16:9 landscape (1200x675 pixels).
- The photograph MUST fill the ENTIRE frame edge-to-edge. NO white space, NO margins, NO empty areas, NO borders at top/bottom/left/right.
- Do NOT include any text, caption, description, watermark, logo, title, label, or overlay anywhere in the image. Pure photograph only — zero text of any kind.
- Do NOT leave the bottom portion empty or white. The image content must extend all the way to the bottom edge.
- The image must be SPECIFIC to the topic. A viewer familiar with Korean places should recognize the location or cultural context.
- Korean setting/atmosphere must be unmistakable.`;
}
