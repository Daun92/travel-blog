# API 사용 규칙 레퍼런스

이 문서는 OpenClaw에서 사용하는 외부 API들의 규칙을 정리합니다.
CLAUDE.md에서 분리된 상세 레퍼런스이며, 스킬이나 에이전트가 필요 시 `Read`로 참조합니다.

---

## data.go.kr 공공 API (KorService2)

### API 키 처리 (CRITICAL)
- **ServiceKey를 URLSearchParams에 넣지 마세요**: +, =, / 문자 이중 인코딩 오류 발생
- URL 문자열 직접 삽입: `?serviceKey=${rawKey}&${otherParams}`
- 공유 클라이언트: `import { getDataGoKrClient } from '../api/data-go-kr/index.js'`

### 일일 쿼터
- 개발 계정: **1,000건/일** (자정 KST 리셋)
- `npm run api:usage`로 사용량 확인
- 80%(800건) 경고, 100% 차단
- 1회 포스트 생성(--auto-collect) ≈ 35~45 API 호출

### 레이트 리밋
- 요청 간 최소 200ms 딜레이 (DataGoKrClient 자동 관리)
- 병렬 호출 금지 → 순차 처리만
- 싱글턴 `getDataGoKrClient()`로 모듈 간 공유

### 응답 처리
- resultCode === '0000' 확인 필수
- 빈 결과: `items: ''` (빈 배열 아님)
- 단일 결과: `items.item: {}` (배열 아님) → `normalizeItems()` 사용
- contentTypeId: 12=관광지, 14=문화시설, 15=축제, 25=여행코스, 32=숙박, 39=음식점

### KorService2 파라미터 변경 (V1→V2)
- `detailCommon2`: defaultYN, addrinfoYN 등 제거됨 → contentId만으로 전부 반환
- `detailImage2`: imageYN, subImageYN 제거됨 → contentId만으로 전부 반환
- `searchFestival2`: `eventStartDate` 필수

### 캐싱
- 파일 캐시: `data/api-cache/`, TTL: 검색 60분, 상세 6시간, 지역코드 30일
- `npm run api:cache-clear`로 수동 삭제

### 데이터 정확성 경고
- 축제/행사 일정: API 지연 가능 → detailCommon2로 최신 확인
- 가격 정보: 변동 잦음 → factcheck에서 minor severity
- 운영시간: 계절별 변경 → "확인 필요" 문구 권장

### 출처 표기 (법적 의무)
- 관광 데이터: "출처: 한국관광공사"
- 문화 데이터: "출처: 문화체육관광부"
- frontmatter `dataSources` 필드에 기록

### 모듈 구조
```
src/api/data-go-kr/
  types.ts          # 응답/요청 인터페이스, 에러 클래스, 상수
  rate-limiter.ts   # 일일 쿼터 추적 (data/api-usage.json)
  cache.ts          # 파일 기반 응답 캐시 (data/api-cache/)
  client.ts         # 핵심 API 클라이언트 (DataGoKrClient)
  index.ts          # getDataGoKrClient() 싱글턴 팩토리
```

---

## KOPIS API (공연예술통합전산망)

### 기본 정보
- **Base URL**: `http://www.kopis.or.kr/openApi/restful`
- **인증**: `service` 파라미터 (주의: `serviceKey`가 아님)
- **응답 형식**: XML
- **클라이언트**: `src/api/kopis/client.ts` → `getKopisClient()` 싱글턴
- **API 문서**: `공연예술통합전산망OpenAPI개발가이드.pdf` (프로젝트 루트)

### 주요 엔드포인트

| 엔드포인트 | 용도 | 필수 파라미터 |
|-----------|------|-------------|
| `/pblprfr` | 공연 목록 검색 | `stdate`, `eddate`, `rows`, `cpage` |
| `/pblprfr/{mt20id}` | 공연 상세 조회 | mt20id |
| `/prfplc/{mt10id}` | 공연시설 상세 | mt10id |

### 검색 파라미터
- `stdate/eddate`: YYYYMMDD
- `shcate`: 장르코드 (AAAA=연극, BBBB=뮤지컬, CCCA=클래식, CCCC=대중음악)
- `signgucode`: 지역코드 (11=서울, 26=부산)
- `rows`: 최대 500

### 상세 응답 핵심 필드

| 필드 | 내용 |
|------|------|
| `prfnm` | 공연명 |
| `prfpdfrom`/`prfpdto` | 공연기간 |
| `fcltynm` | 공연시설명 |
| `pcseguidance` | 좌석별 가격 |
| `prfcast` | 출연진 |
| `poster` | 포스터 URL |
| `styurl` | 소개 이미지 URL 배열 |
| `mt10id` | 공연시설 ID |

### 에러 감지
```xml
<dbs><db><returncode>02</returncode></db></dbs>
```
→ `extractItems`에서 returncode 체크

### 현재 상태
- 키 파라미터: `service` (NOT `serviceKey`)
- 환경변수: `KOPIS_API_KEY`
- **키 재발급 필요** (kopis.or.kr에서 별도 발급)

---

## KOPIS+KTO 이중 API 공연 포스트 워크플로우

### API 역할 분담

| API | 제공 데이터 | 이미지 | 연결 키 |
|-----|-----------|--------|---------|
| **KOPIS** | 공연명, 일정, 가격, 캐스트 | 포스터 (`poster`) | `fcltynm` |
| **KTO** | 공연장 관광정보 | 건물 실사진 | `searchKeyword2` |

### KTO 연결: fcltynm → searchKeyword2

```
"롯데콘서트홀"  → keyword="롯데콘서트홀" (contentTypeId=14)
"국립극장 하늘극장" → keyword="국립극장" (contentTypeId=14)
"올림픽공원 올림픽홀" → keyword="올림픽공원" (contentTypeId=14)
"예그린씨어터" → keyword="대학로" (contentTypeId=12)
```

### 이미지-섹션 이중 배치 패턴
각 공연 섹션에 KOPIS 포스터 + KTO 공연장 실사 배치.

### 사후 처리
- frontmatter `dataSources: ["KOPIS", "한국관광공사"]`
- image-registry: KOPIS `{source: "kopis", kopisId, filename}` + KTO `{source: "kto", ktoContentId}`
- 팩트체크: KOPIS `pcseguidance`로 가격 100% 검증 가능

### KTO 커버리지 기대치

| 시설 유형 | 등록률 |
|----------|--------|
| 대형 (예술의전당, 세종문화회관) | ~95% |
| 중형 (국립극장, 롯데콘서트홀) | ~90% |
| 소형/민간 (CJ아지트) | ~50% |
| 대학로 소극장 | ~30% (→ "대학로" 관광지로 검색) |

---

## 8-API 통합 현황

| API | 상태 | 비고 |
|-----|------|------|
| KorService2 (KTO) | 활성 | 메인 관광 API |
| KOPIS | 키 재발급 필요 | 공연 메타데이터 |
| CulturePortal | 전환 완료 | `culture.go.kr` → data.go.kr 표준데이터 |
| Heritage (KHS) | 제외 | 사용자 요청 |
| Trail (산림청) | 제외 | 도메인 타임아웃 |
| Weather, Market, Festival-Std, BigData | 서비스 활성화 필요 | data.go.kr에서 KTO_API_KEY로 신청 |

검증: `npx tsx scripts/test-apis.mts`
