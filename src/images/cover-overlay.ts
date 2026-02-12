/**
 * 관인(落款) 스타일 워터마크 오버레이
 * 동양 미술 낙관 느낌의 에이전트 식별 스탬프를 커버 이미지 우하단에 적용
 *
 * 레이아웃:
 * +--------------------------------------------------+
 * |              [포토리얼리스틱 이미지]               |
 * |                                                    |
 * |                                          ┌──────┐ |
 * |                                          │ 회   │ |
 * |                                          │ 영   │ |
 * |                                          └──────┘ |
 * +--------------------------------------------------+
 */

import sharp from 'sharp';
import { readFile, mkdir } from 'fs/promises';
import { dirname } from 'path';
import type { AgentVisualIdentity } from './cover-styles.js';

const TARGET_WIDTH = 1200;
const TARGET_HEIGHT = 675;

// ─── 관인 상수 ───────────────────────────────────────────────

const SEAL_SIZE = 70;
const SEAL_PADDING = 30;
const OUTER_BORDER = 3;
const INNER_BORDER = 1.5;
const INNER_GAP = 3;
const SEAL_ROTATION = -5;
const SEAL_OPACITY = 0.82;
const BG_OPACITY = 0.12;

// ─── 관인 SVG 생성 ──────────────────────────────────────────

/**
 * 에이전트별 관인(낙관) SVG 생성
 * 70×70px 이중 테두리 정사각, 2자 세로 배치, -5° 회전
 */
function buildSealSvg(
  identity: AgentVisualIdentity,
  width: number = TARGET_WIDTH,
  height: number = TARGET_HEIGHT,
): string {
  const color = identity.primaryColor;
  const chars = identity.sealChars;
  const char0 = chars[0] || '';
  const char1 = chars[1] || '';

  // 관인 중심점 (우하단 패딩)
  const cx = width - SEAL_PADDING - SEAL_SIZE / 2;
  const cy = height - SEAL_PADDING - SEAL_SIZE / 2;

  // 외곽 사각형
  const outerX = -SEAL_SIZE / 2;
  const outerY = -SEAL_SIZE / 2;

  // 내곽 사각형 (외곽 안쪽으로 border + gap)
  const innerOffset = OUTER_BORDER + INNER_GAP;
  const innerSize = SEAL_SIZE - innerOffset * 2;
  const innerX = -innerSize / 2;
  const innerY = -innerSize / 2;

  const fontFamily = `'Batang', 'Nanum Myeongjo', 'SimSun', serif`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <g transform="translate(${cx}, ${cy}) rotate(${SEAL_ROTATION})" opacity="${SEAL_OPACITY}">
    <!-- 반투명 흰색 배경 (잉크 번짐) -->
    <rect x="${outerX}" y="${outerY}" width="${SEAL_SIZE}" height="${SEAL_SIZE}" fill="white" opacity="${BG_OPACITY}"/>

    <!-- 외곽선 -->
    <rect x="${outerX}" y="${outerY}" width="${SEAL_SIZE}" height="${SEAL_SIZE}"
          fill="none" stroke="${color}" stroke-width="${OUTER_BORDER}"/>

    <!-- 내곽선 -->
    <rect x="${innerX}" y="${innerY}" width="${innerSize}" height="${innerSize}"
          fill="none" stroke="${color}" stroke-width="${INNER_BORDER}"/>

    <!-- 상단 글자 -->
    <text x="0" y="-6" font-family="${fontFamily}" font-size="24" font-weight="700"
          fill="${color}" text-anchor="middle" dominant-baseline="middle">${char0}</text>

    <!-- 하단 글자 -->
    <text x="0" y="20" font-family="${fontFamily}" font-size="24" font-weight="700"
          fill="${color}" text-anchor="middle" dominant-baseline="middle">${char1}</text>
  </g>
</svg>`;
}

// ─── 이미지 오버레이 적용 ────────────────────────────────────

/**
 * 이미지 파일에 관인 오버레이 적용
 * @param inputPath 원본 이미지 경로
 * @param outputPath 결과 이미지 저장 경로
 * @param _title 미사용 (호환성 유지)
 * @param identity 에이전트 시각 아이덴티티
 */
export async function applyOverlay(
  inputPath: string,
  outputPath: string,
  _title: string,
  identity: AgentVisualIdentity,
): Promise<void> {
  const imageBuffer = await readFile(inputPath);

  const resized = await sharp(imageBuffer)
    .resize(TARGET_WIDTH, TARGET_HEIGHT, { fit: 'cover', position: 'top' })
    .jpeg({ quality: 90 })
    .toBuffer();

  const sealSvg = buildSealSvg(identity, TARGET_WIDTH, TARGET_HEIGHT);
  const svgBuffer = Buffer.from(sealSvg);

  await mkdir(dirname(outputPath), { recursive: true });
  await sharp(resized)
    .composite([{ input: svgBuffer, top: 0, left: 0 }])
    .jpeg({ quality: 90 })
    .toFile(outputPath);
}

/**
 * Base64 이미지 데이터에서 직접 관인 오버레이 적용
 */
export async function applyOverlayToBase64(
  base64Data: string,
  outputPath: string,
  _title: string,
  identity: AgentVisualIdentity,
): Promise<void> {
  const imageBuffer = Buffer.from(base64Data, 'base64');

  const resized = await sharp(imageBuffer)
    .resize(TARGET_WIDTH, TARGET_HEIGHT, { fit: 'cover', position: 'top' })
    .jpeg({ quality: 90 })
    .toBuffer();

  const sealSvg = buildSealSvg(identity, TARGET_WIDTH, TARGET_HEIGHT);
  const svgBuffer = Buffer.from(sealSvg);

  await mkdir(dirname(outputPath), { recursive: true });
  await sharp(resized)
    .composite([{ input: svgBuffer, top: 0, left: 0 }])
    .jpeg({ quality: 90 })
    .toFile(outputPath);
}
