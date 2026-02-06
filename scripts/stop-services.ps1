# OpenClaw 서비스 중지 스크립트 (PowerShell)

Write-Host "🛑 OpenClaw 서비스 중지" -ForegroundColor Yellow
Write-Host ""

# 모든 PM2 프로세스 중지
pm2 stop all

Write-Host ""
Write-Host "✅ 모든 서비스가 중지되었습니다." -ForegroundColor Green
Write-Host ""

# 상태 확인
pm2 status

Write-Host ""
Write-Host "💡 서비스 재시작: .\scripts\start-services.ps1" -ForegroundColor Cyan
Write-Host "💡 완전 삭제: pm2 delete all" -ForegroundColor Cyan
Write-Host ""
