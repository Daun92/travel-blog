# OpenClaw 일일 포스트 생성 스크립트
# Task Scheduler에서 호출됨

$ErrorActionPreference = "Continue"
$ProjectDir = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$LogDir = Join-Path $ProjectDir "logs"
$LogFile = Join-Path $LogDir "daily-posts-$(Get-Date -Format 'yyyy-MM-dd').log"

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

Write-Log "=== OpenClaw 일일 포스트 생성 시작 ==="

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

# 파이프라인 실행
Write-Log "파이프라인 실행 중..."
try {
    $output = & npx tsx src/cli/index.ts pipeline --schedule 2>&1
    $output | ForEach-Object { Write-Log $_ }

    if ($LASTEXITCODE -eq 0) {
        Write-Log "SUCCESS: 파이프라인 완료"
    } else {
        Write-Log "WARNING: 파이프라인 종료 코드 $LASTEXITCODE"
    }
} catch {
    Write-Log "ERROR: $_"
}

Write-Log "=== 일일 포스트 생성 완료 ==="
