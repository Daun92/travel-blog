/**
 * 기상청 관광코스별 관광지 상세 날씨 클라이언트
 * TourStnInfoService1 — data.go.kr 공용키 사용
 * 엔드포인트: /getTourStnVilageFcst1, /getCityTourClmIdx1
 */

import { BaseDataGoKrClient } from '../common/base-client.js';
import { BaseClientConfig } from '../common/types.js';
import { TourWeatherItem, TourWeatherIndexItem } from './types.js';

const WEATHER_BASE = 'http://apis.data.go.kr/1360000/TourStnInfoService1';

export class WeatherClient extends BaseDataGoKrClient {
  protected readonly baseUrl = WEATHER_BASE;

  constructor(config: BaseClientConfig) {
    super({
      ...config,
      usageFilePath: config.usageFilePath ?? 'data/api-usage-weather.json',
      serviceName: 'TourStnInfoService1',
    });
  }

  /** 기상청 API는 MobileOS/MobileApp 불필요, dataType=JSON 사용 */
  protected override getDefaultParams(): Record<string, string> {
    return { dataType: 'JSON' };
  }

  /**
   * 관광코스별 동네예보 조회
   * @param courseId 관광코스 ID (COURSE_ID)
   * @param date 조회 날짜 (YYYYMMDD)
   * @param hour 조회 시각 (HH, 02/05/08/11/14/17/20/23)
   */
  async getCourseWeather(
    courseId: string,
    opts?: { date?: string; hour?: string; numOfRows?: number }
  ): Promise<TourWeatherItem[]> {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const params: Record<string, string> = {
      COURSE_ID: courseId,
      CURRENT_DATE: opts?.date ?? today,
      HOUR: opts?.hour ?? '12',
      numOfRows: String(opts?.numOfRows ?? 10),
    };

    return this.request<TourWeatherItem>('/getTourStnVilageFcst1', params, 'search');
  }

  /**
   * 시군구별 관광기후지수 조회
   * @param cityAreaId 시군구 지역 ID
   * @param day 조회 기간 (0=오늘, 1=내일, 2=모레)
   */
  async getAreaWeather(
    cityAreaId: string,
    opts?: { date?: string; day?: string; numOfRows?: number }
  ): Promise<TourWeatherIndexItem[]> {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const params: Record<string, string> = {
      CITY_AREA_ID: cityAreaId,
      CURRENT_DATE: opts?.date ?? today,
      DAY: opts?.day ?? '0',
      numOfRows: String(opts?.numOfRows ?? 10),
    };

    return this.request<TourWeatherIndexItem>('/getCityTourClmIdx1', params, 'search');
  }
}
