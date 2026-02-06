/**
 * 콘텐츠 신선도 체커
 * 오래된 콘텐츠 감지 및 업데이트 권장
 */

import { readFile, writeFile, mkdir, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import matter from 'gray-matter';

// ============================================================================
// 타입 정의
// ============================================================================

export interface OutdatedIndicator {
  type: 'event_ended' | 'price_changed' | 'seasonal_mismatch' | 'old_date' | 'broken_link' | 'low_engagement';
  severity: 'high' | 'medium' | 'low';
  message: string;
  location?: string;
}

export interface FreshnessAnalysis {
  postPath: string;
  title: string;
  publishedAt: string;
  daysSincePublish: number;
  freshnessScore: number;  // 0-100
  outdatedIndicators: OutdatedIndicator[];
  updateSuggestions: UpdateSuggestion[];
  priority: 'urgent' | 'high' | 'medium' | 'low';
  lastChecked: string;
}

export interface UpdateSuggestion {
  type: 'refresh_info' | 'add_content' | 'update_prices' | 'check_links' | 'seasonal_update';
  description: string;
  effort: 'low' | 'medium' | 'high';
}

export interface FreshnessReport {
  generatedAt: string;
  totalPosts: number;
  freshPosts: number;
  outdatedPosts: number;
  urgentPosts: FreshnessAnalysis[];
  avgFreshness: number;
  byPriority: Record<string, number>;
}

// ============================================================================
// 설정
// ============================================================================

const DATA_DIR = join(process.cwd(), 'data/monitoring');
const FRESHNESS_DATA_PATH = join(DATA_DIR, 'freshness.json');
const BLOG_POSTS_DIR = join(process.cwd(), 'blog/content/posts');

// 신선도 기준
const FRESHNESS_THRESHOLDS = {
  fresh: 30,      // 30일 이내
  recent: 60,     // 60일 이내
  aging: 90,      // 90일 이내
  outdated: 180   // 180일 이상
};

// 시즌 키워드 매핑
const SEASONAL_KEYWORDS: Record<string, string[]> = {
  spring: ['봄', '벚꽃', '봄꽃', '4월', '5월'],
  summer: ['여름', '해수욕', '여름휴가', '7월', '8월', '피서'],
  fall: ['가을', '단풍', '추석', '9월', '10월', '11월'],
  winter: ['겨울', '눈', '크리스마스', '스키', '12월', '1월', '2월', '설날']
};

// 이벤트 키워드
const EVENT_KEYWORDS = [
  '전시회', '페스티벌', '축제', '공연', '이벤트', '기획전',
  '~까지', '~일까지', '기간', '행사'
];

// ============================================================================
// 신선도 체커
// ============================================================================

export class FreshnessChecker {
  private freshnessData: Map<string, FreshnessAnalysis> = new Map();

  /**
   * 데이터 로드
   */
  async load(): Promise<void> {
    try {
      if (existsSync(FRESHNESS_DATA_PATH)) {
        const content = await readFile(FRESHNESS_DATA_PATH, 'utf-8');
        const data = JSON.parse(content) as FreshnessAnalysis[];

        for (const item of data) {
          this.freshnessData.set(item.postPath, item);
        }
      }
    } catch (error) {
      console.log(`⚠️ 신선도 데이터 로드 실패: ${error}`);
    }
  }

  /**
   * 데이터 저장
   */
  async save(): Promise<void> {
    await mkdir(DATA_DIR, { recursive: true });
    const data = Array.from(this.freshnessData.values());
    await writeFile(FRESHNESS_DATA_PATH, JSON.stringify(data, null, 2));
  }

  /**
   * 모든 포스트 신선도 검사
   */
  async checkAll(): Promise<number> {
    const posts = await this.scanPublishedPosts();
    let checked = 0;

    for (const postPath of posts) {
      try {
        await this.checkPostFreshness(postPath);
        checked++;
      } catch (error) {
        console.log(`⚠️ 신선도 검사 실패 (${postPath}): ${error}`);
      }
    }

    await this.save();
    return checked;
  }

  /**
   * 단일 포스트 신선도 검사
   */
  async checkPostFreshness(postPath: string): Promise<FreshnessAnalysis> {
    const absolutePath = postPath.startsWith(BLOG_POSTS_DIR)
      ? postPath
      : join(BLOG_POSTS_DIR, postPath);

    // 포스트 읽기
    const content = await readFile(absolutePath, 'utf-8');
    const { data: frontmatter, content: body } = matter(content);

    const title = frontmatter.title as string || 'Untitled';
    const publishedAt = frontmatter.date as string || new Date().toISOString();

    // 경과 일수 계산
    const daysSincePublish = Math.floor(
      (Date.now() - new Date(publishedAt).getTime()) / (1000 * 60 * 60 * 24)
    );

    // 오래된 지표 검사
    const indicators = this.detectOutdatedIndicators(body, frontmatter, daysSincePublish);

    // 업데이트 제안 생성
    const suggestions = this.generateUpdateSuggestions(indicators, body);

    // 신선도 점수 계산
    const freshnessScore = this.calculateFreshnessScore(daysSincePublish, indicators);

    // 우선순위 결정
    const priority = this.determinePriority(freshnessScore, indicators);

    const analysis: FreshnessAnalysis = {
      postPath,
      title,
      publishedAt,
      daysSincePublish,
      freshnessScore,
      outdatedIndicators: indicators,
      updateSuggestions: suggestions,
      priority,
      lastChecked: new Date().toISOString()
    };

    this.freshnessData.set(postPath, analysis);

    return analysis;
  }

  /**
   * 오래된 지표 감지
   */
  private detectOutdatedIndicators(
    content: string,
    frontmatter: Record<string, unknown>,
    daysSincePublish: number
  ): OutdatedIndicator[] {
    const indicators: OutdatedIndicator[] = [];

    // 1. 날짜 기반 오래됨
    if (daysSincePublish > FRESHNESS_THRESHOLDS.outdated) {
      indicators.push({
        type: 'old_date',
        severity: 'high',
        message: `${daysSincePublish}일 전에 작성되었습니다. 정보 업데이트가 필요할 수 있습니다.`
      });
    } else if (daysSincePublish > FRESHNESS_THRESHOLDS.aging) {
      indicators.push({
        type: 'old_date',
        severity: 'medium',
        message: `${daysSincePublish}일 전에 작성되었습니다.`
      });
    }

    // 2. 이벤트/행사 종료 가능성
    for (const keyword of EVENT_KEYWORDS) {
      if (content.includes(keyword)) {
        indicators.push({
          type: 'event_ended',
          severity: 'high',
          message: `이벤트/행사 관련 내용이 있습니다. 기간 확인이 필요합니다.`,
          location: keyword
        });
        break;
      }
    }

    // 3. 시즌 불일치
    const currentSeason = this.getCurrentSeason();
    for (const [season, keywords] of Object.entries(SEASONAL_KEYWORDS)) {
      if (season !== currentSeason) {
        for (const keyword of keywords) {
          if (content.includes(keyword)) {
            indicators.push({
              type: 'seasonal_mismatch',
              severity: 'medium',
              message: `"${keyword}" 키워드가 현재 시즌(${currentSeason})과 맞지 않을 수 있습니다.`,
              location: keyword
            });
            break;
          }
        }
      }
    }

    // 4. 가격 정보 오래됨
    const pricePatterns = [
      /\d{1,3}[,.]?\d{3}원/g,
      /가격.*\d+/g,
      /비용.*\d+/g,
      /요금.*\d+/g
    ];

    for (const pattern of pricePatterns) {
      if (pattern.test(content)) {
        if (daysSincePublish > 60) {
          indicators.push({
            type: 'price_changed',
            severity: daysSincePublish > 120 ? 'high' : 'medium',
            message: '가격 정보가 변경되었을 수 있습니다.'
          });
        }
        break;
      }
    }

    // 5. 낮은 참여도 (이전 성과 데이터 기반 - 시뮬레이션)
    // TODO: 실제 성과 데이터 연동

    return indicators;
  }

  /**
   * 현재 시즌 결정
   */
  private getCurrentSeason(): string {
    const month = new Date().getMonth() + 1;

    if (month >= 3 && month <= 5) return 'spring';
    if (month >= 6 && month <= 8) return 'summer';
    if (month >= 9 && month <= 11) return 'fall';
    return 'winter';
  }

  /**
   * 업데이트 제안 생성
   */
  private generateUpdateSuggestions(
    indicators: OutdatedIndicator[],
    content: string
  ): UpdateSuggestion[] {
    const suggestions: UpdateSuggestion[] = [];

    for (const indicator of indicators) {
      switch (indicator.type) {
        case 'old_date':
          suggestions.push({
            type: 'refresh_info',
            description: '전체 내용을 검토하고 최신 정보로 업데이트하세요.',
            effort: 'medium'
          });
          break;

        case 'event_ended':
          suggestions.push({
            type: 'refresh_info',
            description: '이벤트/행사 기간을 확인하고 종료된 경우 업데이트하세요.',
            effort: 'low'
          });
          break;

        case 'seasonal_mismatch':
          suggestions.push({
            type: 'seasonal_update',
            description: '시즌에 맞는 내용을 추가하거나 시즌 정보를 업데이트하세요.',
            effort: 'medium'
          });
          break;

        case 'price_changed':
          suggestions.push({
            type: 'update_prices',
            description: '가격 정보를 최신 데이터로 업데이트하세요.',
            effort: 'low'
          });
          break;

        case 'low_engagement':
          suggestions.push({
            type: 'add_content',
            description: '콘텐츠를 보강하거나 더 매력적인 제목으로 변경을 고려하세요.',
            effort: 'high'
          });
          break;
      }
    }

    // 링크 확인 제안 (항상)
    if (content.includes('](http')) {
      suggestions.push({
        type: 'check_links',
        description: '외부 링크가 여전히 유효한지 확인하세요.',
        effort: 'low'
      });
    }

    // 중복 제거
    const unique = suggestions.filter((s, i, arr) =>
      arr.findIndex(x => x.type === s.type) === i
    );

    return unique;
  }

  /**
   * 신선도 점수 계산
   */
  private calculateFreshnessScore(
    daysSincePublish: number,
    indicators: OutdatedIndicator[]
  ): number {
    let score = 100;

    // 날짜 기반 감점
    if (daysSincePublish > FRESHNESS_THRESHOLDS.outdated) {
      score -= 40;
    } else if (daysSincePublish > FRESHNESS_THRESHOLDS.aging) {
      score -= 25;
    } else if (daysSincePublish > FRESHNESS_THRESHOLDS.recent) {
      score -= 15;
    } else if (daysSincePublish > FRESHNESS_THRESHOLDS.fresh) {
      score -= 5;
    }

    // 지표 기반 감점
    for (const indicator of indicators) {
      if (indicator.severity === 'high') {
        score -= 15;
      } else if (indicator.severity === 'medium') {
        score -= 8;
      } else {
        score -= 3;
      }
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * 우선순위 결정
   */
  private determinePriority(
    score: number,
    indicators: OutdatedIndicator[]
  ): 'urgent' | 'high' | 'medium' | 'low' {
    // 긴급 이벤트가 있으면 urgent
    const hasUrgentIndicator = indicators.some(
      i => i.type === 'event_ended' && i.severity === 'high'
    );

    if (hasUrgentIndicator) return 'urgent';
    if (score < 30) return 'urgent';
    if (score < 50) return 'high';
    if (score < 70) return 'medium';
    return 'low';
  }

  /**
   * 발행된 포스트 스캔
   */
  private async scanPublishedPosts(): Promise<string[]> {
    const posts: string[] = [];

    if (!existsSync(BLOG_POSTS_DIR)) {
      return posts;
    }

    const categories = ['travel', 'culture'];

    for (const cat of categories) {
      const catDir = join(BLOG_POSTS_DIR, cat);
      if (!existsSync(catDir)) continue;

      try {
        const files = await readdir(catDir);
        for (const file of files) {
          if (file.endsWith('.md')) {
            posts.push(join(cat, file));
          }
        }
      } catch {
        // ignore
      }
    }

    return posts;
  }

  /**
   * 신선도 리포트 생성
   */
  async generateReport(): Promise<FreshnessReport> {
    await this.load();

    const allPosts = Array.from(this.freshnessData.values());

    if (allPosts.length === 0) {
      return {
        generatedAt: new Date().toISOString(),
        totalPosts: 0,
        freshPosts: 0,
        outdatedPosts: 0,
        urgentPosts: [],
        avgFreshness: 0,
        byPriority: {}
      };
    }

    const freshPosts = allPosts.filter(p => p.freshnessScore >= 70).length;
    const outdatedPosts = allPosts.filter(p => p.freshnessScore < 50).length;

    const avgFreshness = Math.round(
      allPosts.reduce((sum, p) => sum + p.freshnessScore, 0) / allPosts.length
    );

    const urgentPosts = allPosts
      .filter(p => p.priority === 'urgent' || p.priority === 'high')
      .sort((a, b) => a.freshnessScore - b.freshnessScore)
      .slice(0, 10);

    const byPriority: Record<string, number> = {
      urgent: 0,
      high: 0,
      medium: 0,
      low: 0
    };

    for (const post of allPosts) {
      byPriority[post.priority]++;
    }

    return {
      generatedAt: new Date().toISOString(),
      totalPosts: allPosts.length,
      freshPosts,
      outdatedPosts,
      urgentPosts,
      avgFreshness,
      byPriority
    };
  }

  /**
   * 특정 포스트 신선도 조회
   */
  getPostFreshness(postPath: string): FreshnessAnalysis | null {
    return this.freshnessData.get(postPath) || null;
  }

  /**
   * 업데이트 필요한 포스트 목록
   */
  getPostsNeedingUpdate(maxPriority: 'urgent' | 'high' | 'medium' = 'high'): FreshnessAnalysis[] {
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };

    return Array.from(this.freshnessData.values())
      .filter(p => priorityOrder[p.priority] <= priorityOrder[maxPriority])
      .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  }
}

export default FreshnessChecker;
