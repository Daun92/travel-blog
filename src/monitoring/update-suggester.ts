/**
 * 콘텐츠 업데이트 제안기
 * 오래된 콘텐츠에 대한 구체적인 업데이트 전략 제안
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import matter from 'gray-matter';
import { FreshnessAnalysis } from './freshness-checker.js';
import { PostPerformance } from './performance-tracker.js';

// ============================================================================
// 타입 정의
// ============================================================================

export interface SectionUpdate {
  section: string;
  action: 'update' | 'add' | 'remove' | 'rewrite';
  reason: string;
  suggestion: string;
}

export interface UpdatePlan {
  postPath: string;
  title: string;
  updateType: 'refresh' | 'expand' | 'rewrite' | 'archive';
  estimatedEffort: 'low' | 'medium' | 'high';
  sections: SectionUpdate[];
  reshareStrategy?: ReshareStrategy;
  priority: number;  // 1-10
  expectedImpact: 'high' | 'medium' | 'low';
  generatedAt: string;
}

export interface ReshareStrategy {
  recommended: boolean;
  platform: 'moltbook' | 'all';
  timing: 'immediate' | 'after_update' | 'seasonal';
  newAngle?: string;
  suggestedTitle?: string;
}

export interface UpdateQueue {
  plans: UpdatePlan[];
  lastUpdated: string;
}

// ============================================================================
// 설정
// ============================================================================

const DATA_DIR = join(process.cwd(), 'data/monitoring');
const UPDATE_QUEUE_PATH = join(DATA_DIR, 'update-queue.json');
const BLOG_POSTS_DIR = join(process.cwd(), 'blog/content/posts');

// ============================================================================
// 업데이트 제안기
// ============================================================================

export class UpdateSuggester {
  private updateQueue: UpdatePlan[] = [];

  /**
   * 데이터 로드
   */
  async load(): Promise<void> {
    try {
      if (existsSync(UPDATE_QUEUE_PATH)) {
        const content = await readFile(UPDATE_QUEUE_PATH, 'utf-8');
        const data = JSON.parse(content) as UpdateQueue;
        this.updateQueue = data.plans || [];
      }
    } catch (error) {
      console.log(`⚠️ 업데이트 큐 로드 실패: ${error}`);
    }
  }

  /**
   * 데이터 저장
   */
  async save(): Promise<void> {
    await mkdir(DATA_DIR, { recursive: true });
    const data: UpdateQueue = {
      plans: this.updateQueue,
      lastUpdated: new Date().toISOString()
    };
    await writeFile(UPDATE_QUEUE_PATH, JSON.stringify(data, null, 2));
  }

  /**
   * 업데이트 계획 생성
   */
  async generateUpdatePlan(
    freshness: FreshnessAnalysis,
    performance?: PostPerformance
  ): Promise<UpdatePlan> {
    const absolutePath = freshness.postPath.startsWith(BLOG_POSTS_DIR)
      ? freshness.postPath
      : join(BLOG_POSTS_DIR, freshness.postPath);

    // 포스트 내용 읽기
    const content = await readFile(absolutePath, 'utf-8');
    const { data: frontmatter, content: body } = matter(content);

    // 업데이트 유형 결정
    const updateType = this.determineUpdateType(freshness, performance);

    // 섹션별 업데이트 제안
    const sections = this.analyzeSections(body, freshness, performance);

    // 노력 추정
    const estimatedEffort = this.estimateEffort(updateType, sections);

    // 재공유 전략
    const reshareStrategy = this.generateReshareStrategy(freshness, performance);

    // 우선순위 계산
    const priority = this.calculatePriority(freshness, performance);

    // 예상 효과
    const expectedImpact = this.predictImpact(freshness, sections, performance);

    const plan: UpdatePlan = {
      postPath: freshness.postPath,
      title: freshness.title,
      updateType,
      estimatedEffort,
      sections,
      reshareStrategy,
      priority,
      expectedImpact,
      generatedAt: new Date().toISOString()
    };

    // 큐에 추가 (중복 제거)
    this.updateQueue = this.updateQueue.filter(p => p.postPath !== plan.postPath);
    this.updateQueue.push(plan);
    this.updateQueue.sort((a, b) => b.priority - a.priority);

    await this.save();

    return plan;
  }

  /**
   * 업데이트 유형 결정
   */
  private determineUpdateType(
    freshness: FreshnessAnalysis,
    performance?: PostPerformance
  ): UpdatePlan['updateType'] {
    // 너무 오래되고 성과도 낮으면 아카이브 고려
    if (freshness.daysSincePublish > 365 && performance && performance.score < 20) {
      return 'archive';
    }

    // 심각하게 오래됨 또는 긴급 이슈 → 다시 쓰기
    if (freshness.priority === 'urgent' || freshness.freshnessScore < 30) {
      return 'rewrite';
    }

    // 신선도 낮음 → 새로고침
    if (freshness.freshnessScore < 60) {
      return 'refresh';
    }

    // 성과 좋음 + 약간 오래됨 → 확장
    if (performance && performance.score >= 60) {
      return 'expand';
    }

    return 'refresh';
  }

  /**
   * 섹션 분석 및 업데이트 제안
   */
  private analyzeSections(
    content: string,
    freshness: FreshnessAnalysis,
    performance?: PostPerformance
  ): SectionUpdate[] {
    const sections: SectionUpdate[] = [];

    // 헤딩 추출
    const headings = content.match(/^#{2,3}\s+.+$/gm) || [];

    // 각 지표에 따른 섹션 업데이트 제안
    for (const indicator of freshness.outdatedIndicators) {
      switch (indicator.type) {
        case 'price_changed':
          sections.push({
            section: '가격/비용 정보',
            action: 'update',
            reason: indicator.message,
            suggestion: '최신 가격 정보를 확인하고 업데이트하세요. 가격 변동 날짜도 명시하면 좋습니다.'
          });
          break;

        case 'event_ended':
          sections.push({
            section: '이벤트/행사 정보',
            action: 'update',
            reason: indicator.message,
            suggestion: '이벤트가 종료되었다면 해당 섹션을 "과거 행사"로 수정하거나, 새로운 행사 정보로 교체하세요.'
          });
          break;

        case 'seasonal_mismatch':
          sections.push({
            section: '시즌 관련 내용',
            action: 'add',
            reason: indicator.message,
            suggestion: `현재 시즌에 맞는 정보를 추가하세요. 예: "겨울에는..." 또는 "봄에는..." 섹션 추가`
          });
          break;

        case 'old_date':
          sections.push({
            section: '전체 콘텐츠',
            action: 'rewrite',
            reason: indicator.message,
            suggestion: '전체 내용을 검토하고 오래된 정보를 최신화하세요.'
          });
          break;
      }
    }

    // 성과 기반 추가 제안
    if (performance) {
      if (performance.engagement.moltbookComments > 3) {
        // 댓글이 많으면 FAQ 섹션 추가 제안
        sections.push({
          section: 'FAQ 섹션',
          action: 'add',
          reason: '커뮤니티에서 질문이 많습니다.',
          suggestion: '자주 묻는 질문을 정리한 FAQ 섹션을 추가하세요.'
        });
      }

      if (performance.metrics.avgTimeOnPage < 60) {
        // 체류 시간이 짧으면 콘텐츠 보강
        sections.push({
          section: '본문 콘텐츠',
          action: 'add',
          reason: '체류 시간이 짧습니다.',
          suggestion: '이미지, 지도, 팁 박스 등 시각적 요소를 추가하여 콘텐츠를 풍성하게 만드세요.'
        });
      }
    }

    return sections;
  }

  /**
   * 노력 추정
   */
  private estimateEffort(
    updateType: UpdatePlan['updateType'],
    sections: SectionUpdate[]
  ): 'low' | 'medium' | 'high' {
    if (updateType === 'rewrite' || updateType === 'archive') {
      return 'high';
    }

    const rewriteSections = sections.filter(s => s.action === 'rewrite').length;
    const addSections = sections.filter(s => s.action === 'add').length;

    if (rewriteSections >= 2 || addSections >= 3) {
      return 'high';
    }

    if (rewriteSections >= 1 || addSections >= 2) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * 재공유 전략 생성
   */
  private generateReshareStrategy(
    freshness: FreshnessAnalysis,
    performance?: PostPerformance
  ): ReshareStrategy {
    // 성과가 좋았던 포스트는 재공유 추천
    const wasSuccessful = performance && performance.score >= 60;

    // 시즌 관련 콘텐츠인지 확인
    const isSeasonal = freshness.outdatedIndicators.some(
      i => i.type === 'seasonal_mismatch'
    );

    if (wasSuccessful) {
      return {
        recommended: true,
        platform: 'moltbook',
        timing: 'after_update',
        newAngle: this.suggestNewAngle(freshness),
        suggestedTitle: this.suggestNewTitle(freshness)
      };
    }

    if (isSeasonal) {
      return {
        recommended: true,
        platform: 'moltbook',
        timing: 'seasonal',
        newAngle: '시즌 특집으로 재포장',
        suggestedTitle: `[${this.getCurrentSeason()} 특집] ${freshness.title}`
      };
    }

    return {
      recommended: false,
      platform: 'moltbook',
      timing: 'after_update'
    };
  }

  /**
   * 새로운 앵글 제안
   */
  private suggestNewAngle(freshness: FreshnessAnalysis): string {
    const angles = [
      '최신 업데이트 버전',
      '2024년 완벽 정리',
      '현지인 추천 추가',
      '숨은 꿀팁 대방출',
      '비용 절약 버전'
    ];

    return angles[Math.floor(Math.random() * angles.length)];
  }

  /**
   * 새로운 제목 제안
   */
  private suggestNewTitle(freshness: FreshnessAnalysis): string {
    const title = freshness.title;
    const year = new Date().getFullYear();

    // 연도 추가
    if (!title.includes(String(year))) {
      return `[${year}] ${title}`;
    }

    // 업데이트 표시
    return `${title} (최신 업데이트)`;
  }

  /**
   * 현재 시즌
   */
  private getCurrentSeason(): string {
    const month = new Date().getMonth() + 1;
    if (month >= 3 && month <= 5) return '봄';
    if (month >= 6 && month <= 8) return '여름';
    if (month >= 9 && month <= 11) return '가을';
    return '겨울';
  }

  /**
   * 우선순위 계산
   */
  private calculatePriority(
    freshness: FreshnessAnalysis,
    performance?: PostPerformance
  ): number {
    let priority = 5; // 기본

    // 신선도 기반
    if (freshness.priority === 'urgent') priority += 4;
    else if (freshness.priority === 'high') priority += 2;
    else if (freshness.priority === 'low') priority -= 2;

    // 성과 기반 (좋았던 포스트 우선)
    if (performance) {
      if (performance.score >= 70) priority += 2;
      else if (performance.score < 30) priority -= 1;
    }

    return Math.max(1, Math.min(10, priority));
  }

  /**
   * 예상 효과 예측
   */
  private predictImpact(
    freshness: FreshnessAnalysis,
    sections: SectionUpdate[],
    performance?: PostPerformance
  ): 'high' | 'medium' | 'low' {
    // 이전 성과가 좋았고, 적절한 업데이트면 높은 효과 예상
    if (performance && performance.score >= 60 && sections.length <= 3) {
      return 'high';
    }

    // 긴급 업데이트면 중간 이상 효과
    if (freshness.priority === 'urgent') {
      return 'medium';
    }

    // 대규모 재작성은 불확실
    if (sections.filter(s => s.action === 'rewrite').length >= 2) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * 업데이트 큐 조회
   */
  getUpdateQueue(limit?: number): UpdatePlan[] {
    const queue = [...this.updateQueue].sort((a, b) => b.priority - a.priority);
    return limit ? queue.slice(0, limit) : queue;
  }

  /**
   * 특정 포스트 업데이트 계획 조회
   */
  getUpdatePlan(postPath: string): UpdatePlan | null {
    return this.updateQueue.find(p => p.postPath === postPath) || null;
  }

  /**
   * 업데이트 계획 제거 (완료 시)
   */
  async markComplete(postPath: string): Promise<boolean> {
    const index = this.updateQueue.findIndex(p => p.postPath === postPath);
    if (index === -1) return false;

    this.updateQueue.splice(index, 1);
    await this.save();
    return true;
  }

  /**
   * 업데이트 계획 출력
   */
  formatPlan(plan: UpdatePlan): string {
    const lines: string[] = [];

    lines.push(`\n📝 업데이트 계획: ${plan.title}`);
    lines.push('─'.repeat(50));
    lines.push(`  유형: ${plan.updateType}`);
    lines.push(`  노력: ${plan.estimatedEffort}`);
    lines.push(`  우선순위: ${plan.priority}/10`);
    lines.push(`  예상 효과: ${plan.expectedImpact}`);

    if (plan.sections.length > 0) {
      lines.push(`\n  📋 섹션별 작업:`);
      for (const section of plan.sections) {
        lines.push(`    • [${section.action}] ${section.section}`);
        lines.push(`      ${section.suggestion}`);
      }
    }

    if (plan.reshareStrategy?.recommended) {
      lines.push(`\n  🔄 재공유 전략:`);
      lines.push(`    플랫폼: ${plan.reshareStrategy.platform}`);
      lines.push(`    타이밍: ${plan.reshareStrategy.timing}`);
      if (plan.reshareStrategy.newAngle) {
        lines.push(`    새 앵글: ${plan.reshareStrategy.newAngle}`);
      }
      if (plan.reshareStrategy.suggestedTitle) {
        lines.push(`    제안 제목: ${plan.reshareStrategy.suggestedTitle}`);
      }
    }

    return lines.join('\n');
  }
}

export default UpdateSuggester;
