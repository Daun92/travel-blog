/**
 * FAQ 자동 생성 모듈
 * 콘텐츠 기반 FAQ 생성 (AI 엔진 최적화)
 */

import { generate } from '../generator/gemini.js';

/**
 * FAQ 항목
 */
export interface FAQItem {
  question: string;
  answer: string;
  category?: string;
}

/**
 * FAQ 생성 결과
 */
export interface FAQGenerationResult {
  faqs: FAQItem[];
  generatedAt: string;
  sourceTitle: string;
}

/**
 * FAQ 생성 프롬프트 빌드
 */
function buildFAQPrompt(
  title: string,
  content: string,
  frontmatter: Record<string, unknown>,
  count: number = 5
): string {
  const categories = frontmatter.categories as string[] | undefined;
  const contentType = categories?.includes?.('culture') ? '문화/전시' : '여행/관광';
  const venue = frontmatter.venue || frontmatter.title || title;

  return `
다음 ${contentType} 콘텐츠를 읽고, 독자들이 자주 물어볼 만한 질문 ${count}개와 답변을 생성해주세요.

제목: ${title}
장소/주제: ${venue}
${frontmatter.location ? `위치: ${frontmatter.location}` : ''}
${frontmatter.ticketPrice ? `입장료: ${frontmatter.ticketPrice}` : ''}
${frontmatter.openingHours ? `운영시간: ${frontmatter.openingHours}` : ''}

---
본문:
${content.slice(0, 3000)}
---

다음 형식으로 정확히 응답해주세요 (JSON 배열):

[
  {
    "question": "질문 1",
    "answer": "간결하고 정확한 답변 (2-3문장)",
    "category": "기본정보|위치/교통|예약/요금|추천/팁"
  },
  ...
]

생성 가이드라인:
1. 실제 방문자/독자가 궁금해할 실용적인 질문
2. 본문에서 명확히 답할 수 있는 내용만 포함
3. 답변은 간결하고 핵심적으로 (50자 이내 권장)
4. 카테고리는 4가지 중 하나로 분류
5. 중복되는 내용 없이 다양한 관점의 질문

JSON 배열만 출력하세요:
`.trim();
}

/**
 * LLM 응답 파싱
 */
function parseResponse(response: string): FAQItem[] {
  try {
    // JSON 배열 추출
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('JSON 배열을 찾을 수 없습니다');
    }

    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      question?: string;
      answer?: string;
      category?: string;
    }>;

    return parsed
      .filter(item => item.question && item.answer)
      .map(item => ({
        question: item.question!.trim(),
        answer: item.answer!.trim(),
        category: item.category?.trim()
      }));
  } catch (error) {
    console.error('FAQ 응답 파싱 실패:', error);
    return [];
  }
}

/**
 * FAQ 생성
 */
export async function generateFAQs(
  title: string,
  content: string,
  frontmatter: Record<string, unknown> = {},
  options: {
    count?: number;
    temperature?: number;
  } = {}
): Promise<FAQGenerationResult> {
  const { count = 5, temperature = 0.7 } = options;

  const prompt = buildFAQPrompt(title, content, frontmatter, count);

  try {
    const response = await generate(prompt, {
      temperature,
      max_tokens: 2000
    });

    const faqs = parseResponse(response);

    return {
      faqs,
      generatedAt: new Date().toISOString(),
      sourceTitle: title
    };
  } catch (error) {
    console.error('FAQ 생성 오류:', error);
    return {
      faqs: [],
      generatedAt: new Date().toISOString(),
      sourceTitle: title
    };
  }
}

/**
 * FAQ를 마크다운으로 변환
 */
export function faqsToMarkdown(faqs: FAQItem[]): string {
  if (faqs.length === 0) return '';

  const lines: string[] = [
    '## 자주 묻는 질문',
    ''
  ];

  for (const faq of faqs) {
    lines.push(`### ${faq.question}`);
    lines.push('');
    lines.push(faq.answer);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * FAQ를 Frontmatter용 배열로 변환
 */
export function faqsToFrontmatter(faqs: FAQItem[]): Array<{ q: string; a: string }> {
  return faqs.map(faq => ({
    q: faq.question,
    a: faq.answer
  }));
}
