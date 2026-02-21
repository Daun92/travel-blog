/**
 * Hugo 프론트매터 생성 및 처리
 */

import { existsSync } from 'fs';
import { join } from 'path';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import slugify from 'slugify';

export interface FrontmatterData {
  title: string;
  slug?: string;
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
  framingType?: string;
  dataSources?: string[];
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
  if (data.slug) {
    lines.push(`slug: "${escapeYaml(data.slug)}"`);
  }
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

  // 프레이밍 유형
  if (data.framingType) {
    lines.push(`framingType: "${escapeYaml(data.framingType)}"`);
  }

  // 데이터 출처
  if (data.dataSources && data.dataSources.length > 0) {
    lines.push(`dataSources: [${data.dataSources.map(s => `"${escapeYaml(s)}"`).join(', ')}]`);
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
 * 텍스트에서 slugify 가능한 부분을 추출
 * 한글은 slugify가 제거하므로, ASCII 문자만 남는 점을 고려하여 충분한 길이를 확보
 */
function slugifyText(text: string): string {
  const cleaned = text
    .replace(/[^\w\s가-힣]/g, '')
    .trim()
    .slice(0, 80);

  return slugify(cleaned, {
    lower: true,
    strict: true,
    locale: 'ko'
  });
}

/**
 * 이미 유효한 slug 형식인지 확인 (소문자 영문 + 숫자 + 하이픈만 포함)
 * LLM이 생성한 pre-formatted slug를 slugifyText()로 망가뜨리지 않기 위해 사용
 */
function isPreformattedSlug(text: string): boolean {
  return /^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(text) && text.length >= 3;
}

/**
 * 파일명용 슬러그 생성
 * @param title 포스트 제목 (LLM 생성) 또는 LLM이 직접 만든 pre-formatted slug
 * @param outputDir 출력 디렉토리 경로 — 제공 시 기존 파일과 충돌 검사하여 카운터 부여
 * @param topic 원본 주제 (CLI -t 인자) — title에서 유효 slug 추출 실패 시 폴백
 */
export function generateSlug(title: string, outputDir?: string, topic?: string): string {
  const date = format(new Date(), 'yyyy-MM-dd');
  const MIN_SLUG_LENGTH = 3;

  // 0차: 이미 유효한 slug 형식이면 그대로 사용 (LLM SEO slug)
  // 1차: LLM 생성 제목에서 slug 추출
  let slug = isPreformattedSlug(title) ? title : slugifyText(title);

  // 2차: 너무 짧으면 원본 topic으로 폴백
  if (slug.length < MIN_SLUG_LENGTH && topic) {
    slug = slugifyText(topic);
  }

  // 3차: topic도 실패하면 타임스탬프 기반 유니크 slug
  if (slug.length < MIN_SLUG_LENGTH) {
    slug = `post-${Date.now()}`;
  }

  const baseSlug = `${date}-${slug}`;

  // outputDir이 제공되면 기존 파일과 충돌 검사
  if (outputDir) {
    let candidate = baseSlug;
    let counter = 1;
    while (existsSync(join(outputDir, `${candidate}.md`))) {
      candidate = `${baseSlug}-${counter}`;
      counter++;
    }
    return candidate;
  }

  return baseSlug;
}

/**
 * 전체 slug에서 날짜 접두사를 제거하여 Hugo frontmatter용 slug 반환
 * "2026-02-19-gyeongju-bulguksa" → "gyeongju-bulguksa"
 */
export function extractSlugWithoutDate(fullSlug: string): string {
  return fullSlug.replace(/^\d{4}-\d{2}-\d{2}-/, '');
}

/**
 * SEO 메타데이터 파싱
 */
export function parseSeoMeta(content: string): {
  title?: string;
  description?: string;
  keywords?: string[];
  slug?: string;
  content: string;
} {
  const seoMatch = content.match(/<!--SEO\s*([\s\S]*?)-->/);

  if (!seoMatch) {
    return { content };
  }

  try {
    const seoJson = JSON.parse(seoMatch[1].trim());
    const cleanContent = content.replace(/<!--SEO[\s\S]*?-->/, '').trim();

    // LLM이 생성한 slug를 정규화 (소문자, 하이픈만 허용)
    const rawSlug = seoJson.slug as string | undefined;
    const normalizedSlug = rawSlug
      ? rawSlug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
      : undefined;

    return {
      title: seoJson.title,
      description: seoJson.description,
      keywords: seoJson.keywords,
      slug: normalizedSlug && normalizedSlug.length >= 3 ? normalizedSlug : undefined,
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
