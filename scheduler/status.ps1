# OpenClaw Task Scheduler 상태 대시보드

$ErrorActionPreference = "Continue"
$TaskPath = "\OpenClaw\"
$ProjectDir = Split-Path -Parent $PSScriptRoot

Write-Host "`n=== OpenClaw 스케줄러 상태 ===" -ForegroundColor Cyan
Write-Host "프로젝트: $ProjectDir`n"

# 등록된 태스크 목록
$tasks = Get-ScheduledTask -TaskPath $TaskPath -ErrorAction SilentlyContinue

if (-not $tasks -or $tasks.Count -eq 0) {
    Write-Host "등록된 태스크 없음" -ForegroundColor Yellow
    Write-Host "설치: .\scheduler\install.ps1`n"
    exit 0
}

Write-Host "등록된 태스크: $($tasks.Count)개`n"

foreach ($task in $tasks) {
    $info = Get-ScheduledTaskInfo -TaskName $task.TaskName -TaskPath $TaskPath -ErrorAction SilentlyContinue
    $stateColor = switch ($task.State) {
        "Ready"    { "Green" }
        "Running"  { "Cyan" }
        "Disabled" { "Yellow" }
        default    { "Gray" }
    }

    Write-Host "  $($task.TaskName)" -ForegroundColor White -NoNewline
    Write-Host " [$($task.State)]" -ForegroundColor $stateColor

    if ($info) {
        if ($info.LastRunTime -and $info.LastRunTime.Year -gt 2000) {
            $ago = [math]::Round(((Get-Date) - $info.LastRunTime).TotalHours, 1)
            Write-Host "    마지막 실행: $($info.LastRunTime.ToString('MM-dd HH:mm')) (${ago}시간 전)" -ForegroundColor Gray

            $resultColor = if ($info.LastTaskResult -eq 0) { "Green" } else { "Yellow" }
            Write-Host "    결과: $($info.LastTaskResult)" -ForegroundColor $resultColor
        } else {
            Write-Host "    아직 실행되지 않음" -ForegroundColor Gray
        }

        if ($info.NextRunTime -and $info.NextRunTime.Year -gt 2000) {
            Write-Host "    다음 실행: $($info.NextRunTime.ToString('MM-dd HH:mm'))" -ForegroundColor Gray
        }
    }
    Write-Host ""
}

# 최근 로그 확인
$logDir = Join-Path $ProjectDir "logs"
if (Test-Path $logDir) {
    $recentLogs = Get-ChildItem -Path $logDir -Filter "*.log" -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending | Select-Object -First 5

    if ($recentLogs.Count -gt 0) {
        Write-Host "최근 로그:" -ForegroundColor Cyan
        foreach ($log in $recentLogs) {
            $ago = [math]::Round(((Get-Date) - $log.LastWriteTime).TotalHours, 1)
            Write-Host "  $($log.Name) (${ago}시간 전, $([math]::Round($log.Length / 1KB, 1))KB)" -ForegroundColor Gray
        }
    }
}

# 헬스 알림 확인
$alertLog = Join-Path $logDir "health-alerts.log"
if (Test-Path $alertLog) {
    $lastAlerts = Get-Content $alertLog -Tail 3 -ErrorAction SilentlyContinue
    if ($lastAlerts) {
        Write-Host "`n최근 헬스체크:" -ForegroundColor Cyan
        $lastAlerts | ForEach-Object {
            $color = if ($_ -match "OK") { "Green" } elseif ($_ -match "CRITICAL") { "Red" } else { "Yellow" }
            Write-Host "  $_" -ForegroundColor $color
        }
    }
}

Write-Host ""
