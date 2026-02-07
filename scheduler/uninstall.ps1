# OpenClaw Task Scheduler 제거 스크립트

$ErrorActionPreference = "Continue"
$TaskPath = "\OpenClaw\"

Write-Host "`n=== OpenClaw Task Scheduler 제거 ===" -ForegroundColor Cyan

$tasks = Get-ScheduledTask -TaskPath $TaskPath -ErrorAction SilentlyContinue

if (-not $tasks -or $tasks.Count -eq 0) {
    Write-Host "등록된 OpenClaw 태스크가 없습니다.`n" -ForegroundColor Yellow
    exit 0
}

Write-Host "제거할 태스크: $($tasks.Count)개`n"

$removed = 0

foreach ($task in $tasks) {
    Write-Host "  [$($task.TaskName)]" -NoNewline

    try {
        Unregister-ScheduledTask -TaskName $task.TaskName -TaskPath $TaskPath -Confirm:$false
        Write-Host " - 제거됨" -ForegroundColor Green
        $removed++
    } catch {
        Write-Host " - 실패: $_" -ForegroundColor Red
    }
}

Write-Host "`n$removed 개 태스크 제거 완료`n" -ForegroundColor Green
