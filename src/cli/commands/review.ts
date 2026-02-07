/**
 * review 명령어: 초안 검토 및 편집
 */

import { readdir, readFile, writeFile, stat, copyFile } from 'fs/promises';
import { join } from 'path';
import { spawn } from 'child_process';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import matter from 'gray-matter';

export interface ReviewCommandOptions {
  file?: string;
  approve?: boolean;
}

export async function reviewCommand(options: ReviewCommandOptions): Promise<void> {
  console.log(chalk.cyan('\n📖 초안 검토\n'));

  const draftsDir = './drafts';
  const spinner = ora();

  try {
    // 파일 선택
    let targetFile: string;

    if (options.file) {
      targetFile = options.file;
    } else {
      // 파일 목록 로드
      const files = await readdir(draftsDir).catch(() => []);
      const mdFiles = files.filter(f => f.endsWith('.md'));

      if (mdFiles.length === 0) {
        console.log(chalk.yellow('검토할 초안이 없습니다.'));
        return;
      }

      // 파일 정보 수집
      const fileInfos = await Promise.all(
        mdFiles.map(async (filename) => {
          const content = await readFile(join(draftsDir, filename), 'utf-8');
          const { data } = matter(content);
          return {
            name: `${data.draft ? '📝' : '✅'} ${data.title || filename}`,
            value: filename,
            short: filename
          };
        })
      );

      const { selectedFile } = await inquirer.prompt([{
        type: 'list',
        name: 'selectedFile',
        message: '검토할 파일을 선택하세요:',
        choices: fileInfos
      }]);

      targetFile = selectedFile;
    }

    // 파일 경로 확인
    const filepath = join(draftsDir, targetFile);
    const fileStat = await stat(filepath).catch(() => null);

    if (!fileStat) {
      console.log(chalk.red(`파일을 찾을 수 없습니다: ${targetFile}`));
      return;
    }

    // 파일 내용 로드
    const content = await readFile(filepath, 'utf-8');
    const { data: frontmatter, content: body } = matter(content);

    // 현재 상태 표시
    console.log(chalk.dim('─'.repeat(50)));
    console.log(`\n📄 파일: ${chalk.cyan(targetFile)}`);
    console.log(`📝 제목: ${chalk.white.bold(frontmatter.title)}`);
    console.log(`📊 상태: ${frontmatter.draft ? chalk.yellow('초안') : chalk.green('승인됨')}`);
    console.log(`🏷️  태그: ${(frontmatter.tags || []).join(', ')}`);
    console.log(`📏 글자수: ${body.replace(/\s+/g, '').length}자`);
    console.log(chalk.dim('─'.repeat(50)));

    // 미리보기
    console.log(chalk.cyan('\n📖 본문 미리보기 (첫 500자):'));
    console.log(chalk.dim('─'.repeat(50)));
    const preview = body.trim().slice(0, 500);
    console.log(preview + (body.length > 500 ? '\n...' : ''));
    console.log(chalk.dim('─'.repeat(50)));

    // 액션 선택
    const { action } = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: '무엇을 하시겠습니까?',
      choices: [
        { name: '📝 에디터에서 편집', value: 'edit' },
        { name: frontmatter.draft ? '✅ 승인 (발행 준비)' : '📝 다시 초안으로', value: 'toggle' },
        { name: '🔍 SEO 분석', value: 'seo' },
        { name: '📋 블로그로 이동', value: 'move' },
        { name: '❌ 취소', value: 'cancel' }
      ]
    }]);

    switch (action) {
      case 'edit':
        await openInEditor(filepath);
        console.log(chalk.green('\n✓ 편집기에서 파일을 열었습니다.'));
        break;

      case 'toggle':
        await toggleDraftStatus(filepath, content, frontmatter);
        break;

      case 'seo':
        await analyzeSeo(frontmatter, body);
        break;

      case 'move':
        await moveToBlог(filepath, targetFile, frontmatter);
        break;

      case 'cancel':
        console.log(chalk.dim('\n취소되었습니다.'));
        break;
    }

  } catch (error) {
    spinner.fail('오류 발생');
    console.error(chalk.red('\n❌ 오류:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

/**
 * 에디터에서 파일 열기
 */
async function openInEditor(filepath: string): Promise<void> {
  const editor = process.env.EDITOR || 'code'; // VS Code 기본

  return new Promise((resolve, reject) => {
    const proc = spawn(editor, [filepath], {
      stdio: 'inherit',
      shell: true
    });

    proc.on('error', reject);
    proc.on('close', resolve);
  });
}

/**
 * 초안 상태 토글
 */
async function toggleDraftStatus(
  filepath: string,
  content: string,
  frontmatter: Record<string, unknown>
): Promise<void> {
  const newDraft = !frontmatter.draft;
  const { data, content: body } = matter(content);

  data.draft = newDraft;

  const { normalizeFrontmatterCaption } = await import('../../generator/frontmatter.js');
  const newContent = normalizeFrontmatterCaption(matter.stringify(body, data));
  await writeFile(filepath, newContent, 'utf-8');

  if (newDraft) {
    console.log(chalk.yellow('\n📝 초안으로 변경되었습니다.'));
  } else {
    console.log(chalk.green('\n✅ 승인되었습니다! 발행 준비가 완료되었습니다.'));
    console.log(chalk.dim(`발행하려면: npm run publish -- -f ${filepath.split('/').pop()}`));
  }
}

/**
 * SEO 분석
 */
async function analyzeSeo(
  frontmatter: Record<string, unknown>,
  body: string
): Promise<void> {
  console.log(chalk.cyan('\n🔍 SEO 분석 결과\n'));

  const issues: string[] = [];
  const suggestions: string[] = [];

  // 제목 분석
  const title = frontmatter.title as string || '';
  if (title.length < 20) {
    issues.push('제목이 너무 짧습니다 (권장: 30-60자)');
  } else if (title.length > 60) {
    issues.push('제목이 너무 깁니다 (권장: 30-60자)');
  }

  // 설명 분석
  const description = frontmatter.description as string || '';
  if (description.length < 50) {
    issues.push('메타 설명이 너무 짧습니다 (권장: 100-160자)');
  } else if (description.length > 160) {
    issues.push('메타 설명이 너무 깁니다 (권장: 100-160자)');
  }

  // 키워드 분석
  const keywords = frontmatter.keywords as string[] || [];
  if (keywords.length === 0) {
    issues.push('키워드가 없습니다');
  }

  // 본문 분석
  const wordCount = body.replace(/\s+/g, '').length;
  if (wordCount < 1000) {
    suggestions.push(`본문이 짧습니다 (${wordCount}자). 1500자 이상 권장`);
  }

  // 소제목 분석
  const h2Count = (body.match(/^## /gm) || []).length;
  const h3Count = (body.match(/^### /gm) || []).length;
  if (h2Count < 2) {
    suggestions.push('H2 소제목이 부족합니다 (권장: 3-5개)');
  }

  // 이미지 분석
  const imageCount = (body.match(/!\[.*?\]\(.*?\)/g) || []).length;
  if (imageCount === 0) {
    suggestions.push('이미지가 없습니다. 1개 이상의 이미지 추가를 권장합니다');
  }

  // 내부 링크 분석
  const linkCount = (body.match(/\[.*?\]\(\/.*?\)/g) || []).length;
  if (linkCount === 0) {
    suggestions.push('내부 링크가 없습니다. 관련 포스트 링크를 추가하세요');
  }

  // 결과 출력
  console.log(chalk.white.bold('📊 기본 정보'));
  console.log(`  • 제목 길이: ${title.length}자`);
  console.log(`  • 설명 길이: ${description.length}자`);
  console.log(`  • 본문 길이: ${wordCount}자`);
  console.log(`  • H2 소제목: ${h2Count}개`);
  console.log(`  • H3 소제목: ${h3Count}개`);
  console.log(`  • 이미지: ${imageCount}개`);
  console.log(`  • 내부 링크: ${linkCount}개`);

  if (issues.length > 0) {
    console.log(chalk.red('\n⚠️  문제점'));
    issues.forEach(issue => console.log(chalk.red(`  • ${issue}`)));
  }

  if (suggestions.length > 0) {
    console.log(chalk.yellow('\n💡 개선 제안'));
    suggestions.forEach(s => console.log(chalk.yellow(`  • ${s}`)));
  }

  if (issues.length === 0 && suggestions.length === 0) {
    console.log(chalk.green('\n✅ SEO 최적화가 잘 되어있습니다!'));
  }

  // SEO 점수
  const maxScore = 100;
  let score = maxScore;
  score -= issues.length * 15;
  score -= suggestions.length * 5;
  score = Math.max(0, score);

  console.log(chalk.cyan(`\n📈 SEO 점수: ${score}/100`));
}

/**
 * 블로그 폴더로 이동
 */
async function moveToBlог(
  filepath: string,
  filename: string,
  frontmatter: Record<string, unknown>
): Promise<void> {
  const category = (frontmatter.categories as string[])?.[0] || 'travel';
  const targetDir = `./blog/content/posts/${category}`;
  const targetPath = join(targetDir, filename);

  const { confirm } = await inquirer.prompt([{
    type: 'confirm',
    name: 'confirm',
    message: `${targetPath}로 이동하시겠습니까?`,
    default: true
  }]);

  if (confirm) {
    await copyFile(filepath, targetPath);
    console.log(chalk.green(`\n✅ 파일이 이동되었습니다: ${targetPath}`));
    console.log(chalk.dim('로컬 미리보기: npm run hugo:serve'));
  }
}
