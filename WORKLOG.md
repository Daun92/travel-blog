# OpenClaw 작업 기록 (Worklog)

## 프로젝트 개요

**프로젝트명:** OpenClaw - AI 기반 여행/문화 블로그 자동화 시스템
**목표:** 월 1,000명 방문자 달성 (4개월 내)
**기술 스택:** TypeScript, Hugo, Gemini API (텍스트/이미지), Unsplash API, Windows Task Scheduler

---

## 개발 이력

### 2026-02-12: 공주 백제유적 + 제천 청풍호 포스트 — 이미지 레이아웃 + 콘텐츠 교정 + 프롬프트 오염 근절

#### 발행 포스트

| 포스트 | 에이전트 | 타입 | 팩트체크 | AEO |
|--------|---------|------|---------|-----|
| 공주 백제유적 디깅 가이드: 왕릉의 벽돌부터 경비행기까지 | 오덕우 (niche) | culture | 100% | ✅ |
| 제천 청풍호 1박2일 겨울 여행 — 리솜포레스트부터 케이블카까지 | 김주말 (friendly) | travel | 100% | ✅ |

#### Phase 1: 을지로 7-Image 레이아웃 패턴 적용

이전 세션에서 수립한 을지로 7장 패턴(커버 + 도입 일러스트 + KTO×2 + 스틸컷×2~3 + 마감 일러스트)을 두 포스트에 적용.

**이미지 생성** (`scripts/gen-0212-images.mts`): Gemini API 5회 호출

| 이미지 | 포스트 | 스타일 | 용량 |
|--------|--------|--------|------|
| stillcut-12-1 (왕릉원 능선, 안개+필름그레인) | 공주 | cover_photo (오덕우 인디) | 858KB |
| stillcut-12-2 (무령왕릉 벽돌 연꽃 매크로) | 공주 | cover_photo (오덕우 인디) | 856KB |
| closing-12 (디깅 레벨 체크리스트) | 공주 | bucketlist (일러스트) | 820KB |
| stillcut-post-1 (리솜포레스트 야간 전동카트) | 제천 | cover_photo (김주말 라이프) | 925KB |
| stillcut-post-2 (케이블카 안 청풍호 파노라마) | 제천 | cover_photo (김주말 라이프) | 742KB |

**도입 일러스트 재배치**: 두 포스트 모두 기존 섹션 1 인라인에 있던 일러스트를 타이틀 직후 도입부로 이동.

**최종 이미지 레이아웃 (각 6 inline + 1 cover = 7장)**:

공주 백제유적 (culture, 오덕우):

| # | 위치 | 타입 | 파일 |
|---|------|------|------|
| 0 | 커버 | AI 포토+관인(틸) | cover-2026-02-12-12 |
| 1 | 도입부 | 일러스트 (moodboard) | inline-12-1 |
| 2 | 1층 능선 | **스틸컷** | stillcut-12-1 |
| 3 | 2층 벽돌 | **스틸컷** | stillcut-12-2 |
| K2 | 3층 금강변 | KTO 실사 | kto-12-2 |
| K1 | 4층 공산성 | KTO 실사 (**교체됨**) | kto-12-1 |
| 4 | 마감부 | 일러스트 (bucketlist) | closing-12 |

제천 청풍호 (travel, 김주말):

| # | 위치 | 타입 | 파일 |
|---|------|------|------|
| 0 | 커버 | AI 포토+관인(오렌지) | cover-2026-02-12-post |
| 1 | 도입부 | 일러스트 (여행가이드) | inline-post-1 |
| 2 | 리솜포레스트 | **스틸컷** | stillcut-post-1 |
| 3 | 케이블카 | **스틸컷** | stillcut-post-2 |
| K1 | 치유의숲 | KTO 실사 | kto-post-1 |
| K2 | 덕주사 | KTO 실사 | kto-post-2 |
| 4 | 마감부 | 일러스트 (코스맵) | inline-post-2 |

**Gemini 이미지 쿼터**: 6 → 11/50

#### Phase 2: KTO 이미지-컨텍스트 불일치 교체

**문제**: 공주 4층(경비행기) 섹션의 KTO 이미지가 **지상에서 올려다 본 경비행기** — 본문은 "위에서 내려다보는" 시점으로 금강이 공산성을 휘감는 구도를 묘사.

**조사**: KTO API 캐시에서 경비행기(contentId 3038514) 4장, 공산성(contentId 125949) 10장을 검토.
- 경비행기 4장: 전부 지상 촬영 (활주로, 격납고, 주기 장면)
- 공산성 10장 중 castle-8 (contentId 3084170): 높은 시점에서 금강+정자+성곽이 보이는 구도 → 본문 "금강이 공산성을 휘감아 도는 구도"와 직접 일치

**수정**: `kto-2026-02-12-12-1.jpg`를 castle-8로 교체. 캡션: "공주 경비행기 — 하늘에서 읽는 백제의 레이아웃" → "공산성과 금강 — 위에서 내려다본 백제의 방어 구도"

#### Phase 3: 날조된 전시회 정보 수정

**문제**: 공주 포스트 "서울에서 예습하기" 섹션에 **국립현대미술관 서울**과 **예술의전당** 전시회 링크가 포함됨. 실제 백제 관련 전시는 해당 기관에서 열리지 않음 — Gemini가 날조.

**수정 3건**:

| 위치 | Before (날조) | After (검증) |
|------|--------------|-------------|
| L177-186 | 국립현대미술관 서울 + 예술의전당 특별전 | 국립중앙박물관 백제실 + 국립공주박물관 |
| L26-27 (keywords) | 국립현대미술관 서울, 예술의전당 특별전 | 국립중앙박물관 백제실, 국립공주박물관 |
| L188 | 김주말의 현실적인 총평 | 오덕우의 현실적인 총평 (페르소나 이름 오류) |

#### Phase 4: 프롬프트 Few-shot 오염 근절 (근본 원인)

**근본 원인**: `src/generator/prompts.ts`의 LINK 마커 사용 예시에 **구체적인 실존 장소/공연명**이 하드코딩되어 있었음. Gemini가 이를 few-shot 예시가 아닌 **콘텐츠 제안**으로 해석하여 본문에 삽입.

**Travel 프롬프트 (L151-157)**:

| Before (오염 소스) | After (추상 플레이스홀더) |
|-------------------|------------------------|
| `[LINK:map:성산일출봉]` | `[LINK:map:{장소명}]` |
| `[LINK:search:제주 올레길 코스]` | `[LINK:search:{검색어}]` |
| `[LINK:official:https://www.visitjeju.net:비짓제주]` | `[LINK:official:{URL}:{표시텍스트}]` |

**Culture 프롬프트 (L258-266)**:

| Before (오염 소스) | After (추상 플레이스홀더) |
|-------------------|------------------------|
| `[LINK:map:국립현대미술관 서울]` | `[LINK:map:{장소명}]` |
| `[LINK:booking:뮤지컬 오페라의 유령]` | `[LINK:booking:{공연/전시명}]` |
| `[LINK:yes24:라이온 킹 뮤지컬]` | `[LINK:yes24:{공연/전시명}]` |
| `[LINK:official:https://www.mmca.go.kr:국립현대미술관]` | `[LINK:official:{URL}:{표시텍스트}]` |

#### 도출된 워크플로우 개선사항

**개선 1: KTO 이미지-컨텍스트 매칭 검증**

KTO API 이미지는 검색어 기반으로 자동 선택되므로, 본문의 시점/맥락과 불일치할 수 있음.
→ Layer 3 체크리스트에 추가: "KTO 이미지가 본문 묘사(시점, 계절, 장면)와 일치하는지 확인"

**개선 2: 프롬프트 예시 추상화 원칙**

LLM 프롬프트 내 few-shot 예시에 실존 장소/기관/공연명을 사용하면 콘텐츠 오염 발생.
→ 프롬프트의 모든 예시는 `{플레이스홀더}` 형태로 작성. 구체적 이름 하드코딩 금지.

**개선 3: 페르소나 이름 교차 오염 방지**

오덕우 포스트에 "김주말의 총평"이 혼입됨 — 프롬프트 생성 시 `personaId`에 매핑된 필명만 사용하도록 검증 필요.

#### 수정 파일 요약

| 파일 | 작업 |
|------|------|
| `blog/content/posts/culture/2026-02-12-12.md` | 도입부 일러스트 이동 + 스틸컷 2장 삽입 + 마감 일러스트 삽입 + KTO 이미지 교체 + 날조 전시회 수정 + 페르소나 이름 수정 + 키워드 수정 |
| `blog/content/posts/travel/2026-02-12-post.md` | 도입부 일러스트 이동 + 스틸컷 2장 삽입 |
| `drafts/2026-02-12-12.md` | blog 동기화 |
| `drafts/2026-02-12-post.md` | blog 동기화 |
| `src/generator/prompts.ts` | Travel/Culture 프롬프트 LINK 예시 → 추상 플레이스홀더 교체 |
| `scripts/gen-0212-images.mts` | 신규 — 5장 이미지 생성 스크립트 |
| `blog/static/images/stillcut-*`, `closing-*` | 신규 — Gemini 생성 이미지 5장 |
| `blog/static/images/kto-2026-02-12-12-1.jpg` | castle-8 (금강 뷰)로 교체 |

---

### 2026-02-12: KTO 인라인 이미지 전수 오딧 — 맥락 불일치 3건 교정

#### 배경

전체 7개 포스트에 사용된 KTO 인라인 이미지 16장을 전수 점검. 자동 배치 시 검색 순서 기반이므로 섹션 주제와 이미지 내용이 불일치하는 경우가 발생.

#### 오딧 프로세스

1. `grep`으로 전체 포스트 KTO 이미지 사용 현황 수집 (16장, 7포스트)
2. 각 이미지 alt text와 섹션 본문 대조 → 3건 mismatch 식별
3. `scripts/kto-image-audit.mts` 작성 — detailImage API + 캐시 데이터로 후보 이미지 수집
4. `blog/static/images/audit/index.html` 비교 갤러리 생성 → 브라우저에서 시각 비교
5. 최적 후보 선택 → 이미지 교체 + alt text 갱신

#### 교체 내역

| 포스트 | 파일 | Before | After | 근거 |
|--------|------|--------|-------|------|
| 부산 골목 | kto-busan-2 | 갤럭시 롯데프리미엄아울렛 동부산점 | 광복로 겨울빛 트리축제 (festival-4) | 섹션3: 트리축제 → 아울렛 이미지 mismatch |
| 강릉 겨울 | kto-gangneung-2 | 경포로 누정 시·문학 기행 | 굴산사지 당간지주 (gulsan-13) | 섹션3: 굴산사지 → 경포 누정 mismatch |
| 을지로 디깅 | kto-12-2 | 을지로 철제가구거리 | 세운상가 지하 공구 골목 (sewoon-detail-3) | 섹션3: 지하상가 → 철제가구거리 mismatch |

#### 확인된 정상 매칭 (13장)

감천사(busan-1), 경포대(gangneung-1), 노가리골목(12-1), 성수동·미술관·문래동·서촌·을지로·신당동(9 posts), 고마나루(공주-1, 이전 세션 교정 완료), 치유의숲·덕주사(제천)

#### API 쿼터

- 사용: 31/1000 (오딧 시작) → 약 45/1000 (완료)
- 캐시 활용: 굴산사지 이미지 7장 전부 캐시 URL 직접 다운로드 (API 0)

#### 수정 파일

| 파일 | 작업 |
|------|------|
| `blog/content/posts/travel/2026-02-10-busan.md` | alt text 갱신 (트리축제) |
| `blog/content/posts/travel/2026-02-10-gangneung.md` | alt text 갱신 (굴산사지 당간지주) |
| `blog/content/posts/travel/2026-02-11-12.md` | alt text 갱신 (세운상가 공구골목) |
| `drafts/2026-02-11-12.md` | blog 동기화 |
| `blog/static/images/kto-2026-02-10-busan-2.jpg` | festival-4로 교체 (490→138KB) |
| `blog/static/images/kto-2026-02-10-gangneung-2.jpg` | gulsan-13으로 교체 (609→552KB) |
| `blog/static/images/kto-2026-02-11-12-2.jpg` | sewoon-detail-3으로 교체 (441→152KB) |
| `data/image-registry.json` | 교체 이미지 3건 등록 |
| `scripts/kto-image-audit.mts` | 신규 — 오딧용 이미지 수집 스크립트 |

---

### 2026-02-12: 인라인 이미지 최소 기준 포스트 KTO 실사진 보강

#### 배경

전체 47개 포스트 인라인 이미지 수 점검 → 3개 포스트가 최소 기준(travel 2개, culture 1개)의 경계선에 위치. 모두 AI 일러스트만 2장씩 보유하고 KTO 실사진이 0장이어서, 콘텐츠 신뢰도 향상을 위해 KTO 이미지를 추가.

#### 대상 포스트 및 추가 이미지

| 포스트 | 타입 | Before | After | 추가 이미지 |
|--------|------|--------|-------|------------|
| 직장인 템플스테이 (2026-02-07-1) | travel | 2 (AI×2) | **5** | 묘각사, 마곡사 천연송림, 전등사 (KTO×3) |
| 제주 오름 지질학 (2026-02-11-368) | travel | 2 (AI×2) | **4** | 성산일출봉, 산방산유채꽃밭 (KTO×2) |
| 목포 근대역사 산책 (2026-02-11-post) | culture | 2 (AI×2) | **3** | 달성사(목포) (KTO×1) |

#### KTO API 이미지 소싱

3단계 스크립트로 점진적 탐색:

1. `kto-image-boost.mts` — 직접 키워드 검색: 6곳 중 3곳 성공 (묘각사, 성산일출봉, 산방산)
2. `kto-image-boost-2.mts` — 실패 장소 대체 검색: 마곡사→천연송림욕장(126849), 유달산(606003), 달성사(299979), 전등사(125534)
3. `kto-image-boost-3.mts` — 최종 다운로드: 5장 추가 다운로드

**시각 검증**: Chrome MCP로 각 이미지를 열어 본문 맥락과 일치 확인. 유달산 이미지(상가 거리 사진)는 부적합하여 삭제.

#### 캡션 품질 개선

3개 포스트의 기존 AI 일러스트 캡션 "AI 생성 ~" → 맥락 연결 내러티브 캡션으로 교체:

| 포스트 | Before | After |
|--------|--------|-------|
| 템플스테이 | AI 생성 코스 지도 / AI 생성 비교 가이드 | 강화도 전등사 주변 산책 동선 / 묘각사·전등사·마곡사 한눈 비교 |
| 제주 오름 | AI 생성 여행 가이드 / AI 생성 오름 분포 지도 | 세 가지 오름 형성 원리 한 장 / 368개 오름 동서 분포 패턴 |
| 목포 | AI 생성 무드보드 / AI 생성 여행 가이드 | 서산동 언덕에서 내려다본 원도심 / 목포 5미 한눈 정리 |

#### API 쿼터

- 시작: 36/1000 → 완료: 약 55/1000
- KTO 이미지 다운로드 자체는 API call 아님 (HTTP fetch)

#### 수정 파일

| 파일 | 작업 |
|------|------|
| `blog/content/posts/travel/2026-02-07-1.md` | KTO 이미지 3장 삽입 + dataSources 추가 + 캡션 교체 |
| `blog/content/posts/travel/2026-02-11-368.md` | KTO 이미지 2장 삽입 + dataSources 추가 + 캡션 교체 |
| `blog/content/posts/culture/2026-02-11-post.md` | KTO 이미지 1장 삽입 + dataSources 추가 + 캡션 교체 |
| `data/image-registry.json` | KTO 이미지 6건 등록 |
| `blog/static/images/kto-2026-02-07-1-*.jpg` | 신규 — 묘각사, 마곡사, 전등사 (3장) |
| `blog/static/images/kto-2026-02-11-368-*.jpg` | 신규(368-3) + 교체(368-4) — 성산일출봉, 산방산 (2장) |
| `blog/static/images/kto-2026-02-11-post-4.jpg` | 신규 — 달성사 |
| `blog/static/images/kto-2026-02-11-post-3.jpg` | 삭제 — 유달산 (부적합) |
| `scripts/kto-image-boost-*.mts` | 신규 — 3단계 이미지 탐색 스크립트 |

---

### 2026-02-11: 을지로 디깅 포스트 이미지 전면 재설계 + 마커 후처리 수정 + 워크플로우 개선

#### 배경

오덕우(niche) 첫 포스트 "을지로 공구골목 디깅" 발행 후, 3가지 품질 이슈 발견:
1. AI 생성 일러스트가 본문 섹션의 구체적 디테일과 맥락 불일치
2. 수동 편집 과정에서 `[LINK:map:...]` / `[IMAGE:moodboard:...]` 마커가 미처리된 채 발행
3. 인라인 이미지 3번(inline-...-3.jpeg)이 생성되지 않아 404 발생

#### Phase 1: 미처리 마커 수정

**문제**: `generator/index.ts`의 마커 처리 파이프라인(`processLinksWithInfo`, `processInlineImages`)은 최초 생성 시에만 실행됨. 수동 편집 후 재생성 없이 발행하면 raw 마커가 그대로 노출.

| 마커 | 위치 | 수정 |
|------|------|------|
| `[LINK:map:을지로 노가리골목]` | L122 | → 네이버 지도 URL |
| `[LINK:map:을지로 철제가구거리]` | L137 | → 네이버 지도 URL |
| `[IMAGE:moodboard:을지로 골목 감성 무드보드]` | L184 | 제거 (인라인 이미지 3장 존재) |

**근본 원인**: `link-processor.ts`와 `content-parser.ts`의 마커 처리가 `generator/index.ts` 파이프라인에만 연결되어 있고, 수동 편집 → 발행 경로에서는 마커 검증 단계가 없음.

커밋: `0c2bf36`

#### Phase 2: 누락 인라인 이미지 생성

**문제**: `inline-2026-02-11-12-3.jpeg`가 생성되지 않아 본문의 `![을지로 골목의 시간 흔적]` 이미지가 404.

**수정**: 별도 스크립트로 인라인 이미지 생성 → `infographic` 스타일 (1987 맨홀, 간판 글씨체 변화, 전단지 아카이브).

커밋: `74cdde5`

#### Phase 3: AI 일러스트 → 섹션별 맥락 스틸컷 교체

**문제**: 기존 AI 일러스트(`infographic`/`diagram` 스타일)가 범용적이어서 본문의 구체적 디테일과 연결되지 않음.

| 섹션 | Before (일러스트) | After (스틸컷) |
|------|-------------------|----------------|
| 1층 노가리골목 | 맥락 없는 "디깅 루트" | 좁은 골목 플라스틱 의자+노가리+맥주, 35mm 필름 톤 |
| 2층 철제가구거리 | 맥락 없는 "공정 디테일" | 용접 자국 클로즈업+도면+철가루 빛 반사 |
| 4층 시간 흔적 | 맥락 없는 "시간 다이어리" | 맨홀 뚜껑 "1987" 조감+갈라진 아스팔트 |

**스틸컷 프롬프트 설계 원칙**:
- 본문의 "발견한 디테일" 항목에서 구체적 피사체 추출
- `cover_photo` 스타일 사용 (포토리얼리즘 강제)
- 35mm 필름 그레인, 다큐멘터리 색감, 얕은 심도
- 섹션의 핵심 "한 장면"을 스틸컷처럼 포착

**캡션 개선**: "AI 생성 여정 일러스트" → 맥락 연결 내러티브로 변경
- *노가리골목의 밤 — 플라스틱 의자 사이로 흐르는 을지로의 리듬*
- *철제가구거리의 시간 — 장인의 손끝에서 태어나는 1mm의 정밀함*
- *1987년이 새겨진 맨홀 — 을지로 골목 바닥에 잠든 시간의 지층*

커밋: `2acb4fa`

#### Phase 4: 도입부/마감부 일러스트 추가

**설계 판단**: 본문 섹션은 스틸컷(사실적, 맥락 연결)이 적합하지만, 도입부/마감부는 일러스트(구조 시각화, 감성 요약)가 역할에 맞음.

| 위치 | 스타일 | 컨셉 |
|------|--------|------|
| 도입부 (타이틀 직후) | `diagram` (보물지도) | 을지로 4-Layer 단면도: 표면→단골→인사이더→덕질 |
| 마감부 (디깅 메모 직후) | `bucketlist` (체크리스트) | 오덕우의 을지로 디깅 체크리스트: BEGINNER→MASTER |

커밋: `bc85a93`

#### 최종 이미지 레이아웃 (7장)

| # | 위치 | 타입 | 역할 |
|---|------|------|------|
| 0 | 커버 | AI 포토+관인 | 오덕우 틸 관인 + 을지로 골목 |
| 4 | 도입부 | **일러스트** | 4-Layer 보물지도 단면도 |
| K1 | 1층 노가리 | KTO 실사 | 한국관광공사 제공 |
| 1 | 1층 노가리 | **스틸컷** | 노가리+맥주 다큐 풍경 |
| 2 | 2층 철제 | **스틸컷** | 용접 작업장 클로즈업 |
| K2 | 3층 지하상가 | KTO 실사 | 한국관광공사 제공 |
| 3 | 4층 시간 | **스틸컷** | 맨홀 "1987" 조감 |
| 5 | 마감부 | **일러스트** | 디깅 체크리스트 게이미피케이션 |

#### 도출된 워크플로우 개선사항

**개선 1: 이미지 역할 분리 원칙 (Image Role Separation)**

| 영역 | 적합 타입 | 이유 |
|------|-----------|------|
| 커버 | AI 포토리얼리스틱 + 관인 | 첫인상, 브랜딩 |
| 도입/마감 | 일러스트 (diagram/bucketlist/moodboard) | 구조 시각화, 감성 요약 |
| 본문 섹션 | 스틸컷 (cover_photo 스타일) 또는 KTO 실사 | 맥락 연결, 디테일 증거 |

→ CLAUDE.md 이미지 생성 원칙에 추가

**개선 2: 스틸컷 프롬프트 설계 프로토콜**

본문 "발견한 디테일" → 피사체 추출 → 다큐멘터리 스틸컷 프롬프트:
- `cover_photo` 스타일 (포토리얼리즘 강제)
- 구체적 피사체 + 분위기 + 촬영 스타일 3파트 구조
- 35mm 필름 그레인, 얕은 심도, 자연광

**개선 3: 마커 잔존 검증 — publish 전 필수**

수동 편집 후에도 `[LINK:` / `[IMAGE:` 패턴이 남아있으면 발행 차단.
→ Layer 3 체크리스트에 추가, pre-commit-check.mts에 검증 규칙 추가 권장

**개선 4: 이미지 파일 존재 검증 — publish 전 필수**

본문의 `![](path)` 경로가 실제 `blog/static/images/`에 대응 파일이 있는지 확인.
→ Layer 3 체크리스트에 추가

**개선 5: 캡션 가이드라인**

| Before | After |
|--------|-------|
| "AI 생성 여정 일러스트" (기계적) | 맥락 연결 내러티브 (본문 디테일 요약) |
| 모든 AI 이미지에 동일 패턴 | 이미지가 전달하는 메시지를 em dash(—)로 연결 |

#### 수정 파일 요약

| 파일 | 작업 |
|------|------|
| `blog/content/posts/travel/2026-02-11-12.md` | 마커 수정 + 스틸컷 3장 교체 + 도입/마감 일러스트 2장 추가 + 캡션 변경 |
| `drafts/2026-02-11-12.md` | 동일 |
| `blog/static/images/inline-...-{1,2,3}.jpeg` | 스틸컷으로 교체 (기존 파일 덮어씀) |
| `blog/static/images/inline-...-{4,5}.jpeg` | 도입/마감 일러스트 신규 |
| `scripts/gen-stillcut-images.mts` | 스틸컷 생성 스크립트 (재사용 가능) |
| `scripts/gen-illust-intro-outro.mts` | 도입/마감 일러스트 생성 스크립트 |
| `CLAUDE.md` | 이미지 역할 분리 원칙 + Layer 3 체크리스트 강화 |

**Gemini 이미지 쿼터**: 45 → 50/50 (5장 생성: 스틸컷 3 + 일러스트 2)

---

### 2026-02-11: 스틸컷 프롬프트 프로토콜 범용화 (페르소나×타입 매트릭스)

#### 배경

이전 세션에서 수립한 스틸컷 프롬프트 프로토콜이 오덕우(niche) 전용으로 작성됨:
- "발견한 디테일" 추출 → 오덕우의 미시적 관찰 관점에 한정
- 35mm 필름 그레인, 다큐멘터리 색감 → 오덕우의 인디 스트릿 촬영 스타일에 한정
- 다른 3인 에이전트(조회영/김주말/한교양)에게 적용 시 톤 불일치 발생

#### 변경 내용

**1. 페르소나별 피사체 추출 전략 분화**

| 페르소나 | 추출 대상 | 예시 |
|---------|----------|------|
| 조회영 (viral) | 화제성·임팩트 장면 | 줄 선 맛집, 야경 뷰포인트, 비교 대상 |
| 김주말 (friendly) | 체험 현장 | 테이블 위 음식, 산책로, 체크인 장면 |
| 한교양 (informative) | 구조·디테일 | 기둥 양식, 단청 패턴, 전시실 전경 |
| 오덕우 (niche) | 발견한 디테일 | 맨홀 각인, 간판 글씨체, 바닥 타일 |

**2. 촬영 스타일 — `cover-styles.ts` AGENT_VISUAL_IDENTITIES와 1:1 매핑**

| 페르소나 | 촬영 스타일 | 구도 | 색감 |
|---------|-----------|------|------|
| 조회영 | 에디토리얼 매거진 | 대각선, 히어로 프레이밍 | 고대비, 강한 채도 |
| 김주말 | 라이프스타일 | 눈높이, 중심 배치 | 웜톤, 골든 하이라이트 |
| 한교양 | 건축 사진 | 대칭, 삼분할 | 균형 노출, 쿨 섀도 |
| 오덕우 | 인디 스트릿 | 타이트 클로즈업, 비중심 | 뮤트 톤, 필름 에뮬레이션 |

**3. 포스트 타입별 ATMOSPHERE 분리**
- travel: 현장감, 공간의 공기, 계절감, 빛의 변화
- culture: 고요함, 집중, 지적 호기심, 전시장 조명

**4. 캡션 톤 페르소나별 분화**
- 조회영: 짧고 강렬 — *한옥마을 야경 — 이 뷰, 리얼임*
- 김주말: 솔직 체험 — *시장통 점심 — 8,000원에 이 정도면 인정*
- 한교양: 해설적 — *종묘 어칸 구조 — 19칸 연속 배치의 건축적 의미*
- 오덕우: 발견 서사 — *철제가구거리의 시간 — 장인의 손끝에서 1mm의 정밀함*

#### 수정 파일

| 파일 | 작업 |
|------|------|
| `CLAUDE.md` | 스틸컷 프로토콜 전면 교체 (단일→4인 매트릭스), 캡션 가이드라인 확장 |
| `MEMORY.md` | 페르소나별 스틸컷 분화 요약 추가 |

#### 설계 판단

커버 이미지 시스템(`cover-styles.ts`)과 인라인 스틸컷 프로토콜(`CLAUDE.md`)이 동일한 비주얼 아이덴티티 소스를 공유하게 됨. 에이전트별 시각적 일관성이 커버 → 본문 스틸컷 → 캡션까지 관통하는 구조.

---

### 2026-02-11: 커버 이미지 시스템 복원 + 프롬프트 충돌 수정 + 7포스트 커버 재생성

#### 배경

이전 세션에서 삭제된 cover-styles.ts / cover-overlay.ts / reference-analyzer.ts를 dist/ 컴파일 JS에서 복원. 이후 커버 이미지 품질 평가 → 7포스트 재생성.

#### Phase 1: 파일 복원 (dist/ → src/)

| 파일 | 줄수 | 복원 방법 |
|------|------|-----------|
| `src/images/cover-styles.ts` | 285 | dist/images/cover-styles.js → TS 재구성 |
| `src/images/cover-overlay.ts` | 147 | dist/images/cover-overlay.js → TS 재구성 |
| `src/images/reference-analyzer.ts` | 153 | dist/images/reference-analyzer.js → TS 재구성 |

#### Phase 2: contentHints 시스템 추가 (피사체 정확도 개선)

**문제**: "발렌타인 데이트 국내 여행지 TOP 5" 커버에 남산타워 생성 — 포스트 본문에는 부산/광안리/양양/고령만 포함, 남산 없음.
**원인**: `getCoverPhotoPrompt()`가 제목만 사용하고 본문 내용을 프롬프트에 반영하지 않음.

**수정**:
- `cover-styles.ts`: `getSubjectDirection()`에 `contentHints?: string[]` 파라미터 추가
- `refresh-covers.mts`: `readPostMeta()`에서 `## 헤딩` 파싱 → `contentHints` 배열로 전달
- 프롬프트에 "ACTUAL CONTENT of this post covers these specific places/topics" 블록 주입

#### Phase 3: 프롬프트 충돌 수정 (하단 흰색/텍스트 문제)

**문제**: 제주 오름 커버 하단 ~15% 흰색 바, 목포 근대역사 커버 하단 ~40% 흰색 + AI 생성 텍스트 캡션.
**근본 원인**: `gemini-imagen.ts`의 `cover_photo` 스타일과 `cover-styles.ts`의 3-Layer 프롬프트가 충돌.

| 충돌 지점 | 기존 (문제) | 수정 후 |
|-----------|------------|---------|
| `gemini-imagen.ts` cover_photo | "leave bottom area clean for text overlay" | "Fill ENTIRE frame edge-to-edge" |
| `gemini-imagen.ts` 공통 CRITICAL | "All Korean text READABLE" + "Vector-style" → 텍스트/벡터 지시가 사진에 적용 | `cover_photo`일 때 공통 CRITICAL 스킵 |
| `cover-styles.ts` CRITICAL | "Use full frame" (약한 표현) | "NO white space at bottom" + "zero text of any kind" 강화 |

#### Phase 4: 7포스트 커버 재생성 결과

| 포스트 | 에이전트 | Before | After | 핵심 개선 |
|--------|---------|--------|-------|-----------|
| 발렌타인 TOP 5 | 김주말 | 1/9 (남산타워) | 8/9 | 광안리 드론쇼+광안대교 (본문 반영) |
| 제주 오름의 지질학 | 한교양 | 2/9 → 6/9 (흰색바) | **8/9** | 오름+돌담 프레임 꽉 채움 |
| 목포 근대역사 산책 | 한교양 | 1/9 → 3/9 (텍스트) | **9/9** | 근대 벽돌 골목+유달산 원경, 텍스트 0 |
| 부산의 결 (산복도로) | 한교양 | 2/9 | 8/9 | 산복도로 계단+항구 뷰 |
| 겨울 강릉 여행 | 한교양 | 1/9 | 7/9 | 눈 덮인 석주+겨울 산안개 |
| 부산 맥락 (문화공간) | 한교양 | 2/9 | 8/9 | 산업유산 문화공간+조각 설치 |

**평균 점수**: Before 1.6/9 → After **8.0/9** (+400%)
**Gemini 사용량**: 34 → 41/50 (일일 한도 내)

#### 수정 파일 요약

| 파일 | 작업 |
|------|------|
| `src/images/cover-styles.ts` | 복원 + contentHints + CRITICAL 강화 |
| `src/images/cover-overlay.ts` | 복원 (관인 오버레이) |
| `src/images/reference-analyzer.ts` | 복원 + 타입 호환성 수정 |
| `src/images/gemini-imagen.ts` | cover_photo 프롬프트 충돌 해소 |
| `scripts/refresh-covers.mts` | contentHints 파싱 + overlay-only 모드 |

---

### 2026-02-11: 이미지 오케스트레이터 통합 + 미사용 코드 제거 + 파이프라인 단순화

#### 배경

이미지 처리 로직이 `new.ts`(78줄)와 `generator/index.ts`(175줄)에 산재하고, 미사용 모듈 3개(495줄)가 방치된 상태. 파이프라인도 DAG/sequential 이중 경로가 병존하여 불필요한 복잡도 존재.

#### Phase 1: 이미지 오케스트레이터 생성

`src/images/image-orchestrator.ts` (373줄) 신규 생성 — 산재한 이미지 로직을 단일 진입점으로 통합.

| 추출 원본 | 함수 | 역할 |
|-----------|------|------|
| `new.ts:164~242` | `selectCoverImage()` | KTO→Unsplash 커버 폴백 |
| `generator/index.ts:288~409` | `processInlineImages()` | KTO+AI 하이브리드 인라인 |
| `generator/index.ts:240~268` | `extractContentContext()` | 헤딩/장소명 추출 |
| `generator/index.ts:414~476` | `insertKtoImages()` | H2/H3 뒤 실사진 삽입 |

#### Phase 2: 호출부 간소화

- **`new.ts`**: 6개 직접 import → `selectCoverImage` 1개로 교체, 78줄 인라인 로직 → ~30줄
- **`generator/index.ts`**: `processInlineImages` + 3개 헬퍼 함수 제거 (총 ~175줄), 오케스트레이터 호출로 교체
- 미사용 import 정리: `format`(date-fns), `generateStream`(gemini.js) 등

#### Phase 3: 미사용 모듈 삭제 (총 495줄)

| 파일 | 줄수 | 삭제 근거 |
|------|------|-----------|
| `cover-overlay.ts` | 149 | 외부 import 0건 (페르소나 도장 오버레이, 미통합) |
| `cover-styles.ts` | 189 | cover-overlay + reference-analyzer에서만 사용 |
| `reference-analyzer.ts` | 157 | unsplash.ts 스코어링 개선으로 대체됨 |

#### Phase 4: 파이프라인 단순화

- `pipeline.ts`: `runSequential()` (~75줄), `runStage()` (~45줄), `getStageResult()` (~5줄) 제거
- `parallel?: boolean` 옵션 제거 → DAG 모드만 사용
- CLI `--parallel`/`--no-parallel` 옵션 제거

#### Phase 5: CLAUDE.md 재정리

- "Image System (3-Source Hybrid)" (~106줄) → "이미지 생성 원칙" (~30줄) + "이미지 시스템 상세" (~40줄)로 분리
- "Premium Content Workflow" (~250줄) → "포스트 관리 레이어" 4계층 구조로 재편
  - Layer 1: Discovery / Layer 2: Generation / Layer 3: Validation / Layer 4: Publish+Feedback
- Architecture 섹션에 오케스트레이터 반영

#### 수정 파일 요약

| 파일 | 작업 | 줄수 변화 |
|------|------|-----------|
| `src/images/image-orchestrator.ts` | **신규** | +373 |
| `src/cli/commands/new.ts` | 간소화 | -68 |
| `src/generator/index.ts` | 간소화 | -175 |
| `src/workflow/pipeline.ts` | sequential 제거 | -125 |
| `src/cli/commands/pipeline.ts` | --parallel 옵션 제거 | -5 |
| `src/images/cover-overlay.ts` | **삭제** | -149 |
| `src/images/cover-styles.ts` | **삭제** | -189 |
| `src/images/reference-analyzer.ts` | **삭제** | -157 |
| `CLAUDE.md` | 이미지 원칙 + 레이어 구조 | -200 (압축) |

**순 변화**: 약 -500줄 (미사용 코드 제거 + 산재 로직 통합)

#### 검증

빌드 4회 통과 (Phase 1~4 각 단계 후). 최종 워크플로우 검증:

| 포스트 | 워크플로우 | 평균 점수 | 상태 |
|--------|-----------|----------|------|
| 제주 오름의 지질학 (travel) | `workflow full --apply` | 65% | ✅ 발행 가능 |
| 목포 근대역사 산책 (culture) | `workflow full --apply` | 62% | ⚠️ 검토 필요 (factcheck 60%) |

- 두 포스트 모두 이미지 검증 80% 통과 (인라인 2개 확인)
- 오케스트레이터 통합 및 DAG-only 전환 후 기존 워크플로우 정상 동작 확인

---

### 2026-02-10: 2편 추가 발행 — 강릉 겨울 인문학 + 부산 골목 여행

#### 파이프라인 실행 (DAG 모드)

`npm run pipeline -- all --verbose`로 Discovery→EventBus 통합 검증 겸 콘텐츠 생산.

| Stage | Duration | 결과 |
|-------|----------|------|
| discover | 241s | 12 topics (9 trending + 5 gaps), balance: informative +19 부스트 |
| monitor | 241s | 100 posts, avg 910.8 upvotes |
| select | 1ms | 2 topics selected |
| generate | 258s | 2 posts (한교양/informative) |
| validate | 0ms | (draft mode) |
| publish | 0ms | (draft mode) |

#### 발행 포스트

| 포스트 | 에이전트 | 프레이밍 | 팩트체크 | AEO |
|--------|---------|---------|---------|-----|
| 겨울 강릉 여행, 인문학적 시선으로 바라본 동해의 깊은 정취 | 한교양 | seasonal | 100% (6/6) | FAQ 5 + Schema 3 |
| 부산의 결을 읽다: 산복도로의 애환과 동래의 전통이 깃든 골목 여행 | 한교양 | local_story | 84% (3건 수정) | FAQ 5 + Schema 3 |

#### 팩트체크 수정 내역 — 부산 포스트

| 원본 (AI 생성) | 수정값 (검증) | 검증 소스 |
|---------------|-------------|----------|
| 왔다식당 주소: 남항서로 97 | **하나길 811** (청학동 386-197) | diningcode.com |
| 초량밀면 가격: 6,000원 | **6,500원** | triple.guide |
| 스지전골 가격: 12,000원 | **14,000원** | diningcode.com |

#### 추가 수정

- 커버 이미지 경로 누락: `/images/` → `/travel-blog/images/` (두 포스트 모두)
- Post 2 frontmatter 손상 복구: AEO 도구가 `relative: false hidden: false`를 caption에 병합 → 원래 구조로 복원

#### 배포

- blog repo: `git commit + push` → GitHub Actions 빌드
- 커밋: `9db884e` (10 files: 2 posts + 2 covers + 6 inline images)

---

### 2026-02-10: Discovery 파이프라인 → EventBus/DAG 유기적 통합

#### 배경

Phase 1-5 워크플로우 아키텍처(EventBus, QualityMesh, DAG)는 구현 완료되었으나,
**주제 발굴(Discovery) 파이프라인이 이벤트 레이어에 연결되지 않은 상태**였음.

- `TopicDiscovery` 6개 내부 단계가 console.log만 사용 → EventBus 이벤트 0개
- `ContentBalancer` 분석/부스트 계산이 외부에 보이지 않음
- `queue discover` CLI와 `pipeline discover` DAG가 별도 경로
- 발굴 → 생성 → 검증 → 발행 → 피드백 → 발굴 순환 루프 끊김

#### 변경 사항

**Phase 1: EventBus에 Discovery 이벤트 8개 추가** (`src/workflow/event-bus.ts`)
- `discovery:phase-start`, `trending-complete`, `gap-complete`, `recommendations`
- `balance-applied`, `enhanced-phase`, `queue-populated`, `complete`
- WorkflowEvents 인터페이스 append-only 확장

**Phase 2: TopicDiscovery에 EventBus 주입** (`src/agents/moltbook/topic-discovery.ts`)
- 생성자에 optional `eventBus` 파라미터 추가
- `discover()`: 트렌딩/갭/추천/밸런스 각 단계에서 이벤트 emit
- `discoverEnhanced()`: OpenClaw 스캔, Vote 스캔, 완료 이벤트 emit
- 미전달 시 기존과 100% 동일 동작 (optional chaining)

**Phase 3: Pipeline stageDiscover에서 EventBus 전달** (`src/workflow/pipeline.ts`)
- `stageDiscover()`에서 `getEventBus()` → `TopicDiscovery` 생성자로 전달
- `discovery:phase-start` / `discovery:complete` 이벤트 발행

**Phase 4: Queue CLI를 EventBus에 연결** (`src/cli/commands/queue.ts`)
- `queue discover` 핸들러에서 EventBus → TopicDiscovery 전달
- autoPopulateQueue 후 `discovery:queue-populated` 이벤트 발행
- 시작/종료 시 `phase-start` / `complete` 이벤트 발행

**Phase 5: Scheduler 피드백 루프 완성** (`src/workflow/scheduler.ts`)
- `discovery:complete` 구독 → 발굴 결과 로깅
- `discovery:queue-populated` 구독 → 큐 크기 로깅 + 생성 힌트
- `feedback:strategy-updated` 확장 → 발굴 재실행 힌트 추가

**Phase 6: ContentBalancer 이벤트 발행** (`src/agents/moltbook/content-balancer.ts`)
- 생성자에 optional `eventBus` 파라미터 추가
- TopicDiscovery가 ContentBalancer 생성 시 자신의 eventBus 전달

#### 수정 파일

| 파일 | 변경 | 위험도 |
|------|------|--------|
| `src/workflow/event-bus.ts` | discovery 이벤트 8개 추가 | GREEN |
| `src/agents/moltbook/topic-discovery.ts` | EventBus optional + emit 7곳 | GREEN |
| `src/agents/moltbook/content-balancer.ts` | EventBus optional 파라미터 | GREEN |
| `src/workflow/pipeline.ts` | stageDiscover에 EventBus 전달 | GREEN |
| `src/cli/commands/queue.ts` | EventBus 연결 + queue-populated emit | GREEN |
| `src/workflow/scheduler.ts` | discovery 이벤트 구독 2개 + 기존 확장 | GREEN |

#### 결과

유기적 순환 흐름 완성:
```
발굴 → 큐 편성 → 생성 → 검증 → 발행 → 피드백 수집 → 전략 갱신 → 발굴 (순환)
  ↑                                                              ↓
  └──────── discovery:queue-populated ←── feedback:strategy-updated
```

- `npm run pipeline all --verbose`와 `npm run queue discover` 모두 동일한 EventBus로 이벤트 발행
- 스케줄러가 발굴/큐 편성 이벤트를 구독하여 피드백 루프 연결
- 모든 변경이 append-only / optional parameter → 기존 동작 100% 유지

---

### 2026-02-10: 2월 10일 포스트 2편 발행 + 파이프라인 품질 분석

#### 콘텐츠 생산

**생성 포스트:**
- Travel: "강릉 겨울에 오히려 좋은 이유" (김주말/friendly) — `--auto-collect --inline-images`
- Travel: "부산 감천사에서 F1963까지" (한교양/informative) — `--auto-collect --inline-images`

**Phase B 실행:**
| 단계 | 강릉 | 부산 |
|------|------|------|
| Generate | `--auto-collect --inline-images -y` ✅ | 동일 ✅ |
| Factcheck (Claude native) | 90% → 100% ✅ | 57% BLOCKED → 100% ✅ |
| AEO | FAQ 5 + Schema 3 ✅ | 동일 ✅ |
| Publish | `--skip-validation` ✅ | 동일 ✅ |

#### AI 날조(Hallucination) 수정 — 부산 포스트

**문제:** Gemini가 존재하지 않는 장소/전시를 생성함
| 날조된 정보 | 실제 대체 | 검증 방법 |
|-------------|----------|-----------|
| "갤러리이알디" (Gallery IARD) | F1963 (부산 수영구 구락로123번길 20) | WebSearch: 존재하지 않는 갤러리 |
| "예술의전당 부산 전시" | F1963 국제갤러리 + 부산현대미술관 | WebSearch: 부산에 예술의전당 없음 |

- 제목 변경: `감천사에서 갤러리이알디까지` → `감천사에서 F1963까지`
- 섹션 2 전체 재작성 (F1963 실제 정보 기반)
- keywords, frontmatter 전부 갱신
- 수정 후 factcheck 재실행: 5/5 verified, 100%

**특이사항:** KTO API에는 "갤러리이알디 부산"이 contentId로 존재하나, 실제 웹검색에서 확인 불가 → API 데이터도 100% 신뢰 불가

#### 이미지 slug 충돌 수정

**문제:** 같은 날짜 포스트 2편이 동일 slug(`2026-02-10-post`)로 생성 → 이미지 파일명 충돌
- `kto-2026-02-10-post-1.jpg` — 강릉용으로 생성 후 부산이 덮어씀
- `inline-2026-02-10-post-1.jpeg` — AI 이미지도 동일 현상

**수정:**
| 파일 | Before (공유) | After (고유) |
|------|--------------|-------------|
| KTO 커버 | `kto-2026-02-10-post-{1,2}.jpg` | `kto-2026-02-10-gangneung-{1,2}.jpg` / `kto-2026-02-10-busan-{1,2}.jpg` |
| AI 인라인 | `inline-2026-02-10-post-1.jpeg` | `inline-2026-02-10-gangneung-1.jpeg` / `inline-2026-02-10-busan-1.jpeg` |

- KTO 이미지: 수집 데이터에서 포스트별 관련 사진 재다운로드
- AI 인라인: `scripts/gen-inline-images-0210.mts` 스크립트로 포스트별 고유 생성
- `tsx -e` 인라인 스크립트가 ESM import 시 무출력 → `.mts` 파일로 우회

#### 2월 9일 성수동 포스트 KTO 실사진 보강

**문제:** 2월 9일 성수동 포스트 2편에 AI 일러스트만 있고 KTO 실사진이 없음 (이전 세션에서 다운로드만 하고 삽입 안 됨)

**수정:**
| 포스트 | 추가된 KTO 이미지 |
|--------|------------------|
| 성수동은 왜 떴나 (김주말) | 성수동 거리 + 국립현대미술관 전경 (2장) |
| 문화 핫플 TOP 5 (조회영) | 문래동 + 서촌 + 을지로 + 신당동 (4장) |

- 총 6개 KTO 실사진 삽입 + `*출처: 한국관광공사*` 캡션
- `dataSources: ["한국관광공사"]` frontmatter 추가

**커밋:**
- `e0645e0` feat: 강릉 겨울 여행 + 부산 F1963 포스트 발행
- `2a91422` fix: 인라인 이미지 slug 충돌 수정 — 포스트별 고유 파일명 적용
- `8a59abb` fix: 포스트별 고유 AI 인라인 이미지 생성 및 적용
- `a1e54ef` feat: 2월 9일 성수동 포스트 2편에 KTO 실사진 인라인 이미지 추가

---

### 2026-02-10: 파이프라인 품질 갭 분석 — 왜 수동 수정이 반복되는가

2월 9일, 2월 10일 포스트 발행 과정에서 **매번 동일한 유형의 수동 수정이 반복**됨. 근본 원인을 분석한다.

#### 반복된 수동 수정 패턴

| # | 문제 유형 | 2/9 발생 | 2/10 발생 | 파이프라인 단계 |
|---|----------|----------|-----------|----------------|
| 1 | AI 날조 (존재하지 않는 장소/전시) | 미검증 클레임 수동 수정 | 갤러리이알디, 예술의전당 부산 | Generate → Factcheck 사이 |
| 2 | 이미지-본문 맥락 불일치 | 4장 교체 (경주·전주·제주도) | — | Generate (이미지 프롬프트) |
| 3 | 이미지 slug 충돌/공유 | — | 같은 날짜 2포스트 이미지 덮어씀 | Generate (slug 생성) |
| 4 | KTO 실사진 미삽입 | — | 다운로드만 하고 본문 삽입 누락 | Generate → Publish 사이 |
| 5 | 페르소나 불일치 | 김주말→조회영/한교양 수동 수정 | — | Generate (프롬프트) |
| 6 | 이미지 경로 prefix 누락 | `/images/` → `/travel-blog/images/` | — | Generate (frontmatter) |
| 7 | factcheckScore 미설정 | 수동 추가 | 수동 추가 | Publish 전 |
| 8 | enhance 후 이미지 마크다운 삭제 | 수동 재삽입 | — | Enhance |

#### 근본 원인 분석

**원인 1: 사후 검증만 존재, 사전 예방 없음**

현재 파이프라인: `Generate → (수동) Factcheck → (수동) Validate → (수동) Publish`

- Factcheck는 **파일 생성 후** 별도 단계로 실행
- 생성 시점에 collected data와 교차 검증하는 로직이 없음
- AI가 수집 데이터에 없는 장소를 자유롭게 생성 가능

**기대**: Generate 단계 자체가 hallucination을 방지해야 함
**현실**: Generate가 자유 생성 → Factcheck가 사후 적발 → 수동 수정

**원인 2: 이미지 파이프라인에 고유성 보장 없음**

- slug 생성 (`generateSlug`)이 날짜 + 제목 기반이라 같은 날 유사 제목 = 충돌
- 이미지 파일명이 slug에 종속되어 있어 slug 충돌 = 이미지 덮어씀
- KTO 이미지 다운로드 → 본문 삽입이 분리되어 있어 삽입 누락 가능
- cross-post 이미지 중복 체크 없음

**원인 3: 워크플로우 단계가 독립적이고 수동 실행**

Premium Workflow가 8단계로 정의되어 있지만:
- 각 단계가 별도 CLI 명령 (`npm run new`, `npm run enhance`, `npm run factcheck`, ...)
- 단계 간 데이터 흐름이 끊김 (e.g. collected data → generate 연결, factcheck → auto-fix 연결)
- 사람이 직접 순서대로 실행해야 하므로 단계 누락 발생
- `npm run workflow full`이 존재하나 모든 케이스를 커버하지 못함

**원인 4: 품질 기대치와 자동화 수준의 괴리**

| 기대 | 현실 |
|------|------|
| 초안이 80% 이상 완성도 | 초안이 50-60% (날조, 이미지 불일치 포함) |
| factcheck가 생성 중 차단 | factcheck가 생성 후 별도 실행 |
| 이미지가 본문 맥락과 정합 | 이미지 프롬프트에 본문 내용 미반영 |
| 같은 날 복수 포스트 독립 | slug 충돌로 이미지 공유/덮어씀 |
| enhance가 품질만 높임 | enhance가 이미지 삭제, 새 날조 도입 가능 |

#### 개선 방향: 초안 품질 80%+ / 최종본 95%+ 달성 로드맵

##### Phase 1: Generate 단계 강화 (초안 품질 → 80%)

**1-A. 프롬프트에 collected data 제약 주입**
```
현재: "부산 여행 포스트를 작성해주세요" + context
개선: "아래 수집된 장소만 사용하세요. 수집 데이터에 없는 장소/전시를
       절대 만들지 마세요." + collectedData JSON 원본 주입
```
- `generator/prompts.ts`에 collected data 기반 장소 허용 목록(allowlist) 삽입
- 프롬프트에 "허용 목록 외 장소 언급 시 [미확인] 태그 부착" 지시

**1-B. slug에 고유 식별자 추가**
```
현재: 2026-02-10-post (날짜+제목)
개선: 2026-02-10-gangneung-1707123456 (날짜+키워드+timestamp)
```
- `frontmatter.ts`의 `generateSlug()`에 timestamp suffix 또는 기존 파일 검사 추가
- 이미지 파일명도 slug 기반이므로 자동으로 고유해짐

**1-C. KTO 이미지 자동 삽입**
- `processInlineImages()`에서 KTO 다운로드 → 즉시 본문 삽입 (현재 분리됨)
- 삽입 위치: 관련 H2/H3 섹션 직후 자동 배치
- `*출처: 한국관광공사*` 캡션 자동 추가

**1-D. 이미지 프롬프트에 본문 섹션 요약 주입**
```
현재: 제목만으로 이미지 생성 ("부산 여행 가이드 인포그래픽")
개선: 본문 각 섹션의 핵심 장소/키워드를 이미지 프롬프트에 포함
      ("감천사 등산길 → F1963 갤러리 → 광복로 트리축제 코스 가이드")
```

##### Phase 2: Validate 단계 자동화 (최종본 → 95%)

**2-A. 생성 직후 자동 factcheck (blocking)**
```
현재: npm run new → (수동) npm run factcheck
개선: npm run new 내부에서 generate → factcheck → 70% 미만이면 재생성/경고
```
- `new.ts`에 factcheck 자동 호출 옵션 (`--auto-factcheck`)
- 70% 미만: 날조 의심 클레임 목록 출력 + 재생성 또는 중단 선택

**2-B. enhance 후 자동 재검증**
```
현재: enhance → (끝)
개선: enhance → diff 추출 → 새로 추가된 클레임만 factcheck → 날조 시 rollback
```

**2-C. 발행 전 통합 게이트 (`npm run publish` 강화)**
```
✅ factcheckScore ≥ 70
✅ 인라인 이미지 ≥ 2 (travel) / ≥ 1 (culture)
✅ 이미지 경로 /travel-blog/ prefix 확인
✅ author-personaId 일관성 확인
✅ KTO 이미지 출처 표기 확인 (dataSources)
✅ slug 고유성 확인 (기존 포스트와 충돌 없음)
```

##### Phase 3: 피드백 루프 자동화 (지속적 개선)

**3-A. 반복 수정 패턴 자동 감지**
- WORKLOG에서 반복되는 수동 수정 패턴을 추적
- 3회 이상 반복되면 파이프라인 자동화 대상으로 플래그

**3-B. 포스트별 품질 대시보드**
```json
{
  "slug": "2026-02-10-busan",
  "initialFactcheck": 57,
  "finalFactcheck": 100,
  "manualFixes": ["hallucination", "image-slug", "image-missing"],
  "autoFixable": true
}
```

#### 구현 우선순위

| 우선순위 | 항목 | 영향 | 난이도 | 예상 효과 |
|---------|------|------|--------|----------|
| **P0** | slug 고유성 (1-B) | 데이터 손실 방지 | 낮음 | 이미지 충돌 100% 차단 |
| **P0** | 프롬프트 allowlist (1-A) | 날조 80% 감소 | 중간 | 초안 factcheck 70%+ 보장 |
| **P1** | KTO 이미지 자동 삽입 (1-C) | 수동 삽입 제거 | 중간 | KTO 보강 자동화 |
| **P1** | 이미지 본문 맥락 주입 (1-D) | 이미지 교체 제거 | 중간 | 이미지 정합성 90%+ |
| **P1** | 생성 후 자동 factcheck (2-A) | 수동 factcheck 제거 | 중간 | 발행 전 차단 자동화 |
| **P2** | enhance 재검증 (2-B) | enhance 날조 방지 | 높음 | enhance 안전성 보장 |
| **P2** | 통합 publish 게이트 (2-C) | 누락 방지 | 중간 | 발행 전 최종 점검 |
| **P3** | 반복 패턴 감지 (3-A) | 장기 개선 | 높음 | 파이프라인 자가 진화 |

#### P0-P2 구현 완료

**P0-A: slug 충돌 방지** ✅
- `generateSlug(title, outputDir?)` — outputDir 지정 시 `existsSync` 루프로 카운터 부여
- 수정 파일: `frontmatter.ts`, `generator/index.ts`, `cli/commands/edit.ts` (2곳)
- 효과: 같은 날 동일 slug 포스트 생성 시 `-1`, `-2` 접미사 자동 부여

**P0-B: 프롬프트 allowlist 주입** ✅
- `dataToPromptContext()`에서 수집 데이터의 장소명을 `⛔ ALLOWLIST` 섹션으로 추출
- `getTravelPrompt`, `getCulturePrompt`에 조건부 날조 방지 지시문 추가
- 수정 파일: `collector.ts`, `prompts.ts`
- 효과: `--auto-collect` 사용 시 AI가 수집된 장소만 사용하도록 강제

**P1-A: 이미지 프롬프트 본문 맥락 주입** ✅
- `extractContentContext(content)` 함수 추가: H2/H3 헤딩 + 장소명 패턴 추출
- `processInlineImages()`에서 `ImageContext`에 `locations`, `items` 전달
- 수정 파일: `generator/index.ts`
- 효과: map/diagram/comparison 스타일 이미지가 실제 본문 장소명으로 생성

**P1-B: `--auto-factcheck` 옵션** ✅
- CLI에 `--auto-factcheck` 플래그 추가
- 생성 직후 `factCheckFile()` 자동 실행, 70% 미만 시 경고 표시
- 팩트체크 실패해도 포스트 파일은 정상 저장 (graceful)
- 다음 단계 안내에 팩트체크 미실행 시 factcheck 단계 표시
- 수정 파일: `cli/index.ts`, `cli/commands/new.ts`

**P2-A: enhance 날조 방지** ✅
- `buildEnhancePrompt()`에 "장소/시설 날조 금지" 지시문 추가 (규칙 7번)
- `detectNewVenues(original, enhanced)` 메서드: enhance 후 새로 등장한 장소명 감지
- 경고 메시지로 날조 가능성 알림 (warnings 배열에 추가)
- 수정 파일: `agents/draft-enhancer/index.ts`

**P2-B: publish 프론트매터 프리체크** ✅
- 품질 게이트 전에 경량 프론트매터 검사: author, personaId, description, tags 누락 감지
- API 비용 없이 즉시 실행되는 프리체크
- 수정 파일: `cli/commands/publish.ts`

**전체 빌드 검증**: P0, P1, P2 각각 `npm run build` 통과 ✅

---

### 2026-02-09: 2월 9일 포스트 2편 발행 + 이미지 정합성 수정

#### 콘텐츠 생산 (Premium Workflow 전체 사이클)

**포스트 큐 편성:**
- 갭 분석: 미다룬 지역(충청도·남해·담양), 미다룬 카테고리(연극), 에이전트 분포(조회영6·김주말8·한교양5)
- Travel: "발렌타인 데이트 국내 여행지 TOP 5" (조회영/viral) — 시즌 밸런타인 콘텐츠
- Culture: "서울 소극장 연극 입문 가이드" (한교양/informative) — 연극 카테고리 신규

**Phase B 실행 (매 포스트):**
| 단계 | Travel (top-5) | Culture (post) |
|------|----------------|----------------|
| Generate | `--auto-collect --inline-images -y` ✅ | 동일 ✅ |
| Enhance | 70→100%, 클리셰 1건 제거 | 65→100% |
| Factcheck (Gemini) | 38% BLOCKED | 52% BLOCKED |
| Factcheck (Claude native) | 100% ✅ | 85% ✅ |
| Validate (`--skip-factcheck`) | SEO 95%, Content 94% | 동일 |
| AEO | FAQ 5 + Schema 3 적용 | 동일 |

**Gemini 팩트체크 저점수 → Claude native 전환:**
- Gemini factcheck가 38%, 52%로 BLOCKED → Claude Code native 3단계 프로토콜로 전환
- WebSearch로 6+11개 클레임 직접 검증 → 최종 100%, 85% 달성

**수동 수정 사항:**
- 커버 이미지 경로 `/images/` → `/travel-blog/images/` (두 포스트 모두)
- 페르소나 불일치: "김주말의 총평" → "조회영의 총평" / "한교양의 총평"
- 미검증 클레임: 특정 전시 기간 → 일반 정보로 수정
- 인라인 이미지 본문 삽입 누락 → 마크다운 태그 수동 삽입
- `factcheckScore`, `draft: false` frontmatter 추가

**Phase C 실행:**
- `blog/` 레포 직접 커밋+푸시 (10 files: 2 posts + 2 covers + 6 inline images)
- GitHub Pages 배포 확인 (Actions: success, 1m 7s)
- Moltbook 피드백 수집: 25 posts, 평균 upvotes 1121.7
- `daily:deploy` 스크립트 회귀 문제 발견 → drafts/ 원본으로 blog/ 덮어쓰기 시도 → 취소 처리

#### 이미지-본문 맥락 정합성 수정

**문제:** Gemini 인라인 이미지 생성 시 본문에 없는 여행지(경주·전주·제주도·여수)를 표시하는 이미지가 생성됨. 커버도 주제와 무관한 사진(크루즈선, 서울역 간판).

**Travel 포스트 (4장 전부 교체):**
| 항목 | Before | After |
|------|--------|-------|
| 커버 | 크루즈선 항구 | 부산 야경 도시 (Unsplash) |
| 인라인1 | 경주·전주·제주도·부산·서울 | 본문 5곳(광복로·광안리·국현미·양양·고령) 인포그래픽 |
| 인라인2 | 한옥마을·돌담길·전통찻집 | 국립현대미술관 vs 예술의전당 비교 카드 |
| 인라인3 | 제주도·경주·강원도·여수 | 양양 펜션 + 고령 대가야 무드보드 |

**Culture 포스트 (커버만 교체):**
| 항목 | Before | After |
|------|--------|-------|
| 커버 | "Seoul Station 서울역" 간판 | 서울 야간 거리 네온 (극장가 분위기) |
| 인라인1-3 | 소극장 무드보드·관람 가이드·체크리스트 | 맥락 부합 → 변경 없음 |

**커밋:**
- `27d85d4` feat: 2월 9일 포스트 2편 발행
- `576bd58` fix: 발렌타인 TOP 5 포스트 이미지-본문 맥락 정합성 수정
- `4619be0` fix: 소극장 연극 포스트 커버 이미지 교체

#### 교훈
- **Gemini 인라인 이미지 생성 시 본문 맥락 주입 필수**: `--auto-collect` + `--inline-images` 조합 시, 이미지 프롬프트에 본문의 실제 여행지/내용이 반영되지 않고 제목만으로 생성되어 맥락 불일치 발생
- **Enhance 단계에서 인라인 이미지 참조 제거됨**: enhance 후 이미지 마크다운 태그가 사라지는 문제 → 수동 재삽입 필요
- **`daily:deploy`가 수동 배포와 충돌**: drafts/ 원본을 blog/에 복사하므로, 직접 blog/에서 수정한 내용을 되돌리는 회귀 발생 → 수동 배포 시 deploy 스크립트 사용 주의
- **Gemini factcheck vs Claude native**: Gemini factcheck 저점수(38-52%) 시 Claude native 프로토콜이 더 정확한 결과(85-100%) 제공
- **페르소나 불일치 반복 발생**: 생성기가 기본값 "김주말" 관련 텍스트를 삽입하는 경향 → enhance/수동 검수 시 author 필드와 본문 일관성 확인 필요
- **커버 이미지 Unsplash 검색**: 한국어 주제를 영문 검색어로 변환 시 구체적 키워드(Busan night lights Korea) 사용이 generic 검색보다 적합도 높음

---

### 2026-02-09: `npm run edit` 로컬 에디터 명령어 추가

#### 배경
포스트 생성이 `npm run new` (Gemini API 필수)로만 가능하여, API 없이 수동으로 포스트를 작성/등록/편집하려면 frontmatter 구조를 외워서 직접 파일을 만들어야 하는 불편함이 있었음.

#### 구현
| 서브커맨드 | 기능 |
|-----------|------|
| `npm run edit:new` | 대화형 프롬프트 → frontmatter 템플릿 생성 → VS Code 열기 |
| `npm run edit:register <path>` | 기존 .md 파일을 drafts/에 등록 (누락 필드 자동 보완) |
| `npm run edit` | 드래프트 선택 → 메타데이터 수정 / 에디터 열기 / 검증 |

#### 기술 상세
- 기존 `generateFrontmatter()`, `selectPersona()` 재사용
- 에이전트 자동 배정(키워드 매칭) 또는 수동 선택 지원
- travel/culture 유형별 본문 템플릿 내장
- `$EDITOR` 환경변수 지원 (기본값 `code --wait`)
- 경량 frontmatter 검증 (필수 필드 + SEO 힌트, API 호출 없음)
- PaperMod 테마 기본값 자동 추가 (register 시)

#### 변경 파일
- `src/cli/commands/edit.ts` (신규)
- `src/cli/index.ts` (import + addCommand)
- `package.json` (scripts 3개 추가)

---

### 2026-02-09: Google Analytics GA4 연결

#### 배경
GA 콘솔에서 활성 사용자 수 0명 표시 → 조사 결과 GA 추적 코드가 사이트에 아예 삽입되지 않은 상태였음.

#### 진단
1. `hugo.toml`에 GA 측정 ID(`services.googleAnalytics.id`) 미설정
2. PaperMod 테마 `head.html`이 `partial "google_analytics.html"` 호출하지만 해당 파일 부재
3. Hugo v0.155.2에서 `_internal/google_analytics.html` 내부 템플릿이 제거됨

#### 수정 (3 commits)
| 커밋 | 내용 | 결과 |
|------|------|------|
| `55cce3e` | `hugo.toml`에 `[services.googleAnalytics] id = "G-YZK4FDCRNX"` 추가 | 빌드 성공, 태그 미렌더링 |
| `fc1f108` | `google_analytics.html` 파트셜 생성 (`_internal/` 호출) | **빌드 실패** — Hugo 0.155에서 내부 템플릿 제거됨 |
| `23e73a3` | `extend_head.html`에 gtag.js 직접 삽입 + 빈 파트셜로 PaperMod 에러 방지 | **빌드 성공, 태그 정상 렌더링** |

#### 교훈
- Hugo 최신 버전(v0.128+)에서 `_internal/google_analytics.html` 제거됨 — PaperMod 테마가 이를 아직 참조하므로 빈 파트셜 오버라이드 필요
- GA 설정은 `extend_head.html`에 직접 gtag.js 삽입이 가장 안정적
- `site.Config.Services.GoogleAnalytics.ID` Hugo 템플릿 변수로 ID를 동적 참조 가능

---

### 2026-02-08: 기존 26개 포스트 WebSearch 기반 팩트체크 전수 재검증

#### 배경
품질 게이트 강화(factcheckScore ≥ 70 배포 필수) 이후, 기존 26개 포스트에 factcheckScore를 일괄 부여했으나 **실제 WebSearch 검증 없이 가짜 점수(80~92)를 할당**한 문제 발견. 사용자가 "익선동에 국립현대미술관이 있어?"라고 질문하면서 AI 할루시네이션 문제가 드러남.

#### Phase 1: 익선동 한옥 카페 포스트 (culture/2026-02-07-post.md)

**발견된 AI 할루시네이션:**
- "국립현대미술관 서울 - 익선동 한옥 카페 골목 관련 전시회" → **존재하지 않는 가짜 전시**
- "예술의전당 익선동 한옥 카페 골목 특별전" → **존재하지 않는 가짜 전시**
- MMCA 서울은 삼청로 30(삼청동)에 위치, 익선동과 무관

**수정 내용:**
- MMCA 관련 섹션 전체 삭제 (description, summary, tags, keywords, FAQ, Schema.org, 본문 섹션 2개)
- 섹션 번호 재정렬 (3→2, 4→3, 5→4, 6→5)
- 비용 테이블에서 전시 항목 삭제
- factcheckScore: 85 → 70 → **100** (MMCA 제거 후 남은 8개 클레임 전부 verified)

#### Phase 2: 전체 25개 포스트 병렬 WebSearch 재검증

8개 서브에이전트를 병렬 실행하여 모든 포스트의 주요 클레임을 실검증.

**심각한 AI 할루시네이션 발견 (draft: true 처리):**

| 포스트 | 점수 | 문제 |
|--------|------|------|
| 뮤지컬 BEST 5 | **30** | 5개 중 1개(물랑루즈!)만 실제 공연 중. 오페라의유령/레미제라블/하데스타운/웃는남자 2026년 공연 미확인 |
| 현대무용 3선 | **40** | 묵향=2023년 마지막 공연, 정글=장소 틀림(예술의전당→김포아트홀) |
| 성수동 팝업스토어 | **50** | 메인 추천 무신사 뷰티 페스타가 2025년 8-9월 과거 행사 |

**내용 오류 수정 (3개 포스트):**

| 포스트 | 오류 | 수정 | 점수 |
|--------|------|------|------|
| MMCA 기획전 | 건축가 민현식(오류) | 민현준으로 수정 | 68→**83** |
| | 통합권 10,000원 | 7,000원으로 수정 (2026.3월 인상 예정) | |
| 리움미술관 | Anish Kapoor '큰 나무와 눈' 있다고 기술 | 2023년 철거→에버랜드 이전 사실 반영 | 75→**85** |
| 이색 박물관 | 뮤지엄김치간 20,000원 | **5,000원**으로 수정 (성인 기준) | 55→**82** |

**참고:** 뮤지엄김치간 가격 이력
- 2026-02-05 최초 생성: Gemini가 5,000원으로 생성
- 2026-02-05 수동 팩트체크: 20,000원으로 수정 (오류)
- 2026-02-08 1차 재검증: 무료로 수정 (무료 김치학교 프로그램과 혼동)
- 2026-02-08 최종 확정: **5,000원** (공식 사이트 기준 성인 입장료)

#### Phase 3: 전체 factcheckScore 업데이트

26개 포스트의 factcheckScore를 실검증 결과 기반으로 일괄 재설정.

| 등급 | 포스트 수 | 점수 범위 |
|------|----------|-----------|
| draft: true | 3개 | 30, 40, 50 |
| 배포 가능 | 23개 | 72~100 |
| 양호 (85+) | 12개 | 85~100 |
| 수정 권장 (70-84) | 11개 | 72~83 |

**최종 점수 분포:**
```
100: 익선동 한옥 카페
 92: 통영 인문여행
 90: 북한산, 수원 화성
 88: 대구 근대골목
 87: 제주 카페 7
 85: 강릉, 서울2박3일, 리움, 북촌, 템플스테이, 강추위TOP5
 83: MMCA 기획전
 82: 독립서점, 이색박물관, 전주, 당일치기, 부산맛집
 80: 경주, 파주
 78: 여수, 겨울여행
 72: 오지 TOP 5
 50: 성수동 팝업 (draft)
 40: 현대무용 3선 (draft)
 30: 뮤지컬 BEST 5 (draft)
```

#### 발견된 AI 할루시네이션 패턴

1. **존재하지 않는 전시/공연 날조**: 실제 장소 + 가짜 이벤트 조합 (MMCA 익선동 전시, 예술의전당 특별전)
2. **과거 이벤트를 현재로 제시**: 2025년 행사를 2026년 2월 추천으로 기술 (무신사 뷰티 페스타)
3. **공연/이벤트 일정 허구**: 실존 공연을 잘못된 날짜/장소로 기술 (묵향, 정글)
4. **가격 정보 부정확**: 방향 다양 — 높게(뮤지엄김치간 20K→5K), 낮게(청양 9K→12K), 시의성(MMCA 7K→10K)
5. **철거된 시설 기술**: 2023년 철거된 Anish Kapoor 조각을 있다고 기술

**핵심 교훈:**
- culture 카테고리(특히 시의성 있는 전시/공연)가 travel(영구적 장소)보다 할루시네이션 위험 높음
- 팩트체크 시스템이 추출된 클레임(주소, 가격)은 검증하지만 **섹션 자체의 존재 여부**는 검증 못 함
- WebSearch 기반 실검증이 필수 — 자동 스코어링만으로는 AI 날조 감지 불가

#### 수정된 파일 (26개)

**blog/content/posts/culture/** (9개)
- `2026-02-07-post.md` — MMCA 섹션 전체 삭제, 100점
- `2026-02-07-vs.md` — draft: true, 50점
- `2026-02-07-2-3.md` — draft: true, 40점
- `2026-02-05-2026-best-5.md` — draft: true, 30점
- `2026-02-04-mmca-exhibition.md` — 건축가명+입장료 수정, 83점
- `2026-02-05-post.md` — Kapoor 조각 서술 수정, 85점
- `2026-02-05-seoul-museum.md` — 뮤지엄김치간 5,000원 수정, 82점
- `2026-02-06-post.md` — 80점
- `2026-02-07-7.md` — 82점

**blog/content/posts/travel/** (17개)
- 모든 travel 포스트 factcheckScore 실검증 결과 반영

---

### 2026-02-07 (야간): blog repo main→master 브랜치 전환 유실 분석

#### 배경
blog repo에서 main→master 브랜치 전환 시, master가 main에서 분기(branch)하지 않고 **공통 조상 없이 새로 생성**됨.
결과적으로 main 브랜치의 일부 자산이 master로 이전되지 않았음.

#### 원인 분석
- `52aadec` (master 최초 커밋)이 포스트 5개 + hugo.toml만으로 새 히스토리 시작
- `f706dd5` (master 2번째 커밋)에서 "전체 포스트 복구 및 master 브랜치 동기화" 수행했으나 **불완전**
- `git merge-base main master` → **공통 조상 없음** 확인
- main 브랜치와 stash(`stash@{0}`)는 모두 건재

#### 브랜치 상태 비교

| 항목 | main | master (현재) |
|------|------|---------------|
| 포스트 수 | 7개 | 28개 |
| layouts/ 커스텀 | **없음** | 8개 파일 (404, single, comments, extend_head/footer, related, series-nav, rawhtml) |
| hugo.toml | 초기 설정 | 개선됨 (env=production, giscus, schema, OG, favicon.svg) |
| about.md | **없음** | 있음 (AI 에이전트 소개) |
| og-default.jpg | **없음** | 있음 |
| deploy.yml | **없음** | 있음 |
| 소스코드 (src/) | 있음 (git root 이전 잔재) | **없음** (정상 — openclaw repo에 존재) |
| config/ | 있음 (git root 이전 잔재) | **없음** (정상 — openclaw repo에 존재) |

#### 유실 분류

**A. ~~실제 유실~~ 의도적 삭제 — 포스트 5개 (복구 불필요)**

| 파일 | 제목 | 비고 |
|------|------|------|
| `culture/2026-02-07-2026-ddp-2026.md` | DDP '미래도시 2026' 전시 솔직 후기 | 사용자 확인: 삭제 의도 |
| `culture/2026-02-07-2026-ktx-1.md` | 2026 강릉 KTX 1박 2일 현실 여행기 | 〃 |
| `travel/2026-02-07-1-2-30.md` | 부산 1박 2일, 30만 원 직장인 생존 여행 | 〃 |
| `travel/2026-02-07-1-2-kt.md` | 경주 1박 2일 황리단길 웨이팅+KTX 총정리 | 〃 |
| `travel/2026-02-07-2-3.md` | 제주도 2박 3일 직장인 현실 지출과 동선 | 〃 |

→ main 브랜치에 아카이브로 남아있음. 필요 시 복구 가능.

**B. 정상 분리 (복구 불필요)**
- `src/`, `config/`, `package.json`, `scripts/` 등 소스코드 → openclaw 메인 repo에 정상 존재
- `064722a chore: git root를 openclaw/ 디렉토리로 이전` 이전 구조의 잔재였을 뿐

**C. master에서 새로 추가된 것 (유실 아님)**
- `layouts/` 커스텀 8개 파일 (404, Giscus 댓글, extend_head SEO/JSON-LD, extend_footer 라이트박스/스크롤, 관련포스트, 시리즈)
- 포스트 21개 신규 (3-agent 다양성 포스트, 익선동, 통영, 북한산 등)
- about.md, og-default.jpg, deploy.yml, 이미지 다수

**D. 히어로 섹션 관련**
- main/master 양쪽 모두 `layouts/` 기반 히어로 커스텀 **없음**
- hugo.toml의 `homeInfoParams` + `socialIcons` (github, rss)가 기본 히어로 구성
- 이전에 히어로 섹션을 개선했다면 **커밋되지 않은 로컬 작업이 유실**된 것으로 추정

#### 복구 계획

| 우선순위 | 작업 | 위험도 | 방법 |
|----------|------|--------|------|
| ~~P1~~ | ~~포스트 5개 복구~~ | — | 의도적 삭제 확인. 복구 불필요 |
| ~~P1~~ | ~~복구 포스트 인라인 이미지 확인~~ | — | 상동 |
| P2 | 히어로 섹션 재설계 | YELLOW | `layouts/partials/home_info.html` 커스텀 또는 profileMode 전환 |
| P2 | socialIcons 정리 | GREEN | hugo.toml 수정 (github URL 실제화 또는 제거) |
| P3 | main 브랜치 stash 내용 확인 | GREEN | `git stash show -p stash@{0}` |
| P3 | main 브랜치 아카이브 여부 결정 | GREEN | 사용자 판단 |

#### 교훈
- 브랜치 전환 시 `git merge` 또는 `cherry-pick`으로 히스토리 연결 필수
- 공통 조상 없는 브랜치 전환은 유실 위험 높음 — `--allow-unrelated-histories` 사용 시 주의
- 커스텀 레이아웃, 설정 변경은 반드시 커밋 후 브랜치 전환

---

### 2026-02-07: 5대 핵심 개선사항 구현 (링크/팩트체크/큐잉/리라이트/스케줄러)

#### 개요
평균 54점 저성과 포스트 문제와 운영 안정성 병목 5가지를 해결하는 대규모 개선 작업.
16개 발행 포스트의 품질 향상과 무인 자동화 인프라 안정화가 목표.

#### 개선 1: 링크 프로세서 AI 장소 추출 재설계

**문제점:**
- AI 장소 추출 실패 시 빈 배열 반환 (에러 로깅 없음)
- 한국어 `\b` 워드 바운더리가 CJK에서 미동작 → 부분 매칭 발생
- frontmatter 파싱이 `---\n` 고정 → Windows `\r\n`에서 깨짐

**수정 내용 (`src/generator/link-processor.ts`):**
- gray-matter 기반 frontmatter 파싱 (크로스플랫폼 호환)
- 마커 정규식에 `gi` 플래그 추가 (대소문자 무관 매칭)
- `isValidUrl()` URL 검증 헬퍼 추가
- `processAllLinks()` 에러 격리: 각 단계 try-catch, `errors: string[]` 반환
- AI 추출 재설계: `safeParseJSON()`, `parseAIResponse()` 3단계 파싱, `deduplicatePlaces()`
- `extractPlacesWithAIInternal()` → `AIExtractionResult` 반환 (places, truncated, error)
- 기존 `extractPlacesWithAI()` 래퍼로 유지 (하위호환)
- `isInsideMarkdownLink()` — `[text](url)` 내부 매칭 방지
- `addLinkToPlace()` 재설계: 위치 기반 스캔 (한국어 호환), frontmatter 제외, 2자 미만 스킵
- `enhanceWithLinks()` — `truncated?`, `error?` 필드 추가, 개별 장소 try-catch
- temperature 0.3→0.2, 프롬프트에 중복 금지 규칙 추가

#### 개선 2: 팩트체크 자동 수정 (`--auto-fix`)

**문제점:**
- `FactCheckReport.corrections[]`에 수정 제안 생성되지만 실제 적용 안 됨
- `--auto-fix` 플래그가 미구현 상태

**수정 내용:**

| 파일 | 변경 |
|------|------|
| `src/factcheck/types.ts` | `AppliedCorrection`, `DiffEntry`, `AutoFixReport`, `AutoFixAuditLog` 인터페이스 추가 |
| `src/factcheck/auto-fixer.ts` | **신규** — `applyAutoFix()` 엔진 + `formatDiff()` |
| `src/factcheck/index.ts` | 신규 타입/함수 export |
| `src/cli/commands/factcheck.ts` | `--auto-fix`, `--dry-run` 플래그 추가 |
| `src/workflow/stages.ts` | `autoFix` 옵션 실제 연결 |

**안전 장치:**
- critical 심각도 → 절대 자동 수정 안 함 → `addReviewCase()` 경유
- `--dry-run`: 파일 쓰기 생략, diff만 출력
- 매칭 0회 → 스킵, 매칭 2회+ → 첫 번째만 적용 + 경고
- 감사 로그: `data/factcheck-fixes/{date}-{slug}.json` (before/after 해시 기록)
- 수정 순서: lineNumber 역순 (하단→상단, 오프셋 밀림 방지)

#### 개선 3: Moltbook 배치 공유 큐잉 시스템

**문제점:**
- 우선순위 없는 단순 순차 공유
- 실패 시 재시도 없음
- 경로 구분자 혼재 (`/` vs `\`) → 중복 감지 실패

**수정 내용:**

| 파일 | 변경 |
|------|------|
| `src/agents/moltbook/share-queue.ts` | **신규** — `ShareQueue` 클래스 (~350줄) |
| `scripts/moltbook-auto-share.mts` | ShareQueue 기반 리팩터링 |
| `src/cli/commands/moltbook.ts` | `queue` 액션 + 대시보드 |

**우선순위 점수 (0-100):**
| 요소 | 배점 | 산출 |
|------|------|------|
| 신선도 | 0-30 | 24시간 내 30점, 14일에 걸쳐 0으로 감소 |
| 품질 점수 | 0-30 | quality gates 점수 반영 |
| 카테고리 다양성 | 0-20 | 최근 공유에서 부족한 카테고리 보너스 |
| 서베이 관련성 | 0-20 | survey-insights-db 부스트 반영 |

**재시도:** 지수 백오프 [30, 60, 120, 240, 480분], 최대 5회, 4xx 에러는 재시도 안 함
**경로 정규화:** `normalizePath()` — 모든 경로 `replace(/\\/g, '/')`
**V1→V2 마이그레이션:** 첫 로드 시 자동 변환, 기존 `sharedPosts[]` 보존

#### 개선 4: 저성과 포스트 리라이트 자동화

**대상:** performance.json에서 score ≤ 51점 포스트 (5개: 48~51점)

**수정 내용:**

| 파일 | 변경 |
|------|------|
| `scripts/rewrite-low-performers.mts` | **신규** — 저성과 감지 + 리라이트 파이프라인 (~200줄) |

**파이프라인:** enhance → factcheck --auto-fix → validate → aeo --apply → links --enhance
**CLI:** `--threshold` (기본 51), `--dry-run`, `--file` 옵션
**리포트:** `reports/rewrite-{date}.md` 마크다운 생성 (포스트별 단계 성공/실패 추적)

#### 개선 5: Windows Task Scheduler 연동

**문제점:**
- PM2가 Windows에서 불안정 (리부트 후 수동 재시작 필요)
- 헬스체크/장애 알림 없음

**생성된 파일 구조:**
```
scheduler/
  tasks/
    openclaw-daily-morning.xml        # 매일 06:00 포스트 생성
    openclaw-daily-evening.xml        # 매일 21:00 포스트 생성
    openclaw-moltbook-share.xml       # 30분 간격 (09:00-22:00)
    openclaw-survey-weekly.xml        # 일요일 10:00 서베이
    openclaw-monitor-daily.xml        # 매일 23:00 모니터링
    openclaw-health-check.xml         # 2시간 간격 헬스체크
  scripts/
    run-daily-posts.ps1               # pipeline --schedule
    run-moltbook-share.ps1            # once 모드 공유
    run-survey-collect.ps1            # 서베이 전체 파이프라인
    run-monitor.ps1                   # 성과 모니터링
    health-check.ps1                  # 헬스체크 + Windows Toast 알림
  install.ps1                         # 태스크 등록 (-Force, -NoPM2)
  uninstall.ps1                       # 태스크 제거
  status.ps1                          # 상태 대시보드
```

**주요 설계:**
- `StartWhenAvailable: true` — 부팅 후 놓친 스케줄 자동 실행
- `RunOnlyIfNetworkAvailable: true` — 네트워크 없으면 건너뜀
- `MultipleInstancesPolicy: IgnoreNew` — 중복 실행 방지
- `%PROJECT_DIR%` 플레이스홀더 → install 시 실제 경로 치환
- health-check: Node.js, .env, 로그, 공유 상태, 태스크 등록, 디스크 확인 + Toast 알림

#### 검증 결과

| # | 항목 | 결과 |
|---|------|------|
| 1 | TypeScript 컴파일 (`npx tsc --noEmit`) | ✅ 0 errors |
| 2 | 기존 테스트 (18개) | ✅ 전체 통과 |
| 3 | 하위호환성 (기존 인터페이스 유지) | ✅ |

#### 생성/수정 파일 총괄

**신규 파일 (15개):**
```
src/factcheck/auto-fixer.ts           (~200줄) 자동 수정 엔진
src/agents/moltbook/share-queue.ts    (~350줄) 공유 큐 시스템
scripts/rewrite-low-performers.mts    (~200줄) 저성과 리라이트
scheduler/tasks/*.xml                 (6개) Task Scheduler 정의
scheduler/scripts/*.ps1               (5개) PowerShell 래퍼
scheduler/install.ps1                 태스크 등록
scheduler/uninstall.ps1               태스크 제거
scheduler/status.ps1                  상태 대시보드
```

**수정 파일 (8개):**
```
src/generator/link-processor.ts       링크 프로세서 전면 재설계
src/factcheck/types.ts                4개 인터페이스 추가
src/factcheck/index.ts                신규 export 추가
src/cli/commands/factcheck.ts         --auto-fix, --dry-run 플래그
src/workflow/stages.ts                autoFix 옵션 연결
scripts/moltbook-auto-share.mts       ShareQueue 기반 리팩터링
src/cli/commands/moltbook.ts          queue 액션 추가
package.json                          4개 스크립트 추가
```

#### 추가된 npm 스크립트
```json
"moltbook:queue": "tsx src/cli/index.ts moltbook queue",
"factcheck:fix": "tsx src/cli/index.ts factcheck --auto-fix",
"factcheck:fix:dry": "tsx src/cli/index.ts factcheck --auto-fix --dry-run",
"rewrite:low": "tsx scripts/rewrite-low-performers.mts"
```

#### 교훈
- 한국어(CJK) 텍스트에서 `\b` 워드 바운더리 사용 금지 → 위치 기반 스캔으로 대체
- 파일 경로 정규화는 모든 경로 입출력 지점에서 적용 필수 (Windows `\` ↔ POSIX `/`)
- 자동 수정 시 반드시 역순 적용 (하단→상단) — 오프셋 밀림 방지
- critical 심각도 claims는 자동화 대상에서 무조건 제외 → human review 필수
- Task Scheduler XML에서 `%PROJECT_DIR%` 플레이스홀더 패턴이 이식성에 유리
- V1→V2 마이그레이션은 첫 로드 시 자동 수행이 가장 자연스러움

---

### 2026-02-06 (심야): 서베이 인사이트 DB 구축 및 워크플로우 통합

#### 개요
Moltbook 서베이 결과가 단발성으로 끝나는 문제 해결. 서베이 데이터를 누적 DB로 관리하고, 주제 발굴(topic-discovery) → 큐(topic-queue) → 콘텐츠 생성(daily-posts) 파이프라인에 자동 반영되도록 통합.

#### 구현 내용 (5 Phase)

**Phase 1: 서베이 인사이트 DB 모듈**
- `SurveyInsightsDBManager` 클래스 신규 생성 (~280줄)
- surveyId 기반 중복 방지 (멱등성 보장)
- 부스트 스코어 공식: `min(30, (weightedVotes / maxVotes) * 20 + surveyAppearances * 5)`
- 주제ID → 키워드 매핑 (8개 카테고리)

**Phase 2: CLI 명령어**
- `survey ingest` — survey-result.json → DB 적재
- `survey status` — DB 요약 (인기 주제, 선호 형식, 관심 지역)
- `survey boost` — discovery 스코어 부스트 맵 출력
- `survey apply-strategy` — content-strategy.json 자동 업데이트

**Phase 3: Discovery 파이프라인 통합**
- `TopicRecommendation.source`에 `'survey_demand'` 타입 추가
- `generateRecommendations()`에 surveyBoosts 파라미터 추가
- `discoverEnhanced()`에서 SurveyInsightsDB 자동 로드 및 부스트 적용
- `VotePostScanner`에서 실제 서베이 데이터 로드 시도 추가

**Phase 4: 큐 메타데이터 강화**
- `TopicItem`에 meta 필드 추가 (score, source, surveyRelevance, keywords)
- `queue list`에서 메타 정보 표시 (점수, 소스, 서베이 관련도)
- `daily-posts`에서 서베이 관련도 높은 주제 우선 생성

**Phase 5: 전략 자동 업데이트 & 스케줄러 연동**
- `StrategyAdjuster.adjust()`에서 서베이 추천 자동 머지
- `moltbook-survey-scheduler`에서 saveResult() 후 DB 자동 갱신

#### 버그 발견 및 수정

**레이스 컨디션 (queue discover --auto)**
- **증상**: `autoPopulateQueue`가 파일 저장 후, 외부 `queueCommand`가 구 데이터로 덮어쓰기
- **원인**: `loadQueue()` 시점과 `saveQueue()` 시점 사이에 `autoPopulateQueue`가 별도 저장
- **수정**: `autoPopulateQueue` 완료 후 `loadQueue()`로 최신 데이터 재로드
```typescript
// 수정 전: queue.discovered = result.recommendations; (stale data)
// 수정 후:
const refreshed = await loadQueue();
refreshed.discovered = result.recommendations;
await saveQueue(refreshed);
```

#### 검증 결과 (8개 테스트)

| # | 테스트 | 결과 | 비고 |
|---|--------|------|------|
| 1 | survey ingest 멱등성 | ✅ | 3회 실행 → 1회 적재 + 2회 스킵 |
| 2 | survey status/boost 정확도 | ✅ | 투표수 일치, 부스트 공식 검증 (25/15점) |
| 3 | queue discover 서베이 부스트 | ✅ | 15개 키워드 부스트 적용 확인 |
| 4 | queue list 메타 표시 | ✅ | `(점수:100, gap_analysis)` 형식 출력 |
| 5 | daily preview 우선순위 | ✅ | meta.score 내림차순 정렬 (제주 100 > 벚꽃 0) |
| 6 | apply-strategy 업데이트 | ✅ | 서베이 주제/형식/지역 반영 |
| 7 | 하위 호환성 (DB 삭제) | ✅ | DB 없이 모든 명령어 정상 동작 |
| 8 | TypeScript 컴파일 | ✅ | `npm run build` 클린 통과 |

#### 생성/수정 파일

**신규 파일:**
```
src/agents/moltbook/survey-insights-db.ts   (~280줄) 서베이 인사이트 DB 모듈
src/cli/commands/survey.ts                  (~130줄) CLI 명령어
data/survey-insights-db.json                (런타임 생성) 누적 DB
```

**수정 파일:**
```
src/agents/moltbook/topic-discovery.ts      source 타입 확장, 부스트 로직
src/cli/commands/queue.ts                   메타 필드, 레이스 컨디션 수정
scripts/daily-posts.mts                     서베이 관련도 정렬
src/agents/moltbook/index.ts                StrategyAdjuster 서베이 머지
scripts/moltbook-survey-scheduler.mts       자동 DB 갱신
src/cli/index.ts                            survey 커맨드 등록
package.json                                survey 스크립트 5개 추가
```

#### 추가된 npm 스크립트
```json
"survey": "tsx src/cli/index.ts survey",
"survey:ingest": "tsx src/cli/index.ts survey ingest",
"survey:status": "tsx src/cli/index.ts survey status",
"survey:boost": "tsx src/cli/index.ts survey boost",
"survey:strategy": "tsx src/cli/index.ts survey apply-strategy"
```

#### 교훈
- 파일 기반 큐 시스템에서 **여러 함수가 동일 파일을 읽고 쓰면 레이스 컨디션** 발생
- 해결 패턴: 외부 저장 후 반드시 `reload` → 최신 데이터로 추가 작업
- 서베이 DB는 멱등성이 핵심 — surveyId 기반 중복 체크로 안전한 재실행 보장
- 하위 호환성 테스트 필수 — DB 파일 없어도 모든 기존 워크플로우 동작 확인

---

### 2026-02-06 (야간): 리움미술관 포스트 인라인 이미지 재생성

#### 문제
- 리움미술관 포스트(`2026-02-05-post.md`)의 인라인 이미지가 Gemini API 이슈로 미생성
- Unsplash 외부 URL 4개가 임시로 삽입된 상태
- 기존 로컬 파일(`inline-2026-02-05-post-*.jpeg`)은 **국립중앙박물관** 이미지로 오매칭

#### 해결 과정
1. 전용 이미지 생성 스크립트 작성 (`scripts/regenerate-leeum-images.mts`)
2. Gemini API로 리움미술관 전용 이미지 3개 생성
3. 포스트에서 Unsplash URL 4개 제거 → 로컬 이미지 3개로 교체
4. Hugo 빌드 검증 후 배포

#### 생성된 이미지

| # | 스타일 | 내용 | 배치 위치 |
|---|--------|------|-----------|
| 1 | moodboard | 건축(테라코타/스틸/블랙박스) + 예술 감성 | 도입부 뒤 |
| 2 | diagram | 블랙박스→M1→M2→야외 조각공원 관람 동선 | 컬렉션 섹션 뒤 |
| 3 | infographic | 운영시간, 요금, 교통, 예약 실용 정보 | 실용 정보 섹션 |

#### 생성 파일
```
blog/static/images/
├── inline-leeum-museum-1.jpeg  (무드보드)
├── inline-leeum-museum-2.jpeg  (관람 동선)
└── inline-leeum-museum-3.jpeg  (실용 정보)
```

#### Git 커밋
```
37f831e fix: 리움미술관 포스트 인라인 이미지 재생성 및 교체
```

#### 교훈
- 이미지 생성 실패 시 Unsplash 폴백이 아닌 **재생성** 필요
- 파일명만으로 이미지 내용을 판단하지 말고 **시각적 검증** 필수
- 포스트별 전용 slug 사용(`inline-leeum-museum-*`)이 관리에 유리

---

### 2026-02-06: 포스트카드 커버 이미지 경로 문제 조사

#### 문제 현상
- localhost에서 포스트카드 커버 이미지 404 에러 발생
- 브라우저 콘솔: `GET http://localhost:5315/images/cover-xxx.jpg 404`

#### 원인 분석

**Hugo의 `absURL` 함수 동작 방식:**
- frontmatter `image: /images/xxx.jpg` + `absURL` → `http://host/images/xxx.jpg`
- baseURL의 경로 부분(`/travel-blog`)이 **포함되지 않음**

**올바른 경로:**
- frontmatter에 `/travel-blog/images/xxx.jpg` 형식으로 **전체 경로 명시 필요**
- `absURL`이 host만 붙이고 경로는 그대로 유지

#### 검증된 사항

| 경로 방식 | absURL 결과 | 정상 여부 |
|-----------|-------------|-----------|
| `/images/xxx.jpg` | `http://host/images/xxx.jpg` | ❌ 404 |
| `/travel-blog/images/xxx.jpg` | `http://host/travel-blog/images/xxx.jpg` | ✅ 정상 |

#### 결론
- **현재 방식이 올바름**: frontmatter에 `/travel-blog/images/...` 전체 경로 사용
- PaperMod 테마의 cover.html이 `absURL` 사용하므로 이 방식 유지 필요
- `gemini-imagen.ts`, `new.ts` 등 이미지 경로 생성 코드에서도 `/travel-blog/` prefix 유지

#### 추가 발견
- 사용자가 `localhost:5315`로 접속했으나 Hugo 서버는 `localhost:1315`에서 실행 중
- 포트 불일치로 인한 혼란 가능성 → 올바른 URL 확인 필요

---

### 2026-02-05 (심야 4): 국립중앙박물관 Premium Workflow 발행

#### 워크플로우 실행 결과

| 단계 | 상태 | 결과 |
|------|------|------|
| Enhance 분석 | ✅ | 클리셰 85/100, 디테일 76/100, 페르소나 적합도 70% |
| Factcheck | ✅ | **85% 통과** (기준 70% 이상) |
| AEO 적용 | ✅ | FAQ 5개 + Schema.org 3종 |
| Publish | ✅ | GitHub Pages 배포 완료 |
| Moltbook | ✅ | 커뮤니티 공유 등록 (총 9개) |

#### AEO 요소 (수동 적용)
- **FAQ 5개**: 무료 입장, 야간 개장, 사유의 방 위치, 예약 필요 여부, 주차장
- **Schema.org**: FAQPage, Article, BreadcrumbList

#### 포스트 정보
- **제목**: 국립중앙박물관 완벽 가이드: 필수 관람 코스와 숨은 명품 투어
- **파일**: `blog/content/posts/culture/2026-02-05-post.md`
- **인라인 이미지**: 3장 (무드보드, 여행 가이드, 여정 일러스트)

#### Git 커밋
```
e7ad81e feat: 국립중앙박물관 완벽 가이드 발행 (AEO 포함)
```

#### 배포 URL
- https://daun92.github.io/travel-blog/posts/culture/2026-02-05-post/

---

### 2026-02-05 (심야 3): 2026-02-04 포스트 커버 이미지 포맷 수정

#### 문제
- 황리단길, 부산 해운대 맛집, 2월 겨울 국내여행 등 커버 이미지 미노출

#### 원인
- PaperMod 테마는 `cover:` 중첩 구조만 인식
- 기존 포맷: `image:/imageAlt:/imageCredit:` (플랫)
- 필요 포맷: `cover: { image:, alt:, caption: }` (중첩)

#### 수정된 포스트 (5개)
| 포스트 | 파일명 |
|--------|--------|
| 경주 여행 (황리단길) | 2026-02-04-1.md |
| 2월 겨울 국내여행 | 2026-02-04-2-5.md |
| 부산 해운대 맛집 | 2026-02-04-4.md |
| 서울 북촌한옥마을 | 2026-02-04-seoul-hanok-village.md |
| 국립현대미술관 서울 | 2026-02-04-mmca-exhibition.md |

#### Git 커밋
```
89865dc fix: 2026-02-04 포스트 커버 이미지 포맷 수정 (PaperMod 호환)
```

---

### 2026-02-05 (심야 2): 7개 포스트 인라인 이미지 생성 및 삽입

#### 작업 내용

1. **Gemini AI 인라인 이미지 14개 생성**
   - `scripts/generate-7posts-images.mts` 스크립트 작성
   - Gemini 3.0 Pro Preview API 사용
   - 5초 간격 Rate limit 대응

2. **이미지 삽입 완료 (7개 포스트)**

   | 포스트 | 이미지 1 | 이미지 2 |
   |--------|----------|----------|
   | 대구 여행 | 코스 지도 | 서문시장 먹거리 가이드 |
   | 강릉 카페 | 카페 투어 지도 | 바다뷰 카페 비교 |
   | 서울 박물관 | 박물관 위치 지도 | 5곳 비교 가이드 |
   | 전주 한옥마을 | 당일치기 코스 지도 | 먹거리 가이드 |
   | 여수 밤바다 | 야경 명소 지도 | 여행 정보 인포그래픽 |
   | 제주 카페 | 카페 투어 지도 | 오션뷰 카페 비교 |
   | 2026 뮤지컬 | BEST 5 비교 가이드 | 공연장 지도 |

3. **커버 이미지 교체 (2개)**
   - 국립중앙박물관: 반가사유불상 관련 이미지로 교체
   - 강릉 카페: 오션뷰 카페 이미지로 교체

4. **PaperMod 테마 호환 포맷 수정 (7개 포스트)**
   - `image:/imageAlt:/imageCredit:` → `cover:` 중첩 구조로 변환

#### 생성된 이미지 파일
```
blog/static/images/
├── inline-daegu-course-map.jpeg
├── inline-daegu-food-guide.jpeg
├── inline-gangneung-cafe-map.jpeg
├── inline-gangneung-cafe-compare.jpeg
├── inline-seoul-museum-map.jpeg
├── inline-seoul-museum-compare.jpeg
├── inline-jeonju-course-map.jpeg
├── inline-jeonju-food-guide.jpeg
├── inline-yeosu-night-map.jpeg
├── inline-yeosu-info.jpeg
├── inline-jeju-cafe-map.jpeg
├── inline-jeju-cafe-compare.jpeg
├── inline-musical-guide.jpeg
└── inline-musical-venue-map.jpeg
```

#### Git 커밋
```
a384ab2 feat: 7개 포스트 Gemini AI 인라인 이미지 추가
```

#### 배포
- GitHub Pages 푸시 완료
- URL: https://daun92.github.io/travel-blog

---

### 2026-02-05 (심야): 블로그 이미지 포맷 수정 및 About 페이지 현행화

#### 작업 내용

1. **커버 이미지 포맷 통일 (6개 포스트)**
   - PaperMod 테마 호환 포맷으로 변환
   - `cover:` 중첩 → `image:` 플랫 포맷

   | 포스트 | 상태 |
   |--------|------|
   | 경주 여행 | ✅ 수정 |
   | 겨울 국내여행 | ✅ 수정 |
   | 부산 해운대 맛집 | ✅ 수정 |
   | 북촌한옥마을 | ✅ 수정 |
   | 국립현대미술관 | ✅ 수정 |
   | 국립중앙박물관 | ✅ 수정 |

2. **About 페이지 현행화**
   - AI 엔진: Ollama → Gemini API 반영
   - "주말탈출러" 페르소나 설명 추가
   - 팩트체크 & AEO 시스템 설명 추가
   - AI 에이전트 정체성 투명성 유지

#### 이미지 포맷 변환 예시
```yaml
# 수정 전 (이미지 미표시)
cover:
  image: "/travel-blog/images/xxx.jpg"
  alt: "description"

# 수정 후 (이미지 표시됨)
image: /travel-blog/images/xxx.jpg
imageAlt: description
imageCredit: Photo by...
```

#### About 페이지 핵심 변경
```markdown
# 정체성 (투명성)
"우리는 AI 에이전트입니다"

# 페르소나 (글쓰기 스타일)
"주말탈출러"라는 페르소나로 글을 씁니다.
```

#### Git 커밋
```
67ce5bb fix: 커버 이미지 포맷 통일 (PaperMod 테마 호환)
9c2c88d docs: About 페이지 현행화
b2797f8 fix: About 페이지 AI 에이전트 정체성 복원
```

---

### 2026-02-05 (저녁): Premium Content Workflow 구축 및 팩트체크 오류 수정

#### 작업 내용

1. **Draft Enhancer 에이전트 개발**
   - 페르소나 기반 콘텐츠 향상 시스템
   - 클리셰 자동 감지/대체 (severity: high/medium/low)
   - 디테일 수준 분석 (숫자, 실패담, 비교)

2. **Premium Content Workflow 7단계 프로세스 정립**
   ```
   Generate → Enhance → Factcheck → Quality → AEO → Image → Publish+Moltbook
   ```

3. **발행된 포스트 팩트체크 오류 수정**

   | 포스트 | 오류 내용 | 수정 |
   |--------|----------|------|
   | 서울 이색 박물관 | 뮤지엄김치간 5,000원 | → 20,000원 |
   | | 위치 "안녕인사동 6층" | → "인사동마루 4~6층" |
   | | 이동시간 주장 | → 검증 불가 문구 제거 |
   | 국립중앙박물관 | 경천사 "사층"석탑 | → "십층"석탑 |
   | | 소장품 "30만 점" | → "약 44만 점(2024년 기준)" |
   | | 건축가 최욱 | → "최욱(원오원아키텍스 대표)" |

4. **AEO 일괄 적용 (7개 포스트)**
   - FAQ 5개 + Schema.org 3개 (Article, FAQPage, BreadcrumbList)

5. **Moltbook 공유 시작**
   - 여수 밤바다 포스트 공유 완료
   - Rate limit으로 인해 나머지 포스트 순차 공유 예정

#### 생성된 파일
- `src/agents/draft-enhancer/index.ts` - 메인 에이전트
- `src/agents/draft-enhancer/cliche-filter.ts` - 클리셰 필터
- `src/agents/draft-enhancer/detail-analyzer.ts` - 디테일 분석기
- `src/agents/draft-enhancer/persona-loader.ts` - 페르소나 로더
- `src/cli/commands/enhance.ts` - CLI 명령어
- `config/persona.json` - "주말탈출러" 페르소나 설정

#### 수정된 파일
- `CLAUDE.md` - Premium Workflow 문서화
- `src/cli/index.ts` - enhance 명령어 등록
- `src/cli/commands/workflow.ts` - enhance 단계 통합
- `package.json` - enhance 관련 스크립트 추가
- `blog/content/posts/culture/2026-02-05-seoul-museum.md` - 팩트체크 수정
- `blog/content/posts/culture/2026-02-05-post.md` - 팩트체크 수정

#### 페르소나 설정 (config/persona.json)
```json
{
  "name": "주말탈출러",
  "tagline": "금요일 퇴근 후부터 일요일 저녁까지, 48시간의 가능성",
  "voice": {
    "never_say": ["힐링 여행", "인생샷", "감성 카페", "숨은 명소", ...],
    "signature_phrases": ["퇴근하고 바로 출발하면", "솔직히 다시 갈지는 모르겠지만", ...]
  },
  "detailing_rules": {
    "failure_story_required": true,
    "comparison_required": true
  }
}
```

#### 팩트체크 결과
| 포스트 | 수정 전 | 수정 후 |
|--------|---------|---------|
| 국립중앙박물관 | 60% | **100%** ✅ |
| 서울 이색 박물관 | 16% | 수정 완료 (경험담 위주로 자동검증 한계) |

#### Git 커밋
```
3bc842f docs: Premium Content Workflow 7단계 프로세스 문서화
441ceab fix: 서울 이색 박물관 팩트체크 오류 수정
e96f78e fix: 국립중앙박물관 가이드 팩트체크 오류 수정
bbd002c fix: 국립중앙박물관 정보 정확도 개선
9d87579 fix: 서울 이색 박물관 검증 불가 주장 제거
```

---

### 2026-02-05 (오후): 주간 콘텐츠 생성 및 검증 시스템 개선

#### 작업 내용

1. **주간 블로그 초안 7개 생성**
   - Gemini API (`gemini-3.0-flash`) 사용
   - 기존 발행 콘텐츠와 중복 없이 새로운 지역/주제 선정

2. **검증 로직 버그 수정**
   - 글자수 계산 오류 수정 (`src/quality/gates.ts`)
   - 민감 키워드 오탐 수정 (`src/quality/human-review.ts`)

3. **커버 이미지 7개 추가**
   - Unsplash API 활용
   - 자동화 스크립트 작성 (`scripts/add-cover-images.mts`)

#### 생성된 드래프트

| 파일명 | 카테고리 | 제목 | SEO | Content |
|--------|----------|------|-----|---------|
| `2026-02-05-7.md` | travel | 제주도 감성 카페 베스트 7 | 85% | 94% |
| `2026-02-05-jeonju-hanok.md` | travel | 전주 한옥마을 완벽 가이드 | 95% | 94% |
| `2026-02-05-2026-best-5.md` | culture | 2026 봄 뮤지컬 추천 BEST 5 | 85% | 94% |
| `2026-02-05-gangneung-cafe.md` | travel | 강릉 커피거리 & 안목해변 카페 투어 | 95% | 94% |
| `2026-02-05-daegu-alley.md` | travel | 대구 근대골목 역사 탐방 | 95% | 94% |
| `2026-02-05-seoul-museum.md` | culture | 서울 이색 박물관 베스트 5 | 85% | 94% |
| `2026-02-05-yeosu-night.md` | travel | 여수 밤바다 낭만 여행 | 95% | 94% |

#### 버그 수정 상세

**1. 글자수 계산 오류 (`src/quality/gates.ts:159-170`)**
```typescript
// 수정 전 (버그)
const koreanChars = content.replace(/[^가-힣]/g, '').length;
const wordCount = Math.round(koreanChars / 2);  // 한글만 추출 후 2로 나눔 → 실제의 절반

// 수정 후
const textOnly = content.replace(/[#*\-\[\]()_`~>|]/g, '').replace(/\s+/g, ' ');
const charCount = textOnly.replace(/\s/g, '').length;  // 전체 텍스트 글자수
```
- **영향:** content 점수 64% → 94%로 개선

**2. 민감 키워드 오탐 (`src/quality/human-review.ts:54-63`)**
```typescript
// 수정 전 (오탐 발생)
const SENSITIVE_KEYWORDS = ['문제', '절', '사건', ...];  // 일반 단어 포함

// 수정 후
const SENSITIVE_KEYWORDS = ['정치적 논란', '종교 갈등', '심각한 사고', ...];  // 구체적 표현만
```
- **영향:** "검토 필요" → "통과" 상태로 변경

#### 생성된 파일
- `scripts/gen-jeju-cafe.mts` - 제주 카페 포스트 생성
- `scripts/gen-jeonju.mts` - 전주 한옥마을 포스트 생성
- `scripts/gen-gangneung.mts` - 강릉 카페 포스트 생성
- `scripts/gen-remaining.mts` - 나머지 포스트 일괄 생성
- `scripts/gen-weekly-posts.mts` - 주간 포스트 일괄 생성
- `scripts/add-cover-images.mts` - 커버 이미지 일괄 추가

#### 수정된 파일
- `src/quality/gates.ts` - 글자수 계산 로직 수정
- `src/quality/human-review.ts` - 민감 키워드 목록 수정
- `src/cli/commands/moltbook.ts` - 미사용 case 제거 (빌드 오류 수정)
- `src/aeo/faq-generator.ts` - 타입 오류 수정

#### 추가된 커버 이미지
| 파일명 | 검색어 |
|--------|--------|
| `cover-musical-*.jpg` | musical theater stage |
| `cover-jeju-cafe-*.jpg` | jeju island cafe ocean view |
| `cover-daegu-*.jpg` | korean traditional alley street |
| `cover-gangneung-*.jpg` | gangneung korea beach cafe |
| `cover-jeonju-*.jpg` | jeonju hanok village korea |
| `cover-museum-*.jpg` | seoul museum interior |
| `cover-yeosu-*.jpg` | yeosu night view korea sea |

---

### 2026-02-05: 하이브리드 이미지 시스템 구현

#### 작업 내용
1. **Gemini AI 이미지 생성 모듈 개발**
   - `src/images/gemini-imagen.ts`: Gemini API 클라이언트
   - 일일 사용량 관리 (기본 50장, 경고 80%)
   - 6가지 이미지 스타일 지원

2. **이미지 프롬프트 전략 수립**
   - `src/generator/image-prompts.ts`: 스타일별 프롬프트 템플릿
   - 정보 전달 → 감성적 매력 + 공유 유도로 전환

   | 스타일 | 컨셉 | 용도 |
   |--------|------|------|
   | `infographic` | 여행 다이어리 페이지 | 정보 요약 |
   | `diagram` | 보물지도 여정 | 교통/동선 |
   | `map` | 친구가 그려준 지도 | 코스 안내 |
   | `comparison` | 카페 칠판 메뉴 | 맛집 비교 |
   | `moodboard` | 감성 콜라주 | 분위기 전달 |
   | `bucketlist` | 게이미피케이션 체크리스트 | 경험 목록 |

3. **콘텐츠 파서 개발**
   - `src/generator/content-parser.ts`: 마커 추출/삽입
   - 마커 형식: `[IMAGE:style:description]`
   - 자동 마커 삽입 기능

4. **CLI 옵션 추가**
   ```bash
   npm run new -- -t "주제" --type travel --inline-images --image-count 3
   ```

5. **이미지 경로 문제 해결**
   - Hugo baseURL (`/travel-blog/`) 호환성 수정
   - 모든 이미지 경로: `/travel-blog/images/...`

#### 생성된 파일
- `src/images/gemini-imagen.ts` (신규)
- `src/generator/image-prompts.ts` (신규)
- `src/generator/content-parser.ts` (신규)
- `scripts/add-images.mts` (유틸리티)

#### 수정된 파일
- `src/generator/index.ts` - 이미지 생성 플로우 통합
- `src/generator/prompts.ts` - 이미지 마커 가이드라인
- `src/cli/commands/new.ts` - CLI 옵션
- `src/cli/index.ts` - 명령어 정의
- `.env.example` - 환경변수 추가

---

## 포스팅 현황

### 발행된 포스트 (blog/content/posts/)

| 날짜 | 카테고리 | 제목 | 커버 | 인라인 이미지 |
|------|----------|------|------|---------------|
| 2026-02-04 | travel | 경주 여행 완벽 가이드 | ✓ | 3장 |
| 2026-02-04 | travel | 2월 겨울 국내여행 추천 베스트 5 | ✓ | - |
| 2026-02-04 | travel | 부산 해운대 맛집 베스트 4 | ✓ | - |
| 2026-02-04 | travel | 서울 북촌한옥마을 완벽 가이드 | ✓ | - |
| 2026-02-04 | culture | 국립현대미술관 서울 2026 기획전 | ✓ | 2장 |

### 발행 완료 (blog/content/posts/) - 2026-02-06 업데이트

| 파일명 | 카테고리 | 상태 | 커버 | 인라인 |
|--------|----------|------|------|--------|
| 2026-02-06-post.md | culture | ✔ 발행 | ✓ | 3장 (파주 출판도시/헤이리) |
| 2026-02-05-post.md | culture | ✔ 발행 | ✓ | 3장 (리움미술관 - **재생성**) |
| 2026-02-05-7.md | travel | ✔ 발행 | ✓ | 2장 |
| 2026-02-05-jeonju-hanok.md | travel | ✔ 발행 | ✓ | 2장 |
| 2026-02-05-2026-best-5.md | culture | ✔ 발행 | ✓ | 2장 |
| 2026-02-05-gangneung-cafe.md | travel | ✔ 발행 | ✓ | 2장 |
| 2026-02-05-daegu-alley.md | travel | ✔ 발행 | ✓ | 2장 |
| 2026-02-05-seoul-museum.md | culture | ✔ 발행 | ✓ | 2장 |
| 2026-02-05-yeosu-night.md | travel | ✔ 발행 | ✓ | 2장 |

---

## 이미지 자산

### 생성된 이미지 (blog/static/images/)

#### 2026-02-06 신규 (6장)
| 파일명 | 용도 |
|--------|------|
| inline-2026-02-06-post-1.jpeg | 파주 출판도시/헤이리 무드보드 |
| inline-2026-02-06-post-2.jpeg | 파주 주요 건축물 갤러리 지도 |
| inline-2026-02-06-post-3.jpeg | 파주 갤러리 추천 관람 동선 |
| inline-leeum-museum-1.jpeg | 리움미술관 건축/예술 무드보드 |
| inline-leeum-museum-2.jpeg | 리움미술관 관람 동선 다이어그램 |
| inline-leeum-museum-3.jpeg | 리움미술관 실용 정보 인포그래픽 |

#### 2026-02-05 신규 (14장)
| 파일명 | 용도 |
|--------|------|
| inline-daegu-course-map.jpeg | 대구 도보 코스 지도 |
| inline-daegu-food-guide.jpeg | 서문시장 먹거리 가이드 |
| inline-gangneung-cafe-map.jpeg | 강릉 카페 투어 지도 |
| inline-gangneung-cafe-compare.jpeg | 강릉 바다뷰 카페 비교 |
| inline-seoul-museum-map.jpeg | 서울 박물관 위치 지도 |
| inline-seoul-museum-compare.jpeg | 서울 박물관 비교 가이드 |
| inline-jeonju-course-map.jpeg | 전주 한옥마을 코스 지도 |
| inline-jeonju-food-guide.jpeg | 전주 먹거리 가이드 |
| inline-yeosu-night-map.jpeg | 여수 야경 명소 지도 |
| inline-yeosu-info.jpeg | 여수 여행 정보 인포그래픽 |
| inline-jeju-cafe-map.jpeg | 제주 카페 투어 지도 |
| inline-jeju-cafe-compare.jpeg | 제주 오션뷰 카페 비교 |
| inline-musical-guide.jpeg | 2026 뮤지컬 BEST 5 비교 |
| inline-musical-venue-map.jpeg | 서울 공연장 위치 지도 |

#### 2026-02-04 기존 (7장)
| 파일명 | 용도 | 크기 |
|--------|------|------|
| inline-2026-02-04-1-1.jpeg | 경주 교통정보 | 590KB |
| inline-2026-02-04-1-2.jpeg | 경주 코스지도 | 875KB |
| inline-2026-02-04-1-3.jpeg | 경주 맛집비교 | 476KB |
| inline-2026-02-04-post-1.jpeg | 광안리 가이드 | 852KB |
| inline-2026-02-04-post-2.jpeg | 광안리 코스지도 | 1.07MB |
| inline-mmca-exhibition-1.jpeg | 전시회 관람정보 | 727KB |
| inline-mmca-exhibition-2.jpeg | 전시회 관람동선 | 944KB |

### Gemini API 사용량
- 일일 한도: 50장
- 금일 사용: 21장 (기존 7장 + 신규 14장)
- 잔여: 29장

---

## 배포 정보

### Hugo 설정
- **baseURL:** `https://daun92.github.io/travel-blog/`
- **테마:** PaperMod
- **언어:** 한국어 (ko)

### 로컬 개발
```bash
# Hugo 서버 실행
cd blog && hugo serve -D -p 1313

# 접속 URL
http://localhost:1313/travel-blog/
```

### GitHub Pages 배포
```bash
# 1. Hugo 빌드
cd blog && hugo --minify

# 2. public 폴더를 gh-pages 브랜치로 푸시
# (또는 GitHub Actions 자동 배포)
```

---

## 워크플로우 가이드

### 🌟 Premium Workflow (권장)

고품질 콘텐츠 발행을 위한 7단계 표준 프로세스:

```bash
# Step 1: 콘텐츠 생성
npm run new -- -t "주제" --type travel

# Step 2: 페르소나 기반 향상
npm run enhance -- -f drafts/파일명.md
npm run enhance -- --all                    # 모든 드래프트

# Step 3: 팩트체크 (70% 이상 필수)
npm run factcheck -- -f drafts/파일명.md

# Step 4: 품질 검증
npm run validate -- -f drafts/파일명.md

# Step 5: AEO 적용 (FAQ + Schema.org)
npm run aeo -- -f drafts/파일명.md --apply

# Step 6: 이미지 확인 (/travel-blog/ prefix)

# Step 7: 발행 + Moltbook
npm run publish
npm run moltbook:share
```

#### 통합 명령어
```bash
npm run workflow:premium -- -f drafts/파일명.md
```

### 새 포스트 생성 (기본)
```bash
# 1. 기본 생성
npm run new -- -t "주제" --type travel

# 2. 인라인 이미지 포함
npm run new -- -t "주제" --type travel --inline-images --image-count 2

# 3. 비대화 모드 (자동)
npm run new -- -t "주제" --type travel --inline-images --yes
```

### 기존 포스트에 이미지 추가
```bash
# scripts/add-images.mts 수정 후 실행
npx tsx scripts/add-images.mts
```

### 초안 검토 및 발행 (레거시)
```bash
# 초안 목록
npm run drafts

# 검토
npm run review -- -f filename.md

# 발행
npm run publish -- -f filename.md
```

---

## 환경 변수 (.env)

```env
# Gemini API (텍스트 + 이미지 생성) - 필수
GEMINI_API_KEY=your-key
LLM_MODEL=gemini-3.0-flash              # 텍스트 생성
GEMINI_IMAGE_MODEL=gemini-3.0-pro-preview  # 이미지 생성
GEMINI_IMAGE_ENABLED=true
GEMINI_IMAGE_MAX_COUNT=50

# Unsplash (커버 이미지)
UNSPLASH_ACCESS_KEY=your-key

# Hugo
HUGO_BASE_URL=/travel-blog
```

> **참고:** 2026-02-05 기준 Ollama에서 Gemini API로 완전 전환됨

---

## 향후 계획

### 단기 (1-2주)
- [x] 이미지 없는 포스트에 인라인 이미지 추가 ✅ (2026-02-05 완료)
- [x] 링크 프로세서 AI 장소 추출 재설계 ✅ (2026-02-07 완료)
- [x] 팩트체크 자동 수정 시스템 구현 ✅ (2026-02-07 완료)
- [x] Moltbook 배치 공유 큐잉 시스템 ✅ (2026-02-07 완료)
- [x] 저성과 포스트 리라이트 자동화 ✅ (2026-02-07 완료)
- [x] Windows Task Scheduler 연동 ✅ (2026-02-07 완료)
- [ ] 저성과 포스트 실제 리라이트 실행 (`npm run rewrite:low`)
- [ ] Task Scheduler 설치 및 검증 (`.\scheduler\install.ps1`)
- [ ] SEO 최적화 검토
- [ ] GitHub Pages 자동 배포 설정

### 중기 (1개월)
- [x] Moltbook 피드백 시스템 활성화 ✅
- [ ] 키워드 기반 자동 포스트 생성
- [ ] 방문자 분석 연동
- [ ] PM2 → Task Scheduler 완전 마이그레이션

### 장기 (3-4개월)
- [ ] 월 1,000 방문자 목표 달성
- [ ] 콘텐츠 전략 자동 조정
- [ ] 다국어 지원

---

## 시행착오 및 문제 해결 기록

### 2026-02-05 (저녁): AI 생성 콘텐츠 팩트체크 이슈

#### 1. AI가 생성한 부정확한 정보
**증상:** 팩트체크 점수 16~60%로 매우 낮음
**원인:** AI(Gemini)가 정확하지 않은 정보 생성
- 뮤지엄김치간 입장료: 5,000원 (실제: 20,000원)
- 경천사 "사층"석탑 (실제: 십층석탑)
- 소장품 "30만 점" (실제: 약 44만 점)

**해결:**
1. 웹 검색으로 공식 정보 확인
2. 수동으로 정확한 정보로 교체
3. 검증 불가한 주관적 주장 제거/완화

**교훈:**
- AI 생성 콘텐츠는 반드시 팩트체크 필수
- 구체적 숫자(가격, 수량, 시간)는 특히 검증 필요
- 70% 미만 팩트체크 점수 → 발행 전 수동 검토

---

#### 2. 자동 팩트체크의 한계
**증상:** 경험담/주관적 내용이 많은 포스트는 점수가 낮게 나옴
**원인:**
- "지하철로 40~60분" 같은 주관적 주장은 검증 어려움
- 개인 경험 기반 내용은 외부 소스로 확인 불가

**해결:**
- 검증 가능한 객관적 사실 위주로 클레임 작성
- 주관적 경험은 명확히 개인 의견임을 표시
- 구체적 시간/거리 주장 대신 일반적 표현 사용

**예시:**
```markdown
# 수정 전 (검증 어려움)
강남/판교 기준 지하철로 40~60분이면 다 도착합니다.

# 수정 후 (검증 용이)
모두 지하철역에서 도보 10분 이내 거리예요.
```

---

#### 3. 팩트체크 검증 소스 목록
| 분야 | 검증 소스 |
|------|----------|
| 박물관 정보 | museum.go.kr, 각 박물관 공식 사이트 |
| 입장료/운영시간 | 공식 사이트, trip.com, namu.wiki |
| 건축/설계 정보 | 건축 전문 매체, 위키피디아 |
| 문화재 정보 | heritage.go.kr, encykorea.aks.ac.kr |

---

### 2026-02-05: 하이브리드 이미지 시스템 구현 중 발생한 이슈들

#### 1. TypeScript 타입 오류 - `'data' is of type 'unknown'`
**증상:** `gemini-imagen.ts`에서 API 응답 처리 시 TypeScript 컴파일 오류
```
error TS18046: 'data' is of type 'unknown'.
```
**원인:** `response.json()` 반환값이 `unknown` 타입으로 추론됨
**해결:**
```typescript
// 인터페이스 정의
interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        inlineData?: { data: string; mimeType: string };
        text?: string;
      }>;
    };
  }>;
  error?: { message: string };
}

// 타입 캐스팅 적용
const data = await response.json() as GeminiResponse;
```
**교훈:** 외부 API 응답은 항상 명시적 인터페이스로 타입 정의 필요

---

#### 2. 이미지 404 오류 - Hugo baseURL 불일치
**증상:**
- Hugo 서버에서 인라인 이미지가 404로 표시
- 커버 이미지는 일부만 표시됨

**원인:**
- Hugo baseURL이 `/travel-blog/`로 설정됨
- 이미지 경로가 `/images/...`로 생성되어 실제 경로와 불일치
- 경로 일관성 부재: 일부는 상대경로(`images/...`), 일부는 절대경로(`/images/...`)

**해결 과정:**
1. 발행된 포스트 확인 → 경로 불일치 발견
2. 초안 파일 확인 → 동일한 문제 발견
3. 소스 코드 수정 → `HUGO_BASE_URL` 환경변수 도입
4. 기존 포스트 일괄 수정 → 모든 경로 `/travel-blog/images/...`로 통일

**수정된 코드 (`gemini-imagen.ts`):**
```typescript
const baseURL = process.env.HUGO_BASE_URL || '/travel-blog';
const relativePath = `${baseURL}/images/${fullFilename}`;
```

**영향받은 파일:**
- `blog/content/posts/travel/*.md` - 커버 및 인라인 이미지 경로
- `blog/content/posts/culture/*.md` - 커버 및 인라인 이미지 경로
- `drafts/*.md` - 인라인 이미지 경로

**교훈:**
- Hugo 프로젝트에서 이미지 경로는 반드시 baseURL을 포함해야 함
- 경로 생성 로직은 환경변수로 중앙 관리
- 새 기능 추가 시 기존 콘텐츠와의 호환성 반드시 검증

---

#### 3. 스크립트 환경변수 미로드 - dotenv 누락
**증상:** `scripts/add-images.mts` 실행 시 "Gemini 상태: ✗ API 키 없음"
**원인:** 독립 실행 스크립트에서 dotenv 설정이 누락됨
**해결:**
```typescript
// scripts/add-images.mts 상단에 추가
import { config } from 'dotenv';
config();  // .env 파일 로드
```
**교훈:**
- CLI 외부에서 실행되는 스크립트는 환경변수 로드를 명시적으로 수행
- 스크립트 작성 시 독립 실행 가능 여부 테스트 필수

---

#### 4. Git 중첩 저장소 경고
**증상:** `git add blog/` 실행 시 embedded repository 경고
```
warning: adding embedded git repository: claude/openclaw/blog
```
**원인:** `blog/` 폴더가 별도의 git 저장소 (Hugo 테마 또는 GitHub Pages 배포용)
**해결:**
- `blog/` 폴더는 메인 저장소에서 제외
- 별도의 저장소로 독립 관리
- `.gitignore`에 `blog/` 추가 고려

**구조:**
```
openclaw/           # 메인 저장소 (소스 코드)
└── blog/           # 별도 저장소 (Hugo 블로그, GitHub Pages)
    └── .git/
```
**교훈:**
- 배포용 폴더와 소스 폴더의 버전 관리 분리 권장
- 서브모듈 또는 별도 저장소로 관리

---

#### 5. 이미지 프롬프트 전략 전환
**문제:** 초기 프롬프트가 정보 전달 중심으로 구성되어 매력도 부족
**원인:** 기능적 관점(가격표, 시간표)에서만 이미지 설계
**해결:** 감성적 매력 + 공유 유도 전략으로 전환

| 기존 | 개선 |
|------|------|
| "가격 비교 표" | "카페 칠판 메뉴판 느낌" |
| "교통 다이어그램" | "보물지도 여정" |
| "코스 지도" | "친구가 그려준 약도" |

**교훈:**
- AI 생성 이미지의 장점 = 일러스트/감성 그래픽
- 실사 느낌보다 일러스트 스타일이 AI 생성에 적합
- 공유하고 싶은 콘텐츠 = SNS 확산 유도

---

## 개발 지침 및 규칙

### 필수 체크리스트 (새 기능 추가 시)

#### 코드 작성
- [ ] 외부 API 응답에 대한 TypeScript 인터페이스 정의
- [ ] 환경변수 사용 시 기본값 설정 (`process.env.VAR || 'default'`)
- [ ] 에러 핸들링 및 사용자 친화적 메시지

#### 이미지/미디어 관련
- [ ] Hugo baseURL 반영 여부 확인 (`/travel-blog/...`)
- [ ] 이미지 경로 일관성 검증 (상대/절대 경로 혼용 금지)
- [ ] 새 이미지 생성 후 브라우저에서 404 테스트

#### 스크립트 작성
- [ ] `import { config } from 'dotenv'; config();` 포함
- [ ] 독립 실행 테스트 (`npx tsx scripts/xxx.mts`)
- [ ] 에러 시 명확한 가이드 메시지 출력

#### 배포 전
- [ ] `npm run build` 성공 확인
- [ ] Hugo 로컬 서버에서 전체 페이지 검증
- [ ] 이미지 로딩 상태 확인 (Network 탭)

---

### 경로 규칙

#### 이미지 경로 (Hugo)
```
올바른 예:
/travel-blog/images/cover-xxx.jpg
/travel-blog/images/inline-xxx.jpeg

잘못된 예:
/images/cover-xxx.jpg          # baseURL 누락
images/cover-xxx.jpg           # 상대경로 (Hugo에서 문제 발생 가능)
```

#### 파일 저장 위치
```
커버 이미지:     blog/static/images/cover-*.jpg
인라인 이미지:   blog/static/images/inline-*.jpeg
초안:           drafts/*.md
발행 포스트:    blog/content/posts/{travel|culture}/*.md
```

---

### 환경변수 관리

#### 필수 환경변수
| 변수 | 용도 | 기본값 |
|------|------|--------|
| `GEMINI_API_KEY` | 텍스트/이미지 생성 | (필수) |
| `LLM_MODEL` | 텍스트 생성 모델 | `gemini-3.0-flash` |
| `GEMINI_IMAGE_MODEL` | 이미지 생성 모델 | `gemini-3.0-pro-preview` |
| `HUGO_BASE_URL` | 경로 접두사 | `/travel-blog` |

#### 환경변수 검증
```bash
# 현재 설정 확인
npm run status
```

---

### Git 워크플로우

#### 메인 저장소 (openclaw/)
- 소스 코드, 설정, 문서
- 커밋 메시지: `feat:`, `fix:`, `docs:` 접두사 사용

#### 블로그 저장소 (blog/)
- Hugo 빌드 결과물, 테마
- GitHub Pages 배포용
- 별도 관리 (`cd blog && git add . && git commit`)

#### 커밋 전 확인사항
```bash
# 1. 빌드 테스트
npm run build

# 2. git status 확인 (blog/ 폴더 제외 확인)
git status

# 3. 커밋
git add <specific-files>
git commit -m "type: 설명"
```

---

## 점검 체크리스트

### 주간 점검
- [ ] Gemini API 사용량 확인
- [ ] 생성된 포스트 품질 검토
- [ ] 이미지 로딩 상태 확인
- [ ] Hugo 빌드 오류 확인

### 월간 점검
- [ ] 방문자 통계 분석
- [ ] 인기 키워드 업데이트
- [ ] 콘텐츠 전략 조정
- [ ] API 비용 검토
