# OpenClaw 주간 서베이 수집 스크립트
# 일요일 10:00에 Task Scheduler에서 호출됨
# 서베이 발행 → 수집 → 인사이트 적재 → 전략 갱신

$ErrorActionPreference = "Continue"
$ProjectDir = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$LogDir = Join-Path $ProjectDir "logs"
$LogFile = Join-Path $LogDir "survey-$(Get-Date -Format 'yyyy-MM-dd').log"

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

Write-Log "=== 주간 서베이 수집 시작 ==="

Set-Location $ProjectDir

# 1. 서베이 발행
Write-Log "서베이 발행 중..."
try {
    & npx tsx src/cli/index.ts moltbook culture-survey 2>&1 | ForEach-Object { Write-Log $_ }
} catch {
    Write-Log "WARNING: 서베이 발행 실패 - $_"
}

# 2. 응답 수집 (스케줄러 사용)
Write-Log "응답 수집 시작 (최대 3시간)..."
try {
    & npx tsx scripts/moltbook-scheduler.mts 2>&1 | ForEach-Object { Write-Log $_ }
} catch {
    Write-Log "WARNING: 응답 수집 실패 - $_"
}

# 3. 인사이트 DB 적재
Write-Log "인사이트 적재 중..."
try {
    & npx tsx src/cli/index.ts survey ingest 2>&1 | ForEach-Object { Write-Log $_ }
} catch {
    Write-Log "WARNING: 인사이트 적재 실패 - $_"
}

# 4. 전략 갱신
Write-Log "전략 갱신 중..."
try {
    & npx tsx src/cli/index.ts survey apply-strategy 2>&1 | ForEach-Object { Write-Log $_ }
} catch {
    Write-Log "WARNING: 전략 갱신 실패 - $_"
}

Write-Log "=== 주간 서베이 수집 완료 ==="
