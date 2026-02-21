/**
 * 5대 궁궐 포스트 인라인 이미지 2장 교체 생성
 * inline-1: 5대 궁궐 비교 다이어그램
 * inline-3: 궁궐별 건축 비교 인포그래픽 + 관람 팁
 */
import { config } from 'dotenv'; config();
import { generateAndSaveImage } from '../src/images/gemini-imagen.js';

const SLUG = '2026-02-20-seoul-five-palaces-spring-tour-guide';
const IMG_DIR = 'blog/static/images';

async function main() {
  // inline-1: 5대 궁궐 비교 다이어그램
  console.log('=== Generating inline-1: 5대 궁궐 비교 다이어그램 ===');
  const result1 = await generateAndSaveImage(
    {
      prompt: `A clean, elegant COMPARISON DIAGRAM of Seoul's Five Grand Palaces (서울 5대 궁궐).

LAYOUT: Top-down view showing five palace floor plans arranged in a row, each simplified to its most iconic architectural feature:
- Gyeongbokgung (경복궁): Straight central axis with Geunjeongjeon hall, emphasizing linear symmetry
- Changdeokgung (창덕궁): Organic layout following mountain contours, with Biwon garden
- Deoksugung (덕수궁): Mixed layout showing Seokjojeon (Western neoclassical) next to Junghwajeon (traditional)
- Changgyeonggung (창경궁): Compact residential layout with greenhouse (대온실) structure
- Gyeonghuigung (경희궁): Sparse layout with only Sungjeongjeon remaining, empty spaces suggesting lost buildings

STYLE: Architectural blueprint aesthetic with Korean traditional ink wash (수묵화) influence. Muted earth tones with subtle gold accents. Clean sans-serif Korean labels for each palace name. Minimal, scholarly, observational tone.

TEXT: Palace names in Korean (경복궁, 창덕궁, 덕수궁, 창경궁, 경희궁) as clean labels. Key feature annotation for each.

ATMOSPHERE: Academic yet warm, like a well-curated museum exhibit panel.`,
      style: 'diagram',
      aspectRatio: '16:9',
      topic: '서울 5대 궁궐 건축 비교',
      personaId: 'informative',
    },
    IMG_DIR,
    `inline-${SLUG}-1.jpeg`
  );
  console.log(result1 ? `OK: ${result1.filename}` : 'FAILED');

  // inline-3: 궁궐별 건축 비교 + 봄 관람 팁 인포그래픽
  console.log('\n=== Generating inline-3: 건축 비교 인포그래픽 ===');
  const result3 = await generateAndSaveImage(
    {
      prompt: `An elegant INFOGRAPHIC comparing architectural styles and spring visit tips for Seoul's Five Grand Palaces.

CONTENT SECTIONS (top to bottom):
1. ARCHITECTURE COMPARISON: Five columns showing key architectural elements
   - 경복궁: Rigid symmetry, straight axis (icon: straight line)
   - 창덕궁: Natural curves following terrain (icon: flowing line)
   - 덕수궁: East meets West collision (icon: column + curved roof)
   - 창경궁: Intimate royal residence (icon: small house)
   - 경희궁: Restoration story (icon: dotted outline of missing buildings)

2. SPRING VIEWING TIMELINE:
   - March: Cherry blossoms at Changgyeonggung
   - April: Fresh green leaves at Changdeokgung Biwon
   - May: Full canopy at Gyeongbokgung night tour

3. PRACTICAL TIPS ROW:
   - Admission fees (1,000원~60,000원 range)
   - Best time of day for each palace
   - Camera settings for night photography

STYLE: Clean Korean editorial design. Warm spring color palette (soft pink, fresh green, cream). Thin line illustrations. Korean text labels. Professional typography. No cheesy clip art.

MOOD: Like a page from a premium travel magazine, scholarly but approachable.`,
      style: 'infographic',
      aspectRatio: '16:9',
      topic: '5대 궁궐 건축 비교 봄 관람 가이드',
      personaId: 'informative',
    },
    IMG_DIR,
    `inline-${SLUG}-3.jpeg`
  );
  console.log(result3 ? `OK: ${result3.filename}` : 'FAILED');

  console.log('\nDone!');
}

main().catch(e => { console.error(e); process.exit(1); });
