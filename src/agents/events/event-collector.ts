/**
 * 이벤트 수집 파이프라인
 * 5가지 소스에서 이벤트를 수집하여 EventCalendarDB에 저장
 *
 * 소스 1: 한국관광공사 KTO v2 (축제/행사)
 * 소스 2: 한국문화정보원 (공연/전시)
 * 소스 3: 문화예술공연 통합 (공연 특화)
 * 소스 4: Gemini AI 발굴 (숨은 이벤트 + 키워드 확장)
 * 소스 5: 수동 시드 (연례 이벤트 + 계절 템플릿)
 */

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { generate } from '../../generator/gemini.js';
import EventCalendarManager, {
  CalendarEvent,
  DEFAULT_TIMING,
  EventCalendarManager as ECM
} from './event-calendar.js';

// ============================================================================
// API 응답 타입
// ============================================================================

interface KTOFestivalItem {
  contentid?: string;
  title?: string;
  eventstartdate?: string;
  eventenddate?: string;
  eventplace?: string;
  addr1?: string;
  firstimage?: string;
  tel?: string;
  areacode?: string;
}

interface CultureInfoItem {
  seq?: string;
  title?: string;
  startDate?: string;
  endDate?: string;
  place?: string;
  realmName?: string;
  area?: string;
  sigungu?: string;
  price?: string;
  gpsX?: string;
  gpsY?: string;
  thumbnail?: string;
  url?: string;
  phone?: string;
}

interface EventSeedData {
  annualEvents: Array<{
    title: string;
    typicalMonth: number;
    category: CalendarEvent['category'];
    region: string;
    venue: string;
    visibility: CalendarEvent['visibility'];
    keywords: string[];
  }>;
  seasonalTemplates: Array<{
    title: string;
    month: number;
    category: 'seasonal';
    keywords: string[];
  }>;
}

interface GeminiEventResult {
  title: string;
  category: CalendarEvent['category'];
  startDate: string;
  endDate: string;
  location: string;
  region: string;
  keywords: string[];
  hiddenGems: string[];
  visibility: CalendarEvent['visibility'];
}

// ============================================================================
// 설정
// ============================================================================

const KTO_API_KEY = process.env.KTO_API_KEY || '';
const DATA_GO_KR_API_KEY = process.env.DATA_GO_KR_API_KEY || '';
const CULTURE_API_KEY = process.env.CULTURE_API_KEY || '';

const KTO_BASE = 'https://apis.data.go.kr/B551011/KorService2';
const CULTURE_INFO_BASE = 'https://apis.data.go.kr/B553457/cultureinfo';

const SEEDS_PATH = join(process.cwd(), 'config', 'event-seeds.json');

// 지역 코드 매핑 (KTO areaCode)
const AREA_CODES: Record<string, string> = {
  '서울': '1', '인천': '2', '대전': '3', '대구': '4', '광주': '5',
  '부산': '6', '울산': '7', '세종': '8', '경기': '31', '강원': '32',
  '충북': '33', '충남': '34', '경북': '35', '경남': '36', '전북': '37',
  '전남': '38', '제주': '39'
};

// ============================================================================
// EventCollector
// ============================================================================

export class EventCollector {
  private calendar: EventCalendarManager;

  constructor(calendar?: EventCalendarManager) {
    this.calendar = calendar || new EventCalendarManager();
  }

  /**
   * 전체 수집 파이프라인 실행
   */
  async sync(options: {
    month?: number;
    year?: number;
    skipApi?: boolean;
    skipGemini?: boolean;
  } = {}): Promise<{
    seeds: number;
    kto: number;
    culture: number;
    gemini: number;
    total: number;
    deduplicated: number;
  }> {
    const now = new Date();
    const targetYear = options.year || now.getFullYear();
    const targetMonth = options.month || (now.getMonth() + 1);
    const nextMonth = targetMonth === 12 ? 1 : targetMonth + 1;
    const nextMonthYear = targetMonth === 12 ? targetYear + 1 : targetYear;

    await this.calendar.load();

    console.log(`\n📅 이벤트 수집 시작 (${targetYear}년 ${targetMonth}월~${nextMonth}월)\n`);

    const stats = { seeds: 0, kto: 0, culture: 0, gemini: 0, total: 0, deduplicated: 0 };
    const allEvents: CalendarEvent[] = [];

    // 1. 수동 시드 로드
    console.log('🌱 Step 1: 연례 이벤트 시드 로드...');
    const seedEvents = await this.loadSeeds(targetYear, targetMonth, nextMonth);
    allEvents.push(...seedEvents);
    stats.seeds = seedEvents.length;
    console.log(`   ✓ ${seedEvents.length}개 시드 이벤트 로드`);

    if (!options.skipApi) {
      // 2. KTO searchFestival2
      console.log('🏛️  Step 2: KTO 축제 API 수집...');
      const ktoEvents = await this.fetchKTOFestivals(targetYear, targetMonth, nextMonth, nextMonthYear);
      allEvents.push(...ktoEvents);
      stats.kto = ktoEvents.length;
      console.log(`   ✓ ${ktoEvents.length}개 축제/행사 수집`);

      // 3. 문화정보원 period2
      console.log('🎭 Step 3: 문화정보원 API 수집...');
      const cultureEvents = await this.fetchCultureInfo(targetYear, targetMonth, nextMonth, nextMonthYear);
      allEvents.push(...cultureEvents);
      stats.culture = cultureEvents.length;
      console.log(`   ✓ ${cultureEvents.length}개 공연/전시 수집`);
    }

    // 4. 중복 제거
    console.log('🔄 Step 4: 중복 제거...');
    const beforeDedup = allEvents.length;
    const deduplicated = this.deduplicateEvents(allEvents);
    stats.deduplicated = beforeDedup - deduplicated.length;
    console.log(`   ✓ ${stats.deduplicated}개 중복 제거 (${beforeDedup} → ${deduplicated.length})`);

    // 5. Gemini 보강
    if (!options.skipGemini && process.env.GEMINI_API_KEY) {
      console.log('🤖 Step 5: Gemini AI 보강...');
      const geminiEvents = await this.enrichWithGemini(deduplicated, targetYear, targetMonth);
      stats.gemini = geminiEvents.length;
      deduplicated.push(...geminiEvents);
      console.log(`   ✓ ${geminiEvents.length}개 AI 발굴 이벤트 추가`);
    } else {
      console.log('⏭️  Step 5: Gemini AI 스킵 (API 키 없음 또는 --skipGemini)');
    }

    // 6. DB에 저장
    console.log('💾 Step 6: DB 저장...');
    const upserted = this.calendar.upsertEvents(deduplicated);
    stats.total = upserted;

    // 라이프사이클 업데이트
    const lifecycle = this.calendar.updateLifecycles();
    console.log(`   ✓ ${upserted}개 이벤트 저장 (상태 갱신: ${lifecycle.updated}개)`);
    console.log(`   📊 upcoming: ${lifecycle.upcoming}, active: ${lifecycle.active}, past: ${lifecycle.past}`);

    // 오래된 이벤트 정리
    const cleaned = this.calendar.cleanupPastEvents();
    if (cleaned > 0) {
      console.log(`   🧹 ${cleaned}개 만료 이벤트 정리`);
    }

    this.calendar.setLastSyncedAt(new Date().toISOString());
    await this.calendar.save();

    console.log(`\n✅ 이벤트 수집 완료! 총 ${stats.total}개 저장\n`);

    return stats;
  }

  // ──────────────────────────────────────────────────
  // 소스 1: 수동 시드
  // ──────────────────────────────────────────────────

  private async loadSeeds(year: number, month: number, nextMonth: number): Promise<CalendarEvent[]> {
    if (!existsSync(SEEDS_PATH)) {
      console.log('   ⚠️ event-seeds.json 없음');
      return [];
    }

    const raw = await readFile(SEEDS_PATH, 'utf-8');
    const seeds = JSON.parse(raw) as EventSeedData;
    const events: CalendarEvent[] = [];
    const now = new Date().toISOString();

    // 연례 이벤트
    for (const seed of seeds.annualEvents) {
      if (seed.typicalMonth !== month && seed.typicalMonth !== nextMonth) continue;

      // 이미 DB에 있는 연례 이벤트는 스킵 (정확한 날짜가 API에서 올 수 있음)
      const existing = this.calendar.findDuplicate(seed.title, `${year}-${String(seed.typicalMonth).padStart(2, '0')}-01`);
      if (existing) continue;

      const startDate = `${year}-${String(seed.typicalMonth).padStart(2, '0')}-15`;
      const endDate = `${year}-${String(seed.typicalMonth).padStart(2, '0')}-20`;

      events.push({
        id: ECM.generateId('manual', seed.title, startDate),
        title: seed.title,
        category: seed.category,
        startDate,
        endDate,
        location: { region: seed.region, venue: seed.venue },
        visibility: seed.visibility,
        keywords: seed.keywords,
        hiddenGems: [],
        personaFit: this.inferPersonaFit(seed.category, seed.visibility, seed.keywords),
        status: 'upcoming',
        source: 'manual',
        timing: DEFAULT_TIMING[seed.category],
        recurrence: 'yearly',
        typicalMonth: seed.typicalMonth,
        createdAt: now,
        updatedAt: now
      });
    }

    // 계절 템플릿
    for (const template of seeds.seasonalTemplates) {
      if (template.month !== month && template.month !== nextMonth) continue;

      const startDate = `${year}-${String(template.month).padStart(2, '0')}-01`;
      const endDate = `${year}-${String(template.month).padStart(2, '0')}-28`;

      const existing = this.calendar.findDuplicate(template.title, startDate);
      if (existing) continue;

      events.push({
        id: ECM.generateId('manual', template.title, startDate),
        title: template.title,
        category: 'seasonal',
        startDate,
        endDate,
        location: { region: '전국', venue: '' },
        visibility: 'major',
        keywords: template.keywords,
        hiddenGems: [],
        personaFit: { viral: 60, friendly: 80, informative: 40 },
        status: 'upcoming',
        source: 'manual',
        timing: DEFAULT_TIMING.seasonal,
        recurrence: 'yearly',
        typicalMonth: template.month,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    return events;
  }

  // ──────────────────────────────────────────────────
  // 소스 2: KTO searchFestival2
  // ──────────────────────────────────────────────────

  private async fetchKTOFestivals(
    year: number, month: number, nextMonth: number, nextMonthYear: number
  ): Promise<CalendarEvent[]> {
    if (!KTO_API_KEY) {
      console.log('   ⚠️ KTO_API_KEY 없음 - KTO 수집 스킵');
      return [];
    }

    const events: CalendarEvent[] = [];
    const startDate = `${year}${String(month).padStart(2, '0')}01`;
    const endDate = `${nextMonthYear}${String(nextMonth).padStart(2, '0')}28`;

    try {
      const params = new URLSearchParams({
        serviceKey: KTO_API_KEY,
        MobileOS: 'WIN',
        MobileApp: 'OpenClaw',
        _type: 'json',
        eventStartDate: startDate,
        numOfRows: '100',
        arrange: 'A'
      });

      const url = `${KTO_BASE}/searchFestival2?${params}`;
      const response = await fetch(url);

      if (!response.ok) {
        console.log(`   ⚠️ KTO API 오류: ${response.status} ${response.statusText}`);
        return [];
      }

      const data = await response.json() as {
        response?: { body?: { items?: { item?: KTOFestivalItem[] } } }
      };

      const items = data.response?.body?.items?.item || [];

      for (const item of items) {
        if (!item.title || !item.eventstartdate) continue;

        const evtStartDate = this.formatKTODate(item.eventstartdate);
        const evtEndDate = item.eventenddate ? this.formatKTODate(item.eventenddate) : evtStartDate;

        const region = this.inferRegionFromAddress(item.addr1 || '');
        const category = this.inferCategoryFromTitle(item.title);

        events.push({
          id: ECM.generateId('api_kto', item.title, evtStartDate),
          title: item.title,
          category,
          startDate: evtStartDate,
          endDate: evtEndDate,
          location: {
            region,
            venue: item.eventplace || '',
            address: item.addr1
          },
          visibility: this.inferVisibility(item.title),
          keywords: this.extractKeywordsFromTitle(item.title),
          hiddenGems: [],
          personaFit: this.inferPersonaFit(category, 'emerging', []),
          status: 'upcoming',
          source: 'api_kto',
          timing: DEFAULT_TIMING[category],
          thumbnail: item.firstimage,
          tel: item.tel,
          contentId: item.contentid,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    } catch (error) {
      console.log(`   ⚠️ KTO API 요청 실패: ${error}`);
    }

    return events;
  }

  // ──────────────────────────────────────────────────
  // 소스 3: 문화정보원 period2
  // ──────────────────────────────────────────────────

  private async fetchCultureInfo(
    year: number, month: number, nextMonth: number, nextMonthYear: number
  ): Promise<CalendarEvent[]> {
    if (!DATA_GO_KR_API_KEY) {
      console.log('   ⚠️ DATA_GO_KR_API_KEY 없음 - 문화정보원 수집 스킵');
      return [];
    }

    const events: CalendarEvent[] = [];
    const from = `${year}${String(month).padStart(2, '0')}01`;
    const to = `${nextMonthYear}${String(nextMonth).padStart(2, '0')}28`;

    try {
      const params = new URLSearchParams({
        serviceKey: DATA_GO_KR_API_KEY,
        from,
        to,
        numOfrows: '100',
        _type: 'json'
      });

      const url = `${CULTURE_INFO_BASE}/period2?${params}`;
      const response = await fetch(url);

      if (!response.ok) {
        console.log(`   ⚠️ 문화정보원 API 오류: ${response.status}`);
        return [];
      }

      const data = await response.json() as {
        response?: { body?: { items?: { item?: CultureInfoItem[] } } }
      };

      const items = data.response?.body?.items?.item || [];

      for (const item of items) {
        if (!item.title || !item.startDate) continue;

        const evtStartDate = this.formatCultureDate(item.startDate);
        const evtEndDate = item.endDate ? this.formatCultureDate(item.endDate) : evtStartDate;

        const category = this.inferCategoryFromRealm(item.realmName || '');
        const region = item.area || '';

        events.push({
          id: ECM.generateId('api_culture', item.title, evtStartDate),
          title: item.title,
          category,
          startDate: evtStartDate,
          endDate: evtEndDate,
          location: {
            region,
            venue: item.place || '',
            gpsX: item.gpsX ? parseFloat(item.gpsX) : undefined,
            gpsY: item.gpsY ? parseFloat(item.gpsY) : undefined
          },
          visibility: this.inferVisibility(item.title),
          keywords: this.extractKeywordsFromTitle(item.title),
          hiddenGems: [],
          personaFit: this.inferPersonaFit(category, 'emerging', []),
          status: 'upcoming',
          source: 'api_culture',
          timing: DEFAULT_TIMING[category],
          thumbnail: item.thumbnail,
          url: item.url,
          tel: item.phone,
          price: item.price,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    } catch (error) {
      console.log(`   ⚠️ 문화정보원 API 요청 실패: ${error}`);
    }

    return events;
  }

  // ──────────────────────────────────────────────────
  // 소스 4: Gemini AI 발굴 + 보강
  // ──────────────────────────────────────────────────

  private async enrichWithGemini(
    existingEvents: CalendarEvent[],
    year: number,
    month: number
  ): Promise<CalendarEvent[]> {
    const existingTitles = existingEvents.map(e => e.title).join(', ');

    const prompt = `당신은 한국의 문화/여행 이벤트 전문가입니다.

${year}년 ${month}월~${month + 1}월에 열리는 한국의 숨은 이벤트를 5개 발굴해주세요.

이미 수집된 이벤트:
${existingTitles}

요구사항:
- 위 목록에 없는 이벤트만 추천
- 소규모/신규/비주류 이벤트 우선 (독립서점 행사, 로컬 마켓, AI컨퍼런스, 막걸리박람회 등)
- 각 이벤트마다 주변 숨은 명소(히든젬) 2-3곳 추천
- 정확한 날짜를 모르면 대략적인 기간으로

JSON 형식으로 응답:
[
  {
    "title": "이벤트명",
    "category": "festival|exhibition|conference|performance",
    "startDate": "YYYY-MM-DD",
    "endDate": "YYYY-MM-DD",
    "location": "장소명",
    "region": "지역(서울/경기/부산/...)",
    "keywords": ["키워드1", "키워드2"],
    "hiddenGems": ["주변 숨은 명소1", "주변 숨은 명소2"],
    "visibility": "hidden|emerging"
  }
]

JSON 배열만 응답하세요.`;

    try {
      const response = await generate(prompt, { temperature: 0.8, max_tokens: 2048 });

      // JSON 파싱
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];

      const geminiResults = JSON.parse(jsonMatch[0]) as GeminiEventResult[];
      const events: CalendarEvent[] = [];

      for (const result of geminiResults) {
        // 기존 이벤트와 교차검증
        const duplicate = existingEvents.find(e =>
          this.normalizeForComparison(e.title) === this.normalizeForComparison(result.title)
        );
        if (duplicate) continue;

        const validCategory = ['festival', 'exhibition', 'conference', 'seasonal', 'performance'].includes(result.category)
          ? result.category as CalendarEvent['category']
          : 'festival';

        events.push({
          id: ECM.generateId('gemini', result.title, result.startDate),
          title: result.title,
          category: validCategory,
          startDate: result.startDate,
          endDate: result.endDate || result.startDate,
          location: { region: result.region || '', venue: result.location || '' },
          visibility: (result.visibility === 'hidden' || result.visibility === 'emerging') ? result.visibility : 'hidden',
          keywords: result.keywords || [],
          hiddenGems: result.hiddenGems || [],
          personaFit: this.inferPersonaFit(validCategory, 'hidden', result.keywords || []),
          status: 'upcoming',
          source: 'gemini',
          timing: DEFAULT_TIMING[validCategory],
          needsVerification: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }

      return events;
    } catch (error) {
      console.log(`   ⚠️ Gemini 발굴 실패: ${error}`);
      return [];
    }
  }

  // ──────────────────────────────────────────────────
  // 중복 제거
  // ──────────────────────────────────────────────────

  private deduplicateEvents(events: CalendarEvent[]): CalendarEvent[] {
    const unique = new Map<string, CalendarEvent>();

    for (const event of events) {
      const key = this.normalizeForComparison(event.title) + '_' + event.startDate.substring(0, 7);

      const existing = unique.get(key);
      if (!existing) {
        unique.set(key, event);
      } else {
        // API 소스가 manual보다 우선 (더 정확한 날짜)
        const priority: Record<string, number> = {
          api_kto: 3, api_culture: 3, api_performance: 3, manual: 1, gemini: 2
        };
        if ((priority[event.source] || 0) > (priority[existing.source] || 0)) {
          // API 정보로 업데이트하되 manual의 키워드/히든젬은 보존
          unique.set(key, {
            ...event,
            keywords: [...new Set([...event.keywords, ...existing.keywords])],
            hiddenGems: [...new Set([...event.hiddenGems, ...existing.hiddenGems])],
          });
        }
      }
    }

    return Array.from(unique.values());
  }

  // ──────────────────────────────────────────────────
  // 유틸리티
  // ──────────────────────────────────────────────────

  private normalizeForComparison(title: string): string {
    return title
      .replace(/\s+/g, '')
      .replace(/제\d+회/, '')
      .replace(/\d{4}년?/, '')
      .replace(/['"()\[\]]/g, '')
      .toLowerCase();
  }

  private formatKTODate(dateStr: string): string {
    // "20260315" → "2026-03-15"
    if (dateStr.length === 8) {
      return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
    }
    return dateStr;
  }

  private formatCultureDate(dateStr: string): string {
    // 다양한 형식 처리: "20260315", "2026-03-15", "2026.03.15"
    const cleaned = dateStr.replace(/[.\-/]/g, '');
    if (cleaned.length === 8) {
      return `${cleaned.substring(0, 4)}-${cleaned.substring(4, 6)}-${cleaned.substring(6, 8)}`;
    }
    return dateStr;
  }

  private inferRegionFromAddress(address: string): string {
    for (const [region] of Object.entries(AREA_CODES)) {
      if (address.includes(region)) return region;
    }
    return '';
  }

  private inferCategoryFromTitle(title: string): CalendarEvent['category'] {
    if (/축제|페스티벌|festival/i.test(title)) return 'festival';
    if (/전시|아트|갤러리|비엔날레|엑스포/i.test(title)) return 'exhibition';
    if (/공연|뮤지컬|연극|콘서트|음악회|오페라/i.test(title)) return 'performance';
    if (/컨퍼런스|포럼|세미나|심포지엄/i.test(title)) return 'conference';
    return 'festival';
  }

  private inferCategoryFromRealm(realmName: string): CalendarEvent['category'] {
    if (/연극|뮤지컬|무용|음악|오페라/i.test(realmName)) return 'performance';
    if (/전시|미술/i.test(realmName)) return 'exhibition';
    if (/축제/i.test(realmName)) return 'festival';
    return 'performance';
  }

  private inferVisibility(title: string): CalendarEvent['visibility'] {
    const majorKeywords = ['국제', '대한민국', '서울', '부산', '세계', 'KIAF', '비엔날레'];
    if (majorKeywords.some(k => title.includes(k))) return 'major';
    return 'emerging';
  }

  private extractKeywordsFromTitle(title: string): string[] {
    const keywords: string[] = [];
    const patterns = [
      '축제', '페스티벌', '전시', '공연', '뮤지컬', '연극', '콘서트',
      '재즈', '클래식', '영화', '미술', '사진', '디자인', '패션',
      '맛집', '음식', '와인', '커피', '마켓', '야시장',
      '벚꽃', '단풍', '불꽃', '등', '빛'
    ];

    for (const pattern of patterns) {
      if (title.includes(pattern)) keywords.push(pattern);
    }

    return keywords;
  }

  private inferPersonaFit(
    category: CalendarEvent['category'],
    visibility: CalendarEvent['visibility'],
    keywords: string[]
  ): CalendarEvent['personaFit'] {
    const fit = { viral: 50, friendly: 50, informative: 50 };

    // 카테고리별 기본 적합도
    if (category === 'festival') { fit.viral = 80; fit.friendly = 70; }
    if (category === 'exhibition') { fit.informative = 80; fit.viral = 40; }
    if (category === 'performance') { fit.informative = 75; fit.friendly = 60; }
    if (category === 'seasonal') { fit.friendly = 85; fit.viral = 70; }

    // visibility 보정
    if (visibility === 'major') { fit.viral += 10; }
    if (visibility === 'hidden') { fit.friendly += 10; fit.informative += 5; }

    // 키워드 보정
    const viralKeywords = ['핫플', 'SNS', '인스타', '트렌드', 'TOP', '최고'];
    const friendlyKeywords = ['가성비', '주말', '데이트', '가족', '체험'];
    const infoKeywords = ['역사', '건축', '미술사', '유네스코', '교양'];

    for (const kw of keywords) {
      if (viralKeywords.some(v => kw.includes(v))) fit.viral += 5;
      if (friendlyKeywords.some(v => kw.includes(v))) fit.friendly += 5;
      if (infoKeywords.some(v => kw.includes(v))) fit.informative += 5;
    }

    // 0-100 범위로 클램프
    fit.viral = Math.min(100, Math.max(0, fit.viral));
    fit.friendly = Math.min(100, Math.max(0, fit.friendly));
    fit.informative = Math.min(100, Math.max(0, fit.informative));

    return fit;
  }
}

export default EventCollector;
