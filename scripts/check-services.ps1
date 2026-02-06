# OpenClaw 서비스 상태 확인 스크립트 (PowerShell)

Write-Host "📊 OpenClaw 서비스 상태" -ForegroundColor Cyan
Write-Host ""

# PM2 상태
pm2 status

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

# 상세 정보
Write-Host "📋 openclaw-moltbook (Moltbook 자동 공유):" -ForegroundColor White
pm2 info openclaw-moltbook 2>$null

Write-Host ""
Write-Host "📋 openclaw-daily (일일 포스트 생성):" -ForegroundColor White
pm2 info openclaw-daily 2>$null

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

# 최근 로그
Write-Host "📜 최근 로그 (Moltbook):" -ForegroundColor Yellow
pm2 logs openclaw-moltbook --lines 10 --nostream 2>$null

Write-Host ""
Write-Host "📜 최근 로그 (Daily):" -ForegroundColor Yellow
pm2 logs openclaw-daily --lines 10 --nostream 2>$null

Write-Host ""
Write-Host "💡 실시간 로그: pm2 logs" -ForegroundColor Cyan
Write-Host ""
