/**
 * 2026-02-20 발행 5개 포스트 — 커버 + 개요 + 정리 이미지 배치 생성
 *
 * Gemini Batch API (50% 비용 절감) 으로 15장 일괄 생성:
 *   - 커버 5장: cover_photo + 관인 오버레이
 *   - 개요 5장: infographic (culture) / diagram (travel) — 도입 일러스트
 *   - 정리 5장: moodboard (culture) / bucketlist (travel) — 마감 일러스트
 *
 * Usage:
 *   npx tsx scripts/gen-0220-batch-images.mts              # 배치 생성 (15장)
 *   npx tsx scripts/gen-0220-batch-images.mts --dry-run     # 프롬프트만 미리보기
 *   npx tsx scripts/gen-0220-batch-images.mts --covers-only  # 커버 5장만
 *   npx tsx scripts/gen-0220-batch-images.mts --illust-only  # 개요+정리 10장만
 *   npx tsx scripts/gen-0220-batch-images.mts --slugs danyang,sindorim,west-coast  # 특정 포스트만
 */
import { config } from 'dotenv';
config();

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { GeminiImageClient, type BatchImageRequest, type ImageStyle } from '../src/images/gemini-imagen.js';
import { getCoverPhotoPrompt, getVisualIdentity, getCoverCaption } from '../src/images/cover-styles.js';
import { applyOverlayToBase64 } from '../src/images/cover-overlay.js';
import { getInfographicPrompt, getDiagramPrompt, getMoodboardPrompt, getBucketlistPrompt, type ImageContext } from '../src/generator/image-prompts.js';

// ── CLI 플래그 ───────────────────────────────────────────────────────

const DRY_RUN = process.argv.includes('--dry-run');
const COVERS_ONLY = process.argv.includes('--covers-only');
const ILLUST_ONLY = process.argv.includes('--illust-only');
const SEQUENTIAL = process.argv.includes('--sequential');
const SLUG_FILTER = (() => {
  const idx = process.argv.indexOf('--slugs');
  if (idx < 0 || idx + 1 >= process.argv.length) return null;
  return process.argv[idx + 1].split(',').map(s => s.trim());
})();

const OUTPUT_DIR = 'blog/static/images';
const DATE_PREFIX = '2026-02-20';

// ── 포스트 정의 ──────────────────────────────────────────────────────

interface PostDef {
  slug: string;
  mdPath: string;
  topic: string;
  type: 'travel' | 'culture';
  agentId: string;
  /** 개요 스타일 */
  introStyle: 'infographic' | 'diagram';
  /** 정리 스타일 */
  outroStyle: 'moodboard' | 'bucketlist';
}

const POSTS: PostDef[] = [
  {
    slug: 'march-theatre-performances-top-5-seoul',
    mdPath: 'blog/content/posts/culture/2026-02-20-march-theatre-performances-top-5-seoul.md',
    topic: '3월 연극 TOP 5: 엘시노어부터 노인의 꿈까지, 안 보면 손해 보는 소극장 라인업',
    type: 'culture',
    agentId: 'viral',
    introStyle: 'infographic',
    outroStyle: 'moodboard',
  },
  {
    slug: 'sindorim-factory-zone-deep-digging',
    mdPath: 'blog/content/posts/culture/2026-02-20-sindorim-factory-zone-deep-digging.md',
    topic: '신도림 디큐브 너머, 12번 방문 끝에 찾아낸 시간의 공장지대 디깅 리포트',
    type: 'culture',
    agentId: 'niche',
    introStyle: 'infographic',
    outroStyle: 'moodboard',
  },
  {
    slug: 'danyang-day-trip-course-and-cost',
    mdPath: 'blog/content/posts/travel/2026-02-20-danyang-day-trip-course-and-cost.md',
    topic: '단양 당일치기 현실 코스: 구인사에서 고수동굴까지, 빛을 따라 걷는 시간과 비용 총정산',
    type: 'travel',
    agentId: 'friendly',
    introStyle: 'diagram',
    outroStyle: 'bucketlist',
  },
  {
    slug: 'seoul-five-palaces-spring-tour-guide',
    mdPath: 'blog/content/posts/travel/2026-02-20-seoul-five-palaces-spring-tour-guide.md',
    topic: '서울 5대 궁궐 봄 투어: 경복궁 별빛야행부터 창덕궁 후원까지, 건축으로 읽는 조선 500년',
    type: 'travel',
    agentId: 'informative',
    introStyle: 'diagram',
    outroStyle: 'bucketlist',
  },
  {
    slug: 'west-coast-trail-digging-taean-boryeong',
    mdPath: 'blog/content/posts/travel/2026-02-20-west-coast-trail-digging-taean-boryeong.md',
    topic: '12번 가서 알아낸 서해안 둘레길 디깅: 태안에서 무창포까지 파도소리의 층위',
    type: 'travel',
    agentId: 'niche',
    introStyle: 'diagram',
    outroStyle: 'bucketlist',
  },
];

// ── ## 헤딩 추출 ─────────────────────────────────────────────────────

function extractHeadings(mdContent: string): string[] {
  const lines = mdContent.split('\n');
  const headings: string[] = [];
  let inFrontmatter = false;
  for (const line of lines) {
    if (line.trim() === '---') {
      inFrontmatter = !inFrontmatter;
      continue;
    }
    if (inFrontmatter) continue;
    const match = line.match(/^## (.+)/);
    if (match) {
      const heading = match[1].trim();
      if (heading !== '자주 묻는 질문') headings.push(heading);
    }
  }
  return headings;
}

// ── 배치 요청 구성 ───────────────────────────────────────────────────

interface RequestMeta {
  postIndex: number;
  role: 'cover' | 'intro' | 'outro';
  filename: string;
  style: ImageStyle;
}

async function buildBatchRequests(): Promise<{ requests: BatchImageRequest[]; metas: RequestMeta[] }> {
  const requests: BatchImageRequest[] = [];
  const metas: RequestMeta[] = [];

  for (let i = 0; i < POSTS.length; i++) {
    const post = POSTS[i];
    // --slugs 필터: slug 부분 매칭 (e.g. "danyang" matches "danyang-day-trip-...")
    if (SLUG_FILTER && !SLUG_FILTER.some(f => post.slug.includes(f))) continue;
    const mdContent = await readFile(post.mdPath, 'utf-8');
    const headings = extractHeadings(mdContent);
    const context: ImageContext = {
      topic: post.topic,
      type: post.type,
      section: headings.join(', '),
      locations: headings.slice(0, 5),
      personaId: post.agentId,
    };

    // 1) 커버 (cover_photo)
    if (!ILLUST_ONLY) {
      const coverPrompt = getCoverPhotoPrompt(
        post.topic,
        post.type,
        post.agentId,
        undefined,
        headings,
      );
      requests.push({
        prompt: coverPrompt,
        style: 'cover_photo',
        aspectRatio: '16:9',
        topic: post.topic,
        personaId: post.agentId,
      });
      metas.push({
        postIndex: i,
        role: 'cover',
        filename: `cover-${DATE_PREFIX}-${post.slug}.jpg`,
        style: 'cover_photo',
      });
    }

    // 2) 개요 일러스트
    if (!COVERS_ONLY) {
      const introPrompt = post.introStyle === 'infographic'
        ? getInfographicPrompt(context)
        : getDiagramPrompt(context);
      requests.push({
        prompt: introPrompt,
        style: post.introStyle,
        aspectRatio: '16:9',
        topic: post.topic,
        personaId: post.agentId,
      });
      metas.push({
        postIndex: i,
        role: 'intro',
        filename: `intro-${DATE_PREFIX}-${post.slug}.jpeg`,
        style: post.introStyle,
      });
    }

    // 3) 정리 일러스트
    if (!COVERS_ONLY) {
      const outroPrompt = post.outroStyle === 'moodboard'
        ? getMoodboardPrompt(context)
        : getBucketlistPrompt(context);
      requests.push({
        prompt: outroPrompt,
        style: post.outroStyle,
        aspectRatio: '16:9',
        topic: post.topic,
        personaId: post.agentId,
      });
      metas.push({
        postIndex: i,
        role: 'outro',
        filename: `summary-${DATE_PREFIX}-${post.slug}.jpeg`,
        style: post.outroStyle,
      });
    }
  }

  return { requests, metas };
}

// ── 마크다운 업데이트 ────────────────────────────────────────────────
// 전략:
//   1. cover: 라인 단위 파싱 → >- 멀티라인/단일라인 모두 처리 → 단일라인 통일
//   2. intro: 첫 ## 직전의 inline-* 이미지 교체, 없으면 첫 ## 직전 삽입
//   3. outro: ## FAQ 직전의 inline-* 이미지 교체, 없으면 ## FAQ 직전 삽입
//   ※ kto-*, kopis-* 이미지는 절대 건드리지 않음

interface UpdateResult {
  slug: string;
  coverPath?: string;
  introPath?: string;
  outroPath?: string;
}

/**
 * frontmatter cover.image 교체 — >- 멀티라인과 단일라인 모두 처리
 * 교체 후 항상 단일라인 형식으로 통일
 */
function replaceCoverImage(lines: string[], newPath: string): void {
  for (let i = 0; i < lines.length; i++) {
    // "  image:" 로 시작하는 줄 탐색 (frontmatter 내)
    if (!lines[i].match(/^\s{2}image:/)) continue;

    if (lines[i].includes('>-') || lines[i].includes('|-')) {
      // 멀티라인: 현재 줄 + 다음 줄(들어쓰기 된 경로)을 단일라인으로 병합
      lines[i] = `  image: ${newPath}`;
      // 다음 줄이 4칸+ 들여쓰기면 경로 줄 → 삭제
      if (i + 1 < lines.length && lines[i + 1].match(/^\s{4,}/)) {
        lines.splice(i + 1, 1);
      }
    } else {
      // 단일라인: 직접 교체
      lines[i] = `  image: ${newPath}`;
    }
    break;
  }
}

function replaceCoverAlt(lines: string[], newAlt: string): void {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/^\s{2}alt:/)) {
      lines[i] = `  alt: ${newAlt}`;
      break;
    }
  }
}

function replaceCoverCaption(lines: string[], newCaption: string): void {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/^\s{2}caption:/)) {
      lines[i] = `  caption: '${newCaption}'`;
      break;
    }
  }
}

/**
 * 본문에서 inline-* 이미지 블록(이미지 줄 + 바로 아래 캡션 줄)을 찾아 교체 또는 삽입
 *
 * @param bodyLines 본문 라인 배열 (frontmatter 제외)
 * @param zone 'intro' | 'outro' — 검색 영역
 * @param newImgLine 새 이미지 마크다운 줄 (![alt](path))
 * @param newCaptionLine 새 캡션 줄 (*캡션*)
 */
function replaceOrInsertInlineImage(
  bodyLines: string[],
  zone: 'intro' | 'outro',
  newImgLine: string,
  newCaptionLine: string,
): void {
  // 핵심 앵커 찾기
  const firstH2 = bodyLines.findIndex(l => l.startsWith('## '));
  const faqIdx = bodyLines.findIndex(l => l.startsWith('## 자주 묻는 질문'));

  if (zone === 'intro') {
    // 첫 ## 이전의 inline-* 이미지 찾기 (역순 탐색 — 가장 가까운 것)
    const searchEnd = firstH2 > 0 ? firstH2 : bodyLines.length;
    let targetIdx = -1;
    for (let i = searchEnd - 1; i >= 0; i--) {
      if (bodyLines[i].match(/^!\[.*\]\(.*inline-.*\)/)) {
        targetIdx = i;
        break;
      }
    }

    if (targetIdx >= 0) {
      // 교체: 이미지 줄 + 바로 아래 캡션(*...*)이 있으면 함께 교체
      const hasCaption = targetIdx + 1 < bodyLines.length &&
        bodyLines[targetIdx + 1].startsWith('*') &&
        bodyLines[targetIdx + 1].endsWith('*');
      const deleteCount = hasCaption ? 2 : 1;
      bodyLines.splice(targetIdx, deleteCount, newImgLine, newCaptionLine);
    } else if (firstH2 > 0) {
      // 삽입: 첫 ## 직전에 빈 줄 + 이미지 + 캡션 + 빈 줄
      bodyLines.splice(firstH2, 0, '', newImgLine, newCaptionLine, '');
    }
  } else {
    // outro: ## FAQ 직전의 inline-* 이미지 찾기
    const searchStart = faqIdx > 0 ? Math.max(0, faqIdx - 30) : Math.max(0, bodyLines.length - 30);
    const searchEnd = faqIdx > 0 ? faqIdx : bodyLines.length;
    let targetIdx = -1;
    for (let i = searchEnd - 1; i >= searchStart; i--) {
      if (bodyLines[i].match(/^!\[.*\]\(.*inline-.*\)/)) {
        targetIdx = i;
        break;
      }
    }

    if (targetIdx >= 0) {
      const hasCaption = targetIdx + 1 < bodyLines.length &&
        bodyLines[targetIdx + 1].startsWith('*') &&
        bodyLines[targetIdx + 1].endsWith('*');
      const deleteCount = hasCaption ? 2 : 1;
      bodyLines.splice(targetIdx, deleteCount, newImgLine, newCaptionLine);
    } else if (faqIdx > 0) {
      // 삽입: ## FAQ 직전
      bodyLines.splice(faqIdx, 0, '', newImgLine, newCaptionLine, '');
    } else {
      // FAQ 없으면 본문 끝에 추가
      bodyLines.push('', newImgLine, newCaptionLine, '');
    }
  }
}

/**
 * 포스트 스타일에 맞는 캡션 생성 (페르소나 톤 반영)
 */
function makeIllustCaption(agentId: string, topic: string, role: 'intro' | 'outro'): string {
  const identity = getVisualIdentity(agentId);
  const shortTopic = topic.length > 20 ? topic.slice(0, topic.indexOf(',')) || topic.slice(0, 20) : topic;
  const roleLabel = role === 'intro' ? '여정 안내' : '마무리';
  return `*일러스트: ${identity.displayName} · ${shortTopic} ${roleLabel}*`;
}

async function updatePostMarkdown(results: UpdateResult[]): Promise<void> {
  for (const result of results) {
    const post = POSTS.find(p => p.slug === result.slug);
    if (!post) continue;

    const md = await readFile(post.mdPath, 'utf-8');
    const lines = md.split('\n');

    // --- frontmatter 범위 결정 ---
    let fmStart = -1;
    let fmEnd = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === '---') {
        if (fmStart < 0) fmStart = i;
        else { fmEnd = i; break; }
      }
    }
    if (fmStart < 0 || fmEnd < 0) continue;

    // --- 1) cover 교체 ---
    if (result.coverPath) {
      const caption = getCoverCaption(post.agentId, post.topic);
      replaceCoverImage(lines, result.coverPath);
      replaceCoverAlt(lines, `AI 생성 커버 — ${post.topic.slice(0, 30)}`);
      replaceCoverCaption(lines, caption);
    }

    // --- 2) 본문 인라인 이미지 ---
    // frontmatter 이후 본문만 추출 (인덱스 유지)
    // fmEnd가 splice로 밀릴 수 있으니, 본문 라인을 별도 배열로
    const fmEndActual = lines.findIndex((l, i) => i > fmStart && l.trim() === '---');
    const bodyLines = lines.slice(fmEndActual + 1);

    if (result.introPath) {
      const introAlt = `${post.type === 'culture' ? '공연·문화 개요' : '여행 코스 안내'}`;
      const introImg = `![${introAlt}](${result.introPath})`;
      const introCaption = makeIllustCaption(post.agentId, post.topic, 'intro');
      replaceOrInsertInlineImage(bodyLines, 'intro', introImg, introCaption);
    }

    if (result.outroPath) {
      const outroAlt = `${post.type === 'culture' ? '공연·문화 무드보드' : '여행 버킷리스트'}`;
      const outroImg = `![${outroAlt}](${result.outroPath})`;
      const outroCaption = makeIllustCaption(post.agentId, post.topic, 'outro');
      replaceOrInsertInlineImage(bodyLines, 'outro', outroImg, outroCaption);
    }

    // --- 재조립 ---
    const finalLines = [
      ...lines.slice(0, fmEndActual + 1),
      ...bodyLines,
    ];

    await writeFile(post.mdPath, finalLines.join('\n'), 'utf-8');
    console.log(`   ✏️ ${post.slug} 마크다운 업데이트 완료`);
  }
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🎬 2026-02-20 배치 이미지 생성 — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`📦 대상: 5개 포스트 × 3종(커버/개요/정리)`);
  if (COVERS_ONLY) console.log('   → 커버만 생성');
  if (ILLUST_ONLY) console.log('   → 일러스트만 생성');

  const { requests, metas } = await buildBatchRequests();
  console.log(`📋 총 ${requests.length}개 이미지 요청 구성 완료\n`);

  // 기존 파일 스킵 필터
  const skipIndices = new Set<number>();
  for (let i = 0; i < metas.length; i++) {
    if (existsSync(join(OUTPUT_DIR, metas[i].filename))) {
      console.log(`⏭️ ${metas[i].filename} — 이미 존재, 스킵`);
      skipIndices.add(i);
    }
  }

  const filteredRequests = requests.filter((_, i) => !skipIndices.has(i));
  const filteredMetas = metas.filter((_, i) => !skipIndices.has(i));

  if (filteredRequests.length === 0) {
    console.log('\n✅ 모든 이미지가 이미 존재합니다. 마크다운 업데이트만 진행합니다.');
  }

  if (DRY_RUN) {
    for (let i = 0; i < requests.length; i++) {
      const m = metas[i];
      const skip = skipIndices.has(i) ? ' [SKIP — exists]' : '';
      console.log(`\n── [${m.role}] ${POSTS[m.postIndex].slug}${skip} ──`);
      console.log(`   File: ${m.filename}`);
      console.log(`   Style: ${m.style}`);
      console.log(`   Prompt: ${requests[i].prompt.substring(0, 200)}...`);
    }
    console.log(`\n📊 실행 시 Gemini Batch API 호출: ${filteredRequests.length}개 (50% 할인)`);
    return;
  }

  // ── API 호출 ──
  const client = new GeminiImageClient();
  if (!client.isConfigured() || !client.isEnabled()) {
    console.error('❌ GEMINI_API_KEY와 GEMINI_IMAGE_ENABLED=true 필요');
    process.exit(1);
  }

  const usage = await client.getDailyUsage();
  console.log(`📊 현재 쿼터: ${usage}/50 (${filteredRequests.length}장 생성 예정 → ${usage + filteredRequests.length}/50)`);

  if (usage + filteredRequests.length > 50) {
    console.error(`❌ 쿼터 초과 예상. 내일 다시 시도하세요.`);
    process.exit(1);
  }

  await mkdir(OUTPUT_DIR, { recursive: true });

  let batchResults: import('../src/images/gemini-imagen.js').BatchImageResultItem[];
  if (filteredRequests.length === 0) {
    batchResults = [];
  } else if (SEQUENTIAL || filteredRequests.length <= 5) {
    // 개별 순차 호출 (소량이거나 --sequential 플래그)
    console.log(`\n🚀 개별 순차 호출 중 (${filteredRequests.length}개)...\n`);
    batchResults = [];
    for (let i = 0; i < filteredRequests.length; i++) {
      const req = filteredRequests[i];
      const meta = filteredMetas[i];
      console.log(`   🎬 [${i + 1}/${filteredRequests.length}] ${meta.filename}...`);
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const image = await client.generateImage({
            prompt: req.prompt,
            style: req.style,
            aspectRatio: req.aspectRatio,
            topic: req.topic,
            personaId: req.personaId,
          });
          batchResults.push({ success: true, image, index: i });
          console.log(`   ✅ 생성 완료`);
          break;
        } catch (err) {
          console.log(`   ⚠️ 시도 ${attempt}/3 실패: ${(err as Error).message.slice(0, 100)}`);
          if (attempt < 3) {
            console.log(`   ⏳ ${5 * attempt}초 후 재시도...`);
            await new Promise(r => setTimeout(r, 5000 * attempt));
          } else {
            batchResults.push({ success: false, error: (err as Error).message, index: i });
          }
        }
      }
      // 요청 간 3초 대기
      if (i < filteredRequests.length - 1) {
        await new Promise(r => setTimeout(r, 3000));
      }
    }
  } else {
    // Batch API (6장+ 대량)
    console.log(`\n🚀 Gemini Batch API 호출 중 (${filteredRequests.length}개)...\n`);
    batchResults = await client.generateImagesBatch(filteredRequests, {
      pollIntervalMs: 8000,
      timeoutMs: 900_000,
      onProgress: (msg) => console.log(`   📡 ${msg}`),
    });
  }

  // ── 결과 저장 ──
  const updateResults: UpdateResult[] = POSTS.map(p => ({ slug: p.slug }));

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < batchResults.length; i++) {
    const result = batchResults[i];
    const meta = filteredMetas[i];
    const post = POSTS[meta.postIndex];

    if (!result.success || !result.image) {
      console.log(`   ❌ [${meta.role}] ${post.slug}: ${result.error}`);
      failCount++;
      continue;
    }

    const outputPath = join(OUTPUT_DIR, meta.filename);
    const hugoPath = `/travel-blog/images/${meta.filename}`;

    if (meta.role === 'cover') {
      // 커버: 관인 오버레이 적용 후 JPEG 저장
      const identity = getVisualIdentity(post.agentId);
      await applyOverlayToBase64(
        result.image.base64Data,
        outputPath,
        post.topic,
        identity,
      );
      updateResults[meta.postIndex].coverPath = hugoPath;
      console.log(`   ✅ [cover] ${meta.filename} — 관인 오버레이 적용`);
    } else {
      // 일러스트: 최적화 저장
      const sharp = (await import('sharp')).default;
      const buffer = Buffer.from(result.image.base64Data, 'base64');
      await sharp(buffer)
        .resize(1200, undefined, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toFile(outputPath);

      if (meta.role === 'intro') {
        updateResults[meta.postIndex].introPath = hugoPath;
      } else {
        updateResults[meta.postIndex].outroPath = hugoPath;
      }
      const sizeKB = Math.round((await readFile(outputPath)).length / 1024);
      console.log(`   ✅ [${meta.role}] ${meta.filename} (${sizeKB}KB)`);
    }
    successCount++;
  }

  // 스킵된 기존 파일도 updateResults에 반영
  for (const idx of skipIndices) {
    const meta = metas[idx];
    const hugoPath = `/travel-blog/images/${meta.filename}`;
    if (meta.role === 'cover') updateResults[meta.postIndex].coverPath = hugoPath;
    if (meta.role === 'intro') updateResults[meta.postIndex].introPath = hugoPath;
    if (meta.role === 'outro') updateResults[meta.postIndex].outroPath = hugoPath;
  }

  // ── 마크다운 업데이트 ──
  console.log('\n✏️ 마크다운 업데이트 중...');
  await updatePostMarkdown(updateResults);

  // ── image-registry.json 엔트리 출력 ──
  console.log('\n📝 image-registry.json 추가 엔트리:\n');
  for (let i = 0; i < metas.length; i++) {
    const meta = metas[i];
    const post = POSTS[meta.postIndex];
    console.log(JSON.stringify({
      source: 'gemini-ai',
      filename: meta.filename,
      postSlug: post.slug,
      personaId: post.agentId,
      role: meta.role,
      style: meta.style,
      usedAt: new Date().toISOString(),
    }));
  }

  // ── Summary ──
  const totalSkipped = skipIndices.size;
  console.log('\n══════════════════════════════════════════════════════════');
  console.log(`  📋 BATCH SUMMARY: ${successCount} 성공, ${failCount} 실패, ${totalSkipped} 스킵(기존)`);
  console.log(`  📊 쿼터: ${usage + successCount}/50`);
  console.log('══════════════════════════════════════════════════════════\n');
}

main().catch(err => {
  console.error('오류:', err);
  process.exit(1);
});
