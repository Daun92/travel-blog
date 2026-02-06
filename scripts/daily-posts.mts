#!/usr/bin/env npx tsx
/**
 * 일일 2포스트 자동 생성 스크립트
 *
 * 사용법:
 *   npx tsx scripts/daily-posts.mts          # 2개 포스트 생성
 *   npx tsx scripts/daily-posts.mts --count 1  # 1개만 생성
 *   npx tsx scripts/daily-posts.mts --preview  # 프리뷰만 (생성 안 함)
 */

import { config } from 'dotenv';
config();

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

interface TopicItem {
  title: string;
  type: 'travel' | 'culture';
  meta?: {
    score?: number;
    source?: string;
    surveyRelevance?: number;
    discoveredAt?: string;
    keywords?: string[];
  };
}

interface TopicQueue {
  queue: TopicItem[];
  completed: TopicItem[];
  settings: {
    postsPerDay: number;
    deployDelayHours: number;
    defaultLength: string;
    enableInlineImages: boolean;
    inlineImageCount: number;
  };
}

interface GenerationResult {
  success: boolean;
  topic: TopicItem;
  filepath?: string;
  error?: string;
}

async function loadQueue(): Promise<TopicQueue> {
  const queuePath = join(projectRoot, 'config', 'topic-queue.json');
  const content = await readFile(queuePath, 'utf-8');
  return JSON.parse(content);
}

async function saveQueue(queue: TopicQueue): Promise<void> {
  const queuePath = join(projectRoot, 'config', 'topic-queue.json');
  await writeFile(queuePath, JSON.stringify(queue, null, 2), 'utf-8');
}

async function generatePost(topic: TopicItem, settings: TopicQueue['settings']): Promise<GenerationResult> {
  const { spawn } = await import('child_process');

  return new Promise((resolve) => {
    const args = [
      'src/cli/index.ts',
      'new',
      '-t', topic.title,
      '--type', topic.type,
      '-l', settings.defaultLength,
      '-y' // 비대화 모드
    ];

    if (settings.enableInlineImages) {
      args.push('--inline-images');
      args.push('--image-count', String(settings.inlineImageCount));
    }

    console.log(chalk.dim(`\n실행: npx tsx ${args.join(' ')}`));

    const child = spawn('npx', ['tsx', ...args], {
      cwd: projectRoot,
      stdio: 'inherit',
      shell: true
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, topic });
      } else {
        resolve({ success: false, topic, error: `Exit code: ${code}` });
      }
    });

    child.on('error', (err) => {
      resolve({ success: false, topic, error: err.message });
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  const previewOnly = args.includes('--preview');
  const countIndex = args.indexOf('--count');
  const customCount = countIndex !== -1 ? parseInt(args[countIndex + 1], 10) : undefined;

  console.log(chalk.cyan('\n═══════════════════════════════════════════════════'));
  console.log(chalk.cyan('     📝 OpenClaw 일일 포스트 자동 생성'));
  console.log(chalk.cyan('═══════════════════════════════════════════════════\n'));

  // 1. 큐 로드
  const queue = await loadQueue();
  const postsToGenerate = customCount ?? queue.settings.postsPerDay;

  console.log(chalk.white.bold('📋 현재 큐 상태'));
  console.log(chalk.dim(`  대기 중: ${queue.queue.length}개`));
  console.log(chalk.dim(`  완료됨: ${queue.completed.length}개`));
  console.log(chalk.dim(`  오늘 생성: ${postsToGenerate}개\n`));

  // 2. 생성할 주제 선택
  if (queue.queue.length === 0) {
    console.log(chalk.yellow('⚠️ 큐에 주제가 없습니다.'));
    console.log(chalk.dim('  npm run queue:add -- "주제" --type travel 로 추가하세요.'));
    process.exit(1);
  }

  // 서베이 관련도 높은 주제 우선 (meta가 있는 경우)
  const sorted = [...queue.queue].sort((a, b) => {
    const aRel = a.meta?.surveyRelevance ?? a.meta?.score ?? 0;
    const bRel = b.meta?.surveyRelevance ?? b.meta?.score ?? 0;
    return bRel - aRel;
  });
  const topicsToGenerate = sorted.slice(0, postsToGenerate);

  console.log(chalk.white.bold('🎯 오늘 생성할 포스트'));
  topicsToGenerate.forEach((topic, i) => {
    const emoji = topic.type === 'travel' ? '🧳' : '🎨';
    console.log(chalk.white(`  ${i + 1}. ${emoji} [${topic.type}] ${topic.title}`));
  });

  if (previewOnly) {
    console.log(chalk.yellow('\n🔍 프리뷰 모드: 실제 생성하지 않습니다.'));
    process.exit(0);
  }

  // 3. 포스트 생성
  console.log(chalk.white.bold('\n🚀 포스트 생성 시작\n'));

  const results: GenerationResult[] = [];

  for (let i = 0; i < topicsToGenerate.length; i++) {
    const topic = topicsToGenerate[i];
    console.log(chalk.cyan(`\n[${ i + 1}/${topicsToGenerate.length}] ${topic.title}`));
    console.log(chalk.dim('─'.repeat(50)));

    const result = await generatePost(topic, queue.settings);
    results.push(result);

    if (result.success) {
      // 큐에서 제거하고 completed로 이동
      queue.queue = queue.queue.filter(t => t.title !== topic.title);
      queue.completed.push({
        ...topic,
      });
      await saveQueue(queue);
    }
  }

  // 4. 결과 요약
  console.log(chalk.cyan('\n═══════════════════════════════════════════════════'));
  console.log(chalk.white.bold('📊 생성 결과 요약'));
  console.log(chalk.cyan('═══════════════════════════════════════════════════\n'));

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(chalk.green(`  ✅ 성공: ${successful.length}개`));
  if (failed.length > 0) {
    console.log(chalk.red(`  ❌ 실패: ${failed.length}개`));
    failed.forEach(r => {
      console.log(chalk.red(`    - ${r.topic.title}: ${r.error}`));
    });
  }

  // 5. 다음 단계 안내
  console.log(chalk.cyan('\n📌 다음 단계'));
  console.log(chalk.dim('  1. 초안 확인: npm run drafts'));
  console.log(chalk.dim('  2. 로컬 미리보기: npm run hugo:serve'));
  console.log(chalk.dim('  3. 배포: npm run daily:deploy'));
  console.log(chalk.dim('  4. 지연 배포: npm run daily:deploy -- --delay 6'));

  // 6. 프리뷰 보고서 생성
  const reportsDir = join(projectRoot, 'reports');
  await mkdir(reportsDir, { recursive: true });

  const today = new Date().toISOString().split('T')[0];
  const reportPath = join(reportsDir, `${today}.md`);

  const reportContent = `# 일일 포스트 생성 보고서

**날짜**: ${today}
**생성 시간**: ${new Date().toLocaleString('ko-KR')}

## 생성 결과

| 상태 | 유형 | 제목 |
|------|------|------|
${results.map(r => `| ${r.success ? '✅' : '❌'} | ${r.topic.type} | ${r.topic.title} |`).join('\n')}

## 통계

- 성공: ${successful.length}개
- 실패: ${failed.length}개
- 큐 남은 주제: ${queue.queue.length}개

## 다음 단계

1. \`npm run drafts\` - 초안 목록 확인
2. \`npm run hugo:serve\` - 로컬 미리보기
3. \`npm run daily:deploy\` - 배포

---
*Generated by OpenClaw Daily Posts*
`;

  await writeFile(reportPath, reportContent, 'utf-8');
  console.log(chalk.dim(`\n📄 보고서 생성됨: ${reportPath}`));

  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(chalk.red('오류:'), err);
  process.exit(1);
});
