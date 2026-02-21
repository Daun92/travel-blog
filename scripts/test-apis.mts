/**
 * API 키 검증 스크립트
 * 기존 5개 (KorService2, Weather, BigData, KOPIS, Heritage)
 * + 신규 8개 (CultureInfo, SAC종합, 문체부축제, 지역진흥축제, 트래킹, ARKO공연, 공공미술, SAC음악회)
 */
import { config } from 'dotenv';
config();

console.log('=== API 키 검증 ===\n');

const results: { name: string; status: string; detail: string }[] = [];

// ────────────────────────── 기존 API ──────────────────────────

// 0. KorService2 (기존 — 기준선)
console.log('--- 0. KorService2 (기존) ---');
try {
  const { getDataGoKrClient } = await import('../src/api/data-go-kr/index.js');
  const c = getDataGoKrClient();
  if (!c) {
    results.push({ name: 'KorService2', status: '❌', detail: 'KTO_API_KEY 없음' });
  } else {
    const r = await c.searchKeyword('서울', { numOfRows: 2 });
    results.push({ name: 'KorService2', status: '✅', detail: `${r.length}건` });
    console.log(`✅ ${r.length}건`);
  }
} catch (e: any) {
  results.push({ name: 'KorService2', status: '❌', detail: e.message?.slice(0, 80) });
  console.log(`❌ ${e.message?.slice(0, 80)}`);
}

// 1. Weather
console.log('\n--- 1. Weather ---');
try {
  const { getWeatherClient } = await import('../src/api/weather/index.js');
  const c = getWeatherClient();
  if (!c) {
    results.push({ name: 'Weather', status: '❌', detail: '클라이언트 null' });
  } else {
    const r = await c.getCourseWeather('1', { numOfRows: 2 });
    results.push({ name: 'Weather', status: '✅', detail: `${r.length}건` });
    console.log(`✅ ${r.length}건`);
  }
} catch (e: any) {
  results.push({ name: 'Weather', status: '❌', detail: e.message?.slice(0, 80) });
  console.log(`❌ ${e.message?.slice(0, 80)}`);
}

// 2. BigData
console.log('\n--- 2. BigData ---');
try {
  const { getBigDataClient } = await import('../src/api/bigdata/index.js');
  const c = getBigDataClient();
  if (!c) {
    results.push({ name: 'BigData', status: '❌', detail: '클라이언트 null' });
  } else {
    const r = await c.getVisitorStats('11', { numOfRows: 2 });
    results.push({ name: 'BigData', status: '✅', detail: `${r.length}건` });
    console.log(`✅ ${r.length}건`);
  }
} catch (e: any) {
  results.push({ name: 'BigData', status: '❌', detail: e.message?.slice(0, 80) });
  console.log(`❌ ${e.message?.slice(0, 80)}`);
}

// 3. KOPIS
console.log('\n--- 3. KOPIS ---');
try {
  const { getKopisClient } = await import('../src/api/kopis/index.js');
  const c = getKopisClient();
  if (!c) {
    results.push({ name: 'KOPIS', status: '❌', detail: 'KOPIS_API_KEY 없음' });
  } else {
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const r = await c.searchPerformances({ keyword: '서울', startDate: today, rows: 2 });
    results.push({ name: 'KOPIS', status: '✅', detail: `${r.length}건` });
    console.log(`✅ ${r.length}건`);
  }
} catch (e: any) {
  results.push({ name: 'KOPIS', status: '❌', detail: e.message?.slice(0, 80) });
  console.log(`❌ ${e.message?.slice(0, 80)}`);
}

// 4. Heritage (국가유산청 — 인증 키 불필요)
console.log('\n--- 4. Heritage (국가유산청) ---');
try {
  const { getHeritageClient } = await import('../src/api/heritage/index.js');
  const c = getHeritageClient();
  const r = await c.searchHeritage('경복궁', { numOfRows: 2 });
  results.push({ name: 'Heritage', status: '✅', detail: `${r.length}건` });
  console.log(`✅ ${r.length}건`);
} catch (e: any) {
  results.push({ name: 'Heritage', status: '❌', detail: e.message?.slice(0, 80) });
  console.log(`❌ ${e.message?.slice(0, 80)}`);
}

// ────────────────────────── 신규 API ──────────────────────────

// 5. CultureInfo (한눈에보는문화정보 — data.go.kr, KTO_API_KEY)
console.log('\n--- 5. CultureInfo (한눈에보는문화정보) ---');
try {
  const { getCultureInfoClient } = await import('../src/api/culture-info/index.js');
  const c = getCultureInfoClient();
  if (!c) {
    results.push({ name: 'CultureInfo', status: '❌', detail: 'KTO_API_KEY 없음' });
  } else {
    const r = await c.searchByPeriod({ rows: 3 });
    results.push({ name: 'CultureInfo', status: '✅', detail: `${r.length}건` });
    console.log(`✅ ${r.length}건`);
  }
} catch (e: any) {
  results.push({ name: 'CultureInfo', status: '❌', detail: e.message?.slice(0, 80) });
  console.log(`❌ ${e.message?.slice(0, 80)}`);
}

// 6. SAC 종합 공연정보 (예술의전당 — kcisa, CULTURE_API_KEY)
console.log('\n--- 6. SAC 종합 공연정보 ---');
try {
  const { getSacComprehensiveClient } = await import('../src/api/kcisa/index.js');
  const c = getSacComprehensiveClient();
  if (!c) {
    results.push({ name: 'SAC종합', status: '❌', detail: 'CULTURE_API_KEY 없음' });
  } else {
    const r = await c.searchPerformances({ numOfRows: 3 });
    results.push({ name: 'SAC종합', status: '✅', detail: `${r.length}건` });
    console.log(`✅ ${r.length}건`);
  }
} catch (e: any) {
  results.push({ name: 'SAC종합', status: '❌', detail: e.message?.slice(0, 80) });
  console.log(`❌ ${e.message?.slice(0, 80)}`);
}

// 7. 문화체육관광부 지역축제정보 (kcisa)
console.log('\n--- 7. 문체부 지역축제 ---');
try {
  const { getMcstFestivalClient } = await import('../src/api/kcisa/index.js');
  const c = getMcstFestivalClient();
  if (!c) {
    results.push({ name: '문체부축제', status: '❌', detail: 'CULTURE_API_KEY 없음' });
  } else {
    const r = await c.searchFestivals({ numOfRows: 3 });
    results.push({ name: '문체부축제', status: '✅', detail: `${r.length}건` });
    console.log(`✅ ${r.length}건`);
  }
} catch (e: any) {
  results.push({ name: '문체부축제', status: '❌', detail: e.message?.slice(0, 80) });
  console.log(`❌ ${e.message?.slice(0, 80)}`);
}

// 8. 한국지역진흥재단 축제정보 (kcisa)
console.log('\n--- 8. 지역진흥재단 축제 ---');
try {
  const { getKrpfFestivalClient } = await import('../src/api/kcisa/index.js');
  const c = getKrpfFestivalClient();
  if (!c) {
    results.push({ name: '진흥재단축제', status: '❌', detail: 'CULTURE_API_KEY 없음' });
  } else {
    const r = await c.searchFestivals({ numOfRows: 3 });
    results.push({ name: '진흥재단축제', status: '✅', detail: `${r.length}건` });
    console.log(`✅ ${r.length}건`);
  }
} catch (e: any) {
  results.push({ name: '진흥재단축제', status: '❌', detail: e.message?.slice(0, 80) });
  console.log(`❌ ${e.message?.slice(0, 80)}`);
}

// 9. 방방곡곡 트래킹 (kcisa)
console.log('\n--- 9. 트래킹 (둘레길) ---');
try {
  const { getTrackingClient } = await import('../src/api/kcisa/index.js');
  const c = getTrackingClient();
  if (!c) {
    results.push({ name: '트래킹', status: '❌', detail: 'CULTURE_API_KEY 없음' });
  } else {
    const r = await c.searchTrails({ numOfRows: 3 });
    results.push({ name: '트래킹', status: '✅', detail: `${r.length}건` });
    console.log(`✅ ${r.length}건`);
  }
} catch (e: any) {
  results.push({ name: '트래킹', status: '❌', detail: e.message?.slice(0, 80) });
  console.log(`❌ ${e.message?.slice(0, 80)}`);
}

// 10. ARKO 공연정보 (한국문화예술위원회 — kcisa)
console.log('\n--- 10. ARKO 공연정보 ---');
try {
  const { getArkoPerformanceClient } = await import('../src/api/kcisa/index.js');
  const c = getArkoPerformanceClient();
  if (!c) {
    results.push({ name: 'ARKO공연', status: '❌', detail: 'CULTURE_API_KEY 없음' });
  } else {
    const r = await c.searchPerformances({ numOfRows: 3 });
    results.push({ name: 'ARKO공연', status: '✅', detail: `${r.length}건` });
    console.log(`✅ ${r.length}건`);
  }
} catch (e: any) {
  results.push({ name: 'ARKO공연', status: '❌', detail: e.message?.slice(0, 80) });
  console.log(`❌ ${e.message?.slice(0, 80)}`);
}

// 11. 공공미술 작품 (kcisa)
console.log('\n--- 11. 공공미술 ---');
try {
  const { getPublicArtClient } = await import('../src/api/kcisa/index.js');
  const c = getPublicArtClient();
  if (!c) {
    results.push({ name: '공공미술', status: '❌', detail: 'CULTURE_API_KEY 없음' });
  } else {
    const r = await c.searchArtworks({ numOfRows: 3 });
    results.push({ name: '공공미술', status: '✅', detail: `${r.length}건` });
    console.log(`✅ ${r.length}건`);
  }
} catch (e: any) {
  results.push({ name: '공공미술', status: '❌', detail: e.message?.slice(0, 80) });
  console.log(`❌ ${e.message?.slice(0, 80)}`);
}

// 12. SAC 공연-음악회 (예술의전당 — kcisa)
console.log('\n--- 12. SAC 음악회 ---');
try {
  const { getSacConcertClient } = await import('../src/api/kcisa/index.js');
  const c = getSacConcertClient();
  if (!c) {
    results.push({ name: 'SAC음악회', status: '❌', detail: 'CULTURE_API_KEY 없음' });
  } else {
    const r = await c.searchConcerts({ numOfRows: 3 });
    results.push({ name: 'SAC음악회', status: '✅', detail: `${r.length}건` });
    console.log(`✅ ${r.length}건`);
  }
} catch (e: any) {
  results.push({ name: 'SAC음악회', status: '❌', detail: e.message?.slice(0, 80) });
  console.log(`❌ ${e.message?.slice(0, 80)}`);
}

// ────────────────────────── 결과 요약 ──────────────────────────

console.log('\n=== 요약 ===');
console.log(''.padEnd(75, '─'));
console.log(`${'#'.padEnd(4)} ${'API'.padEnd(18)} ${'상태'.padEnd(4)} ${'비고'}`);
console.log(''.padEnd(75, '─'));
for (let i = 0; i < results.length; i++) {
  const r = results[i];
  console.log(`${String(i).padEnd(4)} ${r.name.padEnd(18)} ${r.status}  ${r.detail}`);
}
console.log(''.padEnd(75, '─'));

const working = results.filter(r => r.status === '✅').length;
console.log(`\n작동: ${working}/${results.length}`);

if (working < results.length) {
  const failed = results.filter(r => r.status === '❌').map(r => r.name);
  console.log(`실패: ${failed.join(', ')}`);
}
