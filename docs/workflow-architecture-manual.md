# 비선형 워크플로우 아키텍처 매뉴얼

> OpenClaw 콘텐츠 파이프라인의 내부 동작 원리와 사용법을 설명합니다.
> 이 문서는 프로젝트에 처음 참여하는 개발자도 이해할 수 있도록 작성되었습니다.

---

## 목차

1. [한 줄 요약](#한-줄-요약)
2. [배경: 왜 바꿨나](#배경-왜-바꿨나)
3. [핵심 개념 3가지](#핵심-개념-3가지)
4. [4개 레이어 구조](#4개-레이어-구조)
5. [일상 사용법](#일상-사용법)
6. [시나리오별 가이드](#시나리오별-가이드)
7. [옵션 전체 목록](#옵션-전체-목록)
8. [프로그래밍 API](#프로그래밍-api)
9. [자주 묻는 질문](#자주-묻는-질문)
10. [문제 해결](#문제-해결)
11. [파일 구조 참조](#파일-구조-참조)

---

## 한 줄 요약

**서로 관련 없는 검증 단계를 동시에 실행하고, 실패하면 자동으로 고쳐보고, 결과를 이벤트로 알려주는 시스템.**

---

## 배경: 왜 바꿨나

### 이전 구조의 문제

이전에는 모든 검증이 **한 줄로 순서대로** 실행되었습니다.

```
factcheck → seo → content → readability → tone → structure → keyword → duplicate → image
   5초      50ms   10ms      8ms          12ms    15ms        10ms      40ms        30ms

총 소요: 약 5.2초
```

문제점:

- **seo 검사(50ms)가 factcheck(5초)가 끝날 때까지 기다림** — 서로 관련 없는데도
- factcheck가 실패하면 **나머지 검사를 아예 못 함** — 다른 문제를 모름
- 실패하면 **사람이 직접 고쳐야 함** — 자동으로 고칠 수 있는 것도
- 발행 후 피드백 수집을 **수동으로 기억해야 함** — 잊기 쉬움

### 새 구조가 해결하는 것

```
factcheck ─────────── 5초 ──────┐
seo|content|readability|tone|   │  동시에 실행
structure|keyword|duplicate ─── │  50ms만에 끝남
image ────────────────────────  │
                                ↓
총 소요: 약 5초 (factcheck 시간이 곧 전체 시간)
```

- 관련 없는 단계는 **동시에 실행**
- 하나가 실패해도 **나머지는 계속 진행**
- 고칠 수 있는 실패는 **자동으로 1번 시도**
- 발행하면 **24시간 후 피드백 수집이 자동 등록**

---

## 핵심 개념 3가지

이 시스템은 3가지 새로운 개념으로 구성됩니다. 하나씩 설명합니다.

### 개념 1: EventBus (이벤트 버스)

**비유**: 사무실의 사내 방송 시스템

누군가 "포스트가 발행되었습니다"라고 방송하면, 관심 있는 사람(스케줄러, 모니터링 등)이 각자 알아서 행동합니다. 방송하는 쪽은 누가 듣는지 몰라도 되고, 듣는 쪽은 방송하는 쪽을 몰라도 됩니다.

```
발행 모듈 ──→ [EventBus: "content:published"] ──→ 스케줄러: 피드백 태스크 등록
                                                ──→ 모니터링: 로그 기록
                                                ──→ (아무도 안 들어도 OK)
```

**핵심 포인트**:

- EventBus가 없어도 기존 기능은 그대로 동작합니다
- EventBus는 "추가 자동화"를 붙이는 창구입니다
- `--verbose` 옵션을 켜면 이벤트 로그를 볼 수 있습니다

### 개념 2: QualityMesh (품질 메시)

**비유**: 병원의 종합검진

기존에는 혈액검사 끝나고 → X-ray 찍고 → 심전도 하고... 순서대로 했습니다.
이제는 혈액검사(시간 오래 걸림)를 보내놓고, 그 사이에 X-ray, 심전도, 시력검사를 동시에 합니다.

```
기존:  [혈액검사 5분] → [X-ray 1분] → [심전도 1분] → [시력 1분] = 8분
메시:  [혈액검사 5분────────────────────]
       [X-ray 1분]  (동시)              = 5분
       [심전도 1분] (동시)
       [시력 1분]   (동시)
```

그리고 검사 결과가 나쁘면 **자동으로 한 번 치료 시도** (치유 루프):

- 팩트체크 실패 → 틀린 부분 자동 수정
- 내용 부족 → 콘텐츠 보강 자동 실행
- SEO 부족 → 메타 설명 자동 생성

### 개념 3: DAG Executor (방향 비순환 그래프 실행기)

**비유**: 요리 레시피의 병렬 진행

파스타를 만들 때:

- 물 끓이기(5분)와 소스 만들기(7분)는 **동시에** 할 수 있음
- 면 삶기(8분)는 물이 끓은 **후에만** 가능
- 플레이팅은 면과 소스 **둘 다 완성된 후에만** 가능

```
물 끓이기 ──→ 면 삶기 ──┐
                         ├──→ 플레이팅
소스 만들기 ─────────────┘
```

파이프라인도 마찬가지입니다:

```
discover(주제 발굴) ──→ select(선택) ──→ generate(생성) ──→ validate ──→ publish
monitor(모니터링) ─────────────────────────────────────────────────────────────
↑ discover와 관련 없음 → 동시 시작 가능
```

`discover`와 `monitor`는 서로 필요하지 않으므로 **동시에 시작**합니다.

---

## 4개 레이어 구조

시스템은 4개 층으로 나뉩니다. 아래층이 데이터, 위로 갈수록 제어 역할입니다.

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   Layer 4: 조율층 (Orchestration)                        │
│   "무엇을, 어떤 순서로 실행할지 결정"                      │
│                                                         │
│   담당 모듈: DAGExecutor, EventBus, Scheduler            │
│   담당 파일: dag-executor.ts, event-bus.ts, scheduler.ts │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   Layer 3: 품질 그물망 (Quality Mesh)                     │
│   "여러 검증을 동시에 하고, 실패하면 고쳐봄"                │
│                                                         │
│   담당 모듈: QualityMesh                                 │
│   담당 파일: quality-mesh.ts                             │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   Layer 2: 콘텐츠 흐름 (Content Flow)                     │
│   "실제로 글을 만들고, 다듬고, 올리는 과정"                 │
│                                                         │
│   담당 모듈: ContentPipeline, stages                     │
│   담당 파일: pipeline.ts, stages.ts                      │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   Layer 1: 데이터 + 피드백 (Data & Feedback)              │
│   "외부에서 정보를 가져오고, 발행 후 반응을 수집"            │
│                                                         │
│   담당 모듈: collector, moltbook, survey                 │
│   담당 파일: collector.ts, moltbook/*.ts                 │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 레이어 간 통신

레이어끼리는 **EventBus를 통해** 느슨하게 연결됩니다.

```
publish(Layer 2) ──이벤트──→ EventBus(Layer 4) ──이벤트──→ Scheduler(Layer 4)
                                                         "24시간 후 피드백 수집"
                                                              │
                                                              ↓
                                                     feedback(Layer 1)
                                                              │
                                                              ↓
                                                     strategy 갱신
                                                              │
                                                              ↓
                                                     다음 discover(Layer 2)에 반영
```

직접 함수를 호출하는 게 아니라 이벤트를 발행하므로, 한쪽을 수정해도 다른 쪽에 영향이 없습니다.

---

## 일상 사용법

### 가장 기본적인 사용

**아무 옵션 없이 기존 명령어를 그대로 쓰면 됩니다.** 내부적으로 병렬 실행이 자동 적용됩니다.

```bash
# 포스트 생성 (변경 없음)
npm run new -- -t "부산 해운대" --type travel --auto-collect --inline-images -y

# 검증 (내부적으로 병렬 실행 — 더 빨라짐)
npm run workflow full -f drafts/2026-02-10-부산-해운대.md --enhance --apply

# 발행 (변경 없음)
npm run publish
npm run moltbook:share
```

### 새로 추가된 옵션 (선택사항)

| 옵션                  | 기본값        | 설명                           |
| --------------------- | ------------- | ------------------------------ |
| `--remediate`         | 꺼짐          | 실패한 검증을 자동으로 고쳐봄  |
| `--no-parallel-gates` | (병렬이 기본) | 검증을 순서대로 실행           |
| `--no-parallel`       | (병렬이 기본) | 파이프라인을 순서대로 실행     |
| `--verbose`           | 꺼짐          | 이벤트 로그와 타이밍 정보 표시 |

---

## 시나리오별 가이드

### 시나리오 A: "포스트 하나 빠르게 검증하고 발행하고 싶어"

**대상**: 매일 포스트를 발행하는 일상 작업

```bash
# Step 1: 생성
npm run new -- -t "경주 불국사 봄 여행" --type travel \
  --auto-collect --inline-images --image-count 4 -y

# Step 2: 검증 + 향상 + AEO 적용 (한 번에)
npm run workflow full -f drafts/2026-02-10-경주-불국사-봄-여행.md \
  --enhance --apply

# Step 3: 결과 확인
#   ✓ factcheck (85%)
#   ✓ seo (90%)
#   ✓ content (82%)
#   ...
#   ✅ 발행 가능

# Step 4: 발행
npm run publish
```

**소요 시간**: 기존 ~8초 → 약 5초 (factcheck 시간이 전체 시간)

---

### 시나리오 B: "검증 점수가 낮은데 자동으로 고칠 수 있어?"

**대상**: factcheck 60%, content 55% 등 기준 미달 포스트

```bash
# --remediate 옵션 추가
npm run workflow full -f drafts/low-score-post.md \
  --enhance --apply --remediate --verbose
```

**화면에 나타나는 것**:

```
🔄 통합 워크플로우 (Full+Enhance 모드)

[mesh]       품질 메시 실행 중 (factcheck + quality + image)...
[factcheck]  팩트체크 실행 중...

   ✗ factcheck (62%) - 검증: 8/15
   ⚠ content (55%) - 분량 부족 (1200자, 권장 1500자)
   ⚠ tone (48%) - 목표: friendly, 감지: formal
   ✓ seo (85%)
   ✓ image (90%)

[remediate] factcheck 치유 시도 중...
   → 자동 수정 3개 적용
[remediate] ✓ factcheck 치유 성공

[remediate] content 치유 시도 중...
   → 콘텐츠 보강 실행 (클리셰 -4, 디테일 +6)
[remediate] ✓ content 치유 성공

[remediate] tone 치유 시도 중...
   → 페르소나 정합성 향상
[remediate] ✓ tone 치유 성공

[mesh] 타이밍: factcheck (5230ms) | quality-gates (52ms) | image (28ms)

📋 경주 불국사 봄 여행
   ✓ factcheck (62%) → 치유 적용됨
   ✓ content (55%) → 치유 적용됨
   ✓ tone (48%) → 치유 적용됨
   ✓ seo (85%)
   ✓ image (90%)
   ✅ 발행 가능
```

**치유 규칙 정리**:

| 실패한 검증         | 자동 치유 방법                        | 횟수 제한 |
| ------------------- | ------------------------------------- | --------- |
| factcheck           | 틀린 정보 자동 수정 (`applyAutoFix`)  | 1회       |
| content (분량 부족) | 콘텐츠 보강 (`enhanceDraft`)          | 1회       |
| tone (어조 불일치)  | 페르소나 맞춤 재작성 (`enhanceDraft`) | 1회       |
| seo (설명 누락)     | 본문에서 메타 설명 자동 생성          | 1회       |
| duplicate (중복)    | **치유 불가** → 발행 차단             | -         |
| image (이미지 부족) | **치유 불가** → 경고만 표시           | -         |
| readability         | **치유 불가** → 수동 수정 필요        | -         |

> 치유는 **최대 1회**만 시도합니다. 1회 치유 후에도 기준 미달이면 사람이 직접 수정해야 합니다.

---

### 시나리오 C: "드래프트 여러 개를 한꺼번에 검증하고 싶어"

**대상**: 파이프라인으로 생성한 포스트를 일괄 검증

```bash
# 모든 드래프트 검증
npm run workflow full --all

# 또는 자동 치유도 함께
npm run workflow full --all --remediate
```

**화면에 나타나는 것**:

```
🔄 통합 워크플로우 (Full 모드)

발견된 초안: 5개

📋 부산 해운대 겨울 여행
   ✓ factcheck (88%) ✓ seo (92%) ✓ content (85%)
   ✅ 발행 가능

📋 서울 인디 공연장 가이드
   ✗ factcheck (58%) ⚠ content (62%)
   🚫 발행 차단

📋 전주 한옥마을 맛집
   ✓ factcheck (91%) ✓ seo (78%) ✓ content (80%)
   ✅ 발행 가능

...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 통합 워크플로우 요약
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
총 검증 파일: 5개
전체 평균 점수: 79%

  ✅ 발행 가능: 3개
  ⚠️ 검토 필요: 1개
  🚫 발행 차단: 1개
```

---

### 시나리오 D: "주제 발굴부터 발행까지 전부 자동으로"

**대상**: 전체 파이프라인을 한 번에 돌리는 경우

```bash
# 전체 파이프라인 (DAG 병렬 모드)
npm run pipeline run all --verbose
```

**실행 순서** (DAG가 자동으로 결정):

```
시간  0초: discover(주제 발굴) ──시작──┐
           monitor(모니터링)  ──시작──┤  ← 동시 시작 (서로 독립적)
시간  2초: monitor ──완료──           │
시간  3초: discover ──완료──          │
           select(주제 선택) ──시작── │  ← discover 끝나야 시작 가능
시간  4초: select ──완료──            │
           generate(생성) ──시작──    │  ← select 끝나야 시작 가능
시간 19초: generate ──완료──          │
           validate(검증) ──시작──   │  ← generate 끝나야 시작 가능
시간 24초: validate ──완료──          │  (내부에서 QualityMesh 병렬 실행)
           publish(발행) ──시작──    │
시간 25초: publish ──완료──           │
```

```bash
# 순차 모드로도 실행 가능 (디버깅용)
npm run pipeline run --no-parallel --verbose

# 특정 단계만 실행
npm run pipeline discover           # 주제 발굴만
npm run pipeline generate           # 생성+검증만
npm run pipeline --schedule         # 스케줄러 상태 확인
```

---

### 시나리오 E: "왜 이 게이트가 실패하는지 모르겠어"

**대상**: 특정 검증이 계속 실패하는 원인을 파악하고 싶을 때

```bash
# Step 1: verbose로 상세 정보 확인
npm run workflow full -f drafts/problem-post.md --verbose
```

`--verbose`가 보여주는 추가 정보:

- 각 게이트의 **실행 시간** (어떤 게이트가 느린지)
- 게이트별 **세부 감점 항목** (왜 점수가 낮은지)
- **이벤트 로그** (어떤 이벤트가 발생했는지)

```
[mesh] 타이밍: factcheck (5012ms) | quality-gates (48ms) | image (32ms)

   ✓ factcheck (82%) - 검증: 12/15
   ✗ seo (45%) - 메타 설명 없음, 태그/키워드 없음, 소제목(H2/H3) 없음
   ✓ content (78%) - 분량 양호
   ✓ readability (85%)
   ...
```

위 예시에서 seo가 45%인 이유: **메타 설명(-15점), 태그 없음(-15점), 소제목 없음(-15점)**.

```bash
# Step 2: 자동 치유로 고칠 수 있는지 확인
npm run workflow full -f drafts/problem-post.md --remediate --verbose

# → [remediate] seo 치유 시도 중...
# → frontmatter description 자동 생성 (본문 첫 155자)
# → ✓ seo 치유 성공
#
# 하지만 태그와 소제목은 자동 치유 불가 → 수동 추가 필요
```

---

### 시나리오 F: "발행 후 피드백 수집을 매번 까먹어"

**대상**: Moltbook 피드백 수집을 자동화하고 싶은 경우

이 시스템은 **발행 시 자동으로 24시간 후 피드백 수집 태스크를 등록**합니다.

```
npm run publish
   │
   ├→ EventBus: "content:published" 이벤트 발생
   │
   └→ Scheduler가 자동 수신
        └→ "24시간 후 피드백 수집" 태스크 자동 등록
```

스케줄러 상태 확인:

```bash
npm run pipeline --schedule

# ⏰ 스케줄러 상태
#
# ✓ 일일 콘텐츠 파이프라인
#     스케줄: 매일 09:00
#
# ✓ 일일 피드백 수집
#     스케줄: 매일 18:00
#
# ✓ 피드백 수집: 부산-해운대-겨울-여행.md    ← 자동 등록됨
#     스케줄: 매일 14:30
```

---

## 옵션 전체 목록

### `npm run workflow` 옵션

```bash
npm run workflow [mode] [options]
```

**mode** (첫 번째 인자):

| 값        | 설명                |
| --------- | ------------------- |
| `full`    | 전체 검증 (기본값)  |
| `quick`   | 팩트체크만 빠르게   |
| `enhance` | 향상 포함 전체 검증 |

**options**:

| 옵션                  | 기본값   | 설명                            |
| --------------------- | -------- | ------------------------------- |
| `-f, --file <path>`   | -        | 검증할 파일 경로                |
| `-a, --all`           | -        | 모든 드래프트 검증              |
| `--enhance`           | 꺼짐     | 콘텐츠 향상 실행                |
| `--enhance-only`      | 꺼짐     | 향상만 (검증 없이)              |
| `--apply`             | 꺼짐     | AEO 요소(FAQ, Schema) 자동 적용 |
| `--auto-fix`          | 꺼짐     | 팩트체크 자동 수정              |
| `--remediate`         | 꺼짐     | 모든 실패 게이트 자동 치유      |
| `--parallel-gates`    | **켜짐** | 품질 게이트 병렬 실행           |
| `--no-parallel-gates` | -        | 품질 게이트 순차 실행           |
| `--draft`             | 꺼짐     | Moltbook Draft 공유 포함        |
| `-v, --verbose`       | 꺼짐     | 상세 출력 (타이밍, 이벤트 로그) |
| `--json`              | 꺼짐     | JSON 형식 결과 출력             |

### `npm run pipeline` 옵션

```bash
npm run pipeline [stage] [options]
```

**stage** (첫 번째 인자):

| 값                | 설명            |
| ----------------- | --------------- |
| (없음) 또는 `all` | 전체 파이프라인 |
| `discover`        | 주제 발굴만     |
| `select`          | 주제 선택만     |
| `generate`        | 생성만          |
| `validate`        | 검증만          |
| `publish`         | 발행만          |
| `monitor`         | 모니터링만      |

**options**:

| 옵션                | 기본값   | 설명                         |
| ------------------- | -------- | ---------------------------- |
| `--dry-run`         | 꺼짐     | 실제 생성/발행 없이 미리보기 |
| `--parallel`        | **켜짐** | DAG 병렬 실행                |
| `--no-parallel`     | -        | 순차 실행                    |
| `--remediate`       | 꺼짐     | 실패 게이트 자동 치유        |
| `--enhanced`        | 꺼짐     | 2차원 강화 발굴              |
| `-v, --verbose`     | 꺼짐     | 상세 출력                    |
| `--history [count]` | -        | 실행 기록 조회               |
| `--config`          | -        | 설정 확인                    |
| `--schedule`        | -        | 스케줄러 상태 확인           |

### `--auto-fix` vs `--remediate` 차이

|          | `--auto-fix`            | `--remediate`                         |
| -------- | ----------------------- | ------------------------------------- |
| **범위** | factcheck만             | 모든 게이트                           |
| **동작** | 팩트체크 틀린 부분 수정 | factcheck + content + tone + seo 치유 |
| **관계** | `--remediate`에 포함됨  | `--auto-fix`의 상위 집합              |

`--remediate`를 쓰면 `--auto-fix`는 따로 안 켜도 됩니다.

---

## 프로그래밍 API

### EventBus 사용

```typescript
import { getEventBus } from "./workflow/event-bus.js";

const bus = getEventBus();

// 이벤트 구독 (원하는 이벤트만 골라서)
bus.on("content:published", (data) => {
  console.log(`발행됨: ${data.blogUrl}`);
  // 슬랙 알림, 통계 기록 등 자유롭게 추가
});

bus.on("quality:gate-failed", (data) => {
  console.log(`${data.gate} 실패 (${data.score}%): ${data.filePath}`);
});

bus.on("quality:mesh-complete", (data) => {
  console.log(`검증 완료: 발행 ${data.canPublish ? "가능" : "불가"}`);
});
```

### 사용 가능한 이벤트 목록

| 이벤트                      | 발생 시점       | 데이터                                     |
| --------------------------- | --------------- | ------------------------------------------ |
| `content:generated`         | 포스트 생성 후  | `filePath`, `topic`, `type`                |
| `content:enhanced`          | 향상 적용 후    | `filePath`, `changes`                      |
| `content:published`         | 발행 완료 후    | `filePath`, `blogUrl`                      |
| `quality:gate-passed`       | 게이트 통과     | `filePath`, `gate`, `score`                |
| `quality:gate-failed`       | 게이트 실패     | `filePath`, `gate`, `score`, `remediation` |
| `quality:mesh-complete`     | 전체 검증 완료  | `filePath`, `canPublish`, `scores`         |
| `data:collected`            | 데이터 수집 후  | `topic`, `sources`                         |
| `feedback:received`         | 피드백 수신     | `postSlug`, `sentiment`                    |
| `feedback:strategy-updated` | 전략 갱신       | `changes`                                  |
| `pipeline:stage-start`      | 스테이지 시작   | `runId`, `stage`                           |
| `pipeline:stage-end`        | 스테이지 종료   | `runId`, `stage`, `success`, `duration`    |
| `pipeline:complete`         | 파이프라인 완료 | `runId`, `summary`                         |

### QualityMesh 단독 사용

```typescript
import { runQualityMesh } from "./workflow/quality-mesh.js";

const result = await runQualityMesh("drafts/post.md", {
  parallel: true, // 병렬 실행
  remediate: true, // 자동 치유
  verbose: true, // 상세 출력
});

console.log(result.canPublish); // true/false
console.log(result.remediationsApplied); // 치유 적용 횟수
console.log(result.timing); // { factcheck: 5012, 'quality-gates': 48, image: 32 }
console.log(result.stages); // 게이트별 상세 결과 배열
```

### DAG Executor 커스텀 사용

```typescript
import { DAGExecutor } from "./workflow/dag-executor.js";

const dag = new DAGExecutor({ parallel: true, verbose: true });

// 스테이지 등록 (dependsOn으로 순서 지정)
dag.addStage({
  name: "prepare",
  dependsOn: [], // 의존성 없음 → 즉시 실행
  execute: async (ctx) => {
    return { ready: true };
  },
  onFailure: "stop", // 실패 시 전체 중단
});

dag.addStage({
  name: "process",
  dependsOn: ["prepare"], // prepare 끝나야 실행
  execute: async (ctx) => {
    const prep = ctx.results.get("prepare"); // 이전 결과 접근
    return { processed: true };
  },
  onFailure: "skip", // 실패해도 계속 진행
});

dag.addStage({
  name: "cleanup",
  dependsOn: [], // 독립 → prepare와 동시 시작
  execute: async (ctx) => {
    return { cleaned: true };
  },
});

const result = await dag.execute("my-run-id");
// result.status: 'completed' | 'partial' | 'failed'
// result.stages: 각 스테이지 결과
// result.duration: 전체 소요 시간
```

---

## 자주 묻는 질문

### Q: 기존 명령어가 안 되지는 않나요?

**100% 호환됩니다.** 기존 명령어를 아무 옵션 없이 그대로 쓰면, 내부적으로 병렬화가 적용될 뿐 결과는 동일합니다. 만약 이전과 완전히 동일한 동작을 원하면 `--no-parallel-gates`를 추가하세요.

### Q: 병렬 실행하면 API 쿼터가 더 빨리 소진되나요?

**아닙니다.** API를 호출하는 건 factcheck(Gemini) 하나뿐이고, 나머지 게이트는 로컬 분석입니다. 병렬화해도 API 호출 횟수는 동일합니다.

### Q: 치유 루프가 무한 반복하지는 않나요?

**최대 1회만 시도합니다.** 1회 치유 후에도 기준 미달이면 사람이 직접 수정해야 합니다.

### Q: EventBus가 죽으면 파이프라인이 멈추나요?

**아닙니다.** EventBus는 부가 기능입니다. EventBus가 없거나 이벤트를 아무도 안 들어도 파이프라인은 정상 동작합니다. 이벤트는 로깅, 스케줄링, 모니터링을 위한 "추가 채널"입니다.

### Q: `--remediate`와 `--auto-fix`를 둘 다 켜면?

`--remediate`가 `--auto-fix`를 포함합니다. 둘 다 켜도 상관없지만, `--remediate`만 켜면 충분합니다.

### Q: DAG에서 순환 의존성을 설정하면?

실행 전에 **자동으로 감지하고 에러**를 발생시킵니다. "DAG에 순환 의존성이 있습니다"라는 메시지가 출력됩니다.

### Q: 어떤 게이트가 병렬로 실행되나요?

```
동시 실행 (Promise.allSettled):
├── factcheck        ← API 호출 (5초)
├── seo              ← 로컬 분석 (50ms)
├── content          ← 로컬 분석 (10ms)
├── readability      ← 로컬 분석 (8ms)
├── tone             ← 로컬 분석 (12ms)
├── structure        ← 로컬 분석 (15ms)
├── keyword_density  ← 로컬 분석 (10ms)
├── duplicate        ← 파일 스캔 (40ms)
└── image            ← 파일 스캔 (30ms)
```

9개 게이트가 모두 동시에 시작됩니다. factcheck가 5초 걸리는 동안 나머지 8개는 이미 끝납니다.

---

## 문제 해결

### "Circuit breaker is open - request blocked"

**원인**: factcheck API(Gemini)가 연속 3회 실패하여 서킷 브레이커가 열렸습니다.

**해결**:

1. `GEMINI_API_KEY` 환경변수 확인
2. 2분 기다리면 자동 리셋됨
3. 또는 API 키 없이 Claude 팩트체크 사용: `npm run factcheck:extract`

### "DAG에 순환 의존성이 있습니다"

**원인**: 커스텀 DAG에서 A→B, B→A 같은 순환이 있습니다.

**해결**: `dependsOn` 설정을 확인하여 순환을 제거하세요.

### 병렬 모드에서 결과가 다른 경우

**원인**: 게이트 간 상태 공유가 없어야 하는데, 같은 파일을 동시에 수정하는 경우 발생 가능.

**해결**: `--no-parallel-gates`로 순차 모드에서 결과를 확인하고, 재현되는지 비교하세요.

### 치유가 적용되었는데 점수가 안 올라간 경우

**원인**: 치유는 파일을 수정하지만, 점수 재계산은 하지 않습니다 (1회만 시도).

**해결**: 치유 후 다시 검증을 실행하세요:

```bash
npm run workflow full -f drafts/post.md --verbose
```

---

## 파일 구조 참조

```
src/workflow/
├── event-bus.ts        ← Layer 4: 이벤트 버스 (14개 이벤트 타입, 싱글턴)
├── dag-executor.ts     ← Layer 4: DAG 실행기 (위상 정렬, 병렬 배치)
├── quality-mesh.ts     ← Layer 3: 병렬 게이트 + 치유 루프
├── stages.ts           ← Layer 2/3: 통합 검증 (QualityMesh 연동)
├── pipeline.ts         ← Layer 2: 콘텐츠 파이프라인 (DAG 모드 지원)
└── scheduler.ts        ← Layer 4: 스케줄러 (EventBus 구독)

src/cli/commands/
├── pipeline.ts         ← CLI: --parallel, --no-parallel, --remediate
└── workflow.ts         ← CLI: --parallel-gates, --no-parallel-gates, --remediate
```

### 모듈 간 의존 관계

```
event-bus.ts          ← 의존성 없음 (독립)
quality-mesh.ts       ← event-bus, factcheck, gates, image-validator, draft-enhancer
dag-executor.ts       ← event-bus
stages.ts             ← quality-mesh, factcheck, gates, aeo, image-validator, draft-enhancer
pipeline.ts           ← dag-executor, event-bus, stages
scheduler.ts          ← event-bus, pipeline
```

---

_이 문서는 `src/workflow/` 아래 6개 파일의 동작을 설명합니다. 기존 명령어와 100% 호환되며, 새 옵션은 모두 선택사항입니다._
