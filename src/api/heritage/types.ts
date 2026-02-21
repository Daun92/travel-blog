/**
 * 국가유산청 문화재 공간 정보 타입
 */

/** 문화재 아이템 */
export interface HeritageItem {
  /** 문화재 명칭 */
  ccbaMnm1?: string;
  /** 문화재 영문 명칭 */
  ccbaEnm1?: string;
  /** 문화재 종목 코드 */
  ccbaKdcd?: string;
  /** 문화재 종목명 */
  ccbaKdnm?: string;
  /** 문화재 지정번호 */
  ccbaAsno?: string;
  /** 시대 */
  ccceName?: string;
  /** 소재지 */
  ccbaLcad?: string;
  /** 관리단체 */
  ccbaCpno?: string;
  /** 문화재 설명 */
  content?: string;
  /** 이미지 URL */
  imageUrl?: string;
  /** 위도 */
  latitude?: string;
  /** 경도 */
  longitude?: string;
  /** 지정/등록일 */
  ccbaAsdt?: string;
  /** 관할시도 */
  ccbaCtcdNm?: string;
  /** 관할시군구 */
  ccsiName?: string;
}

/** 수집기에서 사용할 정규화된 유산 데이터 */
export interface HeritageData {
  name: string;
  type: string;
  era: string;
  location: string;
  description: string;
  designationNo: string;
  imageUrl: string;
}
