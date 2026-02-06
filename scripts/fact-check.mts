/**
 * 팩트체크 자동화 스크립트
 * 포스트의 사실관계를 웹 검색으로 검증
 */

import { config } from 'dotenv';
import { readFile, writeFile } from 'fs/promises';
import matter from 'gray-matter';
import chalk from 'chalk';

config();

interface FactCheckResult {
  field: string;
  claim: string;
  verification: 'verified' | 'false' | 'unknown';
  correctInfo?: string;
  source?: string;
  severity: 'critical' | 'major' | 'minor';
}

interface FactCheckReport {
  filePath: string;
  title: string;
  totalChecks: number;
  verified: number;
  false: number;
  unknown: number;
  results: FactCheckResult[];
  overallScore: number; // 0-100
  needsCorrection: boolean;
}

/**
 * 장소 정보 팩트체크 항목
 */
const VENUE_FACT_CHECKS = [
  'address',     // 주소
  'hours',       // 운영시간
  'closed',      // 휴무일
  'price',       // 가격
  'facilities',  // 시설
  'access'       // 접근성/교통
];

/**
 * 전시/이벤트 팩트체크 항목
 */
const EVENT_FACT_CHECKS = [
  'title',       // 전시/이벤트명
  'period',      // 기간
  'venue',       // 장소
  'details'      // 세부 내용
];

/**
 * 팩트체크 필요 여부 판단
 */
function needsFactCheck(content: string, frontmatter: any): boolean {
  // 장소/관광지 포스트
  if (frontmatter.venue || frontmatter.location) {
    return true;
  }

  // 전시/공연 포스트
  if (frontmatter.eventDate || frontmatter.ticketPrice) {
    return true;
  }

  // 맛집/카페 포스트
  if (content.includes('운영시간') || content.includes('영업시간')) {
    return true;
  }

  return false;
}

/**
 * 주요 클레임 추출
 */
function extractClaims(content: string, frontmatter: any): string[] {
  const claims: string[] = [];

  // Frontmatter에서 추출
  if (frontmatter.venue) claims.push(`venue: ${frontmatter.venue}`);
  if (frontmatter.openingHours) claims.push(`hours: ${frontmatter.openingHours}`);
  if (frontmatter.ticketPrice) claims.push(`price: ${frontmatter.ticketPrice}`);

  // 본문에서 숫자 정보 추출 (층수, 가격 등)
  const floorMatch = content.match(/(\d+)층/g);
  if (floorMatch) {
    floorMatch.forEach(match => claims.push(`floors: ${match}`));
  }

  // 운영시간 정보
  const hoursMatch = content.match(/\d{1,2}:\d{2}\s*[-~]\s*\d{1,2}:\d{2}/g);
  if (hoursMatch) {
    hoursMatch.forEach(match => claims.push(`hours: ${match}`));
  }

  // 가격 정보
  const priceMatch = content.match(/(\d{1,3}(,\d{3})*원)/g);
  if (priceMatch) {
    priceMatch.forEach(match => claims.push(`price: ${match}`));
  }

  return claims;
}

/**
 * 웹 검색으로 팩트체크
 * (실제 구현에서는 WebSearch API 사용)
 */
async function verifyFactWithWebSearch(
  venue: string,
  claim: string
): Promise<FactCheckResult> {
  // 이 부분은 실제로 WebSearch를 호출해야 함
  // 현재는 구조만 제공

  console.log(chalk.yellow(`검증 필요: ${venue} - ${claim}`));

  return {
    field: claim.split(':')[0],
    claim: claim.split(':')[1]?.trim() || claim,
    verification: 'unknown',
    severity: 'major'
  };
}

/**
 * 포스트 팩트체크 실행
 */
async function factCheckPost(filePath: string): Promise<FactCheckReport> {
  const content = await readFile(filePath, 'utf-8');
  const { data, content: body } = matter(content);

  console.log(chalk.cyan(`\n📋 팩트체크: ${data.title || filePath}\n`));

  // 팩트체크 필요 여부 확인
  if (!needsFactCheck(body, data)) {
    console.log(chalk.gray('팩트체크 불필요 (에세이/의견 포스트)'));
    return {
      filePath,
      title: data.title,
      totalChecks: 0,
      verified: 0,
      false: 0,
      unknown: 0,
      results: [],
      overallScore: 100,
      needsCorrection: false
    };
  }

  // 클레임 추출
  const claims = extractClaims(body, data);
  console.log(chalk.white(`발견된 클레임: ${claims.length}개\n`));

  const results: FactCheckResult[] = [];

  // 각 클레임 검증 (실제로는 WebSearch 사용)
  for (const claim of claims) {
    const result = await verifyFactWithWebSearch(data.venue || data.title, claim);
    results.push(result);
  }

  // 통계
  const verified = results.filter(r => r.verification === 'verified').length;
  const falseCount = results.filter(r => r.verification === 'false').length;
  const unknown = results.filter(r => r.verification === 'unknown').length;

  const overallScore = claims.length > 0
    ? Math.round((verified / claims.length) * 100)
    : 100;

  const needsCorrection = falseCount > 0 || overallScore < 50;

  return {
    filePath,
    title: data.title,
    totalChecks: claims.length,
    verified,
    false: falseCount,
    unknown,
    results,
    overallScore,
    needsCorrection
  };
}

/**
 * 팩트체크 보고서 출력
 */
function printReport(report: FactCheckReport) {
  console.log(chalk.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.cyan(`📊 팩트체크 보고서`));
  console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

  console.log(chalk.white.bold(`제목: ${report.title}`));
  console.log(chalk.gray(`파일: ${report.filePath}\n`));

  console.log(chalk.white('검증 결과:'));
  console.log(chalk.green(`  ✓ 확인됨: ${report.verified}/${report.totalChecks}`));
  console.log(chalk.red(`  ✗ 거짓: ${report.false}/${report.totalChecks}`));
  console.log(chalk.yellow(`  ? 미확인: ${report.unknown}/${report.totalChecks}\n`));

  const scoreColor = report.overallScore >= 80 ? 'green'
    : report.overallScore >= 50 ? 'yellow'
      : 'red';

  console.log(chalk.white(`정확도 점수: ${chalk[scoreColor](`${report.overallScore}%`)}\n`));

  if (report.needsCorrection) {
    console.log(chalk.red.bold('⚠️  수정 필요!\n'));
  }

  // 세부 결과
  if (report.results.length > 0) {
    console.log(chalk.white('세부 검증:\n'));
    report.results.forEach((result, i) => {
      const icon = result.verification === 'verified' ? '✓'
        : result.verification === 'false' ? '✗'
          : '?';

      const color = result.verification === 'verified' ? 'green'
        : result.verification === 'false' ? 'red'
          : 'yellow';

      console.log(chalk[color](`  ${icon} ${result.field}: ${result.claim}`));
      if (result.correctInfo) {
        console.log(chalk.gray(`    → 정확한 정보: ${result.correctInfo}`));
      }
      if (result.source) {
        console.log(chalk.dim(`    → 출처: ${result.source}`));
      }
      console.log('');
    });
  }

  console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
}

/**
 * 팩트체크 보고서 저장
 */
async function saveReport(report: FactCheckReport, outputPath: string) {
  const reportData = {
    ...report,
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  };

  await writeFile(outputPath, JSON.stringify(reportData, null, 2));
  console.log(chalk.green(`보고서 저장: ${outputPath}`));
}

/**
 * 메인 실행
 */
async function main() {
  const filePath = process.argv[2];

  if (!filePath) {
    console.log(chalk.red('\n❌ 사용법: npx tsx scripts/fact-check.mts <포스트-파일-경로>\n'));
    console.log(chalk.white('예시:'));
    console.log(chalk.gray('  npx tsx scripts/fact-check.mts blog/content/posts/culture/2026-02-04-mmca-exhibition.md\n'));
    process.exit(1);
  }

  try {
    const report = await factCheckPost(filePath);
    printReport(report);

    // 보고서 저장
    const outputPath = filePath.replace('.md', '.fact-check.json');
    await saveReport(report, outputPath);

    // 종료 코드 (수정 필요 시 1)
    process.exit(report.needsCorrection ? 1 : 0);

  } catch (error) {
    console.error(chalk.red('\n❌ 팩트체크 실패:'), error);
    process.exit(1);
  }
}

main();
