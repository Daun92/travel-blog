# OpenClaw 헬스체크 스크립트
# 2시간 간격으로 Task Scheduler에서 호출됨
# 문제 발견 시 Windows Toast 알림 + 로그 기록

$ErrorActionPreference = "Continue"
$ProjectDir = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$LogDir = Join-Path $ProjectDir "logs"
$AlertLog = Join-Path $LogDir "health-alerts.log"

if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}

$issues = @()

function Write-Alert {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $entry = "[$timestamp] $Message"
    Add-Content -Path $AlertLog -Value $entry
    $script:issues += $Message
}

# 1. Node.js 가용성
try {
    $nodeVersion = & node --version 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Alert "CRITICAL: Node.js 실행 불가"
    }
} catch {
    Write-Alert "CRITICAL: Node.js를 찾을 수 없음"
}

# 2. .env 파일 존재
$envFile = Join-Path $ProjectDir ".env"
if (-not (Test-Path $envFile)) {
    Write-Alert "WARNING: .env 파일 없음"
}

# 3. 최근 로그 확인 (24시간 내 활동)
$recentLogs = Get-ChildItem -Path $LogDir -Filter "*.log" -ErrorAction SilentlyContinue |
    Where-Object { $_.LastWriteTime -gt (Get-Date).AddHours(-24) }
if ($recentLogs.Count -eq 0) {
    Write-Alert "WARNING: 24시간 내 로그 활동 없음"
}

# 4. 공유 상태 파일 확인
$shareState = Join-Path $ProjectDir "data\moltbook-share-state.json"
if (Test-Path $shareState) {
    $stateContent = Get-Content $shareState | ConvertFrom-Json
    if ($stateContent.stats.failed -gt 3) {
        Write-Alert "WARNING: Moltbook 공유 실패 $($stateContent.stats.failed)건 누적"
    }
}

# 5. Task Scheduler 등록 상태
$tasks = Get-ScheduledTask -TaskPath "\OpenClaw\" -ErrorAction SilentlyContinue
if (-not $tasks -or $tasks.Count -eq 0) {
    Write-Alert "WARNING: OpenClaw 스케줄 태스크가 등록되지 않음"
} else {
    $disabledTasks = $tasks | Where-Object { $_.State -eq 'Disabled' }
    if ($disabledTasks.Count -gt 0) {
        Write-Alert "WARNING: 비활성 태스크 $($disabledTasks.Count)개: $($disabledTasks.TaskName -join ', ')"
    }
}

# 6. 디스크 공간 확인
$drive = (Get-Item $ProjectDir).PSDrive
$freeGB = [math]::Round($drive.Free / 1GB, 1)
if ($freeGB -lt 1) {
    Write-Alert "WARNING: 디스크 공간 부족 (${freeGB}GB 남음)"
}

# 결과 출력
if ($issues.Count -gt 0) {
    $alertMessage = "OpenClaw: $($issues.Count)개 문제 발견`n" + ($issues -join "`n")

    # Windows Toast 알림
    try {
        [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
        [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom, ContentType = WindowsRuntime] | Out-Null

        $template = @"
<toast>
  <visual>
    <binding template="ToastGeneric">
      <text>OpenClaw Health Check</text>
      <text>$($issues.Count)개 문제 발견</text>
      <text>$($issues[0])</text>
    </binding>
  </visual>
</toast>
"@

        $xml = New-Object Windows.Data.Xml.Dom.XmlDocument
        $xml.LoadXml($template)

        $notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("OpenClaw")
        $toast = New-Object Windows.UI.Notifications.ToastNotification $xml
        $notifier.Show($toast)
    } catch {
        # Toast 실패 시 BurntToast 대체 시도
        try {
            if (Get-Module -ListAvailable -Name BurntToast) {
                Import-Module BurntToast
                New-BurntToastNotification -Text "OpenClaw Health Check", "$($issues.Count)개 문제 발견", "$($issues[0])"
            }
        } catch {
            # 알림 실패 — 로그만 기록
        }
    }

    Write-Host "ISSUES FOUND: $($issues.Count)"
    $issues | ForEach-Object { Write-Host "  - $_" }
} else {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path $AlertLog -Value "[$timestamp] OK: 모든 체크 통과"
    Write-Host "OK: 모든 체크 통과"
}
