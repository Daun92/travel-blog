# OpenClaw CLI wrapper for Windows
# Usage: .\openclaw.ps1 <command> [args...]

param(
    [Parameter(Position=0, ValueFromRemainingArguments=$true)]
    [string[]]$Args
)

$containerName = "openclaw"

# Check if container is running
$running = docker ps --filter "name=$containerName" --format "{{.Names}}" 2>$null

if ($Args.Count -eq 0) {
    Write-Host "OpenClaw CLI Wrapper" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Commands:" -ForegroundColor Yellow
    Write-Host "  start       - Start OpenClaw gateway"
    Write-Host "  stop        - Stop OpenClaw gateway"
    Write-Host "  status      - Check gateway status"
    Write-Host "  logs        - View gateway logs"
    Write-Host "  shell       - Open shell in container"
    Write-Host "  setup       - Run initial setup"
    Write-Host "  <cmd>       - Run any openclaw command"
    Write-Host ""
    Write-Host "Examples:" -ForegroundColor Yellow
    Write-Host "  .\openclaw.ps1 start"
    Write-Host "  .\openclaw.ps1 agent --help"
    Write-Host "  .\openclaw.ps1 doctor"
    exit 0
}

switch ($Args[0]) {
    "start" {
        Write-Host "Starting OpenClaw gateway..." -ForegroundColor Green
        docker-compose up -d
    }
    "stop" {
        Write-Host "Stopping OpenClaw gateway..." -ForegroundColor Yellow
        docker-compose down
    }
    "status" {
        if ($running) {
            Write-Host "OpenClaw is running" -ForegroundColor Green
            docker exec $containerName node /app/openclaw.mjs health
        } else {
            Write-Host "OpenClaw is not running" -ForegroundColor Red
        }
    }
    "logs" {
        docker-compose logs -f openclaw
    }
    "shell" {
        docker exec -it $containerName /bin/sh
    }
    "setup" {
        docker run -it --rm `
            -v openclaw_data:/home/node/.openclaw `
            -v "${PWD}/workspace:/home/node/.openclaw/workspace" `
            -e "ANTHROPIC_API_KEY=$env:ANTHROPIC_API_KEY" `
            alpine/openclaw setup
    }
    default {
        # Pass through to openclaw CLI
        if ($running) {
            docker exec -it $containerName node /app/openclaw.mjs @Args
        } else {
            docker run -it --rm `
                -v openclaw_data:/home/node/.openclaw `
                -v "${PWD}/workspace:/home/node/.openclaw/workspace" `
                -e "ANTHROPIC_API_KEY=$env:ANTHROPIC_API_KEY" `
                alpine/openclaw @Args
        }
    }
}
