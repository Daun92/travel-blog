# OpenClaw 성과 모니터링 스크립트
# 매일 23:00에 Task Scheduler에서 호출됨

$ErrorActionPreference = "Continue"
$ProjectDir = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$LogDir = Join-Path $ProjectDir "logs"
$LogFile = Join-Path $LogDir "monitor-$(Get-Date -Format 'yyyy-MM-dd').log"

if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}

function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path $LogFile -Value "[$timestamp] $Message"
    Write-Host $logEntry
}

Write-Log "=== 성과 모니터링 시작 ==="

Set-Location $ProjectDir

# 대시보드 업데이트
try {
    & npx tsx src/cli/index.ts monitor dashboard --update 2>&1 | ForEach-Object { Write-Log $_ }
    Write-Log "대시보드 업데이트 완료"
} catch {
    Write-Log "WARNING: 대시보드 업데이트 실패 - $_"
}

# 성과 리포트
try {
    & npx tsx src/cli/index.ts monitor performance 2>&1 | ForEach-Object { Write-Log $_ }
    Write-Log "성과 리포트 완료"
} catch {
    Write-Log "WARNING: 성과 리포트 실패 - $_"
}

# 콘텐츠 신선도 체크
try {
    & npx tsx src/cli/index.ts monitor freshness 2>&1 | ForEach-Object { Write-Log $_ }
    Write-Log "신선도 체크 완료"
} catch {
    Write-Log "WARNING: 신선도 체크 실패 - $_"
}

Write-Log "=== 성과 모니터링 완료 ==="
