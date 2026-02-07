/**
 * Hugo 프론트매터 생성 및 처리
 */

import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import slugify from 'slugify';

export interface FrontmatterData {
  title: string;
  date: Date;
  draft: boolean;
  description: string;
  summary?: string;
  tags: string[];
  categories: string[];
  keywords?: string[];
  cover?: {
    image: string;
    alt: string;
    caption?: string;
    relative?: boolean;
    hidden?: boolean;
  };
  author?: string;
  personaId?: string;
  // 여행 전용
  location?: string;
  visitDate?: string;
  budget?: string;
  duration?: string;
  // 문화예술 전용
  venue?: string;
  eventDate?: string;
  ticketPrice?: string;
  openingHours?: string;
}

/**
 * 프론트매터 YAML 생성
 */
export function generateFrontmatter(data: FrontmatterData): string {
  const lines: string[] = ['---'];

  // 필수 필드
  lines.push(`title: "${escapeYaml(data.title)}"`);
  lines.push(`date: ${format(data.date, "yyyy-MM-dd'T'HH:mm:ssXXX")}`);
  lines.push(`draft: ${data.draft}`);
  lines.push(`description: "${escapeYaml(data.description)}"`);

  // 선택 필드
  if (data.summary) {
    lines.push(`summary: "${escapeYaml(data.summary)}"`);
  }

  // 배열 필드
  if (data.tags && data.tags.length > 0) {
    lines.push(`tags: [${data.tags.map(t => `"${escapeYaml(t)}"`).join(', ')}]`);
  }

  if (data.categories && data.categories.length > 0) {
    lines.push(`categories: [${data.categories.map(c => `"${escapeYaml(c)}"`).join(', ')}]`);
  }

  if (data.keywords && data.keywords.length > 0) {
    lines.push(`keywords: [${data.keywords.map(k => `"${escapeYaml(k)}"`).join(', ')}]`);
  }

  // 커버 이미지
  if (data.cover && data.cover.image) {
    lines.push('cover:');
    lines.push(`  image: "${escapeYaml(data.cover.image)}"`);
    lines.push(`  alt: "${escapeYaml(data.cover.alt || data.title)}"`);
    if (data.cover.caption) {
      lines.push(`  caption: "${escapeYaml(data.cover.caption)}"`);
    }
    lines.push(`  relative: ${data.cover.relative ?? false}`);
    lines.push(`  hidden: ${data.cover.hidden ?? false}`);
  }

  // 작성자
  if (data.author) {
    lines.push(`author: "${escapeYaml(data.author)}"`);
  }

  // 페르소나 ID
  if (data.personaId) {
    lines.push(`personaId: "${escapeYaml(data.personaId)}"`);
  }

  // 여행 전용 필드
  if (data.location) lines.push(`location: "${escapeYaml(data.location)}"`);
  if (data.visitDate) lines.push(`visitDate: "${escapeYaml(data.visitDate)}"`);
  if (data.budget) lines.push(`budget: "${escapeYaml(data.budget)}"`);
  if (data.duration) lines.push(`duration: "${escapeYaml(data.duration)}"`);

  // 문화예술 전용 필드
  if (data.venue) lines.push(`venue: "${escapeYaml(data.venue)}"`);
  if (data.eventDate) lines.push(`eventDate: "${escapeYaml(data.eventDate)}"`);
  if (data.ticketPrice) lines.push(`ticketPrice: "${escapeYaml(data.ticketPrice)}"`);
  if (data.openingHours) lines.push(`openingHours: "${escapeYaml(data.openingHours)}"`);

  // PaperMod 테마 설정
  lines.push('showToc: true');
  lines.push('TocOpen: false');
  lines.push('hidemeta: false');
  lines.push('comments: true');
  lines.push('disableShare: false');
  lines.push('ShowReadingTime: true');
  lines.push('ShowBreadCrumbs: true');
  lines.push('ShowPostNavLinks: true');
  lines.push('ShowWordCount: true');

  lines.push('---');

  return lines.join('\n');
}

/**
 * 파일명용 슬러그 생성
 */
export function generateSlug(title: string): string {
  // 한글 제목을 영문으로 변환하지 않고 날짜+간략화된 형태로 사용
  const date = format(new Date(), 'yyyy-MM-dd');
  const cleaned = title
    .replace(/[^\w\s가-힣]/g, '')
    .trim()
    .slice(0, 30);

  const slug = slugify(cleaned, {
    lower: true,
    strict: true,
    locale: 'ko'
  });

  return `${date}-${slug || 'post'}`;
}

/**
 * SEO 메타데이터 파싱
 */
export function parseSeoMeta(content: string): {
  title?: string;
  description?: string;
  keywords?: string[];
  content: string;
} {
  const seoMatch = content.match(/<!--SEO\s*([\s\S]*?)-->/);

  if (!seoMatch) {
    return { content };
  }

  try {
    const seoJson = JSON.parse(seoMatch[1].trim());
    const cleanContent = content.replace(/<!--SEO[\s\S]*?-->/, '').trim();

    return {
      title: seoJson.title,
      description: seoJson.description,
      keywords: seoJson.keywords,
      content: cleanContent
    };
  } catch {
    return { content };
  }
}

/**
 * matter.stringify 후 >- 블록 스칼라 caption을 단일 라인으로 정규화
 * gray-matter/js-yaml은 Markdown 링크 []() 포함 시 >- 형식을 사용하는데,
 * Hugo PaperMod 테마에서 .markdownify 렌더링을 위해 단일 라인 필요
 */
export function normalizeFrontmatterCaption(content: string): string {
  return content.replace(
    /caption: >-\n((?:[ \t]+.+\n)+)/g,
    (_, block: string) => {
      const text = block.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
      return `caption: "${text}"\n`;
    }
  );
}

/**
 * YAML 특수문자 이스케이프
 */
function escapeYaml(str: string): string {
  return str.replace(/"/g, '\\"').replace(/\n/g, ' ');
}

/**
 * 전체 마크다운 파일 생성
 */
export function generateMarkdownFile(
  frontmatter: FrontmatterData,
  content: string
): string {
  return `${generateFrontmatter(frontmatter)}\n\n${content}`;
}
