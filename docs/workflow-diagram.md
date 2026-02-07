# OpenClaw 워크플로우 다이어그램

OpenClaw 콘텐츠 자동화 시스템의 전체 워크플로우를 시각화한 문서입니다.

---

## 1. 전체 콘텐츠 라이프사이클

3개 Phase가 순환하는 완전한 콘텐츠 루프입니다.

```mermaid
graph TB
    subgraph PhaseA["Phase A: 주제 발굴 (주 1회)"]
        A1[Moltbook 서베이 발행] --> A2[응답 수집<br/>30분 x 6사이클]
        A2 --> A3[인사이트 DB 적재]
        A3 --> A4[content-strategy.json<br/>자동 갱신]
        A4 --> A5[주제 큐 편성<br/>서베이 부스트 반영]
    end

    subgraph PhaseB["Phase B: 콘텐츠 생산 (매 포스트)"]
        B1[에이전트 배정 + 생성] --> B2[페르소나 기반 향상]
        B2 --> B3[팩트체크<br/>70% 이상 필수]
        B3 --> B4[품질 검증]
        B4 --> B5[AEO 적용<br/>FAQ + Schema]
        B5 --> B6[이미지 검증]
    end

    subgraph PhaseC["Phase C: 발행 + 피드백 (매 포스트)"]
        C1[Hugo 블로그 발행] --> C2[Moltbook 공유]
        C2 --> C3[피드백 수집]
        C3 --> C4[전략 자동 조정]
    end

    A5 --> B1
    B6 --> C1
    C4 -->|순환| A1

    style PhaseA fill:#e8f5e9,stroke:#388e3c
    style PhaseB fill:#e3f2fd,stroke:#1976d2
    style PhaseC fill:#fff3e0,stroke:#f57c00
```

---

## 2. 에이전트 페르소나 배정 흐름

주제 입력 시 키워드 매칭으로 에이전트가 자동 결정됩니다.

```mermaid
flowchart TD
    Start([npm run new -t 주제]) --> Flag{--agent 플래그?}
    Flag -->|있음| Manual[수동 지정된 에이전트 사용]
    Flag -->|없음| Parse[주제 + 키워드 파싱]

    Parse --> Score[키워드 매칭 점수 계산]
    Score --> V{viral 점수}
    Score --> I{informative 점수}
    Score --> F{friendly 점수}

    V -->|TOP, 순위, 비교, vs<br/>핫플, 트렌드, SNS| VW[조회영 점수 합산]
    I -->|역사, 건축, 미술사<br/>해설, 교양, 유네스코| IW[한교양 점수 합산]
    F -->|주말, 1박2일, 가성비<br/>퇴근, 후기, 웨이팅| FW[김주말 점수 합산]

    VW --> Best{최고 점수?}
    IW --> Best
    FW --> Best

    Best -->|viral 최고| Viral["조회영 (viral)<br/>바이럴/공유 유도"]
    Best -->|informative 최고| Info["한교양 (informative)<br/>교양/해설"]
    Best -->|friendly 최고| Friend["김주말 (friendly)<br/>솔직 체험"]
    Best -->|모두 0점| Default["김주말 (기본값)"]

    Manual --> Gen[콘텐츠 생성]
    Viral --> Gen
    Info --> Gen
    Friend --> Gen
    Default --> Gen

    Gen --> FM[frontmatter 작성<br/>author + personaId]

    style Viral fill:#ffcdd2,stroke:#c62828
    style Info fill:#c8e6c9,stroke:#2e7d32
    style Friend fill:#bbdefb,stroke:#1565c0
    style Default fill:#bbdefb,stroke:#1565c0
```

---

## 3. 3인 에이전트 페르소나 비교

같은 주제도 에이전트에 따라 완전히 다른 콘텐츠가 됩니다.

```mermaid
graph LR
    Topic([제주도 카페]) --> V["조회영<br/><i>제주 카페 TOP 10<br/>인스타 vs 현실</i>"]
    Topic --> F["김주말<br/><i>퇴근 후 비행기 타고 간<br/>제주 카페 실제 비용</i>"]
    Topic --> I["한교양<br/><i>제주 카페 건축 이야기<br/>알면 3배 재미</i>"]

    V --- VStyle["해요체+반말 혼용<br/>도발적, 순위/비교"]
    F --- FStyle["해요체<br/>솔직, 현실적, 투덜"]
    I --- IStyle["합니다체<br/>차분, 지적, 해설사"]

    style V fill:#ffcdd2,stroke:#c62828
    style F fill:#bbdefb,stroke:#1565c0
    style I fill:#c8e6c9,stroke:#2e7d32
    style VStyle fill:#ffebee,stroke:#ef9a9a
    style FStyle fill:#e3f2fd,stroke:#90caf9
    style IStyle fill:#e8f5e9,stroke:#a5d6a7
```

---

## 4. 서베이 → 주제 발굴 파이프라인

커뮤니티 수요를 데이터로 전환하는 과정입니다.

```mermaid
flowchart LR
    subgraph Survey["서베이 수집"]
        S1[Moltbook에<br/>서베이 게시] --> S2[커뮤니티<br/>응답 수집]
        S2 --> S3[댓글 파싱<br/>주제/포맷/지역]
    end

    subgraph Insights["인사이트 분석"]
        S3 --> I1[가중 투표 집계<br/>upvote x 0.5]
        I1 --> I2[survey-insights-db<br/>누적 저장]
        I2 --> I3[부스트 점수 계산<br/>0~30점]
    end

    subgraph Strategy["전략 반영"]
        I3 --> T1[content-strategy.json<br/>자동 갱신]
        T1 --> T2[주제 큐 편성]
        T2 --> T3["고점수 주제 우선<br/>[서베이] 태그"]
    end

    T3 --> Gen([콘텐츠 생성<br/>Phase B])

    style Survey fill:#f3e5f5,stroke:#7b1fa2
    style Insights fill:#e8eaf6,stroke:#283593
    style Strategy fill:#e0f7fa,stroke:#00695c
```

---

## 5. 콘텐츠 생산 파이프라인 (Phase B 상세)

매 포스트마다 거치는 7단계 품질 보증 프로세스입니다.

```mermaid
flowchart TD
    Q([주제 큐에서 선택]) --> Agent[Step 1: 에이전트 배정]

    Agent --> PersonaDB[(config/personas/)]
    PersonaDB -->|자동 or 수동| Selected["에이전트 확정<br/>조회영 | 김주말 | 한교양"]

    Selected --> Gemini[Gemini API<br/>콘텐츠 생성]
    Gemini --> Draft[drafts/ 저장<br/>author + personaId]

    Draft --> Enhance[Step 2: Enhance<br/>클리셰 제거 + 디테일 강화]
    Enhance --> Fact{Step 3: Factcheck<br/>70% 이상?}

    Fact -->|Yes| Quality[Step 4: Quality<br/>SEO + 가독성 + 구조]
    Fact -->|No| Review[수동 검토 필요]
    Review -->|수정 후| Fact

    Quality --> AEO[Step 5: AEO<br/>FAQ 5개 + Schema.org]
    AEO --> Image[Step 6: Image<br/>경로 검증<br/>/travel-blog/ prefix]
    Image --> FM[Step 7: Frontmatter 확인<br/>author, personaId]

    FM --> Publish([Phase C: 발행])

    style Agent fill:#e3f2fd,stroke:#1976d2
    style Enhance fill:#e8f5e9,stroke:#388e3c
    style Fact fill:#fff3e0,stroke:#f57c00
    style AEO fill:#f3e5f5,stroke:#7b1fa2
```

---

## 6. 발행 + 피드백 루프 (Phase C 상세)

발행 후 커뮤니티 피드백이 다음 콘텐츠 전략에 자동 반영됩니다.

```mermaid
flowchart LR
    Draft([검증 완료 드래프트]) --> Publish[Hugo 블로그<br/>발행]
    Publish --> Share[Moltbook<br/>커뮤니티 공유]
    Share --> Collect[피드백 수집<br/>댓글, 투표, 감성]
    Collect --> Analyze[피드백 분석<br/>인기 주제, 개선점]
    Analyze --> Update[content-strategy.json<br/>자동 갱신]
    Update --> Next([Phase A: 다음<br/>주제 발굴에 반영])

    style Publish fill:#e8f5e9,stroke:#388e3c
    style Share fill:#fff3e0,stroke:#f57c00
    style Analyze fill:#e3f2fd,stroke:#1976d2
    style Update fill:#f3e5f5,stroke:#7b1fa2
```

---

## 7. 시스템 아키텍처 전체도

주요 모듈과 데이터 흐름을 한눈에 보여줍니다.

```mermaid
graph TB
    subgraph External["외부 서비스"]
        Gemini[Gemini API<br/>텍스트 + 이미지]
        Unsplash[Unsplash API<br/>커버 이미지]
        KTO[한국관광공사 API]
        Culture[문화포털 API]
        Moltbook[Moltbook<br/>커뮤니티]
    end

    subgraph Config["설정"]
        Personas[(config/personas/<br/>viral, friendly,<br/>informative)]
        Strategy[(content-strategy.json)]
        SurveyDB[(survey-insights-db.json)]
    end

    subgraph Core["핵심 모듈 (src/)"]
        Collector[agents/collector.ts<br/>데이터 수집]
        Generator[generator/<br/>콘텐츠 생성]
        Enhancer[draft-enhancer/<br/>페르소나 향상]
        Factcheck[factcheck/<br/>사실 검증]
        Quality[quality/<br/>품질 검증]
        AEO[aeo/<br/>FAQ + Schema]
        Survey[agents/moltbook/<br/>서베이 + 피드백]
        CLI[cli/<br/>Commander.js]
    end

    subgraph Output["출력"]
        Drafts[(drafts/)]
        Blog[(blog/<br/>Hugo 사이트)]
    end

    KTO --> Collector
    Culture --> Collector
    Collector --> Generator
    Gemini --> Generator
    Personas --> Generator
    Unsplash --> Generator

    Generator --> Drafts
    Drafts --> Enhancer
    Personas --> Enhancer
    Enhancer --> Factcheck
    Factcheck --> Quality
    Quality --> AEO
    AEO --> Blog

    Blog --> Moltbook
    Moltbook --> Survey
    Survey --> SurveyDB
    SurveyDB --> Strategy
    Strategy --> Generator

    CLI --> Generator
    CLI --> Enhancer
    CLI --> Factcheck
    CLI --> Survey

    style External fill:#fce4ec,stroke:#c62828
    style Config fill:#fff8e1,stroke:#f9a825
    style Core fill:#e3f2fd,stroke:#1565c0
    style Output fill:#e8f5e9,stroke:#2e7d32
```

---

## 8. 데이터 저장소 맵

각 단계에서 읽고 쓰는 파일의 관계입니다.

```mermaid
flowchart TD
    subgraph Write["쓰기"]
        direction TB
        W1["npm run new → drafts/*.md"]
        W2["npm run enhance → drafts/*.md (덮어쓰기)"]
        W3["npm run aeo --apply → drafts/*.md (FAQ 추가)"]
        W4["npm run publish → blog/content/posts/"]
        W5["survey ingest → data/survey-insights-db.json"]
        W6["survey apply-strategy → config/content-strategy.json"]
        W7["moltbook:analyze → config/content-strategy.json"]
    end

    subgraph Read["읽기"]
        direction TB
        R1["generator/index.ts ← config/personas/index.json"]
        R2["generator/prompts.ts ← config/personas/{id}.json"]
        R3["draft-enhancer/ ← config/personas/{id}.json"]
        R4["topic-discovery.ts ← data/survey-insights-db.json"]
        R5["queue discover ← config/content-strategy.json"]
    end

    style Write fill:#ffebee,stroke:#c62828
    style Read fill:#e8f5e9,stroke:#2e7d32
```

---

## 9. CLI 명령어 맵

주요 명령어가 어떤 Phase에 속하는지 보여줍니다.

```mermaid
graph TD
    subgraph A["Phase A 명령어"]
        A1["moltbook:culture-survey"]
        A2["moltbook:survey-scheduler"]
        A3["survey ingest"]
        A4["survey status"]
        A5["survey boost"]
        A6["survey apply-strategy"]
        A7["queue discover --auto"]
    end

    subgraph B["Phase B 명령어"]
        B1["new -t 주제 --type --agent"]
        B2["enhance -f file"]
        B3["factcheck -f file"]
        B4["validate -f file"]
        B5["aeo -f file --apply"]
    end

    subgraph C["Phase C 명령어"]
        C1["publish"]
        C2["moltbook:share"]
        C3["moltbook:feedback"]
        C4["moltbook:analyze"]
    end

    A7 --> B1
    B5 --> C1
    C4 -->|순환| A1

    style A fill:#e8f5e9,stroke:#388e3c
    style B fill:#e3f2fd,stroke:#1976d2
    style C fill:#fff3e0,stroke:#f57c00
```

---

## 10. 워크플로우 체크리스트 (실행 순서)

```mermaid
flowchart TD
    subgraph PA["Phase A: 주제 발굴 — 주 1회"]
        P0_1["0-1. moltbook:culture-survey"] --> P0_2["0-2. moltbook:survey-scheduler"]
        P0_2 --> P0_3["0-3. survey ingest"]
        P0_3 --> P0_4["0-4. survey apply-strategy"]
        P0_4 --> P0_5["0-5. queue discover --auto --gaps"]
    end

    subgraph PB["Phase B: 콘텐츠 생산 — 매 포스트"]
        P1["1. new (에이전트 배정)"] --> P2["2. enhance (페르소나 향상)"]
        P2 --> P3["3. factcheck (70%+)"]
        P3 --> P4["4. validate (품질)"]
        P4 --> P5["5. aeo --apply (FAQ)"]
        P5 --> P6["6. 이미지 경로 확인"]
        P6 --> P7["7. frontmatter 확인"]
    end

    subgraph PC["Phase C: 발행 + 피드백 — 매 포스트"]
        P8["8. publish"] --> P9["9. moltbook:share"]
        P9 --> P10["10. moltbook:feedback"]
        P10 --> P11["11. moltbook:analyze"]
    end

    P0_5 --> P1
    P7 --> P8
    P11 -->|"다음 사이클"| P0_1

    style PA fill:#e8f5e9,stroke:#388e3c
    style PB fill:#e3f2fd,stroke:#1976d2
    style PC fill:#fff3e0,stroke:#f57c00
```
