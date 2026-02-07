/**
 * Claude Code 팩트체크 — Step 1: Claim 추출
 *
 * 마크다운 파일에서 검증 가능한 클레임을 추출하여 JSON으로 출력합니다.
 * Claude Code 세션에서 WebSearch 기반 검증을 위한 입력 데이터를 생성합니다.
 *
 * Usage:
 *   npm run factcheck:extract -- -f <file>
 *   npm run factcheck:extract -- -f <file> --verbose
 */
import { config } from 'dotenv';
config();

import { readFile } from 'fs/promises';
import matter from 'gray-matter';
import { extractClaims, needsFactCheck, getClaimStats } from '../src/factcheck/index.js';

function parseArgs(): { filePath: string; verbose: boolean } {
  const args = process.argv.slice(2);
  let filePath = '';
  let verbose = false;

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '-f' || args[i] === '--file') && args[i + 1]) {
      filePath = args[i + 1];
      i++;
    } else if (args[i] === '--verbose' || args[i] === '-v') {
      verbose = true;
    }
  }

  if (!filePath) {
    console.error('Usage: npm run factcheck:extract -- -f <file>');
    process.exit(1);
  }

  return { filePath, verbose };
}

async function main() {
  const { filePath, verbose } = parseArgs();

  // 파일 읽기
  const content = await readFile(filePath, 'utf-8');
  const { data: frontmatter, content: body } = matter(content);

  const title = (frontmatter.title as string) || 'Untitled';

  // 팩트체크 필요 여부 확인
  if (!needsFactCheck(body, frontmatter)) {
    const result = {
      filePath,
      title,
      needsFactCheck: false,
      claims: [],
      stats: { total: 0, bySeverity: { critical: 0, major: 0, minor: 0 } }
    };
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  // 클레임 추출
  const claims = extractClaims(body, frontmatter);
  const stats = getClaimStats(claims);

  if (verbose) {
    console.error(`📋 ${title}`);
    console.error(`   추출된 클레임: ${claims.length}개`);
    console.error(`   - Critical: ${stats.bySeverity.critical}개`);
    console.error(`   - Major: ${stats.bySeverity.major}개`);
    console.error(`   - Minor: ${stats.bySeverity.minor}개`);
    console.error('');
  }

  // JSON 출력 (stdout)
  const result = {
    filePath,
    title,
    needsFactCheck: true,
    claims,
    stats: {
      total: stats.total,
      bySeverity: stats.bySeverity,
      byType: stats.byType
    }
  };

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error('❌ 클레임 추출 실패:', error instanceof Error ? error.message : error);
  process.exit(1);
});
