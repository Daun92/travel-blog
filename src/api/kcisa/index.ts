/**
 * api.kcisa.kr (문화공공데이터광장) API — 싱글턴 팩토리 + barrel export
 * CULTURE_API_KEY 사용
 */

import { SacComprehensiveClient, SacConcertClient } from './sac.js';
import { McstFestivalClient, KrpfFestivalClient } from './festival.js';
import { TrackingClient } from './tracking.js';
import { ArkoPerformanceClient } from './performance.js';
import { PublicArtClient } from './public-art.js';

// 싱글턴 인스턴스
let sacComprehensive: SacComprehensiveClient | null = null;
let sacConcert: SacConcertClient | null = null;
let mcstFestival: McstFestivalClient | null = null;
let krpfFestival: KrpfFestivalClient | null = null;
let tracking: TrackingClient | null = null;
let arkoPerformance: ArkoPerformanceClient | null = null;
let publicArt: PublicArtClient | null = null;

function getKey(): string | null {
  return process.env.CULTURE_API_KEY || null;
}

/** #2 예술의전당 종합 공연정보 */
export function getSacComprehensiveClient(): SacComprehensiveClient | null {
  if (sacComprehensive) return sacComprehensive;
  const key = getKey();
  if (!key) return null;
  sacComprehensive = new SacComprehensiveClient({ serviceKey: key });
  return sacComprehensive;
}

/** #8 예술의전당 공연-음악회 */
export function getSacConcertClient(): SacConcertClient | null {
  if (sacConcert) return sacConcert;
  const key = getKey();
  if (!key) return null;
  sacConcert = new SacConcertClient({ serviceKey: key });
  return sacConcert;
}

/** #3 문화체육관광부 지역축제정보 */
export function getMcstFestivalClient(): McstFestivalClient | null {
  if (mcstFestival) return mcstFestival;
  const key = getKey();
  if (!key) return null;
  mcstFestival = new McstFestivalClient({ serviceKey: key });
  return mcstFestival;
}

/** #4 한국지역진흥재단 축제정보 */
export function getKrpfFestivalClient(): KrpfFestivalClient | null {
  if (krpfFestival) return krpfFestival;
  const key = getKey();
  if (!key) return null;
  krpfFestival = new KrpfFestivalClient({ serviceKey: key });
  return krpfFestival;
}

/** #5 방방곡곡 트래킹 */
export function getTrackingClient(): TrackingClient | null {
  if (tracking) return tracking;
  const key = getKey();
  if (!key) return null;
  tracking = new TrackingClient({ serviceKey: key });
  return tracking;
}

/** #6 한국문화예술위원회 공연정보 */
export function getArkoPerformanceClient(): ArkoPerformanceClient | null {
  if (arkoPerformance) return arkoPerformance;
  const key = getKey();
  if (!key) return null;
  arkoPerformance = new ArkoPerformanceClient({ serviceKey: key });
  return arkoPerformance;
}

/** #7 공공미술 작품 */
export function getPublicArtClient(): PublicArtClient | null {
  if (publicArt) return publicArt;
  const key = getKey();
  if (!key) return null;
  publicArt = new PublicArtClient({ serviceKey: key });
  return publicArt;
}

// barrel exports
export { SacComprehensiveClient, SacConcertClient } from './sac.js';
export { McstFestivalClient, KrpfFestivalClient } from './festival.js';
export { TrackingClient } from './tracking.js';
export { ArkoPerformanceClient } from './performance.js';
export { PublicArtClient } from './public-art.js';
export type {
  KcisaMetaItem,
  SacPerformanceItem,
  TrackingItem,
  PublicArtItem,
} from './types.js';
