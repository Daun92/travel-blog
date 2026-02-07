/**
 * 이벤트 캘린더 DB
 * 이벤트 데이터 모델 + CRUD + 라이프사이클 관리
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

// ============================================================================
// 타입 정의
// ============================================================================

export interface EventLocation {
  region: string;
  venue: string;
  address?: string;
  gpsX?: number;
  gpsY?: number;
}

export interface EventTiming {
  previewDays: number;   // 프리뷰 콘텐츠 최적 시점 (D-N)
  guideDays: number;     // 가이드 콘텐츠 최적 시점 (D-N)
  retroDays: number;     // 후기 콘텐츠 윈도우 (D+N)
}

export interface CalendarEvent {
  id: string;
  title: string;
  category: 'festival' | 'exhibition' | 'conference' | 'seasonal' | 'performance';
  startDate: string;       // ISO "2026-03-15"
  endDate: string;
  location: EventLocation;
  visibility: 'major' | 'emerging' | 'hidden';
  keywords: string[];
  hiddenGems: string[];    // Gemini가 발굴한 주변 숨은 명소
  personaFit: {
    viral: number;         // 0-100
    friendly: number;
    informative: number;
  };
  status: 'upcoming' | 'active' | 'past';
  source: 'api_kto' | 'api_culture' | 'api_performance' | 'gemini' | 'manual';
  timing: EventTiming;
  needsVerification?: boolean;  // Gemini only 이벤트
  thumbnail?: string;
  url?: string;
  tel?: string;
  price?: string;
  contentId?: string;      // KTO contentid
  recurrence?: 'yearly' | 'monthly' | 'once';
  typicalMonth?: number;   // 연례 이벤트의 대표 월
  relatedEvents?: string[]; // 관련 이벤트 ID 목록
  createdAt: string;
  updatedAt: string;
}

export interface SeasonalPattern {
  months: number[];
  boost: number;           // 0.8-1.5
  keywords: string[];
}

export interface EventCalendarDB {
  version: string;
  lastSyncedAt: string;
  events: CalendarEvent[];
  seasonalPatterns: Record<string, SeasonalPattern>;
}

// ============================================================================
// 카테고리별 기본 타이밍 설정
// ============================================================================

export const DEFAULT_TIMING: Record<CalendarEvent['category'], EventTiming> = {
  festival: { previewDays: 14, guideDays: 7, retroDays: 7 },
  exhibition: { previewDays: 21, guideDays: 14, retroDays: 7 },
  conference: { previewDays: 21, guideDays: 7, retroDays: 3 },
  seasonal: { previewDays: 21, guideDays: 14, retroDays: 14 },
  performance: { previewDays: 14, guideDays: 7, retroDays: 3 },
};

// ============================================================================
// 기본 계절 패턴
// ============================================================================

export const DEFAULT_SEASONAL_PATTERNS: Record<string, SeasonalPattern> = {
  spring: {
    months: [3, 4, 5],
    boost: 1.3,
    keywords: ['벚꽃', '피크닉', '봄나들이', '꽃놀이', '봄', '개화']
  },
  summer: {
    months: [6, 7, 8],
    boost: 1.2,
    keywords: ['바다', '축제', '워터파크', '해수욕장', '여름여행', '물놀이']
  },
  fall: {
    months: [9, 10, 11],
    boost: 1.4,
    keywords: ['단풍', '페스티벌', '가을여행', '드라이브', '가을', '억새']
  },
  winter: {
    months: [12, 1, 2],
    boost: 1.1,
    keywords: ['스키', '온천', '겨울바다', '눈꽃', '겨울축제', '크리스마스']
  }
};

// ============================================================================
// DB 경로
// ============================================================================

const DB_PATH = join(process.cwd(), 'data', 'event-calendar.json');

// ============================================================================
// EventCalendarManager
// ============================================================================

export class EventCalendarManager {
  private db: EventCalendarDB;
  private loaded = false;

  constructor() {
    this.db = {
      version: '1.0.0',
      lastSyncedAt: '',
      events: [],
      seasonalPatterns: DEFAULT_SEASONAL_PATTERNS
    };
  }

  /** DB 로드 */
  async load(): Promise<void> {
    if (this.loaded) return;

    try {
      if (existsSync(DB_PATH)) {
        const raw = await readFile(DB_PATH, 'utf-8');
        this.db = JSON.parse(raw) as EventCalendarDB;
      }
    } catch (error) {
      console.log(`⚠️ 이벤트 DB 로드 실패: ${error}`);
    }

    this.loaded = true;
  }

  /** DB 저장 */
  async save(): Promise<void> {
    const dir = join(process.cwd(), 'data');
    await mkdir(dir, { recursive: true });
    await writeFile(DB_PATH, JSON.stringify(this.db, null, 2), 'utf-8');
  }

  /** 전체 이벤트 목록 */
  getEvents(): CalendarEvent[] {
    return this.db.events;
  }

  /** 계절 패턴 가져오기 */
  getSeasonalPatterns(): Record<string, SeasonalPattern> {
    return this.db.seasonalPatterns;
  }

  /** 마지막 동기화 시간 */
  getLastSyncedAt(): string {
    return this.db.lastSyncedAt;
  }

  /** 동기화 시간 업데이트 */
  setLastSyncedAt(time: string): void {
    this.db.lastSyncedAt = time;
  }

  // ──────────────────────────────────────────────────
  // CRUD
  // ──────────────────────────────────────────────────

  /** 이벤트 추가 (중복 시 업데이트) */
  upsertEvent(event: CalendarEvent): void {
    const idx = this.db.events.findIndex(e => e.id === event.id);
    if (idx >= 0) {
      this.db.events[idx] = { ...this.db.events[idx], ...event, updatedAt: new Date().toISOString() };
    } else {
      this.db.events.push(event);
    }
  }

  /** 여러 이벤트 일괄 추가/업데이트 */
  upsertEvents(events: CalendarEvent[]): number {
    let count = 0;
    for (const event of events) {
      this.upsertEvent(event);
      count++;
    }
    return count;
  }

  /** ID로 이벤트 조회 */
  getEvent(id: string): CalendarEvent | undefined {
    return this.db.events.find(e => e.id === id);
  }

  /** 이벤트 삭제 */
  removeEvent(id: string): boolean {
    const before = this.db.events.length;
    this.db.events = this.db.events.filter(e => e.id !== id);
    return this.db.events.length < before;
  }

  // ──────────────────────────────────────────────────
  // 조회 헬퍼
  // ──────────────────────────────────────────────────

  /** N일 내 이벤트 조회 */
  getEventsWithinDays(days: number): CalendarEvent[] {
    const now = new Date();
    const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 최근 7일 지난 이벤트도 포함 (후기용)

    return this.db.events.filter(e => {
      const start = new Date(e.startDate);
      const end = new Date(e.endDate);
      return (start <= future && end >= past);
    });
  }

  /** 특정 월의 이벤트 조회 */
  getEventsByMonth(year: number, month: number): CalendarEvent[] {
    return this.db.events.filter(e => {
      const start = new Date(e.startDate);
      const end = new Date(e.endDate);
      const monthStart = new Date(year, month - 1, 1);
      const monthEnd = new Date(year, month, 0);
      return start <= monthEnd && end >= monthStart;
    });
  }

  /** 카테고리별 이벤트 조회 */
  getEventsByCategory(category: CalendarEvent['category']): CalendarEvent[] {
    return this.db.events.filter(e => e.category === category);
  }

  /** 지역별 이벤트 조회 */
  getEventsByRegion(region: string): CalendarEvent[] {
    return this.db.events.filter(e => e.location.region.includes(region));
  }

  /** upcoming/active 상태 이벤트만 */
  getActiveAndUpcoming(): CalendarEvent[] {
    return this.db.events.filter(e => e.status === 'upcoming' || e.status === 'active');
  }

  // ──────────────────────────────────────────────────
  // 라이프사이클 관리
  // ──────────────────────────────────────────────────

  /** 모든 이벤트의 status를 현재 날짜 기준으로 갱신 */
  updateLifecycles(): { updated: number; upcoming: number; active: number; past: number } {
    const now = new Date();
    let updated = 0;
    let upcoming = 0;
    let active = 0;
    let past = 0;

    for (const event of this.db.events) {
      const start = new Date(event.startDate);
      const end = new Date(event.endDate);
      let newStatus: CalendarEvent['status'];

      if (now < start) {
        newStatus = 'upcoming';
        upcoming++;
      } else if (now >= start && now <= end) {
        newStatus = 'active';
        active++;
      } else {
        newStatus = 'past';
        past++;
      }

      if (event.status !== newStatus) {
        event.status = newStatus;
        event.updatedAt = now.toISOString();
        updated++;
      }
    }

    return { updated, upcoming, active, past };
  }

  /** 오래된 past 이벤트 정리 (기본 90일) */
  cleanupPastEvents(retentionDays: number = 90): number {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const before = this.db.events.length;

    this.db.events = this.db.events.filter(e => {
      if (e.status !== 'past') return true;
      if (e.recurrence === 'yearly') return true; // 연례 이벤트는 유지
      const end = new Date(e.endDate);
      return end >= cutoff;
    });

    return before - this.db.events.length;
  }

  // ──────────────────────────────────────────────────
  // 중복 검사
  // ──────────────────────────────────────────────────

  /** 제목+날짜 기반 fuzzy 중복 검사 */
  findDuplicate(title: string, startDate: string): CalendarEvent | undefined {
    const normalizedTitle = this.normalizeTitle(title);
    const targetDate = new Date(startDate);

    return this.db.events.find(e => {
      const existingTitle = this.normalizeTitle(e.title);
      const existingDate = new Date(e.startDate);

      // 제목 유사도: 핵심 단어 50% 이상 일치
      const titleSimilarity = this.calculateTitleSimilarity(normalizedTitle, existingTitle);
      // 날짜: 7일 이내
      const daysDiff = Math.abs(targetDate.getTime() - existingDate.getTime()) / (1000 * 60 * 60 * 24);

      return titleSimilarity >= 0.5 && daysDiff <= 7;
    });
  }

  private normalizeTitle(title: string): string {
    return title
      .replace(/\s+/g, '')
      .replace(/제\d+회/, '')
      .replace(/\d{4}/, '')
      .toLowerCase();
  }

  private calculateTitleSimilarity(a: string, b: string): number {
    const aWords = new Set(a.split(''));
    const bWords = new Set(b.split(''));
    const intersection = [...aWords].filter(w => bWords.has(w));
    const union = new Set([...aWords, ...bWords]);
    return intersection.length / union.size;
  }

  // ──────────────────────────────────────────────────
  // ID 생성
  // ──────────────────────────────────────────────────

  /** 이벤트 ID 생성 */
  static generateId(source: CalendarEvent['source'], title: string, startDate: string): string {
    const slug = title
      .replace(/[^가-힣a-zA-Z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 30);
    const dateStr = startDate.replace(/-/g, '');
    return `${source}_${dateStr}_${slug}`;
  }
}

export default EventCalendarManager;
