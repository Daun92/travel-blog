/**
 * AI 이미지 생성을 위한 프롬프트 템플릿
 * 전략적 시각화: 정보 전달 + 감성적 매력 + 공유 유도
 */

import type { ImageStyle } from '../images/gemini-imagen.js';

export interface ImageContext {
  topic: string;
  type: 'travel' | 'culture';
  section?: string;
  /** 섹션 본문 핵심 2-3문장 요약 — 이미지 프롬프트에 서사 컨텍스트 제공 */
  narrativeHint?: string;
  data?: Record<string, string | number>;
  items?: string[];
  locations?: string[];
  /** 페르소나 ID — 스틸컷 비주얼 아이덴티티 적용 */
  personaId?: string;
}

// ============================================================
// 전략적 이미지 스타일 가이드
// ============================================================
//
// AI 생성 이미지의 차별화 포인트:
// 1. 일관된 브랜드 아트워크 (시그니처 스타일)
// 2. 감성적 일러스트 (스톡 사진이 줄 수 없는 따뜻함)
// 3. 공유 욕구 자극 (인스타/핀터레스트 저장)
// 4. 촬영 불가능한 것의 시각화 (분위기, 경험, 시간의 흐름)
//
// ============================================================

/**
 * 인포그래픽 프롬프트 - 정보 + 감성
 * 단순 정보 나열이 아닌, 여행 설렘을 담은 시각화
 */
export function getInfographicPrompt(context: ImageContext): string {
  const { topic, type, data = {}, section = '', narrativeHint } = context;

  if (type === 'travel') {
    return `Create a beautiful Korean travel infographic illustration for: ${topic}

VISUAL CONCEPT: "Travel Journal Page" - 손으로 그린 여행 다이어리 느낌

MUST INCLUDE ELEMENTS:
- Central illustrated icon representing the destination (landmark sketch)
- Handwritten-style Korean labels with charming imperfections
- Soft watercolor or gouache texture backgrounds
- Small decorative elements: stamps, tickets, dotted lines
- Information arranged like a traveler's scrapbook page

INFORMATION TO VISUALIZE:
${section ? `- Section focus: ${section}` : ''}
${narrativeHint ? `- Narrative context: ${narrativeHint}` : ''}
${Object.entries(data).map(([key, value]) => `- ${key}: ${value}`).join('\n')}

STYLE GUIDELINES:
- Color palette: Warm cream base, muted terracotta, sage green, dusty blue accents
- Typography: Mix of neat Korean labels and casual handwritten notes
- Layout: Asymmetric, organic arrangement (NOT rigid grid)
- Mood: Nostalgic, inviting, like a friend's travel recommendations

AVOID: Cold corporate infographics, sterile layouts, generic icons

Make it feel like something you'd want to screenshot and save for your trip planning.`;
  }

  // culture type
  return `Create an artistic Korean cultural event infographic for: ${topic}

VISUAL CONCEPT: "Art Gallery Card" - 전시회 초대장 같은 세련된 감성

MUST INCLUDE ELEMENTS:
- Elegant minimalist layout with generous white space
- One striking illustrated focal point (artwork-inspired)
- Korean typography as design element
- Subtle artistic textures (paper grain, brush strokes)
- Information presented like a curated exhibition guide

INFORMATION TO VISUALIZE:
${section ? `- Section focus: ${section}` : ''}
${narrativeHint ? `- Narrative context: ${narrativeHint}` : ''}
${Object.entries(data).map(([key, value]) => `- ${key}: ${value}`).join('\n')}

STYLE GUIDELINES:
- Color palette: Off-white, charcoal, one accent color from the exhibition theme
- Typography: Clean sans-serif with artistic Korean calligraphy accents
- Layout: Editorial magazine style with bold focal point
- Mood: Sophisticated, cultured, intriguing

AVOID: Cluttered designs, generic event posters, cheap graphics

Make it feel like a collectible piece you'd frame after the exhibition.`;
}

/**
 * 다이어그램 프롬프트 - 교통/동선을 여정의 이야기로
 */
export function getDiagramPrompt(context: ImageContext): string {
  const { topic, type, locations = [], data = {}, narrativeHint } = context;

  if (type === 'travel') {
    const routeInfo = locations.length > 0
      ? `Journey: ${locations.join(' → ')}`
      : 'Main route visualization';

    return `Create an illustrated journey map for: ${topic}

VISUAL CONCEPT: "Adventure Path" - 보물지도를 펼치는 설렘

MUST INCLUDE ELEMENTS:
- Winding illustrated path connecting stops (NOT straight arrows)
- Charming landmark illustrations at each point
- Small icons showing transport types (cute train, bus, walking figures)
- Time bubbles with handwritten-style numbers
- Decorative elements: clouds, trees, tiny details that reward close looking

JOURNEY DETAILS:
${routeInfo}
${narrativeHint ? `- Narrative context: ${narrativeHint}` : ''}
${Object.entries(data).map(([key, value]) => `- ${key}: ${value}`).join('\n')}

STYLE GUIDELINES:
- Perspective: Slightly tilted bird's-eye view (like opening a folded map)
- Color palette: Warm yellows, coral highlights, forest green, sky blue
- Line work: Hand-drawn quality, slightly wobbly (charming, not sloppy)
- Characters: Optional tiny travelers at starting point
- Mood: Exciting, the journey IS the destination

AVOID: Metro-style technical diagrams, corporate flowcharts, cold precision

Make it feel like an adventure waiting to happen.`;
  }

  // culture type
  return `Create an elegant venue exploration guide for: ${topic}

VISUAL CONCEPT: "Gallery Floor Plan" - 큐레이터의 비밀 동선

MUST INCLUDE ELEMENTS:
- Artistic floor plan with highlighted pathway
- Small artwork thumbnails at key viewing points
- Numbered sequence with elegant typography
- "Don't miss" stars or highlights
- Estimated time at each section
- Hidden gem indicators

${locations.length > 0 ? `Recommended order: ${locations.join(' → ')}` : ''}
${narrativeHint ? `Narrative context: ${narrativeHint}` : ''}

STYLE GUIDELINES:
- Color palette: Soft grays, gold accents, exhibition's theme color
- Layout: Sophisticated architectural drawing style
- Typography: Mix of elegant serif and clean sans-serif
- Mood: Insider knowledge, curated experience

Make viewers feel like they have VIP access to the best viewing experience.`;
}

/**
 * 지도 프롬프트 - 코스를 모험으로 변환
 */
export function getMapPrompt(context: ImageContext): string {
  const { topic, locations = [], data = {} } = context;

  const spotList = locations.length > 0
    ? locations.map((loc, i) => `${i + 1}. ${loc}`).join('\n')
    : '1. Starting point\n2. Main attraction\n3. Hidden gem\n4. Finale spot';

  return `Create a hand-illustrated walking tour map for: ${topic}

VISUAL CONCEPT: "Treasure Map Meets Travel Blog" - 발견의 기쁨을 담은 지도

MUST INCLUDE ELEMENTS:
- Illustrated buildings/landmarks with personality (not generic icons)
- Numbered stops with small illustrated scenes of what to do there
- Walking path shown as dotted adventure trail
- Time estimates between stops (walking person icon + minutes)
- "Photo spot" camera icons at scenic locations
- "Secret tip" speech bubbles with insider recommendations
- Compass rose or directional indicator
- Small illustrated vignettes: local food, shop facades, street scenes

STOPS TO INCLUDE:
${spotList}

ADDITIONAL INFO:
${Object.entries(data).map(([key, value]) => `- ${key}: ${value}`).join('\n')}

STYLE GUIDELINES:
- Color palette: Paper-tan background, ink-blue outlines, watercolor spot colors
- Perspective: Playful isometric or tilted bird's-eye view
- Line quality: Hand-drawn with confident, sketchy energy
- Details: Reward close inspection with tiny surprises
- Korean text: Handwritten labels for authentic local feel
- Mood: Like a map your cool local friend drew for you

AVOID: Google Maps style, generic pin drops, sterile digital look

This should be INSTAGRAM-WORTHY - something people screenshot and share.`;
}

/**
 * 비교표 프롬프트 - 선택을 즐거운 고민으로
 */
export function getComparisonPrompt(context: ImageContext): string {
  const { topic, type, items = [], data = {} } = context;

  const itemList = items.length > 0
    ? items.map((item, i) => `${i + 1}. ${item}`).join('\n')
    : 'Comparison items';

  if (type === 'travel') {
    return `Create a delightful comparison illustration for: ${topic}

VISUAL CONCEPT: "Menu Board at a Cute Cafe" - 고르는 재미가 있는 비교

MUST INCLUDE ELEMENTS:
- Each option as an illustrated "card" with personality
- Small food/item illustrations (appetizing, charming)
- Price tags designed like vintage shop labels
- Star ratings shown as cute icons (hearts, thumbs up, etc.)
- "Best for..." labels (couples, solo, groups, etc.)
- Handwritten-style recommendations
- "Staff pick" or "Most popular" badges

ITEMS TO COMPARE:
${itemList}

COMPARISON CRITERIA:
${Object.entries(data).map(([key, value]) => `- ${key}: ${value}`).join('\n')}

STYLE GUIDELINES:
- Layout: Side-by-side cards or playful scattered arrangement
- Color palette: Cream background, warm accent colors, food-appropriate tones
- Typography: Chalkboard menu aesthetic with Korean charm
- Illustrations: Appetizing, slightly exaggerated proportions
- Mood: "Everything looks good, happy dilemma!"

AVOID: Boring spreadsheet look, clinical comparison tables

Make viewers excited to try ALL the options.`;
  }

  // culture type
  return `Create an elegant options guide for: ${topic}

VISUAL CONCEPT: "Curator's Recommendation Card" - 선택을 돕는 세련된 가이드

MUST INCLUDE ELEMENTS:
- Clean card layout for each option
- Small illustrative previews
- Price/ticket tiers clearly distinguished
- "Perfect for..." audience indicators
- Time investment indicators
- Value highlights with elegant icons
- "Curator's choice" subtle recommendation

ITEMS TO COMPARE:
${itemList}

COMPARISON CRITERIA:
${Object.entries(data).map(([key, value]) => `- ${key}: ${value}`).join('\n')}

STYLE GUIDELINES:
- Layout: Editorial comparison, magazine-quality
- Color palette: Sophisticated neutrals with exhibition accent color
- Typography: Clean hierarchy, elegant readability
- Mood: Confident recommendations, not overwhelming options

Make the choice feel exciting, not stressful.`;
}

/**
 * 무드보드 프롬프트 - 여행지의 감성을 시각화 (NEW)
 */
export function getMoodboardPrompt(context: ImageContext): string {
  const { topic, type } = context;

  if (type === 'travel') {
    return `Create an evocative travel mood board illustration for: ${topic}

VISUAL CONCEPT: "Destination Essence" - 가기 전에 느끼는 여행지의 감성

MUST INCLUDE ELEMENTS:
- Central atmospheric scene capturing the destination's soul
- Surrounding vignettes: local details, textures, colors
- Seasonal indicators (cherry blossoms, autumn leaves, etc.)
- Color swatches representing the destination palette
- Small icons: signature food, cultural symbols, typical weather
- Evocative Korean words describing the feeling
- "Best time to visit" subtle seasonal indicator

EMOTIONAL NOTES TO CAPTURE:
- The unique atmosphere of this place
- What makes it different from similar destinations
- The sensory experience: sights, sounds, pace of life
- Who would love this place and why

STYLE GUIDELINES:
- Layout: Pinterest-worthy collage composition
- Color palette: Extracted from the destination's visual identity
- Textures: Paper, fabric, natural materials
- Typography: Mix of Korean and minimal English
- Mood: "I need to go there" inspiration

This should make someone FEEL the destination before visiting.`;
  }

  // culture type
  return `Create an artistic preview mood board for: ${topic}

VISUAL CONCEPT: "Exhibition Atmosphere" - 전시/공연의 감성 미리보기

MUST INCLUDE ELEMENTS:
- Central artistic interpretation of the main theme
- Color story extracted from the exhibition/performance
- Texture references: materials, artistic medium
- Emotional keywords in Korean calligraphy
- "Best experienced by..." audience hints
- Atmospheric lighting suggestions

Capture the FEELING of the cultural experience, not just what's there.`;
}

/**
 * 버킷리스트 프롬프트 - 경험 체크리스트 (NEW)
 */
export function getBucketlistPrompt(context: ImageContext): string {
  const { topic, locations = [] } = context;

  return `Create an illustrated bucket list for: ${topic}

VISUAL CONCEPT: "Must-Do Experiences" - 꼭 해봐야 할 것들 체크리스트

MUST INCLUDE ELEMENTS:
- Checklist format with illustrated checkbox squares
- Each item as a mini illustrated scene (not just text)
- Mix of obvious highlights and hidden gems
- "Unlock achievement" gaming-inspired badges
- Personal touch: "Take this photo", "Try this food", "Find this spot"
- Empty checkbox inviting viewer interaction
- "Bonus" or "Secret" items for adventurous visitors

EXPERIENCES TO INCLUDE:
${locations.length > 0 ? locations.map((loc, i) => `${i + 1}. ${loc}`).join('\n') : 'Key experiences for this destination'}

STYLE GUIDELINES:
- Layout: Vertical checklist with illustrated icons
- Color palette: Playful but not childish
- Typography: Mix of printed and handwritten styles
- Interaction: Looks like something to print and bring on the trip
- Mood: Gamified exploration, achievement unlocked!

Make visitors want to complete the FULL list.`;
}

// ─── 페르소나별 스틸컷 촬영 스타일 ────────────────────────────────

const PERSONA_PHOTO_STYLES: Record<string, string> = {
  viral: `PHOTOGRAPHY STYLE: Editorial magazine photography — strong directional lighting with dramatic shadows. Diagonal composition with hero framing and bold perspective. High contrast, deep blacks, strong saturation. The image should feel like a magazine spread that demands attention.`,

  friendly: `PHOTOGRAPHY STYLE: Lifestyle photography — golden hour warmth with soft bokeh backgrounds. Eye-level perspective with warm vignetting and centered subject. Warm tones, golden highlights, soft shadows. The feeling should be approachable and inviting, like a friend's travel photo.`,

  informative: `PHOTOGRAPHY STYLE: Architectural photography — even, balanced lighting with attention to structural detail. Symmetrical composition, rule of thirds, geometric framing. Balanced exposure, cool shadows, neutral midtones. Clean and precise, emphasizing form and structure.`,

  niche: `PHOTOGRAPHY STYLE: Indie street photography — tight close-up with off-center subject and shallow depth of field. Muted desaturated tones with film emulation (Fuji Superia 400 grain). Slight vignetting at edges. One selectively saturated element against the muted palette. Candid and intimate discovery moment.`,
};

const DEFAULT_PHOTO_STYLE = PERSONA_PHOTO_STYLES.friendly;

/**
 * 스틸컷 프롬프트 — 본문 섹션용 포토리얼리스틱 이미지
 * 3파트 구조: SUBJECT → ATMOSPHERE → PHOTOGRAPHY STYLE
 */
function getStillcutPrompt(context: ImageContext): string {
  const { topic, type, section = '', narrativeHint, locations = [], items = [], personaId } = context;

  const subject = locations[0] || items[0] || section;
  const locationList = locations.length > 0 ? locations.join(', ') : topic;
  const detailItems = items.length > 0 ? items.slice(0, 3).join(', ') : '';

  const atmosphere = type === 'travel'
    ? `Natural ambient light appropriate to the time and season. A sense of place — the air, sounds, and energy of ${locationList}. Real travel atmosphere with authentic Korean environmental details: Korean signage, local architecture, natural landscape elements.`
    : `The contemplative atmosphere of a cultural space. Subtle interior lighting mixed with natural light. Intellectual curiosity and quiet appreciation. Korean cultural markers in architecture, art, or design elements.`;

  const photoStyle = PERSONA_PHOTO_STYLES[personaId ?? ''] || DEFAULT_PHOTO_STYLE;

  // 내러티브 컨텍스트: 섹션 본문의 서사를 이미지에 반영
  const narrativeContext = narrativeHint
    ? `\n\nNARRATIVE CONTEXT: This photograph illustrates a section about: ${narrativeHint}. Capture the essence of this specific story, not a generic view.`
    : '';

  return `A photorealistic photograph for a Korean ${type} blog post about: ${topic}

SUBJECT: ${subject}${detailItems ? `. Key details to capture: ${detailItems}` : ''}. The scene should depict a specific, concrete moment at this location — not a generic overview but a particular detail or angle that reveals something about the place. Include authentic Korean environmental elements: Korean text on signs, Korean architectural details, Korean food or cultural items as appropriate.${narrativeContext}

ATMOSPHERE: ${atmosphere}

${photoStyle}

CRITICAL: Photorealistic photograph ONLY. NO illustration, NO digital art, NO cartoon, NO text overlay, NO watermark. Must look like an actual photograph taken on location. Must fill entire frame edge-to-edge. Korean atmosphere must be unmistakable.`;
}

/**
 * 이미지 마커에서 프롬프트 생성
 * 형식: [IMAGE:style:description]
 */
export function generatePromptFromMarker(
  marker: string,
  context: ImageContext
): { prompt: string; style: ImageStyle } | null {
  // 마커 형식 파싱: [IMAGE:style:description]
  const match = marker.match(/\[IMAGE:(\w+):(.+?)\]/);
  if (!match) return null;

  const [, styleStr, description] = match;
  const style = styleStr as ImageStyle;

  // 유효한 스타일인지 확인
  const validStyles: ImageStyle[] = ['infographic', 'diagram', 'map', 'comparison', 'moodboard', 'bucketlist', 'cover_photo'];
  if (!validStyles.includes(style)) return null;

  // 컨텍스트와 설명 결합 (실제 섹션 제목이 있으면 유지, 없으면 마커 description 사용)
  const enrichedContext: ImageContext = {
    ...context,
    section: context.section || description,
  };

  let prompt: string;
  switch (style) {
    case 'infographic':
      prompt = getInfographicPrompt(enrichedContext);
      break;
    case 'diagram':
      prompt = getDiagramPrompt(enrichedContext);
      break;
    case 'map':
      prompt = getMapPrompt(enrichedContext);
      break;
    case 'comparison':
      prompt = getComparisonPrompt(enrichedContext);
      break;
    case 'moodboard':
      prompt = getMoodboardPrompt(enrichedContext);
      break;
    case 'bucketlist':
      prompt = getBucketlistPrompt(enrichedContext);
      break;
    case 'cover_photo':
      prompt = getStillcutPrompt(enrichedContext);
      break;
    default:
      return null;
  }

  return { prompt, style };
}

/**
 * 콘텐츠 유형별 기본 이미지 제안 - 전략적 조합
 */
export function getDefaultImageSuggestions(type: 'travel' | 'culture'): Array<{
  style: ImageStyle;
  description: string;
  position: string;
}> {
  if (type === 'travel') {
    return [
      {
        style: 'infographic',
        description: '여행 준비 가이드',
        position: '기본 정보 섹션 후'
      },
      {
        style: 'map',
        description: '추천 코스 지도',
        position: '추천 코스 섹션 후'
      },
      {
        style: 'comparison',
        description: '맛집/카페 비교',
        position: '맛집 소개 섹션 후'
      }
    ];
  }

  // culture type
  return [
    {
      style: 'infographic',
      description: '관람 정보 가이드',
      position: '기본 정보 섹션 후'
    },
    {
      style: 'diagram',
      description: '추천 관람 동선',
      position: '관람 포인트 섹션 후'
    }
  ];
}
