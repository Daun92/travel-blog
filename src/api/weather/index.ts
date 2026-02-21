/**
 * 기상청 관광 날씨 API 모듈
 */

import { WeatherClient } from './client.js';
import { BaseClientConfig } from '../common/types.js';

let clientInstance: WeatherClient | null = null;

/**
 * 관광 날씨 클라이언트 싱글턴
 * data.go.kr 공용키 사용 (KTO_API_KEY)
 */
export function getWeatherClient(configOverride?: Partial<BaseClientConfig>): WeatherClient | null {
  const rawKey = process.env.KTO_API_KEY;
  if (!rawKey) return null;

  const serviceKey = rawKey.includes('%') ? decodeURIComponent(rawKey) : rawKey;

  if (!clientInstance) {
    clientInstance = new WeatherClient({
      serviceKey,
      ...configOverride,
    });
  }

  return clientInstance;
}

export function resetWeatherClient(): void {
  clientInstance = null;
}

export { WeatherClient } from './client.js';
export type { TourWeatherItem, TourWeatherIndexItem, WeatherData } from './types.js';
