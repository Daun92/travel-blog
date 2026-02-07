/**
 * 하이브리드 팩트체크 클라이언트
 * 1차: 공식 API (한국관광공사 KorService2, 문화포털)
 * 2차: Gemini Grounding (웹 검색 기반)
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  ExtractedClaim,
  VerificationResult,
  GroundingResponse,
  OfficialApiResult
} from './types.js';
import { getDataGoKrClient } from '../api/data-go-kr/index.js';

interface GroundingClientConfig {
  apiKey: string;
  model?: string;
  maxRetries?: number;
  retryDelayMs?: number;
}

// 캐시 (세션 내 중복 검증 방지)
const verificationCache = new Map<string, VerificationResult>();

/**
 * 공식 API로 장소 검증
 * KorService2 공유 클라이언트 사용 (레이트리밋/쿼터 통합 관리)
 */
async function verifyWithOfficialApi(
  claim: ExtractedClaim
): Promise<OfficialApiResult | null> {
  const cultureApiKey = process.env.CULTURE_API_KEY;

  // 장소/관광지 검증 (한국관광공사 KorService2)
  if (claim.type === 'venue_exists' || claim.type === 'location') {
    const client = getDataGoKrClient();
    if (!client) return null;

    try {
      const items = await client.searchKeyword(claim.value, { numOfRows: 5 });

      if (items.length > 0) {
        return {
          found: true,
          data: {
            title: items[0].title,
            address: items[0].addr1,
            tel: items[0].tel
          },
          source: 'korean_tourism_api_v2',
          checkedAt: new Date().toISOString()
        };
      }

      return {
        found: false,
        source: 'korean_tourism_api_v2',
        checkedAt: new Date().toISOString()
      };
    } catch {
      return null;
    }
  }

  // 전시/문화행사 검증 (문화포털 API)
  if (claim.type === 'event_period') {
    if (!cultureApiKey) return null;

    try {
      const searchKeyword = encodeURIComponent(claim.value);
      const url = `http://www.culture.go.kr/openapi/rest/publicperformancedisplays/period?serviceKey=${cultureApiKey}&keyword=${searchKeyword}&rows=5`;

      const response = await fetch(url);
      if (!response.ok) return null;

      // XML 응답 처리 (간소화)
      const text = await response.text();
      const found = text.includes('<item>');

      return {
        found,
        source: 'culture_portal_api',
        checkedAt: new Date().toISOString()
      };
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Gemini Grounding으로 웹 검색 기반 검증
 */
async function verifyWithGeminiGrounding(
  claim: ExtractedClaim,
  config: GroundingClientConfig
): Promise<VerificationResult> {
  const genAI = new GoogleGenerativeAI(config.apiKey);
  const model = genAI.getGenerativeModel({
    model: config.model || 'gemini-2.0-flash',
    // Grounding 활성화
    tools: [{
      googleSearch: {}
    }] as unknown as []  // Type workaround for google search grounding
  });

  // 검증 프롬프트 생성
  const prompt = buildVerificationPrompt(claim);

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // Grounding 메타데이터 추출
    const groundingMetadata = (response as unknown as GroundingResponse).groundingMetadata;

    // 응답 파싱
    return parseVerificationResponse(claim, text, groundingMetadata);
  } catch (error) {
    console.error(`Grounding API 오류 (${claim.id}):`, error);

    return {
      claimId: claim.id,
      status: 'unknown',
      confidence: 0,
      source: 'unknown',
      checkedAt: new Date().toISOString(),
      details: `API 오류: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * 검증 프롬프트 생성
 */
function buildVerificationPrompt(claim: ExtractedClaim): string {
  const typeDescriptions: Record<string, string> = {
    venue_exists: '이 장소가 실제로 존재하는지',
    location: '이 주소가 정확한지',
    hours: '이 운영시간이 정확한지',
    event_period: '이 전시/이벤트 기간이 정확한지',
    price: '이 가격 정보가 정확한지',
    facilities: '이 시설 정보가 정확한지',
    contact: '이 연락처가 정확한지',
    transport: '이 교통 정보가 정확한지'
  };

  const description = typeDescriptions[claim.type] || '이 정보가 정확한지';

  return `
다음 정보를 검증해주세요:

정보 유형: ${claim.type}
검증 대상: "${claim.value}"
${claim.context ? `문맥: "${claim.context}"` : ''}

${description} 확인하고, 다음 형식으로 정확히 응답해주세요:

VERIFICATION_STATUS: [VERIFIED/FALSE/UNKNOWN]
CONFIDENCE: [0-100 사이 숫자]
CORRECT_VALUE: [틀린 경우 정확한 값, 맞으면 빈 칸]
DETAILS: [추가 설명]

참고:
- VERIFIED: 정보가 정확함
- FALSE: 정보가 틀림 (정확한 값 제시 필수)
- UNKNOWN: 확인 불가능 (정보 부족 또는 검색 결과 없음)
`.trim();
}

/**
 * 검증 응답 파싱
 */
function parseVerificationResponse(
  claim: ExtractedClaim,
  responseText: string,
  groundingMetadata?: GroundingResponse['groundingMetadata']
): VerificationResult {
  // 상태 추출
  const statusMatch = responseText.match(/VERIFICATION_STATUS:\s*(VERIFIED|FALSE|UNKNOWN)/i);
  const status = statusMatch
    ? statusMatch[1].toLowerCase() as 'verified' | 'false' | 'unknown'
    : 'unknown';

  // 신뢰도 추출
  const confidenceMatch = responseText.match(/CONFIDENCE:\s*(\d+)/);
  let confidence = confidenceMatch ? parseInt(confidenceMatch[1], 10) : 50;

  // Grounding 지원이 있으면 신뢰도 보정
  if (groundingMetadata?.groundingSupports) {
    const avgScore = groundingMetadata.groundingSupports
      .flatMap(s => s.confidenceScores || [])
      .reduce((sum, score, _, arr) => sum + score / arr.length, 0);

    if (avgScore > 0) {
      confidence = Math.round(avgScore * 100);
    }
  }

  // 정확한 값 추출
  const correctValueMatch = responseText.match(/CORRECT_VALUE:\s*([^\n]+)/);
  const correctValue = correctValueMatch?.[1]?.trim();

  // 상세 설명 추출
  const detailsMatch = responseText.match(/DETAILS:\s*([^\n]+)/);
  const details = detailsMatch?.[1]?.trim();

  // 소스 URL 추출
  const sourceUrl = groundingMetadata?.groundingChunks?.[0]?.web?.uri;

  return {
    claimId: claim.id,
    status,
    confidence,
    source: 'web_search',
    sourceUrl,
    correctValue: status === 'false' && correctValue ? correctValue : undefined,
    checkedAt: new Date().toISOString(),
    details
  };
}

/**
 * 재시도 로직이 포함된 검증
 */
async function verifyWithRetry(
  claim: ExtractedClaim,
  config: GroundingClientConfig
): Promise<VerificationResult> {
  const maxRetries = config.maxRetries || 3;
  const retryDelayMs = config.retryDelayMs || 1000;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // 1차: 공식 API 시도
      const officialResult = await verifyWithOfficialApi(claim);

      if (officialResult?.found !== undefined) {
        return {
          claimId: claim.id,
          status: officialResult.found ? 'verified' : 'unknown',
          confidence: officialResult.found ? 95 : 30,
          source: 'official_api',
          checkedAt: officialResult.checkedAt,
          details: `공식 API (${officialResult.source})에서 ${officialResult.found ? '확인됨' : '검색 결과 없음'}`
        };
      }

      // 2차: Gemini Grounding
      return await verifyWithGeminiGrounding(claim, config);

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`검증 시도 ${attempt + 1}/${maxRetries} 실패:`, lastError.message);

      if (attempt < maxRetries - 1) {
        // 지수 백오프
        const delay = retryDelayMs * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // 모든 재시도 실패
  return {
    claimId: claim.id,
    status: 'unknown',
    confidence: 0,
    source: 'unknown',
    checkedAt: new Date().toISOString(),
    details: `모든 검증 시도 실패: ${lastError?.message}`
  };
}

/**
 * 단일 클레임 검증
 */
export async function verifyClaim(
  claim: ExtractedClaim,
  config: GroundingClientConfig
): Promise<VerificationResult> {
  // 캐시 확인
  const cacheKey = `${claim.type}:${claim.value}`;
  const cached = verificationCache.get(cacheKey);

  if (cached) {
    return {
      ...cached,
      claimId: claim.id,
      source: 'cached'
    };
  }

  // 검증 실행
  const result = await verifyWithRetry(claim, config);

  // 캐시 저장 (unknown이 아닌 경우만)
  if (result.status !== 'unknown') {
    verificationCache.set(cacheKey, result);
  }

  return result;
}

/**
 * 다중 클레임 검증 (배치)
 */
export async function verifyClaims(
  claims: ExtractedClaim[],
  config: GroundingClientConfig,
  onProgress?: (current: number, total: number, claim: ExtractedClaim) => void
): Promise<VerificationResult[]> {
  const results: VerificationResult[] = [];

  // Critical 클레임 우선 처리
  const sortedClaims = [...claims].sort((a, b) => {
    const priority = { critical: 0, major: 1, minor: 2 };
    return priority[a.severity] - priority[b.severity];
  });

  for (let i = 0; i < sortedClaims.length; i++) {
    const claim = sortedClaims[i];

    if (onProgress) {
      onProgress(i + 1, sortedClaims.length, claim);
    }

    const result = await verifyClaim(claim, config);
    results.push(result);

    // Critical 클레임이 FALSE면 조기 종료 옵션
    if (claim.severity === 'critical' && result.status === 'false') {
      console.warn(`Critical 클레임 실패: ${claim.value}`);
      // 나머지는 unknown으로 처리하고 종료할 수 있음
      // 여기서는 계속 진행
    }

    // API 과부하 방지를 위한 딜레이
    if (i < sortedClaims.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return results;
}

/**
 * 캐시 초기화
 */
export function clearVerificationCache(): void {
  verificationCache.clear();
}

/**
 * 캐시 상태 조회
 */
export function getCacheStats(): { size: number; entries: string[] } {
  return {
    size: verificationCache.size,
    entries: Array.from(verificationCache.keys())
  };
}
