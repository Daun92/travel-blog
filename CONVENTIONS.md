# CONVENTIONS.md - OpenClaw 코딩 컨벤션

## 에러 핸들링 패턴

### 1. Config 로드 (silent fallback)
설정 파일이 없으면 기본값 반환. 에러 로그 없음.
```typescript
async function loadConfig(): Promise<Config | null> {
  try {
    const data = await readFile(path, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null; // 파일 없으면 기본값
  }
}
```

### 2. API 호출 (warn + null return)
외부 API 실패 시 경고 출력 후 null 반환. 호출자가 null 처리.
```typescript
async function callApi(): Promise<Result | null> {
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      console.log(`⚠️ API 실패: ${response.statusText}`);
      return null;
    }
    return await response.json() as Result;
  } catch (error) {
    console.log(`⚠️ API 오류: ${error}`);
    return null;
  }
}
```

### 3. 파이프라인 스테이지 (Result object)
각 스테이지는 success/error를 포함하는 결과 객체 반환.
```typescript
interface StageResult {
  success: boolean;
  data?: unknown;
  error?: string;
  skipped?: boolean;
}
```

### 4. CLI 최상위 (catch + process.exit)
CLI 진입점에서만 process.exit 사용. 내부 모듈은 throw로 전파.
```typescript
try {
  await runCommand();
} catch (error) {
  console.error(`❌ ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}
```

## Import 규칙

- **Barrel import**: 모듈 디렉토리는 `index.ts`에서 re-export
- **.js 확장자 필수**: ESM 호환을 위해 `from './module.js'` 형태
- **순서**: Node.js 내장 → 외부 패키지 → 프로젝트 내부

## 데이터 파일 규칙

- **Line ending**: LF (`.gitattributes`로 강제)
- **경로**: 항상 forward slash (`/`), `normalizePath()` 사용
- **절대경로 금지**: 데이터 파일 내 경로는 프로젝트 루트 기준 상대경로
- **JSON 포맷**: 2-space indent, trailing newline

## 타입 규칙

- **정의 위치**: 모듈별 `types.ts`에 정의
- **Barrel export**: `index.ts`에서 `export type { ... } from './types.js'`
- **접미사 컨벤션**:
  - `*Report`: 분석/검증 결과 (예: `FactCheckReport`, `AutoFixReport`)
  - `*Result`: 함수 반환값 (예: `DiscoveryResult`, `StageResult`)
  - `*Config`: 설정 (예: `FactCheckConfig`, `ShareQueueConfig`)
  - `*State`: 런타임 상태 (예: `ShareQueueState`)

## 네이밍

- **파일명**: `kebab-case.ts` (예: `share-queue.ts`, `auto-fixer.ts`)
- **인터페이스**: `PascalCase` (예: `ShareQueueItem`)
- **함수**: `camelCase` (예: `normalizePath`, `calculatePriority`)
- **상수**: `UPPER_SNAKE_CASE` (예: `DEFAULT_CONFIG`, `MOLTBOOK_API`)

## 검증 시스템 아키텍처

- **`src/workflow/stages.ts`**: 전체 파이프라인 오케스트레이터. `FullValidationResult`는 factcheck + quality + AEO 등 모든 스테이지를 통합한 최종 결과.
- **`src/quality/gates.ts`**: 단일 품질 게이트. `ValidationResult`는 SEO/가독성/구조 등 개별 검증 결과.
- 관계: stages.ts가 gates.ts를 호출하여 통합. stages = 오케스트레이터, gates = 단일 게이트.
