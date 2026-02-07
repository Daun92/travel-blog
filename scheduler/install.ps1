# OpenClaw Task Scheduler 설치 스크립트
# 사용: .\scheduler\install.ps1 [-Force] [-NoPM2]

param(
    [switch]$Force,    # 기존 태스크 강제 덮어쓰기
    [switch]$NoPM2     # PM2 프로세스 중단
)

$ErrorActionPreference = "Stop"
$ProjectDir = Split-Path -Parent $PSScriptRoot
$TasksDir = Join-Path $PSScriptRoot "tasks"
$TaskPath = "\OpenClaw\"

Write-Host "`n=== OpenClaw Task Scheduler 설치 ===" -ForegroundColor Cyan

# 관리자 권한 확인
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "WARNING: 관리자 권한 없이 실행 중. 일부 옵션이 제한될 수 있습니다." -ForegroundColor Yellow
}

# XML 파일 목록
$taskFiles = Get-ChildItem -Path $TasksDir -Filter "*.xml"

if ($taskFiles.Count -eq 0) {
    Write-Host "ERROR: $TasksDir 에 XML 파일이 없습니다." -ForegroundColor Red
    exit 1
}

Write-Host "프로젝트 디렉토리: $ProjectDir"
Write-Host "등록할 태스크: $($taskFiles.Count)개`n"

$registered = 0
$failed = 0

foreach ($xmlFile in $taskFiles) {
    $taskName = $xmlFile.BaseName
    $fullTaskName = "$TaskPath$taskName"

    Write-Host "  [$taskName]" -NoNewline

    # XML 읽기 및 플레이스홀더 치환
    $xmlContent = Get-Content $xmlFile.FullName -Raw
    $xmlContent = $xmlContent.Replace('%PROJECT_DIR%', $ProjectDir)

    # 임시 파일에 저장
    $tempXml = Join-Path $env:TEMP "$taskName.xml"
    Set-Content -Path $tempXml -Value $xmlContent -Encoding Unicode

    try {
        # 기존 태스크 확인
        $existing = Get-ScheduledTask -TaskName $taskName -TaskPath $TaskPath -ErrorAction SilentlyContinue

        if ($existing -and -not $Force) {
            Write-Host " - 이미 존재 (스킵, -Force로 덮어쓰기)" -ForegroundColor Yellow
            continue
        }

        if ($existing -and $Force) {
            Unregister-ScheduledTask -TaskName $taskName -TaskPath $TaskPath -Confirm:$false
        }

        # 태스크 등록
        Register-ScheduledTask -TaskName $taskName -TaskPath $TaskPath -Xml (Get-Content $tempXml -Raw) | Out-Null

        Write-Host " - 등록 완료" -ForegroundColor Green
        $registered++
    } catch {
        Write-Host " - 실패: $_" -ForegroundColor Red
        $failed++
    } finally {
        # 임시 파일 삭제
        Remove-Item $tempXml -ErrorAction SilentlyContinue
    }
}

Write-Host "`n결과: $registered 등록, $failed 실패" -ForegroundColor $(if ($failed -gt 0) { "Yellow" } else { "Green" })

# PM2 중단 옵션
if ($NoPM2) {
    Write-Host "`nPM2 프로세스 중단 중..." -ForegroundColor Yellow

    try {
        $pm2Exists = Get-Command pm2 -ErrorAction SilentlyContinue
        if ($pm2Exists) {
            & pm2 delete openclaw-auto-share 2>$null
            & pm2 delete openclaw-scheduler 2>$null
            & pm2 save --force 2>$null
            Write-Host "PM2 프로세스 중단 완료" -ForegroundColor Green
        } else {
            Write-Host "PM2가 설치되지 않음 (스킵)" -ForegroundColor Gray
        }
    } catch {
        Write-Host "PM2 중단 실패: $_" -ForegroundColor Yellow
    }
}

# 로그 디렉토리 생성
$logDir = Join-Path $ProjectDir "logs"
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
    Write-Host "`nlogs/ 디렉토리 생성됨" -ForegroundColor Gray
}

Write-Host "`n상태 확인: .\scheduler\status.ps1" -ForegroundColor Cyan
Write-Host "제거: .\scheduler\uninstall.ps1`n" -ForegroundColor Cyan
