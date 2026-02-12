/**
 * 콘텐츠 다양성 밸런서
 *
 * 발행된 포스트의 에이전트/지역/유형 분포를 분석하고,
 * 부족한 영역의 주제에 점수 부스트를 적용하여
 * 자연스러운 콘텐츠 다양화를 유도합니다.
 */

import { readFile, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import type { TopicRecommendation, FramingType } from './topic-discovery.js';
import type { DiversityTargets } from './index.js';
import type { WorkflowEventBus } from '../../workflow/event-bus.js';

// ============================================================================
// 지역 매핑
// ============================================================================

/** 세부 지역 키워드 → 광역 지역 코드 */
const LOCATION_TO_REGION: Record<string, string> = {
  // 서울
  '서울': '서울', '강남': '서울', '성수': '서울', '북촌': '서울',
  '익선동': '서울', '해방촌': '서울', '을지로': '서울', '연남동': '서울',
  '홍대': '서울', '대학로': '서울', '종로': '서울', '한남동': '서울',
  '이태원': '서울', '명동': '서울',
  // 경기
  '파주': '경기', '수원': '경기', '용인': '경기', '가평': '경기',
  '양평': '경기', '포천': '경기', '북한산': '경기',
  // 인천
  '인천': '인천',
  // 강원
  '강릉': '강원', '속초': '강원', '양양': '강원', '춘천': '강원',
  '평창': '강원', '원주': '강원', '정선': '강원',
  // 충청
  '대전': '충청', '공주': '충청', '부여': '충청', '청주': '충청',
  '보령': '충청', '단양': '충청', '천안': '충청', '세종': '충청',
  // 경북
  '경주': '경북', '안동': '경북', '영주': '경북', '포항': '경북',
  // 대구
  '대구': '대구',
  // 부산
  '부산': '부산', '해운대': '부산',
  // 경남
  '통영': '경남', '거제': '경남', '남해': '경남', '하동': '경남', '진주': '경남',
  // 전북
  '전주': '전북', '군산': '전북',
  // 전남
  '여수': '전남', '순천': '전남', '담양': '전남', '목포': '전남',
  // 제주
  '제주': '제주',
};

/** 에이전트 키워드 매핑 (personas/index.json과 동일) */
const PERSONA_KEYWORDS: Record<string, string[]> = {
  viral: [
    'TOP', 'BEST', '순위', '비교', 'vs', '최고', '최악', '핫플',
    '트렌드', 'SNS', '난리', '화제', '논란', '꼭', '필수',
  ],
  informative: [
    '역사', '건축', '미술사', '작가', '작품', '해설', '교양',
    '유네스코', '의미', '배경', '유래', '입문', '에티켓',
  ],
  friendly: [
    '주말', '1박2일', '2박3일', '당일치기', '가성비', '퇴근',
    '후기', '코스', '웨이팅', '솔직', '실제', '비용',
  ],
};

// ============================================================================
// 프레이밍 유형 감지 패턴
// ============================================================================

/** 제목에서 프레이밍 유형을 감지하는 패턴 */
const FRAMING_PATTERNS: Record<FramingType, RegExp[]> = {
  list_ranking: [
    /TOP\s*\d+/i, /베스트\s*\d+/, /BEST\s*\d+/i,
    /\d+선/, /\d+곳/, /\d+가지/, /순위/, /총정리/,
  ],
  deep_dive: [
    /역사/, /의미/, /유래/, /해설/, /미술사/, /건축/,
    /이야기/, /비하인드/, /알면/, /배경/, /딥다이브/,
  ],
  experience: [
    /후기/, /체험/, /1박2일/, /2박3일/, /당일치기/,
    /솔직/, /실제\s*비용/, /비용/, /웨이팅/, /다녀왔/,
  ],
  seasonal: [
    /\d+월/, /봄\b/, /여름/, /가을/, /겨울/, /벚꽃/,
    /단풍/, /눈꽃/, /크리스마스/, /설날/, /추석/,
  ],
  comparison: [
    /vs/i, /비교/, /장단점/, /현실/, /기대/, /차이/,
    /진짜/, /가성비/, /시간낭비/, /아깝/,
  ],
  local_story: [
    /동네/, /골목/, /주민/, /사장님/, /로컬/, /숨은/,
    /진짜\s*속살/, /뒷골목/, /단골/, /현지인/,
  ],
  niche_digging: [
    /디깅/, /파고/, /취향/, /덕질/, /심화/, /매니아/,
    /마니아/, /찐/, /언더/, /인디/, /소문/, /발견/,
  ],
};

// ============================================================================
// 타입 정의
// ============================================================================

interface BlogPostMeta {
  title: string;
  personaId?: string;
  category: 'travel' | 'culture';
  tags: string[];
  date: string;
}

export interface DistributionAnalysis {
  totalPosts: number;
  agentCounts: Record<string, number>;
  agentRatios: Record<string, number>;
  typeCounts: { travel: number; culture: number };
  regionCounts: Record<string, number>;
  uncoveredRegions: string[];
  framingCounts: Record<string, number>;
  framingRatios: Record<string, number>;
}

export interface BalanceBoosts {
  agentBoosts: Record<string, number>;
  regionBoosts: Record<string, number>;
  framingBoosts: Record<string, number>;
  analysis: DistributionAnalysis;
}

// ============================================================================
// 기본값
// ============================================================================

const DEFAULT_TARGETS: DiversityTargets = {
  agentRatio: { viral: 0.30, friendly: 0.30, informative: 0.40 },
  typeMix: { travel: 0.55, culture: 0.45 },
  regionPriority: ['충청', '제주', '경남', '전남'],
  regionCovered: ['서울', '경기', '인천', '경북', '대구', '부산', '전북', '강원'],
  framingMix: {
    list_ranking: 0.15,
    deep_dive: 0.25,
    experience: 0.25,
    seasonal: 0.10,
    comparison: 0.10,
    local_story: 0.15,
  },
};

const MAX_AGENT_BOOST = 30;
const MAX_REGION_BOOST = 20;
const MAX_FRAMING_BOOST = 15;

// ============================================================================
// ContentBalancer
// ============================================================================

export class ContentBalancer {
  private blogPostsDir: string;
  private targets: DiversityTargets;
  private eventBus?: WorkflowEventBus;

  constructor(targets?: DiversityTargets, eventBus?: WorkflowEventBus) {
    this.blogPostsDir = join(process.cwd(), 'blog/content/posts');
    this.targets = targets || DEFAULT_TARGETS;
    this.eventBus = eventBus;
  }

  /**
   * 최근 N편 발행 포스트의 에이전트/지역/유형 분포 분석
   */
  async analyzeDistribution(recentN: number = 20): Promise<DistributionAnalysis> {
    const posts = await this.loadRecentPosts(recentN);

    const agentCounts: Record<string, number> = { viral: 0, friendly: 0, informative: 0 };
    const typeCounts = { travel: 0, culture: 0 };
    const regionCounts: Record<string, number> = {};
    const framingCounts: Record<string, number> = {
      list_ranking: 0, deep_dive: 0, experience: 0,
      seasonal: 0, comparison: 0, local_story: 0,
    };

    for (const post of posts) {
      // 에이전트 카운트
      if (post.personaId && agentCounts[post.personaId] !== undefined) {
        agentCounts[post.personaId]++;
      } else {
        agentCounts.friendly++; // 레거시 포스트 → friendly 간주
      }

      // 유형 카운트
      if (post.category === 'travel') typeCounts.travel++;
      else typeCounts.culture++;

      // 지역 카운트
      const region = this.detectRegion(post.title, post.tags);
      if (region) {
        regionCounts[region] = (regionCounts[region] || 0) + 1;
      }

      // 프레이밍 카운트
      const framing = this.detectFraming(post.title);
      framingCounts[framing] = (framingCounts[framing] || 0) + 1;
    }

    const total = posts.length || 1;
    const agentRatios: Record<string, number> = {};
    for (const [agent, count] of Object.entries(agentCounts)) {
      agentRatios[agent] = count / total;
    }

    const framingRatios: Record<string, number> = {};
    for (const [framing, count] of Object.entries(framingCounts)) {
      framingRatios[framing] = count / total;
    }

    // 미커버 우선 지역: regionPriority 중 포스트가 없는 지역
    const coveredRegions = new Set(Object.keys(regionCounts));
    const uncoveredRegions = this.targets.regionPriority.filter(
      r => !coveredRegions.has(r)
    );

    return {
      totalPosts: posts.length,
      agentCounts,
      agentRatios,
      typeCounts,
      regionCounts,
      uncoveredRegions,
      framingCounts,
      framingRatios,
    };
  }

  /**
   * 분포 분석 기반 부스트값 계산
   */
  calculateBoosts(analysis: DistributionAnalysis): BalanceBoosts {
    // 에이전트 부스트: 목표 비율 대비 부족분에 비례
    const agentBoosts: Record<string, number> = {};
    for (const [agent, targetRatio] of Object.entries(this.targets.agentRatio)) {
      const actualRatio = analysis.agentRatios[agent] || 0;
      const deficit = targetRatio - actualRatio;
      if (deficit > 0.05) {
        agentBoosts[agent] = Math.round((deficit / targetRatio) * MAX_AGENT_BOOST);
      } else {
        agentBoosts[agent] = 0;
      }
    }

    // 지역 부스트: 미커버 우선 지역에 부스트
    const regionBoosts: Record<string, number> = {};
    for (const region of this.targets.regionPriority) {
      const count = analysis.regionCounts[region] || 0;
      if (count === 0) {
        regionBoosts[region] = MAX_REGION_BOOST;
      } else if (count <= 1) {
        regionBoosts[region] = Math.round(MAX_REGION_BOOST * 0.5);
      }
    }

    // 프레이밍 부스트: 목표 비율 대비 부족분에 비례
    const framingBoosts: Record<string, number> = {};
    const framingMix = this.targets.framingMix || DEFAULT_TARGETS.framingMix!;
    for (const [framing, targetRatio] of Object.entries(framingMix)) {
      const actualRatio = analysis.framingRatios[framing] || 0;
      const deficit = targetRatio - actualRatio;
      if (deficit > 0.05) {
        framingBoosts[framing] = Math.round((deficit / targetRatio) * MAX_FRAMING_BOOST);
      } else {
        framingBoosts[framing] = 0;
      }
    }

    return { agentBoosts, regionBoosts, framingBoosts, analysis };
  }

  /**
   * 추천 목록에 밸런스 부스트 적용 + 에이전트 사전 배정
   */
  applyBoosts(
    recommendations: TopicRecommendation[],
    boosts: BalanceBoosts
  ): TopicRecommendation[] {
    // 가장 부족한 에이전트 (키워드 미매칭 시 할당용)
    const mostNeededAgent = this.getMostNeededAgent(boosts.agentBoosts);

    for (const rec of recommendations) {
      // 1. 에이전트 미배정이면 사전 배정
      if (!rec.personaId) {
        const { persona, matchCount } = this.inferPersona(
          rec.suggestedTitle,
          rec.keywords
        );
        // 키워드 매칭이 없으면 가장 부족한 에이전트 배정
        rec.personaId = matchCount > 0 ? persona : mostNeededAgent;
      }

      // 2. 에이전트 밸런스 부스트
      const agentBoost = boosts.agentBoosts[rec.personaId || 'friendly'] || 0;
      if (agentBoost > 0) {
        rec.score += agentBoost;
        rec.reasoning += ` | 에이전트밸런스(${rec.personaId}) +${agentBoost}`;
      }

      // 3. 지역 다양성 부스트
      const region = this.detectRegionFromRec(rec);
      if (region) {
        const regionBoost = boosts.regionBoosts[region] || 0;
        if (regionBoost > 0) {
          rec.score += regionBoost;
          rec.reasoning += ` | 지역다양성(${region}) +${regionBoost}`;
        }
      }

      // 4. 프레이밍 다양성 부스트 + 프레이밍 타입 배정
      if (!rec.framingType) {
        rec.framingType = this.detectFraming(rec.suggestedTitle) as FramingType;
      }
      const framingBoost = boosts.framingBoosts[rec.framingType] || 0;
      if (framingBoost > 0) {
        rec.score += framingBoost;
        rec.reasoning += ` | 프레이밍다양성(${rec.framingType}) +${framingBoost}`;
      }
    }

    // 점수순 재정렬
    recommendations.sort((a, b) => b.score - a.score);
    return recommendations;
  }

  /**
   * 분석 결과를 콘솔에 출력
   */
  printAnalysis(boosts: BalanceBoosts): void {
    const { analysis } = boosts;
    const AGENT_LABELS: Record<string, string> = {
      viral: '조회영',
      friendly: '김주말',
      informative: '한교양',
    };

    console.log('\n📊 콘텐츠 다양성 분석');
    console.log('──────────────────────────────────────────────────');

    // 에이전트 분포
    console.log(`  에이전트 분포 (최근 ${analysis.totalPosts}편)`);
    for (const [agent, count] of Object.entries(analysis.agentCounts)) {
      const ratio = ((analysis.agentRatios[agent] || 0) * 100).toFixed(0);
      const target = ((this.targets.agentRatio[agent] || 0) * 100).toFixed(0);
      const boost = boosts.agentBoosts[agent] || 0;
      const label = AGENT_LABELS[agent] || agent;
      const status = boost > 0 ? ` → +${boost} 부스트` : '';
      console.log(`    ${label}(${agent}): ${count}편 (${ratio}%) 목표 ${target}%${status}`);
    }

    // 지역 커버리지
    const coveredList = Object.entries(analysis.regionCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([r, c]) => `${r}(${c})`)
      .join(', ');
    console.log(`\n  지역 커버리지: ${coveredList}`);

    if (analysis.uncoveredRegions.length > 0) {
      console.log(`  미커버 우선 지역: ${analysis.uncoveredRegions.join(', ')}`);
      const boostRegions = Object.entries(boosts.regionBoosts)
        .filter(([, b]) => b > 0)
        .map(([r, b]) => `${r}(+${b})`)
        .join(', ');
      if (boostRegions) {
        console.log(`    → 부스트: ${boostRegions}`);
      }
    }

    // 유형 분포
    const { travel, culture } = analysis.typeCounts;
    const total = travel + culture || 1;
    const tTarget = ((this.targets.typeMix.travel) * 100).toFixed(0);
    const cTarget = ((this.targets.typeMix.culture) * 100).toFixed(0);
    console.log(
      `\n  유형: travel ${travel}편(${((travel / total) * 100).toFixed(0)}%) ` +
      `culture ${culture}편(${((culture / total) * 100).toFixed(0)}%) ` +
      `(목표 ${tTarget}/${cTarget})`
    );

    // 프레이밍 분포
    const FRAMING_LABELS: Record<string, string> = {
      list_ranking: '리스트/순위',
      deep_dive: '심층탐구',
      experience: '체험/후기',
      seasonal: '시즌',
      comparison: '비교/분석',
      local_story: '로컬스토리',
    };
    const framingMix = this.targets.framingMix || DEFAULT_TARGETS.framingMix!;
    console.log(`\n  프레이밍 분포`);
    for (const [framing, count] of Object.entries(analysis.framingCounts)) {
      const ratio = ((analysis.framingRatios[framing] || 0) * 100).toFixed(0);
      const target = ((framingMix[framing] || 0) * 100).toFixed(0);
      const boost = boosts.framingBoosts[framing] || 0;
      const label = FRAMING_LABELS[framing] || framing;
      const status = boost > 0 ? ` → +${boost} 부스트` : '';
      console.log(`    ${label}: ${count}편 (${ratio}%) 목표 ${target}%${status}`);
    }

    console.log('──────────────────────────────────────────────────');
  }

  // ============================================================================
  // 내부 헬퍼
  // ============================================================================

  private async loadRecentPosts(n: number): Promise<BlogPostMeta[]> {
    const posts: BlogPostMeta[] = [];

    if (!existsSync(this.blogPostsDir)) return posts;

    for (const category of ['travel', 'culture'] as const) {
      const catDir = join(this.blogPostsDir, category);
      if (!existsSync(catDir)) continue;

      try {
        const files = await readdir(catDir);
        for (const file of files) {
          if (!file.endsWith('.md')) continue;

          const filePath = join(catDir, file);
          const content = await readFile(filePath, 'utf-8');
          const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
          if (!frontmatterMatch) continue;

          const fm = frontmatterMatch[1];
          const titleMatch = fm.match(/title:\s*["']?(.+?)["']?\s*$/m);
          const dateMatch = fm.match(/date:\s*(\d{4}-\d{2}-\d{2})/);
          const personaMatch = fm.match(/personaId:\s*["']?(\w+)["']?/);
          const tagsMatch = fm.match(/tags:\s*\[(.*?)\]/);

          const tags = tagsMatch?.[1]
            ?.split(',')
            .map(t => t.trim().replace(/["']/g, ''))
            .filter(Boolean) || [];

          posts.push({
            title: titleMatch?.[1] || file,
            personaId: personaMatch?.[1],
            category,
            tags,
            date: dateMatch?.[1] || '2000-01-01',
          });
        }
      } catch {
        // 디렉토리 읽기 실패 무시
      }
    }

    // 날짜 역순 정렬 → 최근 N편
    posts.sort((a, b) => b.date.localeCompare(a.date));
    return posts.slice(0, n);
  }

  private detectRegion(title: string, tags: string[]): string | null {
    const combined = title + ' ' + tags.join(' ');
    for (const [location, region] of Object.entries(LOCATION_TO_REGION)) {
      if (combined.includes(location)) return region;
    }
    return null;
  }

  private detectRegionFromRec(rec: TopicRecommendation): string | null {
    const combined = rec.topic + ' ' + rec.suggestedTitle + ' ' + rec.keywords.join(' ');
    for (const [location, region] of Object.entries(LOCATION_TO_REGION)) {
      if (combined.includes(location)) return region;
    }
    return null;
  }

  private inferPersona(
    title: string,
    keywords: string[]
  ): { persona: 'viral' | 'friendly' | 'informative'; matchCount: number } {
    const combined = title + ' ' + keywords.join(' ');
    let bestPersona: 'viral' | 'friendly' | 'informative' = 'friendly';
    let bestCount = 0;

    for (const [persona, words] of Object.entries(PERSONA_KEYWORDS)) {
      const count = words.filter(w => combined.includes(w)).length;
      if (count > bestCount) {
        bestCount = count;
        bestPersona = persona as 'viral' | 'friendly' | 'informative';
      }
    }

    return { persona: bestPersona, matchCount: bestCount };
  }

  /**
   * 미커버 지역 기반 추천 생성 (다양한 프레이밍 + 에이전트 배정)
   */
  generateRegionGapRecommendations(
    boosts: BalanceBoosts
  ): TopicRecommendation[] {
    const recommendations: TopicRecommendation[] = [];
    const { uncoveredRegions } = boosts.analysis;
    const mostNeededAgent = this.getMostNeededAgent(boosts.agentBoosts);
    const mostNeededFraming = this.getMostNeededFraming(boosts.framingBoosts);

    // 미커버 지역별 대표 주제 + 프레이밍 매핑
    const REGION_TOPICS: Record<string, Array<{
      topic: string; type: 'travel' | 'culture';
      framing: FramingType; persona: 'viral' | 'friendly' | 'informative';
      title: string; keywords: string[];
    }>> = {
      '충청': [
        { topic: '공주 백제문화', type: 'culture', framing: 'deep_dive', persona: 'informative',
          title: '공주 백제유적 산책: 무령왕릉에서 공산성까지', keywords: ['공주', '백제', '무령왕릉', '공산성'] },
        { topic: '대전 빵집 투어', type: 'travel', framing: 'experience', persona: 'friendly',
          title: '대전 성심당만? 현지인이 가는 진짜 빵집 3곳', keywords: ['대전', '성심당', '빵집', '맛집'] },
        { topic: '단양 절경', type: 'travel', framing: 'local_story', persona: 'friendly',
          title: '단양 도담삼봉 주민이 알려준 숨은 뷰포인트', keywords: ['단양', '도담삼봉', '절경', '소백산'] },
      ],
      '제주': [
        { topic: '제주 오름', type: 'travel', framing: 'deep_dive', persona: 'informative',
          title: '제주 오름의 지질학: 368개 오름이 만든 풍경', keywords: ['제주', '오름', '지질', '트레킹'] },
        { topic: '제주 로컬 식당', type: 'travel', framing: 'local_story', persona: 'friendly',
          title: '제주 현지인 단골 식당: 관광객 모르는 동네 맛집', keywords: ['제주', '현지인', '맛집', '로컬'] },
        { topic: '제주 겨울 여행', type: 'travel', framing: 'seasonal', persona: 'viral',
          title: '2월 제주도가 오히려 좋은 이유 5가지', keywords: ['제주', '겨울', '2월', '비수기'] },
      ],
      '경남': [
        { topic: '통영 예술', type: 'culture', framing: 'deep_dive', persona: 'informative',
          title: '통영이 예술의 도시가 된 이유: 윤이상에서 전혁림까지', keywords: ['통영', '윤이상', '전혁림', '예술'] },
        { topic: '남해 바래길', type: 'travel', framing: 'experience', persona: 'friendly',
          title: '남해 바래길 걸어본 솔직 후기: 3코스 비교', keywords: ['남해', '바래길', '트레킹', '올레'] },
        { topic: '거제 해안도로', type: 'travel', framing: 'comparison', persona: 'viral',
          title: '거제 vs 통영 드라이브: 어디가 더 예쁠까', keywords: ['거제', '통영', '드라이브', '해안'] },
      ],
      '전남': [
        { topic: '순천만 습지', type: 'travel', framing: 'seasonal', persona: 'informative',
          title: '겨울 순천만 갈대밭: 계절별로 달라지는 풍경', keywords: ['순천', '순천만', '갈대', '겨울'] },
        { topic: '담양 죽녹원', type: 'travel', framing: 'local_story', persona: 'friendly',
          title: '담양 죽녹원 너머: 주민이 추천하는 진짜 담양', keywords: ['담양', '죽녹원', '메타세쿼이아', '로컬'] },
        { topic: '목포 근대문화', type: 'culture', framing: 'deep_dive', persona: 'informative',
          title: '목포 근대역사 산책: 개항장에서 유달산까지', keywords: ['목포', '근대', '개항', '유달산'] },
      ],
    };

    for (const region of uncoveredRegions) {
      const topics = REGION_TOPICS[region];
      if (!topics) continue;

      // 가장 부족한 프레이밍과 매칭되는 주제 우선, 없으면 첫 번째
      const preferred = topics.find(t => t.framing === mostNeededFraming) || topics[0];

      recommendations.push({
        topic: preferred.topic,
        type: preferred.type,
        score: 85 + (boosts.regionBoosts[region] || 0),
        source: 'gap_analysis',
        reasoning: `미커버 지역(${region}) 자동 생성 | ${preferred.framing} 프레이밍`,
        suggestedTitle: preferred.title,
        keywords: preferred.keywords,
        discoveredAt: new Date().toISOString(),
        personaId: preferred.persona === mostNeededAgent ? mostNeededAgent : preferred.persona,
        framingType: preferred.framing,
      });

      // 같은 지역에서 다른 프레이밍으로 추가 1편 (다양성 확보)
      const secondary = topics.find(t => t !== preferred && t.framing !== preferred.framing);
      if (secondary) {
        recommendations.push({
          topic: secondary.topic,
          type: secondary.type,
          score: 75 + (boosts.regionBoosts[region] || 0),
          source: 'gap_analysis',
          reasoning: `미커버 지역(${region}) 보조 추천 | ${secondary.framing} 프레이밍`,
          suggestedTitle: secondary.title,
          keywords: secondary.keywords,
          discoveredAt: new Date().toISOString(),
          personaId: secondary.persona,
          framingType: secondary.framing,
        });
      }
    }

    return recommendations;
  }

  /**
   * 제목에서 프레이밍 유형 감지
   */
  detectFraming(title: string): FramingType {
    let bestFraming: FramingType = 'experience'; // 기본값
    let bestScore = 0;

    for (const [framing, patterns] of Object.entries(FRAMING_PATTERNS)) {
      const matchCount = patterns.filter(p => p.test(title)).length;
      if (matchCount > bestScore) {
        bestScore = matchCount;
        bestFraming = framing as FramingType;
      }
    }

    return bestFraming;
  }

  /**
   * 가장 부족한 프레이밍 유형 반환
   */
  getMostNeededFraming(framingBoosts: Record<string, number>): FramingType {
    let maxBoost = 0;
    let mostNeeded: FramingType = 'deep_dive';
    for (const [framing, boost] of Object.entries(framingBoosts)) {
      if (boost > maxBoost) {
        maxBoost = boost;
        mostNeeded = framing as FramingType;
      }
    }
    return mostNeeded;
  }

  private getMostNeededAgent(
    agentBoosts: Record<string, number>
  ): 'viral' | 'friendly' | 'informative' {
    let maxBoost = 0;
    let mostNeeded: 'viral' | 'friendly' | 'informative' = 'informative';
    for (const [agent, boost] of Object.entries(agentBoosts)) {
      if (boost > maxBoost) {
        maxBoost = boost;
        mostNeeded = agent as 'viral' | 'friendly' | 'informative';
      }
    }
    return mostNeeded;
  }
}
