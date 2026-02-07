/**
 * 팩트체크 자동 수정 엔진
 * corrections[]의 수정 제안을 실제 파일에 적용
 *
 * 안전 장치:
 * - critical 심각도 → 절대 자동 수정 안 함 → human-review 대기열
 * - dry-run: 파일 쓰기 생략, diff만 출력
 * - 매칭 0회 → 스킵
 * - 매칭 2회+ → 첫 번째만 적용 + 경고
 * - 감사 로그에 before/after 해시 기록
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { createHash } from 'crypto';
import { join, basename } from 'path';
import matter from 'gray-matter';
import {
  FactCheckReport,
  Correction,
  AutoFixReport,
  AppliedCorrection,
  DiffEntry,
  AutoFixAuditLog
} from './types.js';
import { addReviewCase } from '../quality/human-review.js';

const AUDIT_LOG_DIR = 'data/factcheck-fixes';

/**
 * SHA-256 해시 계산
 */
function computeHash(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex').slice(0, 16);
}

/**
 * 텍스트에서 매칭 횟수 카운트
 */
function countOccurrences(text: string, search: string): number {
  let count = 0;
  let pos = 0;
  while ((pos = text.indexOf(search, pos)) !== -1) {
    count++;
    pos += search.length;
  }
  return count;
}

/**
 * 날짜 기반 파일명 생성
 */
function generateAuditFilename(filePath: string): string {
  const date = new Date().toISOString().slice(0, 10);
  const slug = basename(filePath, '.md').replace(/[^a-zA-Z0-9가-힣-]/g, '-');
  return `${date}-${slug}.json`;
}

/**
 * 감사 로그 저장
 */
async function saveAuditLog(log: AutoFixAuditLog): Promise<string> {
  await mkdir(AUDIT_LOG_DIR, { recursive: true });
  const filename = generateAuditFilename(log.filePath);
  const logPath = join(AUDIT_LOG_DIR, filename);
  await writeFile(logPath, JSON.stringify(log, null, 2), 'utf-8');
  return logPath;
}

/**
 * 자동 수정 적용
 */
export async function applyAutoFix(
  filePath: string,
  report: FactCheckReport,
  options: {
    dryRun?: boolean;
    verbose?: boolean;
  } = {}
): Promise<AutoFixReport> {
  const { dryRun = false, verbose = false } = options;

  // 1. 파일 읽기
  const rawContent = await readFile(filePath, 'utf-8');
  const beforeHash = computeHash(rawContent);

  // 2. gray-matter 파싱
  const parsed = matter(rawContent);
  const title = (parsed.data.title as string) || 'Untitled';
  let body = parsed.content;
  const frontmatterData = { ...parsed.data };

  // 3. corrections 분류
  const autoApplicable: Correction[] = [];
  const criticalQueue: Correction[] = [];

  for (const correction of report.corrections) {
    if (correction.autoApplicable) {
      autoApplicable.push(correction);
    } else {
      criticalQueue.push(correction);
    }
  }

  // 4. critical corrections → human-review 대기열
  for (const critical of criticalQueue) {
    const claim = report.extractedClaims.find(c => c.id === critical.claimId);
    try {
      await addReviewCase(
        filePath,
        title,
        'critical_false',
        report.overallScore,
        `[자동수정 불가] ${critical.reason}: "${critical.originalText}" → "${critical.suggestedText}"`
      );
    } catch (error) {
      if (verbose) {
        console.warn(`[auto-fixer] 리뷰 케이스 추가 실패 (${critical.claimId}):`, error);
      }
    }
  }

  // 5. body 수정 — lineNumber 역순 정렬 (하단→상단, 오프셋 밀림 방지)
  const appliedCorrections: AppliedCorrection[] = [];
  const diffs: DiffEntry[] = [];

  // lineNumber 기준 역순 정렬
  const sortedCorrections = [...autoApplicable].sort((a, b) => {
    const claimA = report.extractedClaims.find(c => c.id === a.claimId);
    const claimB = report.extractedClaims.find(c => c.id === b.claimId);
    return (claimB?.lineNumber || 0) - (claimA?.lineNumber || 0);
  });

  for (const correction of sortedCorrections) {
    const occurrences = countOccurrences(body, correction.originalText);

    if (occurrences === 0) {
      // 매칭 0회 → 스킵 (enhance 단계에서 텍스트 변경된 경우)
      appliedCorrections.push({
        claimId: correction.claimId,
        originalText: correction.originalText,
        suggestedText: correction.suggestedText,
        reason: correction.reason,
        applied: false,
        skippedReason: '원본 텍스트를 찾을 수 없음 (이전 단계에서 변경됨)'
      });
      continue;
    }

    if (occurrences > 1 && verbose) {
      console.warn(`[auto-fixer] "${correction.originalText.slice(0, 40)}..." ${occurrences}회 발견 → 첫 번째만 적용`);
    }

    // 첫 번째만 적용
    const idx = body.indexOf(correction.originalText);
    const claim = report.extractedClaims.find(c => c.id === correction.claimId);

    body = body.slice(0, idx) + correction.suggestedText + body.slice(idx + correction.originalText.length);

    appliedCorrections.push({
      claimId: correction.claimId,
      originalText: correction.originalText,
      suggestedText: correction.suggestedText,
      reason: correction.reason,
      applied: true
    });

    diffs.push({
      lineNumber: claim?.lineNumber,
      original: correction.originalText,
      modified: correction.suggestedText,
      type: 'body'
    });
  }

  // 6. 결과 재조립
  const newContent = matter.stringify(body, frontmatterData);
  const afterHash = computeHash(newContent);

  // 7. 파일 쓰기 (dry-run이 아닌 경우만)
  let auditLogPath: string | undefined;

  if (!dryRun && appliedCorrections.some(c => c.applied)) {
    await writeFile(filePath, newContent, 'utf-8');

    // 감사 로그 저장
    const auditLog: AutoFixAuditLog = {
      filePath,
      title,
      fixedAt: new Date().toISOString(),
      beforeHash,
      afterHash,
      corrections: appliedCorrections.filter(c => c.applied),
      factcheckScore: report.overallScore,
      version: '1.0.0'
    };

    auditLogPath = await saveAuditLog(auditLog);
  }

  // 8. 보고서 반환
  const appliedCount = appliedCorrections.filter(c => c.applied).length;
  const skippedCount = appliedCorrections.filter(c => !c.applied).length;

  return {
    filePath,
    title,
    fixedAt: new Date().toISOString(),
    stats: {
      totalCorrections: report.corrections.length,
      applied: appliedCount,
      skipped: skippedCount,
      criticalQueued: criticalQueue.length
    },
    appliedCorrections,
    diffs,
    auditLogPath,
    beforeHash,
    afterHash: appliedCount > 0 ? afterHash : undefined,
    dryRun
  };
}

/**
 * AutoFixReport의 diff를 사람이 읽기 쉬운 문자열로 변환
 */
export function formatDiff(report: AutoFixReport): string {
  const lines: string[] = [];

  lines.push(`\n${report.dryRun ? '(DRY-RUN) ' : ''}자동 수정 결과: ${report.title}`);
  lines.push('━'.repeat(50));
  lines.push(`파일: ${report.filePath}`);
  lines.push(`해시: ${report.beforeHash}${report.afterHash ? ` → ${report.afterHash}` : ''}`);
  lines.push('');

  lines.push(`적용: ${report.stats.applied}개 | 스킵: ${report.stats.skipped}개 | Critical 대기: ${report.stats.criticalQueued}개`);
  lines.push('');

  if (report.diffs.length > 0) {
    lines.push('변경 사항:');
    for (const diff of report.diffs) {
      const lineInfo = diff.lineNumber ? ` (L${diff.lineNumber})` : '';
      lines.push(`  ${diff.type}${lineInfo}:`);
      lines.push(`  - ${diff.original}`);
      lines.push(`  + ${diff.modified}`);
      lines.push('');
    }
  }

  if (report.stats.criticalQueued > 0) {
    lines.push(`Critical 항목 ${report.stats.criticalQueued}개가 human-review 대기열에 추가되었습니다.`);
    lines.push('확인: npm run review:human');
  }

  if (report.auditLogPath) {
    lines.push(`\n감사 로그: ${report.auditLogPath}`);
  }

  lines.push('━'.repeat(50));
  return lines.join('\n');
}
