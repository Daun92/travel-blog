/**
 * 기존 드래프트에 인라인 이미지를 생성하는 스크립트
 * Usage: tsx scripts/generate-images-for-draft.mts -f <draft-file> [-n <max-images>]
 */
import { config } from 'dotenv';
config();

import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { GeminiImageClient, saveImage } from '../src/images/gemini-imagen.js';
import { extractImageMarkers } from '../src/generator/content-parser.js';
import { generatePromptFromMarker, type ImageContext } from '../src/generator/image-prompts.js';

const args = process.argv.slice(2);
const fileIdx = args.indexOf('-f');
const countIdx = args.indexOf('-n');

if (fileIdx === -1 || !args[fileIdx + 1]) {
  console.error('Usage: tsx scripts/generate-images-for-draft.mts -f <file> [-n <max>]');
  process.exit(1);
}

const filePath = args[fileIdx + 1];
const maxImages = countIdx !== -1 ? parseInt(args[countIdx + 1], 10) : 3;

async function main() {
  const content = await readFile(filePath, 'utf-8');
  const markers = extractImageMarkers(content);

  if (markers.length === 0) {
    console.log('이미지 마커가 없습니다.');
    return;
  }

  console.log(`${markers.length}개 마커 발견, 최대 ${maxImages}개 처리`);

  const gemini = new GeminiImageClient();
  if (!gemini.isConfigured()) {
    console.error('GEMINI_API_KEY가 설정되지 않았습니다.');
    process.exit(1);
  }

  // slug 추출 (파일명에서)
  const fileName = filePath.split(/[/\\]/).pop() || 'draft';
  const slug = fileName.replace(/\.md$/, '');

  const imageOutputDir = join(process.cwd(), 'blog', 'static', 'images');
  const imageContext: ImageContext = { topic: '서울 인디 공연장', type: 'culture' };
  const markersToProcess = markers.slice(0, maxImages);

  let processedContent = content;

  for (let i = 0; i < markersToProcess.length; i++) {
    const marker = markersToProcess[i];
    console.log(`[${i + 1}/${markersToProcess.length}] ${marker.style} 이미지 생성 중...`);

    const promptInfo = generatePromptFromMarker(marker.marker, imageContext);
    if (!promptInfo) {
      console.log('  스킵: 잘못된 마커');
      continue;
    }

    try {
      const result = await gemini.generateImage({
        prompt: promptInfo.prompt,
        style: marker.style as any,
        topic: '서울 인디 공연장'
      });

      const imageFileName = `inline-${slug}-${i + 1}.jpeg`;
      const saved = await saveImage(result, imageOutputDir, imageFileName);

      const altText = marker.description || '인라인 이미지';
      const caption = 'AI 생성 일러스트';
      const markdownImage = `![${altText}](${saved.relativePath})\n*${caption}*`;

      processedContent = processedContent.replace(marker.marker, markdownImage);
      console.log(`  ✓ 저장: ${saved.relativePath}`);
    } catch (err) {
      console.error(`  ✗ 실패: ${err instanceof Error ? err.message : err}`);
      processedContent = processedContent.replace(marker.marker, '');
    }
  }

  await writeFile(filePath, processedContent, 'utf-8');
  console.log(`\n완료. 파일 업데이트: ${filePath}`);
}

main().catch(console.error);
