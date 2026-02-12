/**
 * 멀티 페르소나 설정 로더
 *
 * 4인 에이전트 페르소나 시스템:
 * - viral (조회영): 바이럴, 공유 유도
 * - friendly (김주말): 친근감, 장기 팬층
 * - informative (한교양): 유익함, 교양
 * - niche (오덕우): 취향 디깅, 숨은 발견
 */

import { readFile } from 'fs/promises';
import { join } from 'path';

// ============================================================================
// 타입 정의
// ============================================================================

export interface Persona {
  id: string;
  name: string;
  authorLine: string;
  tagline: string;

  background: {
    job: string;
    age_range: string;
    travel_style: string;
    constraints: string[];
    priorities: string[];
  };

  voice: {
    tone: string;
    formality: string;
    sentence_starters: string[];
    signature_phrases: string[];
    never_say: string[];
  };

  detailing_rules: {
    always_include: string[];
    number_requirements: {
      min_specific_numbers: number;
      types: string[];
    };
    structure: {
      intro: string;
      body: string;
      conclusion: string;
    };
    comparison_required: boolean;
    failure_story_required: boolean;
    subjective_judgment_required: boolean;
  };

  content_type_variants: {
    travel: {
      focus: string[];
      must_answer: string[];
    };
    culture: {
      focus: string[];
      must_answer: string[];
    };
  };

  quality_indicators: {
    good_signs: string[];
    bad_signs: string[];
  };
}

export interface AssignmentRule {
  keywords: string[];
  weight: number;
}

export interface PersonaRegistry {
  defaultPersona: string;
  personas: string[];
  assignmentRules: Record<string, AssignmentRule>;
}

// ============================================================================
// 경로 및 캐시
// ============================================================================

const PERSONAS_DIR = join(process.cwd(), 'config', 'personas');
const LEGACY_CONFIG_PATH = join(process.cwd(), 'config', 'persona.json');

let registryCache: PersonaRegistry | null = null;
const personaCache = new Map<string, Persona>();

// ============================================================================
// 레지스트리 로더
// ============================================================================

/**
 * 페르소나 레지스트리 로드
 */
export async function loadPersonaRegistry(): Promise<PersonaRegistry | null> {
  if (registryCache) {
    return registryCache;
  }

  try {
    const content = await readFile(join(PERSONAS_DIR, 'index.json'), 'utf-8');
    registryCache = JSON.parse(content) as PersonaRegistry;
    return registryCache;
  } catch {
    return null;
  }
}

/**
 * ID로 특정 페르소나 로드
 */
export async function loadPersonaById(id: string): Promise<Persona | null> {
  if (personaCache.has(id)) {
    return personaCache.get(id)!;
  }

  try {
    const content = await readFile(join(PERSONAS_DIR, `${id}.json`), 'utf-8');
    const persona = JSON.parse(content) as Persona;
    personaCache.set(id, persona);
    return persona;
  } catch {
    return null;
  }
}

// ============================================================================
// 자동 배정 알고리즘
// ============================================================================

/**
 * 주제/키워드 기반 페르소나 자동 선택
 *
 * 1. overrideId 지정 시 해당 페르소나 강제 사용
 * 2. 없으면 키워드 매칭 점수로 결정
 * 3. 매칭 없으면 friendly(김주말) 기본값
 */
export async function selectPersona(
  topic: string,
  type: 'travel' | 'culture',
  keywords?: string[],
  overrideId?: string
): Promise<Persona | null> {
  // 1. 수동 지정
  if (overrideId) {
    return loadPersonaById(overrideId);
  }

  // 2. 레지스트리 로드
  const registry = await loadPersonaRegistry();
  if (!registry) {
    // 레지스트리 없으면 레거시 폴백
    return loadPersona();
  }

  // 3. 키워드 매칭
  const searchText = [topic, ...(keywords || [])].join(' ');
  const scores: Record<string, number> = {};

  for (const [personaId, rule] of Object.entries(registry.assignmentRules)) {
    let score = 0;
    for (const keyword of rule.keywords) {
      if (searchText.includes(keyword)) {
        score += rule.weight;
      }
    }
    scores[personaId] = score;
  }

  // 4. 최고 점수 페르소나 선택
  let bestId = registry.defaultPersona;
  let bestScore = 0;

  for (const [personaId, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestId = personaId;
    }
  }

  return loadPersonaById(bestId);
}

// ============================================================================
// 레거시 호환 로더
// ============================================================================

/**
 * 페르소나 설정 로드 (하위호환)
 * 새 시스템의 friendly 페르소나를 로드하고, 실패 시 레거시 config/persona.json 폴백
 */
export async function loadPersona(): Promise<Persona | null> {
  // 새 시스템에서 friendly 로드 시도
  const friendly = await loadPersonaById('friendly');
  if (friendly) {
    return friendly;
  }

  // 레거시 폴백
  try {
    const content = await readFile(LEGACY_CONFIG_PATH, 'utf-8');
    const legacy = JSON.parse(content);
    // 레거시에는 id, authorLine이 없으므로 추가
    return {
      id: 'friendly',
      authorLine: '김주말 (OpenClaw)',
      ...legacy
    } as Persona;
  } catch {
    return null;
  }
}

/**
 * 페르소나 캐시 초기화
 */
export function clearPersonaCache(): void {
  registryCache = null;
  personaCache.clear();
}

// ============================================================================
// 프롬프트 빌더 (기존 API 유지)
// ============================================================================

/**
 * 페르소나 톤 프롬프트 생성
 */
export function buildPersonaPromptSection(persona: Persona): string {
  return `
## 페르소나: ${persona.name}
"${persona.tagline}"

### 배경
- 직업: ${persona.background.job}
- 여행 스타일: ${persona.background.travel_style}
- 제약: ${persona.background.constraints.join(', ')}
- 우선순위: ${persona.background.priorities.join(', ')}

### 말투
- 톤: ${persona.voice.tone}
- 문체: ${persona.voice.formality}
- 자주 쓰는 문장 시작: ${persona.voice.sentence_starters.join(' / ')}
- 시그니처 표현: ${persona.voice.signature_phrases.join(' / ')}

### 절대 사용 금지 표현
${persona.voice.never_say.join(', ')}

### 필수 포함 요소
${persona.detailing_rules.always_include.map(item => `- ${item}`).join('\n')}

### 구조
- 도입: ${persona.detailing_rules.structure.intro}
- 본문: ${persona.detailing_rules.structure.body}
- 결론: ${persona.detailing_rules.structure.conclusion}
`.trim();
}

/**
 * 콘텐츠 타입별 추가 지침
 */
export function getContentTypeGuidance(
  persona: Persona,
  contentType: 'travel' | 'culture'
): string {
  const variant = persona.content_type_variants[contentType];

  return `
### ${contentType === 'travel' ? '여행' : '문화예술'} 콘텐츠 특화

**집중 포인트**: ${variant.focus.join(', ')}

**반드시 답해야 할 질문**:
${variant.must_answer.map(q => `- ${q}`).join('\n')}
`.trim();
}

export default loadPersona;
