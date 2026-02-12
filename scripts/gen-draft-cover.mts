/**
 * drafts/ 파일용 커버 이미지 생성 스크립트
 * refresh-covers.mts와 동일한 파이프라인 사용
 */
import { config } from 'dotenv';
config();

import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import matter from 'gray-matter';
import { GeminiImageClient } from '../src/images/gemini-imagen.js';
import { getCoverPhotoPrompt, getVisualIdentity, inferAgentId, getCoverCaption } from '../src/images/cover-styles.js';
import { analyzeReference } from '../src/images/reference-analyzer.js';
import { applyOverlayToBase64 } from '../src/images/cover-overlay.js';

const OUTPUT_DIR = 'blog/static/images';
const BASE_URL = process.env.HUGO_BASE_URL || '/travel-blog';

const draftFile = process.argv[2];
if (!draftFile) {
  console.error('Usage: npx tsx scripts/gen-draft-cover.mts <draft-file>');
  process.exit(1);
}

async function main() {
  const content = await readFile(draftFile, 'utf-8');
  const { data, content: body } = matter(content);

  const categories = (data.categories as string[]) || [];
  const type: 'travel' | 'culture' = categories.includes('culture') ? 'culture' : 'travel';

  let agentId = data.personaId as string | undefined;
  if (!agentId) agentId = inferAgentId(data.title as string, data.tags as string[]);

  const identity = getVisualIdentity(agentId!);

  // 본문에서 ## 헤딩 추출
  const headings = body
    .split('\n')
    .filter(line => /^## /.test(line))
    .map(line => line.replace(/^## /, '').replace(/[*_`#]/g, '').trim())
    .filter(h => h.length > 0 && !h.startsWith('자주 묻는'));

  console.log(`📄 ${data.title}`);
  console.log(`   에이전트: ${identity.displayName} (${agentId}) | 타입: ${type}`);
  console.log(`   본문 힌트: ${headings.join(' | ')}`);

  const client = new GeminiImageClient();
  if (!client.isConfigured() || !client.isEnabled()) {
    console.error('GEMINI_API_KEY와 GEMINI_IMAGE_ENABLED=true 필요');
    process.exit(1);
  }

  // Step 1: 레퍼런스 분석
  console.log('   1/4 레퍼런스 분석...');
  const { analysis } = await analyzeReference(data.title as string, type, agentId!);

  // Step 2: 커버 프롬프트 생성 + 이미지 생성
  console.log('   2/4 커버 이미지 생성...');
  const coverPrompt = getCoverPhotoPrompt(data.title as string, type, agentId!, analysis, headings);
  const image = await client.generateImage({
    prompt: coverPrompt,
    style: 'cover_photo',
    aspectRatio: '16:9',
    topic: data.title as string,
  });

  // Step 3: 관인 오버레이 + 저장
  const slug = draftFile.replace(/^.*[\\/]/, '').replace(/\.md$/, '');
  const filename = `cover-refresh-${slug}.jpg`;
  const outputPath = join(OUTPUT_DIR, filename);
  const relativePath = `${BASE_URL}/images/${filename}`;

  console.log('   3/4 관인 오버레이 적용...');
  await applyOverlayToBase64(image.base64Data, outputPath, data.title as string, identity);
  console.log(`   ✓ 저장: ${relativePath}`);

  // Step 4: frontmatter 업데이트
  console.log('   4/4 frontmatter 업데이트...');
  const caption = getCoverCaption(agentId!, data.title as string);
  data.cover = {
    image: relativePath,
    alt: data.title,
    caption,
    relative: false,
    hidden: false,
  };
  const updated = matter.stringify(body, data);
  await writeFile(draftFile, updated, 'utf-8');

  console.log(`   ✅ 완료: ${identity.displayName} 관인 스타일 커버`);
  console.log(`   📝 캡션: ${caption}`);
}

main().catch(err => {
  console.error('오류:', err);
  process.exit(1);
});
