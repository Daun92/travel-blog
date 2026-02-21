#!/usr/bin/env tsx
/**
 * 기존 포스트에 크로스 링크 + 상세정보 링크 일괄 적용
 *
 * Usage:
 *   npx tsx scripts/batch-crosslinks.mts                  # 전체 적용
 *   npx tsx scripts/batch-crosslinks.mts --dry-run        # 미리보기 (수정 없음)
 *   npx tsx scripts/batch-crosslinks.mts --hamkke-only    # "함께 읽기"만
 *   npx tsx scripts/batch-crosslinks.mts --inline-only    # 인라인 링크만
 *   npx tsx scripts/batch-crosslinks.mts --info-only      # "참고 정보"만
 *   npx tsx scripts/batch-crosslinks.mts --fix-urls       # URL 수정만
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import { buildPostIndex, savePostIndex } from '../src/crosslinks/build-index.js';
import { findRelatedPosts } from '../src/crosslinks/matcher.js';
import { generateHamkkeSection, appendHamkkeSection } from '../src/crosslinks/hamkke-section.js';
import { detectInlineLinkCandidates } from '../src/crosslinks/inline-detector.js';
import { generateInlineLinkSentences, insertInlineLinks } from '../src/crosslinks/inline-inserter.js';
import { fixBrokenInternalLinks } from '../src/crosslinks/url-fixer.js';
import { generateInfoLinks, generateInfoSection, appendInfoSection } from '../src/crosslinks/info-links.js';
import type { PostIndex, PostIndexEntry } from '../src/crosslinks/types.js';
import matter from 'gray-matter';

const BLOG_POSTS_DIR = join(process.cwd(), 'blog', 'content', 'posts');

// ─── CLI 인자 파싱 ────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const HAMKKE_ONLY = args.includes('--hamkke-only');
const INLINE_ONLY = args.includes('--inline-only');
const INFO_ONLY = args.includes('--info-only');
const FIX_URLS_ONLY = args.includes('--fix-urls');

const EXCLUSIVE_MODE = HAMKKE_ONLY || INLINE_ONLY || INFO_ONLY || FIX_URLS_ONLY;
const DO_HAMKKE = !EXCLUSIVE_MODE || HAMKKE_ONLY;
const DO_INLINE = !EXCLUSIVE_MODE || INLINE_ONLY;
const DO_INFO = !EXCLUSIVE_MODE || INFO_ONLY;
const DO_FIX_URLS = !EXCLUSIVE_MODE || FIX_URLS_ONLY;

// ─── 포스트 파일 목록 ────────────────────────────────────────────────

interface PostFile {
  filePath: string;
  category: 'travel' | 'culture';
  fileSlug: string;
}

function listPostFiles(): PostFile[] {
  const files: PostFile[] = [];

  for (const category of ['travel', 'culture'] as const) {
    const dir = join(BLOG_POSTS_DIR, category);
    try {
      const entries = readdirSync(dir).filter(f => f.endsWith('.md') && !f.startsWith('_'));
      for (const f of entries) {
        files.push({
          filePath: join(dir, f),
          category,
          fileSlug: basename(f, '.md'),
        });
      }
    } catch {
      // 디렉토리 없으면 스킵
    }
  }

  return files;
}

/** 포스트 파일에서 frontmatter 데이터 추출 */
function getFrontmatterData(filePath: string): { personaId: string; dataSources?: string[] } {
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const { data } = matter(raw);
    return {
      personaId: data.personaId || 'friendly',
      dataSources: data.dataSources,
    };
  } catch {
    return { personaId: 'friendly' };
  }
}

/** fileSlug으로 인덱스 엔트리 찾기 */
function findEntry(index: PostIndex, fileSlug: string): PostIndexEntry | undefined {
  return index.entries.find(e => e.fileSlug === fileSlug);
}

// ─── 메인 실행 ────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  크로스 링크 + 상세정보 일괄 적용');
  console.log(`  모드: ${DRY_RUN ? '🔍 DRY RUN (수정 없음)' : '✏️ 실제 적용'}`);
  console.log(`  함께 읽기: ${DO_HAMKKE ? '✅' : '⏭️'}  인라인: ${DO_INLINE ? '✅' : '⏭️'}  참고 정보: ${DO_INFO ? '✅' : '⏭️'}  URL 수정: ${DO_FIX_URLS ? '✅' : '⏭️'}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  // 1. 포스트 인덱스 빌드
  console.log('[1/4] 포스트 인덱스 빌드...');
  const index = buildPostIndex();
  if (!DRY_RUN) {
    savePostIndex(index);
  }
  console.log(`  → ${index.count}개 포스트 인덱싱 완료\n`);

  // 2. 포스트 파일 목록
  const postFiles = listPostFiles();
  console.log(`[2/4] ${postFiles.length}개 포스트 파일 발견\n`);

  // 3. 각 포스트에 크로스링크 + 상세정보 적용
  console.log('[3/4] 크로스 링크 + 상세정보 적용 중...\n');

  let totalUrlFixed = 0;
  let totalHamkkeAdded = 0;
  let totalInlineAdded = 0;
  let totalInfoAdded = 0;
  let totalModified = 0;

  for (const postFile of postFiles) {
    const entry = findEntry(index, postFile.fileSlug);
    if (!entry) {
      console.log(`  ⏭️ ${postFile.fileSlug} — 인덱스에 없음`);
      continue;
    }

    let content = readFileSync(postFile.filePath, 'utf-8');
    const originalContent = content;
    let modified = false;
    const changes: string[] = [];
    const fmData = getFrontmatterData(postFile.filePath);

    // 3-1. URL 수정
    if (DO_FIX_URLS) {
      const urlResult = fixBrokenInternalLinks(content, index);
      if (urlResult.fixed > 0) {
        content = urlResult.content;
        modified = true;
        totalUrlFixed += urlResult.fixed;
        changes.push(`URL 수정 ${urlResult.fixed}건`);
      }
    }

    // 3-2. 관련 포스트 매칭
    const matches = findRelatedPosts(entry, index.entries);

    // 3-3. "참고 정보" 섹션 (함께 읽기보다 먼저 삽입 — 순서: 참고 정보 → 함께 읽기)
    if (DO_INFO) {
      const infoLinks = generateInfoLinks(entry);
      if (infoLinks.length > 0) {
        const infoSection = generateInfoSection(infoLinks, fmData.dataSources);
        content = appendInfoSection(content, infoSection);
        modified = true;
        totalInfoAdded++;
        changes.push(`참고 정보 ${infoLinks.length}건`);
      }
    }

    // 3-4. "함께 읽기" 섹션
    if (DO_HAMKKE && matches.length > 0) {
      const hamkkeSection = generateHamkkeSection(matches, fmData.personaId, 3);
      if (hamkkeSection) {
        content = appendHamkkeSection(content, hamkkeSection);
        modified = true;
        totalHamkkeAdded++;
        changes.push(`함께 읽기 ${matches.slice(0, 3).length}건`);
      }
    }

    // 3-5. 인라인 링크
    if (DO_INLINE && matches.length > 0) {
      const candidates = detectInlineLinkCandidates(entry, content, matches);
      if (candidates.length > 0) {
        const personaId = entry.personaId;
        const insertions = generateInlineLinkSentences(candidates, personaId);
        content = insertInlineLinks(content, insertions);

        const actualInserted = insertions.filter(ins =>
          content.includes(ins.targetPermalink) && !originalContent.includes(ins.targetPermalink)
        ).length;

        if (actualInserted > 0) {
          modified = true;
          totalInlineAdded += actualInserted;
          changes.push(`인라인 ${actualInserted}건`);
        }
      }
    }

    // 3-6. 파일 저장
    if (modified) {
      if (!DRY_RUN) {
        writeFileSync(postFile.filePath, content, 'utf-8');
      }
      totalModified++;
      console.log(`  ✅ ${postFile.fileSlug} — ${changes.join(', ')}`);
    }
  }

  // 4. 결과 보고
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  결과 보고');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  전체 포스트:     ${postFiles.length}개`);
  console.log(`  수정된 포스트:   ${totalModified}개`);
  console.log(`  URL 수정:       ${totalUrlFixed}건`);
  console.log(`  참고 정보 추가: ${totalInfoAdded}개 포스트`);
  console.log(`  함께 읽기 추가: ${totalHamkkeAdded}개 포스트`);
  console.log(`  인라인 링크:    ${totalInlineAdded}건`);

  if (DRY_RUN) {
    console.log('\n  💡 DRY RUN 모드 — 실제 파일은 수정되지 않았습니다.');
    console.log('  실제 적용하려면: npx tsx scripts/batch-crosslinks.mts');
  }

  console.log('═══════════════════════════════════════════════════════════\n');
}

main().catch(err => {
  console.error('크로스 링크 적용 실패:', err);
  process.exit(1);
});
