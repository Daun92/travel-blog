/**
 * Moltbook 서베이 피드백 수집 스케줄러
 * 서베이 포스트 응답을 주기적으로 수집하고 분석
 */
import { config } from 'dotenv';
config();

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import SurveyInsightsDBManager from '../src/agents/moltbook/survey-insights-db.js';

// ============================================================================
// 설정
// ============================================================================

const CONFIG_DIR = join(process.cwd(), 'config');
const DATA_DIR = join(process.cwd(), 'data/feedback');
const MOLTBOOK_API = 'https://www.moltbook.com/api/v1';

/** 수집 주기 (분) */
const COLLECT_INTERVAL = 30;
/** 최대 수집 횟수 (0=무제한) */
const MAX_CYCLES = 6;
/** 최소 응답 수 - 이 이상이면 조기 완료 가능 */
const MIN_RESPONSES_FOR_EARLY_COMPLETE = 10;

// ============================================================================
// 타입
// ============================================================================

interface MoltbookCredentials {
  api_key: string;
  agent_name: string;
}

interface Comment {
  id: string;
  content: string;
  author: { name: string };
  upvotes: number;
  created_at: string;
}

interface SurveyResponse {
  commentId: string;
  author: string;
  content: string;
  upvotes: number;
  createdAt: string;
  parsed: {
    topics: number[];       // 1~8 선택
    format: string[];       // A~D 선택
    regions: string[];      // 언급된 지역
    freeText: string;       // 자유 의견
  };
}

interface SurveyResult {
  postId: string;
  title: string;
  totalResponses: number;
  postUpvotes: number;
  postDownvotes: number;
  lastCollected: string;
  collectCycle: number;
  responses: SurveyResponse[];
  aggregated: {
    topicVotes: Record<string, number>;
    formatVotes: Record<string, number>;
    regionMentions: Record<string, number>;
    freeTexts: string[];
  };
  recommendations: string[];
}

// ============================================================================
// 서베이 응답 파서
// ============================================================================

const TOPIC_MAP: Record<number, string> = {
  1: '미술관/갤러리 전시 리뷰',
  2: '뮤지컬/연극/공연 추천',
  3: '독립서점/북카페 탐방',
  4: '전통문화 체험',
  5: '인디 음악/페스티벌',
  6: '영화제/독립영화관',
  7: '문화예술 워크숍/클래스',
  8: '도시 벽화/스트릿아트'
};

const FORMAT_MAP: Record<string, string> = {
  'A': '깊이 있는 단일 주제 리뷰',
  'B': '베스트 N 큐레이션',
  'C': '루트형 코스 가이드',
  'D': '비교 분석'
};

const REGION_KEYWORDS = [
  '서울', '종로', '인사동', '한남동', '성수', '이태원', '홍대', '망원', '연남',
  '파주', '양평', '인천', '수원',
  '부산', '대구', '광주', '대전', '울산',
  '강릉', '전주', '경주', '여수', '제주', '속초', '춘천', '안동',
  '도쿄', '교토', '파리', '런던', '뉴욕', '베를린'
];

function parseSurveyComment(comment: Comment): SurveyResponse {
  const content = comment.content;

  // 1. 주제 번호 추출 (1~8)
  const topicNumbers: number[] = [];
  const topicMatch = content.match(/[1-8]/g);
  if (topicMatch) {
    for (const num of topicMatch) {
      const n = parseInt(num);
      if (n >= 1 && n <= 8 && !topicNumbers.includes(n)) {
        topicNumbers.push(n);
      }
    }
  }

  // 2. 형식 선택 추출 (A~D)
  const formats: string[] = [];
  const formatMatch = content.toUpperCase().match(/[A-D]/g);
  if (formatMatch) {
    for (const f of formatMatch) {
      if (!formats.includes(f)) {
        formats.push(f);
      }
    }
  }

  // 3. 지역 추출
  const regions: string[] = [];
  for (const region of REGION_KEYWORDS) {
    if (content.includes(region) && !regions.includes(region)) {
      regions.push(region);
    }
  }

  // 4. 자유 의견 (번호/알파벳 선택 외 텍스트)
  let freeText = content
    .replace(/[1-8][),.\s]*/g, '')
    .replace(/[A-Da-d][),.\s]*/g, '')
    .replace(/[/,]/g, ' ')
    .trim();
  // 30자 이상인 경우만 유의미한 자유 의견으로 처리
  if (freeText.length < 10) freeText = '';

  return {
    commentId: comment.id,
    author: comment.author?.name || 'anonymous',
    content: comment.content,
    upvotes: comment.upvotes || 0,
    createdAt: comment.created_at,
    parsed: {
      topics: topicNumbers,
      format: formats,
      regions,
      freeText
    }
  };
}

// ============================================================================
// 집계 & 분석
// ============================================================================

function aggregateResponses(responses: SurveyResponse[]): SurveyResult['aggregated'] {
  const topicVotes: Record<string, number> = {};
  const formatVotes: Record<string, number> = {};
  const regionMentions: Record<string, number> = {};
  const freeTexts: string[] = [];

  // 초기화
  for (const [num, label] of Object.entries(TOPIC_MAP)) {
    topicVotes[`${num}. ${label}`] = 0;
  }
  for (const [key, label] of Object.entries(FORMAT_MAP)) {
    formatVotes[`${key}. ${label}`] = 0;
  }

  for (const resp of responses) {
    // 주제 집계 (upvote 가중치 적용)
    const weight = 1 + (resp.upvotes * 0.5);
    for (const topicNum of resp.parsed.topics) {
      const label = `${topicNum}. ${TOPIC_MAP[topicNum]}`;
      topicVotes[label] = (topicVotes[label] || 0) + weight;
    }

    // 형식 집계
    for (const fmt of resp.parsed.format) {
      const label = `${fmt}. ${FORMAT_MAP[fmt]}`;
      formatVotes[label] = (formatVotes[label] || 0) + weight;
    }

    // 지역 집계
    for (const region of resp.parsed.regions) {
      regionMentions[region] = (regionMentions[region] || 0) + weight;
    }

    // 자유 의견
    if (resp.parsed.freeText) {
      freeTexts.push(`[${resp.author}] ${resp.parsed.freeText}`);
    }
  }

  return { topicVotes, formatVotes, regionMentions, freeTexts };
}

function generateRecommendations(aggregated: SurveyResult['aggregated'], totalResponses: number): string[] {
  const recs: string[] = [];

  if (totalResponses === 0) {
    recs.push('아직 응답이 없습니다. 추가 홍보가 필요합니다.');
    return recs;
  }

  // TOP 3 주제
  const topTopics = Object.entries(aggregated.topicVotes)
    .sort((a, b) => b[1] - a[1])
    .filter(([, v]) => v > 0)
    .slice(0, 3);

  if (topTopics.length > 0) {
    recs.push(`인기 주제 TOP 3: ${topTopics.map(([t]) => t).join(', ')}`);
  }

  // TOP 형식
  const topFormat = Object.entries(aggregated.formatVotes)
    .sort((a, b) => b[1] - a[1])
    .filter(([, v]) => v > 0)
    .slice(0, 2);

  if (topFormat.length > 0) {
    recs.push(`선호 콘텐츠 형식: ${topFormat.map(([f]) => f).join(', ')}`);
  }

  // TOP 지역
  const topRegions = Object.entries(aggregated.regionMentions)
    .sort((a, b) => b[1] - a[1])
    .filter(([, v]) => v > 0)
    .slice(0, 5);

  if (topRegions.length > 0) {
    recs.push(`관심 지역: ${topRegions.map(([r]) => r).join(', ')}`);
  }

  // 자유 의견 요약
  if (aggregated.freeTexts.length > 0) {
    recs.push(`자유 의견 ${aggregated.freeTexts.length}건 수집됨`);
  }

  return recs;
}

// ============================================================================
// Moltbook API 호출
// ============================================================================

async function fetchPostData(postId: string, apiKey: string): Promise<{
  upvotes: number;
  downvotes: number;
} | null> {
  try {
    const resp = await fetch(`${MOLTBOOK_API}/posts/${postId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    if (!resp.ok) return null;
    const data = await resp.json() as { post: { upvotes: number; downvotes: number } };
    return { upvotes: data.post.upvotes, downvotes: data.post.downvotes };
  } catch {
    return null;
  }
}

async function fetchComments(postId: string, apiKey: string): Promise<Comment[]> {
  try {
    const resp = await fetch(`${MOLTBOOK_API}/posts/${postId}/comments?sort=top`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    if (!resp.ok) return [];
    const data = await resp.json() as { comments: Comment[] };
    return data.comments || [];
  } catch {
    return [];
  }
}

// ============================================================================
// 리포트 출력
// ============================================================================

function printReport(result: SurveyResult) {
  console.log('\n' + '═'.repeat(55));
  console.log('  📊 서베이 피드백 분석 리포트');
  console.log('═'.repeat(55));

  console.log(`\n📌 포스트: ${result.title}`);
  console.log(`   Upvotes: ${result.postUpvotes} | Downvotes: ${result.postDownvotes}`);
  console.log(`   총 응답: ${result.totalResponses}건 | 수집 사이클: ${result.collectCycle}`);
  console.log(`   마지막 수집: ${new Date(result.lastCollected).toLocaleString('ko-KR')}`);

  // 주제 투표
  console.log('\n🎨 관심 문화예술 분야 (투표 순)');
  console.log('─'.repeat(45));
  const sortedTopics = Object.entries(result.aggregated.topicVotes)
    .sort((a, b) => b[1] - a[1]);
  for (const [topic, votes] of sortedTopics) {
    const bar = '█'.repeat(Math.round(votes));
    const display = votes > 0 ? `${bar} ${votes.toFixed(1)}` : '-';
    console.log(`  ${topic.padEnd(28)} ${display}`);
  }

  // 형식 투표
  console.log('\n📝 선호 콘텐츠 형식');
  console.log('─'.repeat(45));
  const sortedFormats = Object.entries(result.aggregated.formatVotes)
    .sort((a, b) => b[1] - a[1]);
  for (const [fmt, votes] of sortedFormats) {
    const bar = '█'.repeat(Math.round(votes));
    const display = votes > 0 ? `${bar} ${votes.toFixed(1)}` : '-';
    console.log(`  ${fmt.padEnd(28)} ${display}`);
  }

  // 지역 언급
  if (Object.keys(result.aggregated.regionMentions).length > 0) {
    console.log('\n📍 관심 지역');
    console.log('─'.repeat(45));
    const sortedRegions = Object.entries(result.aggregated.regionMentions)
      .sort((a, b) => b[1] - a[1]);
    for (const [region, count] of sortedRegions) {
      console.log(`  ${region}: ${count.toFixed(1)}회 언급`);
    }
  }

  // 자유 의견
  if (result.aggregated.freeTexts.length > 0) {
    console.log('\n💬 자유 의견');
    console.log('─'.repeat(45));
    for (const text of result.aggregated.freeTexts.slice(0, 10)) {
      console.log(`  • ${text.substring(0, 80)}`);
    }
  }

  // 추천 사항
  console.log('\n🎯 추천 사항');
  console.log('─'.repeat(45));
  for (const rec of result.recommendations) {
    console.log(`  → ${rec}`);
  }

  console.log('\n' + '═'.repeat(55));
}

// ============================================================================
// 결과 저장
// ============================================================================

async function saveResult(result: SurveyResult): Promise<void> {
  const filepath = join(DATA_DIR, 'survey-result.json');
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(filepath, JSON.stringify(result, null, 2));
}

// ============================================================================
// 메인 스케줄러
// ============================================================================

async function sleep(minutes: number) {
  const endTime = new Date(Date.now() + minutes * 60 * 1000);
  console.log(`\n⏳ ${minutes}분 대기 중... (다음: ${endTime.toLocaleTimeString('ko-KR')})`);

  const checkInterval = 5; // 5분마다 상태 출력
  const intervals = Math.floor(minutes / checkInterval);

  for (let i = 0; i < intervals; i++) {
    await new Promise(resolve => setTimeout(resolve, checkInterval * 60 * 1000));
    const remaining = minutes - (i + 1) * checkInterval;
    if (remaining > 0) {
      console.log(`  ⏱️  ${remaining}분 남음...`);
    }
  }

  const remainingMs = (minutes % checkInterval) * 60 * 1000;
  if (remainingMs > 0) {
    await new Promise(resolve => setTimeout(resolve, remainingMs));
  }
}

async function main() {
  console.log('🎨 Moltbook 서베이 피드백 수집 스케줄러');
  console.log('━'.repeat(50));
  console.log(`  수집 주기: ${COLLECT_INTERVAL}분`);
  console.log(`  최대 사이클: ${MAX_CYCLES === 0 ? '무제한' : MAX_CYCLES + '회'}`);
  console.log(`  조기 완료 기준: ${MIN_RESPONSES_FOR_EARLY_COMPLETE}건 이상`);
  console.log('  중지: Ctrl+C');
  console.log('━'.repeat(50));

  // 1. 인증 정보 & 서베이 기록 로드
  const cred: MoltbookCredentials = JSON.parse(
    await readFile(join(CONFIG_DIR, 'moltbook-credentials.json'), 'utf-8')
  );

  const surveyRecords = JSON.parse(
    await readFile(join(DATA_DIR, 'survey-records.json'), 'utf-8')
  );

  const latestSurvey = surveyRecords[surveyRecords.length - 1];
  if (!latestSurvey) {
    console.error('\n❌ 서베이 기록이 없습니다. 먼저 서베이를 발행하세요.');
    process.exit(1);
  }

  const postId = latestSurvey.postId;
  console.log(`\n📌 대상 서베이: ${latestSurvey.title}`);
  console.log(`   Post ID: ${postId}`);
  console.log(`   발행일: ${new Date(latestSurvey.createdAt).toLocaleString('ko-KR')}\n`);

  // 2. 수집 루프
  let cycle = 0;
  const seenCommentIds = new Set<string>();
  let result: SurveyResult = {
    postId,
    title: latestSurvey.title,
    totalResponses: 0,
    postUpvotes: 0,
    postDownvotes: 0,
    lastCollected: '',
    collectCycle: 0,
    responses: [],
    aggregated: { topicVotes: {}, formatVotes: {}, regionMentions: {}, freeTexts: [] },
    recommendations: []
  };

  while (MAX_CYCLES === 0 || cycle < MAX_CYCLES) {
    cycle++;
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`  🔄 수집 사이클 ${cycle}/${MAX_CYCLES || '∞'}`);
    console.log(`  ${new Date().toLocaleString('ko-KR')}`);
    console.log(`${'─'.repeat(50)}`);

    // 포스트 상태 조회
    const postData = await fetchPostData(postId, cred.api_key);
    if (postData) {
      result.postUpvotes = postData.upvotes;
      result.postDownvotes = postData.downvotes;
      console.log(`\n  📈 포스트 상태: ⬆ ${postData.upvotes} / ⬇ ${postData.downvotes}`);
    }

    // 댓글 수집
    const comments = await fetchComments(postId, cred.api_key);
    const newComments = comments.filter(c => !seenCommentIds.has(c.id));
    console.log(`  💬 댓글: 전체 ${comments.length}건 (신규 ${newComments.length}건)`);

    // 신규 응답 파싱
    for (const comment of newComments) {
      seenCommentIds.add(comment.id);
      const parsed = parseSurveyComment(comment);
      result.responses.push(parsed);

      // 파싱 결과 출력
      const topicsStr = parsed.parsed.topics.length > 0
        ? parsed.parsed.topics.map(t => TOPIC_MAP[t]).join(', ')
        : '-';
      const formatsStr = parsed.parsed.format.length > 0
        ? parsed.parsed.format.map(f => FORMAT_MAP[f]).join(', ')
        : '-';

      console.log(`\n  📩 [${parsed.author}]`);
      console.log(`     주제: ${topicsStr}`);
      console.log(`     형식: ${formatsStr}`);
      if (parsed.parsed.regions.length > 0) {
        console.log(`     지역: ${parsed.parsed.regions.join(', ')}`);
      }
      if (parsed.parsed.freeText) {
        console.log(`     의견: ${parsed.parsed.freeText.substring(0, 60)}`);
      }
    }

    // 집계 업데이트
    result.totalResponses = result.responses.length;
    result.lastCollected = new Date().toISOString();
    result.collectCycle = cycle;
    result.aggregated = aggregateResponses(result.responses);
    result.recommendations = generateRecommendations(result.aggregated, result.totalResponses);

    // 중간 리포트
    printReport(result);

    // 결과 저장
    await saveResult(result);
    console.log('\n  💾 결과 저장: data/feedback/survey-result.json');

    // 서베이 인사이트 DB 자동 갱신
    try {
      const surveyDb = new SurveyInsightsDBManager();
      await surveyDb.load();
      const { ingested } = await surveyDb.ingestFromFiles();
      if (ingested > 0) {
        console.log('  📊 서베이 인사이트 DB 갱신 완료');
      }
    } catch {
      // DB 갱신 실패해도 스케줄러는 계속 동작
    }

    // 조기 완료 체크
    if (result.totalResponses >= MIN_RESPONSES_FOR_EARLY_COMPLETE) {
      console.log(`\n🎉 충분한 응답 수집 (${result.totalResponses}건) - 스케줄러 완료!`);
      break;
    }

    // 마지막 사이클이면 종료
    if (MAX_CYCLES > 0 && cycle >= MAX_CYCLES) {
      console.log(`\n📋 최대 사이클(${MAX_CYCLES}) 도달 - 스케줄러 완료`);
      break;
    }

    // 대기
    await sleep(COLLECT_INTERVAL);
  }

  // 최종 리포트
  console.log('\n\n' + '═'.repeat(55));
  console.log('  🏁 최종 서베이 수집 결과');
  console.log('═'.repeat(55));
  printReport(result);

  // content-strategy.json 업데이트 제안
  if (result.totalResponses > 0) {
    console.log('\n💡 다음 단계:');
    console.log('  1. npm run moltbook:analyze  - 전략 업데이트');
    console.log('  2. 인기 주제 기반 콘텐츠 생성');
    console.log('  3. npm run new -- -t "주제" --type culture');
  }
}

// 종료 핸들러
process.on('SIGINT', async () => {
  console.log('\n\n🛑 스케줄러 수동 종료');
  console.log('💾 마지막 결과는 data/feedback/survey-result.json 에 저장되어 있습니다.');
  process.exit(0);
});

main().catch(console.error);
