/**
 * Schema.org 마크업 생성 모듈
 */

import { FAQItem } from './faq-generator.js';

/**
 * Schema.org 타입
 */
export type SchemaType =
  | 'Article'
  | 'FAQPage'
  | 'TouristAttraction'
  | 'Event'
  | 'Place'
  | 'LocalBusiness'
  | 'BreadcrumbList'
  | 'ItemList'
  | 'HowTo';

/**
 * Schema.org 마크업 옵션
 */
export interface SchemaOptions {
  baseUrl: string;
  siteName?: string;
  locale?: string;
}

/**
 * Article Schema 생성
 */
export function generateArticleSchema(
  title: string,
  description: string,
  url: string,
  image: string | null,
  publishedTime: string,
  modifiedTime: string,
  author: string = 'OpenClaw',
  options: Partial<SchemaOptions> = {}
): Record<string, unknown> {
  const { siteName = 'OpenClaw Travel', locale = 'ko_KR' } = options;

  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    image: image || undefined,
    author: {
      '@type': 'Person',
      name: author
    },
    publisher: {
      '@type': 'Organization',
      name: siteName,
      logo: {
        '@type': 'ImageObject',
        url: `${options.baseUrl || ''}/images/logo.png`
      }
    },
    datePublished: publishedTime,
    dateModified: modifiedTime || publishedTime,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url
    },
    inLanguage: locale,
    speakable: {
      '@type': 'SpeakableSpecification',
      cssSelector: ['.post-description', '.post-content > blockquote:first-of-type', 'h1', 'h2']
    }
  };
}

/**
 * FAQPage Schema 생성
 */
export function generateFAQSchema(faqs: FAQItem[]): Record<string, unknown> {
  if (faqs.length === 0) {
    return {};
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer
      }
    }))
  };
}

/**
 * TouristAttraction Schema 생성
 */
export function generateTouristAttractionSchema(
  name: string,
  description: string,
  address: string,
  image: string | null,
  options: {
    geo?: { latitude: number; longitude: number };
    openingHours?: string;
    telephone?: string;
    priceRange?: string;
    url?: string;
  } = {}
): Record<string, unknown> {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'TouristAttraction',
    name,
    description,
    address: {
      '@type': 'PostalAddress',
      streetAddress: address,
      addressLocality: extractCity(address),
      addressCountry: 'KR'
    }
  };

  if (image) {
    schema.image = image;
  }

  if (options.geo) {
    schema.geo = {
      '@type': 'GeoCoordinates',
      latitude: options.geo.latitude,
      longitude: options.geo.longitude
    };
  }

  if (options.openingHours) {
    schema.openingHoursSpecification = parseOpeningHours(options.openingHours);
  }

  if (options.telephone) {
    schema.telephone = options.telephone;
  }

  if (options.priceRange) {
    schema.priceRange = options.priceRange;
  }

  if (options.url) {
    schema.url = options.url;
  }

  return schema;
}

/**
 * Event Schema 생성
 */
export function generateEventSchema(
  name: string,
  description: string,
  startDate: string,
  endDate: string,
  location: {
    name: string;
    address: string;
  },
  options: {
    image?: string;
    price?: string;
    url?: string;
    organizer?: string;
  } = {}
): Record<string, unknown> {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name,
    description,
    startDate,
    endDate,
    location: {
      '@type': 'Place',
      name: location.name,
      address: {
        '@type': 'PostalAddress',
        streetAddress: location.address,
        addressLocality: extractCity(location.address),
        addressCountry: 'KR'
      }
    },
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode'
  };

  if (options.image) {
    schema.image = options.image;
  }

  if (options.price) {
    schema.offers = {
      '@type': 'Offer',
      price: parsePrice(options.price),
      priceCurrency: 'KRW',
      availability: 'https://schema.org/InStock',
      url: options.url
    };
  }

  if (options.organizer) {
    schema.organizer = {
      '@type': 'Organization',
      name: options.organizer
    };
  }

  return schema;
}

/**
 * BreadcrumbList Schema 생성
 */
export function generateBreadcrumbSchema(
  items: Array<{ name: string; url: string }>
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url
    }))
  };
}

/**
 * ItemList Schema 생성 (TOP/BEST/순위형 포스트)
 */
export function generateItemListSchema(
  name: string,
  description: string,
  items: Array<{ name: string; position: number; url?: string; image?: string }>
): Record<string, unknown> {
  if (items.length === 0) return {};

  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    description,
    numberOfItems: items.length,
    itemListElement: items.map(item => {
      const element: Record<string, unknown> = {
        '@type': 'ListItem',
        position: item.position,
        name: item.name
      };
      if (item.url) element.url = item.url;
      if (item.image) element.image = item.image;
      return element;
    })
  };
}

/**
 * HowTo Schema 생성 (코스/체험형 포스트)
 */
export function generateHowToSchema(
  name: string,
  description: string,
  steps: Array<{ name: string; text: string; position: number }>
): Record<string, unknown> {
  if (steps.length === 0) return {};

  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name,
    description,
    step: steps.map(step => ({
      '@type': 'HowToStep',
      position: step.position,
      name: step.name,
      text: step.text
    }))
  };
}

/**
 * H2 제목에서 리스트 항목 추출 (LLM 호출 0)
 */
export function extractListItems(
  body: string
): Array<{ name: string; position: number }> {
  const h2Pattern = /^##\s+(.+)$/gm;
  const items: Array<{ name: string; position: number }> = [];
  let match;
  let position = 1;

  while ((match = h2Pattern.exec(body)) !== null) {
    const title = match[1].trim();
    // 순위 패턴 감지: "1. 장소명", "① 장소명", "TOP 1: 장소명", "#1 장소명"
    const rankMatch = title.match(/^(?:\d+[\.\)]\s*|[①②③④⑤⑥⑦⑧⑨⑩]\s*|(?:TOP|#)\s*\d+[:\s]*)/i);
    if (rankMatch) {
      const name = title.replace(rankMatch[0], '').trim();
      if (name) {
        items.push({ name, position });
        position++;
      }
    }
  }

  return items;
}

/**
 * H2 제목에서 HowTo 스텝 추출 (LLM 호출 0)
 */
export function extractHowToSteps(
  body: string
): Array<{ name: string; text: string; position: number }> {
  const h2Pattern = /^##\s+(.+)$/gm;
  const steps: Array<{ name: string; text: string; position: number }> = [];
  const matches: Array<{ title: string; index: number }> = [];
  let match;

  while ((match = h2Pattern.exec(body)) !== null) {
    matches.push({ title: match[1].trim(), index: match.index + match[0].length });
  }

  let position = 1;
  for (let i = 0; i < matches.length; i++) {
    const title = matches[i].title;
    // 결론/마무리/FAQ 섹션은 제외
    if (/마무리|정리|결론|마치며|자주\s*묻는/.test(title)) continue;
    // 도입부성 섹션도 제외
    if (/소개|개요|인트로/.test(title)) continue;

    // 해당 섹션의 첫 문장을 text로 사용
    const nextIndex = i < matches.length - 1 ? body.indexOf(`## ${matches[i + 1].title}`) : body.length;
    const sectionContent = body.substring(matches[i].index, nextIndex).trim();
    const firstSentence = sectionContent
      .replace(/^[\s\n]+/, '')
      .split(/[.!?。]\s/)[0]?.trim() || '';

    if (firstSentence && firstSentence.length > 10) {
      steps.push({
        name: title,
        text: firstSentence.length > 200 ? firstSentence.substring(0, 200) + '...' : firstSentence + '.',
        position
      });
      position++;
    }
  }

  return steps;
}

/**
 * 통합 Schema 생성 (여러 타입 합침)
 */
export function generateCombinedSchema(
  schemas: Array<Record<string, unknown>>
): Array<Record<string, unknown>> {
  return schemas.filter(s => Object.keys(s).length > 0);
}

/**
 * Schema를 JSON-LD 스크립트 태그로 변환
 */
export function schemaToJsonLd(schema: Record<string, unknown> | Array<Record<string, unknown>>): string {
  const content = Array.isArray(schema) ? schema : [schema];
  const filtered = content.filter(s => Object.keys(s).length > 0);

  if (filtered.length === 0) return '';

  const json = filtered.length === 1
    ? JSON.stringify(filtered[0], null, 2)
    : JSON.stringify(filtered, null, 2);

  return `<script type="application/ld+json">\n${json}\n</script>`;
}

/**
 * 주소에서 도시 추출
 */
function extractCity(address: string): string {
  // 한국 주소 패턴에서 시/구 추출
  const match = address.match(/([가-힣]+(?:시|구))/);
  return match ? match[1] : '';
}

/**
 * 운영시간 문자열 파싱
 */
function parseOpeningHours(hoursString: string): Array<Record<string, unknown>> {
  // 간단한 파싱 (예: "10:00-18:00")
  const match = hoursString.match(/(\d{1,2}):(\d{2})\s*[-~]\s*(\d{1,2}):(\d{2})/);

  if (match) {
    return [{
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: [
        'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
      ],
      opens: `${match[1].padStart(2, '0')}:${match[2]}`,
      closes: `${match[3].padStart(2, '0')}:${match[4]}`
    }];
  }

  return [];
}

/**
 * 가격 문자열에서 숫자 추출
 */
function parsePrice(priceString: string): number {
  const match = priceString.replace(/,/g, '').match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}
