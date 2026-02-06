@echo off
REM OpenClaw Moltbook 순환 스케줄러 시작 (백그라운드)

cd /d "%~dp0"

echo ========================================
echo  OpenClaw Moltbook 스케줄러 시작
echo ========================================
echo.

start "OpenClaw-Moltbook" /B npx tsx scripts/moltbook-scheduler.mts > logs\moltbook.log 2>&1

echo [OK] Moltbook 스케줄러가 백그라운드에서 시작되었습니다.
echo.
echo 로그 확인: type logs\moltbook.log
echo 중지: taskkill /FI "WINDOWTITLE eq OpenClaw-Moltbook*"
echo.

pause
