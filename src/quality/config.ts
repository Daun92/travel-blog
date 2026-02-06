/**
 * 품질 게이트 설정 모듈
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

/**
 * 개별 게이트 설정
 */
export interface GateConfig {
  minScore: number;
  blockOnFailure: boolean;
  enabled?: boolean;
}

/**
 * 팩트체크 게이트 상세 설정
 */
export interface FactCheckGateConfig extends GateConfig {
  critical?: { minScore: number; items: string[] };
  major?: { minScore: number; items: string[] };
  minor?: { minScore: number; items: string[] };
  overall?: { minScore: number; blockOnFailure: boolean };
}

/**
 * 가독성 게이트 설정
 */
export interface ReadabilityGateConfig extends GateConfig {
  maxSentenceLength?: number;
  maxParagraphLength?: number;
}

/**
 * 톤 게이트 설정
 */
export interface ToneGateConfig extends GateConfig {
  profiles?: {
    travel: 'casual' | 'informative';
    culture: 'casual' | 'informative';
  };
}

/**
 * 구조 게이트 설정
 */
export interface StructureGateConfig extends GateConfig {
  requireIntro?: boolean;
  requireConclusion?: boolean;
  requireCTA?: boolean;
}

/**
 * 키워드 밀도 게이트 설정
 */
export interface KeywordDensityGateConfig extends GateConfig {
  targetDensity?: [number, number];  // [min, max] %
}

/**
 * 품질 게이트 설정
 */
export interface QualityGatesConfig {
  version: string;
  gates: {
    factcheck: FactCheckGateConfig;
    seo: GateConfig;
    content: GateConfig & { minWordCount?: number };
    duplicate: GateConfig & { similarityThreshold?: number };
    image: GateConfig;
    readability?: ReadabilityGateConfig;
    tone?: ToneGateConfig;
    structure?: StructureGateConfig;
    keyword_density?: KeywordDensityGateConfig;
  };
  publishRequirements: {
    requiredGates: string[];
    warningGates: string[];
  };
  humanReview: {
    scoreRange: { min: number; max: number };
    triggers: string[];
  };
  retry: {
    maxRetries: number;
    backoffMs: number[];
    fallbackStrategy: 'skip' | 'manual' | 'cache';
  };
}

// 기본 설정
const DEFAULT_CONFIG: QualityGatesConfig = {
  version: '1.0.0',
  gates: {
    factcheck: {
      minScore: 80,
      blockOnFailure: true,
      critical: { minScore: 100, items: ['venue_exists', 'location'] },
      major: { minScore: 85, items: ['hours', 'event_period'] },
      minor: { minScore: 70, items: ['price', 'facilities'] },
      overall: { minScore: 80, blockOnFailure: true }
    },
    seo: {
      minScore: 70,
      blockOnFailure: false,
      enabled: true
    },
    content: {
      minScore: 70,
      blockOnFailure: false,
      minWordCount: 1500,
      enabled: true
    },
    duplicate: {
      minScore: 100,  // 중복이 아니어야 함 (100 = 유니크)
      blockOnFailure: false,
      similarityThreshold: 80,  // 80% 이상 유사도면 중복
      enabled: true
    },
    image: {
      minScore: 70,
      blockOnFailure: false,
      enabled: true
    },
    readability: {
      minScore: 70,
      blockOnFailure: false,
      enabled: true,
      maxSentenceLength: 80,
      maxParagraphLength: 7
    },
    tone: {
      minScore: 70,
      blockOnFailure: false,
      enabled: true,
      profiles: {
        travel: 'casual',
        culture: 'informative'
      }
    },
    structure: {
      minScore: 70,
      blockOnFailure: false,
      enabled: true,
      requireIntro: true,
      requireConclusion: true,
      requireCTA: false
    },
    keyword_density: {
      minScore: 70,
      blockOnFailure: false,
      enabled: true,
      targetDensity: [1, 3]
    }
  },
  publishRequirements: {
    requiredGates: ['factcheck'],
    warningGates: ['seo', 'content', 'duplicate']
  },
  humanReview: {
    scoreRange: { min: 50, max: 70 },
    triggers: ['score_50_70', 'sensitive_topic', 'new_venue', 'negative_feedback']
  },
  retry: {
    maxRetries: 3,
    backoffMs: [1000, 3000, 10000],
    fallbackStrategy: 'manual'
  }
};

const CONFIG_PATH = 'config/quality-gates.json';

/**
 * 설정 파일 로드
 */
export async function loadQualityConfig(): Promise<QualityGatesConfig> {
  try {
    if (!existsSync(CONFIG_PATH)) {
      // 설정 파일 없으면 기본값으로 생성
      await saveQualityConfig(DEFAULT_CONFIG);
      return DEFAULT_CONFIG;
    }

    const content = await readFile(CONFIG_PATH, 'utf-8');
    const parsed = JSON.parse(content) as Partial<QualityGatesConfig>;

    // 기본값과 병합
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      gates: {
        ...DEFAULT_CONFIG.gates,
        ...parsed.gates,
        factcheck: {
          ...DEFAULT_CONFIG.gates.factcheck,
          ...parsed.gates?.factcheck
        },
        seo: {
          ...DEFAULT_CONFIG.gates.seo,
          ...parsed.gates?.seo
        },
        content: {
          ...DEFAULT_CONFIG.gates.content,
          ...parsed.gates?.content
        },
        duplicate: {
          ...DEFAULT_CONFIG.gates.duplicate,
          ...parsed.gates?.duplicate
        },
        image: {
          ...DEFAULT_CONFIG.gates.image,
          ...parsed.gates?.image
        }
      },
      publishRequirements: {
        ...DEFAULT_CONFIG.publishRequirements,
        ...parsed.publishRequirements
      },
      humanReview: {
        ...DEFAULT_CONFIG.humanReview,
        ...parsed.humanReview
      },
      retry: {
        ...DEFAULT_CONFIG.retry,
        ...parsed.retry
      }
    };
  } catch (error) {
    console.warn('품질 설정 로드 실패, 기본값 사용:', error);
    return DEFAULT_CONFIG;
  }
}

/**
 * 설정 파일 저장
 */
export async function saveQualityConfig(config: QualityGatesConfig): Promise<void> {
  const dir = path.dirname(CONFIG_PATH);

  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }

  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
}

/**
 * 특정 게이트 설정 업데이트
 */
export async function updateGateConfig(
  gateName: keyof QualityGatesConfig['gates'],
  updates: Partial<GateConfig>
): Promise<QualityGatesConfig> {
  const config = await loadQualityConfig();

  // Type-safe update with spread operator
  const currentGate = config.gates[gateName];
  const updatedGate = {
    ...currentGate,
    ...updates
  } as typeof currentGate;

  (config.gates as Record<string, unknown>)[gateName] = updatedGate;

  await saveQualityConfig(config);
  return config;
}

/**
 * 기본 설정으로 리셋
 */
export async function resetToDefaults(): Promise<QualityGatesConfig> {
  await saveQualityConfig(DEFAULT_CONFIG);
  return DEFAULT_CONFIG;
}

export { DEFAULT_CONFIG };
