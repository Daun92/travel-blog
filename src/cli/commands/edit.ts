/**
 * edit 명령어: 로컬 에디터로 포스트 작성/등록/편집
 *
 * - edit new       : 대화형 프롬프트 → frontmatter 템플릿 생성 → 에디터 열기
 * - edit register  : 기존 .md 파일을 drafts/에 등록 (누락 필드 보완)
 * - edit [file]    : 기존 드래프트 메타데이터 수정 / 에디터 열기 / 검증
 */

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import matter from 'gray-matter';
import { readdir, readFile, writeFile, stat, copyFile } from 'fs/promises';
import { join, basename, extname, resolve } from 'path';
import { spawn } from 'child_process';
import { format } from 'date-fns';
import {
  generateFrontmatter,
  generateSlug,
  type FrontmatterData,
} from '../../generator/frontmatter.js';
import {
  selectPersona,
  loadPersonaById,
  loadPersonaRegistry,
} from '../../agents/draft-enhancer/persona-loader.js';

// ============================================================================
// Constants
// ============================================================================

const DRAFTS_DIR = './drafts';

const BODY_TEMPLATE_TRAVEL = `
## 개요

<!-- 여행지 소개 및 방문 동기 -->

## 가는 방법

<!-- 교통편, 소요시간, 주차 정보 -->

## 주요 볼거리

### 1.

<!-- 장소별 상세 -->

### 2.

<!-- 장소별 상세 -->

## 맛집 & 카페

<!-- 추천 음식점, 가격대, 웨이팅 정보 -->

## 실용 정보

- **운영시간**:
- **입장료**:
- **주차**:
- **소요시간**:

## 마무리

<!-- 총평, 추천 대상, 다음 방문 계획 -->
`;

const BODY_TEMPLATE_CULTURE = `
## 개요

<!-- 전시/공연/문화 콘텐츠 소개 -->

## 관람 포인트

### 1.

<!-- 핵심 작품/프로그램 -->

### 2.

<!-- 핵심 작품/프로그램 -->

## 관람 팁

<!-- 추천 동선, 준비물, 주의사항 -->

## 실용 정보

- **장소**:
- **기간**:
- **관람시간**:
- **입장료**:
- **예매**:

## 마무리

<!-- 총평, 추천 대상 -->
`;

// ============================================================================
// Helpers
// ============================================================================

/** drafts/ 내 .md 파일 목록 */
async function listDrafts(): Promise<{ filename: string; title: string; draft: boolean }[]> {
  try {
    const dirStat = await stat(DRAFTS_DIR).catch(() => null);
    if (!dirStat?.isDirectory()) return [];

    const files = await readdir(DRAFTS_DIR);
    const mdFiles = files.filter(f => f.endsWith('.md'));

    const results: { filename: string; title: string; draft: boolean }[] = [];
    for (const filename of mdFiles) {
      const content = await readFile(join(DRAFTS_DIR, filename), 'utf-8');
      const { data } = matter(content);
      results.push({
        filename,
        title: data.title || filename,
        draft: data.draft !== false,
      });
    }
    return results;
  } catch {
    return [];
  }
}

/** 에디터를 열고 닫힐 때까지 대기 */
function openInEditorAndWait(filepath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const editorEnv = process.env.EDITOR || 'code';
    const isVSCode = editorEnv.includes('code');
    const args = isVSCode ? ['--wait', filepath] : [filepath];

    const child = spawn(editorEnv, args, {
      stdio: 'inherit',
      shell: true,
    });

    child.on('close', (code) => {
      if (code === 0 || code === null) {
        resolve();
      } else {
        reject(new Error(`에디터가 코드 ${code}로 종료됨`));
      }
    });

    child.on('error', (err) => {
      reject(new Error(`에디터 실행 실패: ${err.message}`));
    });
  });
}

/** 경량 frontmatter 검증 */
function validateDraftFrontmatter(filepath: string, data: Record<string, unknown>, bodyLength: number): void {
  const issues: string[] = [];
  const hints: string[] = [];

  // 필수 필드 확인
  const required = ['title', 'date', 'description', 'categories', 'author', 'personaId'];
  for (const field of required) {
    if (!data[field]) {
      issues.push(`필수 필드 누락: ${field}`);
    }
  }

  // SEO 힌트
  const title = String(data.title || '');
  const description = String(data.description || '');
  const tags = data.tags as string[] | undefined;

  if (title.length > 60) {
    hints.push(`제목 ${title.length}자 → 60자 이하 권장 (SEO)`);
  }
  if (description.length < 50) {
    hints.push(`설명 ${description.length}자 → 50자 이상 권장 (SEO)`);
  }
  if (description.length > 160) {
    hints.push(`설명 ${description.length}자 → 160자 이하 권장 (SEO)`);
  }
  if (!tags || tags.length === 0) {
    hints.push('태그 없음 → 3-5개 권장');
  }
  if (bodyLength < 500) {
    hints.push(`본문 ${bodyLength}자 → 1500자 이상 권장`);
  }

  // 출력
  if (issues.length > 0) {
    console.log(chalk.red('\n  ❌ 문제:'));
    for (const issue of issues) {
      console.log(chalk.red(`     • ${issue}`));
    }
  }
  if (hints.length > 0) {
    console.log(chalk.yellow('\n  💡 힌트:'));
    for (const hint of hints) {
      console.log(chalk.yellow(`     • ${hint}`));
    }
  }
  if (issues.length === 0 && hints.length === 0) {
    console.log(chalk.green('\n  ✅ frontmatter 검증 통과'));
  }
}

/** 에이전트 선택 프롬프트용 선택지 */
const AGENT_CHOICES = [
  { name: '자동 (키워드 매칭)', value: 'auto' },
  { name: '조회영 (viral) - 바이럴, 순위/비교', value: 'viral' },
  { name: '김주말 (friendly) - 주말 여행, 솔직 후기', value: 'friendly' },
  { name: '한교양 (informative) - 교양/해설, 깊이', value: 'informative' },
];

/** personaId → author 문자열 */
function personaIdToAuthor(id: string): string {
  const map: Record<string, string> = {
    viral: '조회영 (OpenClaw)',
    friendly: '김주말 (OpenClaw)',
    informative: '한교양 (OpenClaw)',
  };
  return map[id] || '김주말 (OpenClaw)';
}

// ============================================================================
// Subcommand: edit new
// ============================================================================

async function editNew(): Promise<void> {
  console.log(chalk.cyan('\n✏️  새 포스트 작성\n'));

  // 대화형 입력
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'title',
      message: '포스트 제목:',
      validate: (v: string) => v.trim().length > 0 || '제목을 입력하세요',
    },
    {
      type: 'list',
      name: 'type',
      message: '콘텐츠 유형:',
      choices: [
        { name: '🧳 여행 (travel)', value: 'travel' },
        { name: '🎨 문화예술 (culture)', value: 'culture' },
      ],
    },
    {
      type: 'list',
      name: 'agent',
      message: '에이전트 (필명):',
      choices: AGENT_CHOICES,
    },
    {
      type: 'input',
      name: 'description',
      message: 'SEO 설명 (1-2문장):',
      validate: (v: string) => v.trim().length > 0 || '설명을 입력하세요',
    },
    {
      type: 'input',
      name: 'tags',
      message: '태그 (쉼표 구분):',
      filter: (v: string) => v.split(',').map(t => t.trim()).filter(Boolean),
    },
    {
      type: 'input',
      name: 'keywords',
      message: '키워드 (쉼표 구분, 선택):',
      filter: (v: string) => v.split(',').map(t => t.trim()).filter(Boolean),
    },
  ]);

  // 에이전트 결정
  let personaId: string;
  if (answers.agent === 'auto') {
    const persona = await selectPersona(answers.title, answers.type, answers.keywords);
    personaId = persona?.id || 'friendly';
    console.log(chalk.dim(`  → 자동 배정: ${personaIdToAuthor(personaId)}`));
  } else {
    personaId = answers.agent;
  }

  // frontmatter 생성
  const frontmatterData: FrontmatterData = {
    title: answers.title,
    date: new Date(),
    draft: true,
    description: answers.description,
    tags: answers.tags,
    categories: [answers.type],
    keywords: answers.keywords.length > 0 ? answers.keywords : undefined,
    author: personaIdToAuthor(personaId),
    personaId,
  };

  const frontmatter = generateFrontmatter(frontmatterData);
  const bodyTemplate = answers.type === 'travel' ? BODY_TEMPLATE_TRAVEL : BODY_TEMPLATE_CULTURE;
  const fullContent = `${frontmatter}\n${bodyTemplate}`;

  // 파일 저장
  const slug = generateSlug(answers.title);
  const filename = `${slug}.md`;
  const filepath = join(DRAFTS_DIR, filename);

  await writeFile(filepath, fullContent, 'utf-8');
  console.log(chalk.green(`\n  ✅ 파일 생성: ${filepath}`));

  // 에디터 열기
  const { openEditor } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'openEditor',
      message: '에디터에서 열까요?',
      default: true,
    },
  ]);

  if (openEditor) {
    console.log(chalk.dim('  에디터에서 파일을 편집하세요. 저장 후 닫으면 검증이 실행됩니다.'));
    try {
      await openInEditorAndWait(filepath);
    } catch (err) {
      console.log(chalk.yellow(`  ⚠️  ${err instanceof Error ? err.message : '에디터 실행 실패'}`));
      console.log(chalk.dim(`  직접 열기: code ${filepath}`));
    }

    // 검증
    const saved = await readFile(filepath, 'utf-8');
    const { data, content: body } = matter(saved);
    console.log(chalk.cyan('\n  📋 검증 결과:'));
    validateDraftFrontmatter(filepath, data, body.replace(/\s+/g, '').length);
  }

  // 다음 단계 안내
  console.log(chalk.cyan('\n💡 다음 단계:'));
  console.log(chalk.dim(`   npm run enhance -- -f ${filepath}`));
  console.log(chalk.dim(`   npm run factcheck -- -f ${filepath}`));
  console.log(chalk.dim(`   npm run validate -- -f ${filepath}`));
}

// ============================================================================
// Subcommand: edit register
// ============================================================================

async function editRegister(sourcePath: string): Promise<void> {
  console.log(chalk.cyan('\n📥 기존 파일 등록\n'));

  // 파일 존재 확인
  const resolved = resolve(sourcePath);
  const fileStat = await stat(resolved).catch(() => null);
  if (!fileStat?.isFile()) {
    console.error(chalk.red(`❌ 파일을 찾을 수 없습니다: ${resolved}`));
    process.exit(1);
  }

  if (extname(resolved) !== '.md') {
    console.error(chalk.red('❌ .md 파일만 등록 가능합니다'));
    process.exit(1);
  }

  // 기존 frontmatter 파싱
  const rawContent = await readFile(resolved, 'utf-8');
  const { data, content: body } = matter(rawContent);

  console.log(chalk.dim(`  원본: ${resolved}`));
  if (data.title) {
    console.log(chalk.dim(`  제목: ${data.title}`));
  }

  // 누락 필드 보완
  const missing: string[] = [];
  if (!data.title) missing.push('title');
  if (!data.description) missing.push('description');
  if (!data.categories || (data.categories as string[]).length === 0) missing.push('categories');
  if (!data.author) missing.push('author');
  if (!data.personaId) missing.push('personaId');
  if (!data.tags || (data.tags as string[]).length === 0) missing.push('tags');

  if (missing.length > 0) {
    console.log(chalk.yellow(`\n  누락 필드: ${missing.join(', ')}`));
    console.log(chalk.dim('  아래 프롬프트에서 보완합니다.\n'));
  }

  // 누락 필드 입력
  const supplementAnswers: Record<string, unknown> = {};

  if (!data.title) {
    const { title } = await inquirer.prompt([{
      type: 'input',
      name: 'title',
      message: '제목:',
      validate: (v: string) => v.trim().length > 0 || '제목 입력 필요',
    }]);
    supplementAnswers.title = title;
  }

  if (!data.categories || (data.categories as string[]).length === 0) {
    const { type } = await inquirer.prompt([{
      type: 'list',
      name: 'type',
      message: '콘텐츠 유형:',
      choices: [
        { name: '🧳 여행 (travel)', value: 'travel' },
        { name: '🎨 문화예술 (culture)', value: 'culture' },
      ],
    }]);
    supplementAnswers.categories = [type];
  }

  if (!data.author || !data.personaId) {
    const { agent } = await inquirer.prompt([{
      type: 'list',
      name: 'agent',
      message: '에이전트 (필명):',
      choices: AGENT_CHOICES.filter(c => c.value !== 'auto'),
    }]);
    supplementAnswers.personaId = agent;
    supplementAnswers.author = personaIdToAuthor(agent);
  }

  if (!data.description) {
    const { description } = await inquirer.prompt([{
      type: 'input',
      name: 'description',
      message: 'SEO 설명 (1-2문장):',
      validate: (v: string) => v.trim().length > 0 || '설명 입력 필요',
    }]);
    supplementAnswers.description = description;
  }

  if (!data.tags || (data.tags as string[]).length === 0) {
    const { tags } = await inquirer.prompt([{
      type: 'input',
      name: 'tags',
      message: '태그 (쉼표 구분):',
      filter: (v: string) => v.split(',').map(t => t.trim()).filter(Boolean),
    }]);
    supplementAnswers.tags = tags;
  }

  // frontmatter 병합
  const merged: Record<string, unknown> = {
    ...data,
    ...supplementAnswers,
    date: data.date || new Date(),
    draft: data.draft ?? true,
    // PaperMod 테마 기본값
    showToc: data.showToc ?? true,
    TocOpen: data.TocOpen ?? false,
    hidemeta: data.hidemeta ?? false,
    comments: data.comments ?? true,
    disableShare: data.disableShare ?? false,
    ShowReadingTime: data.ShowReadingTime ?? true,
    ShowBreadCrumbs: data.ShowBreadCrumbs ?? true,
    ShowPostNavLinks: data.ShowPostNavLinks ?? true,
    ShowWordCount: data.ShowWordCount ?? true,
  };

  // 파일 저장
  const title = (merged.title as string) || basename(resolved, '.md');
  const slug = generateSlug(title);
  const destFilename = `${slug}.md`;
  const destPath = join(DRAFTS_DIR, destFilename);

  const output = matter.stringify(body, merged);
  await writeFile(destPath, output, 'utf-8');

  console.log(chalk.green(`\n  ✅ 등록 완료: ${destPath}`));

  // 검증
  console.log(chalk.cyan('\n  📋 검증 결과:'));
  validateDraftFrontmatter(destPath, merged, body.replace(/\s+/g, '').length);

  // 다음 단계
  console.log(chalk.cyan('\n💡 다음 단계:'));
  console.log(chalk.dim(`   npm run edit -- ${destFilename}         # 메타데이터 수정`));
  console.log(chalk.dim(`   npm run enhance -- -f ${destPath}    # 향상`));
  console.log(chalk.dim(`   npm run factcheck -- -f ${destPath}  # 팩트체크`));
}

// ============================================================================
// Subcommand: edit [file] (default)
// ============================================================================

async function editDraft(file?: string): Promise<void> {
  console.log(chalk.cyan('\n📝 드래프트 편집\n'));

  // 파일 선택
  let targetFile: string;

  if (file) {
    // drafts/ 내에서 찾기
    const candidate = file.endsWith('.md') ? file : `${file}.md`;
    const inDrafts = join(DRAFTS_DIR, candidate);
    const fileStat = await stat(inDrafts).catch(() => null);
    if (fileStat?.isFile()) {
      targetFile = inDrafts;
    } else {
      // 절대/상대 경로로도 시도
      const resolved = resolve(candidate);
      const resolvedStat = await stat(resolved).catch(() => null);
      if (resolvedStat?.isFile()) {
        targetFile = resolved;
      } else {
        console.error(chalk.red(`❌ 파일을 찾을 수 없습니다: ${file}`));
        process.exit(1);
      }
    }
  } else {
    // 목록에서 선택
    const drafts = await listDrafts();
    if (drafts.length === 0) {
      console.log(chalk.yellow('초안이 없습니다.'));
      console.log(chalk.dim('새 포스트: npm run edit new'));
      return;
    }

    const { selected } = await inquirer.prompt([{
      type: 'list',
      name: 'selected',
      message: '편집할 드래프트 선택:',
      choices: drafts.map(d => ({
        name: `${d.draft ? '📝' : '✅'} ${d.title} (${d.filename})`,
        value: d.filename,
      })),
    }]);
    targetFile = join(DRAFTS_DIR, selected);
  }

  // 현재 frontmatter 표시
  const content = await readFile(targetFile, 'utf-8');
  const { data, content: body } = matter(content);

  console.log(chalk.dim('─'.repeat(50)));
  console.log(`  제목: ${chalk.white.bold(data.title || '(없음)')}`);
  console.log(`  유형: ${(data.categories as string[])?.[0] || '(없음)'}`);
  console.log(`  에이전트: ${data.author || '(없음)'} (${data.personaId || '?'})`);
  console.log(`  상태: ${data.draft ? chalk.yellow('초안') : chalk.green('승인됨')}`);
  console.log(`  설명: ${String(data.description || '(없음)').slice(0, 60)}`);
  console.log(`  태그: ${(data.tags as string[] || []).join(', ') || '(없음)'}`);
  console.log(`  본문: ${body.replace(/\s+/g, '').length}자`);
  console.log(chalk.dim('─'.repeat(50)));

  // 액션 선택
  const { action } = await inquirer.prompt([{
    type: 'list',
    name: 'action',
    message: '작업 선택:',
    choices: [
      { name: '✏️  에디터에서 열기', value: 'editor' },
      { name: '📋 메타데이터 수정', value: 'meta' },
      { name: '🔄 둘 다 (메타 수정 → 에디터)', value: 'both' },
      { name: '✅ 검증만', value: 'validate' },
    ],
  }]);

  // 메타데이터 수정
  if (action === 'meta' || action === 'both') {
    const metaAnswers = await inquirer.prompt([
      {
        type: 'input',
        name: 'title',
        message: '제목:',
        default: data.title,
      },
      {
        type: 'input',
        name: 'description',
        message: '설명:',
        default: data.description,
      },
      {
        type: 'list',
        name: 'categories',
        message: '유형:',
        choices: [
          { name: '🧳 여행', value: 'travel' },
          { name: '🎨 문화예술', value: 'culture' },
        ],
        default: (data.categories as string[])?.[0] || 'travel',
      },
      {
        type: 'input',
        name: 'tags',
        message: '태그 (쉼표 구분):',
        default: (data.tags as string[] || []).join(', '),
        filter: (v: string) => v.split(',').map(t => t.trim()).filter(Boolean),
      },
      {
        type: 'list',
        name: 'agent',
        message: '에이전트:',
        choices: AGENT_CHOICES.filter(c => c.value !== 'auto'),
        default: data.personaId || 'friendly',
      },
      {
        type: 'list',
        name: 'draft',
        message: '상태:',
        choices: [
          { name: '📝 초안 (draft)', value: true },
          { name: '✅ 승인됨 (발행 가능)', value: false },
        ],
        default: data.draft !== false,
      },
    ]);

    // frontmatter 업데이트
    const updated = {
      ...data,
      title: metaAnswers.title,
      description: metaAnswers.description,
      categories: [metaAnswers.categories],
      tags: metaAnswers.tags,
      personaId: metaAnswers.agent,
      author: personaIdToAuthor(metaAnswers.agent),
      draft: metaAnswers.draft,
    };

    const output = matter.stringify(body, updated);
    await writeFile(targetFile, output, 'utf-8');
    console.log(chalk.green('\n  ✅ 메타데이터 업데이트 완료'));
  }

  // 에디터 열기
  if (action === 'editor' || action === 'both') {
    console.log(chalk.dim('\n  에디터에서 파일을 편집하세요. 저장 후 닫으면 검증이 실행됩니다.'));
    try {
      await openInEditorAndWait(targetFile);
    } catch (err) {
      console.log(chalk.yellow(`  ⚠️  ${err instanceof Error ? err.message : '에디터 실행 실패'}`));
      console.log(chalk.dim(`  직접 열기: code ${targetFile}`));
    }
  }

  // 검증
  const saved = await readFile(targetFile, 'utf-8');
  const { data: savedData, content: savedBody } = matter(saved);
  console.log(chalk.cyan('\n  📋 검증 결과:'));
  validateDraftFrontmatter(targetFile, savedData, savedBody.replace(/\s+/g, '').length);

  // 다음 단계
  console.log(chalk.cyan('\n💡 다음 단계:'));
  console.log(chalk.dim(`   npm run enhance -- -f ${targetFile}`));
  console.log(chalk.dim(`   npm run factcheck -- -f ${targetFile}`));
  console.log(chalk.dim(`   npm run validate -- -f ${targetFile}`));
}

// ============================================================================
// Command Export
// ============================================================================

export const editCommand = new Command('edit')
  .description('로컬 에디터로 포스트 작성/등록/편집')
  .argument('[file]', '편집할 드래프트 파일명')
  .action((file?: string) => {
    if (file) {
      return editDraft(file);
    }
    return editDraft();
  });

editCommand
  .command('new')
  .description('대화형 프롬프트로 새 포스트 템플릿 생성')
  .action(() => editNew());

editCommand
  .command('register <path>')
  .description('기존 .md 파일을 drafts/에 등록 (누락 필드 보완)')
  .action((path: string) => editRegister(path));
