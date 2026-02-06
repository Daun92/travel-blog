# OpenClaw 백그라운드 실행 가이드

Claude Code 세션 종료 후에도 OpenClaw가 계속 실행되도록 설정하는 방법입니다.

---

## 🚀 가장 간단한 방법: 배치 파일

### 1. Moltbook 스케줄러 시작

**파일**: `start-moltbook.bat`

```bash
# 더블클릭으로 실행
start-moltbook.bat
```

**작동 방식**:
- 백그라운드에서 Moltbook 순환 스케줄러 실행
- 30분마다 자동으로 포스트 공유
- 로그는 `logs/moltbook.log`에 저장

**중지**:
```bash
# 작업 관리자에서 "npx.exe" 프로세스 종료
# 또는
taskkill /F /IM npx.exe
```

---

## 📅 Windows 작업 스케줄러 (추천)

컴퓨터 시작 시 자동 실행하려면:

### 1. 작업 스케줄러 열기
- Windows 검색 → "작업 스케줄러" 실행

### 2. 새 작업 만들기
- **이름**: OpenClaw Moltbook Scheduler
- **설명**: 블로그 자동 공유 스케줄러

### 3. 트리거 설정
- **트리거**: 컴퓨터 시작 시
- **지연 시간**: 1분

### 4. 동작 설정
- **프로그램**: `C:\Program Files\nodejs\npx.cmd`
- **인수**: `tsx scripts/moltbook-scheduler.mts`
- **시작 위치**: `C:\Users\blue5\claude\openclaw`

### 5. 조건 설정
- ✅ 컴퓨터의 전원이 AC 어댑터에 연결된 경우에만 작업 시작 (해제)
- ✅ 작업 실행을 위해 컴퓨터를 절전 모드에서 해제

### 6. 설정
- ✅ 요청 시 작업 실행 허용
- ✅ 작업이 실패한 경우 다시 시작 간격: 1분
- ✅ 다시 시작 시도: 3번

---

## 🔧 PM2 방식 (고급)

### 문제점
Windows 환경에서 tsx 실행 경로 문제로 인해 현재 PM2 설정이 작동하지 않습니다.

### 해결 방법 (향후)
1. tsx를 글로벌 설치
2. 전체 경로 지정
3. 또는 간단한 JavaScript 래퍼 사용

---

## 📊 실행 상태 확인

### 로그 확인
```bash
# 실시간 로그
tail -f logs/moltbook.log

# 또는 PowerShell
Get-Content logs\moltbook.log -Wait
```

### 프로세스 확인
```bash
# 작업 관리자에서 확인
tasklist | findstr npx
```

---

## 🛑 중지 방법

### 배치 파일 실행 중지
```bash
taskkill /F /IM npx.exe
```

### 작업 스케줄러에서 중지
작업 스케줄러 → OpenClaw Moltbook Scheduler → 사용 안 함 또는 삭제

---

## 💡 권장 설정

### 일일 워크플로우

**1. Moltbook 자동 공유**
- 백그라운드 실행: `start-moltbook.bat`
- 30분마다 자동 공유
- 피드백 자동 수집

**2. 일일 포스트 생성**
- 매일 오전 9시 자동 실행 (작업 스케줄러)
- 프로그램: `C:\Program Files\nodejs\npm.cmd`
- 인수: `run daily:run`
- 시작 위치: `C:\Users\blue5\claude\openclaw`

---

## 📋 체크리스트

실행 전 확인사항:

- [x] PM2 설치됨
- [x] Node.js 설치됨
- [x] .env 파일 설정됨
- [x] Moltbook 계정 클레임 완료
- [ ] Windows 작업 스케줄러 설정 완료 (선택)
- [ ] 백그라운드 실행 테스트 완료

---

## 🔍 문제 해결

### 프로세스가 계속 중지됨
- 로그 확인: `logs/moltbook-error.log`
- 환경변수 확인: `.env` 파일 존재 여부
- Node.js 버전 확인: `node --version` (v18 이상 권장)

### 로그가 생성되지 않음
- `logs/` 폴더 생성: `mkdir logs`
- 권한 확인: 쓰기 권한 있는지 확인

### 작업 스케줄러가 실행 안 됨
- 경로 확인: npx.cmd 전체 경로 사용
- 로그 확인: 작업 속성 → 기록 탭
- 수동 실행 테스트: 작업 마우스 우클릭 → 실행

---

## 📞 도움말

더 자세한 내용은 `docs/MOLTBOOK_WORKFLOW.md` 참조
