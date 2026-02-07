# OpenClaw Moltbook 단일 공유 사이클 (once 모드)
# Task Scheduler에서 30분 간격으로 호출됨

$ErrorActionPreference = "Continue"
$ProjectDir = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$LogDir = Join-Path $ProjectDir "logs"
$LogFile = Join-Path $LogDir "moltbook-share-$(Get-Date -Format 'yyyy-MM-dd').log"

if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}

function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path $LogFile -Value "[$timestamp] $Message"
}

Write-Log "Moltbook 공유 사이클 시작"

Set-Location $ProjectDir

try {
    $output = & npx tsx scripts/moltbook-auto-share.mts once 2>&1
    $output | ForEach-Object { Write-Log $_ }

    if ($LASTEXITCODE -eq 0) {
        Write-Log "공유 사이클 완료"
    } else {
        Write-Log "WARNING: 종료 코드 $LASTEXITCODE"
    }
} catch {
    Write-Log "ERROR: $_"
}
