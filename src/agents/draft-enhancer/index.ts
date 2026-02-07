/**
 * 드래프트 향상 에이전트
 * 페르소나 적용 + 디테일링 + 클리셰 제거
 */

import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import matter from 'gray-matter';
import { generate } from '../../generator/gemini.js';
import { loadPersona, Persona } from './persona-loader.js';
import { detectCliches, ClicheReport } from './cliche-filter.js';
import { analyzeDetailLevel, DetailAnalysis } from './detail-analyzer.js';

// ============================================================================
// 타입 정의
// ============================================================================

export interface EnhanceOptions {
  filePath: string;
  contentType?: 'travel' | 'culture';
  dryRun?: boolean;
  verbose?: boolean;
  onProgress?: (message: string) => void;
}

export interface EnhanceResult {
  success: boolean;
  filePath: string;

  // 분석 결과
  originalAnalysis: {
    cliches: ClicheReport;
    detailLevel: DetailAnalysis;
    personaAlignment: number;
  };

  // 향상 결과
  enhanced: boolean;
  enhancedContent?: string;

  // 변경 사항
  changes: {
    clichesRemoved: number;
    detailsAdded: number;
    toneAdjustments: number;
  };

  // 최종 분석
  finalAnalysis?: {
    cliches: ClicheReport;
    detailLevel: DetailAnalysis;
    personaAlignment: number;
  };

  warnings: string[];
}

// ============================================================================
// 메인 에이전트
// ============================================================================

export class DraftEnhancerAgent {
  private persona: Persona | null = null;

  /**
   * 페르소나 로드
   */
  async initialize(): Promise<void> {
    this.persona = await loadPersona();
    if (!this.persona) {
      throw new Error('페르소나 설정을 로드할 수 없습니다. config/persona.json을 확인하세요.');
    }
  }

  /**
   * 드래프트 향상 실행
   */
  async enhance(options: EnhanceOptions): Promise<EnhanceResult> {
    const {
      filePath,
      contentType = 'travel',
      dryRun = false,
      verbose = false,
      onProgress = () => {}
    } = options;

    const warnings: string[] = [];

    // 페르소나 확인
    if (!this.persona) {
      await this.initialize();
    }

    // 파일 읽기
    onProgress('드래프트 파일 읽는 중...');
    const fileContent = await readFile(filePath, 'utf-8');
    const { data: frontmatter, content } = matter(fileContent);

    // 1. 원본 분석
    onProgress('원본 콘텐츠 분석 중...');
    const clicheReport = detectCliches(content, this.persona!);
    const detailAnalysis = analyzeDetailLevel(content, this.persona!, contentType);
    const personaAlignment = this.calculatePersonaAlignment(content, clicheReport, detailAnalysis);

    const originalAnalysis = {
      cliches: clicheReport,
      detailLevel: detailAnalysis,
      personaAlignment
    };

    if (verbose) {
      onProgress(`  클리셰 발견: ${clicheReport.found.length}개`);
      onProgress(`  디테일 점수: ${detailAnalysis.score}/100`);
      onProgress(`  페르소나 적합도: ${personaAlignment}%`);
    }

    // 2. 향상 필요 여부 판단
    const needsEnhancement =
      clicheReport.found.length > 0 ||
      detailAnalysis.score < 70 ||
      personaAlignment < 70;

    if (!needsEnhancement) {
      onProgress('향상이 필요하지 않습니다. 이미 고품질 콘텐츠입니다.');
      return {
        success: true,
        filePath,
        originalAnalysis,
        enhanced: false,
        changes: { clichesRemoved: 0, detailsAdded: 0, toneAdjustments: 0 },
        warnings
      };
    }

    // 3. AI 향상 프롬프트 생성
    onProgress('AI 향상 프롬프트 생성 중...');
    const enhancePrompt = this.buildEnhancePrompt(
      content,
      contentType,
      clicheReport,
      detailAnalysis
    );

    // 4. AI 향상 실행
    onProgress('AI가 콘텐츠 향상 중... (1-2분 소요)');
    const enhancedContent = await generate(enhancePrompt, {
      temperature: 0.7,
      max_tokens: 6000
    });

    // 5. 향상된 콘텐츠 정리
    const cleanedContent = this.cleanEnhancedContent(enhancedContent);

    // 6. 향상 후 분석
    onProgress('향상된 콘텐츠 검증 중...');
    const finalClicheReport = detectCliches(cleanedContent, this.persona!);
    const finalDetailAnalysis = analyzeDetailLevel(cleanedContent, this.persona!, contentType);
    const finalPersonaAlignment = this.calculatePersonaAlignment(cleanedContent, finalClicheReport, finalDetailAnalysis);

    const finalAnalysis = {
      cliches: finalClicheReport,
      detailLevel: finalDetailAnalysis,
      personaAlignment: finalPersonaAlignment
    };

    // 7. 변경 사항 계산
    const changes = {
      clichesRemoved: clicheReport.found.length - finalClicheReport.found.length,
      detailsAdded: Math.max(0, finalDetailAnalysis.specificNumbers - detailAnalysis.specificNumbers),
      toneAdjustments: Math.abs(finalPersonaAlignment - personaAlignment)
    };

    if (verbose) {
      onProgress(`  클리셰 제거: ${changes.clichesRemoved}개`);
      onProgress(`  디테일 추가: ${changes.detailsAdded}개`);
      onProgress(`  최종 페르소나 적합도: ${finalPersonaAlignment}%`);
    }

    // 8. 파일 저장 (dry-run이 아닐 때)
    if (!dryRun) {
      onProgress('향상된 콘텐츠 저장 중...');
      const newFileContent = matter.stringify(cleanedContent, frontmatter);
      await writeFile(filePath, newFileContent, 'utf-8');
      onProgress(`저장 완료: ${filePath}`);
    } else {
      onProgress('[DRY-RUN] 실제 저장하지 않음');
    }

    // 경고 추가
    if (finalClicheReport.found.length > 0) {
      warnings.push(`아직 ${finalClicheReport.found.length}개의 클리셰가 남아있습니다.`);
    }
    if (finalDetailAnalysis.score < 70) {
      warnings.push(`디테일 점수가 여전히 낮습니다: ${finalDetailAnalysis.score}/100`);
    }

    return {
      success: true,
      filePath,
      originalAnalysis,
      enhanced: true,
      enhancedContent: cleanedContent,
      changes,
      finalAnalysis,
      warnings
    };
  }

  /**
   * 페르소나 적합도 계산
   */
  private calculatePersonaAlignment(
    content: string,
    clicheReport: ClicheReport,
    detailAnalysis: DetailAnalysis
  ): number {
    let score = 100;

    // 클리셰 사용 감점 (-5점 per cliche, max -30)
    score -= Math.min(30, clicheReport.found.length * 5);

    // 디테일 부족 감점
    if (detailAnalysis.specificNumbers < 5) {
      score -= (5 - detailAnalysis.specificNumbers) * 5;
    }

    // 실패담 없으면 감점
    if (!detailAnalysis.hasFailureStory) {
      score -= 10;
    }

    // 비교 없으면 감점
    if (!detailAnalysis.hasComparison) {
      score -= 10;
    }

    // 페르소나 시그니처 문구 사용 가점
    const signaturePhrases = this.persona?.voice.signature_phrases || [];
    const usedSignatures = signaturePhrases.filter(p => content.includes(p)).length;
    score += Math.min(10, usedSignatures * 3);

    return Math.max(0, Math.min(100, score));
  }

  /**
   * 향상 프롬프트 빌드
   */
  private buildEnhancePrompt(
    content: string,
    contentType: 'travel' | 'culture',
    clicheReport: ClicheReport,
    detailAnalysis: DetailAnalysis
  ): string {
    const persona = this.persona!;
    const variant = persona.content_type_variants[contentType];

    return `당신은 블로그 에디터입니다. 아래 초안을 "${persona.name}" 페르소나에 맞게 리라이팅해주세요.

## 페르소나: ${persona.name}
${persona.tagline}

### 배경
- ${persona.background.job}
- 여행 스타일: ${persona.background.travel_style}
- 우선순위: ${persona.background.priorities.join(', ')}

### 말투 규칙
- 톤: ${persona.voice.tone}
- 문체: ${persona.voice.formality}
- 자주 쓰는 표현: ${persona.voice.signature_phrases.slice(0, 5).join(' / ')}
- 문장 시작: ${persona.voice.sentence_starters.slice(0, 4).join(' / ')}

### 절대 사용 금지 (클리셰)
${persona.voice.never_say.join(', ')}

## 현재 초안의 문제점

### 발견된 클리셰 (반드시 제거)
${clicheReport.found.length > 0
  ? clicheReport.found.map(c => `- "${c.text}" → ${c.suggestion}`).join('\n')
  : '없음'}

### 부족한 디테일
- 구체적 숫자: ${detailAnalysis.specificNumbers}개 (최소 5개 필요)
- 실패/불편 경험: ${detailAnalysis.hasFailureStory ? '있음' : '없음 (필수)'}
- 비교 문장: ${detailAnalysis.hasComparison ? '있음' : '없음 (필수)'}
${detailAnalysis.missingDetails.map(d => `- ${d}`).join('\n')}

## 리라이팅 지침

1. **클리셰 제거**: 위에 나열된 클리셰를 모두 구체적 표현으로 대체
2. **숫자 추가**: 시간, 금액, 거리, 대기시간 등 구체적 숫자 최소 5개
3. **실패담 추가**: 예상과 달랐던 점, 불편했던 점 1개 이상
4. **비교 추가**: 다른 곳과의 비교, 기대 vs 현실 비교
5. **페르소나 톤**: "${persona.voice.tone}" 유지
6. **필수 답변**: ${variant.must_answer.join(' / ')}

## 원본 초안

${content}

## 출력

리라이팅된 본문만 출력하세요. 프론트매터나 설명 없이 마크다운 본문만 출력합니다.
기존 구조(제목, 소제목)는 유지하되, 내용을 페르소나에 맞게 전면 수정하세요.
`;
  }

  /**
   * 향상된 콘텐츠 정리
   */
  private cleanEnhancedContent(content: string): string {
    let cleaned = content.trim();

    // 코드 블록 제거
    cleaned = cleaned.replace(/```(?:markdown)?\n?/g, '');

    // 앞뒤 설명 제거
    const lines = cleaned.split('\n');
    let startIndex = 0;
    let endIndex = lines.length;

    // 첫 번째 # 제목 찾기
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('# ')) {
        startIndex = i;
        break;
      }
    }

    cleaned = lines.slice(startIndex, endIndex).join('\n').trim();

    return cleaned;
  }
}

/**
 * 단일 파일 향상 헬퍼
 */
export async function enhanceDraft(options: EnhanceOptions): Promise<EnhanceResult> {
  const agent = new DraftEnhancerAgent();
  await agent.initialize();
  return agent.enhance(options);
}

/**
 * 분석만 수행 (향상 없이)
 */
export async function analyzeDraft(
  filePath: string,
  contentType: 'travel' | 'culture' = 'travel'
): Promise<{
  cliches: ClicheReport;
  detailLevel: DetailAnalysis;
  personaAlignment: number;
  recommendations: string[];
}> {
  const persona = await loadPersona();
  if (!persona) {
    throw new Error('페르소나 설정을 로드할 수 없습니다.');
  }

  const fileContent = await readFile(filePath, 'utf-8');
  const { content } = matter(fileContent);

  const cliches = detectCliches(content, persona);
  const detailLevel = analyzeDetailLevel(content, persona, contentType);

  // 페르소나 적합도 계산
  let personaAlignment = 100;
  personaAlignment -= Math.min(30, cliches.found.length * 5);
  if (detailLevel.specificNumbers < 5) {
    personaAlignment -= (5 - detailLevel.specificNumbers) * 5;
  }
  if (!detailLevel.hasFailureStory) personaAlignment -= 10;
  if (!detailLevel.hasComparison) personaAlignment -= 10;

  // 추천사항 생성
  const recommendations: string[] = [];

  if (cliches.found.length > 0) {
    recommendations.push(`클리셰 ${cliches.found.length}개 제거 필요`);
  }
  if (detailLevel.specificNumbers < 5) {
    recommendations.push(`구체적 숫자 ${5 - detailLevel.specificNumbers}개 이상 추가`);
  }
  if (!detailLevel.hasFailureStory) {
    recommendations.push('실패/불편 경험 추가 필요');
  }
  if (!detailLevel.hasComparison) {
    recommendations.push('다른 곳과의 비교 추가 필요');
  }
  if (detailLevel.missingDetails.length > 0) {
    recommendations.push(...detailLevel.missingDetails.slice(0, 3));
  }

  return {
    cliches,
    detailLevel,
    personaAlignment: Math.max(0, personaAlignment),
    recommendations
  };
}

export default DraftEnhancerAgent;
