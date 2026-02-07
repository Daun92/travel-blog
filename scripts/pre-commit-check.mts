/**
 * Pre-commit 검증 스크립트
 *
 * 실행: npx tsx scripts/pre-commit-check.mts
 *
 * 검증 항목:
 * 1. TypeScript 빌드 확인
 * 2. data/*.json 파싱 확인
 * 3. 중복 filePath 검출
 * 4. URL 이중 슬래시 검출
 * 5. package.json 스크립트 타겟 파일 존재 확인
 */

import { readFile, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';

interface CheckResult {
  name: string;
  passed: boolean;
  errors: string[];
}

const results: CheckResult[] = [];

// 1. TypeScript 빌드
function checkBuild(): CheckResult {
  const result: CheckResult = { name: 'TypeScript Build', passed: true, errors: [] };
  try {
    execSync('npx tsc --noEmit', { stdio: 'pipe' });
  } catch (e: unknown) {
    result.passed = false;
    const err = e as { stdout?: Buffer };
    result.errors.push(err.stdout?.toString() || 'Build failed');
  }
  return result;
}

// 2. JSON 파싱
async function checkJsonFiles(): Promise<CheckResult> {
  const result: CheckResult = { name: 'JSON Parsing', passed: true, errors: [] };
  const dataDir = join(process.cwd(), 'data');

  if (!existsSync(dataDir)) return result;

  const files = await readdir(dataDir);
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const filePath = join(dataDir, file);
    try {
      const content = await readFile(filePath, 'utf-8');
      JSON.parse(content);
    } catch (e: unknown) {
      result.passed = false;
      const err = e as Error;
      result.errors.push(`${file}: ${err.message}`);
    }
  }

  // Check nested feedback directory
  const feedbackDir = join(dataDir, 'feedback');
  if (existsSync(feedbackDir)) {
    const feedbackFiles = await readdir(feedbackDir);
    for (const file of feedbackFiles) {
      if (!file.endsWith('.json')) continue;
      const filePath = join(feedbackDir, file);
      try {
        const content = await readFile(filePath, 'utf-8');
        JSON.parse(content);
      } catch (e: unknown) {
        result.passed = false;
        const err = e as Error;
        result.errors.push(`feedback/${file}: ${err.message}`);
      }
    }
  }

  return result;
}

// 3. 중복 filePath 검출 (moltbook-share-state.json)
async function checkDuplicateFilePaths(): Promise<CheckResult> {
  const result: CheckResult = { name: 'Duplicate filePath', passed: true, errors: [] };
  const statePath = join(process.cwd(), 'data', 'moltbook-share-state.json');

  if (!existsSync(statePath)) return result;

  try {
    const content = await readFile(statePath, 'utf-8');
    const state = JSON.parse(content);
    const queue: { filePath: string }[] = state.queue || [];
    const seen = new Map<string, number>();

    for (const item of queue) {
      const count = seen.get(item.filePath) || 0;
      seen.set(item.filePath, count + 1);
    }

    for (const [path, count] of seen) {
      if (count > 1) {
        result.passed = false;
        result.errors.push(`Duplicate filePath (${count}x): ${path}`);
      }
    }
  } catch {
    // File doesn't exist or invalid — handled by JSON check
  }

  return result;
}

// 4. URL 이중 슬래시 검출
async function checkDoubleSlashUrls(): Promise<CheckResult> {
  const result: CheckResult = { name: 'URL Double Slash', passed: true, errors: [] };
  const recordsPath = join(process.cwd(), 'data', 'feedback', 'share-records.json');

  if (!existsSync(recordsPath)) return result;

  try {
    const content = await readFile(recordsPath, 'utf-8');
    const records = JSON.parse(content);

    for (const url of Object.keys(records)) {
      // Check for double slash after domain (not the protocol //)
      const afterProtocol = url.replace(/^https?:\/\//, '');
      if (afterProtocol.includes('//')) {
        result.passed = false;
        result.errors.push(`Double slash in URL: ${url}`);
      }
    }
  } catch {
    // File doesn't exist or invalid — handled by JSON check
  }

  return result;
}

// 5. package.json 스크립트 타겟 파일 존재 확인
async function checkScriptTargets(): Promise<CheckResult> {
  const result: CheckResult = { name: 'Script Targets', passed: true, errors: [] };

  try {
    const pkgContent = await readFile(join(process.cwd(), 'package.json'), 'utf-8');
    const pkg = JSON.parse(pkgContent);
    const scripts: Record<string, string> = pkg.scripts || {};

    for (const [name, command] of Object.entries(scripts)) {
      // Check tsx scripts that reference specific files
      const tsxMatch = command.match(/tsx\s+(scripts\/[\w.-]+\.mts)/);
      if (tsxMatch) {
        const targetFile = tsxMatch[1];
        if (!existsSync(join(process.cwd(), targetFile))) {
          result.passed = false;
          result.errors.push(`Script "${name}" references missing file: ${targetFile}`);
        }
      }
    }
  } catch {
    result.passed = false;
    result.errors.push('Failed to read package.json');
  }

  return result;
}

// Run all checks
async function main(): Promise<void> {
  console.log('🔍 Pre-commit 검증 시작...\n');

  console.log('  1/5 TypeScript 빌드 확인...');
  results.push(checkBuild());

  console.log('  2/5 JSON 파싱 확인...');
  results.push(await checkJsonFiles());

  console.log('  3/5 중복 filePath 검출...');
  results.push(await checkDuplicateFilePaths());

  console.log('  4/5 URL 이중 슬래시 검출...');
  results.push(await checkDoubleSlashUrls());

  console.log('  5/5 스크립트 타겟 파일 확인...');
  results.push(await checkScriptTargets());

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  let allPassed = true;
  for (const r of results) {
    const icon = r.passed ? '✅' : '❌';
    console.log(`${icon} ${r.name}`);
    if (!r.passed) {
      allPassed = false;
      for (const err of r.errors.slice(0, 5)) {
        console.log(`   → ${err}`);
      }
      if (r.errors.length > 5) {
        console.log(`   → ... and ${r.errors.length - 5} more`);
      }
    }
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (allPassed) {
    console.log('\n✅ 모든 검증 통과');
  } else {
    console.log('\n❌ 검증 실패 — 커밋 전 수정 필요');
    process.exit(1);
  }
}

main().catch(console.error);
