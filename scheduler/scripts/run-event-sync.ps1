# OpenClaw 이벤트 캘린더 동기화 스크립트
# Task Scheduler에서 주 1회 (월요일 09:00) 호출됨
# 현재 월 + 다음 월 이벤트를 수집

$ErrorActionPreference = "Continue"
$ProjectDir = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$LogDir = Join-Path $ProjectDir "logs"
$LogFile = Join-Path $LogDir "event-sync-$(Get-Date -Format 'yyyy-MM-dd').log"

# 로그 디렉토리 생성
if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}

function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry = "[$timestamp] $Message"
    Add-Content -Path $LogFile -Value $logEntry
    Write-Host $logEntry
}

Write-Log "=== OpenClaw 이벤트 캘린더 동기화 시작 ==="

# Node.js 확인
$nodeVersion = & node --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Log "ERROR: Node.js를 찾을 수 없습니다"
    exit 1
}
Write-Log "Node.js: $nodeVersion"

# 프로젝트 디렉토리로 이동
Set-Location $ProjectDir

# .env 확인
if (-not (Test-Path ".env")) {
    Write-Log "WARNING: .env 파일이 없습니다"
}

# 현재 월 이벤트 동기화
$currentMonth = (Get-Date).Month
$currentYear = (Get-Date).Year
Write-Log "현재 월 동기화: ${currentYear}년 ${currentMonth}월"

try {
    $output = & npx tsx src/cli/index.ts events sync --month $currentMonth --year $currentYear 2>&1
    $output | ForEach-Object { Write-Log $_ }

    if ($LASTEXITCODE -eq 0) {
        Write-Log "SUCCESS: 현재 월 동기화 완료"
    } else {
        Write-Log "WARNING: 현재 월 동기화 종료 코드 $LASTEXITCODE"
    }
} catch {
    Write-Log "ERROR: 현재 월 동기화 실패 - $_"
}

# 다음 월 이벤트 동기화
$nextMonth = if ($currentMonth -eq 12) { 1 } else { $currentMonth + 1 }
$nextYear = if ($currentMonth -eq 12) { $currentYear + 1 } else { $currentYear }
Write-Log "다음 월 동기화: ${nextYear}년 ${nextMonth}월"

try {
    $output = & npx tsx src/cli/index.ts events sync --month $nextMonth --year $nextYear 2>&1
    $output | ForEach-Object { Write-Log $_ }

    if ($LASTEXITCODE -eq 0) {
        Write-Log "SUCCESS: 다음 월 동기화 완료"
    } else {
        Write-Log "WARNING: 다음 월 동기화 종료 코드 $LASTEXITCODE"
    }
} catch {
    Write-Log "ERROR: 다음 월 동기화 실패 - $_"
}

Write-Log "=== 이벤트 캘린더 동기화 완료 ==="
