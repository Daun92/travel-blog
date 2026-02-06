/**
 * 서베이 인사이트 DB
 * 서베이 결과를 누적 저장/조회하여 주제 발굴 파이프라인에 반영
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

// ============================================================================
// 타입 정의
// ============================================================================

export interface TopicDemandSignal {
  topicId: number;
  topicLabel: string;
  totalWeightedVotes: number;
  surveyAppearances: number;
  lastSeen: string;
}

export interface FormatPreference {
  formatKey: string;
  formatLabel: string;
  totalWeightedVotes: number;
  surveyAppearances: number;
}

export interface RegionInterest {
  region: string;
  totalMentions: number;
  surveyAppearances: number;
}

export interface FreeTextTheme {
  text: string;
  author: string;
  surveyId: string;
  collectedAt: string;
}

export interface SurveyRecord {
  surveyId: string;
  title: string;
  totalResponses: number;
  ingestedAt: string;
  source: string;
}

export interface SurveyInsightsDB {
  version: 1;
  lastUpdated: string;
  surveys: SurveyRecord[];
  insights: {
    topicDemand: TopicDemandSignal[];
    formatPreferences: FormatPreference[];
    regionInterest: RegionInterest[];
    freeTextThemes: FreeTextTheme[];
  };
  cumulative: {
    totalResponses: number;
    totalSurveys: number;
    firstSurveyDate: string;
    lastSurveyDate: string;
  };
}

/** survey-result.json 구조 */
interface SurveyResultFile {
  postId: string;
  title: string;
  totalResponses: number;
  lastCollected: string;
  responses: Array<{
    commentId: string;
    author: string;
    content: string;
    upvotes: number;
    createdAt: string;
    parsed: {
      topics: number[];
      format: string[];
      regions: string[];
      freeText: string;
    };
  }>;
  aggregated: {
    topicVotes: Record<string, number>;
    formatVotes: Record<string, number>;
    regionMentions: Record<string, number>;
    freeTexts: string[];
  };
}

// ============================================================================
// 상수
// ============================================================================

const DATA_DIR = join(process.cwd(), 'data');
const DB_PATH = join(DATA_DIR, 'survey-insights-db.json');
const SURVEY_RESULT_PATH = join(DATA_DIR, 'feedback', 'survey-result.json');
const SURVEY_RECORDS_PATH = join(DATA_DIR, 'feedback', 'survey-records.json');

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

/** topicId → discovery 키워드 매핑 */
const TOPIC_KEYWORD_MAP: Record<number, string[]> = {
  1: ['미술관', '갤러리', '전시회'],
  2: ['뮤지컬', '연극', '공연'],
  3: ['서점', '북카페', '독립서점'],
  4: ['전통문화'],
  5: ['공연', '페스티벌'],
  6: ['영화제'],
  7: ['워크숍'],
  8: ['벽화', '스트릿아트']
};

const FORMAT_MAP: Record<string, string> = {
  'A': '깊이 있는 단일 주제 리뷰',
  'B': '베스트 N 큐레이션',
  'C': '루트형 코스 가이드',
  'D': '비교 분석'
};

// ============================================================================
// SurveyInsightsDB 클래스
// ============================================================================

export class SurveyInsightsDBManager {
  private db: SurveyInsightsDB;
  private loaded = false;

  constructor() {
    this.db = this.createEmpty();
  }

  private createEmpty(): SurveyInsightsDB {
    return {
      version: 1,
      lastUpdated: new Date().toISOString(),
      surveys: [],
      insights: {
        topicDemand: [],
        formatPreferences: [],
        regionInterest: [],
        freeTextThemes: []
      },
      cumulative: {
        totalResponses: 0,
        totalSurveys: 0,
        firstSurveyDate: '',
        lastSurveyDate: ''
      }
    };
  }

  /** DB 파일 로드 (없으면 빈 DB) */
  async load(): Promise<void> {
    if (existsSync(DB_PATH)) {
      const raw = await readFile(DB_PATH, 'utf-8');
      this.db = JSON.parse(raw) as SurveyInsightsDB;
    } else {
      this.db = this.createEmpty();
    }
    this.loaded = true;
  }

  /** DB 저장 */
  async save(): Promise<void> {
    this.db.lastUpdated = new Date().toISOString();
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(DB_PATH, JSON.stringify(this.db, null, 2), 'utf-8');
  }

  /** survey-result.json + survey-records.json 자동 로드 */
  async ingestFromFiles(): Promise<{ ingested: number; skipped: number }> {
    if (!this.loaded) await this.load();

    let ingested = 0;
    let skipped = 0;

    // survey-result.json 로드
    if (existsSync(SURVEY_RESULT_PATH)) {
      const raw = await readFile(SURVEY_RESULT_PATH, 'utf-8');
      const result = JSON.parse(raw) as SurveyResultFile;
      const ok = this.ingestSurveyResult(result);
      if (ok) ingested++; else skipped++;
    }

    await this.save();
    return { ingested, skipped };
  }

  /** 단일 서베이 결과 적재 (surveyId로 중복 방지) */
  ingestSurveyResult(result: SurveyResultFile): boolean {
    const surveyId = result.postId;

    // 중복 방지
    if (this.db.surveys.some(s => s.surveyId === surveyId)) {
      return false;
    }

    // 서베이 레코드 등록
    this.db.surveys.push({
      surveyId,
      title: result.title,
      totalResponses: result.totalResponses,
      ingestedAt: new Date().toISOString(),
      source: 'survey-result.json'
    });

    // topicDemand 누적
    for (const [label, votes] of Object.entries(result.aggregated.topicVotes)) {
      if (votes <= 0) continue;
      const topicIdMatch = label.match(/^(\d)/);
      if (!topicIdMatch) continue;
      const topicId = parseInt(topicIdMatch[1], 10);

      const existing = this.db.insights.topicDemand.find(t => t.topicId === topicId);
      if (existing) {
        existing.totalWeightedVotes += votes;
        existing.surveyAppearances += 1;
        existing.lastSeen = new Date().toISOString();
      } else {
        this.db.insights.topicDemand.push({
          topicId,
          topicLabel: TOPIC_MAP[topicId] || label,
          totalWeightedVotes: votes,
          surveyAppearances: 1,
          lastSeen: new Date().toISOString()
        });
      }
    }

    // formatPreferences 누적
    for (const [label, votes] of Object.entries(result.aggregated.formatVotes)) {
      if (votes <= 0) continue;
      const keyMatch = label.match(/^([A-D])/);
      if (!keyMatch) continue;
      const key = keyMatch[1];

      const existing = this.db.insights.formatPreferences.find(f => f.formatKey === key);
      if (existing) {
        existing.totalWeightedVotes += votes;
        existing.surveyAppearances += 1;
      } else {
        this.db.insights.formatPreferences.push({
          formatKey: key,
          formatLabel: FORMAT_MAP[key] || label,
          totalWeightedVotes: votes,
          surveyAppearances: 1
        });
      }
    }

    // regionInterest 누적
    for (const [region, mentions] of Object.entries(result.aggregated.regionMentions)) {
      if (mentions <= 0) continue;
      const existing = this.db.insights.regionInterest.find(r => r.region === region);
      if (existing) {
        existing.totalMentions += mentions;
        existing.surveyAppearances += 1;
      } else {
        this.db.insights.regionInterest.push({
          region,
          totalMentions: mentions,
          surveyAppearances: 1
        });
      }
    }

    // freeTextThemes 누적 (개별 응답에서)
    for (const resp of result.responses) {
      if (resp.parsed.freeText && resp.parsed.freeText.length >= 10) {
        this.db.insights.freeTextThemes.push({
          text: resp.parsed.freeText,
          author: resp.author,
          surveyId,
          collectedAt: resp.createdAt
        });
      }
    }

    // cumulative 업데이트
    this.db.cumulative.totalResponses += result.totalResponses;
    this.db.cumulative.totalSurveys = this.db.surveys.length;
    const now = new Date().toISOString();
    if (!this.db.cumulative.firstSurveyDate) {
      this.db.cumulative.firstSurveyDate = now;
    }
    this.db.cumulative.lastSurveyDate = now;

    return true;
  }

  /**
   * discovery 스코어 부스트 맵 반환
   * 키워드 → 0~30점 부스트
   */
  getSurveyScoreBoosts(): Record<string, number> {
    const boosts: Record<string, number> = {};

    if (this.db.insights.topicDemand.length === 0) return boosts;

    const maxVotes = Math.max(...this.db.insights.topicDemand.map(t => t.totalWeightedVotes));
    if (maxVotes <= 0) return boosts;

    for (const topic of this.db.insights.topicDemand) {
      const keywords = TOPIC_KEYWORD_MAP[topic.topicId];
      if (!keywords) continue;

      const boost = Math.min(30,
        (topic.totalWeightedVotes / maxVotes) * 20 + topic.surveyAppearances * 5
      );

      if (boost > 0) {
        for (const kw of keywords) {
          boosts[kw] = Math.max(boosts[kw] || 0, Math.round(boost));
        }
      }
    }

    return boosts;
  }

  /** content-strategy.json 업데이트용 추천 */
  getStrategyRecommendations(): {
    priorityTopics: string[];
    contentFormat: string;
    focusAreas: string[];
  } {
    // 인기 주제 (투표 내림차순)
    const topTopics = [...this.db.insights.topicDemand]
      .sort((a, b) => b.totalWeightedVotes - a.totalWeightedVotes)
      .slice(0, 5)
      .map(t => t.topicLabel);

    // 인기 형식
    const topFormat = [...this.db.insights.formatPreferences]
      .sort((a, b) => b.totalWeightedVotes - a.totalWeightedVotes);
    const contentFormat = topFormat.length > 0 ? topFormat[0].formatLabel : '';

    // 관심 지역
    const focusAreas = [...this.db.insights.regionInterest]
      .sort((a, b) => b.totalMentions - a.totalMentions)
      .slice(0, 5)
      .map(r => r.region);

    return { priorityTopics: topTopics, contentFormat, focusAreas };
  }

  /** DB 요약 정보 */
  getSummary(): {
    totalSurveys: number;
    totalResponses: number;
    topTopics: Array<{ label: string; votes: number }>;
    topFormats: Array<{ label: string; votes: number }>;
    topRegions: Array<{ region: string; mentions: number }>;
    freeTextCount: number;
  } {
    return {
      totalSurveys: this.db.cumulative.totalSurveys,
      totalResponses: this.db.cumulative.totalResponses,
      topTopics: [...this.db.insights.topicDemand]
        .sort((a, b) => b.totalWeightedVotes - a.totalWeightedVotes)
        .slice(0, 5)
        .map(t => ({ label: t.topicLabel, votes: t.totalWeightedVotes })),
      topFormats: [...this.db.insights.formatPreferences]
        .sort((a, b) => b.totalWeightedVotes - a.totalWeightedVotes)
        .map(f => ({ label: f.formatLabel, votes: f.totalWeightedVotes })),
      topRegions: [...this.db.insights.regionInterest]
        .sort((a, b) => b.totalMentions - a.totalMentions)
        .slice(0, 5)
        .map(r => ({ region: r.region, mentions: r.totalMentions })),
      freeTextCount: this.db.insights.freeTextThemes.length
    };
  }

  /** 특정 키워드의 서베이 관련도 점수 (0-100) */
  getSurveyRelevance(keywords: string[]): number {
    if (this.db.insights.topicDemand.length === 0) return 0;

    const maxVotes = Math.max(...this.db.insights.topicDemand.map(t => t.totalWeightedVotes));
    if (maxVotes <= 0) return 0;

    let maxRelevance = 0;

    for (const topic of this.db.insights.topicDemand) {
      const topicKeywords = TOPIC_KEYWORD_MAP[topic.topicId] || [];
      const hasMatch = keywords.some(kw =>
        topicKeywords.some(tk => kw.includes(tk) || tk.includes(kw))
      );

      if (hasMatch) {
        const relevance = Math.min(100, Math.round((topic.totalWeightedVotes / maxVotes) * 100));
        maxRelevance = Math.max(maxRelevance, relevance);
      }
    }

    return maxRelevance;
  }
}

export default SurveyInsightsDBManager;
