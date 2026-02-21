/**
 * 기상청 관광코스별 관광지 상세 날씨 (TourStnInfoService1) 타입
 */

/** 관광코스 날씨 응답 아이템 */
export interface TourWeatherItem {
  /** 관광코스 ID */
  courseId?: string;
  /** 관광코스명 */
  courseName?: string;
  /** 관광지 명 */
  spotName?: string;
  /** 관광지 지역코드 */
  spotAreaId?: string;
  /** 날짜 (YYYYMMDD) */
  tm?: string;
  /** 날씨 상태 (맑음, 구름많음, 흐림, 비, 눈 등) */
  sky?: string;
  /** 최저기온 */
  tmn?: string;
  /** 최고기온 */
  tmx?: string;
  /** 강수확률 (%) */
  pop?: string;
  /** 풍속 (m/s) */
  ws?: string;
  /** 풍향 */
  wd?: string;
  /** 습도 (%) */
  reh?: string;
  /** 강수량 (mm) */
  rn?: string;
}

/** 관광지 날씨 지수 아이템 */
export interface TourWeatherIndexItem {
  /** 관광지 지역 번호 */
  areaNo?: string;
  /** 지역명 */
  areaName?: string;
  /** 날짜 (YYYYMMDD) */
  date?: string;
  /** 관광 날씨 지수 (0-100) */
  totalScore?: string;
  /** 체감 온도 */
  sensoryTem?: string;
  /** 자외선 지수 */
  uvIdx?: string;
  /** 대기 상태 */
  airIdx?: string;
}

/** 수집기에서 사용할 정규화된 날씨 데이터 */
export interface WeatherData {
  spotName: string;
  date: string;
  sky: string;
  minTemp: string;
  maxTemp: string;
  rainProb: string;
  humidity: string;
}
