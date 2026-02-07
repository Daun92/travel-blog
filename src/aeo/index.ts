/**
 * AEO (AI Engine Optimization) 모듈
 * AI 검색 엔진 최적화를 위한 구조화된 데이터 생성
 */

import { readFile, writeFile } from 'fs/promises';
import matter from 'gray-matter';
import {
  generateFAQs,
  faqsToMarkdown,
  faqsToFrontmatter
} from './faq-generator.js';
import type { FAQItem, FAQGenerationResult } from './faq-generator.js';
import {
  generateArticleSchema,
  generateFAQSchema,
  generateTouristAttractionSchema,
  generateEventSchema,
  generateBreadcrumbSchema,
  generateCombinedSchema,
  schemaToJsonLd
} from './schema-generator.js';

export {
  generateFAQs,
  faqsToMarkdown,
  faqsToFrontmatter,
  generateArticleSchema,
  generateFAQSchema,
  generateTouristAttractionSchema,
  generateEventSchema,
  generateBreadcrumbSchema,
  generateCombinedSchema,
  schemaToJsonLd
};
export type { FAQItem, FAQGenerationResult };

/**
 * AEO 처리 결과
 */
export interface AEOResult {
  filePath: string;
  title: string;
  processedAt: string;

  // 생성된 요소
  faqs: FAQItem[];
  schemas: Array<Record<string, unknown>>;

  // 메타데이터
  hasExistingFAQs: boolean;
  hasExistingSchema: boolean;
  faqsAdded: number;
  schemasAdded: number;
}

/**
 * AEO 설정
 */
export interface AEOConfig {
  baseUrl: string;
  siteName: string;
  locale: string;
  faqCount: number;
  includeArticleSchema: boolean;
  includeFAQSchema: boolean;
  includeLocationSchema: boolean;
  includeEventSchema: boolean;
  includeBreadcrumbSchema: boolean;
}

const DEFAULT_CONFIG: AEOConfig = {
  baseUrl: process.env.HUGO_BASE_URL || '/travel-blog',
  siteName: 'OpenClaw Travel',
  locale: 'ko_KR',
  faqCount: 5,
  includeArticleSchema: true,
  includeFAQSchema: true,
  includeLocationSchema: true,
  includeEventSchema: true,
  includeBreadcrumbSchema: true
};

/**
 * 단일 파일 AEO 처리
 */
export async function processAEO(
  filePath: string,
  options: Partial<AEOConfig> = {}
): Promise<AEOResult> {
  const config = { ...DEFAULT_CONFIG, ...options };

  // 파일 읽기
  const content = await readFile(filePath, 'utf-8');
  const { data: frontmatter, content: body } = matter(content);

  const title = frontmatter.title as string || 'Untitled';
  const description = frontmatter.description as string || '';
  const image = frontmatter.image as string || null;
  const date = frontmatter.date as string || new Date().toISOString();

  // 기존 AEO 요소 확인
  const hasExistingFAQs = !!(frontmatter.faqs || body.includes('## 자주 묻는 질문'));
  const hasExistingSchema = !!(frontmatter.schema || body.includes('application/ld+json'));

  const schemas: Array<Record<string, unknown>> = [];
  let faqs: FAQItem[] = [];

  // 1. FAQ 생성 (기존에 없는 경우)
  if (!hasExistingFAQs && config.includeFAQSchema) {
    const faqResult = await generateFAQs(title, body, frontmatter, {
      count: config.faqCount
    });
    faqs = faqResult.faqs;

    // FAQ Schema 추가
    if (faqs.length > 0) {
      schemas.push(generateFAQSchema(faqs));
    }
  }

  // 2. Article Schema
  if (config.includeArticleSchema) {
    const slug = frontmatter.slug || filePath.split('/').pop()?.replace('.md', '');
    const url = `${config.baseUrl}/posts/${slug}/`;

    schemas.push(generateArticleSchema(
      title,
      description,
      url,
      image,
      date,
      frontmatter.lastmod as string || date,
      frontmatter.author as string || 'OpenClaw',
      { baseUrl: config.baseUrl, siteName: config.siteName, locale: config.locale }
    ));
  }

  // 3. TouristAttraction Schema (여행 콘텐츠)
  const isTravel = frontmatter.categories?.includes?.('travel') ||
                   frontmatter.type === 'travel' ||
                   frontmatter.venue;

  if (config.includeLocationSchema && isTravel && frontmatter.venue) {
    schemas.push(generateTouristAttractionSchema(
      frontmatter.venue as string,
      description,
      frontmatter.address as string || frontmatter.location as string || '',
      image,
      {
        openingHours: frontmatter.openingHours as string,
        telephone: frontmatter.tel as string,
        priceRange: frontmatter.ticketPrice as string
      }
    ));
  }

  // 4. Event Schema (문화/전시 콘텐츠)
  const isCulture = frontmatter.categories?.includes?.('culture') ||
                    frontmatter.type === 'culture' ||
                    frontmatter.eventDate;

  if (config.includeEventSchema && isCulture && frontmatter.eventDate) {
    const eventDate = frontmatter.eventDate as string;
    const [startDate, endDate] = eventDate.includes('~')
      ? eventDate.split('~').map(d => d.trim())
      : [eventDate, eventDate];

    schemas.push(generateEventSchema(
      title,
      description,
      startDate,
      endDate,
      {
        name: frontmatter.venue as string || 'TBD',
        address: frontmatter.address as string || ''
      },
      {
        image: image || undefined,
        price: frontmatter.ticketPrice as string
      }
    ));
  }

  // 5. Breadcrumb Schema
  if (config.includeBreadcrumbSchema) {
    const category = frontmatter.categories?.[0] || 'posts';
    schemas.push(generateBreadcrumbSchema([
      { name: '홈', url: config.baseUrl },
      { name: category === 'travel' ? '여행' : '문화', url: `${config.baseUrl}/${category}/` },
      { name: title, url: `${config.baseUrl}/posts/${frontmatter.slug || ''}/` }
    ]));
  }

  return {
    filePath,
    title,
    processedAt: new Date().toISOString(),
    faqs,
    schemas: generateCombinedSchema(schemas),
    hasExistingFAQs,
    hasExistingSchema,
    faqsAdded: faqs.length,
    schemasAdded: schemas.length
  };
}

/**
 * 파일에 AEO 요소 적용
 */
export async function applyAEOToFile(
  filePath: string,
  aeoResult: AEOResult,
  options: {
    addFaqSection?: boolean;
    addSchemaToFrontmatter?: boolean;
  } = {}
): Promise<void> {
  const { addFaqSection = true, addSchemaToFrontmatter = true } = options;

  // 파일 읽기
  const content = await readFile(filePath, 'utf-8');
  const { data: frontmatter, content: body } = matter(content);

  let updatedFrontmatter = { ...frontmatter };
  let updatedBody = body;

  // FAQ를 Frontmatter에 추가
  if (addSchemaToFrontmatter && aeoResult.faqs.length > 0) {
    updatedFrontmatter.faqs = JSON.parse(JSON.stringify(faqsToFrontmatter(aeoResult.faqs)));
  }

  // Schema를 Frontmatter에 추가
  if (addSchemaToFrontmatter && aeoResult.schemas.length > 0) {
    // undefined 값 필터링 (YAML dump 오류 방지)
    updatedFrontmatter.schema = JSON.parse(JSON.stringify(aeoResult.schemas));
  }

  // FAQ 섹션을 본문에 추가
  if (addFaqSection && aeoResult.faqs.length > 0 && !aeoResult.hasExistingFAQs) {
    const faqMarkdown = faqsToMarkdown(aeoResult.faqs);
    updatedBody = body.trim() + '\n\n' + faqMarkdown;
  }

  // 파일 저장
  const { normalizeFrontmatterCaption } = await import('../generator/frontmatter.js');
  const newContent = normalizeFrontmatterCaption(matter.stringify(updatedBody, updatedFrontmatter));
  await writeFile(filePath, newContent);
}

/**
 * AEO 분석 (적용 없이 결과만 반환)
 */
export async function analyzeAEO(filePath: string): Promise<{
  currentScore: number;
  improvements: string[];
  hasArticleSchema: boolean;
  hasFAQSchema: boolean;
  hasLocationSchema: boolean;
  hasEventSchema: boolean;
}> {
  const content = await readFile(filePath, 'utf-8');
  const { data: frontmatter, content: body } = matter(content);

  const improvements: string[] = [];
  let score = 0;

  // 1. 제목/설명 체크
  if (frontmatter.title) score += 10;
  else improvements.push('제목 추가 필요');

  if (frontmatter.description) score += 10;
  else improvements.push('메타 설명 추가 필요');

  // 2. FAQ 체크
  const hasFAQ = !!(frontmatter.faqs || body.includes('## 자주 묻는 질문'));
  if (hasFAQ) score += 20;
  else improvements.push('FAQ 섹션 추가 권장');

  // 3. Schema 체크
  const hasSchema = !!frontmatter.schema;
  if (hasSchema) score += 20;
  else improvements.push('Schema.org 마크업 추가 권장');

  // 4. 이미지 체크
  if (frontmatter.image) score += 10;
  else improvements.push('대표 이미지 추가 권장');

  // 5. 구조화된 데이터 체크
  if (frontmatter.categories) score += 10;
  if (frontmatter.tags) score += 10;
  if (frontmatter.date) score += 10;

  return {
    currentScore: score,
    improvements,
    hasArticleSchema: hasSchema,
    hasFAQSchema: hasFAQ,
    hasLocationSchema: !!(frontmatter.venue || frontmatter.location),
    hasEventSchema: !!frontmatter.eventDate
  };
}
