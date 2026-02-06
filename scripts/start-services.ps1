# OpenClaw 서비스 시작 스크립트 (PowerShell)
# Claude Code 세션 종료 후에도 계속 실행

Write-Host "🚀 OpenClaw 서비스 시작" -ForegroundColor Cyan
Write-Host ""

# PM2 설치 확인
$pm2Installed = Get-Command pm2 -ErrorAction SilentlyContinue
if (-not $pm2Installed) {
    Write-Host "⚠️  PM2가 설치되지 않았습니다. 설치 중..." -ForegroundColor Yellow
    npm install -g pm2
    Write-Host "✅ PM2 설치 완료" -ForegroundColor Green
    Write-Host ""
}

# 로그 디렉토리 생성
if (-not (Test-Path "logs")) {
    New-Item -ItemType Directory -Path "logs" | Out-Null
    Write-Host "📁 로그 폴더 생성 완료" -ForegroundColor Green
}

# 기존 프로세스 중지
Write-Host "🔄 기존 프로세스 확인 중..." -ForegroundColor Yellow
pm2 delete openclaw-moltbook 2>$null
pm2 delete openclaw-daily 2>$null
Write-Host ""

# PM2 Ecosystem 설정으로 시작
Write-Host "🚀 서비스 시작 중..." -ForegroundColor Cyan
pm2 start ecosystem.config.js

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "✅ OpenClaw 서비스 시작 완료!" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

# 상태 확인
pm2 status

Write-Host ""
Write-Host "📋 주요 명령어:" -ForegroundColor White
Write-Host "  pm2 logs           - 실시간 로그 확인" -ForegroundColor Gray
Write-Host "  pm2 status         - 서비스 상태 확인" -ForegroundColor Gray
Write-Host "  pm2 restart all    - 모든 서비스 재시작" -ForegroundColor Gray
Write-Host "  pm2 stop all       - 모든 서비스 중지" -ForegroundColor Gray
Write-Host "  pm2 delete all     - 모든 서비스 삭제" -ForegroundColor Gray
Write-Host ""
Write-Host "💡 팁: Claude Code를 종료해도 계속 실행됩니다!" -ForegroundColor Yellow
Write-Host ""

# PM2 부팅 시 자동 시작 설정
Write-Host "💾 부팅 시 자동 시작 설정..." -ForegroundColor Yellow
pm2 save
pm2 startup

Write-Host ""
Write-Host "✅ 설정 완료! 이제 컴퓨터를 재시작해도 자동으로 실행됩니다." -ForegroundColor Green
Write-Host ""
