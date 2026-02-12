/**
 * 2월 9일 문화 포스트 2건 이미지 보강 스크립트
 * - KTO 실사진 (data.go.kr) → 커버/인라인
 * - Gemini AI → 추가 인라인 이미지
 */

import { config } from 'dotenv';
config();

import { getDataGoKrClient } from '../src/api/data-go-kr/index.js';
import { downloadKtoImage, type KtoImageCandidate } from '../src/images/kto-images.js';
import { GeminiImageClient, saveImage, type ImageStyle } from '../src/images/gemini-imagen.js';

const OUTPUT_DIR = 'blog/static/images';
const BASE_URL = '/travel-blog/images';
const DELAY_MS = 3000;

// ─── KTO 검색 키워드 목록 ──────────────────────────────────
const KTO_SEARCHES = [
  { keyword: '성수동', label: '성수동 커버용' },
  { keyword: '문래창작촌', label: '문래동 인라인' },
  { keyword: '리움미술관', label: '한남동 인라인' },
  { keyword: '서촌', label: '서촌 인라인', contentTypeId: '12' },
  { keyword: '세운상가', label: '을지로 인라인' },
  { keyword: '신당동', label: '신당동 인라인' },
  { keyword: '국립현대미술관', label: '미술관 인라인' },
];

// ─── Gemini 추가 이미지 계획 ────────────────────────────────
interface GeminiPlan {
  filename: string;
  style: ImageStyle;
  alt: string;
  prompt: string;
  forPost: 'post' | 'top5';
}

const GEMINI_PLANS: GeminiPlan[] = [
  // Post 1: 성수동은 왜 떴나 (김주말) — 현재 2개 → 3개로
  {
    filename: 'inline-seongsu-popup-scene',
    style: 'moodboard',
    alt: '성수동 팝업스토어 현실 — 웨이팅 80분 vs 관람 5분',
    prompt: `성수동 팝업 스토어 현실 무드보드 (Urban Sketch Style)

[성수동의 빛과 그림자]

중앙: 공장 개조 건물에 긴 줄 서 있는 사람들 일러스트
주변 요소:
- 붉은 벽돌 공장 건물 + 네온사인
- "WAITING 80분" 표지판
- 7,500원 커피 영수증
- SNS 셀카 찍는 사람들 실루엣
- 빈티지 철문 + 현대 조명 대비
- 빈 좌석 없는 카페 테라스

컬러 팔레트:
- 벽돌 레드, 콘크리트 그레이
- 네온 핑크, 따뜻한 조명 오렌지
- 인더스트리얼 블랙

감성 키워드: "현타 오는 순간" "80분 대기 5분 관람" "주말 물가"

Pinterest collage, industrial chic aesthetic, realistic urban mood, Korean text clearly readable.`,
    forPost: 'post',
  },

  // Post 2: 성수동 다음 TOP 5 (조회영) — 현재 3개 → 5개로
  {
    filename: 'inline-mullae-art-scene',
    style: 'infographic',
    alt: '문래창작촌 — 철공소와 예술의 공존',
    prompt: `문래창작촌 핵심 가이드 (Art Gallery Card Style)

[문래동 창작촌 — 날것의 예술]

📍 위치: 영등포구 문래동 (문래역 7번 출구)

🎨 핵심 포인트
① 철공소 골목 사이 숨겨진 갤러리
   "쇠 깎는 소리가 BGM"
② 대안공간 밀집 지역
   "입구를 못 찾겠으면 제대로 온 것"
③ 주말 야간 오픈 스튜디오
   "작가와 직접 대화 가능"

⚠️ 현실 정보
- 낮: 철공소 가동 중 (소음 + 기름냄새)
- 밤: 골목에 숨겨진 갤러리 불빛
- 가격: 무료 전시 다수

💡 vs 성수동
성수동: 세련, 상업적, 대기업 팝업
문래동: 날것, 실험적, 독립 예술

Clean editorial layout, industrial texture, welding spark accents, Korean text clearly readable.`,
    forPost: 'top5',
  },
  {
    filename: 'inline-euljiro-hidden-gallery',
    style: 'diagram',
    alt: '을지로 숨겨진 갤러리 탐방 루트',
    prompt: `을지로 숨겨진 갤러리 탐방 루트 (Treasure Map Style)

[을지로 비밀 갤러리 루트]

🚇 을지로3가역 출발

도보 3분 ↓
① 세운상가 옥상 — 전망 + 갤러리
   "서울 도심 뷰 포인트"

도보 5분 ↓
② 을지로 뒷골목 4층 갤러리
   "엘리베이터 없음, 계단 올라가야 함"
   "문 열면 화이트 큐브 반전"

도보 7분 ↓
③ 산림동 독립 전시 공간
   "아는 사람만 아는 곳"

도보 3분 ↓
④ 노가리 골목 옆 카페 갤러리
   "맥주 한 잔과 현대 미술"

[핵심 팁]
🔍 "낡은 빌딩 4~5층을 의심하라"
📱 인스타 #을지로갤러리 태그 검색

Treasure map aesthetic, building cross-sections, winding alley paths, Korean labels, vintage building illustrations.`,
    forPost: 'top5',
  },
];

// ─── 메인 실행 ──────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════');
  console.log('  2월 9일 문화 포스트 이미지 보강');
  console.log('═══════════════════════════════════════\n');

  const dryRun = process.argv.includes('--dry-run');

  // ── Phase 1: KTO 실사진 검색 + 다운로드 ──
  console.log('📸 Phase 1: KTO 실사진 검색\n');

  const client = getDataGoKrClient();
  const ktoResults: Array<{ label: string; candidate: KtoImageCandidate }> = [];

  for (const search of KTO_SEARCHES) {
    console.log(`  🔍 "${search.keyword}" 검색...`);
    try {
      const results = await client.searchKeyword(search.keyword, {
        numOfRows: 5,
        contentTypeId: search.contentTypeId,
      });

      const withImage = results.filter((r: any) => r.firstimage);
      if (withImage.length > 0) {
        const best = withImage[0];
        console.log(`  ✓ ${best.title} — 이미지 발견`);
        ktoResults.push({
          label: search.label,
          candidate: {
            url: (best as any).firstimage,
            title: best.title,
            source: 'firstimage',
            contentId: best.contentid,
          },
        });

        // detailImage로 갤러리 이미지도 확인
        if (best.contentid) {
          try {
            const gallery = await client.detailImage(best.contentid, { numOfRows: 3 });
            for (const img of gallery) {
              if ((img as any).originimgurl) {
                ktoResults.push({
                  label: `${search.label} (갤러리)`,
                  candidate: {
                    url: (img as any).originimgurl,
                    title: `${best.title} 갤러리`,
                    source: 'gallery',
                    contentId: best.contentid,
                  },
                });
              }
            }
          } catch { /* 갤러리 없으면 무시 */ }
        }
      } else {
        console.log(`  ✗ 이미지 없음`);
      }
    } catch (err: any) {
      console.log(`  ✗ 검색 실패: ${err.message}`);
    }
  }

  console.log(`\n  총 ${ktoResults.length}개 KTO 이미지 후보 발견\n`);

  // KTO 이미지 다운로드
  const downloadedKto: Array<{ label: string; path: string; alt: string }> = [];

  if (!dryRun && ktoResults.length > 0) {
    console.log('  📥 KTO 이미지 다운로드...\n');
    for (let i = 0; i < ktoResults.length; i++) {
      const { label, candidate } = ktoResults[i];
      const slug = label.replace(/[^a-z가-힣0-9]/gi, '-').toLowerCase();
      const result = await downloadKtoImage(candidate, OUTPUT_DIR, `feb09-${slug}`, i);
      if (result) {
        downloadedKto.push({ label, path: result.relativePath, alt: result.alt });
        console.log(`  ✓ [${label}] ${result.relativePath}`);
      }
    }
  } else if (dryRun) {
    for (const { label, candidate } of ktoResults) {
      console.log(`  [DRY] ${label}: ${candidate.url.substring(0, 80)}...`);
    }
  }

  // ── Phase 2: Gemini AI 인라인 이미지 생성 ──
  console.log('\n🎨 Phase 2: Gemini AI 이미지 생성\n');

  const gemini = new GeminiImageClient();
  if (!gemini.isConfigured() || !gemini.isEnabled()) {
    console.error('  ✗ GEMINI_API_KEY / GEMINI_IMAGE_ENABLED=true 필요');
    process.exit(1);
  }

  const usage = await gemini.getDailyUsage();
  console.log(`  일일 사용량: ${usage}/50`);
  console.log(`  생성 예정: ${GEMINI_PLANS.length}개\n`);

  const generatedGemini: Array<{ plan: GeminiPlan; path: string }> = [];

  for (let i = 0; i < GEMINI_PLANS.length; i++) {
    const plan = GEMINI_PLANS[i];
    console.log(`  [${i + 1}/${GEMINI_PLANS.length}] ${plan.style}: ${plan.alt}`);

    if (dryRun) {
      console.log(`  [DRY] → ${BASE_URL}/${plan.filename}.jpeg`);
      continue;
    }

    try {
      const result = await gemini.generateImage({
        prompt: plan.prompt,
        style: plan.style,
        aspectRatio: '16:9',
        topic: plan.alt,
      });

      const saved = await saveImage(result, OUTPUT_DIR, plan.filename);
      console.log(`  ✓ 저장: ${saved.relativePath}`);
      generatedGemini.push({ plan, path: saved.relativePath });

      if (i < GEMINI_PLANS.length - 1) {
        console.log(`  ⏳ ${DELAY_MS / 1000}초 대기...`);
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      }
    } catch (err: any) {
      console.error(`  ✗ 실패: ${err.message}`);
    }
  }

  // ── 결과 요약 ──
  console.log(`\n${'═'.repeat(50)}`);
  console.log('  결과 요약');
  console.log(`${'═'.repeat(50)}`);
  console.log(`  KTO 이미지: ${downloadedKto.length}개 다운로드`);
  for (const d of downloadedKto) {
    console.log(`    - [${d.label}] ${d.path}`);
  }
  console.log(`  Gemini 이미지: ${generatedGemini.length}개 생성`);
  for (const g of generatedGemini) {
    console.log(`    - [${g.plan.forPost}] ${g.path}`);
  }
  console.log(`${'═'.repeat(50)}\n`);

  if (!dryRun) {
    console.log('💡 다음 단계:');
    console.log('   1. KTO 이미지 중 커버로 쓸 것을 선택하여 frontmatter cover.image 교체');
    console.log('   2. Gemini 이미지를 포스트 본문에 삽입');
    console.log('   3. blog repo에 커밋 + 푸시');
  }
}

main().catch(err => {
  console.error('치명적 오류:', err);
  process.exit(1);
});
