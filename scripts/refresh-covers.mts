/**
 * 커버 이미지 리프레시 배치 스크립트
 * 에이전트별 시각 아이덴티티 적용 + Gemini 포토리얼리스틱 커버 + 관인 오버레이
 *
 * --overlay-only: 기존 이미지에 새 오버레이만 적용 (Gemini API 호출 0)
 */

import { config } from 'dotenv';
config();

import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import matter from 'gray-matter';
import { GeminiImageClient, saveImage } from '../src/images/gemini-imagen.js';
import { getCoverPhotoPrompt, getVisualIdentity, inferAgentId, getCoverCaption } from '../src/images/cover-styles.js';
import { analyzeReference } from '../src/images/reference-analyzer.js';
import { applyOverlayToBase64, applyOverlay } from '../src/images/cover-overlay.js';
import { registerImage } from '../src/images/unsplash.js';

const POSTS_DIR = 'blog/content/posts';
const OUTPUT_DIR = 'blog/static/images';
const BASE_URL = process.env.HUGO_BASE_URL || '/travel-blog';
const DELAY_MS = 5000;

// ─── 샘플 포스트 목록 ─────────────────────────────────────────

const SAMPLE_POSTS = [
  'travel/2026-02-09-top-5.md',
  'culture/2026-02-07-vs.md',
  'culture/2026-02-07-post.md',
  'travel/2026-02-07-2-3.md',
  'travel/2026-02-05-yeosu-night.md',
  'travel/2026-02-07-tongyeong.md',
  'culture/2026-02-09-post.md',
  'travel/2026-02-05-jeonju-hanok.md',
];

// ─── CLI 인자 파싱 ─────────────────────────────────────────────

interface CliArgs {
  sample: boolean;
  all: boolean;
  posts: string[];
  dryRun: boolean;
  skipOverlay: boolean;
  overlayOnly: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const result: CliArgs = {
    sample: args.includes('--sample'),
    all: args.includes('--all'),
    posts: [],
    dryRun: args.includes('--dry-run'),
    skipOverlay: args.includes('--skip-overlay'),
    overlayOnly: args.includes('--overlay-only'),
  };

  const postsIdx = args.indexOf('--posts');
  if (postsIdx !== -1) {
    for (let i = postsIdx + 1; i < args.length; i++) {
      if (args[i].startsWith('--')) break;
      result.posts.push(args[i]);
    }
  }

  return result;
}

// ─── 포스트 목록 수집 ──────────────────────────────────────────

async function collectPosts(cliArgs: CliArgs): Promise<string[]> {
  if (cliArgs.posts.length > 0) return cliArgs.posts;
  if (cliArgs.sample) return SAMPLE_POSTS;

  if (cliArgs.all) {
    const { glob } = await import('glob');
    const files = await glob('**/*.md', { cwd: POSTS_DIR, ignore: '_index.md' });
    return files.filter(f => !f.startsWith('_'));
  }

  // 기본: 샘플
  return SAMPLE_POSTS;
}

// ─── Frontmatter 읽기/쓰기 ────────────────────────────────────

interface PostMeta {
  filePath: string;
  relativePath: string;
  title: string;
  agentId: string;
  type: 'travel' | 'culture';
  tags: string[];
  currentCoverImage?: string;
  /** 포스트 본문에서 추출한 ## 헤딩 목록 (커버 프롬프트 피사체 힌트) */
  contentHints: string[];
}

function readPostMeta(filePath: string, relPath: string, content: string): PostMeta {
  const { data } = matter(content);

  const categories = (data.categories as string[]) || [];
  const type: 'travel' | 'culture' = categories.includes('culture') ? 'culture' : 'travel';

  let agentId = data.personaId as string | undefined;
  if (!agentId) {
    const author = (data.author as string) || '';
    if (author.includes('조회영')) agentId = 'viral';
    else if (author.includes('한교양')) agentId = 'informative';
    else if (author.includes('김주말')) agentId = 'friendly';
  }
  if (!agentId) {
    agentId = inferAgentId(data.title as string, data.tags as string[]);
  }

  const currentCover = data.cover?.image as string | undefined;

  // 본문에서 ## 헤딩 추출 (커버 이미지 피사체 힌트)
  const { content: body } = matter(content);
  const headings = body
    .split('\n')
    .filter(line => /^## /.test(line))
    .map(line => line.replace(/^## /, '').replace(/[*_`#]/g, '').trim())
    .filter(h => h.length > 0 && !h.startsWith('자주 묻는'));

  return {
    filePath,
    relativePath: relPath,
    title: data.title as string || 'Untitled',
    agentId,
    type,
    tags: (data.tags as string[]) || [],
    currentCoverImage: currentCover,
    contentHints: headings,
  };
}

function updateFrontmatterCover(
  content: string,
  newImagePath: string,
  caption: string,
): string {
  const { data, content: body } = matter(content);

  if (!data.cover) data.cover = {};
  data.cover.image = newImagePath;
  data.cover.alt = data.title;
  data.cover.caption = caption;
  if (data.cover.relative === undefined) data.cover.relative = false;
  if (data.cover.hidden === undefined) data.cover.hidden = false;

  return matter.stringify(body, data);
}

// ─── 슬러그 생성 ─────────────────────────────────────────────

function getSlug(relativePath: string): string {
  const filename = relativePath.replace(/\\/g, '/').split('/').pop() || '';
  return filename.replace(/\.md$/, '');
}

// ─── overlay-only 처리 ───────────────────────────────────────

async function processOverlayOnly(meta: PostMeta, dryRun: boolean): Promise<boolean> {
  const slug = getSlug(meta.relativePath);
  const identity = getVisualIdentity(meta.agentId);
  const filename = `cover-refresh-${slug}.jpg`;
  const imagePath = join(OUTPUT_DIR, filename);

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`📄 ${meta.title}`);
  console.log(`   에이전트: ${identity.displayName} (${meta.agentId})`);

  if (!existsSync(imagePath)) {
    console.log(`   ⚠️ 원본 없음 → 스킵: ${filename}`);
    return false;
  }

  if (dryRun) {
    console.log(`   [DRY-RUN] 관인 오버레이 적용 예정: ${filename}`);
    return true;
  }

  try {
    // 기존 이미지에 관인 오버레이 적용 (같은 경로에 덮어쓰기)
    await applyOverlay(imagePath, imagePath, meta.title, identity);

    // frontmatter 업데이트
    const postPath = join(POSTS_DIR, meta.relativePath);
    const content = await readFile(postPath, 'utf-8');
    const relativePath = `${BASE_URL}/images/${filename}`;
    const caption = getCoverCaption(meta.agentId, meta.title);
    const updated = updateFrontmatterCover(content, relativePath, caption);
    await writeFile(postPath, updated, 'utf-8');

    console.log(`   ✅ 관인 적용: ${identity.displayName} (${identity.sealChars})`);
    console.log(`   📝 캡션: ${caption}`);
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`   ❌ 실패: ${msg}`);
    return false;
  }
}

// ─── 풀 리프레시 처리 ────────────────────────────────────────

async function processPost(
  meta: PostMeta,
  client: GeminiImageClient,
  dryRun: boolean,
  skipOverlay: boolean,
): Promise<boolean> {
  const slug = getSlug(meta.relativePath);
  const identity = getVisualIdentity(meta.agentId);

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`📄 ${meta.title}`);
  console.log(`   파일: ${meta.relativePath}`);
  console.log(`   에이전트: ${identity.displayName} (${meta.agentId}) | 타입: ${meta.type}`);
  console.log(`   현재 커버: ${meta.currentCoverImage || '없음'}`);

  if (dryRun) {
    console.log(`   [DRY-RUN] 커버 생성 예정 → cover-refresh-${slug}.jpg`);
    return true;
  }

  try {
    // Step 1: 레퍼런스 분석
    console.log(`   1/4 레퍼런스 분석...`);
    const { analysis } = await analyzeReference(meta.title, meta.type, meta.agentId);

    // Step 2: 커버 프롬프트 생성
    console.log(`   2/4 커버 이미지 생성...`);
    if (meta.contentHints.length > 0) {
      console.log(`   📑 본문 힌트: ${meta.contentHints.slice(0, 5).join(' | ')}`);
    }
    const coverPrompt = getCoverPhotoPrompt(meta.title, meta.type, meta.agentId, analysis, meta.contentHints);
    const image = await client.generateImage({
      prompt: coverPrompt,
      style: 'cover_photo',
      aspectRatio: '16:9',
      topic: meta.title,
    });

    // Step 3: 저장
    const filename = `cover-refresh-${slug}.jpg`;
    const outputPath = join(OUTPUT_DIR, filename);
    const relativePath = `${BASE_URL}/images/${filename}`;

    if (skipOverlay) {
      const saved = await saveImage(image, OUTPUT_DIR, `cover-refresh-${slug}`);
      console.log(`   3/4 저장 (오버레이 없음): ${saved.relativePath}`);
    } else {
      console.log(`   3/4 관인 오버레이 적용...`);
      await applyOverlayToBase64(image.base64Data, outputPath, meta.title, identity);
      console.log(`   ✓ 저장: ${relativePath}`);
    }

    // Step 4: frontmatter 업데이트
    console.log(`   4/4 frontmatter 업데이트...`);
    const postPath = join(POSTS_DIR, meta.relativePath);
    const content = await readFile(postPath, 'utf-8');
    const caption = getCoverCaption(meta.agentId, meta.title);
    const updated = updateFrontmatterCover(content, relativePath, caption);
    await writeFile(postPath, updated, 'utf-8');

    console.log(`   ✅ 완료: ${identity.displayName} 관인 스타일 커버`);
    console.log(`   📝 캡션: ${caption}`);
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`   ❌ 실패: ${msg}`);
    return false;
  }
}

// ─── 메인 ────────────────────────────────────────────────────

async function main() {
  const cliArgs = parseArgs();
  const isOverlayOnly = cliArgs.overlayOnly;

  console.log('═══════════════════════════════════════════════════');
  console.log(isOverlayOnly
    ? '  관인 오버레이 적용 (이미지 재생성 없음)'
    : '  커버 이미지 리프레시 스크립트');
  console.log('═══════════════════════════════════════════════════');

  // overlay-only는 Gemini 불필요
  let client: GeminiImageClient | null = null;
  if (!isOverlayOnly) {
    client = new GeminiImageClient();
    console.log(`Gemini API: ${client.isConfigured() ? '✓ 설정됨' : '✗ 키 없음'}`);
    console.log(`이미지 생성: ${client.isEnabled() ? '✓ 활성화' : '✗ 비활성화'}`);

    if (!client.isConfigured() || !client.isEnabled()) {
      console.error('GEMINI_API_KEY와 GEMINI_IMAGE_ENABLED=true 설정이 필요합니다.');
      process.exit(1);
    }
  }

  // 포스트 수집
  const postFiles = await collectPosts(cliArgs);
  console.log(`\n대상 포스트: ${postFiles.length}개`);
  if (cliArgs.dryRun) console.log('모드: DRY-RUN (변경 없음)');
  if (isOverlayOnly) console.log('모드: OVERLAY-ONLY (관인만 적용, API 호출 0)');
  if (cliArgs.skipOverlay) console.log('모드: 오버레이 스킵 (이미지만)');

  // 쿼터 확인 (overlay-only에서는 스킵)
  if (client && !isOverlayOnly) {
    const usageCheck = await client.checkUsageLimit(postFiles.length);
    console.log(`일일 사용량: ${usageCheck.current}/${usageCheck.limit}`);
    if (!usageCheck.allowed) {
      console.error(`일일 한도 초과: ${usageCheck.warning}`);
      process.exit(1);
    }
    if (usageCheck.warning) {
      console.warn(`⚠️ ${usageCheck.warning}`);
    }
  }

  // 포스트 처리
  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (const file of postFiles) {
    const postPath = join(POSTS_DIR, file);

    if (!existsSync(postPath)) {
      console.log(`\n⚠️ 파일 없음: ${file}`);
      skipped++;
      continue;
    }

    const content = await readFile(postPath, 'utf-8');
    const meta = readPostMeta(postPath, file, content);

    let ok: boolean;
    if (isOverlayOnly) {
      ok = await processOverlayOnly(meta, cliArgs.dryRun);
      if (!ok && !cliArgs.dryRun) {
        skipped++;
        continue;
      }
    } else {
      ok = await processPost(meta, client!, cliArgs.dryRun, cliArgs.skipOverlay);
    }

    if (ok) success++;
    else failed++;

    // 딜레이 (overlay-only는 API 없으므로 딜레이 불필요)
    if (!cliArgs.dryRun && !isOverlayOnly && file !== postFiles[postFiles.length - 1]) {
      console.log(`   ⏳ ${DELAY_MS / 1000}초 대기...`);
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }
  }

  // 결과 요약
  console.log(`\n${'═'.repeat(50)}`);
  console.log('  결과 요약');
  console.log(`${'═'.repeat(50)}`);
  console.log(`  ✅ 성공: ${success}개`);
  console.log(`  ❌ 실패: ${failed}개`);
  console.log(`  ⚠️ 스킵: ${skipped}개`);
  if (client && !cliArgs.dryRun && !isOverlayOnly) {
    console.log(`  일일 사용량: ${await client.getDailyUsage()}/${(await client.checkUsageLimit(0)).limit}`);
  }
  console.log(`${'═'.repeat(50)}\n`);

  if (failed > 0) process.exit(1);
}

main().catch(err => {
  console.error('치명적 오류:', err);
  process.exit(1);
});
