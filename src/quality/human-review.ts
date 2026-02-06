/**
 * 사람 검토 케이스 처리 모듈
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

/**
 * 검토 트리거 타입
 */
export type ReviewTrigger =
  | 'score_50_70'       // 점수 50-70% 구간
  | 'sensitive_topic'   // 민감 주제
  | 'new_venue'         // 새 장소 (검증 불가)
  | 'negative_feedback' // 부정적 피드백
  | 'critical_false'    // Critical 클레임 실패
  | 'high_unknown'      // Unknown 비율 높음
  | 'manual_flag';      // 수동 플래그

/**
 * 검토 액션
 */
export type ReviewAction = 'flag' | 'queue' | 'notify' | 'block';

/**
 * 검토 케이스
 */
export interface ReviewCase {
  id: string;
  filePath: string;
  title: string;
  trigger: ReviewTrigger;
  action: ReviewAction;
  score: number;
  details: string;
  createdAt: string;
  status: 'pending' | 'reviewed' | 'approved' | 'rejected';
  reviewedAt?: string;
  reviewerNote?: string;
}

/**
 * 검토 대기열
 */
export interface ReviewQueue {
  cases: ReviewCase[];
  lastUpdated: string;
}

const QUEUE_PATH = 'data/human-review-queue.json';

// 민감 주제 키워드 (여행/문화 블로그에 맞게 조정)
const SENSITIVE_KEYWORDS = [
  // 정치적 (구체적 표현만)
  '정치적 논란', '정부 비판', '정치 갈등',
  // 종교적 갈등
  '종교 갈등', '종교 분쟁',
  // 심각한 안전 이슈
  '심각한 사고', '재난 발생', '폐쇄 조치'
];

/**
 * 대기열 로드
 */
async function loadQueue(): Promise<ReviewQueue> {
  try {
    if (!existsSync(QUEUE_PATH)) {
      return { cases: [], lastUpdated: new Date().toISOString() };
    }

    const content = await readFile(QUEUE_PATH, 'utf-8');
    return JSON.parse(content) as ReviewQueue;
  } catch {
    return { cases: [], lastUpdated: new Date().toISOString() };
  }
}

/**
 * 대기열 저장
 */
async function saveQueue(queue: ReviewQueue): Promise<void> {
  const dir = path.dirname(QUEUE_PATH);

  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }

  queue.lastUpdated = new Date().toISOString();
  await writeFile(QUEUE_PATH, JSON.stringify(queue, null, 2));
}

/**
 * 고유 ID 생성
 */
function generateId(): string {
  return `review-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 민감 주제 검사
 */
export function checkSensitiveTopic(content: string): boolean {
  const normalizedContent = content.toLowerCase();
  return SENSITIVE_KEYWORDS.some(keyword => normalizedContent.includes(keyword));
}

/**
 * 검토 필요 여부 판단
 */
export function needsHumanReview(
  score: number,
  options: {
    hasUnknownClaims?: boolean;
    unknownRatio?: number;
    hasCriticalFalse?: boolean;
    content?: string;
    isNewVenue?: boolean;
  } = {}
): { needed: boolean; trigger: ReviewTrigger | null; action: ReviewAction } {
  // 1. Critical 클레임 실패
  if (options.hasCriticalFalse) {
    return { needed: true, trigger: 'critical_false', action: 'block' };
  }

  // 2. 점수 50-70% 구간
  if (score >= 50 && score < 70) {
    return { needed: true, trigger: 'score_50_70', action: 'queue' };
  }

  // 3. Unknown 비율 높음 (50% 이상)
  if (options.unknownRatio && options.unknownRatio >= 50) {
    return { needed: true, trigger: 'high_unknown', action: 'queue' };
  }

  // 4. 민감 주제
  if (options.content && checkSensitiveTopic(options.content)) {
    return { needed: true, trigger: 'sensitive_topic', action: 'flag' };
  }

  // 5. 새 장소 (검증 불가)
  if (options.isNewVenue) {
    return { needed: true, trigger: 'new_venue', action: 'flag' };
  }

  return { needed: false, trigger: null, action: 'flag' };
}

/**
 * 검토 케이스 추가
 */
export async function addReviewCase(
  filePath: string,
  title: string,
  trigger: ReviewTrigger,
  score: number,
  details: string
): Promise<ReviewCase> {
  const queue = await loadQueue();

  // 이미 같은 파일의 pending 케이스가 있으면 업데이트
  const existingIndex = queue.cases.findIndex(
    c => c.filePath === filePath && c.status === 'pending'
  );

  const action = getActionForTrigger(trigger);

  const newCase: ReviewCase = {
    id: existingIndex >= 0 ? queue.cases[existingIndex].id : generateId(),
    filePath,
    title,
    trigger,
    action,
    score,
    details,
    createdAt: new Date().toISOString(),
    status: 'pending'
  };

  if (existingIndex >= 0) {
    queue.cases[existingIndex] = newCase;
  } else {
    queue.cases.push(newCase);
  }

  await saveQueue(queue);
  return newCase;
}

/**
 * 트리거별 액션 결정
 */
function getActionForTrigger(trigger: ReviewTrigger): ReviewAction {
  switch (trigger) {
    case 'critical_false':
      return 'block';
    case 'score_50_70':
    case 'high_unknown':
      return 'queue';
    case 'sensitive_topic':
    case 'new_venue':
    case 'negative_feedback':
    case 'manual_flag':
    default:
      return 'flag';
  }
}

/**
 * 검토 케이스 상태 업데이트
 */
export async function updateReviewCase(
  caseId: string,
  status: ReviewCase['status'],
  reviewerNote?: string
): Promise<ReviewCase | null> {
  const queue = await loadQueue();

  const caseIndex = queue.cases.findIndex(c => c.id === caseId);
  if (caseIndex < 0) return null;

  queue.cases[caseIndex].status = status;
  queue.cases[caseIndex].reviewedAt = new Date().toISOString();
  if (reviewerNote) {
    queue.cases[caseIndex].reviewerNote = reviewerNote;
  }

  await saveQueue(queue);
  return queue.cases[caseIndex];
}

/**
 * 대기 중인 케이스 목록
 */
export async function getPendingCases(): Promise<ReviewCase[]> {
  const queue = await loadQueue();
  return queue.cases.filter(c => c.status === 'pending');
}

/**
 * 모든 케이스 목록
 */
export async function getAllCases(): Promise<ReviewCase[]> {
  const queue = await loadQueue();
  return queue.cases;
}

/**
 * 특정 파일의 검토 케이스 조회
 */
export async function getCaseByFile(filePath: string): Promise<ReviewCase | null> {
  const queue = await loadQueue();
  return queue.cases.find(c => c.filePath === filePath) || null;
}

/**
 * 오래된 케이스 정리 (30일 이상)
 */
export async function cleanupOldCases(): Promise<number> {
  const queue = await loadQueue();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const originalCount = queue.cases.length;
  queue.cases = queue.cases.filter(c => {
    // Pending은 유지
    if (c.status === 'pending') return true;

    // 검토 완료된 건 30일 후 삭제
    const createdAt = new Date(c.createdAt);
    return createdAt > thirtyDaysAgo;
  });

  const removedCount = originalCount - queue.cases.length;

  if (removedCount > 0) {
    await saveQueue(queue);
  }

  return removedCount;
}
